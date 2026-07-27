# -*- coding: utf-8 -*-
"""
정의 정제본 빌더 — 사람이 쓴 원고(정의원고\*.txt)를 데이터로 굳힌다.

운영자 지시(260726):
  "일단 우리가 재정의하는 것에는 근거를 둘 필요는 없어.
   그리고 정의하는 것에 우리 자체의견으로 그거를 명시할 필요는없어 분류하고 정제할 뿐임.
   그래서 인용하거나 원본글에 대한 소스를 담아줄 필요없음.
   어떤 특정인이 한 말 - 이런식으로 할 필요도없음 심지어 전사를 하는 그 대상이더라도"

→ 개념 정의는 «누구의 주장»이 아니라 공통 지식이다. 저자·출처를 달지 않는다.
  (추적용 원재료는 data\정의카드.jsonl에 그대로 남아 있다 — 지우지 않는다.)

원고 형식:  개념명|정의문     (한 줄에 하나, `|` 하나로 구분)
⚠개념명은 **정본 노드명**이어야 한다. 아니면 exit 1 — 7대 교훈
  "링크에 정본 노드명을 안 쓰면 가위 이야기가 원숭이에 붙는다".

사용: python build_definitions.py   →  data\정의_정제본.jsonl
"""
import json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
SRC = HERE / "정의원고"

lay = {json.loads(l)["concept"] for l in
       (DATA / "node_layers.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()}

out, bad, dup = {}, [], []
for f in sorted(SRC.glob("*.txt")):
    for i, ln in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
        if not ln.strip():
            continue
        c, _, d = ln.partition("|")
        c, d = c.strip(), d.strip()
        if not c or not d:
            bad.append((f.name, i, ln[:40], "형식 오류"))
            continue
        if c not in lay:
            bad.append((f.name, i, c, "정본 노드명 아님"))
            continue
        if c in out:
            dup.append((f.name, i, c))
        out[c] = d

if bad:
    print("[정의 원고 오류] 조용히 통과시키면 볼트에 유령 정의가 생긴다.")
    for f, i, x, why in bad[:20]:
        print(f"  {f}:{i}  {x}  — {why}")
    sys.exit(1)
if dup:
    print(f"⚠중복 정의 {len(dup)}건 — 뒤엣것이 이깁니다: {dup[:5]}")

miss = sorted(lay - set(out))
(DATA / "정의_정제본.jsonl").write_text(
    "\n".join(json.dumps({"concept": c, "정의": d}, ensure_ascii=False)
              for c, d in out.items()) + "\n", encoding="utf-8")
print(f"정제 정의 {len(out)}/{len(lay)} · 미작성 {len(miss)}")
if miss:
    print("  미작성:", ", ".join(miss[:20]))
print("→", DATA / "정의_정제본.jsonl")
