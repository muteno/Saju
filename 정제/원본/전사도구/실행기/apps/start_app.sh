#!/bin/bash
# 유튜브 채널 전사 — 앱 실행기
# 링크를 GUI 창(AppleScript)으로 입력받아 전사를 시작하고, 진행보드를 앱 창으로 띄운다.
#
# 260722 개정 (실측 근거로 결함 4종 수리):
#   ① 자동 큐(queue_saju_*.sh)가 대기 중일 때 눌러도 충돌하지 않게 감지·차단
#   ② 저장 위치를 표준 구조 `전사 내용/N. 채널명/채널명_자막/` 로 고정 (구버전은 엉뚱한 곳에 저장 → 이어하기 실패·중복 전사)
#   ③ 예상 시간 공식 교정: 2스트림이 각 5.5배속으로 "동시에" 도므로 합산 11배속 (구버전 /5.0 은 2배 과대추정)
#   ④ 하위 탭(쇼츠·실시간) 자동 추가 패스 — 엔진 기본값은 /videos 탭만 본다
#   ⑤ 발사 전 ffmpeg 경로 게이트 (venv 것이 아니면 전량 실패하는 사고 차단)
SKILL="$HOME/.claude/skills/whisper"
export PATH="$SKILL/.venv/bin:$HOME/.local/bin:$PATH"
PY="$SKILL/.venv/bin/python"
ENGINE="$SKILL/whisper_channel_generic.py"
CONTENT="/Users/[가림-계정]/Library/CloudStorage/OneDrive-GS칼텍스예울마루/황세웅/6.  Nomute/3. 사주/0. 전사프로그램/전사 내용"

notify() { osascript -e "display notification \"$2\" with title \"$1\"" >/dev/null 2>&1; }
say_err() { osascript -e "display dialog \"$1\" buttons {\"확인\"} default button 1 with icon stop with title \"전사기\"" >/dev/null 2>&1; }

# ── 0) 안전 게이트 ────────────────────────────────────────────
# ffmpeg 가 venv 것이 아니면 전사가 전량 실패한다 (7/22 전멸 사고의 진범)
if ! which ffmpeg | grep -q "\.venv/bin/ffmpeg"; then
  say_err "실행 환경이 깨졌어요 (ffmpeg 경로).\n\n담당자에게 알려주세요 — venv PATH 문제입니다."
  exit 1
fi

# 자동 큐가 돌고 있으면 새 작업을 끼워넣지 않는다 (동시 4스트림 = 메모리 초과·서로 방해)
if pgrep -f "queue_saju" >/dev/null; then
  R=$(osascript -e 'display dialog "예약된 전사 큐가 돌아가고 있어요.\n\n채널을 순서대로 자동 전사하는 중이라, 지금 새 작업을 시작하면 서로 방해해요.\n\n진행보드에서 상황을 볼 수 있어요." buttons {"취소","진행보드 열기"} default button 2 with title "전사기"' 2>/dev/null)
  [[ "$R" == *"진행보드 열기"* ]] && "$SKILL/apps/board_app.sh"
  exit 0
fi

# 이미 돌고 있으면 보드만 띄우고 종료
if pgrep -f "whisper_channel_generic" >/dev/null; then
  R=$(osascript -e 'display dialog "이미 전사가 돌아가고 있어요.\n\n진행보드를 열까요?" buttons {"취소","진행보드 열기"} default button 2 with title "전사기"' 2>/dev/null)
  [[ "$R" == *"진행보드 열기"* ]] && "$SKILL/apps/board_app.sh"
  exit 0
fi

