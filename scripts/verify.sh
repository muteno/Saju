#!/usr/bin/env bash
# 만능 품질 게이트 — 어느 세션·어느 모델이든 이 하나만 통과하면 퀄리티 하한이 보장된다.
# 세션 규범: 작업 전/후로 `npm run verify` (또는 bash scripts/verify.sh) 를 돌린다.
# 하나라도 실패하면 비-0 종료 → 커밋/머지 금지.
set -euo pipefail
export TZ='Asia/Seoul'   # 골격 [12] KST 강제 — 러너는 UTC (평의회 260717)
cd "$(dirname "$0")/.."
fail=0
step() { echo ""; echo "▶ $1"; }

step "1/6 기틀 게이트(check_refs — 정적이라 최우선) + 파생물 재생성"
python3 shared/check_refs.py || fail=1
python3 dosa-app/kb-tools/extract_bodies.py || fail=1

step "2/6 엔진 vendor 동기화 (앱 사본이 원본과 일치하는지 — 드리프트 0 강제)"
node scripts/sync_engine.mjs --check || { echo "  ✗ vendor 드리프트! 'npm run sync:engine' 후 커밋"; fail=1; }

ENG_LOG=$(mktemp); BUILD_LOG=$(mktemp)
step "3/6 만세력 엔진 테스트 (포스텔러 픽스처)"
node dosa-app/engine/test/test_manseryeok.mjs >"$ENG_LOG" 2>/dev/null && tail -1 "$ENG_LOG" || { cat "$ENG_LOG"; fail=1; }

step "4/6 증류 반환각 검증 + 시험은행 리플레이 (PASS 지식이 계속 찾아지는가)"
python3 dosa-app/kb-tools/validate_distilled.py || fail=1
python3 dosa-app/kb-tools/replay_exams.py || fail=1

step "5/6 앱 프로덕션 빌드 (tsc + vite → dist/)"
npm run build >"$BUILD_LOG" 2>&1 && ls app/dist/kb-*.json >/dev/null 2>&1 && echo "  ✓ 빌드 성공(kb 번들 동봉 확인)" || { tail -20 "$BUILD_LOG"; echo "  ✗ 빌드 실패 또는 dist에 kb-*.json 없음"; fail=1; }

step "6/6 브라우저 스모크 (홈·결과 실렌더 + kb 적재 — 브라우저 없는 환경은 자동 스킵)"
node scripts/smoke.mjs || fail=1

echo ""
if [ "$fail" -eq 0 ]; then echo "✅ 전체 게이트 통과 — 커밋/머지 가능"; else echo "❌ 게이트 실패 — 위 항목 수정 후 재실행"; exit 1; fi
