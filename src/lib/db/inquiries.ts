import 'server-only';
import { db } from './client';
import { loadCatalog } from './catalog';
import { amountLabel, diagnose, type DiagnosisResult } from '@/lib/domain/scoring';
import { freeTextQuestionIds, labelOf, summaryOf, type Catalog } from '@/lib/domain/catalog';
import type {
  AnswerDisplay,
  AnswerMap,
  AuditAction,
  AuditEntry,
  CloseReason,
  Consents,
  Contact,
  InquiryDetail,
  InquiryListRow,
  InquiryStatus,
  Memo,
  ReportSection,
  Segment,
} from '@/lib/api/types';

/**
 * 문의 저장소 — Supabase
 *
 * 예전 목업(src/lib/mock/store.ts)이 하던 일을 실제 DB로 옮긴 것입니다.
 * 함수 이름과 반환 모양은 api-spec.md v1에 맞춰 두었습니다.
 */

export const STATUS_ORDER: InquiryStatus[] = [
  'new',
  'reviewing',
  'reportSent',
  'consulting',
  'closed',
];

/* ------------------------------------------------------------------ *
 * 표 모양 → API 모양
 * ------------------------------------------------------------------ */

interface InquiryRow {
  id: string;
  segment: Segment;
  submitted_at: string;
  email_verified_at: string;
  contact: Contact;
  answers: AnswerMap;
  diagnosis: DiagnosisResult;
  consents: Consents;
  status: InquiryStatus;
  assignee: string | null;
  report_sent_at: string | null;
  close_reason: CloseReason | null;
  close_note: string | null;
}

const INQUIRY_COLUMNS =
  'id, segment, submitted_at, email_verified_at, contact, answers, diagnosis, consents, status, assignee, report_sent_at, close_reason, close_note';

/** 결과지 발송 기한 초과 — 목록 맨 위로 올린다 (PRD §9) */
function isOverdue(row: InquiryRow, slaHours: number): boolean {
  if (row.status !== 'new' && row.status !== 'reviewing') return false;
  return (Date.now() - new Date(row.submitted_at).getTime()) / 3_600_000 > slaHours;
}

function freeTextPreview(catalog: Catalog, row: InquiryRow): string | null {
  for (const id of freeTextQuestionIds(catalog)) {
    const value = row.answers[id];
    if (typeof value === 'string' && value.trim()) return value.trim().split('\n')[0];
  }
  return null;
}

function toListRow(catalog: Catalog, row: InquiryRow): InquiryListRow {
  return {
    id: row.id,
    submittedAt: row.submitted_at,
    segment: row.segment,
    name: row.contact.name,
    companyName: row.contact.companyName ?? null,
    tier: row.diagnosis.tier,
    amountLabel: amountLabel(catalog, row.segment, row.answers),
    belowMinimum: row.diagnosis.belowMinimum,
    unsureCount: row.diagnosis.unsureCount,
    status: row.status,
    assignee: row.assignee,
    freeTextPreview: freeTextPreview(catalog, row),
    reportOverdue: isOverdue(row, catalog.config.reportSlaHours),
  };
}

/** 답변을 사람이 읽는 문장으로 (api-spec.md §5.4) */
function answersDisplay(catalog: Catalog, row: InquiryRow): AnswerDisplay[] {
  return catalog.questions[row.segment].flatMap((question) => {
    const value = row.answers[question.id];
    if (value === undefined || value === null || value === '') return [];

    if (Array.isArray(value)) {
      if (value.length === 0) return [];
      const picked = value.map((v) => question.choices?.find((c) => c.value === v));
      return [
        {
          questionId: question.id,
          prompt: question.prompt,
          answerLabel: picked.map((c) => c?.label ?? '—').join(', '),
          isUnsure: picked.some((c) => c?.isUnsure === true),
        },
      ];
    }

    const choice = question.choices?.find((c) => c.value === value);
    return [
      {
        questionId: question.id,
        prompt: question.prompt,
        answerLabel: choice?.label ?? String(value),
        isUnsure: choice?.isUnsure === true,
      },
    ];
  });
}

/* ------------------------------------------------------------------ *
 * 목록
 * ------------------------------------------------------------------ */

