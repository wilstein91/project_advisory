/**
 * 목업 문의 14건 + 열람 기록 — PRD §10 담당자 화면 테스트용
 *
 * 설계 의도: 화면을 만들면서 마주칠 경우를 빠짐없이 덮는다.
 *   - 유형 5단계 전부       stable 4 / stableSeeking 3 / neutral 2 / active 3 / aggressive 2
 *   - 상태 5단계 전부       new 3 / reviewing 3 / reportSent 2 / consulting 2 / closed 4
 *   - 종료 사유 4종
 *   - 금액 미달 2건         (§5-Q3 안내 문구 노출 확인)
 *   - 모름 응답 많은 건 1건 (§3 원칙 1 — 윤소미, 4건)
 *   - 발송 기한 초과 3건    (§9 — 목록 맨 위로 올라와야 함)
 *   - 조건부 문항이 실제로 채워진 건 / 숨겨진 건 둘 다
 *   - 담당자 미배정 건, 자유 입력이 빈 건
 *
 * 진단 결과는 저장하지 않는다. store.ts가 scoring.diagnose()로 계산한다 —
 * 배점을 고쳤을 때 데이터가 조용히 어긋나는 것을 막기 위해서다.
 * expectedTier는 그 계산이 의도와 맞는지 확인하는 용도로만 쓴다.
 *
 * 이름·회사명·연락처는 모두 가상이며, 이메일은 example.com으로 고정했다.
 */

import type {
  AnswerMap,
  AuditEntry,
  CloseReason,
  Contact,
  InquiryStatus,
  Memo,
  RiskTier,
  Segment,
} from './types';

/** n시간 전 시각. 목록이 항상 최근 문의처럼 보이도록 실행 시점 기준으로 만든다. */
function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3_600_000).toISOString();
}

export interface RawInquiry {
  id: string;
  segment: Segment;
  submittedHoursAgo: number;
  marketingConsent: boolean;
  contact: Contact;
  answers: AnswerMap;
  status: InquiryStatus;
  assignee: string | null;
  reportSentHoursAgo: number | null;
  closeReason: CloseReason | null;
  closeNote: string | null;
  memos: Memo[];
  /** 이 답변 조합이 만들어야 하는 유형. verifyFixtures()가 대조한다. */
  expectedTier: RiskTier;
}

