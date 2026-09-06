/**
 * API 계약 타입 — docs/api-spec.md v1
 *
 * 화면 코드는 src/lib/mock을 절대 import하지 않고 여기만 씁니다.
 * 실제 백엔드로 바꿀 때 이 파일이 그대로 남아 있어야 화면이 안 깨집니다.
 */

export type Segment = 'individual' | 'corporate';
export type RiskTier = 'stable' | 'stableSeeking' | 'neutral' | 'active' | 'aggressive';
export type InquiryStatus = 'new' | 'reviewing' | 'reportSent' | 'consulting' | 'closed';
export type CloseReason =
  | 'contracted'
  | 'belowMinimum'
  | 'unreachable'
  | 'customerHold'
  | 'other';
export type QuestionKind = 'single' | 'multi' | 'amount' | 'text';
export type AuditAction = 'login' | 'viewList' | 'viewDetail' | 'sendReport' | 'changeStatus';

export type AnswerValue = string | string[] | null;
export type AnswerMap = Record<string, AnswerValue>;

/* ---------------- 문항 ---------------- */

export interface Choice {
  value: string;
  label: string;
  isUnsure?: boolean;
  tierIndex?: number;
  /** 선택 즉시 화면에 뜨는 안내 (최소금액 미달 등) */
  notice?: string;
}

export type Condition =
  | { questionId: string; op: 'eq'; value: string }
  | { questionId: string; op: 'in'; value: string[] }
  | { questionId: string; op: 'amountTierAtLeast'; value: number };

export interface BranchRule {
  all?: Condition[];
  any?: Condition[];
}

export interface Question {
  id: string;
  segment: Segment;
  order: number;
  kind: QuestionKind;
  prompt: string;
  help?: string;
  optional?: boolean;
  maxLength?: number;
  choices?: Choice[];
  /** 없으면 항상 표시 */
  showWhen?: BranchRule;
}

/* ---------------- 진단 ---------------- */

export interface Diagnosis {
  tier: RiskTier;
  tierLabel: string;
  tierSummary: string;
  /** false면 결과 화면을 띄우지 않는다 */
  complete: boolean;
  unsureCount: number;
  amountTierIndex: number;
  amountLabel: string;
  belowMinimum: boolean;
}

export interface ScoreLine {
  questionId: string;
  label: string;
  points: number;
  maxScore: number;
  usedDefault: boolean;
}

/** 담당자 응답에만 들어가는 판정 (점수와 근거 포함) */
export interface StaffDiagnosis {
  tier: RiskTier;
  score: number | null;
  breakdown: ScoreLine[];
  complete: boolean;
  unsureCount: number;
  amountTierIndex: number;
  belowMinimum: boolean;
}

/** 숫자 필드가 없다. 추가하지 않는다 (PRD §3 원칙 3) */
export interface Strategy {
  tier: RiskTier;
  name: string;
  description: string;
  volatilityNote: string;
  suitableFor: string;
}

/* ---------------- 설정 ---------------- */

export interface AmountTier {
  value: string;
  label: string;
  tierIndex: number;
  belowMinimum: boolean;
}

export interface AppConfig {
  minimumAmountKrw: number;
  belowMinimumNotice: string;
  amountTiers: Record<Segment, AmountTier[]>;
  labels: {
    tier: Record<RiskTier, string>;
    status: Record<InquiryStatus, string>;
    closeReason: Record<CloseReason, string>;
  };
  disclaimer: string;
  reportSlaHours: number;
  verification: { codeLength: number; ttlSeconds: number; maxAttempts: number };
}

/* ---------------- 문의 ---------------- */

export interface Contact {
  name: string;
  email: string;
  phone: string;
  companyName?: string | null;
  title?: string | null;
}

export interface Consents {
  privacy: boolean;
  privacyAt: string | null;
  marketing: boolean;
  marketingAt: string | null;
}

export interface Memo {
  at: string;
  author: string;
  body: string;
}

export interface AnswerDisplay {
  questionId: string;
  prompt: string;
  answerLabel: string;
  isUnsure: boolean;
}

export interface InquiryListRow {
  id: string;
  submittedAt: string;
  segment: Segment;
  name: string;
  companyName?: string | null;
  tier: RiskTier;
  amountLabel: string;
  belowMinimum: boolean;
  unsureCount: number;
  status: InquiryStatus;
  assignee: string | null;
  freeTextPreview: string | null;
  /** 발송 기한 초과. 서버가 이미 맨 위로 정렬해서 보낸다 */
  reportOverdue: boolean;
}

export interface InquiryDetail {
  id: string;
  segment: Segment;
  submittedAt: string;
  emailVerifiedAt: string;
  contact: Contact;
  consents: Consents;
  answers: AnswerMap;
  answersDisplay: AnswerDisplay[];
  diagnosis: StaffDiagnosis;
  amountLabel: string;
  tierLabel: string;
  tierSummary: string;
  status: InquiryStatus;
  assignee: string | null;
  reportSentAt: string | null;
  closeReason: CloseReason | null;
  closeNote: string | null;
  memos: Memo[];
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: AuditAction;
  inquiryId: string | null;
  detail?: string;
}

export interface ReportSection {
  page: number;
  title: string;
  lines: string[];
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: 'manager' | 'admin';
}

/* ---------------- 응답 묶음 ---------------- */

export interface Paged<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

export interface InquiryListResponse extends Paged<InquiryListRow> {
  counts: Record<InquiryStatus, number>;
}

export interface DiagnosisPreview {
  diagnosis: Diagnosis;
  strategy: Strategy;
  disclaimer: string;
  visibleQuestionIds: string[];
}

export interface SubmitResult {
  inquiryId: string;
  diagnosis: Diagnosis;
  strategy: Strategy;
  disclaimer: string;
  reportNotice: string;
}
