# Saju 문맥 조건부 지식망 — v0.1

기본 개념을 추출하고, 함께 놓이는 키워드·다중 변수·시점에 따라 달라지는 관계를 학습하기 위한 첫 작업본이다. 특정 앱에서 여는 노트가 목표가 아니며, 사용자 설명에 등장한 예시를 정답이나 규칙으로 채택하지 않는다.

먼저 `READ_FIRST.md`, `USER_INTENT_LOG.md`, `PROJECT_AGENDA.md`, `BASIC_READING_PLAN.md`를 읽는다. 원문 기록은 최신 요약으로 덮어쓰지 않는다.

## 포함한 것

| 파일 | 역할 |
|---|---|
| `PROJECT_AGENDA.md` | 진화 가능한 프로젝트 목적·설계 원칙·완료 기준 |
| `USER_INTENT_LOG.md` | 사용자의 관련 발언 26개와 이해 수정의 흐름 |
| `MATHEMATICAL_DESIGN.md` | 논문에 근거한 수학적 후보와 현재 기준 모델 |
| `학습과평가설계.md` | 원문 추출·라벨링·조합·시간·출처 분리 평가 |
| `knowledge_graph.json` | 기본 개념 18개를 포함한 58개 노드, 132개 관계, 11개 다중 입력 관계 |
| `data/basic_concepts.json` | 블로그에서 추린 18개 개념의 정의·별칭·근거·미해결 조건 |
| `data/source_candidates.json` | 기호 관계·분류·조건부 주장·원문 충돌 후보 |
| `data/unresolved_reference_conflicts.json` | 운영자 참고 보드의 미해결 충돌, 독립 증거로 집계하지 않음 |
| `review_queue.jsonl` | 관계와 다중 입력 관계 143건의 검토 대기열, 정답 라벨 미부여 |
| `conditional_model.py` | 연속 입력과 다중 상호작용을 지원하는 조건부 로지스틱 기준 모델 |
| `context_demo.json` | 미학습 모델과 별도로 표시한 추상적·합성 시연 입력 |
| `knowledge_query.py` | 노드·관계·조건·출처 조회, 동음이의어 구별 |
| `legacy_import.py`, `data/legacy_review.json` | 기존 조건·분기 후보와 원문·개념 대응을 재현하는 검토 입력 |
| `LEGACY_MIGRATION.md` | 기존 지도와 현재 모델 비교, 이관 범위와 미확인 항목 |
| `chart_context.mjs`, `context_query.py` | L1 원국·시간 관찰값 산출과 원문 문맥을 복원한 조건 8개 판정 |
| `data/context_reviews.json`, `CONTEXT_BRIDGE.md` | 조건식·주변 원문·해시와 입력·측정·미상 처리 규약 |
| `case_review.py`, `compare_models.py`, `CASE_REVIEW.md` | 사례·라벨·의존 자료·시점 검사와 같은 자료에서 조합 유무 모델 비교 |
| `data/case_review_pilot.json` | 검토용 계산 예제 6개와 제안 목표·빈 라벨. 실제 학습 자료가 아님 |
| `source_case_review.py`, `reported_context.mjs`, `data/source_cases.json`, `SOURCE_CASES.md` | 원문 명식 6개·32개 인용 검토, 미상/충돌/중복 보존과 조건 대조. 학습 라벨 아님 |
| `rules_engine.py` | 별도 부록: 천간·생극·십신 기호 분류 검증 |
| `evaluation_rubric.json` | 아직 수행하지 않은 사람 검수 과제 10개 |
| `validation_report.json` | 이번에 실제 수행한 코드·원문 확인 결과 |

학습 선행·편집상 연결 33개는 `editorial_links`로 분리했다. 이 연결은 문헌이 입증한 관계나 확률 학습 라벨이 아니다. 관계 원문 100개 구간을 통합 보관하며, 합치기 전 추출 인용 138건의 원문 일치 감사도 `data/evidence_audit.json`에 있다.

## 실행

Python 3.10 이상, 표준 라이브러리만 사용한다. 원국 연결에는 기존 엔진을 실행할 Node.js도 필요하다. 저장소 루트에서 `cd docs/knowledge-model`로 이동해 실행한다. 별도 배포 ZIP에서는 압축을 푼 뒤 이 파일이 있는 폴더에서 실행한다.

```bash
python build_graph.py
python legacy_import.py
python legacy_import.py --check
python knowledge_query.py 식신
python knowledge_query.py 신
python conditional_model.py
python conditional_model.py --demo
python context_query.py --input data/context_example.json --term 재성
python case_review.py
python source_case_review.py --summary
python case_review.py --compare
python -m unittest discover -p 'test_*.py'
node --test test_chart_context.mjs
```

`신`은 천간과 지지 후보가 함께 반환된다. 의미가 확정되지 않은 입력을 하나로 합치지 않는다.

기존 조건·분기 후보는 조회 결과의 `legacy_review`에 포함한다. 직접 대응된 개념의 검토 자료만 가져오며 원문 미확인 항목도 상태를 표시한다. `query(term, graph, legacy=bundle)`로도 사용한다. 그래프가 바뀌면 이관 스냅샷을 다시 생성해야 하며, 원문·기존 자료가 생략된 배포 ZIP에서는 이관 재생성을 실행할 수 없다. 후보 조회는 원국 적용이나 학습된 확률 출력이 아니다.

기본 확률 실행은 매개변수가 미학습 상태이므로 `probability: null`이다. `--demo`에서만 추상 키워드 X·Y와 조건 A·B에 대해 임의의 시연 매개변수를 사용한다. 이 숫자는 문헌에서 측정한 값이나 사주 정확도가 아니다.

