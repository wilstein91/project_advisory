/**
 * 유형 판정 — PRD §7
 *
 * 개인은 점수제, 법인은 표에서 직접 배정한다.
 * 배점과 경계는 전부 카탈로그(= Supabase 표)에서 온다. 이 파일에는 "계산 방법"만 있다.
 * 배점을 바꾸려면 코드가 아니라 choices.score 컬럼을 고치면 된다.
 */

import type { AnswerMap, AnswerValue, BranchRule, Condition, RiskTier, Segment } from '@/lib/api/types';
import type { Catalog, ScoredQuestion } from './catalog';

/** 담당자 화면에 그대로 노출되는 점수 내역 (PRD §10) */
export interface ScoreLine {
  questionId: string;
  label: string;
  points: number;
  maxScore: number;
  usedDefault: boolean;
}

export interface DiagnosisResult {
  tier: RiskTier;
  /** 개인만. 법인은 표 배정이라 null */
  score: number | null;
  breakdown: ScoreLine[];
  unsureCount: number;
  amountTierIndex: number;
  belowMinimum: boolean;
  /** 보여야 하는 필수 문항이 다 찼는지. false면 결과 화면을 띄우지 않는다 */
  complete: boolean;
}

/* ------------------------------------------------------------------ *
 * 분기
 * ------------------------------------------------------------------ */

function amountTierIndexOf(catalog: Catalog, segment: Segment, answers: AnswerMap): number {
  const question = catalog.questions[segment].find((q) => q.kind === 'amount');
  if (!question) return -1;
  const value = answers[question.id];
  if (typeof value !== 'string') return -1;
  return question.choices?.find((c) => c.value === value)?.tierIndex ?? -1;
}

function matches(
  condition: Condition,
  catalog: Catalog,
  segment: Segment,
  answers: AnswerMap,
): boolean {
  const value = answers[condition.questionId];
  switch (condition.op) {
    case 'eq':
      return value === condition.value;
    case 'in':
      return typeof value === 'string' && condition.value.includes(value);
    case 'amountTierAtLeast':
      return amountTierIndexOf(catalog, segment, answers) >= condition.value;
    default:
      return false;
  }
}

function satisfied(
  rule: BranchRule,
  catalog: Catalog,
  segment: Segment,
  answers: AnswerMap,
): boolean {
  if (rule.all && !rule.all.every((c) => matches(c, catalog, segment, answers))) return false;
  if (rule.any && !rule.any.some((c) => matches(c, catalog, segment, answers))) return false;
  return true;
}

/** 지금 답변 상태에서 보여야 하는 문항 */
export function visibleQuestions(
  catalog: Catalog,
  segment: Segment,
  answers: AnswerMap,
): ScoredQuestion[] {
  return catalog.questions[segment]
    .filter((q) => !q.showWhen || satisfied(q.showWhen, catalog, segment, answers))
    .sort((a, b) => a.order - b.order);
}

/* ------------------------------------------------------------------ *
 * 집계
 * ------------------------------------------------------------------ */

function hasValue(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return value.trim() !== '';
}

/** "잘 모르겠습니다" 계열 응답 수 (PRD §3 원칙 1) */
export function countUnsure(catalog: Catalog, segment: Segment, answers: AnswerMap): number {
  let count = 0;
  for (const question of catalog.questions[segment]) {
    const value = answers[question.id];
    if (Array.isArray(value)) {
      if (value.some((v) => question.choices?.find((c) => c.value === v)?.isUnsure)) count += 1;
    } else if (
      typeof value === 'string' &&
      question.choices?.find((c) => c.value === value)?.isUnsure
    ) {
      count += 1;
    }
  }
  return count;
}

export function amountLabel(catalog: Catalog, segment: Segment, answers: AnswerMap): string {
  const index = amountTierIndexOf(catalog, segment, answers);
  return catalog.amountTiers[segment].find((t) => t.tierIndex === index)?.label ?? '미입력';
}

/* ------------------------------------------------------------------ *
 * 개인 — 점수제
 * ------------------------------------------------------------------ */

function tierForScore(catalog: Catalog, score: number): RiskTier {
  const clamped = Math.max(0, Math.min(100, score));
  const band = catalog.tiers.find((t) => clamped >= t.minScore && clamped <= t.maxScore);
  return band?.tier ?? catalog.tiers[0]?.tier ?? 'stable';
}

function scoreIndividual(catalog: Catalog, answers: AnswerMap) {
  const visible = new Set(visibleQuestions(catalog, 'individual', answers).map((q) => q.id));
  const breakdown: ScoreLine[] = [];
  let total = 0;

  // 배점이 붙은 문항만 판정에 들어간다. 어떤 문항이 그런지는 DB가 정한다.
  const scored = catalog.questions.individual.filter(
    (q) => q.maxScore !== undefined || q.hiddenDefaultScore !== undefined || hasScoredChoice(q),
  );

  for (const question of scored) {
    const isVisible = visible.has(question.id);
    let points: number;
    let usedDefault = false;

    if (!isVisible) {
      if (question.hiddenDefaultScore === undefined || question.hiddenDefaultScore === null) {
        continue; // 중립값이 없으면 판정에서 아예 뺀다
      }
      points = question.hiddenDefaultScore;
      usedDefault = true;
    } else {
      const value = answers[question.id];
      points =
        (typeof value === 'string'
          ? question.choices?.find((c) => c.value === value)?.score
          : undefined) ?? 0;
    }

    total += points;
    breakdown.push({
      questionId: question.id,
      label: question.prompt,
      points,
      maxScore: question.maxScore ?? 0,
      usedDefault,
    });
  }

  return { score: Math.max(0, Math.min(100, total)), breakdown };
}

function hasScoredChoice(question: ScoredQuestion): boolean {
  return (question.choices ?? []).some((c) => c.score !== undefined && c.score !== null);
}

/* ------------------------------------------------------------------ *
 * 법인 — 표 배정 (PRD §7 마지막 문단)
 * ------------------------------------------------------------------ */

function tierForCorporate(catalog: Catalog, answers: AnswerMap): RiskTier {
  const tolerance =
    typeof answers.corp_loss_tolerance === 'string' ? answers.corp_loss_tolerance : '';
  const horizon = typeof answers.corp_horizon === 'string' ? answers.corp_horizon : 'undecided';
  return catalog.corporateRules[tolerance]?.[horizon] ?? catalog.tiers[0]?.tier ?? 'stable';
}

/* ------------------------------------------------------------------ *
 * 최종 판정
 * ------------------------------------------------------------------ */

export function diagnose(
  catalog: Catalog,
  segment: Segment,
  answers: AnswerMap,
): DiagnosisResult {
  const amountTierIndex = amountTierIndexOf(catalog, segment, answers);
  const belowMinimum =
    catalog.amountTiers[segment].find((t) => t.tierIndex === amountTierIndex)?.belowMinimum ??
    false;

  // 선택 문항은 비어 있어도 완료로 본다
  const complete = visibleQuestions(catalog, segment, answers).every(
    (q) => q.optional === true || hasValue(answers[q.id]),
  );

  const shared = {
    unsureCount: countUnsure(catalog, segment, answers),
    amountTierIndex,
    belowMinimum,
    complete,
  };

  if (segment === 'corporate') {
    return { tier: tierForCorporate(catalog, answers), score: null, breakdown: [], ...shared };
  }

  const { score, breakdown } = scoreIndividual(catalog, answers);
  return { tier: tierForScore(catalog, score), score, breakdown, ...shared };
}
