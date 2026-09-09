# 투자문의 진단 위저드

투자일임사 홈페이지의 투자 문의 페이지. 투자를 잘 모르는 사람도 질문에 답하는 것만으로
자기에게 필요한 것이 무엇인지 알고 문의를 마칠 수 있게 하는 화면입니다.

**`practice` 브랜치 — Supabase를 백엔드로 붙인 버전입니다.**
`main` 브랜치는 메모리에만 저장하던 목업입니다.

---

## 처음 한 번만: Supabase 붙이기

### 1. 프로젝트 만들기

[supabase.com](https://supabase.com)에서 프로젝트를 하나 만듭니다.

- **Region은 `Northeast Asia (Seoul)`** 을 고르세요. 한국에서 접속할 때 빨라집니다.
- Database Password는 아무거나 정하고 어딘가 적어두세요. 지금 당장 쓰지는 않습니다.

### 2. 표 만들기

대시보드 왼쪽 **SQL Editor** → New query 에 아래 두 파일을 **순서대로** 붙여넣고 실행합니다.

1. [`supabase/schema.sql`](supabase/schema.sql) — 표를 만듭니다
2. [`supabase/seed.sql`](supabase/seed.sql) — 문항 18개, 전략군 5개, 연습용 문의 14건을 채웁니다

`Success. No rows returned`가 나오면 된 것입니다.

### 3. 열쇠 두 개 가져오기

대시보드 **Project Settings → API** 에서 두 값을 복사합니다.

| 화면에 표시된 이름 | 넣을 곳 |
|---|---|
| Project URL | `SUPABASE_URL` |
| `service_role` secret | `SUPABASE_SERVICE_ROLE_KEY` |

> ⚠ `service_role` 키는 모든 접근 제한을 통과합니다. 채팅·이메일·GitHub 어디에도
> 올리지 마세요. 아래 `.env.local`은 git에 올라가지 않게 돼 있습니다.

### 4. `.env.local` 만들기

프로젝트 폴더에 `.env.local` 파일을 만들고 [`.env.example`](.env.example)을 복사해
값만 채웁니다.

```
NEXT_PUBLIC_API_BASE_URL=/api/v1
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
STAFF_DEV_PASSWORD=advisory
```

### 5. 확인

```bash
npm run dev
```

http://localhost:3000/api/v1/_health 를 열어봅니다. 이렇게 나오면 연결된 것입니다.

```json
{ "ok": true, "data": { "supabase": "connected", "questions": { "individual": 10, "corporate": 8 } } }
```

설정이 없으면 화면에 **"Supabase 설정이 아직 없습니다"** 라고 뜹니다. 무엇이 빠졌는지
알려주니 당황하지 않으셔도 됩니다.

---

## 실행

```bash
npm run dev
```

| 경로 | 화면 | PRD |
|---|---|---|
| `/` | 문의 시작 | 01 |
| `/inquiry` | 위저드 — 구분 · 질문 · 연락처 · 인증 · 결과 | 02~08 |
| `/privacy` | 개인정보처리방침 | 09 |
| `/admin/login` | 담당자 로그인 | 10 |
| `/admin/inquiries` | 문의 목록 | 11 |
| `/admin/inquiries/[id]` | 문의 상세 · 결과지 발송 | 12 |

## 문서

| | |
|---|---|
| [docs/api-spec.md](docs/api-spec.md) | **API 명세 v1.** 화면은 이 명세대로만 호출합니다 |
| [docs/트러블슈팅.md](docs/트러블슈팅.md) | 막혔던 문제 6건과 해결 과정, 추가로 시도한 것들 |
| [docs/회고.md](docs/회고.md) | 배운 점 · 아쉬운 점 · 남은 과제 |
| [docs/mock-data.md](docs/mock-data.md) | 연습용 문의 14건이 어떤 경우를 덮는지 |
| [supabase/schema.sql](supabase/schema.sql) | 표 구조 |

---

## 전체 흐름

손님이 답을 입력하면 데이터가 이렇게 흘러갑니다.

```
        ┌──────────────────────────────────────────┐
        │            브라우저 (손님)                │
        │   질문에 답 → 연락처 → 인증 → 결과 확인    │
        │                                          │
        │   답하는 중인 내용은 브라우저에만 있음      │
        │   (동의 전 서버에 쌓지 않기 위해)          │
        └────────────────┬─────────────────────────┘
                         │
                    HTTPS │ ① 접수 요청 (한 번에 전송)
                         ▼
        ┌──────────────────────────────────────────┐
        │      Next.js 서버  (Vercel에서 실행)      │
        │      src/app/api/v1/[...path]/route.ts   │
        │                                          │
        │   · 유형 판정 계산  (§7)                  │
        │   · 인증번호 발급·확인                    │
        │   · 배점은 여기서만 다룸 → 밖으로 안 나감  │
        └────────────────┬─────────────────────────┘
                         │
      service_role 열쇠  │ ② 저장 · 조회
                         ▼
        ┌──────────────────────────────────────────┐
        │        Supabase  (PostgreSQL)            │
        │                                          │
        │   inquiries   문의 내용 · 판정 결과        │
        │   questions   질문 문항                   │
        │   choices     선택지 · 배점               │
        │   audit_log   누가 언제 무엇을 열람했나    │
        │                                          │
        │   모든 표에 잠금(RLS) → 서버만 접근 가능   │
        └──────────────────────────────────────────┘
                         ▲
                         │ ③ 담당자가 목록·상세 조회
        ┌────────────────┴─────────────────────────┐
        │        담당자 화면  /admin/inquiries      │
        │   목록 · 상세 · 판정 근거 · 결과지 발송    │
        └──────────────────────────────────────────┘
```

**브라우저가 Supabase를 직접 부르지 않는 이유**

가운데 서버를 반드시 거치게 만들었습니다. 두 가지 때문입니다.

1. **배점이 새면 진단이 무의미해집니다.** 선택지마다 몇 점인지가 브라우저에 보이면
   "어떻게 답해야 공격투자형이 나오는지"를 알 수 있습니다. 배점은 서버 안에만 둡니다.
2. **백엔드를 바꿀 때 화면을 안 고칩니다.** 화면은 `docs/api-spec.md` 규격대로만 부르므로,
   저장 방식을 갈아도 화면 코드는 그대로입니다. 실제로 메모리 → Supabase로 바꿀 때
   화면을 한 줄도 고치지 않았습니다.

---

## 구조

```
src/
  app/
    api/v1/[...path]/route.ts   API 서버 (명세 v1 구현)
    inquiry/                    고객 위저드
    admin/                      담당자 화면
  components/                   화면 조각
  lib/
    api/types.ts                API 계약 타입 — 화면은 이것만 본다
    api/client.ts               API 클라이언트 — 화면은 fetch를 직접 부르지 않는다
    wizard/branching.ts         조건부 문항 분기 (브라우저 쪽)
    domain/catalog.ts           문항·전략군의 서버 쪽 모양
    domain/scoring.ts           유형 판정 로직 (PRD §7)
    db/                         Supabase 접근
    mock/                       seed.sql을 만드는 원본 데이터 (실행 중에는 안 쓰임)
supabase/
  schema.sql                    표 만들기
  seed.sql                      ⚠ 자동 생성 — 직접 고치지 마세요
scripts/generate-seed.ts        seed.sql 생성기 (npm run seed:gen)
```

**지켜야 할 경계 두 가지.**

화면 코드는 `src/lib/db`와 `src/lib/mock`을 **절대 import하지 않습니다.** `src/lib/api`만
봅니다. 이 경계가 지켜져야 백엔드를 갈아끼울 때 화면을 고치지 않습니다.

브라우저는 Supabase를 **직접 부르지 않습니다.** 항상 `/api/v1`을 거칩니다. 그래야
배점(`choices.score`)이 새지 않고, 고객 정보가 클라이언트 키로 조회되지 않습니다.

---

## 문구를 고치고 싶을 때

문항 문장, 선택지, 전략군 설명, 금액 구간은 **전부 Supabase 표에 있습니다.**
코드를 고치고 다시 배포할 필요 없이 대시보드 **Table Editor**에서 바로 고치면 됩니다.

| 고치고 싶은 것 | 표 |
|---|---|
| 질문 문장 | `questions.prompt` |
| 선택지 문구 | `choices.label` |
| 금액 구간 (§15-1) | `amount_tiers` |
| 위험도 등급 이름 (§15-2) | `risk_tiers.label` |
| 전략군 설명 | `strategies` |
| 면책 문구 (§15-4) | `app_config.disclaimer` |
| 배점 | `choices.score`, `risk_tiers.min_score/max_score` |

고친 내용은 최대 1분 뒤에 화면에 반영됩니다(서버가 잠깐 기억해 두기 때문).

`src/lib/mock`의 값을 고쳐서 `npm run seed:gen`으로 `seed.sql`을 다시 뽑는 방법도
있지만, 그건 표를 처음부터 다시 채울 때만 쓰세요.

---

## 지금 붙지 않은 것

| | 지금 | 나중에 |
|---|---|---|
| **이메일 발송** | 인증번호를 화면에 띄웁니다 | 발송 서비스 연동 |
| **결과지 PDF** | 미리보기만 | 서버에서 PDF 생성 |
| **담당자 로그인** | 공통 비밀번호 하나 | 계정별 비밀번호 해시 |
| **개인정보 암호화** | 평문으로 저장 | 저장 시 암호화 |

담당자 화면은 **로그인하지 않아도 열립니다.** 클라이언트가 `X-Mock-Actor` 헤더로
담당자를 흉내내기 때문입니다. 실제 서비스로 갈 때 `src/lib/api/client.ts`의 그 부분과
`route.ts`의 `currentStaff()`에서 헤더 분기를 지워야 합니다.

## 실제 고객을 받기 전에 반드시

지금은 **가상 데이터로 연습하는 단계**입니다. 진짜 문의를 받기 시작하면 아래를 먼저
정리해야 합니다.

1. 개인정보(이름·이메일·연락처) 저장 시 암호화 — 지금은 평문입니다
2. 담당자 비밀번호를 계정별 해시로
3. `X-Mock-Actor` 우회 경로 제거
4. 화면에 인증번호를 띄우는 부분 제거 + 실제 메일 발송
5. PRD §15의 법률 확인 8건 + **클라우드 이용 절차** (금융회사가 해외 클라우드에
   개인정보를 두는 것에는 별도 절차가 따릅니다)

---

## 아직 임시값인 것

| 값 | PRD | 지금 | 어디서 고치나 |
|---|---|---|---|
| 최소 가입금액 | §15-1 | 1억 원 | `app_config.minimum_amount_krw` |
| 금액 구간 | §15-1 | 3천만/1억/3억/10억 | `amount_tiers` |
| 전략군 이름 | §15-2 | `원금 지키기 중심` 등 | `strategies.name` |
| 상호·등록번호, 손실 경고 | §15-6 | 화면에 `[PLACEHOLDER]` | 코드 |
| 개인정보 보유기간·위탁 | §15-5 | `/privacy`에 `[PLACEHOLDER]` | 코드 |

전략군 설명에는 숫자가 하나도 없습니다. 예상 수익률·자산 비중·최대 낙폭은
PRD §3 원칙 3에 따라 넣지 않았고, 문구를 손볼 때도 넣지 않아야 합니다.
