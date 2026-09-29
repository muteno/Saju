# 기초 보강 인계 — GitHub에서 이어가는 시작점

## 상시 최우선 목표 — 사용자 원문71~73

**생년월일시를 입력하면 실제 사주를 얼마나 깊이 있게 풀 수 있는지, 그 풀이의 정확도를 어디까지 확인했는지를 중심으로 작업한다.** 이 문단은 후속 인계에도 항상 유지한다. 출처 표시·내부 출처 검수 확대는 필수가 아니다. 기존 정의·계산표·조건을 재사용해 실제 풀이를 개선하고, 오류나 필요한 조건을 확인할 때만 관련 자료를 좁혀 확인한다.

인계에는 실제 입력에서 개선된 설명, 아직 못 푸는 영역, 검증 수준, 다음 풀이 개선을 남긴다. 원국 계산의 비교 결과·조건 적용 검사·실제 개인 적중률은 별개다. 자료량·테스트 통과·관리 진행률은 해석 정확도가 아니며 **개인 적중률은 현재 미측정**이다.

갱신: 2026-09-29 · 사용자 원문 [83](USER_INTENT_LOG.md)
작업 시작 시 PR #224 merged/main `e7388c8f41b3f466f2a3cafb085c4f0140ded18e`, tree `4f87b07413a8b5b8f0236063482dcef3feba84eb`를 직접 대조했다.
이번 작업: [부분형·삼형의 전체 참여 자리 풀이](FOUNDATION_HYEONG_SCOPE.md). 월일 두 자리/연·시지 포함·부분형/삼형·반복 글자를 구분하고 모든 참여 자리의 본기 주제를 종합문과 두 번째 질문에 연결한다. 첫/셋째 질문·총3항목·기존 관계·강약/지장간·미상 보류 유지. 실제 개인 적중률과 공급자 의미해석 품질은 미측정/미검증이다.
**다음 첫 작업은 §5.1의 여러 원국 조건을 입력별 핵심 종합문과 간결한 경험 질문으로 함께 읽는 구현이다.** 최종 필수검사·독립검토·병합 SHA/main/tree는 이번 PR 영수증을 조회한다. [관리진행률](PROJECT_PROGRESS.md)은9/20=45%이며 실제 남은 작업량·풀이 정확도 비율이 아니다.
공개가 거절됐던 STATUS/WORK_CHECKPOINT는 수정·재전송하지 않는다. 중간 실행 상태는 임시기록에, 영구 재개점은 이 인계와 PR에 둔다. 아래 과거 작업표의 출처 중심 선행 순서보다 상시 목표와 §5.1이 우선한다.

## 1. 지금 무엇을 하고 있나

목표는 **개념·자리·조합·대운과 시점에 따라 판단이 달라지는 조건부 지식망**이다. 사용자가 기초를 먼저 보강하고 청사진을 기존 작업과 연결하라고 요청했다. 기초 정합 → 조건과 판단 과정 → 기본 풀이 → 시간 확장 → 학습·평가 순서로 진행한다.

