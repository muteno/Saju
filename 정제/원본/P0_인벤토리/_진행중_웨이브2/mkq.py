# -*- coding: utf-8 -*-
"""raw paras (with qline) -> final paras with verbatim quote sliced from source."""
import io, json, glob, os, sys

SNAP = "/Users/hwang/Library/CloudStorage/OneDrive-GS칼텍스예울마루/황세웅/6.  Nomute/3. 사주/2. 정제작업/P0_인벤토리/transcript_sanchaek_v1"
OUT  = "/private/tmp/claude-501/-Users-hwang-Library-CloudStorage-OneDrive-GS------------6---Nomute-3----/edf4a125-f49b-417c-8ebc-11fce1e2ef31/scratchpad/p0_out"

fs = sorted(glob.glob(os.path.join(SNAP, "*.md")))
byid = {}
for i, f in enumerate(fs, 1):
    byid["ST-P%04d" % i] = f

cache = {}
def lines_of(pid):
    if pid not in cache:
        cache[pid] = io.open(byid[pid], encoding="utf-8-sig").read().splitlines()
    return cache[pid]

def main(batch):
    src = os.path.join(OUT, batch + "_paras_raw.jsonl")
    dst = os.path.join(OUT, batch + "_paras.jsonl")
    n = 0; nq = 0; errs = []
    with io.open(dst, "w", encoding="utf-8") as w:
        for ln in io.open(src, encoding="utf-8"):
            ln = ln.strip()
            if not ln: continue
            d = json.loads(ln)
            ql = d.pop("qline", None)
            if ql:
                L = lines_of(d["post_id"])
                lo, hi = d["lines"]
                if not (lo <= ql <= hi):
                    errs.append((d["para_id"], "qline out of range", ql, lo, hi)); ql = None
                else:
                    t = L[ql-1].strip()
                    if len(t) > 120:
                        cut = t.rfind(" ", 0, 120)
                        t = t[:cut if cut > 40 else 120].rstrip()
                    if t:
                        d["quote"] = t; nq += 1
            # field order
            o = {}
            for k in ("para_id","post_id","lines","kind","subj","gist","quote","flags"):
                if k in d: o[k] = d[k]
            for k in d:
                if k not in o: o[k] = d[k]
            w.write(json.dumps(o, ensure_ascii=False) + "\n"); n += 1
    print("paras:", n, "quotes:", nq)
    for e in errs: print("ERR", e)

if __name__ == "__main__":
    main(sys.argv[1])
