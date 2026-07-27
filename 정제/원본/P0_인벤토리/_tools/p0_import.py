# 합격 배치 반입: parts 병합 → 정렬 → P0_인벤토리 복사
# usage: python p0_import.py <배치ID>
import json, re, sys, shutil
from pathlib import Path
OUT = Path(__file__).parent / "p0_out"
INV = Path(r"C:\Users\[가림-계정]\OneDrive\황세웅\6.  Nomute\3. 사주\2. 정제작업\P0_인벤토리")
bid = sys.argv[1]

def num(p):
    m = re.search(r"_(\d+)\.jsonl$", p.name)
    return int(m.group(1)) if m else 0

for name in ("posts", "paras"):
    rows, seen = [], set()
    for f in sorted(OUT.glob(f"{bid}_{name}*.jsonl"), key=num):
        for line in f.read_text(encoding="utf-8").splitlines():
            if not line.strip(): continue
            o = json.loads(line)
            k = o.get("para_id") or o.get("post_id")
            if k in seen: continue          # 파트 간 중복 방지
            seen.add(k); rows.append(o)
    rows.sort(key=lambda x: (x["lines"][0], x.get("para_id", "")))
    tgt = INV / f"{bid}_{name}.jsonl"
    tgt.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")
    print(f"{tgt.name}: {len(rows)}행")

rep = OUT / f"{bid}_report.md"
if rep.exists():
    shutil.copy(rep, INV / rep.name); print(f"{rep.name}: 복사됨")
else:
    print(f"!! {bid}_report.md 없음")
