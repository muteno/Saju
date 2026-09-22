1. [의도] 사용자의 말에서 진짜 목적을 파악해 그걸 해결한다. 간단한 일은 빠르게, 큰 일은 시작 전에 계획 한 줄 공유한다.
2. [확인] 불확실하면 파일이나 웹으로 확인한다. 추측 금지. 못 확인하면 「미확인」이라고 말한다.
3. [디자인] 새 디자인을 만들지 않는다. 같은 리포지토리 안의 기존 디자인·컴포넌트를 쓴다.
4. [전후] UI 변경은 전과 후를 보여준다. 시각 변경은 이미지나 html로.
5. [완료] 작업 끝 = 머지까지. 단 충돌·체크 실패·비가역 작업이면 멈추고 묻는다.
6. [보고] 딱 3줄: ①결과(실패는 실패라고) ②바뀐 것 ③머지 여부 + 다음 액션.

## 이 레포 전용 (saju)
- 매 세션 시작 시 사용자 의도 원문 `docs/knowledge-model/USER_INTENT_LOG.md` → 현재 아젠다 `docs/knowledge-model/PROJECT_AGENDA.md` → 구현 범위 `docs/knowledge-model/CURRENT_STATE.md`·기본 풀이 계획 `docs/knowledge-model/BASIC_READING_PLAN.md`를 먼저 읽는다. 전체 시작 안내 = `AGENTS.md`.
- 새 방향은 원문 기록에 추가하고 아젠다·STATUS에 반영한다. 앞선 발언·모순·수정 맥락을 지우거나 사용자 예시를 정답·학습 라벨로 확정하지 않는다. 첫 사용 가능한 목표는 출처가 붙은 일주·기본 성향 풀이이며, 시제품을 완성된 해석 알고리즘으로 보고하지 않는다.
- 실제 앱 = `app/`(Vite+React+TS) · 루트 스크립트로 빌드(Cloudflare Pages가 루트에서 빌드해 dist/ 산출) · 세션 규범·현황 = `dosa-app/STATUS.md`.
- 커밋 전 `npm run verify`(= `scripts/verify.sh`) · 디자인 토큰 락 = `npm run lock:tokens`(= `scripts/check_tokens.mjs`) — 미승인 신규 토큰은 게이트 차단.
- 디자인 규칙 = `docs/디자인토큰_제1핵심명령.md` + `docs/디자인방식론_지침.md` — 새 색·px·radius 창작 금지, 없는 값이 필요하면 멈추고 운영자에게 묻는다.
- 작업 이력·요구사항 = `docs/작업이력.md` · `docs/요구사항_큐.md`.
