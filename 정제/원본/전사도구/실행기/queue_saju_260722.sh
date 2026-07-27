#!/bin/bash
# ============================================================
#  사주 코퍼스 전사 자동 큐 (260722) — 운영자 지시: 석우당부터 가치 우선
#  · 채널 하나씩 순차, 채널당 2스트림(공개 전용), 하위 탭(쇼츠·실시간)까지 별도 패스
#  · 앞 작업이 끝날 때까지 대기 → 자동 승계. 중단돼도 재실행하면 이어하기.
#  · 규칙 준수: 런처 PATH 재현(번들 ffmpeg) · 쿠키 안 씀(2스트림 안전) · caffeinate
# ============================================================
SKILL="$HOME/.claude/skills/whisper"
export PATH="$SKILL/.venv/bin:$HOME/.local/bin:$PATH"
PY="$SKILL/.venv/bin/python"
ENGINE="$SKILL/whisper_channel_generic.py"
BOARD="$SKILL/board_server.py"
BASE="/Users/[가림-계정]/Library/CloudStorage/OneDrive-GS칼텍스예울마루/황세웅/6.  Nomute/3. 사주/0. 전사프로그램/전사 내용"
QLOG="$BASE/_전사큐_실행로그.log"

log() { echo "$(date '+%m-%d %H:%M:%S') $*" | tee -a "$QLOG"; }

# 발사 전 안전 게이트 — ffmpeg가 venv 것이 아니면 7/22 전멸 재발
which ffmpeg | grep -q "\.venv/bin/ffmpeg" || { log "❌ PATH 오류(ffmpeg) — 큐 중단"; exit 1; }

wait_idle() {
  local first=1
  while pgrep -f "whisper_channel_generic" >/dev/null 2>&1; do
    [ $first = 1 ] && log "⏳ 앞 작업 진행 중 — 끝날 때까지 대기" && first=0
    sleep 60
  done
}

# run_channel <폴더번호.이름> <자막폴더명> <채널표시명> <총편수> <메인URL> [추가탭URL...]
run_channel() {
  local dirnum="$1" subdir="$2" chname="$3" total="$4" url="$5"; shift 5
  local out="$BASE/$dirnum/$subdir"
  mkdir -p "$out"; touch "$out/_whisper_mac.log"

  cat > "$SKILL/board_config.json" <<CFG
{
  "port": 8765,
  "title": "전사 프로세스 알리미",
  "channel_name": "$chname",
  "channel_handle": "",
  "channel_total_videos": $total,
  "folder": "$out",
  "url": "$url",
  "log_file": "_whisper_mac.log",
  "storage_style": "클라우드 · OneDrive (GS칼텍스 예울마루)",
  "engine_match": "python.*whisper_channel_generic",
  "expected_streams": 2,
  "runner": "run_generic_retry.sh",
  "note_excluded": "공개 전용(--no-cookies) — 멤버십 영상은 로그에 FAIL로 남고 나중에 1스트림+쿠키로 수확"
}
CFG
  pgrep -f board_server.py >/dev/null || nohup "$PY" "$BOARD" >/dev/null 2>&1 &

  log "🚀 [$chname] 시작 — 메인 탭 2스트림 · $out"
  caffeinate -is "$PY" "$ENGINE" "$url" --out "$out" --no-cookies --shard 1/2 >/dev/null 2>&1 &
  caffeinate -is "$PY" "$ENGINE" "$url" --out "$out" --no-cookies --shard 2/2 >/dev/null 2>&1 &
  wait
  log "✅ [$chname] 메인 탭 종료 (md $(ls "$out" | grep -c '\.md$')편)"

  # 하위 탭(쇼츠·실시간)은 소량이라 1스트림으로 같은 폴더에 이어 담는다
  for tab in "$@"; do
    log "▶ [$chname] 하위 탭 전사: $tab"
    caffeinate -is "$PY" "$ENGINE" "$tab" --out "$out" --no-cookies --shard 1/1 >/dev/null 2>&1
    log "   완료 (누적 md $(ls "$out" | grep -c '\.md$')편)"
  done
  log "🏁 [$chname] 전량 종료 — md $(ls "$out" | grep -c '\.md$')편"
}

log "════ 사주 전사 큐 기동 (석우당 → 사람공부 → 효명작명 → 남석) ════"
wait_idle

# ① 석우당 — 일주론 대격자 (1,920편 / 1,450h) ★운영자 최우선 지정
run_channel "3. 석우당" "석우당_자막" "석우당" 1920 \
  "https://www.youtube.com/@user-9913" \
  "https://www.youtube.com/@user-9913/shorts" \
  "https://www.youtube.com/@user-9913/streams"

# ② 사람공부 — 신살 고급강의 (118편 / 36h)
run_channel "4. 사람공부" "사람공부_자막" "사람공부" 118 \
  "https://www.youtube.com/@%EC%82%AC%EB%9E%8C%EA%B3%B5%EB%B6%80" \
  "https://www.youtube.com/@%EC%82%AC%EB%9E%8C%EA%B3%B5%EB%B6%80/shorts"

# ③ 효명작명 — 기초~심화 커리큘럼 (537편 / 206h)
run_channel "5. 효명작명" "효명작명_자막" "효명작명" 537 \
  "https://www.youtube.com/@Hyomyeong91"

# ④ 남석 운명과 명리학 — 데일리 강의 2천편대 (2,473편 / 626h)
run_channel "6. 남석운명과명리학" "남석운명과명리학_자막" "남석 운명과 명리학" 2473 \
  "https://www.youtube.com/@user-chun204"

log "════ 큐 전량 완료 ════"
