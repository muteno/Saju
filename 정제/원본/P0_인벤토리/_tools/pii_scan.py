# 개인정보 스캔: 내용은 출력하지 않고 '어느 문단에 몇 건'만 센다 → 해당 para에 개인정보 플래그
import json, re, sys
from pathlib import Path
INV = Path(r"C:\Users\Hwang\OneDrive - GS칼텍스 예울마루\황세웅\6.  Nomute\3. 사주\2. 정제작업\P0_인벤토리")
SNAP = INV / "webtxt_v1"
apply = "--apply" in sys.argv

PAT = {
    "email": re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
    "phone": re.compile(r"01[0-9][-\s.]?\d{3,4}[-\s.]?\d{4}"),
    "birth": re.compile(r"(19|20)\d{2}[.\-/년]\s?\d{1,2}[.\-/월]\s?\d{1,2}"),
    "masked": re.compile(r"[가-힣]\*+[가-힣]?"),
}
cache = {}
def raw(fn):
    if fn not in cache: cache[fn] = (SNAP / fn).read_text(encoding="utf-8").splitlines()
    return cache[fn]

posts = {}
for f in sorted(INV.glob("*_posts.jsonl")):
    for l in f.read_text(encoding="utf-8").splitlines():
        if l.strip():
            p = json.loads(l); posts[p["post_id"]] = p

hits_by_file, touched = {}, {}
for pf in sorted(INV.glob("*_paras.jsonl")):
    rows = [json.loads(l) for l in pf.read_text(encoding="utf-8").splitlines() if l.strip()]
    changed = 0
    for q in rows:
        p = posts.get(q["post_id"])
        if not p: continue
        seg = "\n".join(raw(p["file"])[q["lines"][0]-1:q["lines"][1]])
        c = {k: len(v.findall(seg)) for k, v in PAT.items()}
        score = c["email"] * 3 + c["phone"] * 3 + c["masked"]
        if score >= 3:
            d = hits_by_file.setdefault(p["file"], {"paras": 0, **{k: 0 for k in PAT}})
            d["paras"] += 1
            for k in PAT: d[k] += c[k]
            if "개인정보" not in q.get("flags", []):
                q.setdefault("flags", []).append("개인정보"); changed += 1
            if q.get("quote"):
                d["quote있음"] = d.get("quote있음", 0) + 1
    if changed and apply:
        pf.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")
        touched[pf.name] = changed

print("■ 개인정보 의심 문단 (내용 미출력)")
for fn, d in sorted(hits_by_file.items(), key=lambda x: -x[1]["paras"]):
    print(f"  {fn}: 문단 {d['paras']} · 이메일 {d['email']} · 전화 {d['phone']} · 마스킹이름 {d['masked']} · quote보유 {d.get('quote있음',0)}")
if not hits_by_file: print("  없음")
if apply: print(f"\n→ 플래그 부여 저장: {touched}")
else: print("\n(미저장 — --apply 필요)")
