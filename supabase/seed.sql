-- 투자문의 진단 위저드 — 시드 데이터
--
-- ⚠ 이 파일은 scripts/generate-seed.ts가 만든 것입니다. 직접 고치지 마세요.
--   목업 데이터를 고쳤으면 `npm run seed:gen`으로 다시 뽑으세요.
--
-- schema.sql을 먼저 실행한 뒤 이 파일을 Supabase SQL Editor에 붙여넣으세요.

-- 기준값과 문구 (PRD §15-1, §15-4 확정 전 임시값)
insert into app_config (id, minimum_amount_krw, below_minimum_notice, disclaimer, report_sla_hours) values
  (1, 100000000, '이 금액대는 일임 계약 기준에는 조금 못 미치지만, 어떻게 접근하면 좋을지는 안내드릴 수 있습니다.', '이 안내는 참고용이며, 계약 단계에서 별도로 진행되는 적합성 진단을 대체하지 않습니다.', 24);

-- 금액 구간 (PLACEHOLDER §15-1)
insert into amount_tiers (segment, value, label, tier_index, below_minimum) values
  ('individual', 'under_30m', '3천만 원 미만', 0, true),
  ('individual', '30m_100m', '3천만 원 ~ 1억 원', 1, true),
  ('individual', '100m_300m', '1억 원 ~ 3억 원', 2, false),
  ('individual', '300m_1b', '3억 원 ~ 10억 원', 3, false),
  ('individual', 'over_1b', '10억 원 이상', 4, false),
  ('corporate', 'under_500m', '5억 원 미만', 0, true),
  ('corporate', '500m_2b', '5억 원 ~ 20억 원', 1, false),
  ('corporate', '2b_10b', '20억 원 ~ 100억 원', 2, false),
  ('corporate', 'over_10b', '100억 원 이상', 3, false);

-- 위험도 등급과 점수 경계 (PLACEHOLDER §15-2)
insert into risk_tiers (tier, label, summary, min_score, max_score, sort_order) values
  ('stable', '안정형', '원금이 줄어드는 상황을 가장 피하고 싶어하시는 편입니다.', 0, 19, 0),
  ('stableSeeking', '안정추구형', '조금씩이라도 안정적으로 불어나는 쪽을 선호하십니다.', 20, 39, 1),
  ('neutral', '위험중립형', '오르내림을 어느 정도 감안하고 균형을 찾는 편입니다.', 40, 59, 2),
  ('active', '적극투자형', '기간을 두고 적극적으로 불리는 쪽을 택하십니다.', 60, 79, 3),
  ('aggressive', '공격투자형', '큰 오르내림을 감안하고 성장에 무게를 두십니다.', 80, 100, 4);

-- 전략군. 숫자는 하나도 들어가지 않는다 (PRD §3 원칙 3)
insert into strategies (tier, name, description, volatility_note, suitable_for) values
  ('stable', '원금 지키기 중심', '만기와 이자가 정해진 자산을 중심으로 담습니다. 크게 불리는 것보다 맡긴 돈이 그대로 남아 있는 것을 앞세우는 구성입니다.', '평소에는 오르내림이 거의 느껴지지 않는 편입니다.', '가까운 시점에 쓸 돈이거나, 줄어드는 것을 견디기 어려운 분에게 맞습니다.'),
  ('stableSeeking', '안정 우선에 성장 조금', '대부분을 안정적인 자산에 두고 일부만 오르내리는 자산에 나눠 담습니다. 예금보다는 나은 결과를 기대하면서 큰 흔들림은 피하려는 구성입니다.', '가끔 줄어든 구간이 보이지만 폭이 크지는 않은 편입니다.', '몇 년 두고 볼 수 있고, 조금씩이라도 늘어나길 바라는 분에게 맞습니다.'),
  ('neutral', '균형 잡힌 글로벌 배분', '오르내리는 자산과 안정적인 자산을 나라와 종류를 나눠 함께 담습니다. 한쪽이 안 좋을 때 다른 쪽이 버텨주도록 짜는 구성입니다.', '해에 따라 눈에 띄게 줄어든 구간을 지나갈 수 있습니다.', '기간을 두고 맡길 수 있고, 오르내림을 지켜볼 수 있는 분에게 맞습니다.'),
  ('active', '성장 중심', '늘어날 여지가 큰 자산의 비중을 높게 잡습니다. 안정적인 자산은 흔들림을 줄이는 역할로만 일부 담는 구성입니다.', '줄어든 구간이 한동안 이어질 수 있고, 폭도 작지 않습니다.', '오래 두고 볼 수 있고, 중간의 손실 구간을 견딜 수 있는 분에게 맞습니다.'),
  ('aggressive', '집중 성장', '기대를 두는 곳에 비중을 모아 담습니다. 흔들림을 줄이는 장치를 최소한으로만 두는 구성입니다.', '맡긴 돈이 크게 줄어든 상태로 오래 머무를 수 있습니다.', '충분히 오래 두고 볼 수 있고, 큰 오르내림을 이미 겪어보신 분에게 맞습니다.');

