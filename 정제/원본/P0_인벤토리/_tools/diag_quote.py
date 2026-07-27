# 불일치 quote 진단: 원문에서 가장 비슷한 줄을 찾아 차이를 보여준다
import json, re, sys, difflib
from pathlib import Path
SNAP = Path(r"C:\Users\Hwang\OneDrive - GS칼텍스 예울마루\황세웅\6.  Nomute\3. 사주\2. 정제작업\P0_인벤토리\webtxt_v1")
OUT = Path(__file__).parent / "p0_out"
bid = sys.argv[1]
posts = {}
for f in sorted(OUT.glob(f"{bid}_posts*.jsonl")):
    for line in f.read_text(encoding="utf-8").splitlines():
        if line.strip():
            p = json.loads(line); posts[p["post_id"]] = p
paras = []
for f in sorted(OUT.glob(f"{bid}_paras*.jsonl")):
    for line in f.read_text(encoding="utf-8").splitlines():
        if line.strip(): paras.append(json.loads(line))
cache = {}
def raw(fn):
    if fn not in cache: cache[fn] = (SNAP/fn).read_text(encoding="utf-8").splitlines()
    return cache[fn]
flat = lambda s: re.sub(r"\s+", "", s)
n = 0
for q in paras:
    quote = q.get("quote")
    if not quote: continue
    p = posts.get(q["post_id"])
    if not p: continue
    lines = raw(p["file"])
    if flat(quote) in flat("\n".join(lines)): continue
    n += 1
    a, b = q["lines"]
    seg = lines[max(0,a-1):b]
    best = max(seg, key=lambda L: difflib.SequenceMatcher(None, flat(quote), flat(L)).ratio()) if seg else ""
    r = difflib.SequenceMatcher(None, flat(quote), flat(best)).ratio()
    print(f"--- {q['para_id']} (줄 {a}-{b}) 유사도 {r:.2f}")
    print(f"  Q: {quote}")
    print(f"  O: {best[:200]}")
print(f"\n총 불일치 {n}건")
