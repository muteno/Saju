# -*- coding: utf-8 -*-
"""
★결핍표 — «앱이 이 개념으로 답하려면 무엇이 있어야 하나»를 노드마다 센다.

═══ 운영자 지시 (260727) ═══
  *"지금 개념중에 **어디가 부족한지 노드별로 분석**하고, 부족한 부분을 다시 웹 넣어서 채우자"*

═══ 🔴이 파일이 생긴 계기 = 내가 틀린 자로 쟀기 때문이다 ═══
  처음 결핍을 잴 때 `코퍼스.문단들()`을 **기본값**으로 불렀다. 그 기본값은 §3 규칙대로
  **방법론 보드(운영자 피그잼)를 뺀다** — 통계 이중계상을 막는 옳은 설계다.
  그런데 «근거가 있나»를 묻는 자리에서 그 기본값을 쓰면 **보드에만 있는 것이 «없음»으로 찍힌다.**
  실물: `부성입묘`가 «문단 0 · 자료없음»으로 나왔는데, 조견표 전량이 보드 `BD-0078`에 있다
        (5일주 + 일주별 관성 천간 + 6충 + 왕자입고 기전까지).
  실측: 보드를 넣으면 **182개 개념의 근거가 늘고, «근거 0» 개념이 1 → 0**이 된다.
  → **결핍은 «보드 포함»으로 잰다.** 밀착 통계는 여전히 보드를 뺀다 — 자가 다른 것이다.

═══ 여섯 칸 ═══
  ①정의 ②근거(문단) ③조견표(산출·절차 간선) ④L1 결정론 간선 ⑤발현 ⑥낭설률
  ⚠**칸마다 «없음»의 뜻이 다르다** — S11 상담론에 조견표가 없는 건 정상이고,
    S06 신살에 조견표가 없는 건 결함이다. 그래서 대주제별로 기대치를 다르게 둔다.

출력: data/결핍표.md · data/결핍표.jsonl
"""
import json, sys
from pathlib import Path
from collections import Counter, defaultdict

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
sys.path.insert(0, str(HERE))
import 코퍼스 as CP                # noqa: E402
from 작업내역 import 단계          # noqa: E402
import importlib.util as _ilu      # noqa: E402
_sp = _ilu.spec_from_file_location("bnm", HERE / "build_neuron_map.py")
bnm = _ilu.module_from_spec(_sp); _sp.loader.exec_module(bnm)
bnm.SNAP_DIRS = bnm._snapshot_dirs()

# 조견표가 «있어야 하는» 갈래 — 없으면 결함
조견표_기대 = ("S02", "S03", "S04", "S06", "S07", "S14")
# 조견표가 «없어도 되는» 갈래 — 상담론·인물은 결정론 표가 원래 없다
조견표_면제 = ("S11", "S12")


def jl(p):
    p = DATA / p
    return [json.loads(l) for l in p.read_text(encoding="utf-8").split(chr(10))
            if l.strip() and not l.lstrip().startswith('{"_')] if p.exists() else []


