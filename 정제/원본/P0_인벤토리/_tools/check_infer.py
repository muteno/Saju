# sub_author가 '글 안 축자'인지 '계열 추론'인지 판정 → 추론분은 flags에 표시
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from p0_credit import find_credit  # noqa
INV = Path(r"C:\Users\[가림-계정]\OneDrive\황세웅\6.  Nomute\3. 사주\2. 정제작업\P0_인벤토리")
SNAP = INV / "webtxt_v1"
bid = sys.argv[1]; apply = "--apply" in sys.argv
p = INV / f"{bid}_posts.jsonl"
rows = [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
cache = {}
def raw(fn):
    if fn not in cache: cache[fn] = (SNAP / fn).read_text(encoding="utf-8").splitlines()
    return cache[fn]

# 1) 글 안 축자 크레딧 수집 → key_natal별 정본 이름
#    ※ 계열 근거는 '같은 파일 전체'에서 모은다(배치 경계를 넘는 계열 추론을 인정하기 위해)
myfiles = {r["file"] for r in rows}
allrows = []
for f in sorted(INV.glob("*_posts.jsonl")):
    allrows += [json.loads(l) for l in f.read_text(encoding="utf-8").splitlines() if l.strip()]
evid, by_key = {}, {}
for r in allrows:
    if r["file"] not in myfiles: continue
    seg = raw(r["file"])[r["lines"][0]-1:r["lines"][1]]
    v = next((find_credit(L) for L in seg if find_credit(L)), None)
    evid[r["post_id"]] = v
    if v and r.get("key_natal"): by_key.setdefault(r["key_natal"], set()).add(v.replace(" ", ""))

direct = infer_ok = infer_bad = none = 0
for r in rows:
    cur, v = r.get("sub_author"), evid[r["post_id"]]
    if not cur: none += 1; continue
    if v: direct += 1; continue
    names = by_key.get(r.get("key_natal"), set())
    if cur.replace(" ", "") in names:
        infer_ok += 1
        r["sub_author_src"] = "계열추론"
    else:
        infer_bad += 1
        r["sub_author_src"] = "근거없음"
        print(f"  !! 근거없음 {r['post_id']} ({r.get('key_natal')}): '{cur}' — 같은 키 축자 {sorted(names)}")
print(f"[{bid}] 글안축자 {direct} · 계열추론(일치) {infer_ok} · 근거없음 {infer_bad} · 미기록 {none}")
if apply:
    p.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")
    print("→ sub_author_src 표기 저장")
