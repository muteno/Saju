# P0 인벤토리 전역 무결성 점검 — 배치 내부 검사(p0_verify.py)로는 못 잡는 것들
#   ①배치 간 post_id/para_id 충돌 ②같은 파일을 두 배치가 겹쳐 처리했는지 ③파일별 커버 완결성
# usage: python p0_global.py
import json, re
from pathlib import Path
from collections import Counter, defaultdict

INV = Path(__file__).resolve().parent.parent          # P0_인벤토리
# 스냅샷 폴더는 이름 규칙으로 자동 발견(새 채널 스냅샷 추가 시 코드 수정 불요)
SNAPS = sorted(p for p in INV.iterdir() if p.is_dir() and (p.name == "webtxt_v1" or p.name.startswith("transcript_")))
def _snap(fn):
    for s in SNAPS:
        if (s / fn).exists(): return s / fn
    raise FileNotFoundError(fn)

posts, paras = [], []
for f in sorted(INV.glob("*_posts.jsonl")):
    b = f.name.split("_")[0]
    for l in f.read_text(encoding="utf-8").splitlines():
        if l.strip():
            o = json.loads(l); o["_batch"] = b; posts.append(o)
for f in sorted(INV.glob("*_paras.jsonl")):
    paras += [json.loads(l) for l in f.read_text(encoding="utf-8").splitlines() if l.strip()]

dp = [k for k, v in Counter(p["post_id"] for p in posts).items() if v > 1]
dq = [k for k, v in Counter(q["para_id"] for q in paras).items() if v > 1]
print(f"■ 총 post {len(posts)} · para {len(paras)} · 인용 {sum(1 for q in paras if q.get('quote'))}")
print(f"G-A ID 충돌: post {len(dp)} {dp[:5]} · para {len(dq)} {dq[:5]}")

span = defaultdict(list)
for p in posts: span[p["file"]].append((p["lines"][0], p["lines"][1], p["_batch"], p["post_id"]))
over = 0
for fn, rows in span.items():
    rows.sort()
    for i in range(1, len(rows)):
        if rows[i][0] <= rows[i-1][1]:
            print(f"G-B 겹침! {fn}: {rows[i-1]} vs {rows[i]}"); over += 1
print(f"G-B 배치 간 줄범위 겹침: {over}건")

print("G-C 파일별 커버 완결성 (처리된 파일만)")
incomplete = 0
for fn, rows in sorted(span.items()):
    try: n = len(_snap(fn).read_text(encoding="utf-8-sig").splitlines())
    except FileNotFoundError: print(f"   !! 스냅샷 없음: {fn}"); continue
    cov = set()
    for a, b, _, _ in rows: cov.update(range(a, b + 1))
    miss = sorted(set(range(1, n + 1)) - cov)
    if miss:
        incomplete += 1
        gaps = []
        for m in miss:
            if gaps and gaps[-1][1] == m - 1: gaps[-1][1] = m
            else: gaps.append([m, m])
        print(f"   !! {fn}: 미커버 {len(miss)}줄 {gaps[:4]}")
print(f"   미완결 파일 {incomplete} / 처리 파일 {len(span)}")

allfiles = [f.name for s in SNAPS for pat in ("*.txt", "*.md") for f in sorted(s.glob(pat))]
todo = [n for n in allfiles if n not in span]
print(f"■ 미착수 파일 {len(todo)}개" + (f" (예: {todo[:3]})" if todo else " — 전량 처리 완료"))
