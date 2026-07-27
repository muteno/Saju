#!/bin/bash
# 범용 실행기 (run_saju.sh 후속 — 실행 중인 run_saju.sh 는 건드리지 않기 위해 별도 파일)
#
#   run_job.sh                     전체 실행 (2스트림) + 끝나면 재시도 대기열 자동 처리
#   run_job.sh --only <ID[,ID..]>  지정 영상만 재전사 (1스트림) — 보드의 [재시도] 버튼이 이걸 부름
#   run_job.sh --limit N --preview DIR   검수용 미리보기 (1스트림)
#
# 실패한 영상은 어차피 머리말이 Whisper 가 아니므로, 그냥 전체 재실행해도 실패분만 다시 돈다.
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SKILL/.venv/bin:$PATH"
PY="$SKILL/.venv/bin/python"
ENGINE="$SKILL/whisper_saju_mac.py"
FOLDER="$("$PY" -c "import json;print(json.load(open('$SKILL/board_config.json'))['folder'])" 2>/dev/null)"
QUEUE="$FOLDER/_retry_queue.txt"

for arg in "$@"; do
  case "$arg" in
    --only|--preview|--limit|--shard) exec caffeinate -is "$PY" "$ENGINE" "$@" ;;
  esac
done

# 전체 실행 시작 시 로그 초기화 (안 하면 재실행 때 이전 실행 시각이 섞여 보드 ETA 가 오염됨 — 평의회 지적)
LOG="$FOLDER/_whisper_mac.log"
[ -n "$FOLDER" ] && : > "$LOG"

caffeinate -is "$PY" "$ENGINE" --shard 1/2 "$@" & P1=$!
caffeinate -is "$PY" "$ENGINE" --shard 2/2 "$@" & P2=$!
echo "2스트림 시작 (pid $P1, $P2)"
wait $P1 $P2

# 재시도 대기열 처리 (보드에서 작업 중에 눌린 재시도들)
if [ -n "$FOLDER" ] && [ -s "$QUEUE" ]; then
  IDS=$(sort -u "$QUEUE" | paste -sd, -)
  : > "$QUEUE"
  echo "재시도 대기열 처리: $IDS"
  caffeinate -is "$PY" "$ENGINE" --only "$IDS"
fi
echo "=== 전체 종료 ==="
