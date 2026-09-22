#!/usr/bin/env bash
# 만능 품질 게이트 — 어느 세션·어느 모델이든 이 하나만 통과하면 퀄리티 하한이 보장된다.
# 세션 규범: 작업 전/후로 `npm run verify` (또는 bash scripts/verify.sh) 를 돌린다.
# 하나라도 실패하면 비-0 종료 → 커밋/머지 금지.
set -euo pipefail
export TZ='Asia/Seoul'   # 골격 [12] KST 강제 — 러너는 UTC (평의회 260717)
cd "$(dirname "$0")/.."
fail=0
step() { echo ""; echo "▶ $1"; }

step "1/8 기틀 게이트(check_refs — 정적이라 최우선) + 파생물 재생성"
python3 shared/check_refs.py || fail=1
python3 dosa-app/kb-tools/extract_bodies.py || fail=1
python3 docs/knowledge-model/legacy_import.py --check || fail=1
python3 -m unittest discover -s docs/knowledge-model -p 'test_*.py' || fail=1

step "2/8 디자인 토큰 게이트 (계승/갱신 규율 — 정본 docs/디자인토큰_제1핵심명령.md)"
node scripts/check_tokens.mjs || fail=1

step "3/8 엔진 vendor 동기화 (앱 사본이 원본과 일치하는지 — 드리프트 0 강제)"
node scripts/sync_engine.mjs --check || { echo "  ✗ vendor 드리프트! 'npm run sync:engine' 후 커밋"; fail=1; }

ENG_LOG=$(mktemp); BUILD_LOG=$(mktemp)
step "4/8 만세력 엔진 테스트 (포스텔러 픽스처)"
node dosa-app/engine/test/test_manseryeok.mjs >"$ENG_LOG" 2>/dev/null && tail -1 "$ENG_LOG" || { cat "$ENG_LOG"; fail=1; }

step "5/8 증류 반환각 검증 + 시험은행 리플레이 (PASS 지식이 계속 찾아지는가)"
python3 dosa-app/kb-tools/validate_distilled.py || fail=1
python3 dosa-app/kb-tools/replay_exams.py || fail=1

step "6/8 앱 프로덕션 빌드 (tsc + vite → dist/)"
npm run build >"$BUILD_LOG" 2>&1 && ls app/dist/kb-*.json >/dev/null 2>&1 && echo "  ✓ 빌드 성공(kb 번들 동봉 확인)" || { tail -20 "$BUILD_LOG"; echo "  ✗ 빌드 실패 또는 dist에 kb-*.json 없음"; fail=1; }

# 산출물 CSS 회귀 — 무접두 backdrop-filter가 살아 있나.
# 260726 실측: 소스에 무접두를 **먼저** 쓰고 `-webkit-`을 나중에 쓰면 미니파이어가 둘을 같은 속성의
# 중복으로 보고 뒤엣것만 남긴다 → 크롬은 `-webkit-`을 안 받아 **유리가 앱 전 화면에서 죽는다**.
# 렌더로만 잡히던 사고라 산출물에서 직접 본다(빌드 뒤에 있어야 해서 6.5단계다).
grep -q "[;{]backdrop-filter:blur" app/dist/assets/*.css \
  && echo "  ✓ 무접두 backdrop-filter 생존(유리 실동작)" \
  || { echo "  ✗ 산출물 CSS에 무접두 backdrop-filter가 없다 — index.css에서 -webkit-를 **먼저**, 표준을 **나중에** 쓰라"; fail=1; }

step "7/8 앱 데이터·상담 API 회귀 검사"
npm run test:app || fail=1

step "8/8 브라우저 스모크 (홈·결과 실렌더 + kb 적재 — 브라우저 없는 환경은 자동 스킵)"
node scripts/smoke.mjs || fail=1

echo ""
if [ "$fail" -eq 0 ]; then echo "✅ 전체 게이트 통과 — 커밋/머지 가능"; else echo "❌ 게이트 실패 — 위 항목 수정 후 재실행"; exit 1; fi
