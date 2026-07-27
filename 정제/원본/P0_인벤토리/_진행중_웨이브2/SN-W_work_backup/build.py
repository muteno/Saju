# -*- coding: utf-8 -*-
"""SN-W builder: spec(py dict) -> posts/paras jsonl with VERBATIM quotes sliced from source."""
import io, glob, json, os, re, sys, unicodedata

BASE = "/Users/[가림-계정]/Library/CloudStorage/OneDrive-GS칼텍스예울마루/황세웅/6.  Nomute/3. 사주/2. 정제작업/P0_인벤토리/transcript_sanchaek_v1/"
OUT = "/private/tmp/claude-501/-Users-hwang-Library-CloudStorage-OneDrive-GS------------6---Nomute-3----/edf4a125-f49b-417c-8ebc-11fce1e2ef31/scratchpad/p0_out/"
WORK = OUT + "work_W/"
FS = sorted(glob.glob(BASE + "*.md"))


def lines_of(idx):
    return io.open(FS[idx-1], encoding="utf-8-sig").read().splitlines()


def meta(idx):
    L = lines_of(idx)
    name = unicodedata.normalize("NFC", os.path.basename(FS[idx-1]))
    title = L[0].lstrip("#").strip()
    date = ""
    url = ""
    for l in L[:12]:
        m = re.search(r"업로드:\*\*\s*(\S+)", l)
        if m:
            date = m.group(1)
        m = re.search(r"URL:\*\*\s*(\S+)", l)
        if m:
            url = m.group(1)
    vid = url.split("v=")[-1] if url else name.rsplit("_", 1)[-1][:-3]
    return name, title, date, url, vid, len(L)


def build(spec):
    posts, paras = [], []
    errs = []
    for idx in sorted(spec.keys()):
        L = lines_of(idx)
        name, title, date, url, vid, n = meta(idx)
        pid = "ST-P%04d" % idx
        plist = spec[idx]["paras"]
        # tiling check
        prev = 0
        for p in plist:
            a, b = p[0], p[1]
            if a != prev + 1:
                errs.append("TILE %s: expected start %d got %d" % (pid, prev+1, a))
            if b < a:
                errs.append("BAD RANGE %s %d-%d" % (pid, a, b))
            prev = b
        if prev != n:
            errs.append("TAIL %s: ends %d but file has %d lines" % (pid, prev, n))
        post = {"post_id": pid, "file": name, "title": title, "date": date,
                "url": url, "video_id": vid, "author": "산책처럼",
                "membership": bool(spec[idx].get("membership", False)),
                "lines": [1, n], "n_paras": len(plist), "license": "none"}
        for k in ("key_natal", "key_luck"):
            if spec[idx].get(k):
                post[k] = spec[idx][k]
        posts.append(post)
        for j, p in enumerate(plist, 1):
            a, b, kind, subj, gist, qkey, flags = p
            rec = {"para_id": "%s-%02d" % (pid, j), "post_id": pid, "lines": [a, b],
                   "kind": kind}
            if subj:
                rec["subj"] = subj
            if len(gist) > 40:
                errs.append("GIST>40 %s-%02d (%d): %s" % (pid, j, len(gist), gist))
            rec["gist"] = gist
            if qkey:
                hits = [(i+1, L[i]) for i in range(a-1, min(b, len(L)))
                        if qkey in L[i]]
                if not hits:
                    errs.append("QUOTE NOT FOUND %s-%02d : %s" % (pid, j, qkey))
                else:
                    ln, txt = hits[0]
                    txt = txt.strip()
                    if len(txt) > 120:
                        txt = txt[:120]
                    rec["quote"] = txt
            rec["flags"] = flags
            paras.append(rec)
    with io.open(OUT + "SN-W_posts.jsonl", "w", encoding="utf-8") as f:
        for r in posts:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    with io.open(OUT + "SN-W_paras.jsonl", "w", encoding="utf-8") as f:
        for r in paras:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    # verify quotes verbatim in own range
    bad = 0
    for r in paras:
        if "quote" not in r:
            continue
        idx = int(r["post_id"][4:])
        L = lines_of(idx)
        a, b = r["lines"]
        seg = "\n".join(L[a-1:b])
        if r["quote"] not in seg:
            bad += 1
            errs.append("VERBATIM FAIL %s" % r["para_id"])
    print("posts=%d paras=%d quotes=%d verbatim_fail=%d" %
          (len(posts), len(paras), sum(1 for r in paras if "quote" in r), bad))
    if errs:
        print("--- ERRORS (%d) ---" % len(errs))
        for e in errs[:40]:
            print(e)
    else:
        print("ALL CHECKS OK")
