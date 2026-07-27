# 운세 배치 sub_author 기계 보정: 글 범위 안의 상담사 크레딧을 정규식으로 추출해 채운다
# usage: python p0_credit.py <배치ID> [--apply]
import json, re, sys
from pathlib import Path
INV = Path(r"C:\Users\Hwang\OneDrive - GS칼텍스 예울마루\황세웅\6.  Nomute\3. 사주\2. 정제작업\P0_인벤토리")
SNAP = INV / "webtxt_v1"
Q = "\"“”'’"
# 문형 3종: ①원고 작성은 [○○ 상담사] "X"님께서 도움을… ②원고 작성은 "X"님께서… ③상담사 X님께서 작성하셨습니다
CREDS = [
    re.compile(r"원고\s*작성은\s*(?:[^" + Q + r"]*?상담사\s*)?[" + Q + r"]?\s*([^" + Q + r"]+?)\s*[" + Q + r"]?\s*님께서"),
    re.compile(r"상담사\s*[" + Q + r"]?\s*([^" + Q + r"]+?)\s*[" + Q + r"]?\s*님께서\s*작성하셨습니다"),
    # ④ 맺음말 서명: 「8월의 경금일간 운세, "리보"였습니다.」
    re.compile(r"운세[,，]\s*[" + Q + r"]\s*([^" + Q + r"]+?)\s*[" + Q + r"]\s*였습니다"),
]
def find_credit(line):
    for c in CREDS:
        m = c.search(line)
        if m:
            v = m.group(1).strip()
            if 1 < len(v) < 20 and "상담사" not in v: return v
    return None
bid, apply = sys.argv[1], "--apply" in sys.argv

p = INV / f"{bid}_posts.jsonl"
rows = [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
cache = {}
def raw(fn):
    if fn not in cache: cache[fn] = (SNAP / fn).read_text(encoding="utf-8").splitlines()
    return cache[fn]

fill = agree = disagree = 0
for r in rows:
    seg = raw(r["file"])[r["lines"][0]-1:r["lines"][1]]
    found = None
    for L in seg:
        found = find_credit(L)
        if found: break
    cur = r.get("sub_author")
    if found and not cur:
        fill += 1; r["sub_author"] = found
        print(f"  채움 {r['post_id']}: {found}")
    elif found and cur:
        if cur.replace(" ", "") == found.replace(" ", ""): agree += 1
        else:
            disagree += 1
            print(f"  !! 불일치 {r['post_id']}: 에이전트='{cur}' 원문='{found}'")
    elif cur and not found:
        disagree += 1
        print(f"  !! 근거없음 {r['post_id']}: 에이전트='{cur}' (원문에 크레딧 줄 없음)")

print(f"[{bid}] 채움 {fill} · 일치 {agree} · 불일치 {disagree} · 총 {len(rows)}글")
if apply and fill:
    p.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")
    print("→ 저장함")
elif fill:
    print("→ (미저장, --apply 필요)")
