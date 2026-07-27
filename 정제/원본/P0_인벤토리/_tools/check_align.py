# 배치의 줄번호가 어느 좌표계인지 판정: post 시작줄이 '제목줄'인가 확인
import json, re, sys
from pathlib import Path
SNAP = Path(r"C:\Users\Hwang\OneDrive - GS칼텍스 예울마루\황세웅\6.  Nomute\3. 사주\2. 정제작업\P0_인벤토리\webtxt_v1")
OUT = Path(__file__).parent / "p0_out"
bid = sys.argv[1]
posts = []
for f in sorted(OUT.glob(f"{bid}_posts*.jsonl")):
    posts += [json.loads(l) for l in f.read_text(encoding="utf-8").splitlines() if l.strip()]
DATE = re.compile(r"^작성일\s+\d{4}-\d{2}-\d{2}")
for fn in {p["file"] for p in posts}:
    txt = (SNAP / fn).read_text(encoding="utf-8")
    sl = txt.splitlines()                      # Python 기준
    nl = txt.split("\n")                       # Read 기준
    if nl and nl[-1] == "": nl = nl[:-1]
    ok_sl = ok_nl = 0
    for p in [q for q in posts if q["file"] == fn and q["post_id"].endswith(tuple("0123456789"))]:
        a = p["lines"][0]
        if p.get("title", "").startswith("["): continue      # 머리말 레코드 제외
        if a < len(sl) and DATE.match(sl[a]): ok_sl += 1      # 제목줄 다음이 날짜줄
        if a < len(nl) and DATE.match(nl[a]): ok_nl += 1
    print(f"[{bid}] {fn}: splitlines정합 {ok_sl} · \\n정합 {ok_nl} · 총 {len([q for q in posts if q['file']==fn])}")
    print("  판정:", "Python(splitlines) 기준" if ok_sl > ok_nl else ("Read(\\n) 기준" if ok_nl > ok_sl else "구분 불가/무관"))
