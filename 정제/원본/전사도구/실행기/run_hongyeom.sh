#!/bin/bash
# 홍염 멤버십 56개 (53 + 루프 잔존 3) — 2단 분리 실행기 v3
#
#   1단계  다운로드만 · 1스트림 · 쿠키 사용   ← GPU 안 씀 (다른 전사 중에도 실행 가능)
#   2단계  전사 · 2스트림 풀속도 · 쿠키 미사용 ← 오디오가 로컬에 있어서 쿠키 불필요
#
#   왜 분리? 2스트림이 같은 쿠키를 동시에 쓰면 유튜브가 세션을 무효화한다(7/20 실측).
#   쿠키가 필요한 다운로드(전체 시간의 ~5%)만 한 줄로 세우면 속도 손해 없이 안전하다.
#   1단계가 끝나면 쿠키가 나중에 죽어도 상관없다 — 오디오는 이미 확보됐으니까.
#
# 사용:
#   run_hongyeom.sh download   ← 1단계만 (쿠키 준비되면 즉시. 초코서당 도는 중에도 OK)
#   run_hongyeom.sh transcribe ← 2단계만 (GPU 비면 실행)
#   run_hongyeom.sh            ← 1→2 연속
set -e
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SKILL/.venv/bin:$HOME/.local/bin:$PATH"
PY="$SKILL/.venv/bin/python"
ENGINE="$SKILL/whisper_saju_mac.py"
MODE="${1:-all}"

IDS_FILE="$SKILL/hongyeom_targets.txt"
ALL_IDS="$(paste -sd, "$IDS_FILE"),_ftUIhcWaVM,n5iT1WwSmgA,nbDWB99z2cg"

if [ "$MODE" = "download" ] || [ "$MODE" = "all" ]; then
  C="$HOME/.whisper_cookies/ems1130g.txt"
  [ -f "$C" ] || C="$HOME/.whisper_cookies.txt"
  [ -f "$C" ] || { echo "❌ 쿠키 없음: ~/.whisper_cookies/ems1130g.txt 에 넣어주세요"; exit 1; }
  PROBE=$(head -1 "$IDS_FILE")
  echo "=== 접근 자가진단: $PROBE ==="
  if ! "$PY" -m yt_dlp --cookies "$C" --js-runtimes "node:$(command -v node)" \
       --extractor-args "youtube:ejs=npm" --no-warnings --skip-download \
       --print "OK %(duration)ss" "https://www.youtube.com/watch?v=$PROBE"; then
    echo "❌ 차단됨 — 쿠키를 새로 뽑아야 함 (홍염 가입 계정으로)"; exit 1
  fi
  echo "=== 1단계: 다운로드 (1스트림·쿠키) — GPU 미사용 ==="
  caffeinate -is "$PY" "$ENGINE" --only "$ALL_IDS" --download-only
  echo "=== 1단계 종료. 오디오 확보 완료 — 이제 쿠키가 죽어도 무관 ==="
fi

if [ "$MODE" = "transcribe" ] || [ "$MODE" = "all" ]; then
  if pgrep -f "whisper_channel_generic" >/dev/null; then
    echo "⚠️ 다른 전사(초코서당 등)가 GPU 사용 중 — 끝난 뒤 다시:"
    echo "   $SKILL/run_hongyeom.sh transcribe"
    exit 0
  fi
  # 오디오 길이 기준 LPT 2분할
  SPLIT=$("$PY" - "$ALL_IDS" <<'PYEOF'
import sys, os, json
sys.path.insert(0, os.path.expanduser("~/.claude/skills/whisper"))
_a=sys.argv; sys.argv=["x"]
import whisper_saju_mac as W
sys.argv=_a
ids=[v for v in _a[1].split(",") if v]
seen=[]; [seen.append(v) for v in ids if v not in seen]
dur={}
for v in seen:
    p=os.path.join(W.FOLDER,"_raw",v+".info.json")
    try: dur[v]=json.load(open(p,encoding="utf-8")).get("duration") or 0
    except Exception: dur[v]=0
bins=[[],[]]; load=[0,0]
for v in sorted(seen,key=lambda x:-dur[x]):
    k=load.index(min(load)); bins[k].append(v); load[k]+=dur[v]
print(",".join(bins[0])); print(",".join(bins[1]))
PYEOF
)
  S1=$(echo "$SPLIT" | sed -n 1p); S2=$(echo "$SPLIT" | sed -n 2p)
  echo "=== 2단계: 전사 (2스트림 풀속도·쿠키 미사용) ==="
  caffeinate -is "$PY" "$ENGINE" --only "$S1" & P1=$!
  caffeinate -is "$PY" "$ENGINE" --only "$S2" & P2=$!
  echo "2스트림 시작 (pid $P1,$P2) — 보드: http://localhost:8765"
  wait $P1 $P2
  echo "=== 홍염 전사 종료 — normalize_text.py + index 갱신은 인계서 §6 ==="
fi
