/**
 * 문항 · 전략군 · 유형 이름 정의
 *
 * 이 파일에 담긴 문장은 그대로 화면에 나간다. 문구를 고치는 작업은
 * 전부 여기서만 하면 되고, 컴포넌트는 건드리지 않는다.
 *
 * ⚠ PLACEHOLDER 표시가 붙은 값은 PRD §15에서 확정되기 전의 임시값이다.
 */

import type {
  CloseReason,
  InquiryStatus,
  Question,
  RiskTier,
  Segment,
  Strategy,
} from './types';

/* ------------------------------------------------------------------ *
 * 금액 기준 — PRD §15-1 (사내 결정 대기)
 * ------------------------------------------------------------------ */

/** PLACEHOLDER §15-1 · 최소 가입금액. 확정되면 이 값 하나만 고친다. */
export const MINIMUM_AMOUNT_KRW = 100_000_000;

/** PLACEHOLDER §15-1 · 개인 금액 구간. tierIndex 0,1이 최소 기준 미달. */
export const INDIVIDUAL_AMOUNT_TIERS = [
  { value: 'under_30m', label: '3천만 원 미만', tierIndex: 0, belowMinimum: true },
  { value: '30m_100m', label: '3천만 원 ~ 1억 원', tierIndex: 1, belowMinimum: true },
  { value: '100m_300m', label: '1억 원 ~ 3억 원', tierIndex: 2, belowMinimum: false },
  { value: '300m_1b', label: '3억 원 ~ 10억 원', tierIndex: 3, belowMinimum: false },
  { value: 'over_1b', label: '10억 원 이상', tierIndex: 4, belowMinimum: false },
] as const;

/** PLACEHOLDER §15-1 · 법인 규모 구간 */
export const CORPORATE_AMOUNT_TIERS = [
  { value: 'under_500m', label: '5억 원 미만', tierIndex: 0, belowMinimum: true },
  { value: '500m_2b', label: '5억 원 ~ 20억 원', tierIndex: 1, belowMinimum: false },
  { value: '2b_10b', label: '20억 원 ~ 100억 원', tierIndex: 2, belowMinimum: false },
  { value: 'over_10b', label: '100억 원 이상', tierIndex: 3, belowMinimum: false },
] as const;

/**
 * 금액 미달 안내 문구 (PRD §5-Q3).
 * 거절이 아니라 대안 안내로 쓴다 — 진행은 계속 가능하다.
 */
export const BELOW_MINIMUM_NOTICE =
  '이 금액대는 일임 계약 기준에는 조금 못 미치지만, 어떻게 접근하면 좋을지는 안내드릴 수 있습니다.';

/* ------------------------------------------------------------------ *
 * 유형 이름과 고객에게 보여줄 한 줄 — PRD §7
 * ------------------------------------------------------------------ */

export const TIER_LABELS: Record<RiskTier, string> = {
  stable: '안정형',
  stableSeeking: '안정추구형',
  neutral: '위험중립형',
  active: '적극투자형',
  aggressive: '공격투자형',
};

export const STATUS_LABELS: Record<InquiryStatus, string> = {
  new: '신규',
  reviewing: '검토중',
  reportSent: '결과지 발송',
  consulting: '상담 진행',
  closed: '종료',
};

export const CLOSE_REASON_LABELS: Record<CloseReason, string> = {
  contracted: '계약',
  belowMinimum: '금액 미달',
  unreachable: '연락 불가',
  customerHold: '고객 보류',
  other: '기타',
};

export const TIER_SUMMARIES: Record<RiskTier, string> = {
  stable: '원금이 줄어드는 상황을 가장 피하고 싶어하시는 편입니다.',
  stableSeeking: '조금씩이라도 안정적으로 불어나는 쪽을 선호하십니다.',
  neutral: '오르내림을 어느 정도 감안하고 균형을 찾는 편입니다.',
  active: '기간을 두고 적극적으로 불리는 쪽을 택하십니다.',
  aggressive: '큰 오르내림을 감안하고 성장에 무게를 두십니다.',
};

