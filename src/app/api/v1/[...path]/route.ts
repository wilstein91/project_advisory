/**
 * 목업 API 서버 — docs/api-spec.md v1 구현
 *
 * 실제 백엔드가 준비되면 이 폴더(src/app/api/v1)와 src/lib/mock을 통째로 지우고
 * .env.local의 NEXT_PUBLIC_API_BASE_URL을 진짜 주소로 바꾸면 됩니다.
 * 화면 코드는 한 줄도 건드리지 않습니다.
 *
 * 경로를 하나로 받는 이유: 지울 때 파일 하나만 지우면 되기 때문입니다.
 */

import { NextResponse } from 'next/server';
import {
  DIAGNOSIS_DISCLAIMER,
  STAFF,
  STRATEGIES,
  STRATEGY_BY_TIER,
  TIER_LABELS,
  TIER_SUMMARIES,
} from '@/lib/mock/catalog';
import { amountLabel, diagnose, visibleQuestions } from '@/lib/mock/scoring';
import {
  addMemo,
  answersDisplay,
  configPayload,
  confirmVerification,
  consumeVerificationToken,
  createInquiry,
  delay,
  getInquiry,
  listAudit,
  listInquiries,
  login,
  publicQuestions,
  recordAudit,
  reportPreview,
  requestVerification,
  sendReport,
  staffFromToken,
  updateInquiry,
  verifyFixtures,
} from '@/lib/mock/store';
import type { AnswerMap, CloseReason, Diagnosis, InquiryStatus, Segment } from '@/lib/mock/types';

/** 로딩 상태를 실제로 만들 수 있도록 일부러 조금 늦춘다. */
const LATENCY_MS = 240;

type Ctx = { params: Promise<{ path?: string[] }> };

/* ------------------------------------------------------------------ *
 * 응답 봉투 — §1.2
 * ------------------------------------------------------------------ */

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(
  code: string,
  message: string,
  status: number,
  extra?: { fields?: Record<string, string>; data?: unknown },
) {
  return NextResponse.json(
    { ok: false, error: { code, message, fields: extra?.fields }, data: extra?.data },
    { status },
  );
}

const notFound = (path: string[]) =>
  fail('NOT_FOUND', `알 수 없는 경로입니다: /${path.join('/')}`, 404);

/* ------------------------------------------------------------------ *
 * 담당자 인증 — §1.4
 * ------------------------------------------------------------------ */

