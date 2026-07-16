# -*- coding: utf-8 -*-
"""검수자용 존별 파일(title + 짧은 snippet)."""
import json, sys
from pathlib import Path
HERE = Path(__file__).parent
units = json.load(open(HERE / "yt_units.json", encoding="utf-8"))
half = (len(units) + 1) // 2
zones = {1: units[:half], 2: units[half:]}
sys.stdout.reconfigure(encoding="utf-8")
for z, zu in zones.items():
    slim = [{"vid": u["vid"], "title": u["title"], "channel": u["channel"],
             "dur": u["dur"], "nchars": u["nchars"], "snippet": u["snippet"][:500]}
            for u in zu]
    json.dump(slim, open(HERE / f"zone{z}_review.json", "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"zone{z}_review.json: {len(slim)} units")