-- 문항 (PRD §5 개인 / §6 법인)
insert into questions (id, segment, sort_order, kind, prompt, help, optional, max_length, show_when, max_score, hidden_default_score) values
  ('ind_timing', 'individual', 1, 'single', '이 돈을 언제쯤 쓰실 계획인가요?', null, false, null, null, 30, null),
  ('ind_purpose', 'individual', 2, 'single', '이 돈은 어떤 데 쓰실 돈인가요?', null, false, null, null, null, null),
  ('ind_amount', 'individual', 3, 'amount', '얼마 정도를 맡기실 생각인가요?', '대략적인 범위만 골라주시면 됩니다.', false, null, null, null, null),
  ('ind_loss_reaction', 'individual', 4, 'single', '1년 뒤에 맡긴 돈이 100만 원 중 85만 원으로 줄어 있다면, 어떻게 하시겠어요?', '정답은 없습니다. 지금 드는 생각 그대로 골라주세요.', false, null, null, 35, null),
  ('ind_experience', 'individual', 5, 'single', '지금까지 투자해 보신 경험은 어느 정도인가요?', null, false, null, null, 20, null),
  ('ind_dependency', 'individual', 6, 'single', '지금 이 돈이 없어도 생활에는 문제가 없나요?', '용도를 아직 정하지 않으셨다고 하셔서, 돈의 성격만 확인하려는 질문입니다.', false, null, '{"all":[{"questionId":"ind_purpose","op":"eq","value":"unsure"}]}'::jsonb, 0, null),
  ('ind_holdings', 'individual', 7, 'multi', '지금 갖고 계신 자산은 대략 어떻게 나뉘어 있나요?', '해당되는 것을 모두 골라주세요.', false, null, '{"all":[{"questionId":"ind_experience","op":"in","value":["direct_stock","diverse"]},{"questionId":"ind_amount","op":"amountTierAtLeast","value":2}]}'::jsonb, null, null),
  ('ind_withdrawal', 'individual', 8, 'single', '중간에 일부를 빼야 할 일이 생길 수도 있나요?', null, false, null, '{"any":[{"questionId":"ind_timing","op":"in","value":["within_3y","undecided"]}]}'::jsonb, 15, 8),
  ('ind_avoid', 'individual', 9, 'multi', '꼭 피하고 싶은 투자가 있으신가요?', null, true, null, null, null, null),
  ('ind_freetext', 'individual', 10, 'text', '마지막으로, 하고 싶은 말이 있으면 편하게 써주세요.', '안 쓰셔도 됩니다.', true, 500, null, null, null),
  ('corp_fund_type', 'corporate', 1, 'single', '어떤 성격의 자금인가요?', null, false, null, null, null, null),
  ('corp_horizon', 'corporate', 2, 'single', '얼마 동안 맡겨두실 수 있나요?', null, false, null, null, null, null),
  ('corp_amount', 'corporate', 3, 'amount', '규모는 어느 정도인가요?', null, false, null, null, null, null),
  ('corp_loss_tolerance', 'corporate', 4, 'single', '회계상 평가손실이 나면 문제가 되나요?', '법인 문의에서 가장 중요한 질문입니다.', false, null, null, null, null),
  ('corp_decision', 'corporate', 5, 'single', '투자를 결정하려면 어떤 절차가 필요한가요?', null, false, null, null, null, null),
  ('corp_reporting', 'corporate', 6, 'single', '운용 보고는 얼마나 자주 받아야 하나요?', null, false, null, null, null, null),
  ('corp_restrictions', 'corporate', 7, 'single', '내부 규정이나 정관에 투자 제약이 있나요?', null, true, null, null, null, null),
  ('corp_freetext', 'corporate', 8, 'text', '그밖에 알아야 할 사정이 있으면 적어주세요.', '위에서 제약이 있다고 하셨으면 여기에 적어주시면 됩니다.', true, 500, null, null, null);

