/**
 * supabase/seed.sql 생성기
 *
 *   npm run seed:gen
 *
 * 문항·전략군·목업 문의를 코드(src/lib/mock)에서 읽어 SQL로 뽑는다.
 * 손으로 옮겨 적으면 오타가 나고, 배점을 고쳤을 때 조용히 어긋난다.
 *
 * 목업 데이터를 고쳤으면 이 스크립트를 다시 돌리고 seed.sql을 Supabase에 다시 넣으면 된다.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  BELOW_MINIMUM_NOTICE,
  CORPORATE_AMOUNT_TIERS,
  DIAGNOSIS_DISCLAIMER,
  INDIVIDUAL_AMOUNT_TIERS,
  MINIMUM_AMOUNT_KRW,
  QUESTIONS_BY_SEGMENT,
  REPORT_SLA_HOURS,
  STAFF,
  STRATEGIES,
  TIER_LABELS,
  TIER_SUMMARIES,
  STRATEGY_BY_TIER,
  TIER_THRESHOLDS,
} from '../src/lib/mock/catalog';
import { RAW_AUDIT, RAW_INQUIRIES } from '../src/lib/mock/fixtures';
import { diagnose } from '../src/lib/domain/scoring';
import type { Catalog } from '../src/lib/domain/catalog';
import type { RiskTier } from '../src/lib/api/types';

/* ---------------- SQL 값 만들기 ---------------- */

const q = (value: string | null | undefined): string =>
  value === null || value === undefined ? 'null' : `'${value.replace(/'/g, "''")}'`;

const n = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'null' : String(value);

const b = (value: boolean | undefined): string => (value ? 'true' : 'false');

const json = (value: unknown): string =>
  value === null || value === undefined ? 'null' : `${q(JSON.stringify(value))}::jsonb`;

/** 목업은 "몇 시간 전"으로 만들어져 있다. seed에서는 now() 기준 상대 시각으로 굳힌다. */
const hoursAgo = (hours: number): string => `now() - interval '${hours} hours'`;

const rows = (table: string, columns: string[], values: string[][]): string => {
  if (values.length === 0) return '';
  const body = values.map((v) => `  (${v.join(', ')})`).join(',\n');
  return `insert into ${table} (${columns.join(', ')}) values\n${body};\n`;
};

/* ---------------- 만들기 ---------------- */

const parts: string[] = [
  '-- 투자문의 진단 위저드 — 시드 데이터',
  '--',
  '-- ⚠ 이 파일은 scripts/generate-seed.ts가 만든 것입니다. 직접 고치지 마세요.',
  '--   목업 데이터를 고쳤으면 `npm run seed:gen`으로 다시 뽑으세요.',
  '--',
  '-- schema.sql을 먼저 실행한 뒤 이 파일을 Supabase SQL Editor에 붙여넣으세요.',
  '',
];

/* 설정 */
parts.push(
  '-- 기준값과 문구 (PRD §15-1, §15-4 확정 전 임시값)',
  rows(
    'app_config',
    [
      'id',
      'minimum_amount_krw',
      'below_minimum_notice',
      'disclaimer',
      'report_sla_hours',
    ],
    [
      [
        '1',
        n(MINIMUM_AMOUNT_KRW),
        q(BELOW_MINIMUM_NOTICE),
        q(DIAGNOSIS_DISCLAIMER),
        n(REPORT_SLA_HOURS),
      ],
    ],
  ),
);

/* 금액 구간 */
parts.push(
  '-- 금액 구간 (PLACEHOLDER §15-1)',
  rows(
    'amount_tiers',
    ['segment', 'value', 'label', 'tier_index', 'below_minimum'],
    [
      ...INDIVIDUAL_AMOUNT_TIERS.map((t) => [
        q('individual'),
        q(t.value),
        q(t.label),
        n(t.tierIndex),
        b(t.belowMinimum),
      ]),
      ...CORPORATE_AMOUNT_TIERS.map((t) => [
        q('corporate'),
        q(t.value),
        q(t.label),
        n(t.tierIndex),
        b(t.belowMinimum),
      ]),
    ],
  ),
);

