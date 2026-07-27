# -*- coding: utf-8 -*-
"""노드 '해'의 개념마커 적중률 실측 — build_neuron_map의 함수를 그대로 호출."""
import json, sys, io, os, re
from collections import Counter
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = r"C:\Users\[가림-계정]\OneDrive\황세웅\6.  Nomute\3. 사주\2. 정제작업"
sys.path.insert(0, os.path.join(ROOT, "_현황판"))
os.chdir(os.path.join(ROOT, "_현황판"))
import build_neuron_map as B
B.SNAP_DIRS = B._snapshot_dirs()
print("SNAP_DIRS:", len(B.SNAP_DIRS) if B.SNAP_DIRS else 0)
from pathlib import Path
DATA = B.DATA
paras = [json.loads(l) for l in (DATA/"paras_all.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
posts = {p["post_id"]: p for p in (json.loads(l) for l in (DATA/"posts_all.jsonl").read_text(encoding="utf-8").splitlines() if l.strip())}
print("paras:", len(paras), "posts:", len(posts))

HAE_HARM = re.compile(r"害|형충파해|파해|육해|원진|육파")
HAE_JI   = re.compile(r"亥|해수|해묘미|인신사해|사해|해월|해일주|해시")
cnt = Counter()
hae_ids=set(); haesu_ids=set()
n_hae=0
for q in paras:
    t = B.para_text(q, posts)
    cs = B.concepts_in(t)
    if "해" in cs:
        n_hae+=1
        hae_ids.add(q.get("para_id"))
        h = bool(HAE_HARM.search(t)); j = bool(HAE_JI.search(t))
        if h and j: cnt["둘다"]+=1
        elif h: cnt["害만"]+=1
        elif j: cnt["亥만"]+=1
        else: cnt["없음"]+=1
    if "해수(亥)" in cs:
        haesu_ids.add(q.get("para_id"))
print("node 해 paras:", n_hae, dict(cnt))
print("해 ∩ 해수(亥):", len(hae_ids & haesu_ids))
print("해수(亥) paras:", len(haesu_ids))
print("亥문단인데 해수(亥)에 안걸린 수:", cnt["亥만"] - len((hae_ids-haesu_ids) & hae_ids) if False else "계산아래")
# 亥 문맥인데 해수(亥) 노드에 안 걸린 것
only_hae_ji = set()
for q in paras:
    pid=q.get("para_id")
    if pid in hae_ids and pid not in haesu_ids:
        only_hae_ji.add(pid)
print("해 노드에만 있고 해수(亥)에 없는 문단:", len(only_hae_ji))
