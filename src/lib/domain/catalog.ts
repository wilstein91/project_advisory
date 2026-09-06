/**
 * 카탈로그 — 문항·전략군·기준값의 서버 쪽 모양
 *
 * 예전에는 이 값들이 코드 상수(src/lib/mock/catalog.ts)였다. 이제는 Supabase 표에서
 * 온다. 문구를 고칠 때 배포하지 않고 표 편집기에서 고칠 수 있게 하려는 것이다.
 *
 * 판정 "로직"은 코드에 남고, 판정에 쓰이는 "값"만 DB에서 온다.
 */

import type {
  AmountTier,
  Choice,
  Question,
  RiskTier,
  Segment,
  Strategy,
} from '@/lib/api/types';

/** 배점이 붙은 선택지. 이 모양 그대로 브라우저에 내려보내면 안 된다. */
export interface ScoredChoice extends Choice {
  score?: number;
}

/** 배점이 붙은 문항 */
export interface ScoredQuestion extends Omit<Question, 'choices'> {
  choices?: ScoredChoice[];
  maxScore?: number;
  /** 문항이 표시되지 않았을 때 판정에 쓰는 중립값 (PRD §7) */
  hiddenDefaultScore?: number;
}

export interface TierBand {
  tier: RiskTier;
  label: string;
  summary: string;
  minScore: number;
  maxScore: number;
}

export interface CatalogConfig {
  minimumAmountKrw: number;
  belowMinimumNotice: string;
  disclaimer: string;
  reportSlaHours: number;
  verification: { codeLength: number; ttlSeconds: number; maxAttempts: number };
}

export interface Catalog {
  config: CatalogConfig;
  amountTiers: Record<Segment, AmountTier[]>;
  tiers: TierBand[];
  strategies: Record<RiskTier, Strategy>;
  questions: Record<Segment, ScoredQuestion[]>;
  /** 법인 배정표: 평가손실 허용 → 기간 → 유형 (PRD §7) */
  corporateRules: Record<string, Record<string, RiskTier>>;
}

/* ------------------------------------------------------------------ *
 * 카탈로그에서 값 꺼내기
 * ------------------------------------------------------------------ */

export function tierLabels(catalog: Catalog): Record<RiskTier, string> {
  return Object.fromEntries(catalog.tiers.map((t) => [t.tier, t.label])) as Record<
    RiskTier,
    string
  >;
}

export function tierSummaries(catalog: Catalog): Record<RiskTier, string> {
  return Object.fromEntries(catalog.tiers.map((t) => [t.tier, t.summary])) as Record<
    RiskTier,
    string
  >;
}

export function labelOf(catalog: Catalog, tier: RiskTier): string {
  return catalog.tiers.find((t) => t.tier === tier)?.label ?? tier;
}

export function summaryOf(catalog: Catalog, tier: RiskTier): string {
  return catalog.tiers.find((t) => t.tier === tier)?.summary ?? '';
}

/** 자유 입력 문항 id — 목록 미리보기에 쓴다 (PRD §10) */
export function freeTextQuestionIds(catalog: Catalog): string[] {
  return [...catalog.questions.individual, ...catalog.questions.corporate]
    .filter((q) => q.kind === 'text')
    .map((q) => q.id);
}

/**
 * 브라우저로 내려보낼 문항. 배점을 지운다 (api-spec.md §3.1).
 * "어떻게 답해야 공격투자형이 나오는지"가 개발자 도구에 보이면 진단이 무의미해진다.
 */
export function publicQuestions(catalog: Catalog, segment: Segment): Question[] {
  return catalog.questions[segment].map((question) => ({
    id: question.id,
    segment: question.segment,
    order: question.order,
    kind: question.kind,
    prompt: question.prompt,
    ...(question.help ? { help: question.help } : {}),
    ...(question.optional ? { optional: true } : {}),
    ...(question.maxLength ? { maxLength: question.maxLength } : {}),
    ...(question.showWhen ? { showWhen: question.showWhen } : {}),
    choices: question.choices?.map((choice) => ({
      value: choice.value,
      label: choice.label,
      ...(choice.isUnsure ? { isUnsure: true } : {}),
      ...(choice.tierIndex !== undefined && choice.tierIndex !== null
        ? { tierIndex: choice.tierIndex }
        : {}),
      ...(choice.notice ? { notice: choice.notice } : {}),
    })),
  }));
}