/* 위험도 등급 */
parts.push(
  '-- 위험도 등급과 점수 경계 (PLACEHOLDER §15-2)',
  rows(
    'risk_tiers',
    ['tier', 'label', 'summary', 'min_score', 'max_score', 'sort_order'],
    TIER_THRESHOLDS.map((t, index) => [
      q(t.tier),
      q(TIER_LABELS[t.tier]),
      q(TIER_SUMMARIES[t.tier]),
      n(t.min),
      n(t.max),
      n(index),
    ]),
  ),
);

/* 전략군 */
parts.push(
  '-- 전략군. 숫자는 하나도 들어가지 않는다 (PRD §3 원칙 3)',
  rows(
    'strategies',
    ['tier', 'name', 'description', 'volatility_note', 'suitable_for'],
    STRATEGIES.map((s) => [
      q(s.tier),
      q(s.name),
      q(s.description),
      q(s.volatilityNote),
      q(s.suitableFor),
    ]),
  ),
);

/* 문항과 선택지 */
const allQuestions = [...QUESTIONS_BY_SEGMENT.individual, ...QUESTIONS_BY_SEGMENT.corporate];

parts.push(
  '-- 문항 (PRD §5 개인 / §6 법인)',
  rows(
    'questions',
    [
      'id',
      'segment',
      'sort_order',
      'kind',
      'prompt',
      'help',
      'optional',
      'max_length',
      'show_when',
      'max_score',
      'hidden_default_score',
    ],
    allQuestions.map((question) => [
      q(question.id),
      q(question.segment),
      n(question.order),
      q(question.kind),
      q(question.prompt),
      q(question.help),
      b(question.optional),
      n(question.maxLength),
      json(question.showWhen ?? null),
      n(question.maxScore),
      n(question.hiddenDefaultScore),
    ]),
  ),
);

parts.push(
  '-- 선택지. score는 브라우저로 나가지 않는다 (api-spec.md §3.1)',
  rows(
    'choices',
    ['question_id', 'value', 'label', 'sort_order', 'score', 'is_unsure', 'tier_index', 'notice'],
    allQuestions.flatMap((question) =>
      (question.choices ?? []).map((choice, index) => [
        q(question.id),
        q(choice.value),
        q(choice.label),
        n(index),
        n(choice.score),
        b(choice.isUnsure),
        n(choice.tierIndex),
        q(choice.notice),
      ]),
    ),
  ),
);

