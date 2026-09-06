/**
 * 목업 저장소 — docs/api-spec.md v1 규격을 그대로 구현한다.
 *
 * 서버 메모리에만 있다. 개발 서버를 다시 켜면 초기 상태로 돌아간다.
 * 실제 백엔드가 붙으면 이 파일과 src/app/api/v1 을 통째로 지우고
 * NEXT_PUBLIC_API_BASE_URL만 바꾸면 된다.
 */

import {
  BELOW_MINIMUM_NOTICE,
  CLOSE_REASON_LABELS,
  CORPORATE_AMOUNT_TIERS,
  DIAGNOSIS_DISCLAIMER,
  FREETEXT_QUESTION_IDS,
  INDIVIDUAL_AMOUNT_TIERS,
  QUESTIONS_BY_SEGMENT,
  REPORT_SLA_HOURS,
  STAFF,
  STATUS_LABELS,
  STRATEGY_BY_TIER,
  TIER_LABELS,
  TIER_SUMMARIES,
} from './catalog';
import { RAW_AUDIT, RAW_INQUIRIES } from './fixtures';
import { amountLabel, diagnose } from './scoring';
import type {
  AnswerDisplay,
  AnswerMap,
  AuditAction,
  AuditEntry,
  CloseReason,
  Contact,
  Inquiry,
  InquiryListRow,
  InquiryStatus,
  Memo,
  ReportSection,
  Segment,
} from './types';

/* ------------------------------------------------------------------ *
 * 초기화
 * ------------------------------------------------------------------ */

function build(): Inquiry[] {
  return RAW_INQUIRIES.map((raw) => {
    const submittedAt = new Date(Date.now() - raw.submittedHoursAgo * 3_600_000);
    const submittedIso = submittedAt.toISOString();
    return {
      id: raw.id,
      segment: raw.segment,
      submittedAt: submittedIso,
      // 인증 직후 접수되므로 사실상 같은 시각이다 (§4-5, §4-6)
      emailVerifiedAt: new Date(submittedAt.getTime() - 40_000).toISOString(),
      consents: {
        privacy: true,
        privacyAt: submittedIso,
        marketing: raw.marketingConsent,
        marketingAt: raw.marketingConsent ? submittedIso : null,
      },
      contact: raw.contact,
      answers: raw.answers,
      diagnosis: diagnose(raw.segment, raw.answers),
      status: raw.status,
      assignee: raw.assignee,
      reportSentAt:
        raw.reportSentHoursAgo === null
          ? null
          : new Date(Date.now() - raw.reportSentHoursAgo * 3_600_000).toISOString(),
      closeReason: raw.closeReason,
      closeNote: raw.closeNote,
      memos: raw.memos,
    };
  });
}

const inquiries: Inquiry[] = build();
const auditLog: AuditEntry[] = [...RAW_AUDIT];

/* ------------------------------------------------------------------ *
 * 설정 — GET /api/v1/config
 * ------------------------------------------------------------------ */

export function configPayload() {
  return {
    minimumAmountKrw: 100_000_000,
    belowMinimumNotice: BELOW_MINIMUM_NOTICE,
    amountTiers: {
      individual: INDIVIDUAL_AMOUNT_TIERS,
      corporate: CORPORATE_AMOUNT_TIERS,
    },
    labels: {
      tier: TIER_LABELS,
      status: STATUS_LABELS,
      closeReason: CLOSE_REASON_LABELS,
    },
    disclaimer: DIAGNOSIS_DISCLAIMER,
    reportSlaHours: REPORT_SLA_HOURS,
    verification: { codeLength: 6, ttlSeconds: 600, maxAttempts: 5 },
  };
}

/**
 * 고객에게 내려보내는 문항. 배점(score)을 지우고 보낸다 — §3.1
 * 브라우저에서 "어떻게 답해야 공격투자형이 나오는지" 보이면 진단이 무의미해진다.
 */
export function publicQuestions(segment: Segment) {
  return QUESTIONS_BY_SEGMENT[segment].map((q) => ({
    ...q,
    choices: q.choices?.map((choice) => ({
      value: choice.value,
      label: choice.label,
      ...(choice.isUnsure ? { isUnsure: true } : {}),
      ...(choice.tierIndex !== undefined ? { tierIndex: choice.tierIndex } : {}),
      ...(choice.notice ? { notice: choice.notice } : {}),
    })),
  }));
}

/* ------------------------------------------------------------------ *
 * 목록 — GET /api/v1/staff/inquiries
 * ------------------------------------------------------------------ */

function freeTextPreviewOf(inquiry: Inquiry): string | null {
  for (const id of FREETEXT_QUESTION_IDS) {
    const value = inquiry.answers[id];
    if (typeof value === 'string' && value.trim()) return value.trim().split('\n')[0];
  }
  return null;
}

