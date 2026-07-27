#!/bin/bash
# ============================================================
#  유튜브 채널 전사 — 더블클릭 실행기 (맥 전용)
#  링크 하나 넣으면: 미리보기 → 3개 시험(선택) → 전체 2스트림 전사
#  검증 스택: mlx-whisper large-v3 · 2스트림 · 이어하기 · 루프차단 · BOM/CRLF
# ============================================================
SKILL="$HOME/.claude/skills/whisper"
export PATH="$SKILL/.venv/bin:$HOME/.local/bin:$PATH"
PY="$SKILL/.venv/bin/python"
ENGINE="$SKILL/whisper_channel_generic.py"
BOARD="$SKILL/board_server.py"

clear
echo "──────────────────────────────────────────────"
echo "   🎙  유튜브 채널 전사 (맥 M5 · Whisper large-v3)"
echo "──────────────────────────────────────────────"
URL="$1"
if [ -z "$URL" ]; then
  printf "유튜브 링크(채널/재생목록/영상) 붙여넣고 엔터: "
  read -r URL
fi
[ -z "$URL" ] && { echo "링크가 없어 종료."; exit 1; }

echo; echo "채널 조회 + 멤버십 판별 중... (1~2분)"
DRY=$("$PY" "$ENGINE" "$URL" --dry --scan 2>/dev/null) || { echo "❌ 조회 실패 — 링크 확인"; read -r -p "엔터로 종료"; exit 1; }
CH=$(echo "$DRY" | awk -F'\t' '$1=="CHANNEL"{print $2}')
TOT=$(echo "$DRY" | awk -F'\t' '$1=="TOTAL"{print $2}')
DONE=$(echo "$DRY" | awk -F'\t' '$1=="DONE"{print $2}')
TODO=$(echo "$DRY" | awk -F'\t' '$1=="TODO"{print $2}')
HRS=$(echo "$DRY" | awk -F'\t' '$1=="HOURS"{print $2}')
OUT=$(echo "$DRY" | awk -F'\t' '$1=="OUT"{print $2}')
PUB=$(echo "$DRY" | awk -F'\t' '$1=="PUBLIC"{print $2}')
MEM=$(echo "$DRY" | awk -F'\t' '$1=="MEMBER"{print $2}')
NA=$(echo "$DRY" | awk -F'\t' '$1=="NA"{print $2}')
echo "──────────────────────────────────────────────"
echo "  채널      : $CH"
echo "  영상      : 총 ${TOT}개 (이미 완료 ${DONE} · 할 것 ${TODO})"
echo "  ├ 🔓 공개  : ${PUB:-?}개  ← 지금 받을 수 있음"
echo "  ├ 🔒 멤버십: ${MEM:-?}개  ← 유료 가입 영상 (건너뜀)"
[ "${NA:-0}" != "0" ] && echo "  └ ⚠️ 불가  : ${NA}개  (비공개·삭제 등)"
echo "  분량      : 공개분 약 ${HRS}시간 → 예상 소요 약 $(python3 -c "print(round(${HRS:-0}/5.0,1))")시간 (2스트림)"
echo "  저장 위치 : $OUT"
echo "──────────────────────────────────────────────"
if [ "${MEM:-0}" != "0" ]; then
  echo "  ※ 멤버십 ${MEM}개는 기본으로 건너뜁니다."
  echo "     (받으려면 그 채널 가입 + 쿠키를 ~/.whisper_cookies.txt 에 넣고 [3] 선택)"
  echo
fi
echo "  [1] 먼저 3개만 시험 (추천)   [2] 공개분 전체 시작   [3] 멤버십 포함 시도   [q] 취소"
printf "선택: "
read -r SEL
NOCK="--no-cookies"
STREAMS=2
# 쿠키(멤버십) 모드는 1스트림 고정 — 같은 쿠키를 2스트림이 동시에 쓰면 유튜브가 세션을 무효화 (7/20 실측: 2개 성공 후 전량 차단)
[ "$SEL" = "3" ] && NOCK="" && STREAMS=1 && SEL=2

run_full() {
  mkdir -p "$OUT"
  : > "$OUT/_whisper_mac.log"
  # 진행보드 설정 갱신 (범용 모드)
  cat > "$SKILL/board_config.json" <<CFG
{
  "port": 8765,
  "title": "전사 프로세스 알리미",
  "channel_name": "$CH",
  "channel_handle": "",
  "channel_total_videos": $TOT,
  "folder": "$OUT",
  "url": "$URL",
  "log_file": "_whisper_mac.log",
  "storage_style": "클라우드 · OneDrive (GS칼텍스 예울마루)",
  "engine_match": "python.*whisper_channel_generic",
  "expected_streams": $STREAMS,
  "runner": "run_generic_retry.sh",
  "note_excluded": "멤버십 영상은 ~/.whisper_cookies.txt 가 있고 접근 가능할 때만 받아짐"
}
CFG
  pgrep -f board_server.py >/dev/null || nohup "$PY" "$BOARD" >/dev/null 2>&1 &
  if [ "$STREAMS" = "1" ]; then
    nohup caffeinate -is "$PY" "$ENGINE" "$URL" --out "$OUT" $NOCK --shard 1/1 >/dev/null 2>&1 &
  else
    nohup caffeinate -is "$PY" "$ENGINE" "$URL" --out "$OUT" $NOCK --shard 1/2 >/dev/null 2>&1 &
    nohup caffeinate -is "$PY" "$ENGINE" "$URL" --out "$OUT" $NOCK --shard 2/2 >/dev/null 2>&1 &
  fi
  sleep 2
  open "http://localhost:8765" 2>/dev/null
  echo
  echo "✅ 전체 전사 시작 (${STREAMS}스트림, 백그라운드)"
  echo "   · 진행보드: http://localhost:8765 (방금 브라우저로 열었음)"
  echo "   · 로그    : $OUT/_whisper_mac.log"
  echo "   · 이 창은 닫아도 됨. 맥 뚜껑은 열어두거나(전원 연결) 모니터 연결 유지."
  echo "   · 중단돼도 이 실행기를 다시 돌리면 안 한 것만 이어서 함."
}

case "$SEL" in
  1)
    echo; echo "── 3개 시험 시작 (완료된 건 건너뜀) ──"
    caffeinate -is "$PY" "$ENGINE" "$URL" --out "$OUT" $NOCK --limit 3
    echo; echo "── 시험 끝. 결과물 확인: $OUT ──"
    printf "전체 이어서 시작할까? [y/N]: "
    read -r GO
    [ "$GO" = "y" ] || [ "$GO" = "Y" ] && run_full || echo "여기서 멈춤 (시험분은 저장됨)."
    ;;
  2) run_full ;;
  *) echo "취소." ;;
esac
echo
read -r -p "엔터를 누르면 창이 닫혀요"
