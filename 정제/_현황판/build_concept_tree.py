# -*- coding: utf-8 -*-
"""
개념 트리 — 키워드가 트리로 펴지고, 공유되는 가지에서 트리끼리 묶인다.

운영자 지시(260725 원문):
  "십이지지 하면 그 십이지지의 키워드를 트리로 쭉 빼고, 각 십이지지 키워드는 또 다른
   키워드들을 묶고, 근데 여기서 공통으로 묶이는 부분있으면 트리끼리 묶되 해석은 다르게.
   (해석과 개념 연결은 다른영역)"

→ 이 문서가 구현하는 것 3가지
  ① **트리**: 뿌리(십이지지·십천간·십성…) → 각 글자 → 그 글자가 거느리는 하위 키워드
  ② **트리 간 묶음**: 하위 키워드가 여러 뿌리에 걸치면(도화가 자·오·묘·유에 다 붙듯)
     그 지점에서 트리끼리 이어진다. 노드는 하나, 부모는 여럿.
  ③ **★해석은 부모마다 다르다**: 같은 '도화'라도 자수의 도화와 유금의 도화는 뜻이 다르다.
     그래서 해석 근거는 노드가 아니라 **(부모, 자식) 쌍**에 붙인다.
     = 운영자의 "해석과 개념 연결은 다른 영역"을 자료구조로 구현한 것.
     연결(간선)은 구조이고, 해석(근거 문단·축자)은 그 간선에 매달린 짐이다.

가지 판정 = **리프트(lift)**:
  자수의 가지 = "자수가 나온 문단에서 유독 자주 나오는 개념".
  lift = P(자식|부모) / P(자식)  — 1이면 우연, 2면 두 배로 몰린다는 뜻.
  ⚠순수 서브섬션(포함관계)은 여기 안 맞는다. 십이지지 12글자는 **서로 형제**라
  '도화'가 자수 문단의 부분집합이 될 수가 없다(12분의 1로 흩어진다). 실측으로 확인:
  SUBSUME_P=0.55로 걸었더니 가지가 전체 5개만 나왔다(260725).
  → 우리가 원하는 건 포함이 아니라 **"이 글자의 색깔"**이므로 리프트가 맞는 자다.

입력:  data/paras_all.jsonl
출력:  data/concept_tree.json  ·  개념트리.html
사용:  python build_concept_tree.py
"""
import json, html, re, unicodedata
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import defaultdict, Counter

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
KST = timezone(timedelta(hours=9))

# 뉴런망 빌더에서 매칭 로직을 그대로 가져온다(정본 1개 유지 — 두 화면이 다른 숫자를 내면 안 된다)
import importlib.util
_spec = importlib.util.spec_from_file_location("bnm", HERE / "build_neuron_map.py")
_bnm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bnm)
concepts_in = _bnm.concepts_in
concept_meta = _bnm.concept_meta

# ── 뿌리 정의: 운영자가 예로 든 '십이지지'처럼, 폐집합인 묶음을 뿌리로 세운다
ROOTS = {
    "십이지지": ["자수(子)", "축토(丑)", "인목(寅)", "묘목(卯)", "진토(辰)", "사화(巳)",
                 "오화(午)", "미토(未)", "신금(申)", "유금(酉)", "술토(戌)", "해수(亥)"],
    "십천간": ["갑목(甲)", "을목(乙)", "병화(丙)", "정화(丁)", "무토(戊)",
               "기토(己)", "경금(庚)", "신금(辛)", "임수(壬)", "계수(癸)"],
    "십성": ["비견", "겁재", "식신", "상관", "편재", "정재", "편관(칠살)", "정관", "편인", "정인"],
}

MIN_PAIR = 5        # 가지가 되려면 같이 나온 문단이 최소 몇 개
MIN_LIFT = 1.6      # 이 글자에서 base 대비 몇 배로 몰려야 '이 글자의 가지'인가
TOP_CHILD = 16      # 노드 하나당 가지 최대 수 (화면이 읽히도록)
EV_MAX = 3          # (부모,자식) 쌍마다 보여줄 근거 문단 수
DISPLAY_ROOTS = ["십이지지", "십천간", "십성"]   # 화면 상단에 먼저 펼쳐 보여줄 묶음


