#!/usr/bin/env bash
# 전사본을 리포로 밀어 올린다 — 맥에서 전사 한 파도가 끝날 때마다 이것만 돌린다.
#
# 왜 있나: 전사 공장(mlx-whisper)은 애플 실리콘 GPU 전용이라 클라우드로 못 옮긴다.
#   그래서 «상류(전사) = 맥 · 하류(정제·앱) = 클라우드»로 갈렸고, 그 사이를 사람이
#   손으로 옮기면 다음에도 손으로 옮기게 된다. 이 프로젝트가 열두 번 반복한 병이다.
#
# 무엇을 하나: 원본_반입.py를 부르고(가리기 내장), 대차대조표를 보고, 커밋·푸시한다.
#   ⚠원천은 읽기만 한다. 검산에 걸리면 아무것도 안 밀고 멈춘다.
#   ⚠변수명이 영문인 것은 bash가 한글 변수명을 못 받기 때문이다(실측).
#
# 쓰기:
#   ./scripts/전사본_올리기.sh "~/…/3. 사주"           # 원천 경로만 주면 된다
#   ./scripts/전사본_올리기.sh "~/…/3. 사주" --확인만    # 반입만 하고 커밋은 안 한다
set -euo pipefail

SRC="${1:-}"
ONLY_CHECK="${2:-}"
if [ -z "$SRC" ]; then
  echo "쓰기: $0 \"<3. 사주 폴더 경로>\" [--확인만]" >&2
  exit 2
fi
if [ ! -d "$SRC" ]; then
  echo "🔴 원천 폴더가 없다: $SRC" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
LOG="$(mktemp)"

echo "▶ 1/4 최신 받기 (다른 손이 밀었을 수 있다 — 겹치면 여기서 멈춘다)"
git fetch origin main
git merge --ff-only origin/main || {
  echo "🔴 fast-forward가 안 된다 = 로컬에 안 밀린 커밋이 있다." >&2
  echo "   무엇이 들어왔는지 파일 단위로 보고 판단해라. --force는 쓰지 마라." >&2
  exit 1
}

echo "▶ 2/4 반입 (개인정보 가리기는 반입기 안에 있다)"
python3 "정제/_현황판/원본_반입.py" "$SRC" | tee "$LOG"

if ! grep -q "잔차 +0" "$LOG"; then
  echo "🔴 대차대조표 잔차가 0이 아니다 — 반입표가 원천의 어느 가지를 안 짚고 있다." >&2
  echo "   정제/_현황판/원본_반입.py 의 반입표에 그 폴더를 한 줄 더해라." >&2
  exit 1
fi

echo "▶ 3/4 조용히 빠진 파일 검산"
N_DISK=$(find 정제/원본 -type f | wc -l | tr -d ' ')
N_NEW=$(git add -An -- 정제/원본 | wc -l | tr -d ' ')
N_TRACKED=$(git ls-files 정제/원본 | wc -l | tr -d ' ')
N_GIT=$((N_NEW + N_TRACKED))
echo "   디스크 $N_DISK · git이 보는 것 $N_GIT (신규 $N_NEW + 기추적 $N_TRACKED)"
if [ "$N_DISK" -ne "$N_GIT" ]; then
  echo "🔴 수가 안 맞는다 — .gitignore가 조용히 먹은 파일이 있다." >&2
  echo "   확인: git status --porcelain --ignored -- 정제/원본 | grep '^!!'" >&2
  exit 1
fi

if [ "$ONLY_CHECK" = "--확인만" ]; then
  echo "✅ 확인만 — 커밋하지 않았다. 되돌리기 = git checkout -- 정제/원본"
  exit 0
fi

echo "▶ 4/4 커밋·푸시"
N_CHANGED=$(git status --porcelain -- 정제/원본 | wc -l | tr -d ' ')
if [ "$N_CHANGED" -eq 0 ]; then
  echo "✅ 새 전사본 없음 — 올릴 것이 없다."
  exit 0
fi
git add -- 정제/원본 정제/P2_유닛
git commit -m "chore: 전사본 반입 (변경 $N_CHANGED) — 맥 전사 파도 회수

$(grep -E '완료 —|대차대조표' "$LOG")"
git push origin HEAD

echo "✅ 올라갔다. 다음은 클라우드에서: python3 정제/_현황판/파이프라인.py --all"