특징 입력의 0은 관찰된 부재, 1은 완전한 활성, 중간값은 정의된 측정 기준에 따른 정도이며 `null`은 미상이다. `chart_context.mjs`는 원국의 기호 존재·구성 비율과 세운·월운, 명시된 기간의 대운 기호를 산출한다. 비율은 고정 자리 수에 대한 무가중 개수이며 강약·확률이 아니다. 조건 8개의 앞뒤 문맥 복원·미상 처리·모델 연결 범위는 `CONTEXT_BRIDGE.md`를 따른다. 이 실행에는 저장소의 L1 엔진·절기표·원문 DOCX가 필요하다.

해석 후보가 동시에 성립할 수 있으면 각각의 sigmoid 출력을 사용한다. 후보가 서로 배타적이라고 명시한 비교 모드에서는 softmax를 사용한다. 모든 해석의 합을 무조건 1로 맞추지 않는다. 현재의 개별 후보 모델은 후보들 사이의 전체 결합분포를 학습하지 않으며, 이는 향후 요인 그래프/PSL 비교 범위다.

## 학습 입구

원국 기반의 새 검토 입력은 `CASE_REVIEW.md`를 따른다. `case_review.py`는 원국을 다시 계산하고 라벨 근거·상태와 출처·인물·시점 분리를 확인한다. `--compare`는 같은 적격 사례·입력·학습 설정에서 개별 항과 조합 항 모델을 비교한다. 동봉 예제 6개는 라벨이 없고 학습 대상도 아니므로 현재 비교는 `blocked`와 모델 null을 반환한다. 실제 사건 확률은 이 경로의 학습 대상이 아니다.

`conditional_model.fit`은 문맥·라벨·출처 집단이 있는 검토된 학습 사례를 받는다. `context_demo.json`의 `synthetic_training_cases`는 형식과 테스트용이며 실제 학습 자료가 아니다. 실제 라벨은 아직 수집·확정하지 않았다.

```bash
python conditional_model.py --fit reviewed_cases.json --holdout-group held_out_author
```

학습은 BCE 목적함수와 L2 정규화, 출처 집단별 분리를 지원한다. 최소 두 학습 집단과 별도의 한 평가 집단이 필요하다. 현재 CLI가 반환하는 학습 모델의 추론은 Python의 `predict(fitted_model, context)`로 수행한다. 학습 결과를 저장할 경우 새 버전 파일로 저장하고 어떤 라벨·출처·시점으로 학습했는지 유지한다.

위 저수준 `fit` 함수 자체는 원국 재계산·인물/파생 관계·시점 검사를 하지 않는다. 새 원국 사례는 `case_review.py --compare` 경로를 사용한다. 검토자의 실제 자격과 외부 자료의 진위는 코드가 인증하지 않으며, 합성 검사 결과를 사주 해석 정확도로 보고하지 않는다.

`review_queue.jsonl`은 학습 사례와 다르다. 문헌의 관계 후보를 검토하기 위한 대기열이다. 출처의 문장을 확인하고 적용 조건과 예외를 정리한 뒤, 명시적인 학습 대상과 문맥을 갖춘 사례로 작성한다. 출현 빈도를 바로 정답 라벨로 변환하지 않는다.

## 현재 경계

- 블로그 우선으로 일부 기본 개념과 근거를 추렸다. 전체 76개 DOCX의 의미 추출이 끝난 상태가 아니다.
- 문헌에서 관계를 추출한 정확성과 현실 결과를 예측하는 정확성은 별도로 평가한다.
- 원국·세운·월운 관찰값과 사용자가 기간을 명시한 대운을 연구 CLI에 연결했다. 정확한 대운 시작일의 출생 기반 산출, 강약·통근 정도, 시간별 재학습과 앱 추론 적용은 후속 작업이다.
- PSL, 요인 그래프, GATv2는 조사한 후보다. 현재 코드에 이 모델들을 구현하거나 학습했다고 주장하지 않는다.
- 원본 자료는 수정하지 않았다. 이 패키지는 원본 ZIP의 재배포본이 아니라 파생 작업본이다.

후속 작업 순서는 `CURRENT_STATE.md`를 따른다.

## Figma 기본 개념 자료

[FIGMA_FOUNDATION.md](FIGMA_FOUNDATION.md)는 기존 보드 텍스트 추출본과 18개 기본 개념을 연결한다. `data/figma_foundation_bindings.json`에 원문 줄·발췌·해시·확인 수준을 저장하고, `build_graph.py`는 이 참조를 개념 노드에 붙인다. `knowledge_query.py`는 블로그 근거와 함께 Figma 원천 개념 참조도 반환한다. 기존 보드 스냅샷을 재사용한 것이며 최신 Figma 동기화 완료를 뜻하지 않는다.

### 현재 보드 직접 읽기와 구조 조회

[FIGMA_LIVE_REVIEW.md](FIGMA_LIVE_REVIEW.md)에 최신 세션의 노드 ID·표 셀·보드 연결선 검수 결과를 기록했다. 과거 보드 참조와 별도인 `data/figma_live_bindings.json` 및 `data/figma_live_structure.json`을 사용한다. `knowledge_query.py`는 현재 보드의 검수 인용도 반환한다. 도식 선은 학습된 확률 관계가 아니다.

연결선 탐색은 `python knowledge_query.py 십신 --diagram-context`로 확인한다. 직접 부착된 선과 인용 섹션의 도식을 구별하며, 서로 다른 스냅샷은 혼용하지 않는다.
