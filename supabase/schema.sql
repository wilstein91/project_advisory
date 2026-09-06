-- 투자문의 진단 위저드 — Supabase 스키마
--
-- Supabase 대시보드 → SQL Editor에 이 파일을 통째로 붙여넣고 실행하세요.
-- 그다음 seed.sql을 실행하면 문항과 목업 문의가 채워집니다.
--
-- 설계 원칙
--   1. 문항·선택지·전략군·문구까지 전부 표에 둔다. 문구를 고칠 때 코드를 건드리지
--      않고 Supabase 표 편집기에서 바로 고칠 수 있어야 한다 (PRD §15 확정 대기 항목).
--   2. 모든 표에 RLS를 켜고 정책을 하나도 만들지 않는다. 브라우저는 Supabase를
--      직접 부르지 않고, 서버가 service_role 키로만 접근한다.
--      특히 choices.score가 브라우저에 노출되면 진단이 무의미해진다 (api-spec.md §3.1).

-- ============================================================
-- 정리 (다시 실행할 때를 위해)
-- ============================================================

drop table if exists verification_tokens cascade;
drop table if exists email_verifications cascade;
drop table if exists audit_log cascade;
drop table if exists memos cascade;
drop table if exists inquiries cascade;
drop table if exists choices cascade;
drop table if exists questions cascade;
drop table if exists strategies cascade;
drop table if exists corporate_tier_rules cascade;
drop table if exists risk_tiers cascade;
drop table if exists amount_tiers cascade;
drop table if exists staff cascade;
drop table if exists app_config cascade;
drop sequence if exists inquiry_seq;

-- ============================================================
-- 설정
-- ============================================================

-- 한 줄짜리 표. 화면 전체가 쓰는 기준값과 문구.
create table app_config (
  id                   int primary key default 1,
  minimum_amount_krw   bigint      not null,
  below_minimum_notice text        not null,
  disclaimer           text        not null,
  report_sla_hours     int         not null default 24,
  verify_code_length   int         not null default 6,
  verify_ttl_seconds   int         not null default 600,
  verify_max_attempts  int         not null default 5,
  updated_at           timestamptz not null default now(),
  constraint app_config_single_row check (id = 1)
);

comment on table app_config is 'PRD §15-1, §15-4 확정 전 임시값이 들어 있다';

-- 금액 구간. PLACEHOLDER §15-1 — 확정되면 이 표만 고친다.
create table amount_tiers (
  segment        text not null check (segment in ('individual', 'corporate')),
  value          text not null,
  label          text not null,
  tier_index     int  not null,
  below_minimum  bool not null default false,
  primary key (segment, value)
);

-- 위험도 등급. PLACEHOLDER §15-2 — 등급이 5개가 아닐 수도 있다.
-- 점수 경계도 여기 있으므로 배점 조정이 코드 수정 없이 가능하다.
create table risk_tiers (
  tier       text primary key,
  label      text not null,
  summary    text not null,
  min_score  int  not null,
  max_score  int  not null,
  sort_order int  not null
);

-- 전략군. 숫자 컬럼이 없다 — 예상 수익률·자산 비중·최대 낙폭은 넣지 않는다 (PRD §3 원칙 3).
create table strategies (
  tier            text primary key references risk_tiers(tier) on delete cascade,
  name            text not null,
  description     text not null,
  volatility_note text not null,
  suitable_for    text not null
);

-- ============================================================
-- 문항
-- ============================================================

create table questions (
  id                   text primary key,
  segment              text not null check (segment in ('individual', 'corporate')),
  sort_order           int  not null,
  kind                 text not null check (kind in ('single', 'multi', 'amount', 'text')),
  prompt               text not null,
  help                 text,
  optional             bool not null default false,
  max_length           int,
  -- 조건부 표시 규칙. null이면 항상 표시. 모양은 api-spec.md §3.1 참조.
  show_when            jsonb,
  max_score            int,
  -- 문항이 표시되지 않았을 때 판정에 쓰는 중립값 (PRD §7)
  hidden_default_score int,
  unique (segment, sort_order)
);

create table choices (
  question_id text not null references questions(id) on delete cascade,
  value       text not null,
  label       text not null,
  sort_order  int  not null,
  -- 판정 배점. 절대 브라우저로 나가면 안 된다 (api-spec.md §3.1).
  score       int,
  is_unsure   bool not null default false,
  tier_index  int,
  notice      text,
  primary key (question_id, value)
);

comment on column choices.score is '브라우저로 내려보내지 않는다 — publicQuestions()가 지운다';
comment on column choices.is_unsure is '"잘 모르겠습니다" 계열. 담당자 화면 모름 집계에 쓰인다';

-- 법인 유형 배정표 (PRD §7 마지막 문단).
-- 법인은 점수제를 쓰지 않고 이 표에서 직접 고른다.
create table corporate_tier_rules (
  loss_tolerance text not null,
  horizon        text not null,
  tier           text not null references risk_tiers(tier),
  primary key (loss_tolerance, horizon)
);

-- ============================================================
-- 담당자
-- ============================================================

