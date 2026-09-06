/**
 * 투자문의 진단 위저드 — 데이터 형태 정의
 *
 * PRD 참조: §5 개인 문항 / §6 법인 문항 / §7 유형 판정 / §10 담당자 화면 / §11 개인정보
 */

/** 고객 구분 (PRD §4-2) */
export type Segment = 'individual' | 'corporate';

/**
 * 위험도 5단계 (PRD §7)
 * 금융투자협회 표준투자권유준칙의 5구분 이름을 그대로 따른다.
 */
export type RiskTier =
  | 'stable' // 안정형
  | 'stableSeeking' // 안정추구형
  | 'neutral' // 위험중립형
  | 'active' // 적극투자형
  | 'aggressive'; // 공격투자형

/** 문의 상태 5단계 (PRD §10) */
export type InquiryStatus =
  | 'new' // 신규
  | 'reviewing' // 검토중
  | 'reportSent' // 결과지 발송
  | 'consulting' // 상담 진행
  | 'closed'; // 종료

/** 종료 사유 — 종료 시 필수 (PRD §10) */
export type CloseReason =
  | 'contracted' // 계약
  | 'belowMinimum' // 금액 미달
  | 'unreachable' // 연락 불가
  | 'customerHold' // 고객 보류
  | 'other'; // 기타

/** 문항 유형 */
export type QuestionKind =
  | 'single' // 단일 선택
  | 'multi' // 복수 선택
  | 'amount' // 금액 구간 (single이지만 tierIndex를 가진다)
  | 'text'; // 자유 입력

export interface Choice {
  value: string;
  label: string;
  /** 유형 판정 점수 (PRD §7). 생략 시 0점. 음수는 감점. */
  score?: number;
  /**
   * "잘 모르겠습니다" 계열 선택지 (PRD §3 원칙 1).
   * 회피 선택지가 아니라 정보다 — 담당자 화면에 모름 응답 수로 집계된다.
   */
  isUnsure?: boolean;
  /** 금액 구간 순서. kind가 'amount'인 문항에서만 쓴다. */
  tierIndex?: number;
  /** 선택 시 화면에 바로 뜨는 안내 문구 (PRD §5-Q3 금액 미달 안내) */
  notice?: string;
}

/** 조건부 문항의 표시 조건 (PRD §5 Q6~Q8) */
export type Condition =
  | { questionId: string; op: 'eq'; value: string }
  | { questionId: string; op: 'in'; value: string[] }
  | { questionId: string; op: 'amountTierAtLeast'; value: number };

export interface BranchRule {
  /** 전부 만족해야 표시 */
  all?: Condition[];
  /** 하나만 만족해도 표시 */
  any?: Condition[];
}

export interface Question {
  id: string;
  segment: Segment;
  order: number;
  kind: QuestionKind;
  /** 화면에 그대로 나가는 문장. 업계 용어를 쓰지 않는다 (PRD §3 원칙 2). */
  prompt: string;
  /** 보조 설명 (있으면 문항 아래 작은 글씨) */
  help?: string;
  optional?: boolean;
  maxLength?: number;
  choices?: Choice[];
  /** 없으면 항상 표시 */
  showWhen?: BranchRule;
  /** 이 문항이 판정에서 가질 수 있는 최대 점수 (PRD §7 배점표) */
  maxScore?: number;
  /** 문항이 숨겨졌을 때 판정에 쓰는 중립값 (PRD §7: Q8 미표시 시 8점) */
  hiddenDefaultScore?: number;
}

export type AnswerValue = string | string[] | null;

/** 문항 id → 답변. 미응답/미표시 문항은 키가 없거나 null. */
export type AnswerMap = Record<string, AnswerValue>;

/** 판정 점수 내역 — 담당자 화면 상세에 그대로 노출한다 (PRD §10) */
export interface ScoreLine {
  questionId: string;
  label: string;
  points: number;
  maxScore: number;
  /** 문항이 표시되지 않아 중립값이 쓰였는지 */
  usedDefault: boolean;
}

