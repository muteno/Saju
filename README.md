# Saju

사주 자료에서 기본 개념과 조건을 추려, 원국의 구성·키워드 조합·대운 등 시간 맥락을 반영하는 대화형 풀이를 만드는 프로젝트입니다.

## 작업을 이어받을 때

- [사용자 원문 기록](docs/knowledge-model/USER_INTENT_LOG.md): 최초 설명부터 수정 과정까지 보존합니다.
- [프로젝트 아젠다](docs/knowledge-model/PROJECT_AGENDA.md): 현재 목표와 아직 열려 있는 설계 질문입니다.
- [기본 풀이 개발 계획](docs/knowledge-model/BASIC_READING_PLAN.md): 일주·기본 성향 풀이를 먼저 갖추는 순서입니다.
- [Figma 기본 개념 연결](docs/knowledge-model/FIGMA_FOUNDATION.md): 기존 보드 자료를 개념층에 연결한 범위와 다음 보강 사항입니다.
- [지식망·수학 연구·시제품](docs/knowledge-model/README.md): 출처가 붙은 자료와 현재 실행 코드입니다.
- [현재 세션 현황](dosa-app/STATUS.md), [에이전트 필독](AGENTS.md), [작업 규칙](CLAUDE.md)

자료와 코드 시제품이 존재하는 것과 사주 해석 모델의 품질이 검증된 것은 구별합니다. 원문 기록의 예시는 학습 정답으로 사용하지 않습니다.

실제 웹 앱은 `app/`에 있으며 루트에서 `npm run verify`로 저장소 품질 게이트를 실행합니다.
