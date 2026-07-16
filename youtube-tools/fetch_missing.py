# -*- coding: utf-8 -*-
"""로컬(비차단) IP에서 아직 못 받은 영상들의 한국어 자막+메타를 yt-dlp로 수집.
멤버십 전용(fetch.log 에러)으로 확인된 영상은 건너뛴다. 진행상황은
fetch_missing.log 에 한 줄씩 기록(폴링용). 이미 받은 영상은 자동 스킵."""
import subprocess, sys, time, json, re
from pathlib import Path

HERE = Path(__file__).parent.resolve()
RAW = HERE / "raw"
RAW.mkdir(exist_ok=True)
SLEEP_SEC = 2.0
PER_TIMEOUT = 90

sys.stdout.reconfigure(encoding="utf-8")
master = json.load(open(HERE / "master.json", encoding="utf-8"))
all_ids = master["all_ids"]

blocked = set()
log = HERE / "fetch.log"
if log.exists():
    for l in log.open(encoding="utf-8", errors="replace"):
        if "ERROR" in l and "member" in l.lower():
            m = re.search(r"\]\s*([A-Za-z0-9_-]{11}):", l)
            if m:
                blocked.add(m.group(1))


def has_ko(vid):
    return any((RAW / f"{vid}.{s}.json3").exists() for s in ("ko", "ko-orig", "ko-KR"))


missing = [v for v in all_ids if not has_ko(v) and v not in blocked]
prog = open(HERE / "fetch_missing.log", "w", encoding="utf-8")


def emit(s):
    print(s, flush=True)
    prog.write(s + "\n")
    prog.flush()


emit(f"START missing={len(missing)} skip_membership={len(blocked)} total={len(all_ids)}")

got = 0
for idx, vid in enumerate(missing, 1):
    url = f"https://www.youtube.com/watch?v={vid}"
    cmd = [
        "yt-dlp", "--skip-download", "--write-info-json",
        "--write-subs", "--write-auto-subs",
        "--sub-langs", "ko,ko-orig,ko-KR", "--sub-format", "json3",
        "--retries", "3", "--socket-timeout", "20",
        "--no-warnings", "--ignore-errors",
        "-o", "raw/%(id)s.%(ext)s", url,
    ]
    err = ""
    try:
        r = subprocess.run(cmd, cwd=str(HERE), capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=PER_TIMEOUT)
        for el in (r.stderr or "").splitlines():
            if "ERROR" in el:
                err = el.strip()
                break
    except subprocess.TimeoutExpired:
        err = "TIMEOUT"
    ok = has_ko(vid)
    got += ok
    status = "OK   " if ok else "no-ko"
    emit(f"[{idx}/{len(missing)}] {status} {vid}" + (f"  | {err[:120]}" if (err and not ok) else ""))
    time.sleep(SLEEP_SEC)

emit(f"DONE newly_got_ko={got}/{len(missing)}")
prog.close()
