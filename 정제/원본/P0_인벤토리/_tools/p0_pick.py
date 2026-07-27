# 인벤토리에서 깃발별 축자 후보 추출 (보드 [1부-보완] 코멘트 재료)
# usage: python p0_pick.py <flag> [개수] [최소길이]
import json, sys
from pathlib import Path
INV = Path(r"C:\Users\Hwang\OneDrive - GS칼텍스 예울마루\황세웅\6.  Nomute\3. 사주\2. 정제작업\P0_인벤토리")
posts = {}
for f in sorted(INV.glob("*_posts.jsonl")):
    for l in f.read_text(encoding="utf-8").splitlines():
        if l.strip():
            p = json.loads(l); posts[p["post_id"]] = p
paras = []
for f in sorted(INV.glob("*_paras.jsonl")):
    paras += [json.loads(l) for l in f.read_text(encoding="utf-8").splitlines() if l.strip()]

flag = sys.argv[1]
limit = int(sys.argv[2]) if len(sys.argv) > 2 else 15
minlen = int(sys.argv[3]) if len(sys.argv) > 3 else 25
got = [q for q in paras if flag in q.get("flags", []) and q.get("quote") and len(q["quote"]) >= minlen]
print("flag=%s : %d건 중 %d 표시" % (flag, len(got), min(limit, len(got))))
for q in got[:limit]:
    p = posts.get(q["post_id"], {})
    a = p.get("author"); t = (p.get("title") or "")[:30]
    print("\n[%s | %s | %s]" % (a, t, q["para_id"]))
    print("  " + q["quote"][:150])
