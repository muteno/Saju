#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SN-Q builder: spec(jsonl) + snapshot -> posts.jsonl / paras.jsonl
quote is SLICED from the source file by line number -> never retyped, never corrupted."""
import glob, io, os, json, re, sys

BASE = "/Users/hwang/Library/CloudStorage/OneDrive-GS칼텍스예울마루/황세웅/6.  Nomute/3. 사주/2. 정제작업/P0_인벤토리"
SNAP = os.path.join(BASE, "transcript_sanchaek_v1")
OUT = "/private/tmp/claude-501/-Users-hwang-Library-CloudStorage-OneDrive-GS------------6---Nomute-3----/edf4a125-f49b-417c-8ebc-11fce1e2ef31/scratchpad/p0_out"
SPEC = os.path.join(os.path.dirname(OUT), "sn_q_spec.jsonl")
MIRROR = os.path.join(BASE, "_진행중_웨이브2")

FS = sorted(glob.glob(os.path.join(SNAP, "*.md")))

def load(idx):
    f = FS[idx-1]
    lines = io.open(f, encoding="utf-8-sig").read().splitlines()
    return os.path.basename(f), lines

def main():
    specs = {}
    order = []
    for ln in io.open(SPEC, encoding="utf-8"):
        ln = ln.strip()
        if not ln or ln.startswith("#"):
            continue
        d = json.loads(ln)
        i = d["i"]
        if i not in specs:
            specs[i] = []
            order.append(i)
        specs[i].append(d)

    posts, paras, errs = [], [], []
    for i in order:
        fname, lines = load(i)
        N = len(lines)
        pid = "ST-P%04d" % i
        # meta parse
        title = lines[0].lstrip("# ").strip()
        m = re.search(r"\*\*업로드:\*\*\s*([\d-]+)", "\n".join(lines[:10]))
        date = m.group(1) if m else None
        m = re.search(r"\*\*URL:\*\*\s*(\S+)", "\n".join(lines[:10]))
        url = m.group(1) if m else None
        vid = url.split("v=")[-1] if url else None
        member = "🔒" in "\n".join(lines[:12])
        ps = sorted(specs[i], key=lambda x: x["p"])
        # tiling check
        cur = 1
        for d in ps:
            a, b = d["l"]
            if a != cur:
                errs.append("TILE %d p%d: expected start %d got %d" % (i, d["p"], cur, a))
            if b < a:
                errs.append("TILE %d p%d: bad range" % (i, d["p"]))
            cur = b + 1
        if cur - 1 != N:
            errs.append("TILE %d: covered to %d, file has %d" % (i, cur-1, N))
        post = {"post_id": pid, "file": fname, "title": title, "date": date,
                "url": url, "video_id": vid, "author": "산책처럼",
                "membership": member, "lines": [1, N], "n_paras": len(ps),
                "license": "none"}
        for k in ("key_natal", "key_luck"):
            v = specs[i][0].get(k)
            if v:
                post[k] = v
        posts.append(post)
        for d in ps:
            a, b = d["l"]
            rec = {"para_id": "%s-%02d" % (pid, d["p"]), "post_id": pid,
                   "lines": [a, b], "kind": d["k"], "subj": d.get("s", []),
                   "gist": d["g"]}
            q = d.get("q")
            if q:
                if isinstance(q, int):
                    qn, s, e = q, None, None
                else:
                    qn = q[0]; s = q[1]; e = q[2] if len(q) > 2 else None
                if not (a <= qn <= b):
                    errs.append("QLINE %s: line %d outside [%d,%d]" % (rec["para_id"], qn, a, b))
                txt = lines[qn-1]
                txt = txt[s:e] if (s is not None or e is not None) else txt
                txt = txt.strip()
                if len(txt) > 120:
                    errs.append("QLEN %s: %d chars" % (rec["para_id"], len(txt)))
                if txt not in lines[qn-1]:
                    errs.append("QVERB %s" % rec["para_id"])
                rec["quote"] = txt
            if len(d["g"]) > 40:
                errs.append("GIST %s: %d chars" % (rec["para_id"], len(d["g"])))
            f = d.get("f", [])
            if f:
                rec["flags"] = f
            paras.append(rec)

    os.makedirs(OUT, exist_ok=True)
    os.makedirs(MIRROR, exist_ok=True)
    with io.open(os.path.join(OUT, "SN-Q_posts.jsonl"), "w", encoding="utf-8") as fh:
        for p in posts:
            fh.write(json.dumps(p, ensure_ascii=False) + "\n")
    with io.open(os.path.join(OUT, "SN-Q_paras.jsonl"), "w", encoding="utf-8") as fh:
        for p in paras:
            fh.write(json.dumps(p, ensure_ascii=False) + "\n")
    print("posts=%d paras=%d idx=%s..%s" % (len(posts), len(paras), order[0], order[-1]))
    print("ERRORS: %d" % len(errs))
    for e in errs[:40]:
        print("  " + e)

if __name__ == "__main__":
    main()