export interface ListFilter {
  status?: InquiryStatus;
  segment?: Segment;
  assignee?: string;
  q?: string;
  minUnsure?: number;
  belowMinimum?: boolean;
  page?: number;
  size?: number;
}

export async function listInquiries(filter: ListFilter = {}) {
  const catalog = await loadCatalog();
  const client = db();

  // 모름 수·금액 미달은 jsonb 안에 있고 정렬 기준(기한 초과)은 계산값이라,
  // 이 규모(수백 건)에서는 전부 읽어와 서버에서 거르는 편이 단순하고 빠르다.
  // 건수가 크게 늘면 diagnosis의 값들을 생성 컬럼으로 빼서 인덱스를 걸면 된다.
  let query = client.from('inquiries').select(INQUIRY_COLUMNS);
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.segment) query = query.eq('segment', filter.segment);
  if (filter.assignee) query = query.eq('assignee', filter.assignee);

  const { data, error } = await query;
  if (error) throw new Error(`목록을 불러오지 못했습니다: ${error.message}`);

  const needle = filter.q?.trim().toLowerCase();
  const rows = (data ?? []) as unknown as InquiryRow[];

  const matched = rows
    .filter((row) => {
      if (filter.belowMinimum !== undefined && row.diagnosis.belowMinimum !== filter.belowMinimum)
        return false;
      if (filter.minUnsure !== undefined && row.diagnosis.unsureCount < filter.minUnsure)
        return false;
      if (needle) {
        const hay = [row.id, row.contact.name, row.contact.companyName ?? '']
          .join(' ')
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    })
    .map((row) => toListRow(catalog, row))
    // 정렬은 서버가 정한다 (api-spec.md §5.3)
    .sort((a, b) => {
      if (a.reportOverdue !== b.reportOverdue) return a.reportOverdue ? -1 : 1;
      return b.submittedAt.localeCompare(a.submittedAt);
    });

  const page = Math.max(1, filter.page ?? 1);
  const size = Math.min(100, Math.max(1, filter.size ?? 20));

  return {
    items: matched.slice((page - 1) * size, page * size),
    page,
    size,
    total: matched.length,
    counts: await statusCounts(),
  };
}

