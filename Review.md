# AIFFEL Campus Code Peer Review Templete
- 코더 : (프로젝트 작성자 이름을 작성하세요)
- 리뷰어 : (리뷰어 이름을 작성하세요)


# PRT(Peer Review Template)
[x]  **1. 주어진 문제를 해결하는 완성된 코드가 제출되었나요?**
- 문제에서 요구하는 기능이 정상적으로 작동하는지?
    - PRD에 명시된 화면(`/`, `/inquiry`, `/privacy`, `/admin/login`, `/admin/inquiries`, `/admin/inquiries/[id]`)이 [README.md](README.md:76)의 라우트 표대로 전부 실제 파일로 존재하고, 단일 API 라우트 [src/app/api/v1/[...path]/route.ts](src/app/api/v1/%5B...path%5D/route.ts:1) 485줄이 [docs/api-spec.md](docs/api-spec.md) 명세(헬스체크·카탈로그·제출·인증·관리자 목록/상세/리포트)를 그대로 구현하고 있음.
    - [docs/mock-data.md:22](docs/mock-data.md:22)의 시드 생성 스크립트(`npm run seed:gen`)는 14개 픽스처마다 `expectedTier`를 기대값으로 두고, 실제 계산된 진단 결과가 다르면 생성 자체가 실패하도록 만들어 채점 로직과 테스트 데이터를 자동으로 맞물리게 해둠 — 단순 주장이 아닌 근거 있는 검증.
    - [docs/트러블슈팅.md:283](docs/트러블슈팅.md:283)에는 배포된 앱에 대해 실제로 5가지 침투 테스트를 수행한 기록이 있고, `X-Mock-Actor` 헤더 우회로 인증 없이 200과 함께 18건 전체가 노출되는 취약점을 실제로 찾아 미해결로 남겼다고 솔직히 밝힘.
    - 다만 **자동화된 테스트 스위트가 전혀 없음** — [회고.md:125](docs/회고.md:125)에서 "테스트를 자동으로 만들지 않았음"이라 직접 인정했고, `package.json`에도 `test` 스크립트가 없음(`dev`/`build`/`start`/`lint`/`seed:gen`뿐). 이 리뷰 환경에는 `node_modules`가 없어 `npm run lint`/`build`를 직접 재현·검증하지 못했으므로, 정상 동작 여부는 작성자 본인의 기록에 의존한 상태.
    - [README.md:208](README.md:208)에 이메일 발송(화면에 인증코드만 노출), PDF 리포트(미리보기만), 법인 고객 플로우("끝까지 클릭해 보지 못했음", [회고.md:137](docs/회고.md:137)), Rate limiting 미구현 등 미완성 항목을 스스로 목록화해둠.

[x]  **2. 핵심적이거나 복잡하고 이해하기 어려운 부분에 작성된 설명을 보고 해당 코드가 잘 이해되었나요?**
- 해당 코드 블럭에 doc string/annotation/markdown이 달려 있는지 확인
    - [src/lib/domain/scoring.ts:1](src/lib/domain/scoring.ts:1) 파일 상단에 "개인은 점수제, 법인은 표에서 직접 배정한다 / 배점을 바꾸려면 코드가 아니라 choices.score 컬럼을 고치면 된다"는 설계 의도를 명시.
    - [src/app/api/v1/[...path]/route.ts:1](src/app/api/v1/%5B...path%5D/route.ts:1)에 브라우저가 Supabase를 직접 호출하지 않는 이유(점수 로직 유출 방지)를 설명하고 [docs/api-spec.md](docs/api-spec.md)를 참조하도록 링크.
    - [src/lib/api/client.ts:1](src/lib/api/client.ts:1), [src/lib/wizard/branching.ts:1](src/lib/wizard/branching.ts:1)에도 "왜 이렇게 짰는지"를 설명하는 파일 헤더 주석이 있음.
    - [src/components/inquiry/QuestionStep.tsx:28](src/components/inquiry/QuestionStep.tsx:28)의 "문항이 자체 보조 문구를 갖고 있으면 그것만 쓴다 — 같은 말을 두 번 하지 않는다" 주석은 [트러블슈팅.md](docs/트러블슈팅.md) #6 버그 수정(커밋 `85d70e8`)과 직접 연결되어 코드-문서 추적이 잘 됨.
    - [README.md:97](README.md:97)에는 브라우저 → Next.js 서버(채점 경계) → Supabase → 관리자 화면으로 이어지는 전체 흐름을 ASCII 다이어그램으로 그려두고, 브라우저가 Supabase를 직접 호출하지 않는 이유를 두 가지로 근거를 들어 설명.
