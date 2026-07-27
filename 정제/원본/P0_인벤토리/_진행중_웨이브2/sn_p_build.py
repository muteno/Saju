# -*- coding: utf-8 -*-
"""SN-P builder: 중간 JSONL(qline/qslice) -> 최종 posts/paras JSONL.
quote는 원문에서 줄 단위로 슬라이스해 그대로 꺼낸다(손타이핑 금지 → 호환한자·오전사 보존)."""
import glob, io, json, os, sys, re

BASE = "/Users/[가림-계정]/Library/CloudStorage/OneDrive-GS칼텍스예울마루/황세웅/6.  Nomute/3. 사주/2. 정제작업/P0_인벤토리"
SNAP = os.path.join(BASE, "transcript_sanchaek_v1")
OUT = "/private/tmp/claude-501/-Users-hwang-Library-CloudStorage-OneDrive-GS------------6---Nomute-3----/edf4a125-f49b-417c-8ebc-11fce1e2ef31/scratchpad/p0_out"

FILES = sorted(glob.glob(os.path.join(SNAP, "*.md")))

def lines_of(idx):
    f = FILES[idx-1]
    return io.open(f, encoding="utf-8-sig").read().splitlines(), os.path.basename(f)

def main(src):
    recs = [json.loads(l) for l in io.open(src, encoding="utf-8") if l.strip()]
    posts, paras = [], []
    errs = []
    cache = {}
    for r in recs:
        idx = r["idx"]
        if idx not in cache:
            cache[idx] = lines_of(idx)
        L, fname = cache[idx]
        pid = "ST-P%04d" % idx
        m = re.search(r"_([A-Za-z0-9_\-]{11})\.md$", fname)
        vid = m.group(1) if m else None
        date = fname[:8]
        date = "%s-%s-%s" % (date[:4], date[4:6], date[6:8])
        title = L[0].lstrip("#").strip()
        post = {"post_id": pid, "file": fname, "title": title, "date": date,
                "url": "https://www.youtube.com/watch?v=%s" % vid, "video_id": vid,
                "author": "산책처럼", "membership": bool(r.get("membership")),
                "lines": [1, len(L)], "n_paras": len(r["paras"]), "license": "none"}
        if r.get("key_natal"): post["key_natal"] = r["key_natal"]
        if r.get("key_luck"): post["key_luck"] = r["key_luck"]
        posts.append(post)
        # tiling check
        cur = 1
        for i, p in enumerate(r["paras"], 1):
            a, b = p["lines"]
            if a != cur:
                errs.append("%s para%d: 시작 %d != 기대 %d" % (pid, i, a, cur))
            if b < a:
                errs.append("%s para%d: 역범위" % (pid, i))
            cur = b + 1
            o = {"para_id": "%s-%02d" % (pid, i), "post_id": pid, "lines": [a, b],
                 "kind": p["kind"], "subj": p.get("subj", []), "gist": p["gist"]}
            if len(p["gist"]) > 40:
                errs.append("%s para%d: gist %d자" % (pid, i, len(p["gist"])))
            if p.get("q"):
                qn = p["q"][0]
                if not (a <= qn <= b):
                    errs.append("%s para%d: qline %d 범위밖 [%d,%d]" % (pid, i, qn, a, b))
                txt = L[qn-1]
                if len(p["q"]) == 3:
                    txt = txt[p["q"][1]:p["q"][2]]
                elif len(p["q"]) == 2:
                    parts = re.split(r'(?<=[.?!])\s+', txt)
                    si = p["q"][1]
                    if si >= len(parts):
                        errs.append("%s para%d: sent idx %d / %d" % (pid, i, si, len(parts)))
                        si = len(parts) - 1
                    txt = parts[si]
                txt = txt.strip()
                if len(txt) > 120:
                    errs.append("%s para%d: quote %d자" % (pid, i, len(txt)))
                if txt not in L[qn-1]:
                    errs.append("%s para%d: quote 원문불일치" % (pid, i))
                o["quote"] = txt
            if p.get("flags"):
                o["flags"] = p["flags"]
            paras.append(o)
        if cur != len(L) + 1:
            errs.append("%s: 마지막 %d != 총줄수 %d" % (pid, cur-1, len(L)))
    tag = sys.argv[2] if len(sys.argv) > 2 else "2"
    with io.open(os.path.join(OUT, "SN-P_posts_%s.jsonl" % tag), "w", encoding="utf-8") as fo:
        for p in posts:
            fo.write(json.dumps(p, ensure_ascii=False) + "\n")
    with io.open(os.path.join(OUT, "SN-P_paras_%s.jsonl" % tag), "w", encoding="utf-8") as fo:
        for p in paras:
            fo.write(json.dumps(p, ensure_ascii=False) + "\n")
    print("posts", len(posts), "paras", len(paras))
    if errs:
        print("!! ERRORS", len(errs))
        for e in errs[:60]:
            print("  ", e)
    else:
        print("OK: 타일링·quote범위·gist길이 전부 통과")

main(sys.argv[1])
