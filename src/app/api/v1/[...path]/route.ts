/**
 * API 서버 — docs/api-spec.md v1 구현
 *
 * 데이터는 전부 Supabase에서 옵니다. 문항·전략군·문구도 표에서 읽으므로,
 * 문구를 고칠 때 배포하지 않고 Supabase 표 편집기에서 고치면 됩니다.
 *
 * 브라우저는 Supabase를 직접 부르지 않습니다. 항상 이 라우트를 거칩니다.
 * 그래야 배점(choices.score)이 새지 않고, 나중에 백엔드를 바꿔도 화면이 안 깨집니다.
 */

import { NextResponse } from 'next/server';
import { isConfigured } from '@/lib/db/client';
import { loadCatalog } from '@/lib/db/catalog';
import {
  addMemo,
  createInquiry,
  getInquiryDetail,
  listAudit,
  listInquiries,
  recordAudit,
  reportPreview,
  sendReport,
  statusCounts,
  updateInquiry,
} from '@/lib/db/inquiries';
import {
  confirmCode,
  consumeToken,
  findStaffByEmail,
  findStaffById,
  issueCode,
  type StaffRecord,
} from '@/lib/db/verification';
import {
  labelOf,
  publicQuestions,
  summaryOf,
  tierLabels,
  type Catalog,
} from '@/lib/domain/catalog';
import { amountLabel, diagnose, visibleQuestions } from '@/lib/domain/scoring';
import type { DiagnosisResult } from '@/lib/domain/scoring';
import type { AnswerMap, CloseReason, InquiryStatus, Segment } from '@/lib/api/types';

type Ctx = { params: Promise<{ path?: string[] }> };

/** 목업 단계 편의. 담당자 로그인 없이 화면을 열어볼 수 있게 한다. */
const MOCK_PASSWORD = process.env.STAFF_DEV_PASSWORD ?? 'advisory';

/* ------------------------------------------------------------------ *
 * 응답 봉투 — api-spec.md §1.2
 * ------------------------------------------------------------------ */

const ok = (data: unknown, status = 200) =>
  NextResponse.json({ ok: true, data }, { status });

const fail = (
  code: string,
  message: string,
  status: number,
  extra?: { fields?: Record<string, string>; data?: unknown },
) =>
  NextResponse.json(
    { ok: false, error: { code, message, fields: extra?.fields }, data: extra?.data },
    { status },
  );

const notFound = (path: string[]) =>
  fail('NOT_FOUND', `알 수 없는 경로입니다: /${path.join('/')}`, 404);

/** DB 호출이 던진 예외를 화면에 보여줄 문장으로 바꾼다. */
function serverError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : '서버에서 문제가 생겼습니다.';
  console.error('[api]', message);
  return fail('INTERNAL', message, 500);
}

function requireConfig() {
  return isConfigured()
    ? null
    : fail(
        'INTERNAL',
        'Supabase 설정이 아직 없습니다. .env.local에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 넣어주세요.',
        503,
      );
}

/* ------------------------------------------------------------------ *
 * 값 다듬기
 * ------------------------------------------------------------------ */

const asSegment = (value: unknown): Segment | null =>
  value === 'individual' || value === 'corporate' ? value : null;

const STATUSES: InquiryStatus[] = ['new', 'reviewing', 'reportSent', 'consulting', 'closed'];
const asStatus = (value: unknown): InquiryStatus | undefined =>
  STATUSES.includes(value as InquiryStatus) ? (value as InquiryStatus) : undefined;

/** 고객 응답에는 점수와 내역을 넣지 않는다 (api-spec.md §3.2) */
function publicDiagnosis(
  catalog: Catalog,
  diagnosis: DiagnosisResult,
  segment: Segment,
  answers: AnswerMap,
) {
  return {
    tier: diagnosis.tier,
    tierLabel: labelOf(catalog, diagnosis.tier),
    tierSummary: summaryOf(catalog, diagnosis.tier),
    complete: diagnosis.complete,
    unsureCount: diagnosis.unsureCount,
    amountTierIndex: diagnosis.amountTierIndex,
    amountLabel: amountLabel(catalog, segment, answers),
    belowMinimum: diagnosis.belowMinimum,
  };
}

