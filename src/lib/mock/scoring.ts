/**
 * 유형 판정 — PRD §7
 *
 * 개인은 점수제, 법인은 표에서 직접 배정한다.
 * 목업 문의(fixtures.ts)의 진단 결과도 이 함수로 계산한다 —
 * 손으로 적어두면 배점을 고칠 때 데이터가 어긋난다.
 */

import {
  QUESTIONS_BY_SEGMENT,
  TIER_THRESHOLDS,
  INDIVIDUAL_AMOUNT_TIERS,
  CORPORATE_AMOUNT_TIERS,
} from './catalog';
import type {
  AnswerMap,
  AnswerValue,
  BranchRule,
  Condition,
  Diagnosis,
  Question,
  RiskTier,
  ScoreLine,
  Segment,
} from './types';

/* ------------------------------------------------------------------ *
 * 분기 판정
 * ------------------------------------------------------------------ */

function amountTierIndexOf(segment: Segment, answers: AnswerMap): number {
  const tiers = segment === 'individual' ? INDIVIDUAL_AMOUNT_TIERS : CORPORATE_AMOUNT_TIERS;
  const key = segment === 'individual' ? 'ind_amount' : 'corp_amount';
  const value = answers[key];
  if (typeof value !== 'string') return -1;
  return tiers.find((t) => t.value === value)?.tierIndex ?? -1;
}

function matches(condition: Condition, segment: Segment, answers: AnswerMap): boolean {
  const value = answers[condition.questionId];
  switch (condition.op) {
    case 'eq':
      return value === condition.value;
    case 'in':
      return typeof value === 'string' && condition.value.includes(value);
    case 'amountTierAtLeast':
      return amountTierIndexOf(segment, answers) >= condition.value;
  }
}

function ruleSatisfied(rule: BranchRule, segment: Segment, answers: AnswerMap): boolean {
  if (rule.all && !rule.all.every((c) => matches(c, segment, answers))) return false;
  if (rule.any && !rule.any.some((c) => matches(c, segment, answers))) return false;
  return true;
}

/**
 * 지금 답변 상태에서 고객에게 보여야 하는 문항 목록.
 * 위저드가 다음 화면을 결정할 때 쓴다 (PRD §4-3).
 */
export function visibleQuestions(segment: Segment, answers: AnswerMap): Question[] {
  return QUESTIONS_BY_SEGMENT[segment]
    .filter((q) => !q.showWhen || ruleSatisfied(q.showWhen, segment, answers))
    .sort((a, b) => a.order - b.order);
}

/** 위저드 진행률 — 조건부 문항 때문에 분모가 답변에 따라 변한다. */
export function progressOf(segment: Segment, answers: AnswerMap) {
  const visible = visibleQuestions(segment, answers);
  const answered = visible.filter((q) => {
    const v = answers[q.id];
    return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
  }).length;
  return { answered, total: visible.length, ratio: visible.length ? answered / visible.length : 0 };
}

/* ------------------------------------------------------------------ *
 * 선택지 조회
 * ------------------------------------------------------------------ */

function choiceOf(question: Question, value: AnswerValue) {
  if (typeof value !== 'string') return undefined;
  return question.choices?.find((c) => c.value === value);
}

/** "잘 모르겠습니다" 계열 응답 수 (PRD §3 원칙 1 · §10 목록 컬럼) */
export function countUnsure(segment: Segment, answers: AnswerMap): number {
  let count = 0;
  for (const q of QUESTIONS_BY_SEGMENT[segment]) {
    const value = answers[q.id];
    if (Array.isArray(value)) {
      if (value.some((v) => q.choices?.find((c) => c.value === v)?.isUnsure)) count += 1;
    } else if (choiceOf(q, value)?.isUnsure) {
      count += 1;
    }
  }
  return count;
}

/* ------------------------------------------------------------------ *
 * 개인 판정 — 점수제
 * ------------------------------------------------------------------ */

const SCORED_INDIVIDUAL_QUESTIONS = [
  'ind_timing',
  'ind_loss_reaction',
  'ind_experience',
  'ind_withdrawal',
  'ind_dependency',
];

function tierForScore(score: number): RiskTier {
  const clamped = Math.max(0, Math.min(100, score));
  return TIER_THRESHOLDS.find((t) => clamped >= t.min && clamped <= t.max)?.tier ?? 'stable';
}