# ── 1) 링크 입력 ─────────────────────────────────────────────
URL=$(osascript -e 'set r to display dialog "유튜브 링크를 붙여넣으세요 (채널·재생목록·영상)" default answer "" buttons {"취소","확인"} default button 2 with title "유튜브 채널 전사"
return text returned of r' 2>/dev/null)
[ -z "$URL" ] && exit 0

notify "전사기" "채널 조회 + 멤버십 판별 중… (1~2분)"

# ── 2) 스캔 (임시 폴더로 조회 → 채널명 확보) ──────────────────
TMPOUT=$(mktemp -d)
DRY=$("$PY" "$ENGINE" "$URL" --dry --scan --no-cookies --out "$TMPOUT" 2>/dev/null)
rmdir "$TMPOUT" 2>/dev/null
CH=$(echo "$DRY" | awk -F'\t' '$1=="CHANNEL"{print $2}')
[ -z "$CH" ] && { say_err "채널을 못 읽었어요. 링크를 확인해 주세요."; exit 1; }
TOT=$(echo "$DRY" | awk -F'\t' '$1=="TOTAL"{print $2}')
HRS=$(echo "$DRY" | awk -F'\t' '$1=="HOURS"{print $2}')
PUB=$(echo "$DRY" | awk -F'\t' '$1=="PUBLIC"{print $2}')
MEM=$(echo "$DRY" | awk -F'\t' '$1=="MEMBER"{print $2}')

# 저장 위치를 표준 구조로 결정 — 같은 채널 폴더가 있으면 재사용(이어하기), 없으면 다음 번호 부여
OUT=$("$PY" - "$CONTENT" "$CH" <<'PY'
import os, re, sys, unicodedata
NFC = lambda s: unicodedata.normalize("NFC", s)
content, ch = sys.argv[1], sys.argv[2]
slug = NFC(re.sub(r'[<>:"/\\|?*,\s]', '', ch)) or "채널"
os.makedirs(content, exist_ok=True)

# 기존 폴더 재사용 판정: 번호폴더명이 아니라 그 안의 `*_자막` 폴더명으로 맞춘다.
# (실측: 초코서당 채널의 상위 폴더명은 `1. 초코명리` 라 채널명과 다르다 — 폴더명만 보면 중복 전사한다)
best, maxn = None, 0
for d in sorted(os.listdir(content)):
    m = re.match(r'^(\d+)\.\s*(.+)$', d)
    if not m:
        continue
    n, name = int(m.group(1)), NFC(m.group(2)).strip()
    maxn = max(maxn, n)
    p = os.path.join(content, d)
    if not os.path.isdir(p):
        continue
    subs = [NFC(s)[:-3] for s in os.listdir(p) if NFC(s).endswith("_자막")]
    if name == slug or slug in subs or any(s.startswith(slug) or slug.startswith(s) for s in subs):
        best = (p, subs[0] + "_자막" if subs else slug + "_자막")
        break
if best:
    print(os.path.join(best[0], best[1]))
else:
    print(os.path.join(content, "%d. %s" % (maxn + 1, slug), slug + "_자막"))
PY
)
[ -z "$OUT" ] && { say_err "저장 폴더를 정하지 못했어요."; exit 1; }
mkdir -p "$OUT"

# 이어하기 판정 = 이미 받아둔 md 개수
DONEN=$(ls "$OUT" 2>/dev/null | grep -c '\.md$')
TODO=$(( ${TOT:-0} - DONEN )); [ $TODO -lt 0 ] && TODO=0
# 2스트림이 각 5.5배속으로 병렬 → 합산 약 11배속 (260722 실측)
ETA=$(python3 -c "print(round(${HRS:-0}/11.0,1))" 2>/dev/null)

MSG="채널: $CH
전체 ${TOT}개 (이미 완료 ${DONEN} · 할 것 ${TODO})

🔓 공개 ${PUB:-?}개  ← 지금 받을 수 있음
🔒 멤버십 ${MEM:-?}개  ← 유료 영상 (건너뜀)

공개분 약 ${HRS}시간 → 예상 ${ETA}시간 (2스트림)
저장: ${OUT#$CONTENT/}"

CH_BTN=$(osascript -e "set r to display dialog \"$MSG\" buttons {\"취소\",\"3개 시험\",\"공개분 전체 시작\"} default button 3 with title \"전사 준비 완료\"
return button returned of r" 2>/dev/null)
[ -z "$CH_BTN" ] && exit 0
[ "$CH_BTN" = "취소" ] && exit 0

: > "$OUT/_whisper_mac.log"
cat > "$SKILL/board_config.json" <<CFG
{
  "port": 8765,
  "title": "전사 프로세스 알리미",
  "channel_name": "$CH",
  "channel_handle": "",
  "channel_total_videos": ${TOT:-0},
  "folder": "$OUT",
  "url": "$URL",
  "log_file": "_whisper_mac.log",
  "storage_style": "클라우드 · OneDrive (GS칼텍스 예울마루)",
  "engine_match": "python.*whisper_channel_generic",
  "expected_streams": 2,
  "runner": "run_generic_retry.sh",
  "note_excluded": "멤버십 ${MEM:-0}개는 제외 (유료 가입 영상)"
}
CFG

if [ "$CH_BTN" = "3개 시험" ]; then
  notify "전사기" "3개 시험 시작 — 끝나면 알려줄게요"
  caffeinate -is "$PY" "$ENGINE" "$URL" --out "$OUT" --no-cookies --limit 3 >/dev/null 2>&1
  R=$(osascript -e "set r to display dialog \"3개 시험이 끝났어요.\n\n결과: ${OUT##*/}\n\n전체를 이어서 시작할까요?\" buttons {\"아니요\",\"전체 시작\"} default button 2 with title \"시험 완료\"
return button returned of r" 2>/dev/null)
  [ "$R" != "전체 시작" ] && exit 0
fi

# ── 3) 본 전사: 메인 탭 2스트림 → 끝나면 하위 탭(쇼츠·실시간) 이어서 ──
BASEURL=$(echo "$URL" | sed -E 's#/(videos|shorts|streams|featured)/?$##')
nohup bash -c '
  SKILL="'"$SKILL"'"; PY="'"$PY"'"; ENGINE="'"$ENGINE"'"
  OUT="'"$OUT"'"; URL="'"$URL"'"; BASEURL="'"$BASEURL"'"
  export PATH="$SKILL/.venv/bin:$HOME/.local/bin:$PATH"
  caffeinate -is "$PY" "$ENGINE" "$URL" --out "$OUT" --no-cookies --shard 1/2 >/dev/null 2>&1 &
  caffeinate -is "$PY" "$ENGINE" "$URL" --out "$OUT" --no-cookies --shard 2/2 >/dev/null 2>&1 &
  wait
  # 채널 링크였을 때만 하위 탭 추가 수확 (없는 탭은 조용히 건너뜀)
  if echo "$BASEURL" | grep -qE "youtube\.com/(@|channel/|c/|user/)"; then
    for tab in shorts streams; do
      caffeinate -is "$PY" "$ENGINE" "$BASEURL/$tab" --out "$OUT" --no-cookies --shard 1/1 >/dev/null 2>&1 || true
    done
  fi
  osascript -e "display notification \"저장 위치: ${OUT##*/}\" with title \"전사 완료\"" >/dev/null 2>&1
' >/dev/null 2>&1 &

notify "전사 시작됨" "$CH · 공개 ${PUB:-?}개 · 약 ${ETA}시간"
sleep 2
"$SKILL/apps/board_app.sh"
