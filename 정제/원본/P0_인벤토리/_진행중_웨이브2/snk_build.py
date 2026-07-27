# -*- coding: utf-8 -*-
"""SN-K 빌더: plan.jsonl(q=[줄범위]) -> paras_2.jsonl(quote 원문 슬라이스) + posts_2.jsonl 자동생성"""
import io, json, glob, os, re, sys

SNAP = "/Users/hwang/Library/CloudStorage/OneDrive-GS칼텍스예울마루/황세웅/6.  Nomute/3. 사주/2. 정제작업/P0_인벤토리/transcript_sanchaek_v1"
OUT = os.path.dirname(os.path.abspath(__file__))
PLAN = os.path.join(OUT, "snk_work", "SN-K_plan.jsonl")
KEYS = os.path.join(OUT, "snk_work", "SN-K_keys.json")   # {"ST-P0592": {"key_natal":"갑목일간","key_luck":"계묘년"}}

files = sorted(glob.glob(os.path.join(SNAP, "*.md")))
idx2file = {i: files[i-1] for i in range(1, len(files)+1)}
cache = {}
def lines_of(pid):
    n = int(pid.split("P")[1])
    if n not in cache:
        cache[n] = io.open(idx2file[n], encoding="utf-8-sig").read().splitlines()
    return cache[n], idx2file[n], n

keys = json.load(io.open(KEYS, encoding="utf-8")) if os.path.exists(KEYS) else {}

paras, errs = [], []
for ln, raw in enumerate(io.open(PLAN, encoding="utf-8"), 1):
    raw = raw.strip()
    if not raw: continue
    p = json.loads(raw)
    txt, fpath, n = lines_of(p["post_id"])
    a, b = p["lines"]
    if b > len(txt): errs.append(f"L{ln} {p['para_id']} lines end {b} > file {len(txt)}")
    q = p.pop("q", None)
    if q:
        qa, qb = q
        if qa < a or qb > b: errs.append(f"L{ln} {p['para_id']} quote range {q} outside {p['lines']}")
        s = " ".join(x.strip() for x in txt[qa-1:qb] if x.strip())
        s = re.sub(r"\s+", " ", s).strip()
        if len(s) > 120: errs.append(f"L{ln} {p['para_id']} quote {len(s)}자 초과: {s[:30]}")
        p["quote"] = s
    if len(p.get("gist", "")) > 40: errs.append(f"L{ln} {p['para_id']} gist {len(p['gist'])}자")
    # 필드 순서 정렬
    o = {k: p[k] for k in ("para_id","post_id","lines","kind","subj","gist") if k in p}
    if "quote" in p: o["quote"] = p["quote"]
    if p.get("flags"): o["flags"] = p["flags"]
    paras.append(o)

# 타일링 검사 + posts 생성
byp = {}
for p in paras: byp.setdefault(p["post_id"], []).append(p)
posts = []
for pid in sorted(byp):
    ps = sorted(byp[pid], key=lambda x: x["lines"][0])
    txt, fpath, n = lines_of(pid)
    cur = 1
    for p in ps:
        if p["lines"][0] != cur: errs.append(f"{p['para_id']} 타일링: {cur} 기대, {p['lines'][0]} 나옴")
        cur = p["lines"][1] + 1
    if cur - 1 != len(txt): errs.append(f"{pid} 끝줄 불일치: {cur-1} vs {len(txt)}")
    base = os.path.basename(fpath)
    m = re.match(r"^(\d{4})(\d{2})(\d{2})_(.*)_([A-Za-z0-9_\-]+)\.md$", base)
    date = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    vid = m.group(5)
    title = txt[0].lstrip("#").strip()
    head = "\n".join(txt[:13])
    post = {"post_id": pid, "file": base, "title": title, "date": date,
            "url": f"https://www.youtube.com/watch?v={vid}", "video_id": vid,
            "author": "산책처럼", "membership": ("🔒" in head), "lines": [1, len(txt)],
            "n_paras": len(ps), "license": "none"}
    post.update(keys.get(pid, {}))
    posts.append(post)

with io.open(os.path.join(OUT, "SN-K_paras_2.jsonl"), "w", encoding="utf-8") as f:
    for p in paras: f.write(json.dumps(p, ensure_ascii=False) + "\n")
with io.open(os.path.join(OUT, "SN-K_posts_2.jsonl"), "w", encoding="utf-8") as f:
    for p in posts: f.write(json.dumps(p, ensure_ascii=False) + "\n")

print(f"posts {len(posts)} / paras {len(paras)}")
print("ERRORS:", len(errs))
for e in errs[:40]: print("  ", e)