export const RAW_INQUIRIES: RawInquiry[] = [
  /* ---------------- 종료 · 계약 ---------------- */
  {
    id: 'INQ-2026-0128',
    segment: 'individual',
    submittedHoursAgo: 504,
    marketingConsent: true,
    contact: { name: '이서준', email: 'seojun.lee@example.com', phone: '010-2841-7752' },
    answers: {
      ind_timing: '3_to_10y',
      ind_purpose: 'retirement',
      ind_amount: '100m_300m',
      ind_loss_reaction: 'wait',
      ind_experience: 'fund_etf',
      ind_avoid: ['none'],
      ind_freetext: '퇴직이 7년쯤 남았습니다. 그때까지 크게 흔들리지 않게 굴렸으면 합니다.',
    },
    status: 'closed',
    assignee: '김선우',
    reportSentHoursAgo: 500,
    closeReason: 'contracted',
    closeNote: '균형 배분 일임 계약 체결.',
    memos: [
      { at: hoursAgo(498), author: '김선우', body: '통화 완료. 퇴직 시점과 연금 수령 시기를 함께 보기로 했음.' },
      { at: hoursAgo(470), author: '김선우', body: '대면 상담 후 계약 진행.' },
    ],
    expectedTier: 'neutral',
  },

  /* ---------------- 종료 · 금액 미달 ---------------- */
  {
    id: 'INQ-2026-0131',
    segment: 'individual',
    submittedHoursAgo: 408,
    marketingConsent: false,
    contact: { name: '박도윤', email: 'doyoon.park@example.com', phone: '010-3317-9024' },
    answers: {
      ind_timing: 'within_3y',
      ind_purpose: 'house',
      ind_amount: '30m_100m',
      ind_loss_reaction: 'withdraw_all',
      ind_experience: 'savings_only',
      ind_withdrawal: 'anytime',
      ind_avoid: ['any_loss'],
      ind_freetext: null,
    },
    status: 'closed',
    assignee: '김선우',
    reportSentHoursAgo: 404,
    closeReason: 'belowMinimum',
    closeNote: '금액 기준 미달. 예금·적금 활용 방향만 안내드리고 종료.',
    memos: [
      { at: hoursAgo(400), author: '김선우', body: '2년 내 전세 자금. 원금 보전이 최우선이라 일임은 부적합하다고 안내.' },
    ],
    expectedTier: 'stable',
  },

  /* ---------------- 상담 진행 · 법인 ---------------- */
  {
    id: 'INQ-2026-0134',
    segment: 'corporate',
    submittedHoursAgo: 264,
    marketingConsent: true,
    contact: {
      name: '김민재',
      email: 'mj.kim@example.com',
      phone: '02-786-4410',
      companyName: '(주)한결소재',
      title: '재무팀장',
    },
    answers: {
      corp_fund_type: 'operating_surplus',
      corp_horizon: '1_to_3y',
      corp_amount: '2b_10b',
      corp_loss_tolerance: 'no_principal_loss',
      corp_decision: 'board',
      corp_reporting: 'monthly',
      corp_restrictions: 'none',
      corp_freetext: '이사회에 올릴 자료가 필요합니다. 월 보고 서식을 미리 볼 수 있을까요.',
    },
    status: 'consulting',
    assignee: '이현주',
    reportSentHoursAgo: 260,
    closeReason: null,
    closeNote: null,
    memos: [
      { at: hoursAgo(256), author: '이현주', body: '평가손실 불가 조건이라 안정형 고정. 이사회 승인 일정은 다음 달 셋째 주.' },
    ],
    expectedTier: 'stable',
  },

  /* ---------------- 상담 진행 · 공격투자형 ---------------- */
  {
    id: 'INQ-2026-0136',
    segment: 'individual',
    submittedHoursAgo: 216,
    marketingConsent: true,
    contact: { name: '최유진', email: 'yujin.choi@example.com', phone: '010-9928-1163' },
    answers: {
      ind_timing: 'over_10y',
      ind_purpose: 'surplus',
      ind_amount: '300m_1b',
      ind_loss_reaction: 'add_more',
      ind_experience: 'diverse',
      ind_holdings: ['kr_equity', 'global_equity', 'real_estate'],
      ind_avoid: ['none'],
      ind_freetext: '이미 직접 굴리고 있는 부분이 있어서, 그것과 겹치지 않는 쪽으로 부탁드립니다.',
    },
    status: 'consulting',
    assignee: '김선우',
    reportSentHoursAgo: 212,
    closeReason: null,
    closeNote: null,
    memos: [
      { at: hoursAgo(208), author: '김선우', body: '기존 보유가 국내외 주식에 몰려 있어 중복 회피가 상담 주제. 자료 준비 중.' },
    ],
    expectedTier: 'aggressive',
  },

  /* ---------------- 결과지 발송 완료 ---------------- */
  {
    id: 'INQ-2026-0138',
    segment: 'individual',
    submittedHoursAgo: 96,
    marketingConsent: false,
    contact: { name: '정하은', email: 'haeun.jung@example.com', phone: '010-4402-8318' },
    answers: {
      ind_timing: '3_to_10y',
      ind_purpose: 'retirement',
      ind_amount: '100m_300m',
      ind_loss_reaction: 'cannot_imagine',
      ind_experience: 'savings_only',
      ind_avoid: ['overseas'],
      ind_freetext: '투자를 한 번도 해본 적이 없어서 뭘 물어봐야 할지도 모르겠습니다.',
    },
    status: 'reportSent',
    assignee: '이현주',
    reportSentHoursAgo: 90,
    closeReason: null,
    closeNote: null,
    memos: [
      { at: hoursAgo(92), author: '이현주', body: '경험이 전무해 설명 시간을 넉넉히 잡아야 함. 결과지 발송했고 통화 대기.' },
    ],
    expectedTier: 'stableSeeking',
  },
  {
    id: 'INQ-2026-0139',
    segment: 'corporate',
    submittedHoursAgo: 72,
    marketingConsent: true,
    contact: {
      name: '오세훈',
      email: 'sehoon.oh@example.com',
      phone: '02-3141-2280',
      companyName: '대성문화재단',
      title: '사무국장',
    },
    answers: {
      corp_fund_type: 'endowment',
      corp_horizon: 'over_3y',
      corp_amount: '500m_2b',
      corp_loss_tolerance: 'needs_check',
      corp_decision: 'investment_committee',
      corp_reporting: 'quarterly',
      corp_restrictions: 'exists',
      corp_freetext:
        '정관에 특정 업종 투자 제한 조항이 있습니다. 담당 변호사 확인 중이며 다음 주에 회신 가능합니다.',
    },
    status: 'reportSent',
    assignee: '이현주',
    reportSentHoursAgo: 68,
    closeReason: null,
    closeNote: null,
    memos: [],
    expectedTier: 'stableSeeking',
  },

  /* ---------------- 검토중 · 발송 기한 초과 ---------------- */
  {
    id: 'INQ-2026-0140',
    segment: 'individual',
    submittedHoursAgo: 70,
    marketingConsent: true,
    contact: { name: '강태오', email: 'taeo.kang@example.com', phone: '010-7715-3390' },
    answers: {
      ind_timing: 'over_10y',
      ind_purpose: 'children',
      ind_amount: '300m_1b',
      ind_loss_reaction: 'wait',
      ind_experience: 'diverse',
      ind_holdings: ['deposit', 'kr_equity', 'bond', 'pension'],
      ind_avoid: ['sector'],
      ind_freetext: '아이가 둘인데 큰애가 대학 갈 때 일부는 써야 할 것 같습니다.',
    },
    status: 'reviewing',
    assignee: '김선우',
    reportSentHoursAgo: null,
    closeReason: null,
    closeNote: null,
    memos: [
      { at: hoursAgo(66), author: '김선우', body: '자유 입력에 부분 인출 필요가 적혀 있음. 결과지 발송 전에 통화로 확인 필요.' },
    ],
    expectedTier: 'active',
  },
  {
    id: 'INQ-2026-0141',
    segment: 'individual',
    submittedHoursAgo: 40,
    marketingConsent: false,
    contact: { name: '윤소미', email: 'somi.yoon@example.com', phone: '010-2263-5504' },
    answers: {
      ind_timing: 'undecided',
      ind_purpose: 'unsure',
      ind_amount: '100m_300m',
      ind_loss_reaction: 'cannot_imagine',
      ind_experience: 'fund_etf',
      ind_dependency: 'slightly',
      ind_withdrawal: 'maybe',
      ind_avoid: ['unsure'],
      ind_freetext: null,
    },
    status: 'reviewing',
    assignee: null,
    reportSentHoursAgo: null,
    closeReason: null,
    closeNote: null,
    memos: [],
    expectedTier: 'stableSeeking',
  },
  {
    id: 'INQ-2026-0145',
    segment: 'individual',
    submittedHoursAgo: 30,
    marketingConsent: true,
    contact: { name: '노민석', email: 'minseok.noh@example.com', phone: '010-5580-6627' },
    answers: {
      ind_timing: 'over_10y',
      ind_purpose: 'surplus',
      ind_amount: 'over_1b',
      ind_loss_reaction: 'add_more',
      ind_experience: 'diverse',
      ind_holdings: ['global_equity', 'other'],
      ind_avoid: ['none'],
      ind_freetext: '기존에 다른 곳에 일임을 맡기고 있는데 옮길지 고민 중입니다.',
    },
    status: 'reviewing',
    assignee: '김선우',
    reportSentHoursAgo: null,
    closeReason: null,
    closeNote: null,
    memos: [
      { at: hoursAgo(26), author: '김선우', body: '타사 이관 검토 건. 금액대가 커서 우선 처리.' },
    ],
    expectedTier: 'aggressive',
  },

  /* ---------------- 신규 ---------------- */
  {
    id: 'INQ-2026-0142',
    segment: 'individual',
    submittedHoursAgo: 3,
    marketingConsent: false,
    contact: { name: '임재현', email: 'jaehyun.lim@example.com', phone: '010-8834-2019' },
    answers: {
      ind_timing: '3_to_10y',
      ind_purpose: 'unsure',
      ind_amount: '100m_300m',
      ind_loss_reaction: 'withdraw_all',
      ind_experience: 'fund_etf',
      ind_dependency: 'living_expenses',
      ind_avoid: ['any_loss'],
      ind_freetext: '당장 생활비로 쓸 돈이긴 한데 그냥 두기는 아까워서요.',
    },
    status: 'new',
    assignee: null,
    reportSentHoursAgo: null,
    closeReason: null,
    closeNote: null,
    memos: [],
    expectedTier: 'stable',
  },
  {
    id: 'INQ-2026-0143',
    segment: 'corporate',
    submittedHoursAgo: 1.5,
    marketingConsent: true,
    contact: {
      name: '서지우',
      email: 'jiwoo.seo@example.com',
      phone: '031-908-7245',
      companyName: '(주)유림테크',
      title: '경영지원팀 대리',
    },
    answers: {
      corp_fund_type: 'operating_surplus',
      corp_horizon: '1_to_3y',
      corp_amount: '500m_2b',
      corp_loss_tolerance: 'temporary_ok',
      corp_decision: 'ceo',
      corp_reporting: 'quarterly',
      corp_restrictions: 'none',
      corp_freetext: null,
    },
    status: 'new',
    assignee: null,
    reportSentHoursAgo: null,
    closeReason: null,
    closeNote: null,
    memos: [],
    expectedTier: 'neutral',
  },
  {
    id: 'INQ-2026-0144',
    segment: 'individual',
    submittedHoursAgo: 6,
    marketingConsent: true,
    contact: { name: '한여울', email: 'yeoul.han@example.com', phone: '010-6672-4438' },
    answers: {
      ind_timing: 'over_10y',
      ind_purpose: 'retirement',
      ind_amount: '100m_300m',
      ind_loss_reaction: 'wait',
      ind_experience: 'direct_stock',
      ind_holdings: ['deposit', 'kr_equity'],
      ind_avoid: [],
      ind_freetext: null,
    },
    status: 'new',
    assignee: null,
    reportSentHoursAgo: null,
    closeReason: null,
    closeNote: null,
    memos: [],
    expectedTier: 'active',
  },

  /* ---------------- 종료 · 연락 불가 / 고객 보류 ---------------- */
  {
    id: 'INQ-2026-0146',
    segment: 'individual',
    submittedHoursAgo: 360,
    marketingConsent: false,
    contact: { name: '배수아', email: 'sua.bae@example.com', phone: '010-3049-8871' },
    answers: {
      ind_timing: 'within_3y',
      ind_purpose: 'house',
      ind_amount: '30m_100m',
      ind_loss_reaction: 'withdraw_all',
      ind_experience: 'savings_only',
      ind_withdrawal: 'maybe',
      ind_avoid: ['any_loss'],
      ind_freetext: null,
    },
    status: 'closed',
    assignee: '이현주',
    reportSentHoursAgo: 356,
    closeReason: 'unreachable',
    closeNote: '3회 통화 시도, 회신 없음.',
    memos: [
      { at: hoursAgo(340), author: '이현주', body: '부재중 3회. 문자 안내 후 종료 처리.' },
    ],
    expectedTier: 'stable',
  },
  {
    id: 'INQ-2026-0147',
    segment: 'corporate',
    submittedHoursAgo: 336,
    marketingConsent: false,
    contact: {
      name: '문경호',
      email: 'kh.moon@example.com',
      phone: '054-772-1130',
      companyName: '세림영농조합법인',
      title: '전무',
    },
    answers: {
      corp_fund_type: 'endowment',
      corp_horizon: 'over_3y',
      corp_amount: '2b_10b',
      corp_loss_tolerance: 'temporary_ok',
      corp_decision: 'board',
      corp_reporting: 'quarterly',
      corp_restrictions: 'none',
      corp_freetext: null,
    },
    status: 'closed',
    assignee: '이현주',
    reportSentHoursAgo: 332,
    closeReason: 'customerHold',
    closeNote: '내년 예산 확정 후 재검토하겠다는 회신. 내년 1월 재연락 예정.',
    memos: [
      { at: hoursAgo(320), author: '이현주', body: '조합 총회 일정 때문에 연내 진행 불가. 보류.' },
    ],
    expectedTier: 'active',
  },
];

