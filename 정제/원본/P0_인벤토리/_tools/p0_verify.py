# P0 산출물 기계 검수기 — 배치 하나를 인자로 받아 5게이트 검사
# usage: python p0_verify.py <배치ID>  (예: CHO-B)
import json, sys, re, os
from pathlib import Path

# 계정(사용자 폴더명)·OS가 바뀌어도 살아남게 홈 기반 후보 + 구계정 폴백
_CANDS = [
    # 맥(OneDrive CloudStorage) — 260725 추가. 맥 세션에서 이게 없으면 전 배치가 "스냅샷에 없음" 오탐.
    Path.home() / "Library" / "CloudStorage" / "OneDrive-GS칼텍스예울마루" / "황세웅" / "6.  Nomute" / "3. 사주" / "2. 정제작업" / "P0_인벤토리",
    Path(os.environ.get("USERPROFILE", "")) / "OneDrive - GS칼텍스 예울마루" / "황세웅" / "6.  Nomute" / "3. 사주" / "2. 정제작업" / "P0_인벤토리",
    Path(r"C:\Users\황세웅\OneDrive - GS칼텍스 예울마루\황세웅\6.  Nomute\3. 사주\2. 정제작업\P0_인벤토리"),
    Path(r"C:\Users\Hwang\OneDrive - GS칼텍스 예울마루\황세웅\6.  Nomute\3. 사주\2. 정제작업\P0_인벤토리"),
]
_BASE = next((p for p in _CANDS if p.exists()), None)
if _BASE is None:
    sys.exit("!! P0_인벤토리 폴더를 못 찾음 — _CANDS 경로 확인 필요")
SNAPS = [_BASE / "webtxt_v1", _BASE / "transcript_v1", _BASE / "transcript_choco_v1", _BASE / "transcript_sanchaek_v1"]   # 웹 + 전사 스냅샷(도화도레·초코·산책처럼)
OUT = Path(__file__).parent / "p0_out"
KINDS = {"이론","사례","화법","고전","개운","운세","공지","잡동"}
SUBJS = {f"S{i:02d}" for i in range(1,13)}

bid = sys.argv[1]
def load(name):
    rows, errs = [], 0
    for f in sorted(OUT.glob(f"{bid}_{name}*.jsonl")):
        for i, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            line = line.strip()
            if not line: continue
            try: rows.append(json.loads(line))
            except Exception: errs += 1
    return rows, errs

posts, pe = load("posts")
paras, qe = load("paras")
print(f"[{bid}] posts={len(posts)} paras={len(paras)} json_err={pe+qe}")

# 게이트1: ID 중복
ids = [p.get("para_id") for p in paras]
dup = len(ids) - len(set(ids))
pids = [p.get("post_id") for p in posts]
dupp = len(pids) - len(set(pids))
print(f"G1 ID중복: para {dup} / post {dupp}")

# 파일 캐시 (원문, 공백제거 평문)
cache = {}
def get(fname):
    if fname not in cache:
        for s in SNAPS:
            if (s / fname).exists():
                # utf-8-sig: BOM 있으면 제거, 없으면 utf-8과 동일 — 전사본(utf-8-sig) 호환
                raw = (s / fname).read_text(encoding="utf-8-sig").splitlines()
                break
        else:
            raise FileNotFoundError(fname)
        flat = re.sub(r"\s+", "", "\n".join(raw))
        cache[fname] = (raw, flat)
    return cache[fname]

# 게이트2: 파일 커버리지 (posts lines 합집합)
from collections import defaultdict
byfile = defaultdict(list)
for p in posts: byfile[p["file"]].append(p)
for fname, ps in byfile.items():
    try: raw, _ = get(fname)
    except FileNotFoundError:
        print(f"G2 {fname}: 스냅샷에 없음!"); continue
    n = len(raw)
    covered = set()
    for p in ps:
        a, b = p["lines"]
        covered.update(range(a, b+1))
    missing = sorted(set(range(1, n+1)) - covered)
    # 연속 구간으로 압축
    gaps = []
    for m in missing:
        if gaps and gaps[-1][1] == m-1: gaps[-1][1] = m
        else: gaps.append([m, m])
    print(f"G2 {fname}: 총 {n}줄, 미커버 {len(missing)}줄, 구간 {gaps[:8]}{'...' if len(gaps)>8 else ''}")

# 게이트3: post 내 para 타일링
post_map = {p["post_id"]: p for p in posts}
byp = defaultdict(list)
for q in paras: byp[q["post_id"]].append(q)
tile_bad = 0; orphan = 0
for pid, qs in byp.items():
    if pid not in post_map: orphan += len(qs); continue
    a, b = post_map[pid]["lines"]
    qs = sorted(qs, key=lambda x: x["lines"][0])
    cur = a; ok = True
    for q in qs:
        s, e = q["lines"]
        if s > cur: ok = False; break   # gap
        cur = max(cur, e+1)
    if not ok or cur < b+1: tile_bad += 1
no_para = [pid for pid in post_map if pid not in byp]
print(f"G3 타일링 불량 post: {tile_bad}/{len(byp)} · 고아para {orphan} · para없는 post {len(no_para)} {no_para[:5]}")

# 게이트4: quote 전수 축자 검사 (공백 무시 부분 문자열)
qtot = qbad = 0; bad_samples = []
for q in paras:
    quote = q.get("quote")
    if not quote: continue
    qtot += 1
    fname = post_map.get(q["post_id"], {}).get("file")
    if not fname: qbad += 1; continue
    _, flat = get(fname)
    if re.sub(r"\s+", "", quote) not in flat:
        qbad += 1
        if len(bad_samples) < 5: bad_samples.append((q["para_id"], quote[:40]))
print(f"G4 quote 축자: {qtot-qbad}/{qtot} 통과, 불일치 {qbad} {bad_samples}")

# 게이트6: quote가 '자기 문단 줄 범위' 안에 있는가 (좌표계 어긋남 탐지)
rtot = rbad = 0; rbad_s = []
for q in paras:
    quote = q.get("quote")
    if not quote: continue
    fname = post_map.get(q["post_id"], {}).get("file")
    if not fname: continue
    raw, _ = get(fname)
    a, b = q["lines"]
    seg = re.sub(r"\s+", "", "\n".join(raw[max(0,a-1):b]))
    rtot += 1
    if re.sub(r"\s+", "", quote) not in seg:
        rbad += 1
        if len(rbad_s) < 5: rbad_s.append((q["para_id"], a, b))
print(f"G6 quote 범위내: {rtot-rbad}/{rtot} 통과, 범위이탈 {rbad} {rbad_s}")

# 게이트5: 값 유효성 + 분포
kb = sum(1 for q in paras if q.get("kind") not in KINDS)
sb = sum(1 for q in paras for s in q.get("subj", []) if s not in SUBJS)
gl = sum(1 for q in paras if len(q.get("gist","")) > 60)
from collections import Counter
kc = Counter(q.get("kind") for q in paras)
fc = Counter(f for q in paras for f in q.get("flags", []))
print(f"G5 kind불량 {kb} · subj불량 {sb} · gist>60자 {gl}")
print(f"   kind분포: {dict(kc.most_common())}")
print(f"   flags상위: {dict(fc.most_common(12))}")
lic = Counter(p.get("license") for p in posts)
print(f"   license: {dict(lic)} · sub_author: {dict(Counter(p.get('sub_author') for p in posts))}")