- 주석을 보고 코드 이해가 잘 되었는지 확인
    - 다만 가장 복잡한 클라이언트 상태 컴포넌트인 [src/components/inquiry/InquiryWizard.tsx](src/components/inquiry/InquiryWizard.tsx)(397줄, 단계 전환/로컬스토리지 임시저장/분기 처리)는 상단 주석 한 줄([:15](src/components/inquiry/InquiryWizard.tsx:15)) 외에는 로직 대비 주석 밀도가 낮아, 파일 규모에 비해 설명이 부족한 편.
    - `@param`/`@returns` 형태의 정식 JSDoc은 없고 의도를 설명하는 산문형 주석 위주 — TS 타입이 시그니처를 어느 정도 대신하긴 하지만 IDE 호버 문서로서의 가치는 제한적.

[x]  **3. 에러가 난 부분을 디버깅하여 “문제를 해결한 기록”을 남겼나요? 또는 “새로운 시도 및 추가 실험”을 해봤나요?**
- 문제 원인 및 해결 과정을 잘 기록하였는지 확인
    - [docs/트러블슈팅.md](docs/트러블슈팅.md) 299줄 전체가 증상→진단 과정→원인→해결→배운 것 구조로 정리된 6건의 이슈 기록이며 코드 위치까지 인용되어 있음:
        1. [:8](docs/트러블슈팅.md:8) 헤더에 한글(`X-Mock-Actor`)을 넣어 조용히 400 발생 → ASCII 전용 제약 발견, `src/lib/api/client.ts`/API 라우트에서 수정.
        2. [:57](docs/트러블슈팅.md:57) Windows curl 인코딩으로 한글 이름이 `?????`로 깨짐 → 앱이 아닌 테스트 도구 문제로 진단.
        3. [:98](docs/트러블슈팅.md:98) Vercel이 `practice`(Supabase) 대신 `main`(메모리 전용) 브랜치를 배포 → `/api/v1/_health`와 `/api/v1/_selfcheck`로 브랜치별 상태를 구분해 진단.
        4. [:150](docs/트러블슈팅.md:150) 콜드 스타트/다중 인스턴스에서 메모리 저장 데이터 유실 → Supabase 이전으로 해결(인증코드까지 이전).
        5. [:181](docs/트러블슈팅.md:181) 간헐적 "JWT issued at future" 에러 → 로컬 시계와 Supabase 서버 시계 오차로 원인 특정.
        6. [:211](docs/트러블슈팅.md:211) 질문 화면 안내 문구 중복 → 수작업 클릭 테스트로만 발견, [src/components/inquiry/QuestionStep.tsx:235](docs/트러블슈팅.md:235) 인용과 함께 수정.
- 문제에서 요구하는 조건에 더해 추가적으로 수행한 나만의 시도, 실험이 기록되어 있는지 확인
    - [:243](docs/트러블슈팅.md:243) "추가로 해 본 것들" 절에 UI보다 API 명세를 먼저 작성(백엔드 교체 시 UI 무변경으로 검증됨), 손으로 쓴 SQL 대신 자체 검증 로직이 있는 시드 생성기 제작, 카피/문구를 DB 테이블로 옮겨 비개발자도 수정 가능하게 함, 5개 항목짜리 수동 보안 침투 테스트([:287](docs/트러블슈팅.md:287))까지 실험적으로 수행한 기록이 있음.
    - 이 항목은 근거가 매우 충실함. 다만 각 기록에 날짜/타임스탬프가 없어 시간순 재구성은 어려움.

