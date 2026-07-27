#!/bin/bash
# 사주 전사 진행보드 — 동기화 상태 + 누적 결과
#   보기:     ~/.claude/skills/whisper/saju_board.sh
#   지켜보기: ~/.claude/skills/whisper/saju_board.sh -w    (20초마다 갱신, Ctrl+C 종료)
SKILL="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
run() { "$SKILL/.venv/bin/python" - <<'PYEOF'
# -*- coding: utf-8 -*-
import os, re, sys, time
sys.argv=["x"]; sys.path.insert(0,"/Users/[가림-계정]/.claude/skills/whisper")
import whisper_saju_mac as W
D=W.FOLDER
pub=W.public_targets(); state=W.scan_folder()
done=[v for v in pub if state.get(v,(None,False))[1]]
todo=[v for v in pub if v not in done]
tmp=os.path.expanduser("~/.cache/whisper_saju_tmp")
dur=lambda v:(W.load_info(v,tmp).get("duration") or 0)
h_done=sum(dur(v) for v in done)/3600; h_left=sum(dur(v) for v in todo)/3600
n,tot=len(done),len(pub); pct=n/tot*100

log=os.path.join(D,"_whisper_mac.log")
lines=open(log,encoding="utf-8",errors="replace").read().splitlines() if os.path.exists(log) else []
oks=[l for l in lines if " OK " in l]; fails=[l for l in lines if " FAIL " in l]
alive=int(os.popen("pgrep -f whisper_saju_mac | wc -l").read().strip() or 0)
t0=None
for l in lines:
    try: t0=time.mktime(time.strptime("2026-"+l[:14],"%Y-%m-%d %H:%M:%S")); break
    except Exception: pass
el=(time.time()-t0)/3600 if t0 else 0
rate=h_done/el if el>0.05 else 0
eta=h_left/rate if rate>0 else 0

# ── 동기화 상태: 완료본이 로컬에 확정 기록됐는지 + 원드라이브 데몬 살아있는지
od = "실행중" if os.popen("pgrep -x OneDrive | head -1").read().strip() else "❌ 꺼짐"
half = len([f for f in os.listdir(D) if f.endswith(".tmp")])
recent_bytes = 0; unsynced = 0
for v in done[-10:]:
    p = state.get(v,(None,None))[0]
    if p and os.path.exists(p):
        st=os.stat(p); recent_bytes += st.st_size
        if st.st_blocks == 0: unsynced += 1

bar=int(pct/2.5)
print("\n  ┌─ 도화도레 사주 전사 ─────────────────────────────────────┐")
print("  │ %s   %s" % (time.strftime("%m-%d %H:%M:%S"),
      "● 전사중 (스트림 2)" if alive>0 else "■ 정지됨"))
print("  │")
print("  │  [%s%s] %.1f%%   %d / %d 개" % ("█"*bar,"·"*(40-bar),pct,n,tot))
print("  │")
print("  │  처리 %.1fh / 남음 %.1fh" % (h_done,h_left), end="")
print("     실측 %.1f배속" % rate if rate else "")
if rate: print("  │  잔여 %.1fh  →  완료예정 %s" % (eta, time.strftime("%m/%d %H:%M", time.localtime(time.time()+eta*3600))))
print("  │")
print("  │ ── 동기화 ───────────────────────────────────────────────")
print("  │  OneDrive: %s     쓰다 만 파일: %d" % (od, half))
print("  │  최근 완료본 로컬기록: %s" % ("정상" if unsynced==0 else "⚠️ %d개 미확정"%unsynced))
print("  │  성공 %d건   실패 %d건" % (len(oks),len(fails)))
for l in fails[-3:]: print("  │   ❌ %s" % l[6:72])
print("  │")
print("  │ ── 누적 결과 (최근 8건) ─────────────────────────────────")
for l in oks[-8:]:
    m=re.search(r'\] (.*?)\s+(\d+)s \(\s*([\d.]+)x\)', l)
    if m: print("  │  %s  %-30.30s %4ss" % (l[6:11], m.group(1), m.group(2)))
print("  └──────────────────────────────────────────────────────────┘")
print("  🔒 홍염 멤버십 53개는 권한 없어 제외 (유튜브 자막 유지)\n")
PYEOF
}
if [ "$1" = "-w" ]; then while true; do clear; run; sleep 20; done; else run; fi