/* ------------------------------------------------------------------ *
 * 담당자 인증 — api-spec.md §1.4
 * ------------------------------------------------------------------ */

async function currentStaff(request: Request): Promise<StaffRecord | null> {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  if (bearer?.startsWith('st_')) {
    return findStaffById(bearer.slice(3));
  }
  // 목업 편의: 로그인 없이 담당자 화면을 열어볼 수 있게 한다.
  // 헤더에는 담당자 id가 온다 — HTTP 헤더 값에 한글을 담을 수 없다.
  const mockActorId = request.headers.get('x-mock-actor');
  return mockActorId ? findStaffById(mockActorId) : null;
}

/* ================================================================== *
 * GET
 * ================================================================== */

export async function GET(request: Request, ctx: Ctx) {
  const missing = requireConfig();
  if (missing) return missing;

  const { path = [] } = await ctx.params;
  const url = new URL(request.url);

  try {
    switch (path[0]) {
      case 'config': {
        const catalog = await loadCatalog();
        return ok({
          minimumAmountKrw: catalog.config.minimumAmountKrw,
          belowMinimumNotice: catalog.config.belowMinimumNotice,
          amountTiers: catalog.amountTiers,
          labels: {
            tier: tierLabels(catalog),
            status: {
              new: '신규',
              reviewing: '검토중',
              reportSent: '결과지 발송',
              consulting: '상담 진행',
              closed: '종료',
            },
            closeReason: {
              contracted: '계약',
              belowMinimum: '금액 미달',
              unreachable: '연락 불가',
              customerHold: '고객 보류',
              other: '기타',
            },
          },
          disclaimer: catalog.config.disclaimer,
          reportSlaHours: catalog.config.reportSlaHours,
          verification: catalog.config.verification,
        });
      }

      case 'questions': {
        const segment = asSegment(url.searchParams.get('segment'));
        if (!segment) {
          return fail('VALIDATION_FAILED', '고객 구분이 필요합니다.', 400, {
            fields: { segment: 'individual 또는 corporate여야 합니다.' },
          });
        }
        const catalog = await loadCatalog();
        return ok({ segment, questions: publicQuestions(catalog, segment) });
      }

      case 'strategies': {
        const catalog = await loadCatalog();
        return ok({
          strategies: catalog.tiers.map((t) => catalog.strategies[t.tier]).filter(Boolean),
          disclaimer: catalog.config.disclaimer,
        });
      }

      case 'staff':
        return await staffGet(request, path, url);

      case '_health': {
        const catalog = await loadCatalog();
        const counts = await statusCounts();
        return ok({
          supabase: 'connected',
          questions: {
            individual: catalog.questions.individual.length,
            corporate: catalog.questions.corporate.length,
          },
          tiers: catalog.tiers.length,
          strategies: Object.keys(catalog.strategies).length,
          inquiries: counts,
        });
      }

      default:
        return notFound(path);
    }
  } catch (cause) {
    return serverError(cause);
  }
}

async function staffGet(request: Request, path: string[], url: URL) {
  const staff = await currentStaff(request);
  if (!staff) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  if (path[1] === 'audit') {
    return ok(
      await listAudit(
        url.searchParams.get('inquiryId') ?? undefined,
        Number(url.searchParams.get('page') ?? 1),
        Number(url.searchParams.get('size') ?? 20),
      ),
    );
  }

  if (path[1] !== 'inquiries') return notFound(path);

  // /staff/inquiries
  if (!path[2]) {
    const p = url.searchParams;
    const result = await listInquiries({
      status: asStatus(p.get('status')),
      segment: asSegment(p.get('segment')) ?? undefined,
      assignee: p.get('assignee') ?? undefined,
      q: p.get('q') ?? undefined,
      minUnsure: p.get('minUnsure') ? Number(p.get('minUnsure')) : undefined,
      belowMinimum: p.get('belowMinimum') === null ? undefined : p.get('belowMinimum') === 'true',
      page: Number(p.get('page') ?? 1),
      size: Number(p.get('size') ?? 20),
    });
    await recordAudit(staff.name, 'viewList', null, url.search || '전체');
    return ok(result);
  }

  // /staff/inquiries/{id}/report/preview
  if (path[3] === 'report' && path[4] === 'preview') {
    const sections = await reportPreview(path[2]);
    if (!sections) return fail('NOT_FOUND', '문의를 찾을 수 없습니다.', 404);
    return ok({ sections, editable: false });
  }

  // /staff/inquiries/{id}
  if (!path[3]) {
    const found = await getInquiryDetail(path[2]);
    if (!found) return fail('NOT_FOUND', '문의를 찾을 수 없습니다.', 404);
    await recordAudit(staff.name, 'viewDetail', path[2]);
    const audit = await listAudit(path[2], 1, 20);
    return ok({ inquiry: found.inquiry, strategy: found.strategy, audit: audit.items });
  }

  return notFound(path);
}