[x]  **4. 회고를 잘 작성했나요?**
- 프로젝트 결과물에 대해 배운점과 아쉬운점, 느낀점 등이 상세히 기록 되어 있나요?
    - [docs/회고.md](docs/회고.md) 206줄에 만든 것([:3](docs/회고.md:3)), 배운 점([:18](docs/회고.md:18) — "문서를 먼저 쓰는 게 빠른 길이었음", "내 컴퓨터에서 되니까 됐다가 아니었음", "배포는 코드를 올리는 것 이상이었음"), 잘된 점([:83](docs/회고.md:83)), 아쉬운 점([:104](docs/회고.md:104)), 어려웠던 점([:150](docs/회고.md:150)), 우선순위별 남은 작업 표([:166](docs/회고.md:166)), 마무리 소감([:185](docs/회고.md:185))까지 빠짐없이 구성됨.
    - 특히 [:139](docs/회고.md:139)에서 "코드 대부분을 AI와 함께 만들었다 / '이걸 나 혼자 처음부터 다시 짤 수 있나' 하면 아직 아니라고 답해야 함"이라고 밝힌 솔직한 자기평가가 인상적임.
	- 딥러닝 모델의 경우, 인풋이 들어가 최종적으로 아웃풋이 나오기까지의 전체 흐름을 도식화하여 모델 아키텍쳐에 대한 이해를 돕고 있는지 확인
        - 본 프로젝트는 딥러닝 모델이 아닌 규칙/점수 기반 진단 위저드이므로 해당 사항 없음(N/A). 다만 이에 상응하는 시스템 아키텍처 도식이 [README.md:97](README.md:97)에 상세히 제공되어(브라우저 → Next.js 서버 → Supabase → 관리자 화면, 신뢰 경계 설명 포함) 구조 이해를 충분히 돕고 있음.
    - 남은 작업 표([:166](docs/회고.md:166))에서 관리자 로그인에 인증 게이트 부재, 평문 비밀번호 비교, PII 평문 저장 등 실제 보안 부채를 숨기지 않고 스스로 위험으로 표기해둔 점도 좋은 태도.

[x]  **5. 코드가 간결하고 효율적인가요?**
- 파이썬 스타일 가이드 (PEP8)를 준수하였는지 확인
    - 본 프로젝트는 Python이 아닌 TypeScript/Next.js 프로젝트이므로 PEP8은 해당 사항 없음. 대신 `eslint.config.mjs`가 flat config로 `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`를 확장하고 `.next/`, `out/`, `build/`, `next-env.d.ts`를 적절히 ignore 처리함. 다만 이 리뷰 환경에는 `node_modules`가 없어 `npm run lint`를 직접 실행해 확인하지는 못했음(설정 검토로만 확인).
- 코드 중복을 최소화하고 범용적으로 사용할 수 있도록 모듈화(함수화) 했는지
    - `src/lib/api/`(타입·클라이언트) → `src/lib/domain/`(순수 비즈니스 로직) → `src/lib/db/`(Supabase 접근) → `src/lib/wizard/`(분기 로직)로 계층이 분명히 나뉘어 있고, [README.md:176](README.md:176)에 "화면 코드는 src/lib/db와 src/lib/mock을 절대 import하지 않는다"는 규칙을 명시해둠. 이 규칙 덕분에 실제로 백엔드를 메모리 → Supabase로 교체할 때 UI 코드를 전혀 건드리지 않아도 됐다는 것이 [트러블슈팅.md](docs/트러블슈팅.md) 실험 기록으로 증명됨.
    - `src/components/admin/ui.tsx`의 `StatusPill`/`SegmentPill`/`ago()`/`when()` 같은 공용 헬퍼가 관리자 화면 전반에서 재사용되고, `TODO`/`FIXME`/`any` 남발 없이 비교적 깔끔함.
    - **중복 발견:** `amountTierIndex` 로직이 [src/lib/wizard/branching.ts:11](src/lib/wizard/branching.ts:11)(클라이언트, `Question[]` 대상)과 [src/lib/domain/scoring.ts:36](src/lib/domain/scoring.ts:36)(서버, `Catalog` 대상)에 사실상 동일한 형태로 중복 구현되어 있음. 클라이언트/서버 계층 분리 원칙 때문에 의도된 중복일 가능성은 있으나, 공용 헬퍼로 뽑아낼 여지가 있음.
    - `src/app/api/v1/[...path]/route.ts`가 485줄짜리 단일 catch-all 핸들러라 리소스별로 라우트를 분리하지 않은 점은 가독성 측면에서 다소 아쉬움(내부적으로는 섹션 주석으로 구분은 되어 있음).


