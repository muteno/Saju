# -*- coding: utf-8 -*-
"""세션 transcript(jsonl)의 사용자 메시지에서 유튜브 URL을 원문 그대로 추출.
수기 복사 대신 원문 파싱으로 누락/오타를 원천 차단한다."""
import json, re, sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

TRANSCRIPT = Path(sys.argv[1])
OUTDIR = Path(__file__).parent

URL_RE = re.compile(r'https?://[^\s"\'\\|<>\)\]]+')
VID_RE = re.compile(r'(?:[?&]v=|youtu\.be/|shorts/|embed/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])')
PL_RE = re.compile(r'[?&]list=([A-Za-z0-9_-]{10,})')

occurrences = []
for line in TRANSCRIPT.open(encoding="utf-8"):
    try:
        obj = json.loads(line)
    except json.JSONDecodeError:
        continue
    if obj.get("type") != "user":
        continue
    blob = json.dumps(obj.get("message", {}), ensure_ascii=False)
    for m in URL_RE.finditer(blob):
        u = m.group(0)
        if "youtu" in u:
            occurrences.append(u)

vids, pls, invalid = [], [], []
seen_v, seen_p = set(), set()
for u in occurrences:
    mv = VID_RE.search(u)
    mp = PL_RE.search(u)
    if mp:
        p = mp.group(1)
        if p not in seen_p:
            seen_p.add(p)
            pls.append(p)
    if mv:
        v = mv.group(1)
        if v not in seen_v:
            seen_v.add(v)
            vids.append(v)
    elif not mp:
        invalid.append(u)

(OUTDIR / "urls_raw.txt").write_text("\n".join(occurrences), encoding="utf-8")
json.dump(
    {"videos": vids, "playlists": pls, "invalid": sorted(set(invalid))},
    (OUTDIR / "inventory.json").open("w", encoding="utf-8"),
    ensure_ascii=False, indent=1,
)

print(f"URL occurrences: {len(occurrences)}")
print(f"unique video ids: {len(vids)}")
print(f"unique playlists: {len(pls)}")
for p in pls:
    print(f"  - {p}")
print(f"invalid/no-id URLs: {sorted(set(invalid))}")