export async function statusCounts(): Promise<Record<InquiryStatus, number>> {
  const client = db();
  const base: Record<InquiryStatus, number> = {
    new: 0,
    reviewing: 0,
    reportSent: 0,
    consulting: 0,
    closed: 0,
  };

  const results = await Promise.all(
    STATUS_ORDER.map((status) =>
      client
        .from('inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)
        .then((r) => [status, r.count ?? 0] as const),
    ),
  );
  for (const [status, count] of results) base[status] = count;
  return base;
}

/* ------------------------------------------------------------------ *
 * 상세
 * ------------------------------------------------------------------ */

async function findRow(id: string): Promise<InquiryRow | null> {
  const { data, error } = await db()
    .from('inquiries')
    .select(INQUIRY_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`문의를 불러오지 못했습니다: ${error.message}`);
  return (data as unknown as InquiryRow) ?? null;
}

export async function getInquiryDetail(
  id: string,
): Promise<{ inquiry: InquiryDetail; strategy: Catalog['strategies'][keyof Catalog['strategies']] } | null> {
  const catalog = await loadCatalog();
  const row = await findRow(id);
  if (!row) return null;

  const { data: memoRows } = await db()
    .from('memos')
    .select('at, author, body')
    .eq('inquiry_id', id)
    .order('at');

  const inquiry: InquiryDetail = {
    id: row.id,
    segment: row.segment,
    submittedAt: row.submitted_at,
    emailVerifiedAt: row.email_verified_at,
    contact: row.contact,
    consents: row.consents,
    answers: row.answers,
    answersDisplay: answersDisplay(catalog, row),
    diagnosis: row.diagnosis,
    amountLabel: amountLabel(catalog, row.segment, row.answers),
    tierLabel: labelOf(catalog, row.diagnosis.tier),
    tierSummary: summaryOf(catalog, row.diagnosis.tier),
    status: row.status,
    assignee: row.assignee,
    reportSentAt: row.report_sent_at,
    closeReason: row.close_reason,
    closeNote: row.close_note,
    memos: (memoRows ?? []) as Memo[],
  };

  return { inquiry, strategy: catalog.strategies[row.diagnosis.tier] };
}

/* ------------------------------------------------------------------ *
 * 결과지 미리보기 (PRD §9) — 서식 고정
 * ------------------------------------------------------------------ */

export async function reportPreview(id: string): Promise<ReportSection[] | null> {
  const catalog = await loadCatalog();
  const row = await findRow(id);
  if (!row) return null;

  const strategy = catalog.strategies[row.diagnosis.tier];
  const who = row.contact.companyName
    ? `${row.contact.companyName} ${row.contact.name} ${row.contact.title ?? ''}`.trim()
    : row.contact.name;

  return [
    {
      page: 1,
      title: '표지',
      lines: [
        '○○투자자문 주식회사',
        `접수 번호 ${row.id}`,
        `작성일 ${new Date().toLocaleDateString('ko-KR')}`,
        '참고용 안내 자료',
      ],
    },
    {
      page: 2,
      title: '고객님이 답해주신 내용',
      lines: answersDisplay(catalog, row).map((a) => `${a.prompt} — ${a.answerLabel}`),
    },
    {
      page: 3,
      title: '진단 결과',
      lines: [
        `${who} 님은 ${labelOf(catalog, row.diagnosis.tier)}입니다.`,
        summaryOf(catalog, row.diagnosis.tier),
        catalog.config.disclaimer,
      ],
    },
    {
      page: 4,
      title: '대응되는 전략군',
      lines: strategy
        ? [strategy.name, strategy.description, strategy.volatilityNote, strategy.suitableFor]
        : [],
    },
    {
      page: 5,
      title: '다음 절차',
      lines: [
        `담당자 ${row.assignee ?? '(배정 예정)'}가 연락드립니다.`,
        '상담 시 이 결과지를 함께 보며 설명드립니다.',
      ],
    },
    {
      page: 6,
      title: '필수 고지',
      lines: [
        '[PLACEHOLDER §15-6] 상호 및 등록번호',
        '[PLACEHOLDER §15-6] 원금 손실 가능성 경고 문구',
        '이 자료는 참고용이며 투자권유가 아닙니다.',
        '개인정보 문의 — privacy@example.com',
      ],
    },
  ];
}

/* ------------------------------------------------------------------ *
 * 접수
 * ------------------------------------------------------------------ */

export async function createInquiry(input: {
  segment: Segment;
  contact: Contact;
  answers: AnswerMap;
  marketing: boolean;
}): Promise<{ id: string; diagnosis: DiagnosisResult }> {
  const catalog = await loadCatalog();
  // 접수 시점의 배점으로 계산해서 그대로 굳힌다.
  // 나중에 배점을 바꿔도 과거 문의의 진단이 소급해서 달라지면 안 된다.
  const diagnosis = diagnose(catalog, input.segment, input.answers);
  const now = new Date().toISOString();

  const { data, error } = await db()
    .from('inquiries')
    .insert({
      segment: input.segment,
      submitted_at: now,
      email_verified_at: now,
      contact: input.contact,
      answers: input.answers,
      diagnosis,
      consents: {
        privacy: true,
        privacyAt: now,
        marketing: input.marketing,
        marketingAt: input.marketing ? now : null,
      },
      status: 'new',
    })
    .select('id')
    .single();

  if (error) throw new Error(`접수하지 못했습니다: ${error.message}`);
  return { id: (data as { id: string }).id, diagnosis };
}

/* ------------------------------------------------------------------ *
 * 변경
 * ------------------------------------------------------------------ */

export type Outcome<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

export interface UpdatePatch {
  status?: InquiryStatus;
  assignee?: string | null;
  closeReason?: CloseReason | null;
  closeNote?: string | null;
}

export async function updateInquiry(
  id: string,
  patch: UpdatePatch,
  actor: string,
): Promise<Outcome<true>> {
  const row = await findRow(id);
  if (!row) return { ok: false, code: 'NOT_FOUND', message: '문의를 찾을 수 없습니다.' };

  // 종료 사유는 필수 (PRD §10). DB에도 제약이 있지만 여기서 먼저 잡아 문장을 돌려준다.
  if (patch.status === 'closed' && !(patch.closeReason ?? row.close_reason)) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: '종료로 바꿀 때는 사유를 함께 남겨야 합니다.',
    };
  }

  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.assignee !== undefined) update.assignee = patch.assignee;
  if (patch.closeReason !== undefined) update.close_reason = patch.closeReason;
  if (patch.closeNote !== undefined) update.close_note = patch.closeNote;

  if (Object.keys(update).length > 0) {
    const { error } = await db().from('inquiries').update(update).eq('id', id);
    if (error) return { ok: false, code: 'INTERNAL', message: `바꾸지 못했습니다: ${error.message}` };
  }

  if (patch.status && patch.status !== row.status) {
    await recordAudit(actor, 'changeStatus', id, `${row.status} → ${patch.status}`);
  }
  return { ok: true, value: true };
}

