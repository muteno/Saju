# P0 현황: 전 배치 합산 + 스냅샷 파일별 커버 여부(=라운드3 대상 산출)
import json, re
from pathlib import Path
from collections import Counter, defaultdict

INV = Path(r"C:\Users\[가림-계정]\OneDrive\황세웅\6.  Nomute\3. 사주\2. 정제작업\P0_인벤토리")
SNAP = INV / "webtxt_v1"
posts, paras = [], []
for f in sorted(INV.glob("*_posts.jsonl")):
    posts += [json.loads(l) for l in f.read_text(encoding="utf-8").splitlines() if l.strip()]
for f in sorted(INV.glob("*_paras.jsonl")):
    paras += [json.loads(l) for l in f.read_text(encoding="utf-8").splitlines() if l.strip()]

print(f"■ 합산: 배치 {len(list(INV.glob('*_paras.jsonl')))} · 글 {len(posts)} · 문단 {len(paras)} · 인용 {sum(1 for p in paras if p.get('quote'))}")
print(f"  저자: {dict(Counter(p['author'] for p in posts).most_common())}")
print(f"  kind: {dict(Counter(p['kind'] for p in paras).most_common())}")
print(f"  subj: {dict(Counter(s for p in paras for s in p.get('subj',[])).most_common())}")
print(f"  flags: {dict(Counter(f for p in paras for f in p.get('flags',[])).most_common(14))}")

cov = defaultdict(int)
for p in posts: cov[p["file"]] += p["lines"][1] - p["lines"][0] + 1
done, todo = [], []
for f in sorted(SNAP.glob("*.txt")):
    n = len(f.read_text(encoding="utf-8").splitlines())
    (done if f.name in cov else todo).append((f.name, n, cov.get(f.name, 0)))
print(f"\n■ 커버 완료 {len(done)}파일 / 미착수 {len(todo)}파일")
for n, tot, c in done:
    mark = "OK" if c >= tot else f"!! {c}/{tot}"
    print(f"  [{mark}] {n} ({tot}줄)")
print(f"\n■ 라운드3 대상 (미착수, 줄수 내림차순) — 총 {sum(t for _,t,_ in todo):,}줄")
for n, tot, _ in sorted(todo, key=lambda x: -x[1]):
    print(f"  {tot:6,}줄  {n}")
