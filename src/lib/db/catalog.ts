import 'server-only';
import { db } from './client';
import type { Catalog, ScoredQuestion, TierBand } from '@/lib/domain/catalog';
import type { AmountTier, RiskTier, Segment, Strategy } from '@/lib/api/types';

/**
 * 카탈로그 불러오기
 *
 * 문항·전략군·기준값을 Supabase에서 읽어 한 덩어리로 만든다.
 * 요청마다 표 일곱 개를 조회하면 낭비라 잠깐 캐시해 둔다.
 * 표에서 문구를 고쳤을 때 최대 CACHE_MS만큼 늦게 반영된다.
 */

const CACHE_MS = 60_000;

let cache: { at: number; value: Catalog } | null = null;

export function clearCatalogCache(): void {
  cache = null;
}

export async function loadCatalog(): Promise<Catalog> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  const client = db();

  const [config, amounts, tiers, strategies, questions, choices, rules] = await Promise.all([
    client.from('app_config').select('*').eq('id', 1).single(),
    client.from('amount_tiers').select('*').order('tier_index'),
    client.from('risk_tiers').select('*').order('sort_order'),
    client.from('strategies').select('*'),
    client.from('questions').select('*').order('sort_order'),
    client.from('choices').select('*').order('sort_order'),
    client.from('corporate_tier_rules').select('*'),
  ]);

  const failed = [config, amounts, tiers, strategies, questions, choices, rules].find(
    (r) => r.error,
  );
  if (failed?.error) {
    throw new Error(`카탈로그를 불러오지 못했습니다: ${failed.error.message}`);
  }

  const choicesByQuestion = new Map<string, ChoiceRow[]>();
  for (const row of (choices.data ?? []) as ChoiceRow[]) {
    const list = choicesByQuestion.get(row.question_id) ?? [];
    list.push(row);
    choicesByQuestion.set(row.question_id, list);
  }

  const toQuestion = (row: QuestionRow): ScoredQuestion => ({
    id: row.id,
    segment: row.segment,
    order: row.sort_order,
    kind: row.kind,
    prompt: row.prompt,
    ...(row.help ? { help: row.help } : {}),
    ...(row.optional ? { optional: true } : {}),
    ...(row.max_length !== null ? { maxLength: row.max_length } : {}),
    ...(row.show_when ? { showWhen: row.show_when } : {}),
    ...(row.max_score !== null ? { maxScore: row.max_score } : {}),
    ...(row.hidden_default_score !== null
      ? { hiddenDefaultScore: row.hidden_default_score }
      : {}),
    choices: (choicesByQuestion.get(row.id) ?? []).map((choice) => ({
      value: choice.value,
      label: choice.label,
      ...(choice.score !== null ? { score: choice.score } : {}),
      ...(choice.is_unsure ? { isUnsure: true } : {}),
      ...(choice.tier_index !== null ? { tierIndex: choice.tier_index } : {}),
      ...(choice.notice ? { notice: choice.notice } : {}),
    })),
  });

  const questionRows = (questions.data ?? []) as QuestionRow[];
  const amountRows = (amounts.data ?? []) as AmountRow[];
  const configRow = config.data as ConfigRow;

  const corporateRules: Record<string, Record<string, RiskTier>> = {};
  for (const rule of (rules.data ?? []) as RuleRow[]) {
    corporateRules[rule.loss_tolerance] ??= {};
    corporateRules[rule.loss_tolerance][rule.horizon] = rule.tier;
  }

  const bySegment = (segment: Segment): AmountTier[] =>
    amountRows
      .filter((a) => a.segment === segment)
      .map((a) => ({
        value: a.value,
        label: a.label,
        tierIndex: a.tier_index,
        belowMinimum: a.below_minimum,
      }));

  const value: Catalog = {
    config: {
      minimumAmountKrw: configRow.minimum_amount_krw,
      belowMinimumNotice: configRow.below_minimum_notice,
      disclaimer: configRow.disclaimer,
      reportSlaHours: configRow.report_sla_hours,
      verification: {
        codeLength: configRow.verify_code_length,
        ttlSeconds: configRow.verify_ttl_seconds,
        maxAttempts: configRow.verify_max_attempts,
      },
    },
    amountTiers: { individual: bySegment('individual'), corporate: bySegment('corporate') },
    tiers: ((tiers.data ?? []) as TierRow[]).map(
      (t): TierBand => ({
        tier: t.tier,
        label: t.label,
        summary: t.summary,
        minScore: t.min_score,
        maxScore: t.max_score,
      }),
    ),
    strategies: Object.fromEntries(
      ((strategies.data ?? []) as StrategyRow[]).map((s): [RiskTier, Strategy] => [
        s.tier,
        {
          tier: s.tier,
          name: s.name,
          description: s.description,
          volatilityNote: s.volatility_note,
          suitableFor: s.suitable_for,
        },
      ]),
    ) as Record<RiskTier, Strategy>,
    questions: {
      individual: questionRows.filter((q) => q.segment === 'individual').map(toQuestion),
      corporate: questionRows.filter((q) => q.segment === 'corporate').map(toQuestion),
    },
    corporateRules,
  };

  cache = { at: Date.now(), value };
  return value;
}

/* ---------------- 표 모양 ---------------- */

interface ConfigRow {
  minimum_amount_krw: number;
  below_minimum_notice: string;
  disclaimer: string;
  report_sla_hours: number;
  verify_code_length: number;
  verify_ttl_seconds: number;
  verify_max_attempts: number;
}

interface AmountRow {
  segment: Segment;
  value: string;
  label: string;
  tier_index: number;
  below_minimum: boolean;
}

interface TierRow {
  tier: RiskTier;
  label: string;
  summary: string;
  min_score: number;
  max_score: number;
}

interface StrategyRow {
  tier: RiskTier;
  name: string;
  description: string;
  volatility_note: string;
  suitable_for: string;
}

interface QuestionRow {
  id: string;
  segment: Segment;
  sort_order: number;
  kind: ScoredQuestion['kind'];
  prompt: string;
  help: string | null;
  optional: boolean;
  max_length: number | null;
  show_when: ScoredQuestion['showWhen'] | null;
  max_score: number | null;
  hidden_default_score: number | null;
}

interface ChoiceRow {
  question_id: string;
  value: string;
  label: string;
  score: number | null;
  is_unsure: boolean;
  tier_index: number | null;
  notice: string | null;
}

interface RuleRow {
  loss_tolerance: string;
  horizon: string;
  tier: RiskTier;
}