/* ------------------------------------------------------------------ *
 * 열람 기록 — PRD §10 접근 통제
 *
 * 금융회사에서 "누가 언제 어떤 건을 열람하고 발송했는지"는
 * 나중에 반드시 요구받는 항목이다. 화면을 만들 때부터 쌓는다.
 * ------------------------------------------------------------------ */

export const RAW_AUDIT: AuditEntry[] = [
  { at: hoursAgo(0.4), actor: '김선우', action: 'login', inquiryId: null },
  { at: hoursAgo(0.3), actor: '김선우', action: 'viewList', inquiryId: null, detail: '상태=신규' },
  { at: hoursAgo(0.2), actor: '김선우', action: 'viewDetail', inquiryId: 'INQ-2026-0142' },
  { at: hoursAgo(1.1), actor: '이현주', action: 'login', inquiryId: null },
  { at: hoursAgo(1.0), actor: '이현주', action: 'viewDetail', inquiryId: 'INQ-2026-0143' },
  {
    at: hoursAgo(26),
    actor: '김선우',
    action: 'changeStatus',
    inquiryId: 'INQ-2026-0145',
    detail: '신규 → 검토중',
  },
  {
    at: hoursAgo(66),
    actor: '김선우',
    action: 'changeStatus',
    inquiryId: 'INQ-2026-0140',
    detail: '신규 → 검토중',
  },
  {
    at: hoursAgo(68),
    actor: '이현주',
    action: 'sendReport',
    inquiryId: 'INQ-2026-0139',
    detail: '결과지 발송 (고정 서식)',
  },
  {
    at: hoursAgo(90),
    actor: '이현주',
    action: 'sendReport',
    inquiryId: 'INQ-2026-0138',
    detail: '결과지 발송 (고정 서식)',
  },
  {
    at: hoursAgo(212),
    actor: '김선우',
    action: 'sendReport',
    inquiryId: 'INQ-2026-0136',
    detail: '결과지 발송 (고정 서식)',
  },
  {
    at: hoursAgo(340),
    actor: '이현주',
    action: 'changeStatus',
    inquiryId: 'INQ-2026-0146',
    detail: '상담 진행 → 종료 (연락 불가)',
  },
  {
    at: hoursAgo(470),
    actor: '김선우',
    action: 'changeStatus',
    inquiryId: 'INQ-2026-0128',
    detail: '상담 진행 → 종료 (계약)',
  },
];