# 참고 링크 및 코드 개선

## 1.코드 리뷰 시 참고한 링크가 있다면 링크와 간략한 설명을 첨부합니다.
- [docs/api-spec.md](docs/api-spec.md) : v1 API 명세. UI보다 먼저 작성되어 백엔드 교체 시 재현성 검증에 활용됨.
- [docs/mock-data.md](docs/mock-data.md) : 시드 데이터 생성 스크립트와 `expectedTier` 자기검증 로직 설명.
- [docs/트러블슈팅.md](docs/트러블슈팅.md) : 6건의 디버깅 기록 + 추가 실험(보안 점검 포함).
- [docs/회고.md](docs/회고.md) : 프로젝트 회고.

## 2.코드 리뷰를 통해 개선을 제안할 코드가 있다면 코드와 간략한 설명을 첨부합니다.
- **중복 로직 통합**: [src/lib/wizard/branching.ts:11](src/lib/wizard/branching.ts:11)과 [src/lib/domain/scoring.ts:36](src/lib/domain/scoring.ts:36)의 `amountTierIndex` 계산 로직이 거의 동일하다. 공용 타입(예: `{choices: {score?, tierIndex?}[]}` 형태의 최소 인터페이스)을 정의해 두 계층에서 공유하는 순수 함수로 뽑아내면 배점 정책이 바뀔 때 한 곳만 고치면 되어 트러블슈팅.md가 강조하는 "코드가 아니라 데이터를 고친다"는 원칙과도 일관성이 생긴다.
- **자동화 테스트 도입**: `package.json`에 `test` 스크립트가 없다. 최소한 `scripts/generate-seed.ts`가 이미 갖고 있는 "`expectedTier` 불일치 시 실패" 검증을 Vitest/Jest 같은 프레임워크로 감싸서 CI에서 자동 실행되게 하면, 지금은 수동 실행에 의존하는 회귀 검증이 커밋마다 자동으로 돌아가게 된다.
- **API 라우트 분리**: `src/app/api/v1/[...path]/route.ts`(485줄) 단일 파일을 헬스체크/카탈로그/제출/인증/관리자 리소스별 하위 라우트나 핸들러 모듈로 쪼개면 파일당 책임이 좁아져 유지보수가 쉬워진다.
- **미해결 보안 이슈 조기 처리**: 트러블슈팅.md와 회고.md 모두에서 언급된 `X-Mock-Actor` 헤더 인증 우회, 관리자 로그인 인증 게이트 부재, 평문 비밀번호 비교, PII 평문 저장 문제는 "실제 고객을 받기 전에 반드시" 처리해야 할 항목으로 스스로도 표시해두었으니, 다음 스프린트의 최우선 작업으로 반영을 제안한다.


# 총평
문서화(README·API 명세·트러블슈팅·회고)가 코드 품질을 뒷받침하는 수준으로 촘촘하게 갖춰진 프로젝트다. 특히 "API 명세를 먼저 쓰고, 화면은 lib/db·lib/mock을 직접 import하지 않는다"는 아키텍처 규칙을 스스로 세우고 실제로 지켜, 백엔드를 메모리 → Supabase로 교체할 때 UI 코드를 한 줄도 건드리지 않았다는 점을 트러블슈팅 기록으로 증명해낸 것이 가장 인상적이다. 디버깅 기록(6건)과 실제 배포 환경 대상 보안 점검까지 남긴 점도 이 단계 프로젝트치고 보기 드문 성실함이다.

다만 자동화된 테스트가 전혀 없어 회귀 검증이 수작업(브라우저 클릭 + 시드 생성 스크립트)에 머물러 있고, 일부 로직(`amountTierIndex`)의 중복, 이메일 발송·PDF 리포트·법인 플로우 등 스스로 인정한 미완성 기능, 그리고 발견은 했으나 아직 고치지 못한 인증 우회 취약점이 남아 있다. 회고에서도 "AI와 함께 만든 코드를 혼자 처음부터 다시 짤 수 있는가"라는 질문에 아직 아니라고 답한 만큼, 다음 단계에서는 테스트 자동화와 보안 이슈 해소, 그리고 핵심 로직(특히 `InquiryWizard.tsx`, API 라우트)에 대한 직접 구현 이해도를 높이는 데 집중하면 좋겠다.