export async function addMemo(
  id: string,
  author: string,
  body: string,
): Promise<Outcome<Memo>> {
  if (!body.trim())
    return { ok: false, code: 'VALIDATION_FAILED', message: '메모 내용을 입력해 주세요.' };

  const { data, error } = await db()
    .from('memos')
    .insert({ inquiry_id: id, author, body: body.trim() })
    .select('at, author, body')
    .single();

  if (error) return { ok: false, code: 'NOT_FOUND', message: '문의를 찾을 수 없습니다.' };
  return { ok: true, value: data as Memo };
}

/** 결과지 발송 (PRD §9). 보낸다 / 보류한다 / 메모를 남긴다 — 담당자가 할 수 있는 건 이 셋뿐. */
export async function sendReport(id: string, actor: string): Promise<Outcome<string>> {
  const row = await findRow(id);
  if (!row) return { ok: false, code: 'NOT_FOUND', message: '문의를 찾을 수 없습니다.' };
  if (row.report_sent_at)
    return { ok: false, code: 'CONFLICT', message: '이미 발송된 건입니다.' };

  const sentAt = new Date().toISOString();
  const nextStatus =
    row.status === 'new' || row.status === 'reviewing' ? 'reportSent' : row.status;

  const { error } = await db()
    .from('inquiries')
    .update({ report_sent_at: sentAt, status: nextStatus })
    .eq('id', id);

  if (error)
    return { ok: false, code: 'INTERNAL', message: `발송하지 못했습니다: ${error.message}` };

  await recordAudit(actor, 'sendReport', id, '결과지 발송 (고정 서식)');
  return { ok: true, value: sentAt };
}

/* ------------------------------------------------------------------ *
 * 열람 기록 (PRD §10)
 * ------------------------------------------------------------------ */

export async function recordAudit(
  actor: string,
  action: AuditAction,
  inquiryId: string | null,
  detail?: string,
): Promise<void> {
  // 기록 실패가 본 작업을 막으면 안 된다. 조용히 넘기되 서버 로그에는 남긴다.
  const { error } = await db()
    .from('audit_log')
    .insert({ actor, action, inquiry_id: inquiryId, detail: detail ?? null });
  if (error) console.error('[audit] 기록 실패', error.message);
}

export async function listAudit(inquiryId?: string, page = 1, size = 20) {
  let query = db()
    .from('audit_log')
    .select('at, actor, action, inquiry_id, detail', { count: 'exact' })
    .order('at', { ascending: false });

  if (inquiryId) query = query.eq('inquiry_id', inquiryId);

  const from = (page - 1) * size;
  const { data, error, count } = await query.range(from, from + size - 1);
  if (error) throw new Error(`열람 기록을 불러오지 못했습니다: ${error.message}`);

  const items: AuditEntry[] = (
    (data ?? []) as { at: string; actor: string; action: AuditAction; inquiry_id: string | null; detail: string | null }[]
  ).map((row) => ({
    at: row.at,
    actor: row.actor,
    action: row.action,
    inquiryId: row.inquiry_id,
    ...(row.detail ? { detail: row.detail } : {}),
  }));

  return { items, page, size, total: count ?? items.length };
}