/** 유형 점수 경계 (PRD §7). 개인 판정에만 쓴다. */
export const TIER_THRESHOLDS: { min: number; max: number; tier: RiskTier }[] = [
  { min: 0, max: 19, tier: 'stable' },
  { min: 20, max: 39, tier: 'stableSeeking' },
  { min: 40, max: 59, tier: 'neutral' },
  { min: 60, max: 79, tier: 'active' },
  { min: 80, max: 100, tier: 'aggressive' },
];

/**
 * 화면과 결과지에 반드시 함께 나가는 문장 (PRD §7).
 * 이 문장 없이 유형만 보여주는 화면은 만들지 않는다.
 */
export const DIAGNOSIS_DISCLAIMER =
  '이 안내는 참고용이며, 계약 단계에서 별도로 진행되는 적합성 진단을 대체하지 않습니다.';

/* ------------------------------------------------------------------ *
 * 개인 문항 — PRD §5
 * ------------------------------------------------------------------ */

export const INDIVIDUAL_QUESTIONS: Question[] = [
  {
    id: 'ind_timing',
    segment: 'individual',
    order: 1,
    kind: 'single',
    prompt: '이 돈을 언제쯤 쓰실 계획인가요?',
    maxScore: 30,
    choices: [
      { value: 'within_3y', label: '3년 안에', score: 0 },
      { value: '3_to_10y', label: '3년에서 10년 사이', score: 18 },
      { value: 'over_10y', label: '10년 이상 두고 볼 생각입니다', score: 30 },
      { value: 'undecided', label: '아직 정해두지 않았습니다', score: 10, isUnsure: true },
    ],
  },
  {
    id: 'ind_purpose',
    segment: 'individual',
    order: 2,
    kind: 'single',
    prompt: '이 돈은 어떤 데 쓰실 돈인가요?',
    choices: [
      { value: 'retirement', label: '은퇴 후 생활' },
      { value: 'house', label: '집 살 돈이나 목돈' },
      { value: 'children', label: '자녀에게' },
      { value: 'surplus', label: '당장 쓸 데 없는 여유자금' },
      { value: 'unsure', label: '잘 모르겠습니다', isUnsure: true },
    ],
  },
  {
    id: 'ind_amount',
    segment: 'individual',
    order: 3,
    kind: 'amount',
    prompt: '얼마 정도를 맡기실 생각인가요?',
    help: '대략적인 범위만 골라주시면 됩니다.',
    choices: INDIVIDUAL_AMOUNT_TIERS.map((t) => ({
      value: t.value,
      label: t.label,
      tierIndex: t.tierIndex,
      ...(t.belowMinimum ? { notice: BELOW_MINIMUM_NOTICE } : {}),
    })),
  },
  {
    id: 'ind_loss_reaction',
    segment: 'individual',
    order: 4,
    kind: 'single',
    prompt:
      '1년 뒤에 맡긴 돈이 100만 원 중 85만 원으로 줄어 있다면, 어떻게 하시겠어요?',
    help: '정답은 없습니다. 지금 드는 생각 그대로 골라주세요.',
    maxScore: 35,
    choices: [
      { value: 'withdraw_all', label: '바로 다 빼겠습니다', score: 0 },
      { value: 'wait', label: '불안하지만 지켜보겠습니다', score: 18 },
      { value: 'add_more', label: '오히려 더 넣겠습니다', score: 35 },
      { value: 'cannot_imagine', label: '상상이 잘 안 됩니다', score: 8, isUnsure: true },
    ],
  },
  {
    id: 'ind_experience',
    segment: 'individual',
    order: 5,
    kind: 'single',
    prompt: '지금까지 투자해 보신 경험은 어느 정도인가요?',
    maxScore: 20,
    choices: [
      { value: 'savings_only', label: '예금·적금만 해봤습니다', score: 0 },
      { value: 'fund_etf', label: '펀드나 ETF 정도', score: 8 },
      { value: 'direct_stock', label: '주식을 직접 사고팝니다', score: 15 },
      { value: 'diverse', label: '해외·파생까지 다양하게 해봤습니다', score: 20 },
    ],
  },
  {
    id: 'ind_dependency',
    segment: 'individual',
    order: 6,
    kind: 'single',
    prompt: '지금 이 돈이 없어도 생활에는 문제가 없나요?',
    help: '용도를 아직 정하지 않으셨다고 하셔서, 돈의 성격만 확인하려는 질문입니다.',
    showWhen: { all: [{ questionId: 'ind_purpose', op: 'eq', value: 'unsure' }] },
    maxScore: 0,
    choices: [
      { value: 'no_problem', label: '전혀 문제 없습니다', score: 0 },
      { value: 'slightly', label: '조금 불편합니다', score: -8 },
      { value: 'living_expenses', label: '생활비로 써야 하는 돈입니다', score: -20 },
    ],
  },
  {
    id: 'ind_holdings',
    segment: 'individual',
    order: 7,
    kind: 'multi',
    prompt: '지금 갖고 계신 자산은 대략 어떻게 나뉘어 있나요?',
    help: '해당되는 것을 모두 골라주세요.',
    showWhen: {
      all: [
        { questionId: 'ind_experience', op: 'in', value: ['direct_stock', 'diverse'] },
        { questionId: 'ind_amount', op: 'amountTierAtLeast', value: 2 },
      ],
    },
    choices: [
      { value: 'deposit', label: '예금·적금' },
      { value: 'kr_equity', label: '국내주식' },
      { value: 'global_equity', label: '해외주식' },
      { value: 'bond', label: '채권' },
      { value: 'real_estate', label: '부동산' },
      { value: 'pension', label: '연금' },
      { value: 'other', label: '기타' },
    ],
  },
  {
    id: 'ind_withdrawal',
    segment: 'individual',
    order: 8,
    kind: 'single',
    prompt: '중간에 일부를 빼야 할 일이 생길 수도 있나요?',
    showWhen: {
      any: [{ questionId: 'ind_timing', op: 'in', value: ['within_3y', 'undecided'] }],
    },
    maxScore: 15,
    hiddenDefaultScore: 8,
    choices: [
      { value: 'none', label: '그럴 일 없습니다', score: 15 },
      { value: 'maybe', label: '있을 수도 있습니다', score: 8 },
      { value: 'anytime', label: '언제든 뺄 수 있어야 합니다', score: 0 },
    ],
  },
  {
    id: 'ind_avoid',
    segment: 'individual',
    order: 9,
    kind: 'multi',
    prompt: '꼭 피하고 싶은 투자가 있으신가요?',
    optional: true,
    choices: [
      { value: 'none', label: '없습니다' },
      { value: 'sector', label: '특정 산업' },
      { value: 'overseas', label: '해외 자산' },
      { value: 'any_loss', label: '원금이 줄 수 있는 건 전부' },
      { value: 'unsure', label: '잘 모르겠습니다', isUnsure: true },
    ],
  },
  {
    id: 'ind_freetext',
    segment: 'individual',
    order: 10,
    kind: 'text',
    prompt: '마지막으로, 하고 싶은 말이 있으면 편하게 써주세요.',
    help: '안 쓰셔도 됩니다.',
    optional: true,
    maxLength: 500,
  },
];