-- 선택지. score는 브라우저로 나가지 않는다 (api-spec.md §3.1)
insert into choices (question_id, value, label, sort_order, score, is_unsure, tier_index, notice) values
  ('ind_timing', 'within_3y', '3년 안에', 0, 0, false, null, null),
  ('ind_timing', '3_to_10y', '3년에서 10년 사이', 1, 18, false, null, null),
  ('ind_timing', 'over_10y', '10년 이상 두고 볼 생각입니다', 2, 30, false, null, null),
  ('ind_timing', 'undecided', '아직 정해두지 않았습니다', 3, 10, true, null, null),
  ('ind_purpose', 'retirement', '은퇴 후 생활', 0, null, false, null, null),
  ('ind_purpose', 'house', '집 살 돈이나 목돈', 1, null, false, null, null),
  ('ind_purpose', 'children', '자녀에게', 2, null, false, null, null),
  ('ind_purpose', 'surplus', '당장 쓸 데 없는 여유자금', 3, null, false, null, null),
  ('ind_purpose', 'unsure', '잘 모르겠습니다', 4, null, true, null, null),
  ('ind_amount', 'under_30m', '3천만 원 미만', 0, null, false, 0, '이 금액대는 일임 계약 기준에는 조금 못 미치지만, 어떻게 접근하면 좋을지는 안내드릴 수 있습니다.'),
  ('ind_amount', '30m_100m', '3천만 원 ~ 1억 원', 1, null, false, 1, '이 금액대는 일임 계약 기준에는 조금 못 미치지만, 어떻게 접근하면 좋을지는 안내드릴 수 있습니다.'),
  ('ind_amount', '100m_300m', '1억 원 ~ 3억 원', 2, null, false, 2, null),
  ('ind_amount', '300m_1b', '3억 원 ~ 10억 원', 3, null, false, 3, null),
  ('ind_amount', 'over_1b', '10억 원 이상', 4, null, false, 4, null),
  ('ind_loss_reaction', 'withdraw_all', '바로 다 빼겠습니다', 0, 0, false, null, null),
  ('ind_loss_reaction', 'wait', '불안하지만 지켜보겠습니다', 1, 18, false, null, null),
  ('ind_loss_reaction', 'add_more', '오히려 더 넣겠습니다', 2, 35, false, null, null),
  ('ind_loss_reaction', 'cannot_imagine', '상상이 잘 안 됩니다', 3, 8, true, null, null),
  ('ind_experience', 'savings_only', '예금·적금만 해봤습니다', 0, 0, false, null, null),
  ('ind_experience', 'fund_etf', '펀드나 ETF 정도', 1, 8, false, null, null),
  ('ind_experience', 'direct_stock', '주식을 직접 사고팝니다', 2, 15, false, null, null),
  ('ind_experience', 'diverse', '해외·파생까지 다양하게 해봤습니다', 3, 20, false, null, null),
  ('ind_dependency', 'no_problem', '전혀 문제 없습니다', 0, 0, false, null, null),
  ('ind_dependency', 'slightly', '조금 불편합니다', 1, -8, false, null, null),
  ('ind_dependency', 'living_expenses', '생활비로 써야 하는 돈입니다', 2, -20, false, null, null),
  ('ind_holdings', 'deposit', '예금·적금', 0, null, false, null, null),
  ('ind_holdings', 'kr_equity', '국내주식', 1, null, false, null, null),
  ('ind_holdings', 'global_equity', '해외주식', 2, null, false, null, null),
  ('ind_holdings', 'bond', '채권', 3, null, false, null, null),
  ('ind_holdings', 'real_estate', '부동산', 4, null, false, null, null),
  ('ind_holdings', 'pension', '연금', 5, null, false, null, null),
  ('ind_holdings', 'other', '기타', 6, null, false, null, null),
  ('ind_withdrawal', 'none', '그럴 일 없습니다', 0, 15, false, null, null),
  ('ind_withdrawal', 'maybe', '있을 수도 있습니다', 1, 8, false, null, null),
  ('ind_withdrawal', 'anytime', '언제든 뺄 수 있어야 합니다', 2, 0, false, null, null),
  ('ind_avoid', 'none', '없습니다', 0, null, false, null, null),
  ('ind_avoid', 'sector', '특정 산업', 1, null, false, null, null),
  ('ind_avoid', 'overseas', '해외 자산', 2, null, false, null, null),
  ('ind_avoid', 'any_loss', '원금이 줄 수 있는 건 전부', 3, null, false, null, null),
  ('ind_avoid', 'unsure', '잘 모르겠습니다', 4, null, true, null, null),
  ('corp_fund_type', 'operating_surplus', '사업상 여유자금', 0, null, false, null, null),
  ('corp_fund_type', 'pension_fund', '퇴직연금·기금', 1, null, false, null, null),
  ('corp_fund_type', 'endowment', '재단·조합 출연금', 2, null, false, null, null),
  ('corp_fund_type', 'other', '기타', 3, null, false, null, null),
  ('corp_horizon', 'within_1y', '1년 안에 다시 써야 합니다', 0, null, false, null, null),
  ('corp_horizon', '1_to_3y', '1년에서 3년 사이', 1, null, false, null, null),
  ('corp_horizon', 'over_3y', '3년 이상', 2, null, false, null, null),
  ('corp_horizon', 'undecided', '아직 미정입니다', 3, null, true, null, null),
  ('corp_amount', 'under_500m', '5억 원 미만', 0, null, false, 0, '이 금액대는 일임 계약 기준에는 조금 못 미치지만, 어떻게 접근하면 좋을지는 안내드릴 수 있습니다.'),
  ('corp_amount', '500m_2b', '5억 원 ~ 20억 원', 1, null, false, 1, null),
  ('corp_amount', '2b_10b', '20억 원 ~ 100억 원', 2, null, false, 2, null),
  ('corp_amount', 'over_10b', '100억 원 이상', 3, null, false, 3, null),
  ('corp_loss_tolerance', 'no_principal_loss', '원금이 줄면 곤란합니다', 0, null, false, null, null),
  ('corp_loss_tolerance', 'temporary_ok', '일시적 평가손실은 괜찮습니다', 1, null, false, null, null),
  ('corp_loss_tolerance', 'needs_check', '아직 확인이 필요합니다', 2, null, true, null, null),
  ('corp_decision', 'ceo', '대표 결정으로 가능합니다', 0, null, false, null, null),
  ('corp_decision', 'board', '이사회 승인이 필요합니다', 1, null, false, null, null),
  ('corp_decision', 'investment_committee', '투자위원회가 있습니다', 2, null, false, null, null),
  ('corp_decision', 'undecided', '아직 정해지지 않았습니다', 3, null, true, null, null),
  ('corp_reporting', 'monthly', '월 단위', 0, null, false, null, null),
  ('corp_reporting', 'quarterly', '분기 단위', 1, null, false, null, null),
  ('corp_reporting', 'on_demand', '필요할 때마다', 2, null, false, null, null),
  ('corp_reporting', 'unsure', '잘 모르겠습니다', 3, null, true, null, null),
  ('corp_restrictions', 'none', '없습니다', 0, null, false, null, null),
  ('corp_restrictions', 'exists', '있습니다', 1, null, false, null, null),
  ('corp_restrictions', 'needs_check', '확인이 필요합니다', 2, null, true, null, null);