def main():
    # 🔴260726 수리 — 이 도구가 **세 겹으로 낡아 있었고, 볼트가 그걸 소비했다.**
    #   ① 관측창이 `gist + quote`(문단당 74자)였다. 260725에 «원문 전문»으로 넓히기로
    #      결정하고 빌더들은 바꿨는데 여기는 안 바꿨다(관측률 11.67%).
    #   ② 그 74자에 **gist(우리가 붙인 이름표)가 들어 있었다** — 우리 이름이 리프트의 근거가 됐다.
    #   ③ **웹만** 봤다. 전사 26,333문단이 통째로 빠졌다.
    #   그리고 「소비자 0」이라고 기록돼 있었는데 **틀렸다** — `build_obsidian_vault.py`가
    #   `concept_tree.json`을 읽어 개념 노트의 «이웃»을 만든다. 오염이 볼트까지 갔다.
    #   → 공용 리더로 갈아탄다. 다른 도구와 **같은 47,359 문단**을 본다.
    import 코퍼스 as _CP
    units = list(_CP.문단들())
    paras = [r["q"] for r in units]
    posts = _CP.웹_글()
    print(f"  코퍼스 {len(units):,} 문단 (공용 리더 · 원문 전문 · gist 제외 · 웹+전사)")

    occ = defaultdict(set)          # 개념 → 그 개념이 나온 문단 인덱스 집합
    pinfo = []
    for i, r in enumerate(units):
        cs = concepts_in(r["text"])
        pinfo.append(cs)
        for c in cs:
            occ[c].add(i)

    # ★모든 개념이 뿌리가 될 수 있다.
    #   운영자 260725: "일반적인 트리는 위에 계승만 하고 쭉 내려가는데, 거기에 데이터
    #   유관성으로 브레인스토밍 맵처럼 서로 무한대로 키워드가 얽힐 수 있는거지.
    #   꼬리가 맞물린다고 해야되나."
    #   → 그래서 트리를 만들지 않는다. **간선 달린 그래프 하나**를 만들고,
    #     '트리'는 뿌리를 하나 골랐을 때 그 자리에서 펴지는 **뷰**로 본다.
    #     도화는 자수의 잎이지만, 도화를 뿌리로 세우면 자·오·묘·유가 잎이 된다.
    #     해석은 노드가 아니라 **간선(부모→자식)**에 매달리므로, 뿌리를 바꾸면
    #     지나가는 간선이 달라지고 따라서 해석도 자동으로 달라진다.
    N = len(paras)
    tree = {}
    child_parents = defaultdict(list)   # 자식 → [부모…]  ← '꼬리가 맞물리는' 지점

    for parent, P in occ.items():
        if len(P) < MIN_PAIR:
            continue
        cands = []
        for child, C in occ.items():
            if child == parent:
                continue
            inter = len(P & C)
            if inter < MIN_PAIR:
                continue
            lift = (inter / len(P)) / (len(C) / N)     # base 대비 몇 배로 몰리나
            if lift < MIN_LIFT:
                continue
            cands.append((lift * (inter ** 0.5), inter, round(lift, 2), child))
        cands.sort(reverse=True)
        kids = []
        for _, inter, lift, child in cands[:TOP_CHILD]:
            ev = []
            for i in sorted(P & occ[child]):
                q = paras[i]
                if not q.get("quote"):
                    continue
                ev.append({"para_id": q.get("para_id"), "gist": q.get("gist", ""),
                           "quote": q.get("quote", ""),
                           "author": posts.get(q.get("post_id"), {}).get("author", "?")})
                if len(ev) >= EV_MAX:
                    break
            kids.append({"concept": child, "n": inter, "p": lift, "ev": ev})
            child_parents[child].append(parent)
        tree[parent] = {"group": concept_meta.get(parent, {}).get("big", ""),
                        "paras": len(P), "children": kids}

    shared = {c: ps for c, ps in child_parents.items() if len(ps) > 1}
    out = {"generated": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
           "paras": len(paras), "roots": ROOTS, "tree": tree,
           "shared": {c: sorted(ps) for c, ps in shared.items()},
           "params": {"MIN_PAIR": MIN_PAIR, "MIN_LIFT": MIN_LIFT, "TOP_CHILD": TOP_CHILD}}
    (DATA / "concept_tree.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")

    # ── HTML
    def esc(s):
        return html.escape(str(s))

    # 화면: 지정 묶음을 먼저, 그다음 나머지 개념 전부를 카드로 (모든 노드가 뿌리가 될 수 있으므로)
    listed = {c for lst in ROOTS.values() for c in lst}
    rest = sorted((c for c in tree if c not in listed),
                  key=lambda c: -len(tree[c]["children"]))
    groups_to_render = list(ROOTS.items()) + [("그 밖의 개념 — 여기서도 트리가 펴진다", rest)]

    blocks = []
    for group, members in groups_to_render:
        items = []
        for parent in members:
            node = tree.get(parent, {"paras": 0, "children": []})
            kid_html = []
            for k in node["children"]:
                c = k["concept"]
                sh = shared.get(c)
                badge = (f'<span class="sh">공유 {len(sh)}</span>' if sh else '<span class="own">고유</span>')
                others = ""
                if sh:
                    others = ('<div class="others">같은 가지가 걸린 다른 글자: '
                              + " · ".join(f'<a href="#t-{esc(p)}">{esc(p)}</a>' for p in sh if p != parent)
                              + '<br><b>→ 같은 개념이라도 여기서의 뜻은 아래 근거로 따로 읽는다</b></div>')
                ev = "".join(
                    f'<div class="ev"><div class="g">{esc(e["gist"])}'
                    f'<span class="au">{esc(e["author"])}</span></div>'
                    f'<div class="q">“{esc(e["quote"])}”</div>'
                    f'<div class="pid">{esc(e["para_id"])}</div></div>' for e in k["ev"])
                kid_html.append(
                    f'<details class="kid"><summary><a class="jump" href="#t-{esc(c)}">{esc(c)}</a> {badge}'
                    f'<span class="n">{k["n"]}문단 · {k["p"]}배 몰림</span></summary>'
                    f'{others}{ev}</details>')
            items.append(
                f'<details class="par" id="t-{esc(parent)}"><summary>{esc(parent)}'
                f'<span class="n">{node["paras"]}문단 · 가지 {len(node["children"])}</span></summary>'
                f'<div class="kids">{"".join(kid_html) or "<i>하위 키워드 없음</i>"}</div></details>')
        blocks.append(f'<h2>{esc(group)}</h2><div class="grid">{"".join(items)}</div>')

    def links(ps):
        return " · ".join('<a href="#t-%s">%s</a>' % (esc(p), esc(p)) for p in ps)

    top_shared = sorted(shared.items(), key=lambda kv: -len(kv[1]))[:24]
    shared_rows = "".join(
        f'<tr><td class="c">{esc(c)}</td><td class="num">{len(ps)}</td>'
        f'<td>{links(ps)}</td></tr>'
        for c, ps in top_shared)

    doc = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>개념 트리</title>