function requireStaff(request: Request) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const staff = staffFromToken(bearer);
  if (staff) return staff;

  // 목업 편의: 로그인 없이 화면을 보고 싶을 때.
  // 헤더에는 담당자 id가 온다 — HTTP 헤더 값에 한글을 담을 수 없다.
  const mockActorId = request.headers.get('x-mock-actor');
  if (mockActorId) {
    const known = STAFF.find((s) => s.id === mockActorId);
    return known ?? { id: mockActorId, name: '운영관리자', email: '', role: 'manager' as const };
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * 값 다듬기
 * ------------------------------------------------------------------ */

function asSegment(value: unknown): Segment | null {
  return value === 'individual' || value === 'corporate' ? value : null;
}

const STATUSES: InquiryStatus[] = ['new', 'reviewing', 'reportSent', 'consulting', 'closed'];
const asStatus = (v: unknown): InquiryStatus | undefined =>
  STATUSES.includes(v as InquiryStatus) ? (v as InquiryStatus) : undefined;

/** 고객 응답에는 점수와 내역을 넣지 않는다 — §3.2 */
function publicDiagnosis(diagnosis: Diagnosis, segment: Segment, answers: AnswerMap) {
  return {
    tier: diagnosis.tier,
    tierLabel: TIER_LABELS[diagnosis.tier],
    tierSummary: TIER_SUMMARIES[diagnosis.tier],
    complete: diagnosis.complete,
    unsureCount: diagnosis.unsureCount,
    amountTierIndex: diagnosis.amountTierIndex,
    amountLabel: amountLabel(segment, answers),
    belowMinimum: diagnosis.belowMinimum,
  };
}

/* ================================================================== *
 * GET
 * ================================================================== */

export async function GET(request: Request, ctx: Ctx) {
  await delay(LATENCY_MS);
  const { path = [] } = await ctx.params;
  const url = new URL(request.url);

  switch (path[0]) {
    case 'config':
      return ok(configPayload());

    case 'questions': {
      const segment = asSegment(url.searchParams.get('segment'));
      if (!segment) {
        return fail('VALIDATION_FAILED', '고객 구분이 필요합니다.', 400, {
          fields: { segment: 'individual 또는 corporate여야 합니다.' },
        });
      }
      return ok({ segment, questions: publicQuestions(segment) });
    }

    case 'strategies':
      return ok({ strategies: STRATEGIES, disclaimer: DIAGNOSIS_DISCLAIMER });

    case 'staff':
      return staffGet(request, path, url);

    case '_selfcheck':
      return ok({ mismatches: verifyFixtures() });

    default:
      return notFound(path);
  }
}

function staffGet(request: Request, path: string[], url: URL) {
  const staff = requireStaff(request);
  if (!staff) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

  // /staff/audit
  if (path[1] === 'audit') {
    return ok(
      listAudit(
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
    recordAudit(staff.name, 'viewList', null, url.search || '전체');
    return ok(
      listInquiries({
        status: asStatus(p.get('status')),
        segment: asSegment(p.get('segment')) ?? undefined,
        assignee: p.get('assignee') ?? undefined,
        q: p.get('q') ?? undefined,
        minUnsure: p.get('minUnsure') ? Number(p.get('minUnsure')) : undefined,
        belowMinimum: p.get('belowMinimum') === null ? undefined : p.get('belowMinimum') === 'true',
        page: Number(p.get('page') ?? 1),
        size: Number(p.get('size') ?? 20),
      }),
    );
  }

  const inquiry = getInquiry(path[2]);
  if (!inquiry) return fail('NOT_FOUND', '문의를 찾을 수 없습니다.', 404);

  // /staff/inquiries/{id}/report/preview
  if (path[3] === 'report' && path[4] === 'preview') {
    return ok({ sections: reportPreview(inquiry), editable: false });
  }

  // /staff/inquiries/{id}
  if (!path[3]) {
    recordAudit(staff.name, 'viewDetail', inquiry.id);
    return ok({
      inquiry: {
        ...inquiry,
        answersDisplay: answersDisplay(inquiry),
        amountLabel: amountLabel(inquiry.segment, inquiry.answers),
        tierLabel: TIER_LABELS[inquiry.diagnosis.tier],
        tierSummary: TIER_SUMMARIES[inquiry.diagnosis.tier],
      },
      strategy: STRATEGY_BY_TIER[inquiry.diagnosis.tier],
      audit: listAudit(inquiry.id).items,
    });
  }

  return notFound(path);
}

/* ================================================================== *
 * POST
 * ================================================================== */

export async function POST(request: Request, ctx: Ctx) {
  await delay(LATENCY_MS);
  const { path = [] } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  /* ---------- 판정 미리보기 (저장하지 않음) ---------- */
  if (path[0] === 'diagnosis' && path[1] === 'preview') {
    const segment = asSegment(body.segment);
    if (!segment) return fail('VALIDATION_FAILED', '고객 구분이 필요합니다.', 400);

    const answers = (body.answers ?? {}) as AnswerMap;
    const diagnosis = diagnose(segment, answers);
    return ok({
      diagnosis: publicDiagnosis(diagnosis, segment, answers),
      strategy: STRATEGY_BY_TIER[diagnosis.tier],
      disclaimer: DIAGNOSIS_DISCLAIMER,
      visibleQuestionIds: visibleQuestions(segment, answers).map((q) => q.id),
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
      const result = requestVerification(email);
      return ok({
        expiresInSeconds: result.expiresInSeconds,
        maxAttempts: result.maxAttempts,
        // 목업만의 예외. 실제 백엔드는 절대 넣지 않는다 — api-spec.md §4.5
        mockCode: result.mockCode,
      });
    }

    if (path[1] === 'confirm') {
      const result = confirmVerification(email, String(body.code ?? ''));
      if (!result.ok) {
        return fail(result.code, result.message, result.code === 'VERIFICATION_LOCKED' ? 429 : 400, {
          data: { attemptsLeft: result.attemptsLeft },
        });
      }
      return ok({ verificationToken: result.token, expiresInSeconds: result.expiresInSeconds });
    }

    return notFound(path);
  }

  /* ---------- 접수 ---------- */
  if (path[0] === 'inquiries' && !path[1]) {
    return submitInquiry(request, body);
  }

  /* ---------- 담당자 ---------- */
  if (path[0] === 'staff') {
    if (path[1] === 'session') {
      const result = login(String(body.email ?? ''), String(body.password ?? ''));
      if (!result) {
        return fail('UNAUTHORIZED', '이메일 또는 비밀번호가 맞지 않습니다.', 401);
      }
      return ok(result);
    }

    const staff = requireStaff(request);
    if (!staff) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);

    if (path[1] === 'inquiries' && path[2]) {
      if (path[3] === 'memos') {
        const result = addMemo(path[2], staff.name, String(body.body ?? ''));
        return result.ok
          ? ok({ memo: result.value }, 201)
          : fail(result.code, result.message, result.code === 'NOT_FOUND' ? 404 : 400);
      }
      if (path[3] === 'report') {
        const result = sendReport(path[2], staff.name);
        if (!result.ok) {
          return fail(result.code, result.message, result.code === 'CONFLICT' ? 409 : 404);
        }
        return ok({ inquiry: result.value, sentAt: result.value.reportSentAt });
      }
    }
  }

  return notFound(path);
}

function submitInquiry(request: Request, body: Record<string, unknown>) {
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

  // 필수 동의가 없으면 접수하지 않는다 — §11
  if (consents.privacy !== true) {
    return fail('CONSENT_REQUIRED', '개인정보 수집·이용에 동의해 주셔야 접수됩니다.', 400);
  }

  // 인증한 이메일과 같은 주소로만 접수된다 — §4.7
  const token = request.headers.get('x-verification-token');
  if (!consumeVerificationToken(token, contact.email!)) {
    return fail('VERIFICATION_REQUIRED', '이메일 인증을 다시 받아주세요.', 401);
  }

  const answers = (body.answers ?? {}) as AnswerMap;
  const inquiry = createInquiry({
    segment,
    contact: {
      name: contact.name!.trim(),
      email: contact.email!.trim(),
      phone: contact.phone!.trim(),
      ...(segment === 'corporate'
        ? { companyName: contact.companyName!.trim(), title: contact.title!.trim() }
        : {}),
    },
    answers,
    // 선택 동의. 없어도 정상 접수된다 — §11
    marketing: consents.marketing === true,
  });

  const slaDays = configPayload().reportSlaHours / 24;
  return ok(
    {
      inquiryId: inquiry.id,
      diagnosis: publicDiagnosis(inquiry.diagnosis, segment, answers),
      strategy: STRATEGY_BY_TIER[inquiry.diagnosis.tier],
      disclaimer: DIAGNOSIS_DISCLAIMER,
      reportNotice: `상세 결과지는 담당자 확인 후 영업일 기준 ${slaDays}일 내에 메일로 보내드립니다.`,
    },
    201,
  );
}

/* ================================================================== *
 * PATCH / DELETE
 * ================================================================== */

export async function PATCH(request: Request, ctx: Ctx) {
  await delay(LATENCY_MS);
  const { path = [] } = await ctx.params;

  const staff = requireStaff(request);
  if (!staff) return fail('UNAUTHORIZED', '로그인이 필요합니다.', 401);
  if (path[0] !== 'staff' || path[1] !== 'inquiries' || !path[2]) return notFound(path);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const result = updateInquiry(
    path[2],
    {
      status: asStatus(body.status),
      assignee: body.assignee as string | null | undefined,
      closeReason: body.closeReason as CloseReason | null | undefined,
      closeNote: body.closeNote as string | null | undefined,
    },
    staff.name,
  );

  return result.ok
    ? ok({ inquiry: result.value })
    : fail(result.code, result.message, result.code === 'NOT_FOUND' ? 404 : 400);
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { path = [] } = await ctx.params;
  if (path[0] === 'staff' && path[1] === 'session') {
    return new NextResponse(null, { status: 204 });
  }
  return notFound(path);
}
