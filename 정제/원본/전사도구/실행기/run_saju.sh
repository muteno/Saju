#!/bin/bash
# 도화도레 사주 전사 실행기 (맥 M5 / mlx-whisper large-v3)
#
#   PATH      : venv/bin 을 앞에 물려야 mlx-whisper 가 번들 ffmpeg 를 찾는다 (brew 없이 도는 핵심)
#   caffeinate: 6~9시간 작업 도중 맥이 잠들어 멈추는 것 방지
#   2스트림   : 실측 — 1개씩 순차 5.52배속, 2개 동시 7.85배속(1.42배), 3개 동시는 오히려 4.2배속 미만
#               (24GB 램에 large-v3 3벌은 메모리 압박) → 2가 최적
#
# 사용:
#   run_saju.sh                          전체 실행 (2스트림 동시)
#   run_saju.sh --limit 3 --preview DIR  미리보기 (실폴더 안 건드림, 1스트림)
#   run_saju.sh --single                 1스트림으로만 실행
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SKILL/.venv/bin:$PATH"
PY="$SKILL/.venv/bin/python"
ENGINE="$SKILL/whisper_saju_mac.py"

# 미리보기·단일 지정·limit 이 있으면 1스트림으로 (측정/검수용)
for arg in "$@"; do
  case "$arg" in
    --preview|--limit|--single|--shard) exec caffeinate -is "$PY" "$ENGINE" "${@/--single/}" ;;
  esac
done

# 기본: 2스트림 동시
caffeinate -is "$PY" "$ENGINE" --shard 1/2 "$@" &
P1=$!
caffeinate -is "$PY" "$ENGINE" --shard 2/2 "$@" &
P2=$!
echo "2스트림 시작 (pid $P1, $P2) — 진행: tail -f '<폴더>/_whisper_mac.log'"
wait $P1 $P2
echo "=== 전체 종료 ==="