/* ================================================================== *
 * POST
 * ================================================================== */

export async function POST(request: Request, ctx: Ctx) {
  const missing = requireConfig();
  if (missing) return missing;

  const { path = [] } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    /* ---------- 판정 미리보기 (저장하지 않음) ---------- */
    if (path[0] === 'diagnosis' && path[1] === 'preview') {
      const segment = asSegment(body.segment);
      if (!segment) return fail('VALIDATION_FAILED', '고객 구분이 필요합니다.', 400);

      const catalog = await loadCatalog();
      const answers = (body.answers ?? {}) as AnswerMap;
      const diagnosis = diagnose(catalog, segment, answers);

      return ok({
        diagnosis: publicDiagnosis(catalog, diagnosis, segment, answers),
        strategy: catalog.strategies[diagnosis.tier],
        disclaimer: catalog.config.disclaimer,
        visibleQuestionIds: visibleQuestions(catalog, segment, answers).map((q) => q.id),
      });
    }

    /* ---------- 이메일 인증 ---------- */
    if (path[0] === 'email-verifications') {
      const email = String(body.email ?? '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return fail('VALIDATION_FAILED', '이메일 주소를 확인해 주세요.', 400, {
          fields: { email: '형식이 올바르지 않습니다.' },
        });
      }

      if (!path[1]) {
        const issued = await issueCode(email);
        return ok({
          expiresInSeconds: issued.expiresInSeconds,
          maxAttempts: issued.maxAttempts,
          // 메일 발송을 아직 붙이지 않아 화면에 띄운다.
          // 실제 서비스로 갈 때 이 줄을 지우고 메일 발송을 넣는다 (api-spec.md §4.5).
          mockCode: issued.devCode,
        });
      }

      if (path[1] === 'confirm') {
        const result = await confirmCode(email, String(body.code ?? ''));
        if (!result.ok) {
          return fail(
            result.code,
            result.message,
            result.code === 'VERIFICATION_LOCKED' ? 429 : 400,
            { data: { attemptsLeft: result.attemptsLeft } },
          );
        }
        return ok({
          verificationToken: result.token,
          expiresInSeconds: result.expiresInSeconds,
        });
      }
      return notFound(path);
    }

    /* ---------- 접수 ---------- */
    if (path[0] === 'inquiries' && !path[1]) {
      return await submitInquiry(request, body);
    }

    /* ---------- 담당자 ---------- */
    if (path[0] === 'staff') {
      if (path[1] === 'session') {
        const staff = await findStaffByEmail(String(body.email ?? ''));
        if (!staff || String(body.password ?? '') !== MOCK_PASSWORD) {
          return fail('UNAUTHORIZED', '이메일 또는 비밀번호가 맞지 않습니다.', 401);
        }
        await recordAudit(staff.name, 'login', null);
        return ok({ token: `st_${staff.id}`, staff });
      }

      const staff = await currentStaff(request);
      if (!staff) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

      if (path[1] === 'inquiries' && path[2]) {
        if (path[3] === 'memos') {
          const result = await addMemo(path[2], staff.name, String(body.body ?? ''));
          return result.ok
            ? ok({ memo: result.value }, 201)
            : fail(result.code, result.message, result.code === 'NOT_FOUND' ? 404 : 400);
        }
        if (path[3] === 'report') {
          const result = await sendReport(path[2], staff.name);
          if (!result.ok) {
            return fail(result.code, result.message, result.code === 'CONFLICT' ? 409 : 404);
          }
          const found = await getInquiryDetail(path[2]);
          return ok({ inquiry: found?.inquiry, sentAt: result.value });
        }
      }
    }

    return notFound(path);
  } catch (cause) {
    return serverError(cause);
  }
}

