#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SN-P generator: quotes are EXTRACTED from source (never retyped)."""
import glob, io, json, os, re, sys

SNAP = "/Users/[가림-계정]/Library/CloudStorage/OneDrive-GS칼텍스예울마루/황세웅/6.  Nomute/3. 사주/2. 정제작업/P0_인벤토리/transcript_sanchaek_v1"
OUT  = "/private/tmp/claude-501/-Users-hwang-Library-CloudStorage-OneDrive-GS------------6---Nomute-3----/edf4a125-f49b-417c-8ebc-11fce1e2ef31/scratchpad/p0_out"

FILES = sorted(glob.glob(os.path.join(SNAP, "*.md")))

def lines_of(idx):
    f = FILES[idx-1]
    return io.open(f, encoding="utf-8-sig").read().splitlines(), os.path.basename(f)

def build(specs, append=True):
    """specs: {idx: (post_extra, [ (s,e,kind,subj,gist,q,flags), ... ])}
       q = None | line_no | (line_no, start, end)  -> sliced from that line"""
    posts, paras, errs = [], [], []
    for idx in sorted(specs):
        extra, plist = specs[idx]
        ls, base = lines_of(idx)
        n = len(ls)
        pid = "ST-P%04d" % idx
        m = re.match(r"^(\d{4})(\d{2})(\d{2})_(.*)_([A-Za-z0-9_\-]+)\.md$", base)
        date = "%s-%s-%s" % (m.group(1), m.group(2), m.group(3))
        vid  = m.group(5)
        title = ls[0].lstrip("# ").strip()
        memb = any("🔒" in l for l in ls[:12])
        post = {"post_id": pid, "file": base, "title": title, "date": date,
                "url": "https://www.youtube.com/watch?v=" + vid, "video_id": vid,
                "author": "산책처럼", "membership": memb, "lines": [1, n],
                "n_paras": len(plist), "license": "none"}
        post.update(extra)
        posts.append(post)
        # coverage check
        cur = 1
        for i, (s, e, kind, subj, gist, q, flags) in enumerate(plist, 1):
            if s != cur: errs.append("%s para%02d start %d != %d" % (pid, i, s, cur))
            cur = e + 1
            para = {"para_id": "%s-%02d" % (pid, i), "post_id": pid, "lines": [s, e],
                    "kind": kind, "subj": subj, "gist": gist}
            if q is not None:
                if isinstance(q, tuple):
                    ln, a, b = q
                    txt = ls[ln-1][a:b]
                else:
                    ln = q; txt = ls[ln-1]
                txt = txt.strip()
                if not (s <= ln <= e): errs.append("%s para%02d quote line %d out of [%d,%d]" % (pid, i, ln, s, e))
                if len(txt) > 120: errs.append("%s para%02d quote %d chars" % (pid, i, len(txt)))
                if txt: para["quote"] = txt
            para["flags"] = flags
            paras.append(para)
            if len(gist) > 40: errs.append("%s para%02d gist %d chars: %s" % (pid, i, len(gist), gist))
        if cur - 1 != n: errs.append("%s ends %d != %d" % (pid, cur-1, n))
    mode = "a" if append else "w"
    with io.open(os.path.join(OUT, "SN-P_posts.jsonl"), mode, encoding="utf-8") as f:
        for p in posts: f.write(json.dumps(p, ensure_ascii=False) + "\n")
    with io.open(os.path.join(OUT, "SN-P_paras.jsonl"), mode, encoding="utf-8") as f:
        for p in paras: f.write(json.dumps(p, ensure_ascii=False) + "\n")
    print("posts=%d paras=%d" % (len(posts), len(paras)))
    if errs:
        print("!!! ERRORS:")
        for e in errs: print("  ", e)
    else:
        print("OK: coverage/quote/gist all clean")
