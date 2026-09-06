/**
 * API 클라이언트 — docs/api-spec.md v1
 *
 * 화면은 fetch를 직접 부르지 않고 전부 여기를 지납니다.
 * 실제 백엔드로 바꿀 때 .env.local의 NEXT_PUBLIC_API_BASE_URL만 고치면 됩니다.
 */

import type {
  AnswerMap,
  AppConfig,
  AuditEntry,
  CloseReason,
  Contact,
  DiagnosisPreview,
  InquiryDetail,
  InquiryListResponse,
  InquiryStatus,
  Memo,
  Paged,
  Question,
  ReportSection,
  Segment,
  Staff,
  Strategy,
  SubmitResult,
} from './types';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1';

/** 서버가 보낸 문장을 그대로 화면에 띄우기 위한 오류 형태 (§1.2) */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly fields?: Record<string, string>,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* ------------------------------------------------------------------ *
 * 담당자 토큰 — 브라우저에만 둔다
 * ------------------------------------------------------------------ */

const TOKEN_KEY = 'advisory.staffToken';
const STAFF_KEY = 'advisory.staff';

export const staffSession = {
  get token(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  get staff(): Staff | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(STAFF_KEY);
      return raw ? (JSON.parse(raw) as Staff) : null;
    } catch {
      return null;
    }
  },
  save(token: string, staff: Staff) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
      window.localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
    } catch {
      /* 시크릿 모드 등에서 저장이 막혀도 화면은 계속 동작해야 한다 */
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(STAFF_KEY);
    } catch {
      /* ignore */
    }
  },
};

/* ------------------------------------------------------------------ *
 * 공통 호출
 * ------------------------------------------------------------------ */

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** 담당자 토큰을 붙인다 */
  auth?: boolean;
  /** 접수 시 이메일 인증 토큰 */
  verificationToken?: string;
  query?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const { method = 'GET', body, auth, verificationToken, query } = options;

  const url = new URL(`${BASE}${path}`, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (verificationToken) headers['x-verification-token'] = verificationToken;
  if (auth) {
    const token = staffSession.token;
    if (token) headers.authorization = `Bearer ${token}`;
    // 목업 편의: 로그인 없이 담당자 화면을 열어볼 수 있게 한다.
    // 실제 백엔드는 이 헤더를 무시한다.
    // HTTP 헤더 값은 ASCII만 담을 수 있으므로 이름이 아니라 id를 보낸다.
    else headers['x-mock-actor'] = 'staff_kim';
  }

  let response: Response;
  try {
    response = await fetch(url.pathname + url.search, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('NETWORK', '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.', 0);
  }

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string; fields?: Record<string, string> }; data?: unknown }
    | null;

  if (!payload) {
    throw new ApiError('INTERNAL', '서버 응답을 읽지 못했습니다.', response.status);
  }
  if (!payload.ok) {
    throw new ApiError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.error.fields,
      payload.data,
    );
  }
  return payload.data;
}

/* ------------------------------------------------------------------ *
 * 고객
 * ------------------------------------------------------------------ */

export const api = {
  getConfig: () => request<AppConfig>('/config'),

  getQuestions: (segment: Segment) =>
    request<{ segment: Segment; questions: Question[] }>('/questions', { query: { segment } }),

  getStrategies: () =>
    request<{ strategies: Strategy[]; disclaimer: string }>('/strategies'),

  previewDiagnosis: (segment: Segment, answers: AnswerMap) =>
    request<DiagnosisPreview>('/diagnosis/preview', {
      method: 'POST',
      body: { segment, answers },
    }),

  requestEmailVerification: (email: string) =>
    request<{ expiresInSeconds: number; maxAttempts: number; mockCode?: string }>(
      '/email-verifications',
      { method: 'POST', body: { email } },
    ),

  confirmEmailVerification: (email: string, code: string) =>
    request<{ verificationToken: string; expiresInSeconds: number }>(
      '/email-verifications/confirm',
      { method: 'POST', body: { email, code } },
    ),

  submitInquiry: (input: {
    segment: Segment;
    contact: Contact;
    answers: AnswerMap;
    consents: { privacy: boolean; marketing: boolean };
    verificationToken: string;
  }) =>
    request<SubmitResult>('/inquiries', {
      method: 'POST',
      verificationToken: input.verificationToken,
      body: {
        segment: input.segment,
        contact: input.contact,
        answers: input.answers,
        consents: input.consents,
      },
    }),

  /* ---------------- 담당자 ---------------- */

  staffLogin: (email: string, password: string) =>
    request<{ token: string; staff: Staff }>('/staff/session', {
      method: 'POST',
      body: { email, password },
    }),

  staffLogout: () => request<void>('/staff/session', { method: 'DELETE', auth: true }),

  listInquiries: (filter: {
    status?: InquiryStatus;
    segment?: Segment;
    assignee?: string;
    q?: string;
    minUnsure?: number;
    belowMinimum?: boolean;
    page?: number;
    size?: number;
  } = {}) => request<InquiryListResponse>('/staff/inquiries', { auth: true, query: filter }),

  getInquiry: (id: string) =>
    request<{ inquiry: InquiryDetail; strategy: Strategy; audit: AuditEntry[] }>(
      `/staff/inquiries/${id}`,
      { auth: true },
    ),

  patchInquiry: (
    id: string,
    patch: {
      status?: InquiryStatus;
      assignee?: string | null;
      closeReason?: CloseReason | null;
      closeNote?: string | null;
    },
  ) =>
    request<{ inquiry: InquiryDetail }>(`/staff/inquiries/${id}`, {
      method: 'PATCH',
      auth: true,
      body: patch,
    }),

  addMemo: (id: string, body: string) =>
    request<{ memo: Memo }>(`/staff/inquiries/${id}/memos`, {
      method: 'POST',
      auth: true,
      body: { body },
    }),

  getReportPreview: (id: string) =>
    request<{ sections: ReportSection[]; editable: boolean }>(
      `/staff/inquiries/${id}/report/preview`,
      { auth: true },
    ),

  sendReport: (id: string) =>
    request<{ inquiry: InquiryDetail; sentAt: string }>(`/staff/inquiries/${id}/report`, {
      method: 'POST',
      auth: true,
    }),

  listAudit: (inquiryId?: string) =>
    request<Paged<AuditEntry>>('/staff/audit', { auth: true, query: { inquiryId } }),
};