- **완료:** 지정 로컬 폴더 읽기, 선택 자산 대조, 17개 설계의 반영 점검, 청사진 작성, 시작 문서·검토 자료 연결, F01 차이 76개 1차 처리와 검색 표현 1개 적용(PR #183).
- **미완료:** 양쪽 사전 통합, 구어 별칭의 의미 검수, P2 보류 항목의 의미·실행 자격 보강, 계산 판본 차이의 해소, 새 기초의 앱 적용, 실제 학습·확률 보정.
- **유지:** 기존 문헌 검토 항목 10개·조건식 8개·연구 그래프 58항목. 문헌 검토 자료와 학습 정답을 구별하며 실제 학습 적격 0개·확률 null이다.
- PR #182의 문서 편입과 PR #183의 제한된 별칭 1개 적용은 전체 사전 통합·앱 추론 완료가 아니다. 아래 날짜별 기록의 완료 선언·다음 작업·고정 가중치를 현재 상태로 자동 승격하지 않는다.

## 2. 읽는 순서와 문서의 역할

| 순서 | 문서 | 역할 |
|---|---|---|
| 1 | [사용자 원문](USER_INTENT_LOG.md) | 최초 목표, 정정, 이번 요청. 최신 설명으로 앞선 발언을 지우지 않음 |
| 2 | [아젠다](PROJECT_AGENDA.md) | 유지할 목적과 현재 우선순위 |
| 3 | **이 인계** → [청사진](FOUNDATION_BLUEPRINT.md) | 현재 작업·순서·산출물·통과 기준 |
| 4 | [반영 점검](FOUNDATION_AUDIT.md) | 첨부 설계 17개가 데이터·코드에 어느 정도 반영됐는지 |
| 5 | [측정 스냅샷](data/foundation_snapshot.json)·[실제 차이](data/foundation_review_bundle.json) | 날짜·기준 커밋·파일 해시·수량, 양쪽 값의 차이 |
| 6 | [현재 구현](CURRENT_STATE.md)·[기본 풀이](BASIC_READING_PLAN.md)·[세션 현황](../../dosa-app/STATUS.md) | 연구/기존 앱의 구현 범위와 이후 연결 |
| 7 | [작업 규칙](../../CLAUDE.md) | 저장소 검증·커밋·머지 절차 |

이번 자료만으로 이전 의도를 대체하지 않는다. 관계를 고정된 성격·사건 결론으로 바꾸지 않고, 원국·시간·관법·미상 정보를 구별한다. 옵시디언은 연결망을 보고 탐색하는 방식이며 특정 파일 형식이 전체 목표는 아니다.

## 3. 현재 자료의 세 범위

| 범위 | 2026-09-23 확인 | 의미 |
|---|---|---|
| GitHub의 기존 정제 | P0 3,881글·38,367문단, 사전/정의카드 271개, 관계 목록 7,295개 | 자료 보유·정제 상태. 전체 의미 검수 완료가 아님 |
| 로컬 작업본 | P0 3,845글·38,072문단, 사전 코드 264개, 정의카드·볼트 개념 262개 | 생성본과 코드의 범위도 다름. GitHub보다 모든 면에서 새롭거나 오래됐다고 단정 못 함 |
| 새 연구 모델 | 58항목·132관계·11다중 관계. 기존 271개 중 51개 이름 대응 | 선택된 검토 범위. 51/271을 전체 완성률이나 해석 정확도로 해석하지 않음 |

사전 이름 합집합 **273개**는 검토 분모다. 로컬 전용 **합(총칭)·충(총칭)** 2개, 저장소 전용 **9개**, 공통 개념 중 항목 내용(분류·별칭)이 다른 **65개**를 [검토 자료](data/foundation_review_bundle.json)에 담았다. 같은 ID의 P2 **12개**도 달라진 필드의 양쪽 값을 보존했다.

기존 767개 조건·분기 후보, 455개 구절 발견, 현재 개념 대응+구절 발견 337개는 [기존 이관](LEGACY_MIGRATION.md)의 별도 범위다. 서로 다른 단계의 수량을 더해 고유 자료 수로 세지 않는다.

## 4. GitHub만 있어도 할 수 있는 일

**로컬 폴더 접속은 F01 착수의 필수 조건이 아니다.** 검토 자료에는 사전 항목의 분류·별칭과 P2에서 바뀐 필드의 양쪽 내용이 들어 있다. 기존 실행 파일을 바꾸지 않은 상태에서 읽고 비교할 수 있다.

| 할 일 | GitHub에 있는 재료 | 한계 |
|---|---|---|
| 사전 판본 비교 | `foundation_review_bundle.json`의 `taxonomy`와 현재 [사전](../../정제/_현황판/build_concept_map.py) | 전체 빌더 코드 차이를 보존한 것은 아님 |
| 판단 과정 비교 | 같은 파일의 `p2_units`와 [기존 P2](../../정제/P2_유닛) | 보존된 P3 플래그·가중치는 당시 기록. 이번 검증 통과·학습 확률이 아님 |
| 원문 재검수 | [P0 스냅샷](../../정제/원본/P0_인벤토리)·[전사](../../정제/원본/전사)·[설계정본](../../정제/문서/설계정본) | 입력 파일·줄·문단 ID를 실제 대조해야 함 |
| 8월 로컬 수정 경위 | [0804 인계 보존본](../../정제/문서/인수인계/0804-1006_인수인계본_v07.md) | 수치와 완료 주장은 역사 기록 |
| 그림 확인 | [기존 현황판](../../정제/_현황판) | 옛 생성 결과를 새 연구 모델의 실시간 화면으로 오인하지 않음 |

반대로 **전체 로컬 폴더의 최신성·모든 원본 중복·보존하지 않은 파일 차이**를 새로 확인하려면 원본 접근이 필요하다. 이때만 해당 작업을 원본 대기 상태로 두고 저장소 안의 독립 작업을 계속한다. 이번 편입을 로컬 폴더 전체 복사·전량 동기화로 보고하지 않는다.

원문 경로의 개인 계정·기관은 `<SAJU_SOURCE_ROOT>`로 가렸다. 상대 경로와 SHA-256을 보존했으며 어떤 절대경로에 설치했는지는 재개 조건이 아니다.

## 5. 다음 작업표

| ID | 상태 | 작업 | 완료 기준 |
|---|---|---|---|
| F00 | 인계 자료 보존 완료 / 전체 자산 대조는 미완료 | 의도·청사진·감사·선택 판본 차이 연결 | GitHub만으로 이 표와 실제 차이 자료를 찾을 수 있음 |
| **F01** | **차이76개·검색 표현4개 적용 / 전체 의미 검수 미완료** | [검토표](FOUNDATION_REVIEW.md)에서 합·충 후속 검토 및 보충 제외는 [후속 문서](FOUNDATION_GENERAL_TERMS.md) 참조. 총칭 실행 등재는 보류하고 [통근 후속](FOUNDATION_ROOTING.md) 원문/가상 측정 완료·추가0. [지장간 겹침/단계 명칭 후속](FOUNDATION_HIDDEN_STAGES.md)에서4행 복구·원문 검수 후 [월률분야·사령](FOUNDATION_MONTH_COMMAND.md) 원문/검색 검수·사령부28행 제외. 사령관·단계 오탐은 보류 조건 유지. 긴 별칭 추가 시 오행·자리 노드 보존 확인 | 현재67채택(65기존 보존)·5분리·4보류. 상극행은3개 부분 채택/1개 보류. 후속 채택마다 원문·반례·적용 범위·회귀 검사 연결. 승인되지 않은 이름을 실행에 섞지 않음 |
| **F02** | **31행 반영표·후속6검수 / 잔여 의미 검수 진행** | [첫 묶음](FOUNDATION_F02_SIX.md): 실행277개, 원문24구간·별도 검사. 여섯 주제 조회 뒤 [31행 반영표](FOUNDATION_GAP31.md)·후속 정표기4/공망별칭2를 반영해 검색281개. [부분형 후속](FOUNDATION_PARTIAL.md)에서 검색282개. [활인업·재고귀인 조회](FOUNDATION_LIVELIHOOD_LINKS.md) 뒤 [진도화·가도화 비교](FOUNDATION_PEACH_LINKS.md)로10주제 연결. F03/F04 뒤 대표14항목 검수. 다음 §5.1의 문장별 소비 계약 | 원문·범위·검색 영향·기존 개념 보존 확인. 용어 등재와 관계/조건/생성본 적재를 구분 |
| F03 | **강약 자리배점 교정·미상 보류 / 기간·현침 판본 검수·현침 소비 보류 구현 / 개인발현 정책 미확정** | [계산 판본 검수](FOUNDATION_CALCULATION_POLICIES.md)·[시간대 수정](FOUNDATION_TIMEZONE_RESOLUTION.md), [앱 소비 검수](FOUNDATION_STRENGTH_CONSUMERS.md)·[미상 공통 보류](FOUNDATION_UNKNOWN_BIRTH_TIME.md), [자리배점 교정](FOUNDATION_STRENGTH_CORRECTION.md), [기간 판본 비교](FOUNDATION_MONTH_PERIODS.md), [현침살 판본 비교](FOUNDATION_HYEONCHIM.md)·[후보/발현 분리 소비계약](FOUNDATION_HYEONCHIM_CONSUMERS.md) | 강약 연지/시지 배점과 자시 처리부터 근거·현 실행값·영향 기록. 미결은 몰래 한쪽으로 고정하지 않음 |
| F04 | **P2/D5 감사·통근4조건 출처검수 / 개인 적용 보류** | [P2/D5 감사](FOUNDATION_P2_D5.md)의 실패와 [통근4후보 검수](FOUNDATION_ROOTING_CANDIDATES.md)를 보존하고 [대표14항목](FOUNDATION_BASIC_SENTENCES.md)의 조건 범위를 검수. 개인전달 계약은 §5.1 | 판단 단계·근거·조건·예외·미상 구별. 인용 검사를 낮추지 않고 실제 재검증 |
| F05 | F01~F04 결과 활용 | 기존 기본 풀이·60일주 검수에 연결 | 적용 문장·조건·근거 대응, 생시 미상·이견 보존. 대표 묶음과 전량 완료를 구분 |
| F06 | 후속 | 시간·환경 확장, 관측·검토 라벨, 동일 자료 모델 비교·보정 | 문헌 재현과 실제 결과 검증 분리. 미학습 수치는 확률로 제시하지 않음 |

### 5.1 다음 세션의 첫 실행 — 관찰 목록을 입력별 핵심 풀이로 함께 읽기

1. 상시 목표·최신 원문83·이번 PR merged/head/main/tree를 대조한다. [형 자리 범위](FOUNDATION_HYEONG_SCOPE.md)와 `contextReading.js`의 기존 월·시/강약/지장간/월일 관계를 읽는다. 미병합이면 최종 검사·병합부터 마무리한다.
2. 현재 조건은 각 문장으로 연결돼 있으나 전체 종합문과 둘째 질문이 길다. 2023-05-14 12/04/10시와 같은 일주·다른 강약/월시 입력의 실제 화면·응답에서 반복 질문과 핵심 주제를 먼저 비교한다. 새 해석 규칙이나 확률을 만들지 말고 이미 연결된 본기 주제·조건을 재사용한다.
3. **월·시의 주제, 강약/지장간 관찰, 관계 전체 참여 범위가 함께 설명되는 입력별 핵심 종합문 한 경로**를 구현한다. 전체관찰을 없애 짧게 만들거나 관계수를 세기/길흉/상쇄로 바꾸지 않는다. 구성 사실·해석 가설·개인 실제 경험을 구별한다.
4. 둘째 경험 질문은 합·파·형의 비슷한 질문을 통합해 연결/처음부터 분리/조정 불필요/경험없음을 유지한다. 첫/셋째 질문·총3항목과 미상보류를 유지하고 질문 중복·문장중간 잘림을 이번 변경범위와 기존범위로 구별한다. 상담에 실제 경험이 들어왔을 때 전달할 조건을 명확히 한다.
5. 카드→직업근거→자유질문요약/순수서버프롬프트→생성/캐시/지연답변을 실제 입력·DOM/전후 화면으로 검증한다. 같은 날 시각 변화 외에도 같은 일주/다른 조건으로 핵심 풀이 차이를 보여준다. 실제 공급자 의미 품질과 개인 적중률 미측정은 유지한다.
6. 현재 형7검사/측정·PR224 원래7검사와 이전 고정검사를 보존한다. 새 변경 전에 현재 판본과 회귀를 분리한다. 미상8행 전체동일·요청0, 계산/Brain/일진/정곡은 기존 비교범위에서 확인한다. 참여 자리 배열 소비는 읽기 전용이다.
7. 임시기록→실제입력·화면전후→필수8게이트→동일모델 최고노력 독립관점 검토(실제 동시/전체 한도 공개)→최종head병합/main/tree 재독→PR 단일영수증. 공개거절 STATUS/WORK_CHECKPOINT는 수정·재전송하지 않는다. 관리20개 기준의 완료조건을 닫지 않으면9/20을 유지한다.

```bash
node --test docs/knowledge-model/test_hyeong_scope.mjs
node docs/knowledge-model/measure_hyeong_scope.mjs --check
node docs/knowledge-model/frozen_month_day_compound.mjs --test docs/knowledge-model/test_month_day_compound.mjs
node --test --test-name-pattern='서버의 순수 프롬프트' scripts/test_app.mjs
CHROMIUM_PATH=/tmp/chromium FONTCONFIG_PATH=/etc/fonts node scripts/test_hyeong_scope_browser.mjs
SMOKE_CHROMIUM=/tmp/chromium FONTCONFIG_PATH=/etc/fonts npm run verify
```

### 5.1n PR #224 뒤 실행(보존 이력) — 복합 관계에 참여하는 다른 자리까지 구별해 읽기

1. 상시 목표·최신 원문82·이번 PR merged/head/main/tree를 대조한다. [월일 복합 풀이](FOUNDATION_MONTH_DAY_COMPOUND.md)와 정본 `contextReading.js`/`relations.js`를 읽는다. 미병합이면 최종 검사·병합부터 마무리한다.
2. 현재 복합문은 같은 월일의 육합+파만 읽는다. 예를 들어 `2023-05-14 12:00`의 사신형은 기존 관계 목록에는 있지만 복합문에는 없다. `detectRelations`의 부분형/삼형은 중복지지와 제3글자에 따라 참여 자리 배열 길이가 바뀐다. 실제 달력 입력과 기호 입력을 구분해 월일 두 자리·다른 자리 포함·완전/부분형을 먼저 비교한다.
3. **같은 두 자리 관계와 다른 자리까지 포함한 관계의 범위를 구별하여, 실제 관찰한 글자·본기 주제를 종합문에 연결하는 한 경로**를 구현한다. 세 자리가 필요한 삼형을 두 자리의 독립 관계로 축소하거나, 부분형을 완전형과 같다고 확정하지 않는다. 기존 정의·계산표를 재사용하며 새 계산정책 채택이나 출처 전량 감사가 목적이 아니다.
4. 관계의 겹침을 강도 합산·좋음/나쁨·상쇄·개인 갈등·질병·성패·시기로 바꾸지 않는다. 현재 연결/조정/처음부터 분리/경험없음과 기존 첫/셋째 질문·총3질문·단독관계·강약/지장간·미상 보류를 유지하며 실제 설명 차이를 확인한다.
5. 카드→직업근거→모든 자유질문요약/순수서버프롬프트→생성/캐시/지연답변에서 관찰·한계·질문을 대조한다. 기존 자유질문 전체질문 복제·문장중간 잘림 중복과 실제 공급자 의미 품질 미검증은 별도 한계다. 같은 반환값 안의 marker/관계 positions는 공유될 수 있으므로 소비자는 읽기 전용으로 유지한다.
6. PR223 원래7검사는 `frozen_month_day_yukhap.mjs`, PR222/221/220은 기존 고정판으로 재현한다. 현재 복합7검사·측정/기대해시도 다음 변경과 분리해 보존한다. 미상8행 전체동일·요청0과 계산/Brain/일진/정곡을 확인한다.
7. 임시기록→실제입력/DOM·화면전후→필수8게이트→동일모델 최고노력 독립관점 검토(실제 동시/전체 한도 공개)→최종head병합/main/tree 재독→PR단일영수증. 공개거절 STATUS/WORK_CHECKPOINT는 수정·재전송하지 않는다. 개인 적중률은 미측정이다.

```bash
node --test docs/knowledge-model/test_month_day_compound.mjs
node docs/knowledge-model/measure_month_day_compound.mjs --check
node docs/knowledge-model/frozen_month_day_yukhap.mjs --test docs/knowledge-model/test_month_day_yukhap.mjs
node --test --test-name-pattern='서버의 순수 프롬프트' scripts/test_app.mjs
CHROMIUM_PATH=/tmp/chromium FONTCONFIG_PATH=/etc/fonts node scripts/test_month_day_compound_browser.mjs
SMOKE_CHROMIUM=/tmp/chromium FONTCONFIG_PATH=/etc/fonts npm run verify
```

### 5.1m PR #223 뒤 실행(보존 이력) — 같은 자리의 육합과 다른 관계를 함께 읽기

1. 상시 목표·최신 원문81·이번 PR merged/head/main/tree를 대조한다. [월일 육합 풀이](FOUNDATION_MONTH_DAY_YUKHAP.md)와 `contextReading.js`/`relations.js`를 읽는다. 미병합이면 최종 검사·병합부터 마무리한다.
2. 현재 육합 경로는 두 글자의 관계와 본기 주제를 연결한다. 같은 월일에서 인해/사신의 파도 `detectRelations` 결과에 남지만 종합문은 육합만 설명한다. 실제 `2024-02-05 12:00`·`2023-05-14 12:00` 등의 육합/파 동시 관찰을 확인하고, 비교 입력의 다른 자리·단독 관계·무관계와 대조한다.
3. **같은 두 자리에서 여러 관계가 동시에 관찰된다는 사실과 두 본기 주제를 함께 읽는 한 경로**를 구현한다. 합화 성립·원래 오행 소실·합이 충/파를 없앰·강도 합산·좋음/나쁨의 확정으로 바꾸지 않는다. 필요한 기존 정의·계산표만 재사용하고 출처 전량 감사로 우회하지 않는다.
4. 동시 관계를 실제 역할의 연결·조정·분리 경험을 확인하는 질문에 연결하되 첫·셋째 질문·총3질문·충/육합 단독·강약/지장간을 보존한다. 현재 본기표의 육합은 전부 서로 다른 계열이며 같은계열 분기를 억지로 만들지 않는다. 반대 경험·경험 없음·미상 보류를 유지한다.
5. 카드→직업근거→모든 자유질문요약/순수서버프롬프트→생성/캐시/지연답변에서 관찰·한계·질문을 대조한다. 기존 자유질문의 전체질문 복제·문장중간 잘림 중복과 실제 공급자 의미 품질 미검증은 별도 한계다.
6. PR222 원래6검사는 `frozen_month_day_relation.mjs`, PR221/220은 기존 고정판으로 재현한다. 이번 육합7검사와 측정/기대해시도 다음 변경과 분리해 보존한다. 미상8행 전체동일·요청0과 계산/Brain/일진/정곡을 확인한다.
7. 임시기록→실제입력/DOM·화면전후→필수8게이트→동일모델 최고노력 독립관점 검토(실제 동시/전체 한도 공개)→최종head병합/main/tree 재독→PR단일영수증. 공개거절 STATUS/WORK_CHECKPOINT는 수정·재전송하지 않는다. 개인 적중률은 미측정이다.

```bash
node --test docs/knowledge-model/test_month_day_yukhap.mjs
node docs/knowledge-model/measure_month_day_yukhap.mjs --check
node docs/knowledge-model/frozen_month_day_relation.mjs --test docs/knowledge-model/test_month_day_relation.mjs
node --test --test-name-pattern='서버의 순수 프롬프트' scripts/test_app.mjs
CHROMIUM_PATH=/tmp/chromium FONTCONFIG_PATH=/etc/fonts node scripts/test_month_day_yukhap_browser.mjs
SMOKE_CHROMIUM=/tmp/chromium FONTCONFIG_PATH=/etc/fonts npm run verify
```

### 5.1l PR #222 뒤 실행(보존 이력) — 월지·일지 육합을 충과 구분해 함께 읽기

1. 상시 목표·최신 원문80·이번 PR merged/head/main/tree를 대조한다. [월일충 풀이](FOUNDATION_MONTH_DAY_RELATION.md)와 정본 `contextReading.js`/`relations.js`를 읽고 완료한 충 연결을 반복하지 않는다. 미병합이면 최종 검사·병합부터 마친다.
2. 기존 관계 계산의 월일 육합 관찰을 사용해 같은 일주·유사 월/시 역할의 실제 입력에서 육합있음/없음과 현재 설명을 대조한다. **기존 `합(오행)` 표기만으로 합화 성립이나 원래 오행 소실을 확정하지 않는다.** 두 글자 관계 관찰과 개인 조화·성공은 별개다.
3. 충을 나쁜 것, 합을 좋은 것으로 양분하지 않고 함께 읽는 본기 주제와 실제 경험에서 무엇을 더 확인할지 연결한다. 정의·계산표는 필요한 부분만 재사용하며 출처 전량 감사가 목표가 아니다. 개수 가산·강도·확률·시기 예측을 만들지 않는다.
4. 기존 월/시 여섯 순서쌍의 첫 질문·강약/지장간 세 번째 질문·총3질문과 충의 범위를 보존한다. 같은계열/다른계열·타자리관계·무관계·미상·반대/경험없음 입력을 함께 비교한다. 알려진 부분만 해석하고 부재를 현실의 부재로 옮기지 않는다.
5. 카드→직업근거→모든 자유질문요약/순수서버프롬프트→생성/캐시/지연답변에서 관찰·한계·경험질문을 대조한다. 정확한 전체/분리문장 중복을 확인하며 문장중간 잘림 질문의 기존 중복 한계와 실제 공급자 품질 미검증은 별도다.
6. PR221 원래6검사는 `frozen_ordered_roles.mjs`, PR220 원래9검사는 `frozen_hidden_root_context.mjs`로 재현한다. 원래 측정·기대해시는 덮지 않는다. 생시미상8행 요청0·대화 범위·재시도 맥락을 유지한다.
7. 임시기록→실제입력/DOM·화면전후→필수8게이트→같은모델 최고노력8관점(실제한도공개)→최종head병합/main/tree 재독→PR단일영수증. 공개거절 STATUS/WORK_CHECKPOINT는 수정·재전송하지 않는다. 계산/조건 검사와 개인적중률 미측정을 구별한다.

```bash
node --test docs/knowledge-model/test_month_day_relation.mjs
node docs/knowledge-model/measure_month_day_relation.mjs --check
node docs/knowledge-model/frozen_ordered_roles.mjs --test docs/knowledge-model/test_ordered_roles.mjs
node --test --test-name-pattern='서버의 순수 프롬프트' scripts/test_app.mjs
CHROMIUM_PATH=/tmp/chromium FONTCONFIG_PATH=/etc/fonts node scripts/test_month_day_relation_browser.mjs
FONTCONFIG_PATH=/etc/fonts node scripts/capture_month_day_relation.mjs current 390
SMOKE_CHROMIUM=/tmp/chromium FONTCONFIG_PATH=/etc/fonts npm run verify
```

### 5.1k PR #221 뒤 실행 — 월지·일지의 합충 관찰을 종합 풀이에 연결(보존 이력)

1. 상시 목표·최신 원문79·이번 PR merged/head/main/tree를 대조한다. [자리 순서 풀이](FOUNDATION_ORDERED_ROLES.md)와 `contextReading.js`를 읽고 완료한 여섯 조합을 반복하지 않는다. 미병합이면 최종 검사/병합부터 마친다.
2. 현재 원국 관계 계산과 `report.js`의 합충 출력을 읽고, **월지와 일지에 실제로 관찰되는 관계 한 가지**를 골라 기존 일·재능 설명에 연결한다. 먼저 같은 일주·유사 월/시 역할의 실제 달력입력에서 해당 관계의 있음/없음과 현재 설명을 대조한다. 확인된 기존 정의·계산을 재사용하고 원문 전량 감사를 선행목표로 되돌리지 않는다.
3. 글자 관계의 관찰과 개인 갈등·성공·관계 변화의 효과를 구별한다. 합=좋음/충=나쁨이나 힘의 임의 가산, 시기 예측을 만들지 않는다. ‘무엇이 함께 있어 설명에서 무엇을 더 확인하는가’를 종합문·반대/경험없음 질문에 연결한다. 같은 조건/다른 입력과 조건이 없는 입력의 차이를 확인한다.
4. 기존 강약3묶음·지장간 두 관찰·여섯 순서쌍의 첫 질문/질문 수를 보존한다. 이번 풀이 순서는 월지 본기 주제를 먼저 읽는 구현 선택이며 실제 행동·인생 순서/인과 판정이 아니다. 나머지19순서쌍은 여전히 공통 해석이다.
5. 카드→직업근거→모든 자유질문 요약/순수 서버 프롬프트→생성/캐시/지연답변을 대조한다. 앱 소유 세 질문/안내의 정확한 전체·분리문장 중복을 검사한다. 공급자가 질문을 문장 중간에서 끊으면 짧은 앞부분이 중복될 수 있다는 기존 한계를 새 검토문서에 재현했다. 현재 의역 모순·외부 공급자의 해석 품질·개인적중률은 미검증/미측정이다.
6. PR220 과거9검사는 `frozen_hidden_root_context.mjs`, PR219 과거6은 `frozen_strength_context.mjs`로 재현한다. 원래 측정/기대해시를 덮지 않는다. 미상8행 요청0·프로필/화자/주제 분리·retry snapshot을 유지한다.
7. 임시기록→실제입력/DOM·화면 전후→필수8게이트→같은모델 최고노력8관점(실제한도공개)→최종head병합/main/tree 재독→PR단일영수증. 공개거절 STATUS/WORK_CHECKPOINT는 수정·재전송하지 않는다. 계산/조건 검증과 개인적중률을 나눠 남긴다.

```bash
node docs/knowledge-model/measure_ordered_roles.mjs --check
node --test docs/knowledge-model/test_ordered_roles.mjs
node docs/knowledge-model/frozen_hidden_root_context.mjs --test docs/knowledge-model/test_hidden_root_context.mjs
node --test --test-name-pattern='서버의 순수 프롬프트' scripts/test_app.mjs
FONTCONFIG_PATH=/etc/fonts node scripts/capture_ordered_roles.mjs current 390
SMOKE_CHROMIUM=/tmp/chromium FONTCONFIG_PATH=/etc/fonts npm run verify
```

### 5.1j PR #220 뒤 실행 — 월지·시간의 자리 순서 구별(보존 이력)

1. 상시 목표·최신 원문78·이번 PR merged/head/main/tree를 대조한다. [지장간 풀이](FOUNDATION_HIDDEN_ROOT_CONTEXT.md)와 현재 `contextReading.js`를 읽고 완료한 관찰/질문 연결을 반복하지 않는다. 미병합이면 검사·병합부터 마친다.
2. 현재 `combineRoles`는25순서쌍을 정렬해15해석으로 묶어 월지와 시간의 역할이 바뀌어도 핵심 본문이 같다. 실제 달력입력에서 같은 일주·유사 강약/지장간 관찰을 유지하면서 자리 역할이 달라지는 사례를 찾아 종합문 차이를 확인한다.
3. 확인된 자리·구성의 차이가 왜 읽는 순서를 바꾸는지 작은 조합 한 묶음부터 연결한다. 기존 정의·원국 관찰을 재사용하고 월지=특정 시기, 시간=미래 성공 같은 미확정 개인효과를 새로 고정하지 않는다. 새 대량 출처 감사는 선행 목표로 삼지 않는다.
4. 기존 강약3묶음과 지장간 두 관찰을 종합문·질문에서 보존한다. 조건 하나의 추가 때문에 기존 질문 차이를 없애지 않으며 반대 경험·경험 없음도 허용한다. 카드→직업근거→자유질문요약/순수 서버 프롬프트→생성/지연답변을 비교한다.
5. 이번 `roots`는 일간 기준 네 지지와 현 지장간표만의 관찰이다. 원국전체 천간/인성 도움이나 통근의 단일정의·강도 판정으로 넓히지 않는다. 미상 요청0·프로필/화자/주제 분리·retry snapshot과 생시미상8행 보류를 유지한다.
6. 앱 소유 안내/질문은 정확한 문장 단위로 중복을 정리한다. 완전한 안내만으로 된 짧은 답도 정상이며 빈답/질문만 답변은 fallback이다. 의역의 모순·실제 공급자 품질은 아직 미검증이다. 역사 PR219 측정/검사는 `frozen_strength_context.mjs`로 재현하고 원래 해시를 덮지 않는다.
7. 임시기록→실제입력/DOM·화면 전후→필수8게이트→같은모델 최고노력8관점(실제한도공개)→최종head병합/main/tree 재독→PR단일영수증. 공개거절 STATUS/WORK_CHECKPOINT는 수정·재전송하지 않는다. 계산·조건 검증과 개인적중률 미측정을 구별한다.

```bash
node docs/knowledge-model/measure_hidden_root_context.mjs --check
node --test docs/knowledge-model/test_hidden_root_context.mjs
node docs/knowledge-model/frozen_strength_context.mjs --test docs/knowledge-model/test_strength_context.mjs
node --test --test-name-pattern='서버의 순수 프롬프트' scripts/test_app.mjs
CHROMIUM_PATH=/tmp/chromium node scripts/test_context_chat_browser.mjs
CHROMIUM_PATH=/tmp/chromium node scripts/test_strength_notice_browser.mjs
SMOKE_CHROMIUM=/tmp/chromium npm run verify
```

### 5.1i PR #219 뒤 실행 — 지장간 관찰과 강약 설명을 함께 읽기(보존 이력)

1. 상시 목표·최신 원문77·이번 PR merged/head/main/tree를 대조한다. [강약 조건 풀이](FOUNDATION_STRENGTH_CONTEXT.md), 현재 `contextReading.js`·`judge.js`를 읽고 완료한 계산 연결/질문을 다시 구현하지 않는다. 미병합이면 필수 검사·병합부터 마친다.
2. 현재 강약은 천간과 **지지 마지막 본기**만 도움으로 센다. 같은 글자·같은 오행이 다른 지장간에 남아 있는지 관찰하고, 본기 계산에서 빠졌다는 사실과 원국에 없다는 사실을 구별하는 작은 경로를 구현한다. [통근 후보](FOUNDATION_ROOTING_CANDIDATES.md)·기존 지장간표의 확인된 정의/예외를 필요한 만큼만 재사용한다.
3. 보존 Figma의 같은 글자와 사공의 같은 오행 정의를 몰래 하나로 확정하지 않는다. 두 관찰이 달라지는 입력·실제로 전혀 없는 입력·생시미상을 비교한다. 관찰을 통근 강도/재관 감당/성공·능력으로 바꾸거나 기존 점수에 임의 가산하지 않는다. 새 대량 출처감사를 선행목표로 삼지 않는다.
4. 새 관찰이 기존 ‘함께 읽으면’의 설명을 왜 바꾸는지 사용자에게 읽히게 연결한다. 카드→직업상담→자유질문 요약/서버 프롬프트와 생성 답변 안내/질문에서 조건이 빠지지 않도록 한다. 실제 모델의 의미 해석과 모의 전송 검증은 구별한다.
5. 미상 요청0·프로필/화자/주제 분리·retry snapshot·늦은응답을 보존한다. 늦은 비직업 답변의 안내는 현재2문장이고 `test_strength_notice_browser.mjs`로 중복0을 검사한다. 문구를 늘리면 실제 `toMsgs` 분할과 큐 중복을 확인한다. 과거 fixture/기대해시를 덮지 않고 현재 회귀를 함께 유지한다.
6. 임시기록→실제 입력/DOM·화면 전후→필수8게이트→같은 모델 최고 노력8관점(실제 한도 공개)→최종 head 병합/main/tree 재독→PR단일영수증. 공개거절 STATUS/WORK_CHECKPOINT를 수정·재전송하지 않는다. 계산 비교·조건 검증·실제 개인 적중률을 나눠 남기며 마지막은 현재 미측정이다.

현재 재현 명령:

```bash
node docs/knowledge-model/measure_strength_context.mjs --check
node --test docs/knowledge-model/test_strength_context.mjs
node --test --test-name-pattern='서버의 순수 프롬프트' scripts/test_app.mjs
CHROMIUM_PATH=/tmp/chromium node scripts/test_context_chat_browser.mjs
CHROMIUM_PATH=/tmp/chromium node scripts/test_strength_notice_browser.mjs
SMOKE_CHROMIUM=/tmp/chromium npm run verify
```

### 5.1h PR #218 뒤 실행 — 추가 원국 조건을 종합 풀이에 연결(보존 이력)

1. 상시 목표·최신 원문76·이번 PR merged/head/main/tree를 대조한다. [대화 연결](FOUNDATION_CONVERSATION_CONTEXT.md)을 읽고 이미 끝낸 최근 질문/답 전달을 다시 구현하지 않는다. 미병합이면 필수 검사·병합부터 마친다.
2. `contextReading.js`의 월·시25순서쌍/15해석, 표면/지장간4조건과 `judge.js`의 현재 강약 관찰을 실제 달력 입력에서 함께 읽는다. 같은 일주에서도 달라지는 종합 설명과 아직 같은 문장을 비교한다. [강약 교정](FOUNDATION_STRENGTH_CORRECTION.md), [통근 후보](FOUNDATION_ROOTING_CANDIDATES.md)의 확인된 정의·조건/미상을 필요한 범위만 재사용한다.
3. **강약·통근·합충 중 원국에 적용할 수 있다고 확인한 조건 한 가지를 선택해 기존 ‘함께 읽으면’ 설명이 실제로 달라지는 작은 경로를 구현한다.** 새 출처 대량 감사나 대화 저장 기능을 선행목표로 삼지 않는다. 잠정 점수·글자 개수는 능력·적성·발생확률이 아니며 조건 미확정인 개인효과를 만들지 않는다. 계산 관찰과 해석 가설을 구별하고 반대·미상 입력을 함께 비교한다.
4. 카드→직업 상담→자유질문의 조건·한계를 대조한다. 대화 `conversation`은 같은 화면 세션의 최근 일부이며 영구기억이 아니다. 실제 모델이 경험/반대를 잘 읽는지 확인할 때는 모의 API와 실제 공급자 평가를 구분한다. 실측자료가 없으면 개인 정확도는 미측정으로 둔다.
5. 프로필·화자·주제 전환, 생시미상 요청0, 재시도 snapshot·오래된 응답 방어를 유지한다. 원문·과거 측정 해시를 덮지 않고 현재 검사와 과거 재현을 둘 다 수행한다. 질문의 자리 역순 본문이 같다는 기존 한계도 해결 전까지 보존한다.
6. 임시 중간기록→실제 입력/DOM·화면 전후→필수8게이트→같은 모델 최고 노력8관점(실제 동시한도 공개)→최종 head 병합/main/tree 재독→PR단일영수증. 공개거절 STATUS/WORK_CHECKPOINT는 수정·재전송하지 않는다. 인계 맨 위에 실제 풀이 개선/미해결 영역/정확도범위/다음 구현을 유지한다.

현재 재현 명령:

```bash
node --test --test-name-pattern='대화' scripts/test_app.mjs
node scripts/check_conversation_consumers.mjs
CHROMIUM_PATH=/tmp/chromium node scripts/test_conversation_browser.mjs
node docs/knowledge-model/frozen_conversation_context.mjs --test docs/knowledge-model/test_context_synthesis.mjs
SMOKE_CHROMIUM=/tmp/chromium npm run verify
```

### 5.1g PR #217 뒤 실행 — 질문과 실제 답변 맥락을 다음 상담에 연결(보존 이력)

1. 상시 목표·최신 원문·이번 PR의 merged/head/main/tree를 대조한다. 미병합이면 검사·병합부터 마친다. [조합 풀이](FOUNDATION_CONTEXT_SYNTHESIS.md)와 `data/context_synthesis_samples.json`을 읽고 완료한 종합문/질문을 다시 구현하지 않는다.
2. 현재 `experienceQuestions`는 id·질문·좁힐 범위만 제공한다. `DosaChat.askFree → requestDosaText → functions/api/dosa.ts`는 자유입력 한 문장과 원국요약을 보내며, 앞서 물은 질문이나 실제 답변은 누적하지 않는다. 실제 대화에서 어떤 맥락이 빠지는지 재현한다.
3. **직전 질문과 사용자가 답한 실제 경험을 함께 읽어 다음 설명·추가질문에 반영하는 작은 경로**를 구현한다. 맞음/다름/경험 없음/미응답을 구분하고 없던 경험을 추정하지 않는다. 사용자 답을 사주 규칙의 정답·학습라벨·적중률로 자동 바꾸지 않는다. 새 외부 저장을 임의 추가하지 말고 기존 대화의 상태·전송 범위를 먼저 확인한다.
4. 프로필·화자·주제 전환, 요청취소·오래된 응답, 생시미상 공통보류를 대조한다. 새 직업 지연정책은 본문 시작 후 로컬 풀이 완주다. 전송한 질문/답변이 다른 사람 명식에 붙지 않는지 확인한다. 필요한 문구/컴포넌트는 기존 디자인을 계승한다.
5. 원국 계산·조건 적용·개인 적중률은 구별한다. 마지막은 여전히 실측 평가자료가 없어 미측정이다. 현재15해석/25순서쌍은 자리별 효과나25독립 판정이 아니다. 강약·통근·합충·대운 효과와 실제확률 학습은 남는다.
6. 새 현재회귀·실제 대화/DOM·필수8게이트·같은모델 최고노력8관점(실제 동시한도 공개)·병합/main 재독·PR단일영수증까지 마친다. 과거 자료와 측정 해시는 보존하고 공개거절 STATUS/WORK_CHECKPOINT는 수정·재전송하지 않는다.

현재 재현 명령:

```bash
node docs/knowledge-model/measure_context_synthesis.mjs --check
node --test docs/knowledge-model/test_context_synthesis.mjs
node docs/knowledge-model/frozen_context_synthesis.mjs --test docs/knowledge-model/test_context_reading.mjs
CHROMIUM_PATH=/tmp/chromium node scripts/test_context_chat_browser.mjs
npm run verify
```

### 5.1f PR #216 뒤 실행 — 원국 조건을 종합문과 실제 경험 질문으로 연결(보존 이력)

1. 상시 목표·최신 원문과 실제 PR merged/head/main/tree를 확인한다. 미병합이면 검사·병합부터 마친다. 이번 일·재능 카드/표면·지장간4조건 연결을 다시 완료 작업으로 세지 않는다.
2. `FOUNDATION_CONTEXT_READING.md`, `data/context_reading_samples.json`, 정본 `contextReading.js`를 읽고 같은 갑인의2024-02-20 00/12/18시·2024-04-20 12시 출력을 비교한다. 월·시 역할은 다르지만 일부 최종 종합문이 같은 한계를 시작점으로 삼는다.
3. **월지 본기·시주 역할과 원국의 다른 조건을 함께 반영해 최종 설명이 실제로 달라지는 작은 경로**를 구현한다. 기존 계산의 잠정 강약·검토된 조건을 사용하되 글자 수를 힘·적성·확률로 치환하지 않는다. 숨은 글자/완전 부재, 추가 조건의 찬반·미상을 구분한다. 자료 전량 감사는 선행조건으로 삼지 않는다.
4. 조합 설명에서 사용자가 대조할 수 있는 실제 경험 질문1~2개로 연결할지 검토한다. 답변으로 무엇을 좁힐 수 있는지 명시하며 동의를 곧 정답·훈련라벨로 쓰지 않는다. 실제 정확도 평가에는 동의받은 경험 기록, 정의한 평가항목, 개발에 보지 않은 표본이 필요하다. 실측자료가 없으면 그 항목만 미측정으로 둔다.
5. 새 설명은 카드→상담→자유질문→성공/늦은 답변에서 동일한 조건·한계를 보존한다. GI09/10의 식상 범위미상·기존 개인출력 보류·생시미상 공통보류를 유지한다. 출처가 없다는 이유만으로 기능을 보류하지 않으며 확인 불가능한 조건만 미상으로 남긴다.
6. 검증은 (a) 계산기준/지원 입력범위 (b) 조건 변화에 따른 문장/상충/누락과 재현성 (c) 개인 적중률을 따로 기록한다. 현재 (c)는 미측정이다.720기호·110합성 입력·8검사·관리9/20은 적중률이나 작업시간 비율이 아니다.
7. 임시 중간기록→필수검사→같은 모델 최고 노력8관점(환경 동시한도 공개)→필요한 화면 전후→원격 병합·main/tree 재독→PR 단일 영수증. 공개거절 STATUS/WORK_CHECKPOINT는 수정·재전송하지 않는다. 인계 맨 위 목표와 실제 개선/미해결/정확도범위/다음 풀이 구현을 유지한다.

이번 변경 재현:

```bash
node docs/knowledge-model/measure_context_reading.mjs --check
node docs/knowledge-model/measure_context_samples.mjs --write
node --test docs/knowledge-model/test_context_reading.mjs
node docs/knowledge-model/frozen_context_reading.mjs --test docs/knowledge-model/test_gapin_structure_delivery.mjs
npm run verify
```

### 5.1e PR #215 뒤 첫 실행 — 생년월일시 기반 기본 풀이 한 경로 개선(보존 이력)

1. 상시 목표·최신 사용자 원문을 읽고 최신 PR merged/head/main/tree를 대조한다. 이번 구조5개 카드 연결과 출처 표시 정리는 다시 완료 작업으로 세지 않는다. 미병합 작업이 있으면 먼저 마친다.
2. 실제 앱 경로 `buildReading → buildReport → toReading → dosaTopics/상담`에서 생시가 알려진 대표 입력의 현재 풀이를 읽는다. 같은 갑인 일주에서 월·시가 다른 입력, 비교할 다른 일주, 생시 미상을 포함한다. 사용자에게 보이는 구조·성향·관계·일·시기 설명과 비어 있는 영역을 확인하고 한 가지 가장 큰 설명 공백을 선택한다.
3. 기존 원국 계산·조건8개·검토된 개념을 재사용해 **구조와 다른 기둥의 조건을 연결한 종합 설명 한 경로를 실제 앱에 구현**한다. 정의5개를 늘어놓는 수준에서 무엇 때문에 해석이 달라지는지로 나아간다. 연구 조건의 적용 가능 범위는 함수와 입력으로 확인하고, 불완전하면 명시적인 미상으로 남긴다. 자료의 전량 출처 감사나 59일주 원문 검수를 구현의 선행 조건으로 세우지 않는다.
4. 정확도는 세 층으로 기록한다: (a) 계산값의 기준 사례 일치와 지원 입력 범위, (b) 원국 조건 변경에 따른 설명 변화·조건 누락·상충·재현성, (c) 실제 개인 해석의 평가/적중률. (c)는 현재 관측·라벨·평가표본이 없어 미측정이다. 합성 입력/모델 자기평가를 실측 정답으로 둔갑시키지 않는다. 다음에 평가자료가 필요하면 필요한 종류를 구체화한다.
5. 실제 입력별 전후 풀이를 남기고, 적용 조건·예외·생시 미상·기존 개인출력 보류를 검사한다. 기존 GI09/10의 식상 관찰을 개인 직업 효과로 승격하거나 가짜 확률을 붙이지 않는다. 출처가 없다는 이유만으로 설명을 보류하지 않으며, 조건을 확인할 수 없을 때 그 조건의 판단만 보류한다.
6. 필수검사·같은 모델 최고 노력8관점(실제 동시한도 공개)·필요한 화면 전후·원격 병합을 마친다. 이 인계 맨 위의 상시 목표를 유지하면서 **더 깊어진 실제 풀이 / 못 푸는 부분 / 확인한 정확도 범위 / 다음 제품 개선**을 갱신한다. 이미 검증된 과거 자료는 보존하고 같은 출처 감사만 반복하지 않는다.

이번 변경 재현:

```bash
python3 scripts/build_gapin_structure_data.py --check
node docs/knowledge-model/measure_gapin_structure_delivery.mjs --check
node --test docs/knowledge-model/test_gapin_structure_delivery.mjs
npm run verify
```

### 5.1d PR #213 뒤 실행 — 갑인 구조 설명·식상 조건 범위 대조

1. 필독문서→[새 전달 계약](FOUNDATION_GAPIN_DELIVERY.md)→최신 PR merged/head/main/tree를 대조한다. 미병합이면 해당 검사·병합을 먼저 마무리한다. 보류정책을 다시 구현하지 않는다.
2. `gapinConditions.js`와 `data/gapin_sentence_review.json`의 GI01/03/04/09/10을 읽는다. 일간·일지·지장간·건록의 **구조 설명**과 성격/직업 **효과 주장**을 나눈다. 보드·정본 계산표·출처 원문을 대조해 구조 설명 한 묶음을 정확한 근거와 연결한다. 지장간 구성/강도 판본을 조용히 확정하지 않는다.
3. 일주론 본문9–10의 식상 유무와49·55의 寅 지장간 丙 식신을 함께 읽는다. 같은 원문·기초 정의의 대상/자리/표면·지장간 범위를 추가 대조한다. 갑인이면 전체지장간 식상은 항상 관찰될 수 있으므로 ‘식상 없음’ 분기를 없애는 계산을 승인하지 않는다. 정의가 불명확하면 unknown 유지·재개에 필요한 자료를 적는다.
4. 명확한 구조·원문 조건을 **문헌 참고 설명**으로 전달할 수 있는 최소 단위를 정한다. 관찰사실→원문 범위→예외/미상→근거를 연결하며 조건 충족을 개인 결과 적중으로 바꾸지 않는다. 금 관성은 GI09의 별도 직장 대안이며 GI10으로 전이하지 않는다.
5. 일반 방법분류·참고문헌4개는 갑인 블록 안에서만 보류한다. 기존14정책 v1→v2 이행 기록, 알려진31문구 경계, 원문35/제외메모1/구판14의 분모를 보존한다. 갑오/갑자·나머지59일주 전량 원문 검수와 실제 관측/라벨·학습은 별도 잔여다.
6. 앱 변경 시 정본→vendor sync·새 측정·전후DOM/PNG·실제KB110/미상8·현침/강약을 확인한다. 과거14정책/제품진단은 `frozen_gapin_delivery.mjs`로 원래 판본을 재현하며 해시만 덮지 않는다.
7. 임시기록→필수검사→같은모델 최고노력8관점(실제 동시한도 공개)→원격·병합·PR단일영수증. 관리9/20=45%, 개인승인0·학습적격0·확률null. 공개거절 STATUS/WORK_CHECKPOINT는 수정·재전송하지 않는다.

```bash
python3 docs/knowledge-model/gapin_sentence_review.py --check
python3 scripts/build_gapin_sentence_policy.py --check
node docs/knowledge-model/frozen_gapin_delivery.mjs docs/knowledge-model/measure_basic_sentence_delivery.mjs --check
node docs/knowledge-model/measure_gapin_delivery.mjs --check
node --test docs/knowledge-model/test_gapin_delivery.mjs
npm run verify
```

### 5.1c PR #212 뒤 실행 — 갑인 검토판의 입력조건·개인 전달 계약(보존 이력)

1. 필독문서→[갑인 원문 검수](FOUNDATION_GAPIN_SENTENCES.md)→[제품 현황](PRODUCT_READINESS_20260928.md)과 최신 PR의 merged·head/main/tree를 대조한다. 원문대조 완료를 개인 해석 승인이나 앱 반영 완료로 읽지 않는다.
2. `data/gapin_sentence_review.json`의 각 항목과 기존 `data/basic_sentence_review.json`을 함께 읽는다. 원문·구판 감사·현재14항목 보류정책은 별도 판본으로 보존한다. 갑인 핵심의2020문맥·주의3의 부분 재사용·성별/원국 조건·일간/일지 일반설명의 범위를 우선 다룬다.
3. 기존 앱에서 원문 조건을 실제로 판단하는지 항목별로 확인한다. 입력→조건 충족/불충족/미상→문장→정확한 근거의 최소 한 묶음을 정하고, 개인 효과의 검증이 없는 문헌 설명과 개인 판정을 구분한다. 모호한 조건이나 건강·관계결과의 발현을 자동 승인하지 않는다.
4. 전달정책에 추가할 항목·문구/부분재사용 범위·문헌참고/개인출력의 차이를 명시한다. 전체문구 일치필터로 의미상 의역까지 차단했다고 보고하지 않는다. 필터를 확장하는 것만으로 개인화 추론 완료라고 하지 않는다.
5. 앱을 바꾸면 정본→vendor sync·실제KB/카드/상담/Brain·알려진 입력/미상8·현침/강약 계약·전후DOM/PNG를 확인한다. 이번 새 측정과 구판 소비측정은 별도 고정판으로 보존하며 해시만 현재코드에 맞춰 덮지 않는다.
6. 기준13/14/15는 아직 진행이다. 관리9/20=45%, 학습적격0·확률null을 유지하고 갑오/갑자·나머지 일주 원문검수, 계산 비교 확대·실제 관측/검토 라벨·모델 학습/평가를 구분해 남긴다.
7. 임시기록→필수검사→같은모델 최고노력8관점 검토→원격저장·병합·다음인계. 동시한도는 실제 환경에 맞춰 공개한다. 공개거절 STATUS/WORK_CHECKPOINT는 재전송하지 않고 최종영수증은 PR에 한 번 기록한다.

```bash
python3 docs/knowledge-model/gapin_sentence_review.py --check
python3 -m unittest discover -s docs/knowledge-model -p 'test_gapin_sentence_review.py'
node docs/knowledge-model/measure_basic_sentence_delivery.mjs --check
npm run verify
```

### 5.1b PR #211 뒤 실행 — 갑인 잔여 문장·부분 재사용 원문 검수(보존 이력)

1. 필독문서→[문장 전달 계약](FOUNDATION_BASIC_SENTENCE_DELIVERY.md)→최신PR의 merged·head/merge/main tree를 대조한다. 미병합이면 최종검사·병합부터 마친다. 이미 보류한14항목을 다시 구현하지 않는다.
2. 기존 `data/basic_sentence_review.json`과 원문7글·20구간은 동결한다. 갑인 증류의 핵심·성격/직업/관계/주의·관점/인용/물상/기타의 실제 항목수를 먼저 계수하고, 기존 IN01~06과 남은 항목의 위치를 별도 검토판으로 나눈다. 갑인 주의3의 IN06 부분 재사용 등 문구가 다른 의미 재사용을 정확한 전체문구 보류와 구별한다.
3. 각 남은 문장의 원문 위치·조건·예외·연도/운·성별·자리·저자 계보를 재대조한다. 원문이 불명확하면 미검수/보류를 유지하고 첫 자료명으로 귀속하지 않는다. 기존14와 중복된 근거를 새 독립 지지로 세지 않는다.
4. 의미 검토 단위를 완료한 뒤 새 검토판을 현 전달정책에 추가할지 판정한다. 원문 일치가 개인 적용 승인은 아니다. 갑오/갑자 잔여·60일주 전량, 실제 입력조건 평가·반대조건·개인정확도는 남는다.
5. 구판 `basic_sentence_review.py` 및 `measure_basic_sentence_consumers.mjs`는 아래 frozen 진입점으로 재현한다. 원래 해시를 현재코드로 덮지 않는다. 검수확장이 앱을 바꾸면 정본→vendor sync·새측정·화면전후·생시미상8/현침/강약/원문 보존을 확인한다.
6. 임시기록→필수검사→같은모델 최고노력8관점 검토→원격저장·병합·다음인계를 남긴다. 기준13/14/15는미완료·9/20=45%다. 공개거절 STATUS/WORK_CHECKPOINT는 재전송하지 않고 최종영수증은 PR에 한 번 기록한다.

```bash
python3 -m unittest discover -s docs/knowledge-model -p 'test_basic_sentence_review.py'
node docs/knowledge-model/frozen_basic_sentence_audit.mjs --python docs/knowledge-model/basic_sentence_review.py --check
# 빌드KB와 앱 의존성 준비 후
node docs/knowledge-model/frozen_basic_sentence_audit.mjs docs/knowledge-model/measure_basic_sentence_consumers.mjs --check
node docs/knowledge-model/measure_basic_sentence_delivery.mjs --check
npm run verify
```

### 5.1a PR #210 뒤 실행 순서 — 검토항목 개인 전달 보류·문장별 출처 소비 계약(보존 이력)

1. 필독문서→[대표 문장 검수](FOUNDATION_BASIC_SENTENCES.md)→최신PR의 merged·head/merge/main tree를 대조한다. 미병합이면 검사·독립검토·병합부터 마친다. 통근/대표14항목 원문검수를 반복하지 않는다.
2. `data/basic_sentence_review.json`의14항목·20구간과 `data/basic_sentence_consumers.json`의6입력/미상1·발췌 순서를 읽는다. 12문자열+견해그룹2이며 성격은4/402·완전검수 일주0이다. 검토층은 앱에 아직 연결되지 않았다.
3. 정본 `dosa-app/engine/src/report.js`→`app/src/data/saju.ts`→카드·도사한마디·상담·Brain의 실제 전달을 추적한다. 첫출처 대표 부착을 문장별 근거로 쓰지 않는다. 검토14항목의 개인전달을 보류하고 검수상태·조건·예외·원문 위치를 일관되게 전달하는 최소 계약을 정한다. 검수되지 않은 나머지초안의 처리범위도 명시한다.
4. IN02의 다른기둥·IN04의 무신운·IN05의2020제목·OH04의가능표현/안정조건·JA04의원국/운미상을 보존한다. 견해그룹 한쪽만 제거해 합의를 만들지 않는다. 원문 존재를 개인적용 자격으로 승격하지 않는다.
5. 현60개 증류는 존재한다. 메모리에서 갑자 증류만 제거하면 엔진 발췌는 목차/인사말이지만 현재 UI 일주분기는 표시하지 않는다. 이 잠재경로를 현재 화면 누출로 오보고하지 않는다.
6. 앱을 고치면 정본수정→vendor sync, 실제KB·알려진입력·미상/현침보류·강약교정·전후DOM/PNG와독립검토를 갖춘다. 새 검토기는 report/saju 입력해시를 고정하므로 이전 감사 재현을 별도 판본으로 보존하고 해시만 덮지 않는다. 기존P2/D5·원문·그래프58/132/11·조건8·출처조회10/52는 보존한다.
7. 임시기록→필수검사→독립검토→원격저장·병합·다음인계를 남긴다. 기준13/14/15는미완료·9/20=45%다. 공개거절 STATUS/WORK_CHECKPOINT는 재전송하지 않고 최종영수증은 PR에 한 번 기록한다.

```bash
python3 docs/knowledge-model/basic_sentence_review.py --check
python3 -m unittest discover -s docs/knowledge-model -p 'test_basic_sentence_review.py'
# 빌드KB와 앱 의존성 준비 후
node docs/knowledge-model/measure_basic_sentence_consumers.mjs --check
npm run verify
```

### 5.2 PR #184 당시 실행 순서 — 합·충 총칭 2개(보존 이력)

1. `AGENTS.md`의 필독 순서를 따른 뒤 [체크포인트](WORK_CHECKPOINT.md)에서 PR #183의 병합 영수증을 확인한다. 현재 main에 후속 변경이 있으면 먼저 대조한다. 76개 처리표를 처음부터 다시 만들지 않는다.
2. [검토 JSON](data/foundation_taxonomy_review.json)의 `합(총칭)`·`충(총칭)` 두 행, 보존 번들의 `/taxonomy/local_only`, 현재 `정제/_현황판/build_concept_map.py`의 사전과 `build_neuron_map.py`의 매칭 방식을 함께 읽는다.
3. 원문 근거 ID `combine_positive`·`combine_substring`·`clash_positive`·`clash_substring`의 파일과 줄을 읽는다. `합을 해`가 `결합을 해`에, `충을 해`가 `보충을 해`에 걸리는 반례를 보존하고 긍정 용례도 같이 본다.
4. 두 총칭 각각의 정의·천간합/육합 등 하위 유형과의 관계·인식 조건·제외 조건을 정리한다. 기존 하위 개념을 총칭 별칭에 합치지 않는다. 기존 구성 개념이 긴 별칭 때문에 사라지는지도 확인한다.
5. 원문과 반례로 기준이 성립하는 최소 묶음만 코드에 반영한다. 아직 구분할 수 없으면 근거와 다음 해결 조건을 적어 보류한다. 새 노드를 넣는다면 현재 검사기의 **271개 보존·별칭만 적용하는 계약**을 명시적인 후속 판정/검사 형식으로 확장해야 한다. 과거 스냅샷이나 기준 해시를 고쳐 통과시키지 않는다.
6. 변경된 인식의 긍정·반례·기존 노드 보존을 확인하고, 실제 영향을 받는 빌더의 전후 배정 차이를 기록한다. 루트 필수 검사와 PR 검사를 통과한 단위로 커밋·원격 저장·병합한다. 다음 묶음은 통근 → 조후/상극 → 나머지 별칭의 다른 뜻 순으로 검수한다.

착수 확인 명령은 아래와 같다. 이것은 의미 검수 결과를 대신하지 않는다.

```bash
git status --short
git log -3 --oneline
python docs/knowledge-model/foundation_review.py --check
python -m unittest discover -s docs/knowledge-model -p 'test_foundation_review.py' -v
```

PR #184 당시 기대값은 **76차이·271개념·적용 별칭 1개·근거 범위 86개**, F01 회귀 12개 통과였다. 현재 기대값은 §5.1을 따른다. 66채택 중 65행은 기존판 보존이며 의미 안전 승인이 아니다. `부부관계`·`부부간`을 단순 부부 동의어로 다시 넣지 않는다.

새 체크아웃에는 무시된 생성 코퍼스 파일이 없을 수 있다. 리더가 0행을 반환해도 원문 부재로 결론내리지 않는다. 전후 전체 측정이 필요할 때만 기존 `build_dashboard.merge()`·`ingest_transcripts.py`로 입력을 재생성하고 해시를 기록한다. `lint_aliases.py`와 옛 전체 파이프라인은 저장된 별칭 판정을 덮어쓸 수 있으므로, D5 인용 자격 검수 없이 실행·재게시하지 않는다.

당시 작업의 완료 기준은 두 총칭의 판정·원문·반례·적용 여부·검사·남은 쟁점이 원격에 함께 남는 것이다. F02 이후·앱 계산·학습 확률로 범위를 넓히지 않는다.

### 5.3 PR #189 뒤 실행 순서 — 월률분야·사령(보존 이력)

1. `AGENTS.md` 필독 문서 → [체크포인트](WORK_CHECKPOINT.md) → [청사진 v2 §0](FOUNDATION_BLUEPRINT.md)를 읽고 원격 main/PR을 대조한다. [PR #189](https://github.com/muteno/Saju/pull/189)이 미병합이면 최종 검사·검토·병합부터 마무리한다. 완료한 지장간4행 복구를 다시 설계하지 않는다.
2. 현재 노드 `월률분야·사령`의 `월률분야/월령분일용사/사령/당령/인원용사`와 보존 보드의 월령/지장간 설명부터 읽는다. **이 노드는76차이 행에 없으므로 없는 번들 포인터나 판정 행을 만들지 않는다.** 별도 검수 문서에 근거와 범위를 연결한다.
3. 이전 근거 `hidden_hyeonmyo_zi`·`hidden_hyeonmyo_stages`·`stages_choco_in_period`·`stages_choco_period_summary`를 출발점으로, 월지·절입 후 경과일·사령 기간과 여기/중기/정기 구성을 구별한다. 원문에서 확인되지 않은 기간 경계나 관법 차이를 임의로 채우지 않는다.
4. 두 빌더의 실제 실행을 비교한다. 뉴런의 `NEG_ADJACENT`에는 사령부/사령관/사령탑 제외가 있지만 개념지도는 현재 그 국소 제외 검사를 그대로 호출하지 않는다. 현재 사령 별칭에 이 제외어도 없다. 원문 반례와 실제 사령이 섞인 문단을 확인하고 차이를 실측한 뒤 최소 수정 여부를 정한다. 사령의 언급·당령 여부·강약 판정은 구별한다.
5. [단계 검수 §3~4](FOUNDATION_HIDDEN_STAGES.md)의 같은 글33/67 대30/60, 오의 예외, 중기 없음·투간 부정, 일상어끼리 통과하는 문제를 이어받는다. `stages_periodic_here/emotion_here/basic_here/historical_middle/mixed_here_middle`가 시작 사례다. 발생 위치별 동반어 기준 없이 별칭이나 문단 전체를 삭제하지 않는다. 기존3행 차이의 신중기도/신중기현을 실제 중기 누락으로 복구하지 않는다.
6. `dosa-app/engine/src/tables.js`의 구성/마지막 본기 계약과 문헌의 기간·작용력·강도 수치를 비교하되 엔진값을 자동 수정하지 않는다. 미결 판본은 F03으로 연결하고 문헌 %를 학습된 확률로 바꾸지 않는다.
7. 같은 코퍼스의 두 빌더 전체 개념별 전후 ID·기존 손실 검사 → 중간 기록·전체 검사·원격 보존 → PR 검사·병합 → F02 누락31개(우선6개)로 이어간다. 통근·조후·단계 오탐의 보류 조건은 유지한다.

당시 기대값: `foundation_review.py --check`는 **76차이·271개념·적용 별칭4·151근거**, 판정67채택/5분리/4보류. F01회귀22개·Python 전체132개. 검색/원문 검수 수량은 독립 증거 수나 해석 정확도가 아니다.

```bash
git status --short
git log -3 --oneline
python3 docs/knowledge-model/foundation_review.py --check
python3 -m unittest discover -s docs/knowledge-model -p 'test_foundation_review.py'
```

생성 코퍼스가 없으면 [통근 문서의 생성 명령](FOUNDATION_ROOTING.md#새-체크아웃에서-다시-측정)을 사용한다. 이번 전후 비교는 `measure_hidden_stages.py`·`data/foundation_hidden_stages_measurement.json`에 있다. 이전 측정 스크립트의 고정 기준판/해시 검사는 낮추지 않는다. 새 변경에는 기준·입력·코드 해시를 따로 고정한다.

## 6. 기존 설계와 연결하는 자리

| 기존 자산 | 새 청사진에서 연결되는 곳 |
|---|---|
| [정제틀 v2](../../정제/문서/설계정본/20260721_170000_정제틀_설계_v2.md), W0·P0·P1 | 원본·용어·문단·좌표·중복의 기초. 17개 세부 대응은 [감사](FOUNDATION_AUDIT.md) |
| [경로 중심 P2 v3](../../정제/문서/설계정본/20260725_1300_P2_유닛스키마_v3_경로중심.md) | 조건→판단 단계→근거·반전. 앞선 공백 진단·P1 순서·관법 대체의 정정을 함께 계승 |
| [7월 원리 정제 청사진](../../정제/문서/설계정본/20260728_0500_원리정제_청사진_v1.md) | 관계 개수보다 ‘왜’와 다른 경로를 보강한다는 취지. 당시 수치·편성은 현재 지시가 아님 |
| [기존 이관](LEGACY_MIGRATION.md) | 767개 검토 후보와 새 모델 사이의 연결. 가중치 자동 복사 금지 |
| [기본 풀이](BASIC_READING_PLAN.md) | 기초가 정합된 뒤 일주·성향 설명에 적용 |
| [원국/시간](CONTEXT_BRIDGE.md), [문헌 사례](SOURCE_CASES.md), [사례 검토](CASE_REVIEW.md) | 기존 실행·미상 처리·10개 문헌 항목을 보존하고 기초 결과와 연결 |
| [수학 설계](MATHEMATICAL_DESIGN.md), [학습과 평가](학습과평가설계.md) | 조건부 모델 비교·실제 학습·보정의 후속 경로. 현재 후보 선택을 확정하지 않음 |

## 7. 착수와 검증

저장소 루트에서 현재 작업 트리와 기준 커밋을 먼저 확인한다. 이 스냅샷의 `repository_sha256`은 기준 커밋의 Git blob 바이트를 해시한 값이다. Windows 체크아웃의 CRLF 변환과 구분하며, 현재 커밋의 blob이 달라졌다면 그 이후 변경부터 대조한다. 오래된 차이를 새 정본에 덮어쓰지 않는다.

```bash
git status --short
git log -1 --oneline
python docs/knowledge-model/legacy_import.py --check
python docs/knowledge-model/foundation_review.py --check
python docs/knowledge-model/knowledge_query.py 통근
npm run verify
```

`knowledge_query.py`는 현재 연구 범위의 조회다. 어떤 용어가 나오지 않아도 저장소 전체 원문에 없다는 뜻은 아니다. 정제 사전/P2의 변경 후에는 해당 빌더·인용 검사를 추가로 실행해야 하며, 루트 `verify` 통과가 모든 옛 정제 빌더 완주를 뜻하지 않는다.

Windows는 Git Bash와 실제 Python 3 실행 파일을 준비한다. Microsoft Store의 `python3` 바로가기는 정상 인터프리터가 아니며, npm의 하위 빌드도 같은 셸/경로를 쓰도록 맞춰야 한다. 이번 작업은 세션 환경으로 해결했으며 저장소의 검사 기준은 바꾸지 않았다. 브라우저가 있으면 `SMOKE_CHROMIUM`으로 지정해 실제 스모크를 실행하고 스킵 여부를 보고한다.

[검토 자료](data/foundation_review_bundle.json)는 `apply_to_runtime: false`, `use_as_training_labels: false`다. JSON을 실행 그래프에 자동 병합하거나 옛 강도를 학습 계수로 삼지 않는다. P2 차이를 재구성하려면 **기준 커밋의 해당 유닛**과 `changes`의 양쪽 필드를 읽어 별도 검토본을 만든다.

## 8. 작업을 이어 기록하는 법

- 새 사용자 방향은 `USER_INTENT_LOG.md`에 원문을 추가하고 해석을 별도로 적는다.
- 현재 우선순위는 **이 문서의 작업표 한곳**에서 갱신하고 아젠다·CURRENT_STATE·STATUS에는 결과와 링크를 남긴다.
- `FOUNDATION_AUDIT.md`, 두 JSON 스냅샷, 과거 인계는 날짜가 있는 근거다. 새 측정값으로 옛 사실을 조용히 덮어쓰지 않는다.
- 실제 변경 때 승인한 개념·관계·조건, 보류한 이유, 검사 명령·결과·스킵, 커밋·PR·머지 상태를 함께 기록한다.
- 로컬 검토 → 코드 반영 → 검사 통과 → 머지 → 앱 적용·배포를 구분한다. 이 문서 편입의 검사·머지 영수증은 해당 PR이 정본이다.

### 5.4 PR #190 뒤 실행 순서 — F02 우선6개(보존 이력)

1. 필독 문서→[체크포인트](WORK_CHECKPOINT.md)→원격 main/[PR #190](https://github.com/muteno/Saju/pull/190)을 대조한다. 미병합이면 최종 검사·검토·병합부터 마무리한다. 완료한 지장간4행·사령부28행 수정을 다시 설계하지 않는다.
2. [공백31개 원본 보고서](../../정제/문서/설계정본/20260726_사전공백31_코퍼스실측_v1.md)와 [반영 점검 §3](FOUNDATION_AUDIT.md)를 읽고 **편인도식·상관패인·재생관·관살혼잡·사길신·사흉신**의 현재 사전 항목/별칭·보드·원문을 대조한다. 과거21등재/5보류/5기각은 권고이며 현재 적용 상태가 아니다.
3. 사용자 원문14의 Figma 기본 개념 우선과 블로그 정의/조건/예외 대조를 유지한다. 옛 보고서의 ‘보드는 근거가 아니다/빈도0이면 기각’을 현재 지시로 실행하지 않는다. 출현 수를 의미 승인·학습 라벨로 쓰지 않는다.
4. 여섯 표현의 정의·참여 개념·자리/성립 조건·부정/예외·다른 저자와 반대 관점을 원문 구간/해시에 연결한다. ‘편인이 식신을 극한다’와 ‘그 결과가 실제 도식으로 성립한다’ 같은 관계·조건·결과 층을 구별한다. 단어 등록과 고정 길흉 규칙 추가를 한 작업으로 합치지 않는다.
5. 후보를 독립 개념/기존 별칭/관계·조건/보류 중 어디에 둘지 근거로 정한다. 기존 검증기는271개 보존·76판정·별칭4개만 적용하는 계약이다. 신규 개념을 넣으려면 **F02의 별도 판정·검증 형식**으로 명시적으로 확장하고, 기존76행/판본/해시를 고쳐 검사를 통과시키지 않는다. 코드 변경 전에 검토 자료만 저장하는 것도 가능하다.
6. 긴 별칭이 편인/식신/상관/정인/재성/관성 등 구성 개념을 가리지 않는지 두 빌더의 동일 입력 전체ID 전후를 측정한다. 재생관의 ‘관련/관리’ 부분문자, 패인의 일상어, 관성혼잡의 적용 범위, 사길신/사흉신의 구성·저자별 판단을 확인한다. 별칭_판정/D5·P2 재생성 전에 인용 자격을 별도 검수한다.
7. 검사 통과 단위의 중간 기록·원격 저장→최종 검사/PR/병합→다음31개 잔여 또는 필요한 F03 판본 대조로 진행한다. F01의 사령관/사령원·미등록 월령용사·단계 일상어, 통근/조후/총칭 보류를 완료로 세지 않는다.

현재 기대값: `foundation_review.py --check`는 **76차이·271개념·별칭4·176근거**, 판정67채택/5분리/4보류. F01회귀25개·Python전체135개. 마지막 검사/병합 성공은 PR 영수증을 확인한다.

```bash
git status --short
git log -3 --oneline
python3 docs/knowledge-model/foundation_review.py --check
python3 -m unittest discover -s docs/knowledge-model -p 'test_foundation_review.py'
```

코퍼스가 없으면 [통근 문서](FOUNDATION_ROOTING.md#새-체크아웃에서-다시-측정)의 생성 명령을 사용한다. 사령 전후는 `measure_month_command.py`·`data/foundation_month_command_measurement.json`에 있다. 이전 기준판/입력/코드 해시는 그대로 둔다.

### 5.5 PR #191 뒤 실행 순서 — 최초 두 주제 연결(보존 이력)

1. 필독 문서→[체크포인트](WORK_CHECKPOINT.md)→원격 main/[PR #191](https://github.com/muteno/Saju/pull/191) 영수증을 대조한다. F02 첫 묶음이 미병합이면 최종 검사·검토·병합부터 마무리한다. 완료한 F01과 여섯 명칭 등재를 다시 설계하지 않는다.
2. 사용자 원문46에 답한 [관계망 비교와 첫 연결 단위](FOUNDATION_F02_SIX.md#6-관계망은-기존-대비-어디까지-바뀌었나--사용자-원문46)부터 읽는다. **편인도식/상관패인의 조건·예외·출처를 기존 연구 노드에 붙여 조회하는 경로**를 다음 검토 단위로 우선한다. 기존 F03/F04의 자리·시간/인용 자격이 필요한 부분은 먼저 검수한다. 검색 사전277개를 연구 그래프 적재 완료로 보고하지 않는다. [판정/원문](data/foundation_f02_review.json)·[전체 측정](data/foundation_f02_measurement.json)을 출발점으로 삼되 조건 실행·길흉 승격은 별도다.
3. [공백31개 원본](../../정제/문서/설계정본/20260726_사전공백31_코퍼스실측_v1.md)의 현재 반영표를 만든다. 우선 **활인업·재고귀인·천중살·부분삼형·진도화·가도화**를 항목/별칭/관계·조건/보류로 대조한다. 천중살은 공망의 기존 `天中殺`과 먼저 비교한다. 과거21등재/5보류/5기각을 현재 적용 상태로 복사하지 않는다.
4. 보존 Figma 보드→웹/전사 원문에서 정의·자리/성립 조건·부정/예외·관법·문서별 차이를 확인한다. 명칭이 없거나 빈도가0이라는 사실만으로 개념을 기각하지 않는다. F02 첫 묶음의 재생관 보드0회/옛보고2회 차이는 아직 미확정이다.
5. 신규 등재는 F02의 별도 명시적 판정/검증 형식으로 확장한다. 현재 검사기가 고정한 여섯 명칭을 편의상 완화하거나 F01 76행·기준해시를 바꾸지 않는다. 긴 별칭이 기존 개념을 가리지 않는지 실제 두 빌더의 전체ID 전후를 비교한다.
6. `lint_aliases.py`의 비겹침 정규식은 새 추가 검색과 아직 다르다. 별칭 판정/D5·P2·정의카드·색인·정제⑦~⑨를 재생성하려면 마커/발현/인용 적격과 저장된 노드 집합 의존을 먼저 검수한다. 이번277개 등재를 앱/연구 그래프 적재 완료로 보고하지 않는다.
7. 단계별 기록·필수 검사·중간 커밋/원격 재독→최종 검토·병합→잔여31개 또는 필요한 F03 계산 판본 대조로 이어간다. F01의 총칭/통근/조후/단계·사령관/사령원·월령용사 보류와 F03 기간 정책은 유지한다.

현재 검사 기대값: F01 **76차이·271기준개념·별칭4·176근거**, 판정67채택/5분리/4보류. F02 **6개념·정표기6·근거24**, 실행277개. F01회귀25개+F02회귀13개. 최종 전체 검사·병합 성공은 PR 영수증을 확인한다.

```bash
git status --short
git log -3 --oneline
python3 docs/knowledge-model/foundation_review.py --check
python3 -m unittest discover -s docs/knowledge-model -p 'test_foundation*.py'
```

코퍼스가 없으면 [통근 문서](FOUNDATION_ROOTING.md#새-체크아웃에서-다시-측정)의 생성 명령을 사용한다. 첫 여섯 명칭의 전후는 `measure_f02_six.py`·`data/foundation_f02_measurement.json`에 보존한다. 이전 측정은 당시 소스/사전 기준이므로 현재 코드에서 그대로 재실행해도 된다는 뜻은 아니다.

### 5.6 PR #200 뒤 첫 실행 — 자정 중복 시각 수정(보존 이력)


1. 필독 문서→[F03 검수](FOUNDATION_CALCULATION_POLICIES.md)→실제 main/진행PR을 대조한다. 이번 비교 PR이 미병합이면 검사·검토·병합부터 끝낸다. 과거 STATUS/체크포인트의 ‘다음’이나 UI 진행 표시만 보고 끝난 작업을 반복하지 않는다.
2. `chart_context.mjs`의 `offsets.size>1` 감지는 `manseryeok.js`가 선택한 한쪽 UTC만 본다. **America/Sao_Paulo,2019-02-16,경도-46.633,생시 미상,보정 켬,midnight23**에서 현재1440/[19,20]이나 중복23시의 다른 UTC에서는 일주21이 가능하다. [측정](data/foundation_calculation_measurement.json)의 `overlap_witness`와 `unknown_time`을 먼저 재현한다.
3. 생시 미상·알려진 중복/없는 시각·평가 시각을 구별한다. 뉴욕2024-03-10/11-03,서울1988-10-09,Apia2011-12-30 및 자시·절입 경계에서 현재 선택 방향/누락을 대조한다. 정책 결정 없이 중복의 한쪽을 확정하거나 평균내지 않는다. 새 비교기의 정시 offset 탐색을 범용 시간대 해결기로 그대로 옮기지 않는다.
4. 후속 코드 변경 시 이 비교본을 보존하고 새 검증 판본/변경 계약을 명시한다. 기존 원문·기준 해시를 조용히 바꿔 통과시키지 않는다. Node/ICU/시간대DB 버전과 명시적 계산 옵션을 기록한다. `--check`는 코드·입력 해시/계산결과 변경을 탐지한다.
5. 강약 앱 적용은 별도다. raw와 전사에서 연지10/시지15 확인, 현재 앱15/10. 배점 교체만의 영향은128/64/14·±5. 전체 강약 경계·득세·본기 선택은 이 자료로 정답 확정되지 않는다. `judge→keyset→report→saju/Analysis/jeonggok`·생시미상12시 대체와 일주 확정 문구를 같이 검수한다. vendor 직접 편집 금지.
6. F01 총칭/통근/조후/단계·사령관/사령원·월령용사, F02 부분형3행/상형·육형·활인업/재고귀인 개인 적용·진도화 보드 자리 헤더/세부표·ASR, F03 기간/현침살, F04 P2 12개/D5, 기본풀이·실제학습은 남는다. 사전·관계·P2/D5를 무검수 재생성하지 않는다.
7. 단계별 임시기록→필수검사→검증단위 원격저장→독립검토·병합→다음 인계. 공개가 거절된 STATUS/WORK_CHECKPOINT는 재전송하지 않고 실제 절차의 영수증은 해당 PR을 확인한다.

```bash
node docs/knowledge-model/measure_calculation_policies.mjs --check
node --test docs/knowledge-model/test_calculation_policies.mjs
python3 -m unittest discover -s docs/knowledge-model -p 'test_foundation*.py'
node --test docs/knowledge-model/test_chart_context.mjs
npm run verify
```

기존 기대값: F01 76/271/4/176·검색282·기본그래프58/132/11·조건8·출처조회10주제/52주장/12관계/9분류/21조건표·42기본노드/고유46인용·학습적격0·확률null. 새 Python2개가 F03 재현기와 Node7개를 필수 게이트에서 호출한다. 최종 검사·병합은 PR 영수증을 확인한다.

### 5.7 PR #201 뒤 실행 — 강약 정책·앱 소비 경로 검수(보존 이력)

1. 필독 문서→[시간대 수정](FOUNDATION_TIMEZONE_RESOLUTION.md)→실제 main/진행PR을 대조한다. 미병합이면 최신 head 검사·검토·병합부터 끝낸다. 끝난 PR #200과 자정 중복 수정을 반복하지 않는다.
2. 현재 기본 연구 계산은 `chart_context_v2.mjs`와 `context_query.py`다. 기존 `chart_context.mjs`·F03 비교기/검토/측정은 과거 오류 재현용으로 동결한다. 새 측정의 `--check`는 소스와12개 전후 결과를 확인한다. 기존 해시를 몰래 갱신하거나 옛 어댑터를 기본값으로 되돌리지 않는다.
3. [강약 판본 검수](FOUNDATION_CALCULATION_POLICIES.md) §1~2/5의 원문을 재독한다. 보드/전사는 연지10·시지15, 앱은15·10이다. 배점만 교체한 합성128패턴은 점수64·분류14변화/±5이며 사람의 변화율이 아니다. 분류 경계·본기 도움·득세를 같은 출처의 검증된 완성정책으로 간주하지 않는다.
4. `judge→keyset→report→app/src/data/saju.ts`와 `strengthJudge→jeonggokRaw→Analysis/정곡` 두 소비 경로에서 실제 소비되는 점수·라벨·문구를 목록화하고 보정/생시미상 입력의 차이를 측정한다. 기존 정오 대체와 ‘일주 중심의 풀이는 그대로 정확’ 문구의 적용범위도 대조한다. 이번 연구어댑터 수정이 앱에 반영됐다고 보고하지 않는다.
5. 확인한 원문으로 교정 가능한 배점과 추가 의미 검수/운영자 결정이 필요한 경계를 분리해 제시한다. 기존 분류 유지+자리배점 최소교정과 출처별 별도정책의 차이를 비교한 뒤 실행범위를 정한다. 다른 저자의 총점/경계를 임의로 섞지 않는다. vendor는 정본 수정 후 동기화 스크립트로만 생성한다. UI변경이면 정본·전후실측을 먼저 준비한다.
6. F01 총칭/통근/조후/단계·사령관/사령원·월령용사, F02 부분형3행/상형·육형/개인 적용·보드자리/ASR, F03 기간/현침살, F04 P2 12개/D5, 기본풀이·실제학습은 남는다. 무검수 재생성하지 않는다. 알려진 fold의 사용자 선택, 시간대 전세계 정확성/운영 성능도 미완료다.
7. 임시기록→필수검사→검증단위 원격저장→독립검토·병합→다음 인계를 따른다. 공개가 거절된 STATUS/WORK_CHECKPOINT는 재전송하지 않고 실제 검사·병합 영수증은 PR에 남긴다.

```bash
node docs/knowledge-model/measure_timezone_resolution.mjs --check
node --test docs/knowledge-model/test_timezone_resolution.mjs
node docs/knowledge-model/measure_calculation_policies.mjs --check
python3 -m unittest discover -s docs/knowledge-model -p 'test_timezone_bridge.py'
npm run verify
```

기존 기대값: F01 76/271/4/176·검색282·기본그래프58/132/11·조건8·출처조회10/52/12/9/21·학습적격0·확률null. 새 Python3개가 시간대 회귀·후속 측정·기본 소비 경로를 필수 게이트에 연결한다. 최종 검사·병합은 PR 영수증을 확인한다.

### 5.8 PR #202 뒤 실행 — 생시 미상 공통 소비 계약(보존 이력)

1. 필독문서→[앱 소비 검수](FOUNDATION_STRENGTH_CONSUMERS.md)→실제 main/진행PR을 대조한다. 이번 감사PR이 미병합이면 최신head 검사·검토·병합부터 마친다. PR #201의 시간대수정이나48행 감사를 반복하지 않는다.
2. `profileToInput/parseShare`는 미상을12시로 대입하고 엔진입력에는 미상표시가 없다. `useReport`의 카드/정곡 가드만으로는 `Analysis→brainReading`, `Intro→myTodayFortune`, `dosaTopics`의 정오 일주상담을 막지 못한다. 미상과임시계산을 구분해 전달하는 공통계약을 설계하고 세 경로를 함께 처리한다.
3. 앱의 알려진생시·프로필/공유 왕복을 보존한다. 미상에 대해 공통 관찰값만 확정하거나 부족한 출력을 보류한다. 후보전체가 필요한 처리와 앱성능·지원기간·Intl/시간대차이를 검수한다. 연구v2는 Node 파일의존이 있으므로 그대로 브라우저import할 수 있다고 가정하지 않는다. 후보수를 확률분모로 쓰지 않는다.
4. 검수반례: 서울1990-01-01 보정켬 midnight23 일주[2,3], keepDay[1,2];2024입춘일 연[39,40]·월[1,2]·일[34,35]. 정오70/75의 단일강약·일주상담·시주관계를 확정출력하지 않는다. `reading.dialogue`의 정확문구는 현재 렌더소비 미발견이므로 문구교체만으로앱을 고쳤다고 하지 않는다.
5. UI변경은 기존 정본과디자인규칙을 읽고 전후DOM·스크린샷을 확인한다. Brain키가 존재한다는 것과 특정문장이 화면에 보인다는 것을 구분하고, 정곡함수직접값과hook가드뒤값을 구분한다. 상담근거·요약도 실제로 검사한다.
6. 이전 F03/시간대/이번 감사는 날짜가 있는 기준이다. 앱수정으로소스해시가바뀌면 기존결함을유지하거나해시만갱신하지 말고 기준재현용판본을보존한 새변경계약·전후검증을 추가한다. 지금까지의 원문·해시를 조용히 덮지 않는다. vendor는 정본수정후sync로만 생성한다.
7. 다음자리배점교정은 연10·시15근거와 기존잠정경계/도움/득세를 명시적으로분리한다. 원문귀속·하드코딩설명·키·카드·상담·정곡을 함께 검증한다. 다른저자의총점/경계를혼합하지 않는다. F01/F02잔여·F03기간/현침살·F04P2/D5·기본풀이·실제학습은 남는다.
8. 임시기록→필수검사→검증단위원격저장→독립검토·병합. 공개가거절된STATUS/WORK_CHECKPOINT는 재전송하지 않고 실제영수증은 해당PR에 한 번 기록한다.

```bash
npm run build
node docs/knowledge-model/measure_strength_consumers.mjs --check
node --test docs/knowledge-model/test_strength_consumers.mjs
npm run verify
```

현재감사48행·독립Node5회귀는빌드뒤앱게이트에서실행한다. 중첩Node검사에`NODE_TEST_CONTEXT`가전달되면조용히스킵하므로 자식환경에서제외하고5실행/5통과/0스킵을강제한다. F01 76/271/4/176·검색282·기본그래프58/132/11·조건8·출처조회10/52/12/9/21·학습적격0·확률null 유지. 최종검사·병합은 PR영수증이정본이다.

### 5.9 PR #203 뒤 실행 — 강약 자리배점 최소 교정 검수(보존 이력)

1. 필독문서→[미상 계약](FOUNDATION_UNKNOWN_BIRTH_TIME.md)→실제 main/진행PR을 대조한다. 이번 PR이 미병합이면 최신head 검사·검토·병합부터 마친다. 완료한48행 감사·미상 보류를 반복하지 않는다.
2. [F03 원문 검수](FOUNDATION_CALCULATION_POLICIES.md)와 [앱 소비 검수](FOUNDATION_STRENGTH_CONSUMERS.md)의 연지10·시지15 근거 및 현재 연15·시10을 다시 연결한다. 원문 배점과 기존 잠정 분류 경계·도움 오행·득세 조건을 별도 항목으로 명시하고 다른 저자의 총점/경계를 혼합하지 않는다.
3. `dosa-app/engine/src/judge.js`와 `keyset.js` 두 경로 및 앱의 하드코딩 설명을 대조한다. 자리배점만 바꾸는 최소안의 점수·라벨·키·카드·Brain·상담·직접정곡/hook정곡 영향을 함께 검증한 뒤 채택한다. 이전 가상38점수/22라벨 변경은 표본 측정이며 정확도나 변경률이 아니다.
4. 기존 F03·시간대·48행 자료와 `fixtures/app-consumers-v1`의 해시를 덮지 않는다. 새 정책이 엔진 정본에 반영되면 해당 엔진 기준도 별도 판본으로 보존하고 새 전후 계약을 추가한다. vendor는 정본수정 후 sync로만 생성한다.
5. 생시 미상 `withhold-unverified-v1` 계약7검사를 유지한다. 미상에 정오를 재도입하거나 후보수를 확률분모로 쓰지 않는다. 알려진 입력의 의도한 정책 변경과 무관한 변화, 공유/프로필 왕복, 실제 DOM·전후 화면을 확인한다.
6. 미상 공통관찰값/범위는 후속이다. 후보전체·성능·지원기간·Intl/시간대·중복/없는 시각을 검증하기 전 현재 보류를 축소하지 않는다. 연구v2를 Node 의존 그대로 브라우저에 import하지 않는다.
7. 임시기록→필수검사→검증단위원격저장→독립검토·병합. 공개가거절된STATUS/WORK_CHECKPOINT는 재전송하지 않고 실제영수증은 해당PR에 한 번 기록한다. F01/F02 잔여·F03 기간/현침살·F04 P2/D5·기본풀이·실제학습은 남는다.

```bash
npm run build
node docs/knowledge-model/frozen_app_audit.mjs docs/knowledge-model/measure_strength_consumers.mjs --check
node --test docs/knowledge-model/test_unknown_birth_time.mjs
npm run verify
```

과거 앱감사는 고정판본에서5실행/5통과/0스킵, 현재 계약은7실행/7통과/0스킵을 강제한다. F01 76/271/4/176·검색282·기본그래프58/132/11·조건8·출처조회10/52/12/9/21·학습적격0·확률null 유지. 최종검사·병합은 PR영수증이정본이다.

### 5.10 PR #204 뒤 실행 — 월률분야·사령 기간 판본 검수(보존 이력)

1. 필독문서→[자리배점 교정](FOUNDATION_STRENGTH_CORRECTION.md)→실제 PR/main/tree를 대조한다. 미병합이면 최신head 검사·검토·병합부터 마치고 완료한 자리교정을 반복하지 않는다.
2. [월률분야·사령 검수](FOUNDATION_MONTH_COMMAND.md) §1~3과 [지장간 단계 검수](FOUNDATION_HIDDEN_STAGES.md)를 읽는다. `month_board_scope`, `month_choco_period`, `month_sagong_wu_table`, `month_sagong_deuknyeong`, `month_choco_other_positions`, `month_sagong_other_stems`의 실제 원문·인접 문맥을 다시 확인한다. 존재하지 않는76차이 행이나 판본 포인터를 만들지 않는다.
3. 저자별 기간표·월지/다른 자리·본기 구성·사령/득령을 분리한 새 검토표를 만든다. 오10/10/10 대10/9/11, 묘33/67 대30/60, 지장간 구성과 작용력 수치를 혼합하지 않는다.
4. 실제 절입시각·출생 절대시각/시간대·경과일·시작/끝 포함·30일 환산이 원문에 있는지 확인한다. 부족하면 기간 판정과 개인 적용을 보류하고 근거와 재개조건을 기록한다. 기존 `HIDDEN_STEMS`의 마지막 본기 계약을 기간·강약·확률로 바꾸지 않는다.
5. 근거가 충분한 최소 범위에서 같은 입력의 출처별 후보/미상 차이를 재현한다. 출처 미확정 단일정책을 앱에 자동 적용하지 않는다. 새 측정은 별도 판본으로 두고 F03/시간대/48행/자리교정 원본·해시를 보존한다.
6. 생시 미상 `withhold-unverified-v1`과 알려진입력 자리배점 교정 계약을 유지한다. 후보수를 확률분모로 쓰거나 연구v2를 그대로 브라우저에 이식하지 않는다.
7. 임시기록→필수검사→독립검토→원격저장·병합·다음 현침살 판본 재개점. 공개가 거절된 STATUS/WORK_CHECKPOINT는 재전송하지 않는다. 현침살→F04 P212개/D5→기본풀이와 실제학습은 후속이다.

```bash
npm run build
node docs/knowledge-model/measure_strength_correction.mjs --check
node --test docs/knowledge-model/test_strength_correction.mjs
node --test docs/knowledge-model/test_unknown_birth_time.mjs
npm run verify
```

과거소비5·현재미상7·새교정7검사의 실제 실행·통과·스킵0을 확인한다. 검색282·기본그래프58/132/11·조건8·출처조회10/52/12/9/21·학습적격0·확률null 유지. 보드 자리배점과 잠정 분류 전체를 구분하고 실제 검사·병합은 PR영수증을 따른다.

### 5.11 PR #205 뒤 실행 순서 — 현침살 판본·자리/발현 조건 검수(보존 이력)

1. 필독문서→[기간 판본 검수](FOUNDATION_MONTH_PERIODS.md)→실제 PR/main/tree를 대조한다. 미병합이면 최신head 검사·독립검토·병합부터 마치고 기간 검수를 반복하지 않는다.
2. `dosa-app/engine/src/sinsal.js`의 `HYEONCHIM_STEM={0,7}`·`HYEONCHIM_BRANCH={3,6,7,8}`과 주석, `tables.js`의 천간/지지 인덱스, report와 앱 소비처를 함께 읽는다. 갑/신(辛)과 묘/오/미/신(申)을 구별하고, 기록된 판본 차이를 실제 원문에서 확인한다.
3. 보존 보드→블로그/전사에서 현침살의 구성·자리·동주/인접·개수·원국/운·발현 조건과 부정/예외를 검수한다. 단순 글자 존재와 개인 성향/사건을 분리한다. 기존 사전 등재가 규칙 의미 검수 완료는 아니다. 미검수 ASR을 교정된 정답으로 쓰지 않는다.
4. 검수한 출처별 판본을 실제 엔진 조건과 같은 입력으로 대조한다. 출처가 충분하지 않으면 보류하며 다른 저자의 조건을 임의로 합치지 않는다. 앱 교정이 필요하면 실제 소비범위·미상 보류·전후 DOM/화면·독립검토까지 갖춘 별도 변경 계약으로 진행한다. vendor 직접 편집 금지.
5. 이번 기간 비교는 실제 절입/출생 계산이 아니다. 기간정책을 재개하려면 명시 시간대/절입·기산·끝점 포함·30일 환산/초과 처리·해당 판본의 천간 대응과 저자 반론을 확보한다. 원문23구간·312행·기존 F03/시간대/48행/자리교정 해시는 보존한다.
6. 미상 `withhold-unverified-v1`·강약 연지10/시지15와 잠정 분류의 구분을 유지한다. 후보 수를 확률분모로 쓰지 않는다. F01/F02 보류·F04 P2 12개/D5·기본풀이·실제학습은 후속이다.
7. 임시기록→필수검사→독립검토→원격저장·병합·다음 재개점. 공개가 거절된 STATUS/WORK_CHECKPOINT는 재전송하지 않고 최종 영수증은 해당 PR에 한 번 기록한다.

```bash
python3 docs/knowledge-model/month_period_review.py --check
python3 -m unittest discover -s docs/knowledge-model -p 'test_month_period_review.py'
rg -n '현침|HYEONCHIM' dosa-app/engine/src app/src
npm run verify
```

현재 기간회귀10개·312합성행, 과거소비5·미상7·자리교정7의 실제실행/스킵0을 확인한다. 검색282·기본그래프58/132/11·조건8·출처조회10/52/12/9/21·학습적격0·확률null은 그대로다. 최종검사·병합은 PR영수증이정본이다.

### 5.12 PR #206 뒤 실행(보존 이력) — 현침살 후보/발현 분리 앱 소비 계약 검수

1. 필독문서→[현침살 검수](FOUNDATION_HYEONCHIM.md)→실제 PR/main/tree를 대조한다. 미병합이면 최신head 검사·독립검토·병합부터 마치고 원문/240입력 검수를 반복하지 않는다.
2. PR #205 병합후 지적의 현재 기간 검수 진입점은 `month_period_claim_guard.py`다. 옛 `month_period_review.py`는 원문/312측정과 함께 역사 재현용이며 그 자체의 근거 연결 검증을 강화한 것은 아니다. 이어 `sinsal.js`의 자리/간지 표시→`keyset.js`→`report.js`→앱 카드/상담 전달을 실제 KB로 대조한다. 이번62입력은 빈KB의 이름 전달 검사이며 실제 발췌·전체 소비·UI 검증이 아니다.
3. 글자 후보·개수와 저자별 발현 조건/미확정을 분리하는 최소 계약을 정한다. 보드24표시/20개수조건·4未공란·정(午) 헤더, 전사3개/합/지장간·반론을 보존한다. 공란을 부정, ASR을 정답, 개수를 확률로 바꾸지 않는다.
4. 개인 성향/직업/사건으로 확정되는 소비 경로를 확인하고 필요하면 해석 보류·관찰표시를 기존 디자인으로 구현한다. 미상 공통보류와 알려진 입력 전체, 실제KB·DOM/화면 전후·독립검토를 갖춘다. vendor 직접 편집 금지.
5. 기존 F03/시간대/소비48행/강약교정/기간312행과 이번 검수의 동결20파일 해시는 보존한다. 후속 수정이 동결 범위에 닿으면 과거 감사 재현 경로를 먼저 분리한다. 출처별 기간정책의 절입·기산·끝점/30일 환산도 여전히 보류다.
6. 다음은 F04 P2 12개와 D5 인용 자격. F01/F02 잔여·기본풀이·실제학습은 유지한다. 검색282·그래프58/132/11·조건8·출처조회10/52/12/9/21·학습적격0·확률null이다.
7. 임시기록→필수검사→독립검토→원격저장·병합. 공개거절된 STATUS/WORK_CHECKPOINT는 재전송하지 않고 최종 영수증은 PR에 한 번 기록한다.

```bash
python3 docs/knowledge-model/month_period_claim_guard.py --check
python3 docs/knowledge-model/hyeonchim_review.py --check
python3 -m unittest discover -s docs/knowledge-model -p 'test_hyeonchim_review.py'
rg -n 'auspicious|byTopic.sinsal|현침' dosa-app/engine/src app/src
npm run verify
```

현침13회귀·기간근거7·과거기간10·과거소비5·미상7·자리교정7을 실제 실행하고 스킵0을 확인한다. 최종검사·병합은 PR영수증이 정본이다.

### 5.13 PR #207 뒤 실행(보존 이력) — F04 P2 12개 판본·D5 인용 자격

1. 필독문서→[현침살 소비 계약](FOUNDATION_HYEONCHIM_CONSUMERS.md)→최신 PR의 merged·main·검증tree를 대조한다. 미병합이면 최신head 검사·독립검토·병합부터 마친다. 후보/보류 작업을 다시 시작하지 않는다.
2. [판본 비교](data/foundation_review_bundle.json)의 P2 12개 양쪽 값과 [F01검토](FOUNDATION_REVIEW.md)의 D5 인용 자격을 읽는다. 선택자료 스냅샷의 원문 위치 일치와 의미 검수·개인적용 자격은 다르다.
3. 12개 ID별 양쪽 원문/링크·판정·근거·조건·예외·미상 처리 차이를 보존한 비교표와 독립검사를 만든다. 검수 안 된 기존판을 새 의미 승인으로 바꾸거나 P2/D5를 일괄 재생성하지 않는다. 근거가 부족하면 보류 사유를 적는다.
4. 현침의 명시 이름 기반 보류·미상 공통보류·강약 교정과 원래 감사 해시를 유지한다. 과거 현침검사는 아래 고정runner를 사용한다. 원문 직접 검사기를 변경된 현재앱에 맞춰 해시 갱신하지 않는다.
5. 검색282·그래프58/132/11·조건8·출처조회10/52·학습적격0·확률null을 구별한다. [진행률20개 기준](PROJECT_PROGRESS.md)을 그대로 사용하고 완료기준12가 통과·병합될 때만 분자를 늘린다.
6. F01/F02잔여, 기간/전체강약/앱시간대 정책, 60일주·문장별 근거·실제학습은 남는다. 임시기록→필수검사→독립검토→원격저장·병합을 진행하고 공개거절된 STATUS/WORK_CHECKPOINT는 재전송하지 않는다. 실제 영수증은 해당PR에 한 번 기록한다.

```bash
node docs/knowledge-model/measure_hyeonchim_consumers.mjs --check
node docs/knowledge-model/frozen_hyeonchim_audit.mjs --python docs/knowledge-model/hyeonchim_review.py --check
python3 docs/knowledge-model/month_period_claim_guard.py --check
npm run verify
```

현재현침11·미상7, 과거현침13·강약7·소비5 및 기간검사를 생략없이 실행한다.

### 5.14 PR #208 뒤 실행(보존 이력) — 통근4조건 후보 검수

1. 필독문서→[P2/D5 감사](FOUNDATION_P2_D5.md)→최신PR merged·head/merge/main tree를 대조한다. 미병합이면 검사·독립검토·병합을 먼저 마친다. 완료한 판본 감사를 다시 만들지 않는다.
2. `data/legacy_review.json`의 통근 후보 `legacy_candidate_e6ae40a2c5f49866760a`, `legacy_candidate_37d94c50ce3a4be489a0`, `legacy_candidate_51b7d3ebc8fd2f9e9272`, `legacy_candidate_f6a14a608168bad599d0`를 읽는다. 첫 항목은 SG-MID-P012-02, 나머지3개는 -04의 같은 근거그룹이다. 현재 넓은 앵커 매칭을 원문 의미 승인으로 쓰지 않는다.
3. 실제 수기 출처·원문 문단을 복원하고 [F01 통근](FOUNDATION_ROOTING.md)의 동일글자/동일오행/생조·자리/거리 판본과 대조한다. 저자별 조건·부정·예외·자리·원국/운·미상을 분리한다. 동주·거리·다저자합의를 근거 없이 합치지 않는다.
4. 기존 원문·P2·D5·별칭판정·legacy 카탈로그와 감사해시는 보존한다. 새 검토층에 출처와 범위를 붙이며 검수 없는 P2/별칭 재생성·개인효과·학습 승격은 금지한다. 후보4개는 독립4지지가 아니다.
5. 이번 D5는 저장소25/로컬3차단·롤업1. `--check`는 재현만 exit0, `--strict-d5`는 실제 실패 때문에 exit1이다. 원문 위치 일치88/90·새회귀와 의미보류를 구별한다.
6. 미상보류·강약교정·현침소비와 과거감사를 유지한다. F01/F02잔여·계산 전체정책·기본60일주·학습/평가는 미완료다. 관리기준12는 감사 병합 뒤만 완료, 기준13은 아직 진행으로 남긴다.
7. 임시기록→필수검사→독립검토→원격저장·병합. 공개거절된 STATUS/WORK_CHECKPOINT는 재전송하지 않고 최종영수증은 해당PR에 한 번 남긴다.

```bash
python3 docs/knowledge-model/p2_d5_review.py --check
python3 -m unittest discover -s docs/knowledge-model -p 'test_p2_d5_review.py'
npm run verify
```

### 5.15 PR #209 뒤 실행(보존 이력) — 기본풀이 대표 문장 묶음 검수

1. 필독문서→[통근4후보 검수](FOUNDATION_ROOTING_CANDIDATES.md)→최신PR merged·head/merge/main tree를 대조한다. 미병합이면 최종검사·독립검토·병합부터 끝낸다. P2/D5와 통근4후보 검수를 반복하지 않는다.
2. [기본풀이 계획](BASIC_READING_PLAN.md), `basic_reading_findings.json`, `dosa-app/kb/distilled/ilju/`의60파일·402초안 현재 수를 재확인한다. 과거 집계를 현재 실측으로 복사하지 않는다.
3. `dosa-app/engine/src/report.js`→`app/src/data/saju.ts`에서 문장·발췌·출처가 실제 조립되는 경로를 추적한다. 첫 출처를 여러 문장에 붙이는 경로와 문장별 정확한 귀속을 구별한다.
4. 오류 유형을 대표하는 작은 일주 묶음을 근거로 선정하고 문장→원문 구간→조건/예외/반론·관점·시점/미상 검토표를 만든다. 인사말/목차, 조건 손실, 출처 혼합을 분리하고 원문이 부족하면 보류한다. 작은 표본을60일주 완료로 세지 않는다.
5. 통근 자료는 후보4·2문단·1게시글이며 개인효과/확률은 미확정이다. 비교 저자별 같은글자/오행/생조를 섞지 않는다. 기존 카탈로그·P2/D5·별칭·감사 해시를 덮거나 검수 없이 재생성하지 않는다.
6. 앱 수정이 필요하면 실제KB·개인 입력·문장별 근거와 미상/현침 보류·강약교정·전후DOM/화면을 갖춘 별도 계약으로 진행한다. vendor 직접수정 금지. 기존 조건8·출처조회10/52와 새 문장 검토층을 구별한다.
7. 임시기록→필수검사→독립검토→원격저장·병합·다음 인계를 남긴다. 기준13/14는 아직 미완료이고 관리진행률9/20=45%다. 공개거절된 STATUS/WORK_CHECKPOINT는 재전송하지 않고 최종영수증은 해당PR에 한 번 기록한다.

```bash
python3 docs/knowledge-model/rooting_candidate_review.py --check
python3 -m unittest discover -s docs/knowledge-model -p 'test_rooting_candidate_review.py'
python3 docs/knowledge-model/p2_d5_review.py --check
npm run verify
```
