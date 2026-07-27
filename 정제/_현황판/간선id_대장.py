# -*- coding: utf-8 -*-
"""
간선id 대장 — id가 언제 바뀌었는지 추적한다.

═══ 왜 지금인가 (260726 페이블 점검) ═══
  *"L1의 `E-` id는 kind 기반이라 합→육합 세분 때 **실제로 바뀌었다**.
    다행히 어제 부여됐고 아직 유닛이 id를 참조 안 해 실해는 0.
    **지금이 id 안정화 마지노선이다.**"*

  간선id가 있는 이유는 «조건·프로브·판단 유닛이 간선을 가리키기» 위해서다.
  그런데 id가 `hash(a, b, kind)`라서 **kind를 다듬으면 id가 통째로 바뀐다.**
  오늘 「합」을 육합/방합/삼합으로 가르면서 실제로 그렇게 됐다.
  아직 가리키는 쪽이 없어 손해가 0인 지금이, 대장을 세울 마지막 시점이다.

═══ 왜 «불변 id»가 아니라 «대장»인가 ═══
  id를 아예 안 변하게 만들려면 kind를 id에서 빼야 하는데, 그러면
  **자축 = 육합 + 방합** 처럼 한 쌍에 두 관계가 있는 경우 id가 충돌한다.
  (오늘 그 두 관계를 갈라 낸 것이 옳은 정제였다 — 설계를 되돌릴 수 없다.)
  → id는 지금 방식을 유지하고, **바뀔 때마다 기록**한다.
    이 프로젝트의 원칙과 같다: 되돌릴 수 없게 만들지 말고, 무슨 일이 있었는지 남긴다.

═══ 무엇을 잡아내는가 ═══
  · 사라진 id — 누가 그 간선을 가리키고 있었다면 끊긴다
  · 새 id      — 같은 (a,b)인데 id가 달라졌으면 «이름만 바뀐 것»일 수 있다
  · 이사(rename) 후보 — (a,b)가 같고 kind만 바뀐 것을 짝지어 보여준다

출력: data/간선id_대장.json (전량) · data/간선id_변경.md (이번 회차 차이)
"""
import json, sys
from pathlib import Path
from collections import defaultdict

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
LEDGER = DATA / "간선id_대장.json"


def jl(n):
    p = DATA / n
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()] \
        if p.exists() else []


def main(stamp="260726"):
    E = jl("링크망.jsonl")
    cur = {}
    for e in E:
        i = e.get("간선id")
        if not i:
            continue
        cur[i] = {"a": e["a"], "b": e["b"], "kind": e.get("kind"), "층": e.get("층")}

    old = {}
    if LEDGER.exists():
        old = json.loads(LEDGER.read_text(encoding="utf-8")).get("id", {})

    gone = {i: v for i, v in old.items() if i not in cur}
    new = {i: v for i, v in cur.items() if i not in old}
    kept = len(cur) - len(new)

    # 이사 짝짓기 — (a,b)가 같은데 id가 바뀐 것
    bypair = defaultdict(list)
    for i, v in new.items():
        bypair[tuple(sorted((v["a"], v["b"])))].append((i, v))
    moves = []
    for i, v in gone.items():
        p = tuple(sorted((v["a"], v["b"])))
        for j, w in bypair.get(p, []):
            moves.append((i, v, j, w))
            break

    # 대장 갱신 — 사라진 것도 «묘비»로 남긴다(지우지 않는다)
    ledger = {"갱신": stamp, "id": cur, "묘비": {}}
    if LEDGER.exists():
        prev = json.loads(LEDGER.read_text(encoding="utf-8"))
        ledger["묘비"] = prev.get("묘비", {})
    for i, v in gone.items():
        ledger["묘비"][i] = {**v, "사라진날": stamp}
    LEDGER.write_text(json.dumps(ledger, ensure_ascii=False, indent=1), encoding="utf-8")

    L = ["# 간선id 변경 대장", "",
         f"- 현재 id **{len(cur):,}** · 유지 {kept:,} · 신규 {len(new):,} · 사라짐 {len(gone):,}",
         f"- 묘비 누적 {len(ledger['묘비']):,} (사라진 id는 지우지 않는다 — 누가 가리켰을 수 있다)",
         "",
         "> 간선id는 `hash(a, b, kind)`다. **kind를 다듬으면 id가 바뀐다.**",
         "> 아예 안 변하게 하려면 kind를 빼야 하는데, 그러면 «자축 = 육합 + 방합»처럼",
         "> 한 쌍에 두 관계가 있을 때 충돌한다. 그래서 **id는 두고 변경을 기록**한다.", ""]
    if moves:
        L += [f"## 이사 후보 {len(moves)}건 — 같은 쌍인데 id가 바뀌었다", "",
              "| 옛 id | 새 id | 쌍 | 옛 kind → 새 kind |", "|---|---|---|---|"]
        for i, v, j, w in moves[:60]:
            L.append(f"| `{i}` | `{j}` | {v['a']}↔{v['b']} | {v['kind']} → {w['kind']} |")
        L.append("")
    if gone and not moves:
        L += ["## 사라진 id (짝을 못 찾음)", "", "| id | 쌍 | kind |", "|---|---|---|"]
        for i, v in list(gone.items())[:40]:
            L.append(f"| `{i}` | {v['a']}↔{v['b']} | {v['kind']} |")
    if not gone and not new:
        L.append("✅ 이번 회차 id 변동 없음 — 가리키던 참조가 있었어도 안 끊긴다.")
    (DATA / "간선id_변경.md").write_text("\n".join(L) + "\n", encoding="utf-8")

    print(f"간선id 대장 — 현재 {len(cur):,} · 유지 {kept:,} · 신규 {len(new):,} · "
          f"사라짐 {len(gone):,} · 이사후보 {len(moves)}")
    if moves:
        for i, v, j, w in moves[:5]:
            print(f"   ↪ {v['a']}↔{v['b']}  {v['kind']}→{w['kind']}  ({i} → {j})")
    return len(gone), len(new)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "260726")