export interface Diagnosis {
  tier: RiskTier;
  /** 개인만 점수제를 쓴다. 법인은 표로 직접 배정하므로 null (PRD §7 마지막 문단) */
  score: number | null;
  breakdown: ScoreLine[];
  /** "잘 모르겠습니다" 계열 응답 수 (PRD §3 원칙 1, §10 목록 컬럼) */
  unsureCount: number;
  amountTierIndex: number;
  /** 최소 가입금액 미달 여부 (PRD §5-Q3) */
  belowMinimum: boolean;
  /**
   * 보여야 하는 필수 문항이 모두 채워졌는지.
   * false면 결과 화면을 띄우지 않는다 — 반쯤 채운 답으로 나온 유형은
   * 그럴듯해 보이지만 틀린 값이다.
   */
  complete: boolean;
}

export interface Contact {
  name: string;
  email: string;
  phone: string;
  /** 법인만 (PRD §6 마지막 문단). 사업자등록번호는 받지 않는다. */
  companyName?: string;
  title?: string;
}

export interface Memo {
  at: string;
  author: string;
  body: string;
}

/**
 * 동의 (PRD §11)
 * 필수와 선택을 분리해서 저장하고, 각각 동의 시각을 남긴다.
 * 한 체크박스로 묶는 것은 흔한 실수이자 흔한 지적 사항이다.
 */
export interface Consents {
  privacy: boolean;
  privacyAt: string | null;
  marketing: boolean;
  marketingAt: string | null;
}

export interface Inquiry {
  /** 접수 번호. 결과지 표지와 알림 메일에 쓰인다 (PRD §9, §10) */
  id: string;
  segment: Segment;
  submittedAt: string;
  emailVerifiedAt: string;
  consents: Consents;
  contact: Contact;
  answers: AnswerMap;
  diagnosis: Diagnosis;
  status: InquiryStatus;
  assignee: string | null;
  reportSentAt: string | null;
  closeReason: CloseReason | null;
  closeNote: string | null;
  memos: Memo[];
}

/** 목록 한 줄 (PRD §10 목록) */
export interface InquiryListRow {
  id: string;
  submittedAt: string;
  segment: Segment;
  name: string;
  companyName?: string;
  tier: RiskTier;
  amountLabel: string;
  belowMinimum: boolean;
  unsureCount: number;
  status: InquiryStatus;
  assignee: string | null;
  /** 자유 입력란 첫 줄. 목록에서 회색으로 함께 보여준다. */
  freeTextPreview: string | null;
  /** 결과지 발송 기한 초과 — 목록 맨 위로 올린다 (PRD §9) */
  reportOverdue: boolean;
}

/** 전략군 카드 (PRD §8). 숫자는 들어가지 않는다. */
export interface Strategy {
  tier: RiskTier;
  /** 회사가 쓰는 정식 분류 이름은 §15-2에서 확정. 지금은 임시값. */
  name: string;
  nameIsPlaceholder: true;
  /** 어떤 성격의 투자인지 두 문장 */
  description: string;
  /** 원금이 줄어들 수 있는 정도 — 정성 표현만 (PRD §3 원칙 3) */
  volatilityNote: string;
  /** 어떤 분에게 맞는지 한 줄 */
  suitableFor: string;
}

/**
 * 담당자 화면에 그대로 뿌릴 수 있게 문항 문장과 선택지 라벨을 붙인 형태.
 * 화면이 문항 정의를 따로 받아서 조립하지 않도록 서버가 만들어 준다.
 */
export interface AnswerDisplay {
  questionId: string;
  prompt: string;
  answerLabel: string;
  isUnsure: boolean;
}

/** 결과지 미리보기 (PRD §9). 서식은 고정이며 담당자가 고칠 수 없다. */
export interface ReportSection {
  page: number;
  title: string;
  lines: string[];
}

/** 열람 기록 (PRD §10 접근 통제) */
export type AuditAction =
  | 'login'
  | 'viewList'
  | 'viewDetail'
  | 'sendReport'
  | 'changeStatus';

export interface AuditEntry {
  at: string;
  actor: string;
  action: AuditAction;
  inquiryId: string | null;
  detail?: string;
}
