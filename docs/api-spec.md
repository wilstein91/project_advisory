# 투자문의 진단 위저드 — API 명세 v1

이 문서가 프론트엔드와 백엔드 사이의 계약입니다. 목업 화면은 전부 이 명세대로만
호출하므로, 실제 백엔드가 이 명세를 지키면 프론트엔드는 손대지 않고 붙습니다.

PRD 조항을 `§n`으로 참조합니다.

---

## 1. 공통

### 1.1 기본

| | |
|---|---|
| Base URL | `/api/v1` (프론트엔드 환경변수 `NEXT_PUBLIC_API_BASE_URL`) |
| 형식 | 요청·응답 모두 `application/json; charset=utf-8` |
| 시각 | ISO 8601 UTC — `2026-09-04T01:22:31.000Z` |
| 금액 | 원 단위 정수. 소수점·문자열 금지 |
| 언어 | 한국어 고정 (§13 다국어 제외) |

### 1.2 응답 봉투

성공은 항상 `ok: true`와 `data`를 함께 보냅니다.

```json
{ "ok": true, "data": { } }
```

실패는 `ok: false`와 `error`를 보냅니다. HTTP 상태코드도 함께 맞춥니다.

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "이메일 주소를 확인해 주세요.",
    "fields": { "email": "형식이 올바르지 않습니다." }
  }
}
```

`message`는 **화면에 그대로 노출**됩니다. 개발자용 문구가 아니라 고객이 읽을
문장을 보내주세요. 무엇이 잘못됐고 어떻게 고치는지가 들어가야 합니다.

### 1.3 에러 코드

| code | HTTP | 의미 |
|---|---|---|
| `VALIDATION_FAILED` | 400 | 입력값 오류. `fields`에 항목별 사유 |
| `CONSENT_REQUIRED` | 400 | 개인정보 수집·이용 필수 동의 누락 (§11) |
| `VERIFICATION_REQUIRED` | 401 | 이메일 인증 토큰 없음 또는 만료 |
| `VERIFICATION_FAILED` | 400 | 인증번호 불일치. `data.attemptsLeft` 동봉 |
| `VERIFICATION_LOCKED` | 429 | 입력 횟수 초과. 재발송 필요 |
| `UNAUTHORIZED` | 401 | 담당자 로그인 필요 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `NOT_FOUND` | 404 | 대상 없음 |
| `CONFLICT` | 409 | 이미 처리된 건 (예: 재발송) |
| `RATE_LIMITED` | 429 | 호출 횟수 초과 |
| `INTERNAL` | 500 | 서버 오류 |

### 1.4 인증

**고객 엔드포인트**는 로그인이 없습니다. 다만 접수(`POST /inquiries`)만은
이메일 인증으로 받은 토큰이 필요합니다.

```
X-Verification-Token: <인증 확인 시 받은 토큰>
```

**담당자 엔드포인트**(`/staff/*`)는 세션 쿠키 또는 Bearer 토큰을 씁니다.

```
Authorization: Bearer <token>
```

목업 서버는 위 대신 `X-Mock-Actor: 김선우` 헤더로 담당자를 흉내냅니다.
실제 백엔드가 붙으면 이 헤더는 무시하고 세션에서 가져오면 됩니다.

### 1.5 페이징

목록 응답은 전부 같은 모양입니다.

```json
{ "items": [], "page": 1, "size": 20, "total": 14 }
```

요청은 `?page=1&size=20`. `size` 최대 100.

### 1.6 호출 제한

| 대상 | 제한 |
|---|---|
| `POST /email-verifications` | 이메일당 5분에 3회, IP당 시간당 20회 |
| `POST /inquiries` | IP당 시간당 10회 |
| 나머지 고객 엔드포인트 | IP당 분당 60회 |

### 1.7 백엔드가 반드시 지켜야 할 것

PRD에서 온 제약이라 구현 편의로 바꿀 수 없는 항목입니다.

1. **미완료 답변을 저장하지 않는다** (§11). 진행 중인 답은 브라우저에만 있고,
   접수 시점에 한 번 들어옵니다. 문항을 넘길 때마다 서버에 쌓는 설계는 동의 없는
   수집이 됩니다.
2. **인증번호를 응답에 넣지 않는다.** 목업만 예외이며 이유는 §4.5에 적었습니다.
3. **필수 동의와 선택 동의를 따로 저장한다** (§11). 각각 동의 시각을 남깁니다.
   선택 동의 없이도 접수는 정상 처리됩니다.
4. **진단 결과에 숫자를 넣지 않는다** (§3 원칙 3). 예상 수익률, 목표 수익률,
   자산 비중, 최대 낙폭, 과거 성과 — 어떤 응답 필드로도 내려보내지 않습니다.
   `strategy` 객체에 숫자 필드를 추가하지 마세요.
5. **결과지는 담당자가 발송 버튼을 눌러야 나간다** (§9). 접수 시점에 자동 발송하는
   경로를 만들지 않습니다.
6. **담당자의 열람·발송·상태변경을 전부 기록한다** (§10).

---

## 2. 열거형

```ts
segment       : "individual" | "corporate"
riskTier      : "stable" | "stableSeeking" | "neutral" | "active" | "aggressive"
inquiryStatus : "new" | "reviewing" | "reportSent" | "consulting" | "closed"
closeReason   : "contracted" | "belowMinimum" | "unreachable" | "customerHold" | "other"
questionKind  : "single" | "multi" | "amount" | "text"
conditionOp   : "eq" | "in" | "amountTierAtLeast"
auditAction   : "login" | "viewList" | "viewDetail" | "sendReport" | "changeStatus"
```

한글 표시 이름은 서버가 `GET /config`로 내려줍니다. 프론트엔드에 하드코딩하지
않습니다 — §15-2에서 등급 이름이 바뀔 수 있습니다.

---

## 3. 공통 객체

### 3.1 Question

```json
{
  "id": "ind_timing",
  "segment": "individual",
  "order": 1,
  "kind": "single",
  "prompt": "이 돈을 언제쯤 쓰실 계획인가요?",
  "help": "대략적인 범위만 골라주시면 됩니다.",
  "optional": false,
  "maxLength": null,
  "choices": [
    { "value": "within_3y", "label": "3년 안에", "isUnsure": false, "tierIndex": null, "notice": null }
  ],
  "showWhen": {
    "all": [{ "questionId": "ind_purpose", "op": "eq", "value": "unsure" }],
    "any": null
  }
}
```

| 필드 | 설명 |
|---|---|
| `choices[].isUnsure` | "잘 모르겠습니다" 계열. 담당자 화면 모름 집계에 쓰임 (§3 원칙 1) |
| `choices[].tierIndex` | `kind: "amount"`일 때만. 금액 구간 순서 |
| `choices[].notice` | 선택 즉시 화면에 뜨는 안내. 최소금액 미달 문구가 여기 (§5-Q3) |
| `showWhen` | 없으면(`null`) 항상 표시. `all`은 전부, `any`는 하나만 만족하면 표시 |

**점수는 내려보내지 않습니다.** 배점(§7)은 서버 안에만 있습니다. 브라우저 개발자
도구로 "어떻게 답해야 공격투자형이 나오는지" 알 수 있으면 진단이 무의미해집니다.

### 3.2 Diagnosis

```json
{
  "tier": "neutral",
  "tierLabel": "위험중립형",
  "tierSummary": "오르내림을 어느 정도 감안하고 균형을 찾는 편입니다.",
  "complete": true,
  "unsureCount": 0,
  "amountTierIndex": 2,
  "amountLabel": "1억 원 ~ 3억 원",
  "belowMinimum": false
}
```

| 필드 | 설명 |
|---|---|
| `complete` | 보여야 하는 필수 문항이 다 찼는지. **`false`면 결과 화면을 띄우지 않습니다.** 답이 덜 찬 상태에서도 서버는 유형을 계산할 수 있지만 그 값은 틀렸습니다 |
| `unsureCount` | 모름 응답 수 |
| `belowMinimum` | 최소 가입금액 미달 (§5-Q3). 거절이 아니라 안내용 |

`score`와 `breakdown`(문항별 점수 내역)은 **담당자 응답에만** 들어갑니다.
고객 응답에는 넣지 않습니다.

### 3.3 Strategy

```json
{
  "tier": "neutral",
  "name": "균형 잡힌 글로벌 배분",
  "description": "오르내리는 자산과 안정적인 자산을 나라와 종류를 나눠 함께 담습니다. …",
  "volatilityNote": "해에 따라 눈에 띄게 줄어든 구간을 지나갈 수 있습니다.",
  "suitableFor": "기간을 두고 맡길 수 있고, 오르내림을 지켜볼 수 있는 분에게 맞습니다."
}
```

숫자 필드가 없습니다. 추가하지 마세요 (§1.7-4).

---

## 4. 고객 엔드포인트

### 4.1 `GET /api/v1/config`

화면이 시작할 때 한 번 부릅니다. 라벨과 기준값을 전부 여기서 받습니다.

**응답 `data`**

```json
{
  "minimumAmountKrw": 100000000,
  "belowMinimumNotice": "이 금액대는 일임 계약 기준에는 조금 못 미치지만, …",
  "amountTiers": {
    "individual": [
      { "value": "under_30m", "label": "3천만 원 미만", "tierIndex": 0, "belowMinimum": true }
    ],
    "corporate": []
  },
  "labels": {
    "tier": { "stable": "안정형", "stableSeeking": "안정추구형", "neutral": "위험중립형", "active": "적극투자형", "aggressive": "공격투자형" },
    "status": { "new": "신규", "reviewing": "검토중", "reportSent": "결과지 발송", "consulting": "상담 진행", "closed": "종료" },
    "closeReason": { "contracted": "계약", "belowMinimum": "금액 미달", "unreachable": "연락 불가", "customerHold": "고객 보류", "other": "기타" }
  },
  "disclaimer": "이 안내는 참고용이며, 계약 단계에서 별도로 진행되는 적합성 진단을 대체하지 않습니다.",
  "reportSlaHours": 24,
  "verification": { "codeLength": 6, "ttlSeconds": 600, "maxAttempts": 5 }
}
```

`disclaimer`는 결과 화면과 결과지에 반드시 함께 나갑니다 (§7). 프론트엔드가
문장을 가지고 있지 않고 서버에서 받는 이유는, §15-4 확인 후 문구가 바뀔 때
배포 없이 고치기 위해서입니다.

### 4.2 `GET /api/v1/questions?segment={segment}`

**쿼리** `segment` 필수 — `individual` | `corporate`

**응답 `data`**

```json
{ "segment": "individual", "questions": [] }
```

분기 규칙(`showWhen`)을 그대로 내려주므로 다음 문항은 화면에서 정합니다.
문항을 넘길 때마다 서버를 부르지 않습니다.

### 4.3 `GET /api/v1/strategies`

**응답 `data`**

```json
{ "strategies": [], "disclaimer": "…" }
```

전략군 5개(등급 수만큼). 고객이 결과를 보기 전에도 부를 수 있습니다.

### 4.4 `POST /api/v1/diagnosis/preview`

답변으로 유형을 계산합니다. **아무것도 저장하지 않습니다.**

**요청**

```json
{
  "segment": "individual",
  "answers": {
    "ind_timing": "3_to_10y",
    "ind_purpose": "retirement",
    "ind_holdings": ["kr_equity", "bond"],
    "ind_freetext": null
  }
}
```

`answers`는 문항 id를 키로 하는 객체입니다. 단일 선택은 문자열, 복수 선택은
문자열 배열, 자유 입력은 문자열, 미응답은 키를 빼거나 `null`.

**응답 `data`**

```json
{
  "diagnosis": { },
  "strategy": { },
  "disclaimer": "…",
  "visibleQuestionIds": ["ind_timing", "ind_purpose", "ind_amount"]
}
```

`visibleQuestionIds`는 지금 답변 상태에서 보여야 하는 문항입니다. 화면이 계산한
분기 결과와 서버가 계산한 것이 어긋나는지 확인하는 용도로도 씁니다.

### 4.5 `POST /api/v1/email-verifications`

인증번호를 메일로 보냅니다.

**요청** `{ "email": "hong@example.com" }`

**응답 `data`**

```json
{ "expiresInSeconds": 600, "maxAttempts": 5 }
```

> **목업만의 예외** — 목업 서버는 여기에 `mockCode: "482913"`을 함께 내려줍니다.
> 메일 없이 인증 화면을 테스트하기 위해서입니다. **실제 백엔드는 어떤 경우에도
> 인증번호를 응답에 넣지 않습니다.**

**에러** `RATE_LIMITED` (§1.6)

### 4.6 `POST /api/v1/email-verifications/confirm`

**요청** `{ "email": "hong@example.com", "code": "482913" }`

**성공 응답 `data`**

```json
{ "verificationToken": "vt_9f2c…", "expiresInSeconds": 1800 }
```

이 토큰을 접수 요청 헤더에 넣습니다. 30분 뒤 만료되고, 접수 한 번에 소진됩니다.

**실패 응답**

```json
{
  "ok": false,
  "error": { "code": "VERIFICATION_FAILED", "message": "숫자가 맞지 않습니다. 4번 더 입력할 수 있습니다." },
  "data": { "attemptsLeft": 4 }
}
```

횟수를 다 쓰면 `VERIFICATION_LOCKED` (429). 화면은 재발송 버튼만 남깁니다.

### 4.7 `POST /api/v1/inquiries`

위저드를 마치고 접수합니다. **이 호출이 이 페이지의 전환 지점입니다** (§4-6).

**헤더** `X-Verification-Token: vt_9f2c…` 필수

**요청**

```json
{
  "segment": "individual",
  "contact": {
    "name": "홍길동",
    "email": "hong@example.com",
    "phone": "010-1234-5678",
    "companyName": null,
    "title": null
  },
  "answers": { },
  "consents": {
    "privacy": true,
    "marketing": false
  }
}
```

| 필드 | 규칙 |
|---|---|
| `contact.email` | 인증한 이메일과 같아야 합니다. 다르면 `VALIDATION_FAILED` |
| `contact.companyName` `title` | `segment: "corporate"`일 때만 필수 (§6) |
| `consents.privacy` | `false`면 `CONSENT_REQUIRED`. 접수 불가 |
| `consents.marketing` | `false`여도 정상 접수 (§11) |

주민등록번호·계좌번호·주소·생년월일은 **받지 않습니다** (§11). 요청에 들어오면
서버가 버립니다.

**응답 `201`**

```json
{
  "inquiryId": "INQ-2026-0148",
  "diagnosis": { },
  "strategy": { },
  "disclaimer": "…",
  "reportNotice": "상세 결과지는 담당자 확인 후 영업일 기준 1일 내에 메일로 보내드립니다."
}
```

이 응답이 결과 요약 화면(§8)의 재료입니다. 결과지는 여기서 발송되지 않습니다.

---

## 5. 담당자 엔드포인트

전부 `Authorization` 필요. 없으면 `UNAUTHORIZED`.

### 5.1 `POST /api/v1/staff/session`

**요청** `{ "email": "kim@example.com", "password": "…" }`

**응답 `data`** `{ "token": "…", "staff": { "id": "staff_kim", "name": "김선우", "role": "manager" } }`

계정은 관리자가 직접 만듭니다. 자유 가입 경로는 만들지 않습니다 (§10).

### 5.2 `DELETE /api/v1/staff/session`

**응답** `204`

### 5.3 `GET /api/v1/staff/inquiries`

**쿼리** (전부 선택)

| 이름 | 값 |
|---|---|
| `status` | inquiryStatus |
| `segment` | segment |
| `assignee` | 담당자 이름 |
| `q` | 접수번호·이름·회사명 부분 일치 |
| `minUnsure` | 정수. 모름 응답이 이 수 이상인 건만 |
| `belowMinimum` | `true` \| `false` |
| `page` `size` | 페이징 (§1.5) |

**응답 `data`**

```json
{
  "items": [
    {
      "id": "INQ-2026-0140",
      "submittedAt": "2026-09-01T01:12:00.000Z",
      "segment": "individual",
      "name": "강태오",
      "companyName": null,
      "tier": "active",
      "tierLabel": "적극투자형",
      "amountLabel": "3억 원 ~ 10억 원",
      "belowMinimum": false,
      "unsureCount": 0,
      "status": "reviewing",
      "assignee": "김선우",
      "freeTextPreview": "아이가 둘인데 큰애가 대학 갈 때 일부는 써야 할 것 같습니다.",
      "reportOverdue": true
    }
  ],
  "page": 1, "size": 20, "total": 14,
  "counts": { "new": 3, "reviewing": 3, "reportSent": 2, "consulting": 2, "closed": 4 }
}
```

**정렬은 서버가 정합니다.** `reportOverdue: true`인 건이 맨 위, 그 다음 최근 접수
순입니다 (§9). 프론트엔드가 다시 정렬하지 않습니다.

`freeTextPreview`는 자유 입력란의 첫 줄입니다. 목록에서 어떤 건을 먼저 볼지
판단하는 근거라 목록 응답에 포함합니다.

**부수 효과** 이 호출은 `viewList` 열람 기록을 남깁니다 (§10).

### 5.4 `GET /api/v1/staff/inquiries/{id}`

**응답 `data`**

```json
{
  "inquiry": {
    "id": "INQ-2026-0140",
    "segment": "individual",
    "submittedAt": "…",
    "emailVerifiedAt": "…",
    "contact": { },
    "answers": { },
    "answersDisplay": [
      { "questionId": "ind_timing", "prompt": "이 돈을 언제쯤 쓰실 계획인가요?", "answerLabel": "10년 이상 두고 볼 생각입니다", "isUnsure": false }
    ],
    "diagnosis": {
      "tier": "active",
      "score": 76,
      "breakdown": [
        { "questionId": "ind_timing", "label": "이 돈을 언제쯤 쓰실 계획인가요?", "points": 30, "maxScore": 30, "usedDefault": false }
      ]
    },
    "status": "reviewing",
    "assignee": "김선우",
    "reportSentAt": null,
    "closeReason": null,
    "closeNote": null,
    "consents": { "privacy": true, "privacyAt": "…", "marketing": true, "marketingAt": "…" },
    "memos": [{ "at": "…", "author": "김선우", "body": "…" }]
  },
  "strategy": { },
  "audit": []
}
```

`answersDisplay`는 서버가 문항 문장과 선택지 라벨을 붙여준 형태입니다. 담당자
화면이 문항 정의를 따로 받아서 조립하지 않게 하려는 것입니다.

`diagnosis.score`와 `breakdown`은 **담당자 응답에만** 있습니다. 담당자가 판정을
신뢰하지 못하면 시스템을 우회하기 때문에 근거를 보여줍니다 (§10).

**부수 효과** `viewDetail` 열람 기록.

### 5.5 `PATCH /api/v1/staff/inquiries/{id}`

**요청** (보내는 필드만 바뀝니다)

```json
{ "status": "closed", "assignee": "김선우", "closeReason": "contracted", "closeNote": "…" }
```

| 규칙 | |
|---|---|
| `status: "closed"` | `closeReason`이 없으면 `VALIDATION_FAILED`. 종료 사유는 필수 (§10) |
| `assignee: null` | 배정 해제 |

**응답 `data`** `{ "inquiry": { } }` · **부수 효과** `changeStatus` 열람 기록

### 5.6 `POST /api/v1/staff/inquiries/{id}/memos`

**요청** `{ "body": "통화 완료. 이사회 일정 확인 필요." }`
**응답 `201`** `{ "memo": { "at": "…", "author": "김선우", "body": "…" } }`

### 5.7 `GET /api/v1/staff/inquiries/{id}/report/preview`

발송 전에 담당자가 내용을 확인하는 화면용입니다 (§9).

**응답 `data`**

```json
{
  "sections": [
    { "page": 1, "title": "표지", "lines": ["…"] },
    { "page": 2, "title": "고객님이 답해주신 내용", "lines": ["…"] }
  ],
  "editable": false
}
```

`editable`은 항상 `false`입니다. 서식은 고정이고, 담당자가 문장을 고칠 수 있게
만들면 회사가 통제할 수 없는 문구가 고객에게 나갑니다 (§9).

### 5.8 `POST /api/v1/staff/inquiries/{id}/report`

결과지를 실제로 보냅니다. 담당자가 할 수 있는 일은 보낸다 / 보류한다 /
메모를 남긴다 세 가지뿐입니다.

**요청** 본문 없음
**응답 `data`** `{ "inquiry": { }, "sentAt": "…" }`
**에러** 이미 보냈으면 `CONFLICT` (409)
**부수 효과** `sendReport` 열람 기록

상태가 `new` 또는 `reviewing`이었으면 `reportSent`로 바뀝니다.

### 5.9 `GET /api/v1/staff/audit`

**쿼리** `inquiryId` (선택), `page` `size`

**응답 `data`**

```json
{
  "items": [
    { "at": "…", "actor": "김선우", "action": "sendReport", "inquiryId": "INQ-2026-0139", "detail": "결과지 발송 (고정 서식)" }
  ],
  "page": 1, "size": 20, "total": 12
}
```

---

## 6. 아직 명세하지 않은 것

PRD §13에서 이번 범위 밖으로 뺀 것들입니다. 경로를 미리 잡아두지 않습니다.

- 계약 체결, 전자서명, 계좌 개설
- 고객 로그인·마이페이지
- 수익률 조회
- 상담 일정 예약
- 정식 적합성 진단 (계약 단계에서 별도)
- 휴대폰 본인인증
- 다국어

## 7. 확정되면 명세가 바뀌는 부분

| 무엇 | PRD | 영향 |
|---|---|---|
| 최소 가입금액, 금액 구간 | §15-1 | `GET /config`의 `amountTiers` 값만 바뀝니다. 구조는 그대로 |
| 위험도 등급 개수·이름 | §15-2 | `riskTier` 열거형과 `labels.tier`가 바뀝니다. 5개가 아닐 수 있습니다 |
| 면책 문구 | §15-4 | `disclaimer` 문자열만 바뀝니다 |
| 결과지 서식 | §15-7 | `report/preview`의 `sections` 내용이 바뀝니다 |

등급이 5개가 아닐 수 있으므로 프론트엔드는 `riskTier`를 5개로 가정하고 배열을
만들지 않습니다. `GET /strategies`가 주는 만큼 그립니다.