/* ------------------------------------------------------------------ *
 * 법인 문항 — PRD §6
 * ------------------------------------------------------------------ */

export const CORPORATE_QUESTIONS: Question[] = [
  {
    id: 'corp_fund_type',
    segment: 'corporate',
    order: 1,
    kind: 'single',
    prompt: '어떤 성격의 자금인가요?',
    choices: [
      { value: 'operating_surplus', label: '사업상 여유자금' },
      { value: 'pension_fund', label: '퇴직연금·기금' },
      { value: 'endowment', label: '재단·조합 출연금' },
      { value: 'other', label: '기타' },
    ],
  },
  {
    id: 'corp_horizon',
    segment: 'corporate',
    order: 2,
    kind: 'single',
    prompt: '얼마 동안 맡겨두실 수 있나요?',
    choices: [
      { value: 'within_1y', label: '1년 안에 다시 써야 합니다' },
      { value: '1_to_3y', label: '1년에서 3년 사이' },
      { value: 'over_3y', label: '3년 이상' },
      { value: 'undecided', label: '아직 미정입니다', isUnsure: true },
    ],
  },
  {
    id: 'corp_amount',
    segment: 'corporate',
    order: 3,
    kind: 'amount',
    prompt: '규모는 어느 정도인가요?',
    choices: CORPORATE_AMOUNT_TIERS.map((t) => ({
      value: t.value,
      label: t.label,
      tierIndex: t.tierIndex,
      ...(t.belowMinimum ? { notice: BELOW_MINIMUM_NOTICE } : {}),
    })),
  },
  {
    id: 'corp_loss_tolerance',
    segment: 'corporate',
    order: 4,
    kind: 'single',
    prompt: '회계상 평가손실이 나면 문제가 되나요?',
    help: '법인 문의에서 가장 중요한 질문입니다.',
    choices: [
      { value: 'no_principal_loss', label: '원금이 줄면 곤란합니다' },
      { value: 'temporary_ok', label: '일시적 평가손실은 괜찮습니다' },
      { value: 'needs_check', label: '아직 확인이 필요합니다', isUnsure: true },
    ],
  },
  {
    id: 'corp_decision',
    segment: 'corporate',
    order: 5,
    kind: 'single',
    prompt: '투자를 결정하려면 어떤 절차가 필요한가요?',
    choices: [
      { value: 'ceo', label: '대표 결정으로 가능합니다' },
      { value: 'board', label: '이사회 승인이 필요합니다' },
      { value: 'investment_committee', label: '투자위원회가 있습니다' },
      { value: 'undecided', label: '아직 정해지지 않았습니다', isUnsure: true },
    ],
  },
  {
    id: 'corp_reporting',
    segment: 'corporate',
    order: 6,
    kind: 'single',
    prompt: '운용 보고는 얼마나 자주 받아야 하나요?',
    choices: [
      { value: 'monthly', label: '월 단위' },
      { value: 'quarterly', label: '분기 단위' },
      { value: 'on_demand', label: '필요할 때마다' },
      { value: 'unsure', label: '잘 모르겠습니다', isUnsure: true },
    ],
  },
  {
    id: 'corp_restrictions',
    segment: 'corporate',
    order: 7,
    kind: 'single',
    prompt: '내부 규정이나 정관에 투자 제약이 있나요?',
    optional: true,
    choices: [
      { value: 'none', label: '없습니다' },
      { value: 'exists', label: '있습니다' },
      { value: 'needs_check', label: '확인이 필요합니다', isUnsure: true },
    ],
  },
  {
    id: 'corp_freetext',
    segment: 'corporate',
    order: 8,
    kind: 'text',
    prompt: '그밖에 알아야 할 사정이 있으면 적어주세요.',
    help: '위에서 제약이 있다고 하셨으면 여기에 적어주시면 됩니다.',
    optional: true,
    maxLength: 500,
  },
];

