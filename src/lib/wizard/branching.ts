/**
 * 분기 판정 — 화면에서 다음 문항을 정한다 (api-spec.md §4.2)
 *
 * 서버가 showWhen 규칙을 그대로 내려주므로 문항을 넘길 때마다 서버를 부르지
 * 않는다. 최종 판정만 접수 시점에 서버가 다시 계산한다.
 */

import type { AnswerMap, AnswerValue, BranchRule, Condition, Question } from '@/lib/api/types';

/** 금액 문항에서 고른 구간의 순서. 안 골랐으면 -1. */
function amountTierIndex(questions: Question[], answers: AnswerMap): number {
  const amountQuestion = questions.find((q) => q.kind === 'amount');
  if (!amountQuestion) return -1;
  const value = answers[amountQuestion.id];
  if (typeof value !== 'string') return -1;
  return amountQuestion.choices?.find((c) => c.value === value)?.tierIndex ?? -1;
}

function matches(condition: Condition, questions: Question[], answers: AnswerMap): boolean {
  const value = answers[condition.questionId];
  switch (condition.op) {
    case 'eq':
      return value === condition.value;
    case 'in':
      return typeof value === 'string' && condition.value.includes(value);
    case 'amountTierAtLeast':
      return amountTierIndex(questions, answers) >= condition.value;
    default:
      return false;
  }
}

function satisfied(rule: BranchRule, questions: Question[], answers: AnswerMap): boolean {
  if (rule.all && !rule.all.every((c) => matches(c, questions, answers))) return false;
  if (rule.any && !rule.any.some((c) => matches(c, questions, answers))) return false;
  return true;
}

/** 지금 답변 상태에서 보여야 하는 문항. 답이 바뀌면 목록도 바뀐다. */
export function visibleQuestions(questions: Question[], answers: AnswerMap): Question[] {
  return questions
    .filter((q) => !q.showWhen || satisfied(q.showWhen, questions, answers))
    .sort((a, b) => a.order - b.order);
}

export function hasAnswer(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  return value.trim() !== '';
}

/** 이 문항을 넘어갈 수 있는지. 선택 문항은 비어 있어도 넘어간다. */
export function canAdvance(question: Question, answers: AnswerMap): boolean {
  return question.optional === true || hasAnswer(answers[question.id]);
}

/**
 * 조건부 문항이 숨겨지면 그 답도 버린다.
 * 예: 용도를 "잘 모르겠습니다"로 뒀다가 바꾸면 생활 의존도 답이 남아 있으면 안 된다.
 */
export function pruneHiddenAnswers(questions: Question[], answers: AnswerMap): AnswerMap {
  const visible = new Set(visibleQuestions(questions, answers).map((q) => q.id));
  const next: AnswerMap = {};
  for (const [key, value] of Object.entries(answers)) {
    if (visible.has(key)) next[key] = value;
  }
  return next;
}

export function progressOf(questions: Question[], answers: AnswerMap, index: number) {
  const visible = visibleQuestions(questions, answers);
  return {
    total: visible.length,
    current: Math.min(index + 1, visible.length),
    ratio: visible.length ? Math.min(index / visible.length, 1) : 0,
  };
}