<style>
:root{{color-scheme:light dark}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
margin:0;padding:24px;background:#f6f7f9;color:#16181d;line-height:1.55}}
@media(prefers-color-scheme:dark){{body{{background:#14161a;color:#e6e8ec}}}}
h1{{font-size:22px;margin:0 0 4px}} h2{{font-size:17px;margin:28px 0 10px}}
.stamp{{color:#8a8f98;font-size:13px}}
.note{{background:#fff8e6;border:1px solid #f0dfa8;border-radius:10px;padding:12px 16px;font-size:14px;margin:16px 0}}
@media(prefers-color-scheme:dark){{.note{{background:#2a2515;border-color:#4a4020}}}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}}
details{{background:#fff;border:1px solid #e3e6ea;border-radius:10px;padding:8px 12px}}
@media(prefers-color-scheme:dark){{details{{background:#1c1f25;border-color:#2b2f37}}}}
summary{{cursor:pointer;font-weight:600;font-size:14px;list-style:none}}
summary::-webkit-details-marker{{display:none}}
summary::before{{content:'▸ ';color:#8a8f98}} details[open]>summary::before{{content:'▾ '}}
.n{{float:right;font-weight:400;font-size:11px;color:#8a8f98}}
.kids{{margin-top:8px;display:flex;flex-direction:column;gap:6px}}
.kid{{background:#f7f9fc;border-color:#e8ecf2;font-size:13px}}
@media(prefers-color-scheme:dark){{.kid{{background:#20242b;border-color:#2b2f37}}}}
.sh{{background:#e3edff;color:#2f5fc4;border-radius:5px;padding:0 5px;font-size:10px;margin-left:5px}}
.own{{background:#eef1f5;color:#6b7280;border-radius:5px;padding:0 5px;font-size:10px;margin-left:5px}}
@media(prefers-color-scheme:dark){{.sh{{background:#1e2f52;color:#8fb0f0}}.own{{background:#262b34;color:#9aa1ad}}}}
.others{{font-size:12px;color:#5b6270;margin:6px 0;padding:6px 8px;background:#eef2f8;border-radius:6px}}
@media(prefers-color-scheme:dark){{.others{{background:#232833;color:#9aa1ad}}}}
.ev{{border-top:1px dashed #dfe4ea;padding:6px 0;font-size:12px}}
.ev .g{{color:#3b4250;font-weight:600}} .ev .q{{color:#1c1f25;margin:2px 0}}
@media(prefers-color-scheme:dark){{.ev .g{{color:#b6bdc9}}.ev .q{{color:#e6e8ec}}}}
.ev .au{{float:right;color:#8a8f98;font-weight:400}} .ev .pid{{color:#a0a5ae;font-size:10px}}
table{{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;font-size:13px;margin-top:8px}}
@media(prefers-color-scheme:dark){{table{{background:#1c1f25}}}}
th{{text-align:left;padding:8px;background:#eef1f5;font-size:12px;color:#5b6270}}
@media(prefers-color-scheme:dark){{th{{background:#22262e;color:#9aa1ad}}}}
td{{padding:7px 8px;border-top:1px solid #eceff3}} td.c{{font-weight:600}}
td.num{{text-align:right}} a{{color:#2f5fc4;text-decoration:none}} a:hover{{text-decoration:underline}}
</style></head><body>
<h1>개념 트리 — 키워드가 펴지고, 공유되는 가지에서 트리끼리 묶인다</h1>
<div class="stamp">{out['generated']} · 문단 {len(paras):,} · 공유 가지 {len(shared)}개</div>

<div class="note">
<b>이 화면의 규칙 (운영자 지시 구현).</b><br>
① 뿌리(십이지지·십천간·십성) → 각 글자 → 그 글자가 <b>거느리는 하위 키워드</b>로 펴진다.<br>
② 하위 키워드가 여러 글자에 걸치면 <span class="sh">공유 N</span> — <b>거기서 트리끼리 이어진다.</b><br>
③ <b>같은 가지라도 뜻은 부모마다 다르다.</b> 그래서 근거(축자 인용)를 노드가 아니라
   <b>(부모→자식) 쌍마다 따로</b> 매달았다. 펼쳐서 읽으면 같은 '도화'가 글자마다
   어떻게 다르게 말해지는지 보인다. — <i>연결은 구조, 해석은 그 위에 얹히는 짐</i>.<br>
④ 상하위는 손으로 정하지 않았다. <b>서브섬션</b>(자식이 나오는 문단이 부모가 나오는 문단에
   대체로 포함되면 부모로 본다)으로 <b>데이터가 정한 것</b>이다.
</div>

<h2>여러 트리에 걸친 가지 — 여기가 트리끼리 묶이는 지점</h2>
<table><thead><tr><th>가지(개념)</th><th style="text-align:right">걸친 글자 수</th><th>어느 글자들에</th></tr></thead>
<tbody>{shared_rows}</tbody></table>

{''.join(blocks)}
</body></html>"""
    (HERE / "개념트리.html").write_text(doc, encoding="utf-8")

    n_kid = sum(len(v["children"]) for v in tree.values())
    print(f"[개념 트리] 뿌리 {sum(len(v) for v in ROOTS.values())}개 · 가지 {n_kid}개 · 공유 가지 {len(shared)}개")
    for c, ps in top_shared[:8]:
        print(f"   {c:<14} {len(ps)}개 글자에 걸침: {', '.join(ps[:6])}")
    print(f"  → {HERE/'개념트리.html'}")


if __name__ == "__main__":
    main()