function scoreIndividual(answers: AnswerMap): { score: number; breakdown: ScoreLine[] } {
  const visible = new Set(visibleQuestions('individual', answers).map((q) => q.id));
  const breakdown: ScoreLine[] = [];
  let total = 0;

  for (const id of SCORED_INDIVIDUAL_QUESTIONS) {
    const question = QUESTIONS_BY_SEGMENT.individual.find((q) => q.id === id);
    if (!question) continue;

    const isVisible = visible.has(id);
    let points: number;
    let usedDefault = false;

    if (!isVisible) {
      // 문항이 표시되지 않았으면 중립값. 없으면 판정에서 제외 (0점).
      points = question.hiddenDefaultScore ?? 0;
      usedDefault = question.hiddenDefaultScore !== undefined;
      if (!usedDefault) continue;
    } else {
      points = choiceOf(question, answers[id])?.score ?? 0;
    }

    total += points;
    breakdown.push({
      questionId: id,
      label: question.prompt,
      points,
      maxScore: question.maxScore ?? 0,
      usedDefault,
    });
  }

  return { score: Math.max(0, Math.min(100, total)), breakdown };
}

/* ------------------------------------------------------------------ *
 * 법인 판정 — 표 배정 (PRD §7 마지막 문단)
 *
 * "원금이 줄면 곤란합니다"는 다른 답과 무관하게 안정형으로 고정한다.
 * ------------------------------------------------------------------ */

const CORPORATE_TIER_TABLE: Record<string, Record<string, RiskTier>> = {
  no_principal_loss: {
    within_1y: 'stable',
    '1_to_3y': 'stable',
    over_3y: 'stable',
    undecided: 'stable',
  },
  needs_check: {
    within_1y: 'stable',
    '1_to_3y': 'stableSeeking',
    over_3y: 'stableSeeking',
    undecided: 'stableSeeking',
  },
  temporary_ok: {
    within_1y: 'stableSeeking',
    '1_to_3y': 'neutral',
    over_3y: 'active',
    undecided: 'neutral',
  },
};

function tierForCorporate(answers: AnswerMap): RiskTier {
  const tolerance = typeof answers.corp_loss_tolerance === 'string' ? answers.corp_loss_tolerance : '';
  const horizon = typeof answers.corp_horizon === 'string' ? answers.corp_horizon : 'undecided';
  return CORPORATE_TIER_TABLE[tolerance]?.[horizon] ?? 'stable';
}

/* ------------------------------------------------------------------ *
 * 최종 진단
 * ------------------------------------------------------------------ */

export function diagnose(segment: Segment, answers: AnswerMap): Diagnosis {
  const amountTierIndex = amountTierIndexOf(segment, answers);
  const tiers = segment === 'individual' ? INDIVIDUAL_AMOUNT_TIERS : CORPORATE_AMOUNT_TIERS;
  const belowMinimum =
    tiers.find((t) => t.tierIndex === amountTierIndex)?.belowMinimum ?? false;

  // 선택 문항(optional)은 비어 있어도 완료로 본다.
  const complete = visibleQuestions(segment, answers).every((q) => {
    if (q.optional) return true;
    const v = answers[q.id];
    return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
  });

  if (segment === 'corporate') {
    return {
      tier: tierForCorporate(answers),
      score: null,
      breakdown: [],
      unsureCount: countUnsure(segment, answers),
      amountTierIndex,
      belowMinimum,
      complete,
    };
  }

  const { score, breakdown } = scoreIndividual(answers);
  return {
    tier: tierForScore(score),
    score,
    breakdown,
    unsureCount: countUnsure(segment, answers),
    amountTierIndex,
    belowMinimum,
    complete,
  };
}

/** 금액 구간 표시 이름 — 목록과 상세에서 쓴다. */
export function amountLabel(segment: Segment, answers: AnswerMap): string {
  const index = amountTierIndexOf(segment, answers);
  const tiers = segment === 'individual' ? INDIVIDUAL_AMOUNT_TIERS : CORPORATE_AMOUNT_TIERS;
  return tiers.find((t) => t.tierIndex === index)?.label ?? '미입력';
}