-- 법인 유형 배정표 (PRD §7). 법인은 점수제를 쓰지 않는다
insert into corporate_tier_rules (loss_tolerance, horizon, tier) values
  ('no_principal_loss', 'within_1y', 'stable'),
  ('no_principal_loss', '1_to_3y', 'stable'),
  ('no_principal_loss', 'over_3y', 'stable'),
  ('no_principal_loss', 'undecided', 'stable'),
  ('needs_check', 'within_1y', 'stable'),
  ('needs_check', '1_to_3y', 'stableSeeking'),
  ('needs_check', 'over_3y', 'stableSeeking'),
  ('needs_check', 'undecided', 'stableSeeking'),
  ('temporary_ok', 'within_1y', 'stableSeeking'),
  ('temporary_ok', '1_to_3y', 'neutral'),
  ('temporary_ok', 'over_3y', 'active'),
  ('temporary_ok', 'undecided', 'neutral');

-- 담당자. 계정은 관리자가 직접 만든다 (PRD §10)
insert into staff (id, name, email, role) values
  ('staff_kim', '김선우', 'kim@example.com', 'manager'),
  ('staff_lee', '이현주', 'lee@example.com', 'manager'),
  ('staff_admin', '운영관리자', 'admin@example.com', 'admin');

-- 목업 문의 14건. 이름·회사명·연락처는 모두 가상이다
insert into inquiries (id, segment, submitted_at, email_verified_at, contact, answers, diagnosis, consents, status, assignee, report_sent_at, close_reason, close_note) values
  ('INQ-2026-0128', 'individual', now() - interval '504 hours', now() - interval '504.02 hours', '{"name":"이서준","email":"seojun.lee@example.com","phone":"010-2841-7752"}'::jsonb, '{"ind_timing":"3_to_10y","ind_purpose":"retirement","ind_amount":"100m_300m","ind_loss_reaction":"wait","ind_experience":"fund_etf","ind_avoid":["none"],"ind_freetext":"퇴직이 7년쯤 남았습니다. 그때까지 크게 흔들리지 않게 굴렸으면 합니다."}'::jsonb, '{"tier":"neutral","score":52,"breakdown":[{"questionId":"ind_timing","label":"이 돈을 언제쯤 쓰실 계획인가요?","points":18,"maxScore":30,"usedDefault":false},{"questionId":"ind_loss_reaction","label":"1년 뒤에 맡긴 돈이 100만 원 중 85만 원으로 줄어 있다면, 어떻게 하시겠어요?","points":18,"maxScore":35,"usedDefault":false},{"questionId":"ind_experience","label":"지금까지 투자해 보신 경험은 어느 정도인가요?","points":8,"maxScore":20,"usedDefault":false},{"questionId":"ind_withdrawal","label":"중간에 일부를 빼야 할 일이 생길 수도 있나요?","points":8,"maxScore":15,"usedDefault":true}],"unsureCount":0,"amountTierIndex":2,"belowMinimum":false,"complete":true}'::jsonb, '{"privacy":true,"privacyAt":null,"marketing":true,"marketingAt":null}'::jsonb, 'closed', '김선우', now() - interval '500 hours', 'contracted', '균형 배분 일임 계약 체결.'),
  ('INQ-2026-0131', 'individual', now() - interval '408 hours', now() - interval '408.02 hours', '{"name":"박도윤","email":"doyoon.park@example.com","phone":"010-3317-9024"}'::jsonb, '{"ind_timing":"within_3y","ind_purpose":"house","ind_amount":"30m_100m","ind_loss_reaction":"withdraw_all","ind_experience":"savings_only","ind_withdrawal":"anytime","ind_avoid":["any_loss"],"ind_freetext":null}'::jsonb, '{"tier":"stable","score":0,"breakdown":[{"questionId":"ind_timing","label":"이 돈을 언제쯤 쓰실 계획인가요?","points":0,"maxScore":30,"usedDefault":false},{"questionId":"ind_loss_reaction","label":"1년 뒤에 맡긴 돈이 100만 원 중 85만 원으로 줄어 있다면, 어떻게 하시겠어요?","points":0,"maxScore":35,"usedDefault":false},{"questionId":"ind_experience","label":"지금까지 투자해 보신 경험은 어느 정도인가요?","points":0,"maxScore":20,"usedDefault":false},{"questionId":"ind_withdrawal","label":"중간에 일부를 빼야 할 일이 생길 수도 있나요?","points":0,"maxScore":15,"usedDefault":false}],"unsureCount":0,"amountTierIndex":1,"belowMinimum":true,"complete":true}'::jsonb, '{"privacy":true,"privacyAt":null,"marketing":false,"marketingAt":null}'::jsonb, 'closed', '김선우', now() - interval '404 hours', 'belowMinimum', '금액 기준 미달. 예금·적금 활용 방향만 안내드리고 종료.'),
  ('INQ-2026-0134', 'corporate', now() - interval '264 hours', now() - interval '264.02 hours', '{"name":"김민재","email":"mj.kim@example.com","phone":"02-786-4410","companyName":"(주)한결소재","title":"재무팀장"}'::jsonb, '{"corp_fund_type":"operating_surplus","corp_horizon":"1_to_3y","corp_amount":"2b_10b","corp_loss_tolerance":"no_principal_loss","corp_decision":"board","corp_reporting":"monthly","corp_restrictions":"none","corp_freetext":"이사회에 올릴 자료가 필요합니다. 월 보고 서식을 미리 볼 수 있을까요."}'::jsonb, '{"tier":"stable","score":null,"breakdown":[],"unsureCount":0,"amountTierIndex":2,"belowMinimum":false,"complete":true}'::jsonb, '{"privacy":true,"privacyAt":null,"marketing":true,"marketingAt":null}'::jsonb, 'consulting', '이현주', now() - interval '260 hours', null, null),
  ('INQ-2026-0136', 'individual', now() - interval '216 hours', now() - interval '216.02 hours', '{"name":"최유진","email":"yujin.choi@example.com","phone":"010-9928-1163"}'::jsonb, '{"ind_timing":"over_10y","ind_purpose":"surplus","ind_amount":"300m_1b","ind_loss_reaction":"add_more","ind_experience":"diverse","ind_holdings":["kr_equity","global_equity","real_estate"],"ind_avoid":["none"],"ind_freetext":"이미 직접 굴리고 있는 부분이 있어서, 그것과 겹치지 않는 쪽으로 부탁드립니다."}'::jsonb, '{"tier":"aggressive","score":93,"breakdown":[{"questionId":"ind_timing","label":"이 돈을 언제쯤 쓰실 계획인가요?","points":30,"maxScore":30,"usedDefault":false},{"questionId":"ind_loss_reaction","label":"1년 뒤에 맡긴 돈이 100만 원 중 85만 원으로 줄어 있다면, 어떻게 하시겠어요?","points":35,"maxScore":35,"usedDefault":false},{"questionId":"ind_experience","label":"지금까지 투자해 보신 경험은 어느 정도인가요?","points":20,"maxScore":20,"usedDefault":false},{"questionId":"ind_withdrawal","label":"중간에 일부를 빼야 할 일이 생길 수도 있나요?","points":8,"maxScore":15,"usedDefault":true}],"unsureCount":0,"amountTierIndex":3,"belowMinimum":false,"complete":true}'::jsonb, '{"privacy":true,"privacyAt":null,"marketing":true,"marketingAt":null}'::jsonb, 'consulting', '김선우', now() - interval '212 hours', null, null),
  ('INQ-2026-0138', 'individual', now() - interval '96 hours', now() - interval '96.02 hours', '{"name":"정하은","email":"haeun.jung@example.com","phone":"010-4402-8318"}'::jsonb, '{"ind_timing":"3_to_10y","ind_purpose":"retirement","ind_amount":"100m_300m","ind_loss_reaction":"cannot_imagine","ind_experience":"savings_only","ind_avoid":["overseas"],"ind_freetext":"투자를 한 번도 해본 적이 없어서 뭘 물어봐야 할지도 모르겠습니다."}'::jsonb, '{"tier":"stableSeeking","score":34,"breakdown":[{"questionId":"ind_timing","label":"이 돈을 언제쯤 쓰실 계획인가요?","points":18,"maxScore":30,"usedDefault":false},{"questionId":"ind_loss_reaction","label":"1년 뒤에 맡긴 돈이 100만 원 중 85만 원으로 줄어 있다면, 어떻게 하시겠어요?","points":8,"maxScore":35,"usedDefault":false},{"questionId":"ind_experience","label":"지금까지 투자해 보신 경험은 어느 정도인가요?","points":0,"maxScore":20,"usedDefault":false},{"questionId":"ind_withdrawal","label":"중간에 일부를 빼야 할 일이 생길 수도 있나요?","points":8,"maxScore":15,"usedDefault":true}],"unsureCount":1,"amountTierIndex":2,"belowMinimum":false,"complete":true}'::jsonb, '{"privacy":true,"privacyAt":null,"marketing":false,"marketingAt":null}'::jsonb, 'reportSent', '이현주', now() - interval '90 hours', null, null),
  ('INQ-2026-0139', 'corporate', now() - interval '72 hours', now() - interval '72.02 hours', '{"name":"오세훈","email":"sehoon.oh@example.com","phone":"02-3141-2280","companyName":"대성문화재단","title":"사무국장"}'::jsonb, '{"corp_fund_type":"endowment","corp_horizon":"over_3y","corp_amount":"500m_2b","corp_loss_tolerance":"needs_check","corp_decision":"investment_committee","corp_reporting":"quarterly","corp_restrictions":"exists","corp_freetext":"정관에 특정 업종 투자 제한 조항이 있습니다. 담당 변호사 확인 중이며 다음 주에 회신 가능합니다."}'::jsonb, '{"tier":"stableSeeking","score":null,"breakdown":[],"unsureCount":1,"amountTierIndex":1,"belowMinimum":false,"complete":true}'::jsonb, '{"privacy":true,"privacyAt":null,"marketing":true,"marketingAt":null}'::jsonb, 'reportSent', '이현주', now() - interval '68 hours', null, null),
  ('INQ-2026-0140', 'individual', now() - interval '70 hours', now() - interval '70.02 hours', '{"name":"강태오","email":"taeo.kang@example.com","phone":"010-7715-3390"}'::jsonb, '{"ind_timing":"over_10y","ind_purpose":"children","ind_amount":"300m_1b","ind_loss_reaction":"wait","ind_experience":"diverse","ind_holdings":["deposit","kr_equity","bond","pension"],"ind_avoid":["sector"],"ind_freetext":"아이가 둘인데 큰애가 대학 갈 때 일부는 써야 할 것 같습니다."}'::jsonb, '{"tier":"active","score":76,"breakdown":[{"questionId":"ind_timing","label":"이 돈을 언제쯤 쓰실 계획인가요?","points":30,"maxScore":30,"usedDefault":false},{"questionId":"ind_loss_reaction","label":"1년 뒤에 맡긴 돈이 100만 원 중 85만 원으로 줄어 있다면, 어떻게 하시겠어요?","points":18,"maxScore":35,"usedDefault":false},{"questionId":"ind_experience","label":"지금까지 투자해 보신 경험은 어느 정도인가요?","points":20,"maxScore":20,"usedDefault":false},{"questionId":"ind_withdrawal","label":"중간에 일부를 빼야 할 일이 생길 수도 있나요?","points":8,"maxScore":15,"usedDefault":true}],"unsureCount":0,"amountTierIndex":3,"belowMinimum":false,"complete":true}'::jsonb, '{"privacy":true,"privacyAt":null,"marketing":true,"marketingAt":null}'::jsonb, 'reviewing', '김선우', null, null, null),
  ('INQ-2026-0141', 'individual', now() - interval '40 hours', now() - interval '40.02 hours', '{"name":"윤소미","email":"somi.yoon@example.com","phone":"010-2263-5504"}'::jsonb, '{"ind_timing":"undecided","ind_purpose":"unsure","ind_amount":"100m_300m","ind_loss_reaction":"cannot_imagine","ind_experience":"fund_etf","ind_dependency":"slightly","ind_withdrawal":"maybe","ind_avoid":["unsure"],"ind_freetext":null}'::jsonb, '{"tier":"stableSeeking","score":26,"breakdown":[{"questionId":"ind_timing","label":"이 돈을 언제쯤 쓰실 계획인가요?","points":10,"maxScore":30,"usedDefault":false},{"questionId":"ind_loss_reaction","label":"1년 뒤에 맡긴 돈이 100만 원 중 85만 원으로 줄어 있다면, 어떻게 하시겠어요?","points":8,"maxScore":35,"usedDefault":false},{"questionId":"ind_experience","label":"지금까지 투자해 보신 경험은 어느 정도인가요?","points":8,"maxScore":20,"usedDefault":false},{"questionId":"ind_dependency","label":"지금 이 돈이 없어도 생활에는 문제가 없나요?","points":-8,"maxScore":0,"usedDefault":false},{"questionId":"ind_withdrawal","label":"중간에 일부를 빼야 할 일이 생길 수도 있나요?","points":8,"maxScore":15,"usedDefault":false}],"unsureCount":4,"amountTierIndex":2,"belowMinimum":false,"complete":true}'::jsonb, '{"privacy":true,"privacyAt":null,"marketing":false,"marketingAt":null}'::jsonb, 'reviewing', null, null, null, null),
  ('INQ-2026-0145', 'individual', now() - interval '30 hours', now() - interval '30.02 hours', '{"name":"노민석","email":"minseok.noh@example.com","phone":"010-5580-6627"}'::jsonb, '{"ind_timing":"over_10y","ind_purpose":"surplus","ind_amount":"over_1b","ind_loss_reaction":"add_more","ind_experience":"diverse","ind_holdings":["global_equity","other"],"ind_avoid":["none"],"ind_freetext":"기존에 다른 곳에 일임을 맡기고 있는데 옮길지 고민 중입니다."}'::jsonb, '{"tier":"aggressive","score":93,"breakdown":[{"questionId":"ind_timing","label":"이 돈을 언제쯤 쓰실 계획인가요?","points":30,"maxScore":30,"usedDefault":false},{"questionId":"ind_loss_reaction","label":"1년 뒤에 맡긴 돈이 100만 원 중 85만 원으로 줄어 있다면, 어떻게 하시겠어요?","points":35,"maxScore":35,"usedDefault":false},{"questionId":"ind_experience","label":"지금까지 투자해 보신 경험은 어느 정도인가요?","points":20,"maxScore":20,"usedDefault":false},{"questionId":"ind_withdrawal","label":"중간에 일부를 빼야 할 일이 생길 수도 있나요?","points":8,"maxScore":15,"usedDefault":true}],"unsureCount":0,"amountTierIndex":4,"belowMinimum":false,"complete":true}'::jsonb, '{"privacy":true,"privacyAt":null,"marketing":true,"marketingAt":null}'::jsonb, 'reviewing', '김선우', null, null, null),
  ('INQ-2026-0142', 'individual', now() - interval '3 hours', now() - interval '3.02 hours', '{"name":"임재현","email":"jaehyun.lim@example.com","phone":"010-8834-2019"}'::jsonb, '{"ind_timing":"3_to_10y","ind_purpose":"unsure","ind_amount":"100m_300m","ind_loss_reaction":"withdraw_all","ind_experience":"fund_etf","ind_dependency":"living_expenses","ind_avoid":["any_loss"],"ind_freetext":"당장 생활비로 쓸 돈이긴 한데 그냥 두기는 아까워서요."}'::jsonb, '{"tier":"stable","score":14,"breakdown":[{"questionId":"ind_timing","label":"이 돈을 언제쯤 쓰실 계획인가요?","points":18,"maxScore":30,"usedDefault":false},{"questionId":"ind_loss_reaction","label":"1년 뒤에 맡긴 돈이 100만 원 중 85만 원으로 줄어 있다면, 어떻게 하시겠어요?","points":0,"maxScore":35,"usedDefault":false},{"questionId":"ind_experience","label":"지금까지 투자해 보신 경험은 어느 정도인가요?","points":8,"maxScore":20,"usedDefault":false},{"questionId":"ind_dependency","label":"지금 이 돈이 없어도 생활에는 문제가 없나요?","points":-20,"maxScore":0,"usedDefault":false},{"questionId":"ind_withdrawal","label":"중간에 일부를 빼야 할 일이 생길 수도 있나요?","points":8,"maxScore":15,"usedDefault":true}],"unsureCount":1,"amountTierIndex":2,"belowMinimum":false,"complete":true}'::jsonb, '{"privacy":true,"privacyAt":null,"marketing":false,"marketingAt":null}'::jsonb, 'new', null, null, null, null),
  ('INQ-2026-0143', 'corporate', now() - interval '1.5 hours', now() - interval '1.52 hours', '{"name":"서지우","email":"jiwoo.seo@example.com","phone":"031-908-7245","companyName":"(주)유림테크","title":"경영지원팀 대리"}'::jsonb, '{"corp_fund_type":"operating_surplus","corp_horizon":"1_to_3y","corp_amount":"500m_2b","corp_loss_tolerance":"temporary_ok","corp_decision":"ceo","corp_reporting":"quarterly","corp_restrictions":"none","corp_freetext":null}'::jsonb, '{"tier":"neutral","score":null,"breakdown":[],"unsureCount":0,"amountTierIndex":1,"belowMinimum":false,"complete":true}'::jsonb, '{"privacy":true,"privacyAt":null,"marketing":true,"marketingAt":null}'::jsonb, 'new', null, null, null, null),
  ('INQ-2026-0144', 'individual', now() - interval '6 hours', now() - interval '6.02 hours', '{"name":"한여울","email":"yeoul.han@example.com","phone":"010-6672-4438"}'::jsonb, '{"ind_timing":"over_10y","ind_purpose":"retirement","ind_amount":"100m_300m","ind_loss_reaction":"wait","ind_experience":"direct_stock","ind_holdings":["deposit","kr_equity"],"ind_avoid":[],"ind_freetext":null}'::jsonb, '{"tier":"active","score":71,"breakdown":[{"questionId":"ind_timing","label":"이 돈을 언제쯤 쓰실 계획인가요?","points":30,"maxScore":30,"usedDefault":false},{"questionId":"ind_loss_reaction","label":"1년 뒤에 맡긴 돈이 100만 원 중 85만 원으로 줄어 있다면, 어떻게 하시겠어요?","points":18,"maxScore":35,"usedDefault":false},{"questionId":"ind_experience","label":"지금까지 투자해 보신 경험은 어느 정도인가요?","points":15,"maxScore":20,"usedDefault":false},{"questionId":"ind_withdrawal","label":"중간에 일부를 빼야 할 일이 생길 수도 있나요?","points":8,"maxScore":15,"usedDefault":true}],"unsureCount":0,"amountTierIndex":2,"belowMinimum":false,"complete":true}'::jsonb, '{"privacy":true,"privacyAt":null,"marketing":true,"marketingAt":null}'::jsonb, 'new', null, null, null, null),
  ('INQ-2026-0146', 'individual', now() - interval '360 hours', now() - interval '360.02 hours', '{"name":"배수아","email":"sua.bae@example.com","phone":"010-3049-8871"}'::jsonb, '{"ind_timing":"within_3y","ind_purpose":"house","ind_amount":"30m_100m","ind_loss_reaction":"withdraw_all","ind_experience":"savings_only","ind_withdrawal":"maybe","ind_avoid":["any_loss"],"ind_freetext":null}'::jsonb, '{"tier":"stable","score":8,"breakdown":[{"questionId":"ind_timing","label":"이 돈을 언제쯤 쓰실 계획인가요?","points":0,"maxScore":30,"usedDefault":false},{"questionId":"ind_loss_reaction","label":"1년 뒤에 맡긴 돈이 100만 원 중 85만 원으로 줄어 있다면, 어떻게 하시겠어요?","points":0,"maxScore":35,"usedDefault":false},{"questionId":"ind_experience","label":"지금까지 투자해 보신 경험은 어느 정도인가요?","points":0,"maxScore":20,"usedDefault":false},{"questionId":"ind_withdrawal","label":"중간에 일부를 빼야 할 일이 생길 수도 있나요?","points":8,"maxScore":15,"usedDefault":false}],"unsureCount":0,"amountTierIndex":1,"belowMinimum":true,"complete":true}'::jsonb, '{"privacy":true,"privacyAt":null,"marketing":false,"marketingAt":null}'::jsonb, 'closed', '이현주', now() - interval '356 hours', 'unreachable', '3회 통화 시도, 회신 없음.'),
  ('INQ-2026-0147', 'corporate', now() - interval '336 hours', now() - interval '336.02 hours', '{"name":"문경호","email":"kh.moon@example.com","phone":"054-772-1130","companyName":"세림영농조합법인","title":"전무"}'::jsonb, '{"corp_fund_type":"endowment","corp_horizon":"over_3y","corp_amount":"2b_10b","corp_loss_tolerance":"temporary_ok","corp_decision":"board","corp_reporting":"quarterly","corp_restrictions":"none","corp_freetext":null}'::jsonb, '{"tier":"active","score":null,"breakdown":[],"unsureCount":0,"amountTierIndex":2,"belowMinimum":false,"complete":true}'::jsonb, '{"privacy":true,"privacyAt":null,"marketing":false,"marketingAt":null}'::jsonb, 'closed', '이현주', now() - interval '332 hours', 'customerHold', '내년 예산 확정 후 재검토하겠다는 회신. 내년 1월 재연락 예정.');