export const QUESTIONS_BY_SEGMENT: Record<Segment, Question[]> = {
  individual: INDIVIDUAL_QUESTIONS,
  corporate: CORPORATE_QUESTIONS,
};

/** 자유 입력 문항 id — 목록 미리보기에 쓴다 (PRD §10) */
export const FREETEXT_QUESTION_IDS = ['ind_freetext', 'corp_freetext'];

/* ------------------------------------------------------------------ *
 * 전략군 — PRD §8
 *
 * 숫자가 하나도 들어가지 않는다. 예상 수익률·자산 비중·최대 낙폭 금지 (§3 원칙 3).
 * 정식 분류 이름은 §15-2에서 확정.
 * ------------------------------------------------------------------ */

export const STRATEGIES: Strategy[] = [
  {
    tier: 'stable',
    name: '원금 지키기 중심',
    nameIsPlaceholder: true,
    description:
      '만기와 이자가 정해진 자산을 중심으로 담습니다. 크게 불리는 것보다 맡긴 돈이 그대로 남아 있는 것을 앞세우는 구성입니다.',
    volatilityNote: '평소에는 오르내림이 거의 느껴지지 않는 편입니다.',
    suitableFor: '가까운 시점에 쓸 돈이거나, 줄어드는 것을 견디기 어려운 분에게 맞습니다.',
  },
  {
    tier: 'stableSeeking',
    name: '안정 우선에 성장 조금',
    nameIsPlaceholder: true,
    description:
      '대부분을 안정적인 자산에 두고 일부만 오르내리는 자산에 나눠 담습니다. 예금보다는 나은 결과를 기대하면서 큰 흔들림은 피하려는 구성입니다.',
    volatilityNote: '가끔 줄어든 구간이 보이지만 폭이 크지는 않은 편입니다.',
    suitableFor: '몇 년 두고 볼 수 있고, 조금씩이라도 늘어나길 바라는 분에게 맞습니다.',
  },
  {
    tier: 'neutral',
    name: '균형 잡힌 글로벌 배분',
    nameIsPlaceholder: true,
    description:
      '오르내리는 자산과 안정적인 자산을 나라와 종류를 나눠 함께 담습니다. 한쪽이 안 좋을 때 다른 쪽이 버텨주도록 짜는 구성입니다.',
    volatilityNote: '해에 따라 눈에 띄게 줄어든 구간을 지나갈 수 있습니다.',
    suitableFor: '기간을 두고 맡길 수 있고, 오르내림을 지켜볼 수 있는 분에게 맞습니다.',
  },
  {
    tier: 'active',
    name: '성장 중심',
    nameIsPlaceholder: true,
    description:
      '늘어날 여지가 큰 자산의 비중을 높게 잡습니다. 안정적인 자산은 흔들림을 줄이는 역할로만 일부 담는 구성입니다.',
    volatilityNote: '줄어든 구간이 한동안 이어질 수 있고, 폭도 작지 않습니다.',
    suitableFor: '오래 두고 볼 수 있고, 중간의 손실 구간을 견딜 수 있는 분에게 맞습니다.',
  },
  {
    tier: 'aggressive',
    name: '집중 성장',
    nameIsPlaceholder: true,
    description:
      '기대를 두는 곳에 비중을 모아 담습니다. 흔들림을 줄이는 장치를 최소한으로만 두는 구성입니다.',
    volatilityNote: '맡긴 돈이 크게 줄어든 상태로 오래 머무를 수 있습니다.',
    suitableFor: '충분히 오래 두고 볼 수 있고, 큰 오르내림을 이미 겪어보신 분에게 맞습니다.',
  },
];

export const STRATEGY_BY_TIER: Record<RiskTier, Strategy> = STRATEGIES.reduce(
  (acc, s) => {
    acc[s.tier] = s;
    return acc;
  },
  {} as Record<RiskTier, Strategy>,
);

/* ------------------------------------------------------------------ *
 * 담당자 (PRD §10 — 관리자가 직접 만드는 계정)
 * ------------------------------------------------------------------ */

export const STAFF = [
  { id: 'staff_kim', name: '김선우', email: 'kim@example.com', role: 'manager' as const },
  { id: 'staff_lee', name: '이현주', email: 'lee@example.com', role: 'manager' as const },
  { id: 'staff_admin', name: '운영관리자', email: 'admin@example.com', role: 'admin' as const },
];

/** 결과지 발송 기한 — 영업일 1일 (PRD §9, §14) */
export const REPORT_SLA_HOURS = 24;