create table staff (
  id    text primary key,
  name  text not null,
  email text not null unique,
  role  text not null default 'manager' check (role in ('manager', 'admin'))
);

comment on table staff is '계정은 관리자가 직접 만든다. 자유 가입 경로는 없다 (PRD §10)';

-- ============================================================
-- 문의
-- ============================================================

-- 접수 번호. 목업 14건이 0128~0147을 쓰므로 148부터 시작한다.
create sequence inquiry_seq start 148;

create table inquiries (
  id                text primary key
                    default 'INQ-' || to_char(now(), 'YYYY') || '-' ||
                            lpad(nextval('inquiry_seq')::text, 4, '0'),
  segment           text        not null check (segment in ('individual', 'corporate')),
  submitted_at      timestamptz not null default now(),
  email_verified_at timestamptz not null default now(),

  -- 이름·이메일·연락처. 목업 단계라 평문이다.
  -- 실제 고객 정보를 받기 전에 반드시 암호화로 바꿔야 한다.
  contact           jsonb       not null,

  -- 문항 id → 답변. 문항이 바뀌어도 스키마를 안 고치려고 jsonb로 둔다.
  answers           jsonb       not null default '{}'::jsonb,

  -- 판정 결과. 접수 시점의 배점으로 계산된 값을 그대로 굳혀 둔다.
  -- 나중에 배점을 바꿔도 과거 문의의 진단이 소급해서 달라지면 안 된다.
  diagnosis         jsonb       not null,

  -- 필수/선택 동의를 분리해서 각각 시각과 함께 남긴다 (PRD §11)
  consents          jsonb       not null,

  status            text        not null default 'new'
                    check (status in ('new', 'reviewing', 'reportSent', 'consulting', 'closed')),
  assignee          text,
  report_sent_at    timestamptz,
  close_reason      text        check (close_reason in
                    ('contracted', 'belowMinimum', 'unreachable', 'customerHold', 'other')),
  close_note        text,

  -- 종료로 바꿀 때는 사유가 반드시 있어야 한다 (PRD §10)
  constraint inquiries_close_reason_required
    check (status <> 'closed' or close_reason is not null)
);

create index inquiries_status_idx       on inquiries (status);
create index inquiries_submitted_at_idx on inquiries (submitted_at desc);
create index inquiries_segment_idx      on inquiries (segment);

comment on column inquiries.contact is '목업 단계라 평문. 실제 고객 정보를 받기 전에 암호화 필요';
comment on column inquiries.diagnosis is '접수 시점의 판정을 굳혀 둔다. 배점을 바꿔도 소급되지 않는다';

create table memos (
  id          bigserial primary key,
  inquiry_id  text        not null references inquiries(id) on delete cascade,
  at          timestamptz not null default now(),
  author      text        not null,
  body        text        not null
);

create index memos_inquiry_idx on memos (inquiry_id, at);

-- 누가 언제 어떤 건을 열람하고 발송했는지 (PRD §10 접근 통제).
-- 금융회사에서 나중에 반드시 요구받는 기록이다.
create table audit_log (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  actor      text        not null,
  action     text        not null
             check (action in ('login', 'viewList', 'viewDetail', 'sendReport', 'changeStatus')),
  inquiry_id text        references inquiries(id) on delete set null,
  detail     text
);

create index audit_log_at_idx      on audit_log (at desc);
create index audit_log_inquiry_idx on audit_log (inquiry_id, at desc);

-- ============================================================
-- 이메일 인증
--
-- 메모리에 두면 안 된다. 서버가 여러 대로 늘어나면 인증번호를 발급한 서버와
-- 확인하는 서버가 달라져서, 방금 받은 번호가 "없는 번호"가 된다.
-- ============================================================

create table email_verifications (
  email      text        primary key,
  code       text        not null,
  attempts   int         not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- 인증에 성공하면 발급되는 접수용 토큰. 접수 한 번에 소진된다 (api-spec.md §4.6).
create table verification_tokens (
  token      text        primary key,
  email      text        not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index verification_tokens_expires_idx on verification_tokens (expires_at);

-- ============================================================
-- 접근 제어
--
-- 모든 표에 RLS를 켜고 정책을 하나도 만들지 않는다.
-- 정책이 없으면 anon/authenticated 키로는 아무것도 못 읽는다.
-- 서버가 쓰는 service_role 키만 RLS를 우회한다.
--
-- 이 구조가 지켜져야 choices.score가 브라우저로 새지 않고,
-- 고객 개인정보가 클라이언트 키로 조회되지 않는다.
-- ============================================================

alter table app_config           enable row level security;
alter table amount_tiers         enable row level security;
alter table risk_tiers           enable row level security;
alter table strategies           enable row level security;
alter table questions            enable row level security;
alter table choices              enable row level security;
alter table corporate_tier_rules enable row level security;
alter table staff                enable row level security;
alter table inquiries            enable row level security;
alter table memos                enable row level security;
alter table audit_log            enable row level security;
alter table email_verifications  enable row level security;
alter table verification_tokens  enable row level security;