-- 동의 시각을 접수 시각으로 맞춘다
update inquiries set consents = jsonb_set(
  jsonb_set(consents, '{privacyAt}', to_jsonb(submitted_at)),
  '{marketingAt}',
  case when consents->>'marketing' = 'true' then to_jsonb(submitted_at) else 'null'::jsonb end
);

-- 메모
insert into memos (inquiry_id, at, author, body) values
  ('INQ-2026-0128', now() - interval '498 hours', '김선우', '통화 완료. 퇴직 시점과 연금 수령 시기를 함께 보기로 했음.'),
  ('INQ-2026-0128', now() - interval '470 hours', '김선우', '대면 상담 후 계약 진행.'),
  ('INQ-2026-0131', now() - interval '400 hours', '김선우', '2년 내 전세 자금. 원금 보전이 최우선이라 일임은 부적합하다고 안내.'),
  ('INQ-2026-0134', now() - interval '256 hours', '이현주', '평가손실 불가 조건이라 안정형 고정. 이사회 승인 일정은 다음 달 셋째 주.'),
  ('INQ-2026-0136', now() - interval '208 hours', '김선우', '기존 보유가 국내외 주식에 몰려 있어 중복 회피가 상담 주제. 자료 준비 중.'),
  ('INQ-2026-0138', now() - interval '92 hours', '이현주', '경험이 전무해 설명 시간을 넉넉히 잡아야 함. 결과지 발송했고 통화 대기.'),
  ('INQ-2026-0140', now() - interval '66 hours', '김선우', '자유 입력에 부분 인출 필요가 적혀 있음. 결과지 발송 전에 통화로 확인 필요.'),
  ('INQ-2026-0145', now() - interval '26 hours', '김선우', '타사 이관 검토 건. 금액대가 커서 우선 처리.'),
  ('INQ-2026-0146', now() - interval '340 hours', '이현주', '부재중 3회. 문자 안내 후 종료 처리.'),
  ('INQ-2026-0147', now() - interval '320 hours', '이현주', '조합 총회 일정 때문에 연내 진행 불가. 보류.');

