# -*- coding: utf-8 -*-
"""self-check: tiling, quote-verbatim, quote-in-range, gist length"""
import io, json, glob, os, sys
SNAP = "/Users/[가림-계정]/Library/CloudStorage/OneDrive-GS칼텍스예울마루/황세웅/6.  Nomute/3. 사주/2. 정제작업/P0_인벤토리/transcript_sanchaek_v1"
OUT  = "/private/tmp/claude-501/-Users-hwang-Library-CloudStorage-OneDrive-GS------------6---Nomute-3----/edf4a125-f49b-417c-8ebc-11fce1e2ef31/scratchpad/p0_out"
fs = sorted(glob.glob(os.path.join(SNAP, "*.md")))
byid = {"ST-P%04d" % i: f for i, f in enumerate(fs, 1)}
b = sys.argv[1]
posts = [json.loads(l) for l in io.open(os.path.join(OUT, b+"_posts.jsonl"), encoding="utf-8") if l.strip()]
paras = [json.loads(l) for l in io.open(os.path.join(OUT, b+"_paras.jsonl"), encoding="utf-8") if l.strip()]
bad = 0
pp = {}
for p in paras: pp.setdefault(p["post_id"], []).append(p)
for po in posts:
    pid = po["post_id"]
    L = io.open(byid[pid], encoding="utf-8-sig").read().splitlines()
    total = len(L)
    if po["lines"] != [1, total]:
        print("POSTLINES", pid, po["lines"], "actual", total); bad += 1
    ps = sorted(pp.get(pid, []), key=lambda x: x["lines"][0])
    if not ps: print("NOPARAS", pid); bad += 1; continue
    exp = 1
    for p in ps:
        lo, hi = p["lines"]
        if lo != exp: print("TILE", p["para_id"], "expected start", exp, "got", lo); bad += 1
        if hi < lo: print("BADRANGE", p["para_id"]); bad += 1
        exp = hi + 1
        if len(p["gist"]) > 60: print("GIST", p["para_id"], len(p["gist"])); bad += 1
        q = p.get("quote")
        if q:
            seg = "\n".join(L[lo-1:hi])
            if q not in seg: print("QUOTE", p["para_id"], repr(q[:40])); bad += 1
            if len(q) > 120: print("QLEN", p["para_id"], len(q)); bad += 1
    if exp - 1 != total: print("COVER", pid, "ends", exp-1, "of", total); bad += 1
    if po.get("n_paras") != len(ps): print("NPARAS", pid, po.get("n_paras"), len(ps)); bad += 1
print("posts", len(posts), "paras", len(paras), "problems", bad)