/** 결과지 발송 기한 초과 — 목록 맨 위로 올린다 (§9) */
function isReportOverdue(inquiry: Inquiry): boolean {
  if (inquiry.status !== 'new' && inquiry.status !== 'reviewing') return false;
  return (Date.now() - new Date(inquiry.submittedAt).getTime()) / 3_600_000 > REPORT_SLA_HOURS;
}

function toListRow(inquiry: Inquiry): InquiryListRow {
  return {
    id: inquiry.id,
    submittedAt: inquiry.submittedAt,
    segment: inquiry.segment,
    name: inquiry.contact.name,
    companyName: inquiry.contact.companyName,
    tier: inquiry.diagnosis.tier,
    amountLabel: amountLabel(inquiry.segment, inquiry.answers),
    belowMinimum: inquiry.diagnosis.belowMinimum,
    unsureCount: inquiry.diagnosis.unsureCount,
    status: inquiry.status,
    assignee: inquiry.assignee,
    freeTextPreview: freeTextPreviewOf(inquiry),
    reportOverdue: isReportOverdue(inquiry),
  };
}

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

export function listInquiries(filter: ListFilter = {}) {
  const needle = filter.q?.trim().toLowerCase();
  const page = Math.max(1, filter.page ?? 1);
  const size = Math.min(100, Math.max(1, filter.size ?? 20));

  const matched = inquiries
    .filter((i) => {
      if (filter.status && i.status !== filter.status) return false;
      if (filter.segment && i.segment !== filter.segment) return false;
      if (filter.assignee && i.assignee !== filter.assignee) return false;
      if (filter.belowMinimum !== undefined && i.diagnosis.belowMinimum !== filter.belowMinimum)
        return false;
      if (filter.minUnsure !== undefined && i.diagnosis.unsureCount < filter.minUnsure) return false;
      if (needle) {
        const hay = [i.id, i.contact.name, i.contact.companyName ?? ''].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    })
    .map(toListRow)
    // 정렬은 서버가 정한다 (§5.3). 기한 초과가 맨 위, 그 다음 최근 접수 순.
    .sort((a, b) => {
      if (a.reportOverdue !== b.reportOverdue) return a.reportOverdue ? -1 : 1;
      return b.submittedAt.localeCompare(a.submittedAt);
    });

  return {
    items: matched.slice((page - 1) * size, page * size),
    page,
    size,
    total: matched.length,
    counts: statusCounts(),
  };
}

export function statusCounts(): Record<InquiryStatus, number> {
  const base: Record<InquiryStatus, number> = {
    new: 0,
    reviewing: 0,
    reportSent: 0,
    consulting: 0,
    closed: 0,
  };
  for (const i of inquiries) base[i.status] += 1;
  return base;
}

export function getInquiry(id: string): Inquiry | undefined {
  return inquiries.find((i) => i.id === id);
}

/* ------------------------------------------------------------------ *
 * 상세 — 답변을 사람이 읽는 문장으로 (§5.4 answersDisplay)
 * ------------------------------------------------------------------ */

export function answersDisplay(inquiry: Inquiry): AnswerDisplay[] {
  return QUESTIONS_BY_SEGMENT[inquiry.segment].flatMap((q) => {
    const value = inquiry.answers[q.id];
    if (value === undefined || value === null || value === '') return [];

    if (Array.isArray(value)) {
      if (value.length === 0) return [];
      const picked = value.map((v) => q.choices?.find((c) => c.value === v));
      return [
        {
          questionId: q.id,
          prompt: q.prompt,
          answerLabel: picked.map((c) => c?.label ?? '—').join(', '),
          isUnsure: picked.some((c) => c?.isUnsure === true),
        },
      ];
    }

    const choice = q.choices?.find((c) => c.value === value);
    return [
      {
        questionId: q.id,
        prompt: q.prompt,
        answerLabel: choice?.label ?? String(value),
        isUnsure: choice?.isUnsure === true,
      },
    ];
  });
}

/* ------------------------------------------------------------------ *
 * 결과지 미리보기 — GET .../report/preview (§9)
 * 서식은 고정이다. 담당자가 문장을 고치는 경로는 만들지 않는다.
 * ------------------------------------------------------------------ */

export function reportPreview(inquiry: Inquiry): ReportSection[] {
  const strategy = STRATEGY_BY_TIER[inquiry.diagnosis.tier];
  const who = inquiry.contact.companyName
    ? `${inquiry.contact.companyName} ${inquiry.contact.name} ${inquiry.contact.title ?? ''}`.trim()
    : inquiry.contact.name;

  return [
    {
      page: 1,
      title: '표지',
      lines: [
        '○○투자자문 주식회사',
        `접수 번호 ${inquiry.id}`,
        `작성일 ${new Date().toLocaleDateString('ko-KR')}`,
        '참고용 안내 자료',
      ],
    },
    {
      page: 2,
      title: '고객님이 답해주신 내용',
      lines: answersDisplay(inquiry).map((a) => `${a.prompt} — ${a.answerLabel}`),
    },
    {
      page: 3,
      title: '진단 결과',
      lines: [
        `${who} 님은 ${TIER_LABELS[inquiry.diagnosis.tier]}입니다.`,
        TIER_SUMMARIES[inquiry.diagnosis.tier],
        DIAGNOSIS_DISCLAIMER,
      ],
    },
    {
      page: 4,
      title: '대응되는 전략군',
      lines: [strategy.name, strategy.description, strategy.volatilityNote, strategy.suitableFor],
    },
    {
      page: 5,
      title: '다음 절차',
      lines: [
        `담당자 ${inquiry.assignee ?? '(배정 예정)'}가 연락드립니다.`,
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
 * 변경
 * ------------------------------------------------------------------ */

export function recordAudit(
  actor: string,
  action: AuditAction,
  inquiryId: string | null,
  detail?: string,
): void {
  auditLog.unshift({ at: new Date().toISOString(), actor, action, inquiryId, detail });
}

export function listAudit(inquiryId?: string, page = 1, size = 20) {
  const matched = inquiryId ? auditLog.filter((e) => e.inquiryId === inquiryId) : auditLog;
  return {
    items: matched.slice((page - 1) * size, page * size),
    page,
    size,
    total: matched.length,
  };
}

export interface UpdatePatch {
  status?: InquiryStatus;
  assignee?: string | null;
  closeReason?: CloseReason | null;
  closeNote?: string | null;
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

export function updateInquiry(
  id: string,
  patch: UpdatePatch,
  actor: string,
): Outcome<Inquiry> {
  const inquiry = getInquiry(id);
  if (!inquiry) return { ok: false, code: 'NOT_FOUND', message: '문의를 찾을 수 없습니다.' };

  // 종료 사유는 필수 (§10)
  if (patch.status === 'closed' && !(patch.closeReason ?? inquiry.closeReason)) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      message: '종료로 바꿀 때는 사유를 함께 남겨야 합니다.',
    };
  }

  if (patch.status && patch.status !== inquiry.status) {
    recordAudit(
      actor,
      'changeStatus',
      id,
      `${STATUS_LABELS[inquiry.status]} → ${STATUS_LABELS[patch.status]}`,
    );
    inquiry.status = patch.status;
  }
  if (patch.assignee !== undefined) inquiry.assignee = patch.assignee;
  if (patch.closeReason !== undefined) inquiry.closeReason = patch.closeReason;
  if (patch.closeNote !== undefined) inquiry.closeNote = patch.closeNote;

  return { ok: true, value: inquiry };
}

export function addMemo(id: string, author: string, body: string): Outcome<Memo> {
  const inquiry = getInquiry(id);
  if (!inquiry) return { ok: false, code: 'NOT_FOUND', message: '문의를 찾을 수 없습니다.' };
  if (!body.trim())
    return { ok: false, code: 'VALIDATION_FAILED', message: '메모 내용을 입력해 주세요.' };

  const memo: Memo = { at: new Date().toISOString(), author, body: body.trim() };
  inquiry.memos = [...inquiry.memos, memo];
  return { ok: true, value: memo };
}

/** 결과지 발송 (§9). 보낸다 / 보류한다 / 메모를 남긴다 — 담당자가 할 수 있는 건 이 셋뿐. */
export function sendReport(id: string, actor: string): Outcome<Inquiry> {
  const inquiry = getInquiry(id);
  if (!inquiry) return { ok: false, code: 'NOT_FOUND', message: '문의를 찾을 수 없습니다.' };
  if (inquiry.reportSentAt)
    return { ok: false, code: 'CONFLICT', message: '이미 발송된 건입니다.' };

  inquiry.reportSentAt = new Date().toISOString();
  if (inquiry.status === 'new' || inquiry.status === 'reviewing') inquiry.status = 'reportSent';
  recordAudit(actor, 'sendReport', id, '결과지 발송 (고정 서식)');
  return { ok: true, value: inquiry };
}

/* ------------------------------------------------------------------ *
 * 접수 — POST /api/v1/inquiries
 * ------------------------------------------------------------------ */

let sequence = 148;

export function createInquiry(input: {
  segment: Segment;
  contact: Contact;
  answers: AnswerMap;
  marketing: boolean;
}): Inquiry {
  const now = new Date().toISOString();
  const inquiry: Inquiry = {
    id: `INQ-2026-${String(sequence++).padStart(4, '0')}`,
    segment: input.segment,
    submittedAt: now,
    emailVerifiedAt: now,
    consents: {
      privacy: true,
      privacyAt: now,
      marketing: input.marketing,
      marketingAt: input.marketing ? now : null,
    },
    contact: input.contact,
    answers: input.answers,
    diagnosis: diagnose(input.segment, input.answers),
    status: 'new',
    assignee: null,
    reportSentAt: null,
    closeReason: null,
    closeNote: null,
    memos: [],
  };
  inquiries.unshift(inquiry);
  return inquiry;
}

/* ------------------------------------------------------------------ *
 * 이메일 인증 — §4.5, §4.6
 * ------------------------------------------------------------------ */

const VERIFY_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const codes = new Map<string, { code: string; expiresAt: number; attempts: number }>();
const tokens = new Map<string, { email: string; expiresAt: number }>();

const norm = (email: string) => email.trim().toLowerCase();

export function requestVerification(email: string) {
  // 목업은 고정 코드를 쓴다. 실제 백엔드는 난수로 만들고 응답에 넣지 않는다.
  const code = '482913';
  codes.set(norm(email), { code, expiresAt: Date.now() + VERIFY_TTL_MS, attempts: 0 });
  return { expiresInSeconds: VERIFY_TTL_MS / 1000, maxAttempts: MAX_ATTEMPTS, mockCode: code };
}

export type ConfirmResult =
  | { ok: true; token: string; expiresInSeconds: number }
  | { ok: false; code: 'VERIFICATION_FAILED' | 'VERIFICATION_LOCKED'; message: string; attemptsLeft: number };

export function confirmVerification(email: string, input: string): ConfirmResult {
  const key = norm(email);
  const record = codes.get(key);

  if (!record || Date.now() > record.expiresAt) {
    codes.delete(key);
    return {
      ok: false,
      code: 'VERIFICATION_LOCKED',
      message: '인증 시간이 지났습니다. 번호를 다시 받아주세요.',
      attemptsLeft: 0,
    };
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return {
      ok: false,
      code: 'VERIFICATION_LOCKED',
      message: '입력 횟수를 넘었습니다. 번호를 다시 받아주세요.',
      attemptsLeft: 0,
    };
  }
  if (record.code !== input.trim()) {
    record.attempts += 1;
    const left = MAX_ATTEMPTS - record.attempts;
    return left > 0
      ? {
          ok: false,
          code: 'VERIFICATION_FAILED',
          message: `숫자가 맞지 않습니다. ${left}번 더 입력할 수 있습니다.`,
          attemptsLeft: left,
        }
      : {
          ok: false,
          code: 'VERIFICATION_LOCKED',
          message: '입력 횟수를 넘었습니다. 번호를 다시 받아주세요.',
          attemptsLeft: 0,
        };
  }

  codes.delete(key);
  const token = `vt_${Math.random().toString(36).slice(2, 12)}`;
  tokens.set(token, { email: key, expiresAt: Date.now() + TOKEN_TTL_MS });
  return { ok: true, token, expiresInSeconds: TOKEN_TTL_MS / 1000 };
}

/** 접수 시 토큰을 확인하고 소진한다. 한 토큰으로 두 번 접수할 수 없다. */
export function consumeVerificationToken(token: string | null, email: string): boolean {
  if (!token) return false;
  const record = tokens.get(token);
  if (!record || Date.now() > record.expiresAt) {
    tokens.delete(token);
    return false;
  }
  if (record.email !== norm(email)) return false;
  tokens.delete(token);
  return true;
}

/* ------------------------------------------------------------------ *
 * 담당자 로그인 — §5.1 (목업)
 * ------------------------------------------------------------------ */

/** 목업 공통 비밀번호. 실제 구현에서는 해시 비교로 바꾼다. */
export const MOCK_PASSWORD = 'advisory';

export function login(email: string, password: string) {
  const staff = STAFF.find((s) => s.email === norm(email));
  if (!staff || password !== MOCK_PASSWORD) return null;
  recordAudit(staff.name, 'login', null);
  return { token: `st_${staff.id}`, staff };
}

export function staffFromToken(token: string | null) {
  if (!token) return null;
  return STAFF.find((s) => `st_${s.id}` === token) ?? null;
}

/* ------------------------------------------------------------------ *
 * 개발용
 * ------------------------------------------------------------------ */

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 목업 답변이 의도한 유형을 실제로 만들어내는지 대조 (배점 수정 시 회귀 확인) */
export function verifyFixtures() {
  return RAW_INQUIRIES.flatMap((raw) => {
    const actual = diagnose(raw.segment, raw.answers).tier;
    return actual === raw.expectedTier
      ? []
      : [{ id: raw.id, expected: raw.expectedTier, actual }];
  });
}

export { STATUS_LABELS, CLOSE_REASON_LABELS, TIER_LABELS, TIER_SUMMARIES, STAFF };