-- 열람 기록 (PRD §10 접근 통제)
insert into audit_log (at, actor, action, inquiry_id, detail) values
  (now() - interval '0.4 hours', '김선우', 'login', null, null),
  (now() - interval '0.3 hours', '김선우', 'viewList', null, '상태=신규'),
  (now() - interval '0.2 hours', '김선우', 'viewDetail', 'INQ-2026-0142', null),
  (now() - interval '1.1 hours', '이현주', 'login', null, null),
  (now() - interval '1 hours', '이현주', 'viewDetail', 'INQ-2026-0143', null),
  (now() - interval '26 hours', '김선우', 'changeStatus', 'INQ-2026-0145', '신규 → 검토중'),
  (now() - interval '66 hours', '김선우', 'changeStatus', 'INQ-2026-0140', '신규 → 검토중'),
  (now() - interval '68 hours', '이현주', 'sendReport', 'INQ-2026-0139', '결과지 발송 (고정 서식)'),
  (now() - interval '90 hours', '이현주', 'sendReport', 'INQ-2026-0138', '결과지 발송 (고정 서식)'),
  (now() - interval '212 hours', '김선우', 'sendReport', 'INQ-2026-0136', '결과지 발송 (고정 서식)'),
  (now() - interval '340 hours', '이현주', 'changeStatus', 'INQ-2026-0146', '상담 진행 → 종료 (연락 불가)'),
  (now() - interval '470 hours', '김선우', 'changeStatus', 'INQ-2026-0128', '상담 진행 → 종료 (계약)');
