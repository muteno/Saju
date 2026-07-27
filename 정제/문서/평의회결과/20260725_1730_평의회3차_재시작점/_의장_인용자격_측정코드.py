# -*- coding: utf-8 -*-
"""인용 자격(gist 전용) 측정 — 정의 6조합 전수. 의장 독립 재측정."""
import json, sys, io, os, re, unicodedata
from collections import Counter, defaultdict
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = r"C:\Users\[가림-계정]\OneDrive - [가림-조직]\황세웅\6.  Nomute\3. 사주\2. 정제작업"
sys.path.insert(0, os.path.join(ROOT, "_현황판"))
os.chdir(os.path.join(ROOT, "_현황판"))
import build_neuron_map as B
concept2alias = defaultdict(set)
for a, cs in B.alias2concept.items():
    for c in cs: concept2alias[c].add(a)
print("alias2concept size:", len(B.alias2concept), "| concepts:", len(concept2alias))

D = os.path.join(ROOT, "_현황판", "data")
V = json.load(open(os.path.join(D,"별칭_판정.json"), encoding='utf-8'))["aliases"]
if isinstance(V, dict): V = [dict(x, alias=a) for a, x in V.items()]
safe_alias = {x.get("alias") for x in V if x.get("verdict")=="안전"}
print("안전 별칭:", len(safe_alias))

def jl(p):
    return [json.loads(l) for l in open(p,encoding='utf-8').read().splitlines() if l.strip()]
U = jl(os.path.join(ROOT,"P2_유닛","pilot_UI.jsonl")) + jl(os.path.join(ROOT,"P2_유닛","pilot_UJ.jsonl"))

NFC = lambda s: unicodedata.normalize("NFC", s or "")
SPLIT = re.compile(r"[()·\[\]/,、]")
def decompose(name):
    out={NFC(name)}
    for p in SPLIT.split(name):
        p=p.strip()
        if len(p)>=2: out.add(NFC(p))
    # 한자 1글자도 살림
    for m in re.finditer(r"[\u4e00-\u9fff]+", name):
        out.add(NFC(m.group()))
    return {x for x in out if x}

results={}
detail={}
for text_mode in ["quote","quote+chain"]:
    for dname in ["D1_정본명","D2_분해","D3_안전별칭","D4_전체별칭","D5_안전별칭+오전사"]:
        miss=0; missing=[]
        for u in U:
            quotes = " \n ".join(NFC(e.get("quote","")) for e in u.get("근거",[]))
            if text_mode=="quote+chain":
                quotes += " \n " + NFC(json.dumps(u.get("chain"),ensure_ascii=False))
            base = quotes
            if dname=="D5_안전별칭+오전사":
                for wrong, right in (u.get("오전사") or {}).items():
                    base = base.replace(NFC(wrong), NFC(right))
            for l in u["links"].get("횡단",[]):
                to=l.get("to","")
                if not to.startswith("개념:"): continue
                c = to.split("개념:",1)[1]
                if dname=="D1_정본명": forms={NFC(c)}
                elif dname=="D2_분해": forms=decompose(c)
                elif dname=="D3_안전별칭": forms=decompose(c) | {NFC(a) for a in concept2alias.get(c,set()) if a in safe_alias}
                elif dname=="D4_전체별칭": forms=decompose(c) | {NFC(a) for a in concept2alias.get(c,set())}
                else: forms=decompose(c) | {NFC(a) for a in concept2alias.get(c,set()) if a in safe_alias}
                if not any(f and f in base for f in forms):
                    miss+=1; missing.append((u["unit_id"], c))
        results[(text_mode,dname)]=miss
        detail[(text_mode,dname)]=missing
print()
print("=== 개념링크 68건 기준 miss(=인용 자격 불합격) ===")
for k,v in results.items():
    print(f"  {k[0]:12s} {k[1]:18s}  miss {v}/68 = {v/68*100:.1f}%")
print()
print("D5(quote) miss 목록:", detail[("quote","D5_안전별칭+오전사")])
print()
d3=set(detail[("quote","D3_안전별칭")]); d5=set(detail[("quote","D5_안전별칭+오전사")])
print("오전사 치환으로 살아난 링크:", sorted(d3-d5))