async function submitInquiry(request: Request, body: Record<string, unknown>) {
  const segment = asSegment(body.segment);
  if (!segment) return fail('VALIDATION_FAILED', '고객 구분이 필요합니다.', 400);

  const contact = (body.contact ?? {}) as Record<string, string | null>;
  const consents = (body.consents ?? {}) as Record<string, boolean>;
  const fields: Record<string, string> = {};

  if (!contact.name?.trim()) fields.name = '이름을 입력해 주세요.';
  if (!contact.email?.trim()) fields.email = '이메일을 입력해 주세요.';
  if (!contact.phone?.trim()) fields.phone = '연락처를 입력해 주세요.';
  if (segment === 'corporate') {
    if (!contact.companyName?.trim()) fields.companyName = '법인명을 입력해 주세요.';
    if (!contact.title?.trim()) fields.title = '직위를 입력해 주세요.';
  }
  if (Object.keys(fields).length) {
    return fail('VALIDATION_FAILED', '입력하지 않은 항목이 있습니다.', 400, { fields });
  }

  // 필수 동의가 없으면 접수하지 않는다 (PRD §11)
  if (consents.privacy !== true) {
    return fail('CONSENT_REQUIRED', '개인정보 수집·이용에 동의해 주셔야 접수됩니다.', 400);
  }

  // 인증한 이메일과 같은 주소로만 접수된다 (api-spec.md §4.7)
  const token = request.headers.get('x-verification-token');
  if (!(await consumeToken(token, contact.email!))) {
    return fail('VERIFICATION_REQUIRED', '이메일 인증을 다시 받아주세요.', 401);
  }

  const catalog = await loadCatalog();
  const answers = (body.answers ?? {}) as AnswerMap;

  const created = await createInquiry({
    segment,
    contact: {
      name: contact.name!.trim(),
      email: contact.email!.trim(),
      phone: contact.phone!.trim(),
      companyName: segment === 'corporate' ? contact.companyName!.trim() : null,
      title: segment === 'corporate' ? contact.title!.trim() : null,
    },
    answers,
    // 선택 동의. 없어도 정상 접수된다 (PRD §11)
    marketing: consents.marketing === true,
  });

  const slaDays = catalog.config.reportSlaHours / 24;
  return ok(
    {
      inquiryId: created.id,
      diagnosis: publicDiagnosis(catalog, created.diagnosis, segment, answers),
      strategy: catalog.strategies[created.diagnosis.tier],
      disclaimer: catalog.config.disclaimer,
      reportNotice: `상세 결과지는 담당자 확인 후 영업일 기준 ${slaDays}일 내에 메일로 보내드립니다.`,
    },
    201,
  );
}

/* ================================================================== *
 * PATCH / DELETE
 * ================================================================== */

export async function PATCH(request: Request, ctx: Ctx) {
  const missing = requireConfig();
  if (missing) return missing;

  const { path = [] } = await ctx.params;

  try {
    const staff = await currentStaff(request);
    if (!staff) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);
    if (path[0] !== 'staff' || path[1] !== 'inquiries' || !path[2]) return notFound(path);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await updateInquiry(
      path[2],
      {
        status: asStatus(body.status),
        assignee: body.assignee as string | null | undefined,
        closeReason: body.closeReason as CloseReason | null | undefined,
        closeNote: body.closeNote as string | null | undefined,
      },
      staff.name,
    );

    if (!result.ok) {
      return fail(result.code, result.message, result.code === 'NOT_FOUND' ? 404 : 400);
    }
    const found = await getInquiryDetail(path[2]);
    return ok({ inquiry: found?.inquiry });
  } catch (cause) {
    return serverError(cause);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  if (path[0] === 'staff' && path[1] === 'session') {
    return new NextResponse(null, { status: 204 });
  }
  return notFound(path);
}