def main():
    lay = {r["concept"]: r for r in jl("node_layers.jsonl")}
    정의 = {r["concept"]: r.get("정의", "") for r in jl("정의_정제본.jsonl")}

    # ★근거는 «보드 포함»으로 센다 (위 주석)
    근거 = Counter(); 출처 = defaultdict(set)
    for r in CP.문단들(보드=True):
        t = r.get("text") or ""
        a = r.get("출처종", "?")
        for c in bnm.concepts_in(t):
            if c in lay:
                근거[c] += 1; 출처[c].add(a)

    L1 = Counter(); 조건부 = Counter()
    for e in jl("링크망.jsonl"):
        층 = str(e.get("층", ""))
        for n in (e.get("a"), e.get("b")):
            if n in lay:
                if 층.startswith("L1결정론"): L1[n] += 1
                elif 층.startswith("L1½"): 조건부[n] += 1
    조견 = Counter(); 발현 = Counter()
    for e in jl("relation_edges.jsonl"):
        k = e.get("kind")
        for n in (e.get("a"), e.get("b")):
            if n in lay:
                if k in ("산출", "절차"): 조견[n] += 1
                if k in ("발현", "귀결"): 발현[n] += 1
    낭설 = Counter(); 총 = Counter()
    for r in jl("근거사슬.jsonl"):
        for n in (r["a"], r["b"]):
            if n in lay:
                총[n] += 1
                if r["판정"] == "낭설후보": 낭설[n] += 1

    rows = []
    for c, m in lay.items():
        big = str(m.get("big") or "")
        code = big[:3]
        miss = []
        if not 정의.get(c): miss.append("정의")
        if 근거[c] < 100: miss.append(f"근거{근거[c]}")
        if 조견[c] == 0 and code in 조견표_기대: miss.append("조견표")
        if L1[c] < 3: miss.append(f"L1={L1[c]}")
        if 발현[c] == 0 and code not in 조견표_면제: miss.append("발현")
        nr = (낭설[c] / 총[c]) if 총[c] else 0
        if nr > 0.5 and code not in 조견표_면제: miss.append(f"낭설{nr:.0%}")
        rows.append({"개념": c, "대주제": big, "중주제": m.get("mid"),
                     "결핍수": len(miss), "빠진것": miss,
                     "근거": 근거[c], "출처종": sorted(출처[c]),
                     "조견표": 조견[c], "L1": L1[c], "조건부": 조건부[c],
                     "발현": 발현[c], "낭설률": round(nr, 2),
                     "정의": bool(정의.get(c))})
    rows.sort(key=lambda r: (-r["결핍수"], r["근거"]))

    with (DATA / "결핍표.jsonl").open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    dist = Counter(r["결핍수"] for r in rows)
    보드만 = [r["개념"] for r in rows if r["출처종"] == ["보드"]]
    L = ["# 결핍표 — 노드별로 «무엇이 없나»", "",
         "> 운영자: *\"지금 개념중에 **어디가 부족한지 노드별로 분석**하고, 부족한 부분을 다시 채우자\"*", "",
         "> 🔴**근거는 «방법론 보드 포함»으로 센다.** 처음엔 기본값(보드 제외)으로 쟀는데,",
         "> 그러면 **보드에만 있는 것이 «자료없음»으로 찍힌다** — `부성입묘`가 그랬다.",
         "> 보드를 넣으면 182개 개념의 근거가 늘고 «근거 0» 개념이 **1 → 0**이 된다.",
         "> ⚠단 **밀착 통계는 여전히 보드를 뺀다**(이중계상 방지). 자가 다른 것이다.", "",
         "> ⚠칸마다 «없음»의 뜻이 다르다 — S11 상담론에 조견표가 없는 건 정상,",
         "> S06 신살에 없는 건 결함이다. 그래서 갈래별로 기대치를 다르게 뒀다.", "",
         f"- 개념 {len(rows)} · 결핍 분포 " +
         " · ".join(f"{k}개={v}" for k, v in sorted(dist.items())), ""]
    if 보드만:
        L += [f"## ⚠근거가 **보드에만** 있는 개념 {len(보드만)}", "",
              "> 코퍼스(웹·전사)엔 없고 운영자 피그잼에만 있다. **없는 게 아니라 여기 있다.**", ""]
        for c in 보드만:
            L.append(f"- {c}")
        L.append("")
    L += ["## 결핍 3개 이상", "",
          "| 결핍 | 개념 | 대주제 | 근거 | 조견표 | L1 | 발현 | 낭설 | 빠진 것 |",
          "|---:|---|---|---:|---:|---:|---:|---:|---|"]
    for r in rows:
        if r["결핍수"] < 3:
            continue
        L.append(f"| {r['결핍수']} | {r['개념']} | {r['대주제'][:14]} | {r['근거']:,} | "
                 f"{r['조견표']} | {r['L1']} | {r['발현']} | {r['낭설률']:.0%} | "
                 f"{' · '.join(r['빠진것'])} |")
    (DATA / "결핍표.md").write_text("\n".join(L) + "\n", encoding="utf-8")

    print(f"결핍표 — 개념 {len(rows)} · 분포 {dict(sorted(dist.items()))}")
    print(f"  근거가 보드에만 있는 개념 {len(보드만)}" +
          (f" — {', '.join(보드만)}" if 보드만 else ""))
    print(f"→ {DATA/'결핍표.md'}")
    return rows, dist, 보드만


if __name__ == "__main__":
    with 단계("결핍표", "노드마다 «앱이 답하려면 무엇이 있어야 하나»를 센다 — 보드 포함으로",
            ["data/결핍표.md", "data/결핍표.jsonl"]) as st:
        rows, dist, 보드만 = main()
        st.기록(f"개념 {len(rows)} · 결핍분포 {dict(sorted(dist.items()))} · 보드전용 {len(보드만)}")
