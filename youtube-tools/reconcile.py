# -*- coding: utf-8 -*-
"""수집 결과 전수 대조(검수): all_ids.txt의 모든 영상에 대해
info.json / ko.json3 유무를 확인하고 채널별 현황을 집계한다."""
import json, re, sys
from pathlib import Path
from collections import defaultdict

sys.stdout.reconfigure(encoding="utf-8")
BASE = Path(__file__).parent
RAW = BASE / "raw"

ids = [re.search(r"v=(.+)$", u).group(1)
       for u in (BASE / "all_ids.txt").read_text(encoding="utf-8").split()]

rows = []
for vid in ids:
    info_p = RAW / f"{vid}.info.json"
    sub_p = RAW / f"{vid}.ko.json3"
    row = {"id": vid, "has_info": info_p.exists(), "has_sub": sub_p.exists()}
    if row["has_info"]:
        try:
            i = json.load(open(info_p, encoding="utf-8"))
            row.update(
                title=i.get("title"),
                channel=i.get("channel") or i.get("uploader"),
                upload_date=i.get("upload_date"),
                duration=i.get("duration") or 0,
                categories=i.get("categories") or [],
                is_short=(i.get("duration") or 0) <= 62,
            )
        except Exception as e:
            row["parse_error"] = str(e)
    rows.append(row)

json.dump(rows, open(BASE / "reconcile.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

total = len(rows)
no_info = [r["id"] for r in rows if not r["has_info"]]
no_sub = [r["id"] for r in rows if not r["has_sub"]]
ok = [r for r in rows if r["has_info"] and r["has_sub"]]

print(f"대상 {total} | info+자막 완비 {len(ok)} | info 누락 {len(no_info)} | 자막 누락 {len(no_sub)}")
if no_info:
    print("info 누락:", " ".join(no_info))
if no_sub:
    print("자막 누락:", " ".join(no_sub))

by_ch = defaultdict(lambda: {"n": 0, "dur": 0, "music": 0, "shorts": 0})
for r in rows:
    if not r["has_info"]:
        continue
    c = by_ch[r.get("channel") or "?"]
    c["n"] += 1
    c["dur"] += r.get("duration", 0)
    if "Music" in r.get("categories", []):
        c["music"] += 1
    if r.get("is_short"):
        c["shorts"] += 1

print("\n채널별 (영상수 / 총재생시간 / 음악 / 쇼츠):")
for ch, c in sorted(by_ch.items(), key=lambda x: -x[1]["n"]):
    h, m = divmod(c["dur"] // 60, 60)
    print(f"  {ch}: {c['n']}개 / {h}시간{m}분 / 음악 {c['music']} / 쇼츠 {c['shorts']}")

# 로그의 에러 요약
log = BASE / "fetch.log"
if log.exists():
    errs = [l.strip() for l in log.open(encoding="utf-8", errors="replace") if "ERROR" in l]
    print(f"\nfetch.log ERROR {len(errs)}건")
    for l in errs[:15]:
        print("  " + l[:160])
