# -*- coding: utf-8 -*-
"""
잔량표 — **수확한 것 중 아직 지도에 안 붙은 것**을 하나도 빠짐없이 센다.

═══ 왜 만드나 ═══
  운영자 260726: *"아니 이리 하나 하나 알려줘야하누?ㅋ"* / *"**거기있는거 다 옮기라니까
  파일 필요없을때까지**"*

  정확한 지적이다. 나는 표를 **골라서** 붙이고 있었고, 무엇이 남았는지는
  «그때그때 화면에 찍히는 경고»로만 알 수 있었다. 그러면 운영자가 하나씩 짚어야 한다.
  → **목표를 «남은 게 0»으로 바꾼다.** 이 파일이 그 0을 세는 자다.

  ⚠이 파일은 «수확본 → 지도» 구간만 센다. 「보드/웹에 더 있는데 수확 자체를 안 한 것」은
  못 잡는다 — 그건 추출 담당의 몫이고, 그쪽 잔량은 `_피그잼정제/해설.md`의
  «안 뽑은 것 건수»와 `_웹기틀/공백표.md`가 들고 있다. 둘 다 여기 링크로 남긴다.

출력: data/잔량표.md   (+ 남은 게 있으면 화면에 목록)
"""
import json, sys
from pathlib import Path
from collections import Counter

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"


def jl(p):
    if not p.exists():
        return []
    return [json.loads(l) for l in p.read_text(encoding="utf-8").split(chr(10))
            if l.strip() and not l.lstrip().startswith('{"_')]


def main():
    붙은표 = Counter()
    for e in jl(DATA / "조견표_간선.jsonl"):
        # ⚠간선 하나가 여러 표에서 왔을 수 있다(같은 (a,b)를 보드와 웹이 둘 다 말하면 합쳐진다).
        #   **기여한 표를 전부** 세야 한다 — 첫 것만 세면 나머지가 «안 붙음»으로 오보된다.
        for _nm in (e.get("표목록") or [e.get("표", "")]):
            붙은표[str(_nm)] += 1
            붙은표[str(_nm).split("·")[0]] += 0   # 키 존재만 보장(접미 제거형 조회용)
            붙은표[str(_nm).split("·")[0]] += 1

    rows = []
    for src, path, key, cnt in (
            ("보드", HERE / "_피그잼정제" / "조견표.jsonl", "표이름", "표"),
            ("웹", HERE / "_웹기틀" / "조견표_웹.jsonl", "이름", "표")):
        for r in jl(path):
            nm = r.get(key, "?")
            칸 = len(r.get(cnt) or [])
            got = 붙은표.get(nm.split("·")[0], 0) or 붙은표.get(nm.split("(")[0].strip(), 0)
            rows.append({"출처": src, "표": nm, "칸": 칸, "붙은 간선": got,
                         "상태": ("✅붙음" if got else "🔴안붙음"),
                         "para_id": r.get("para_id"), "판본": r.get("판본")})

    안붙음 = [r for r in rows if not r["붙은 간선"]]
    규칙 = jl(HERE / "_피그잼정제" / "규칙.jsonl")

    L = ["# 잔량표 — 수확본 중 아직 지도에 안 붙은 것", "",
         "> 운영자 260726: *\"거기있는거 **다 옮기라니까 파일 필요없을때까지**\"*",
         "> 목표는 «많이 붙였다»가 아니라 **«남은 게 0»**이다.", "",
         f"- 수확 표 **{len(rows)}** (보드 {sum(1 for r in rows if r['출처']=='보드')} "
         f"· 웹 {sum(1 for r in rows if r['출처']=='웹')})",
         f"- 붙은 표 **{len(rows)-len(안붙음)}** · 🔴**안 붙은 표 {len(안붙음)}** "
         f"(칸 {sum(r['칸'] for r in 안붙음):,})",
         f"- 지도에 올라간 조견표 간선 **{sum(붙은표.values()):,}**",
         f"- 보드 «규칙»(표 아님) {len(규칙)}건 — 이건 아직 간선화 경로가 없다", "",
         "## 🔴 안 붙은 표", ""]
    if 안붙음:
        L += ["| 출처 | 표 | 칸 | para_id | 판본 |", "|---|---|---:|---|---|"]
        for r in sorted(안붙음, key=lambda x: -x["칸"]):
            L.append(f"| {r['출처']} | {r['표']} | {r['칸']} | {r.get('para_id') or ''} "
                     f"| {(r.get('판본') or '')[:40]} |")
    else:
        L.append("**없다. 수확한 표는 전부 지도에 있다.**")

    L += ["", "## ✅ 붙은 표", "", "| 출처 | 표 | 칸 | 간선 |", "|---|---|---:|---:|"]
    for r in sorted([x for x in rows if x["붙은 간선"]], key=lambda x: -x["붙은 간선"]):
        L.append(f"| {r['출처']} | {r['표']} | {r['칸']} | {r['붙은 간선']} |")

    L += ["", "## ⚠이 표가 못 세는 것 (다른 곳에 있다)", "",
          "- **보드에서 «안 뽑은 것»** — 추출 담당이 의도적으로 제외한 결론성 서술 약 200건. "
          "`_피그잼정제/해설.md` 참조. (길흉·성격이라 경계선 밖 — 안 뽑는 게 맞다)",
          "- **보드에서 «못 뽑은 것»** — 라벨만 있고 값이 빈 절(십성 재/관/인 3표 · "
          "십이운성 11절 · 백호대살). `_피그잼정제/해설.md`.",
          "- **웹의 결손 표 23곳** — 원문이 이미지라 텍스트가 없는 자리. "
          "파일:줄 좌표가 `_웹기틀/공백표.md`에 있다. 원본 재수집이 필요하다.",
          "- **보드 «규칙» 44건** — 표가 아니라 서술형 규칙이라 간선화 경로가 아직 없다. "
          "`_피그잼정제/규칙.jsonl`."]
    (DATA / "잔량표.md").write_text(chr(10).join(L) + chr(10), encoding="utf-8")

    print(f"잔량표 — 수확 표 {len(rows)} · 붙음 {len(rows)-len(안붙음)} · "
          f"🔴안붙음 {len(안붙음)} (칸 {sum(r['칸'] for r in 안붙음):,})")
    for r in sorted(안붙음, key=lambda x: -x["칸"]):
        print(f"   🔴[{r['출처']}] {r['표']}  {r['칸']}칸")
    print(f"→ {DATA / '잔량표.md'}")


if __name__ == "__main__":
    main()