/* 법인 배정표 — DB의 corporate_tier_rules 표가 될 내용 */
const CORPORATE_RULES: Record<string, Record<string, RiskTier>> = {
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

/**
 * 목업 상수로 카탈로그를 만든다.
 * 판정은 운영 서버와 완전히 같은 함수(domain/scoring)를 쓴다 —
 * 여기서만 따로 계산하면 시드와 실제 동작이 어긋난다.
 */
const catalog: Catalog = {
  config: {
    minimumAmountKrw: MINIMUM_AMOUNT_KRW,
    belowMinimumNotice: BELOW_MINIMUM_NOTICE,
    disclaimer: DIAGNOSIS_DISCLAIMER,
    reportSlaHours: REPORT_SLA_HOURS,
    verification: { codeLength: 6, ttlSeconds: 600, maxAttempts: 5 },
  },
  amountTiers: {
    individual: [...INDIVIDUAL_AMOUNT_TIERS],
    corporate: [...CORPORATE_AMOUNT_TIERS],
  },
  tiers: TIER_THRESHOLDS.map((t) => ({
    tier: t.tier,
    label: TIER_LABELS[t.tier],
    summary: TIER_SUMMARIES[t.tier],
    minScore: t.min,
    maxScore: t.max,
  })),
  strategies: STRATEGY_BY_TIER,
  questions: QUESTIONS_BY_SEGMENT,
  corporateRules: CORPORATE_RULES,
};

parts.push(
  '-- 법인 유형 배정표 (PRD §7). 법인은 점수제를 쓰지 않는다',
  rows(
    'corporate_tier_rules',
    ['loss_tolerance', 'horizon', 'tier'],
    Object.entries(CORPORATE_RULES).flatMap(([tolerance, byHorizon]) =>
      Object.entries(byHorizon).map(([horizon, tier]) => [q(tolerance), q(horizon), q(tier)]),
    ),
  ),
);

/* 담당자 */
parts.push(
  '-- 담당자. 계정은 관리자가 직접 만든다 (PRD §10)',
  rows(
    'staff',
    ['id', 'name', 'email', 'role'],
    STAFF.map((s) => [q(s.id), q(s.name), q(s.email), q(s.role)]),
  ),
);

/* 목업 문의 */
parts.push(
  '-- 목업 문의 14건. 이름·회사명·연락처는 모두 가상이다',
  rows(
    'inquiries',
    [
      'id',
      'segment',
      'submitted_at',
      'email_verified_at',
      'contact',
      'answers',
      'diagnosis',
      'consents',
      'status',
      'assignee',
      'report_sent_at',
      'close_reason',
      'close_note',
    ],
    RAW_INQUIRIES.map((raw) => {
      const diagnosis = diagnose(catalog, raw.segment, raw.answers);
      if (diagnosis.tier !== raw.expectedTier) {
        throw new Error(
          `${raw.id}: 의도한 유형(${raw.expectedTier})과 계산 결과(${diagnosis.tier})가 다릅니다. 배점을 확인하세요.`,
        );
      }
      return [
        q(raw.id),
        q(raw.segment),
        hoursAgo(raw.submittedHoursAgo),
        hoursAgo(raw.submittedHoursAgo + 0.02),
        json(raw.contact),
        json(raw.answers),
        json(diagnosis),
        json({
          privacy: true,
          privacyAt: null,
          marketing: raw.marketingConsent,
          marketingAt: null,
        }),
        q(raw.status),
        q(raw.assignee),
        raw.reportSentHoursAgo === null ? 'null' : hoursAgo(raw.reportSentHoursAgo),
        q(raw.closeReason),
        q(raw.closeNote),
      ];
    }),
  ),
);

/* 동의 시각은 접수 시각과 같게 맞춘다 — jsonb 안에 상대 시각을 넣을 수 없어서 따로 채운다 */
parts.push(
  '-- 동의 시각을 접수 시각으로 맞춘다',
  `update inquiries set consents = jsonb_set(
  jsonb_set(consents, '{privacyAt}', to_jsonb(submitted_at)),
  '{marketingAt}',
  case when consents->>'marketing' = 'true' then to_jsonb(submitted_at) else 'null'::jsonb end
);`,
  '',
);

/* 메모 */
parts.push(
  '-- 메모',
  rows(
    'memos',
    ['inquiry_id', 'at', 'author', 'body'],
    RAW_INQUIRIES.flatMap((raw) =>
      raw.memos.map((memo) => {
        // 목업 메모는 ISO 문자열로 굳어 있다. 접수 시각 기준 상대값으로 되돌린다.
        const hours = (Date.now() - new Date(memo.at).getTime()) / 3_600_000;
        return [q(raw.id), hoursAgo(Number(hours.toFixed(2))), q(memo.author), q(memo.body)];
      }),
    ),
  ),
);

/* 열람 기록 */
parts.push(
  '-- 열람 기록 (PRD §10 접근 통제)',
  rows(
    'audit_log',
    ['at', 'actor', 'action', 'inquiry_id', 'detail'],
    RAW_AUDIT.map((entry) => {
      const hours = (Date.now() - new Date(entry.at).getTime()) / 3_600_000;
      return [
        hoursAgo(Number(hours.toFixed(2))),
        q(entry.actor),
        q(entry.action),
        q(entry.inquiryId),
        q(entry.detail),
      ];
    }),
  ),
);

/* ---------------- 쓰기 ---------------- */

const target = resolve(import.meta.dirname, '../supabase/seed.sql');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, parts.join('\n'), 'utf8');

console.log(`seed.sql 생성 완료 → ${target}`);
console.log(`  문항 ${allQuestions.length}개 / 선택지 ${allQuestions.reduce((sum, q2) => sum + (q2.choices?.length ?? 0), 0)}개`);
console.log(`  전략군 ${STRATEGIES.length}개 / 목업 문의 ${RAW_INQUIRIES.length}건`);
