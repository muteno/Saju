# -*- coding: utf-8 -*-
"""
사주 지식 → 옵시디언 볼트 생성기
입력: 2. 정제작업\_현황판\data\  (기존 산출물, 읽기만 함 — 원본 무수정)
출력: 3. 사주\7. 옵시디언 볼트\
"""
import json, os, re, shutil, collections, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import 경로
DATA = str(경로.DATA)
OUT  = str(경로.옵시디언_볼트)

def jl(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]

def js(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)

# ---------- 입력 ----------
layers  = jl("node_layers.jsonl")
nodes   = {r["concept"]: r for r in jl("neuron_nodes.jsonl")}
metrics = {r["concept"]: r for r in jl("knowledge_metrics.jsonl")}
rels    = jl("relation_edges.jsonl")
tree    = js("concept_tree.json")
alias_raw = js("별칭_판정.json")["aliases"]
posts   = {r["post_id"]: r for r in jl("posts_all.jsonl")}
stats   = js("stats.json")
try:
    DEFS = {r["concept"]: r for r in jl("정의카드.jsonl")}
except FileNotFoundError:
    DEFS = {}
# ★260726 운영자 지시 — "우리가 재정의하는 것에는 근거를 둘 필요는 없어 …
#   인용하거나 원본글에 대한 소스를 담아줄 필요없음. 어떤 특정인이 한 말 - 이런식으로 할 필요도없음"
#   → 개념 정의는 «누구의 주장»이 아니라 공통 지식이다. 우리는 분류하고 정제할 뿐이다.
#     정제본이 있으면 그것을 쓰고, 저자·para_id는 화면에 띄우지 않는다.
#     (추적용 메타는 정의카드.jsonl에 그대로 남아 있다 — 지우지 않는다.)
try:
    REFINED = {r["concept"]: r["정의"] for r in jl("정의_정제본.jsonl")}
except FileNotFoundError:
    REFINED = {}
# 전사(유튜브)를 다시 정제한 «실전 쓰임» — 웹은 정의를 주고 전사는 판단·화법을 준다
try:
    USAGE = {r["concept"]: r for r in jl("실전쓰임.jsonl")}
except FileNotFoundError:
    USAGE = {}

CONCEPTS = [r["concept"] for r in layers]
CSET = set(CONCEPTS)
BIG = {r["concept"]: r["big"] for r in layers}
MID = {r["concept"]: r["mid"] for r in layers}

# 대주제 → 중주제 → 개념
TAX = collections.OrderedDict()
for r in layers:
    TAX.setdefault(r["big"], collections.OrderedDict()).setdefault(r["mid"], []).append(r["concept"])

BIGS = list(TAX.keys())
BIGCODE = {b: b.split()[0] for b in BIGS}                 # S01 ...
MIDNOTE = {}                                              # (big,mid) -> 파일명
for b, mids in TAX.items():
    for m in mids:
        MIDNOTE[(b, m)] = f"{BIGCODE[b]}-{m}"

# ---------- 리프트 기반 이웃(뉴런 간선) ----------
# concept_tree: parent -> children[{concept,n,p(lift),ev}]
pair = {}          # (a,b) 정렬쌍 -> {"n":, "lift":}
EV = collections.defaultdict(list)   # concept -> [ev...]
for parent, blk in tree["tree"].items():
    for ch in blk.get("children", []):
        c = ch["concept"]
        if parent not in CSET or c not in CSET or parent == c:
            continue
        k = tuple(sorted((parent, c)))
        cur = pair.get(k)
        if (cur is None) or (ch["p"] > cur["lift"]):
            pair[k] = {"n": ch["n"], "lift": ch["p"]}
        for e in ch.get("ev", []):
            EV[parent].append(e); EV[c].append(e)

NEI = collections.defaultdict(list)
for (a, b), v in pair.items():
    NEI[a].append((b, v["n"], v["lift"]))
    NEI[b].append((a, v["n"], v["lift"]))
TOPK = 12
for c in NEI:
    NEI[c].sort(key=lambda t: (-t[2], -t[1]))
    NEI[c] = NEI[c][:TOPK]

# 상호 top-K에 든 것만 남기면 너무 줄어듦 → 단방향 유지(옵시디언은 링크 하나면 양방향 표시)
EDGE_N = len({tuple(sorted((c, b))) for c in NEI for b, _, _ in NEI[c]})

# ---------- 링크망 (L1 결정론 · L2 밀착 · L3 보강) ----------
WEB = jl("링크망.jsonl")
# ★260726 — 「왜」를 볼트에 들인다.
#   감사 지적: **낭설후보 57%가 관계도.html에만 있고 볼트에는 안 보인다.**
#   볼트는 «사람이 읽는» 화면인데, 거기서 «이유가 닫힌 관계»와 «이유를 못 대는 관계»가
#   똑같이 생겼으면 독자는 통설을 규칙으로 읽는다. 그게 「임수2 = 유학」이 태어나는 자리다.
try:
    CHAIN = {}
    for _r in jl("근거사슬.jsonl"):
        CHAIN[tuple(sorted((_r["a"], _r["b"])))] = _r
except FileNotFoundError:
    CHAIN = {}
# 표 칸에 들어가는 것이라 **짧아야 한다** — 긴 설명은 노트 아래 범례에 한 번만 둔다.
WHY_MARK = {
    "인과닫힘": ("✅", "이유닫힘"),
    "작용까지": ("🟡", "작용까지"),
    "발현만":  ("🟠", "발현만"),
    "분류경로": ("⬜", "소속설명"),
    "낭설후보": ("🔴", "이유없음"),
}
WHY_LEGEND = ("✅ **이유닫힘** 힘이 오가고 «그래서 어떻게 되는지»까지 닿는다 · "
              "🟡 **작용까지** 힘은 오가는데 «그래서»가 없다 · "
              "🟠 **발현만** 결과는 붙었는데 힘이 오간 자리가 없다 · "
              "⬜ **소속설명** 「A는 B에 속한다」 — 이유가 아니다 · "
              "🔴 **이유없음** L1으로 경로가 없다(낭설 후보)")


def why_of(a, b):
    r = CHAIN.get(tuple(sorted((a, b))))
    if not r:
        return "", ""
    m, t = WHY_MARK.get(r["판정"], ("", ""))
    return m, t
ADJ = collections.defaultdict(list)          # c -> [(상대, edge)]
for e in WEB:
    ADJ[e["a"]].append((e["b"], e)); ADJ[e["b"]].append((e["a"], e))
NB = {c: {b for b, _ in ADJ[c]} for c in set(list(ADJ) + CONCEPTS)}
BW = {}                                      # (a,b) -> weight
for e in WEB:
    k = (e["a"], e["b"]) if e["a"] < e["b"] else (e["b"], e["a"])
    BW[k] = max(BW.get(k, 0), e["weight"])


def _w(a, b):
    return BW.get((a, b) if a < b else (b, a), 0)


TWO = {}                                     # c -> [(목적지, 다리, 점수)]
for c in CONCEPTS:
    direct = NB.get(c, set())
    best = {}
    for m in direct:
        w1 = _w(c, m)
        for t in NB.get(m, ()):
            if t == c or t in direct:
                continue
            sc = w1 * _w(m, t)
            if sc > best.get(t, (0, None))[0]:
                best[t] = (sc, m)
    TWO[c] = sorted(((t, m, sc) for t, (sc, m) in best.items()),
                    key=lambda x: -x[2])[:10]

# ---------- 결정론 관계 ----------
REL = collections.defaultdict(list)
N_REL = sum(1 for r in rels if r.get("layer") == "관계")
N_HIER = len(rels) - N_REL
for r in rels:
    if r.get("layer") != "관계":
        continue
    a, b = r["a"], r["b"]
    if a in CSET:
        REL[a].append(("→" if r["dir"] == "a→b" else "←", r, b))
    if b in CSET:
        REL[b].append(("←" if r["dir"] == "a→b" else "→", r, a))

# ---------- 그래프 계기판 (실측) ----------
def _graph_stats(E):
    g = collections.defaultdict(set)
    for a, b in E:
        g[a].add(b); g[b].add(a)
    N = len(CONCEPTS); tot = cnt = unre = dia = 0
    for s in CONCEPTS:
        dist = {s: 0}; q = [s]
        while q:
            nq = []
            for u in q:
                for v in g[u]:
                    if v not in dist:
                        dist[v] = dist[u] + 1; nq.append(v)
            q = nq
        for t in CONCEPTS:
            if t == s:
                continue
            if t in dist:
                tot += dist[t]; cnt += 1; dia = max(dia, dist[t])
            else:
                unre += 1
    return {"간선": len(E), "밀도": round(len(E) / (N * (N - 1) / 2) * 100, 1),
            "평균거리": round(tot / cnt, 2) if cnt else 0, "지름": dia,
            "도달불가": round(unre / (N * (N - 1)) * 100, 1),
            "고아": sum(1 for c in CONCEPTS if not g[c])}

def _es(layer):
    return {tuple(sorted((e["a"], e["b"]))) for e in WEB if e["층"] == layer}


E_REL, E_NEU, E_FIX = _es("L1결정론"), _es("L2밀착"), _es("L3보강")
G_REL = _graph_stats(E_REL)
G_NEU = _graph_stats(E_NEU)
G_ALL = _graph_stats(E_REL | E_NEU | E_FIX)
DEG = collections.Counter()
for e in WEB:
    DEG[e["a"]] += 1; DEG[e["b"]] += 1
DEGS = sorted(DEG.get(c, 0) for c in CONCEPTS)
TIER_N = collections.Counter(e.get("등급") for e in WEB if e["층"] == "L2밀착")

# ---------- 별칭 ----------
alias_by_c = collections.defaultdict(list)
seen_alias = collections.Counter()
for a in alias_raw:
    if len(a.get("concepts", [])) == 1:
        seen_alias[a["alias"]] += 1
NOTE_NAMES = set(CONCEPTS) | set(MIDNOTE.values()) | set(BIGS)
for a in alias_raw:
    al = a["alias"]
    cs = a.get("concepts", [])
    if len(cs) != 1 or seen_alias[al] != 1:
        continue
    if al in NOTE_NAMES or al in CSET or len(al) < 2:
        continue
    if a.get("verdict") == "오탐":
        continue
    alias_by_c[cs[0]].append(al)
for c in alias_by_c:
    alias_by_c[c] = sorted(set(alias_by_c[c]))[:10]

# ---------- 커리큘럼(기초부터 읽는 순서) ----------
CURRICULUM = [
    ("1단계 — 세계관", ["S01 음양·오행"],
     "모든 판단의 원자. 여기가 흔들리면 위층이 전부 흔들린다."),
    ("2단계 — 글자", ["S02 천간", "S03 지지·지장간"],
     "하늘의 글자 10개, 땅의 글자 12개. 사주 여덟 글자의 재료."),
    ("3단계 — 자리와 시간", ["S14 기본 골격어", "S13 자리(궁위)·원국 구조"],
     "글자를 언제(절기) 어디에(네 기둥) 앉히는가. 만세력이 하는 일."),
    ("4단계 — 글자끼리의 사건", ["S04 합충형파해"],
     "글자들이 만나면 무슨 일이 벌어지는가."),
    ("5단계 — 관계의 이름", ["S05 십성·육친"],
     "일간을 기준으로 나머지 글자를 열 가지로 부르는 법. 해석의 문법."),
    ("6단계 — 세기와 단계", ["S07 십이운성", "S06 신살"],
     "글자의 기운 세기(12단계)와 이름표(신살). 유파가 갈리는 첫 구간."),
    ("7단계 — 판정", ["S08 강약·격국·구조", "S09 용신"],
     "이 사주가 강한가 약한가, 무엇이 필요한가. 앱 계산의 심장."),
    ("8단계 — 시간의 흐름", ["S10 대운·세운·운해석"],
     "원국은 고정, 운은 흐른다. 재방문 루프의 재료."),
    ("9단계 — 사람에게 말하기", ["S11 상담론·화법·윤리", "S15 발현·결과"],
     "글자를 사람의 언어로. 그리고 실제로 겪는 일들."),
    ("10단계 — 계보", ["S12 역사·이론사·인물"],
     "누가 무엇을 근거로 그렇게 말하는가. 관점이 갈릴 때 돌아오는 곳."),
]

# ---------- 유틸 ----------
def safe(name):
    return re.sub(r'[\\/:*?"<>|]', "-", name).strip()

def wl(name):
    return f"[[{name}]]"

def fm(d):
    out = ["---"]
    for k, v in d.items():
        if isinstance(v, list):
            if not v:
                continue
            out.append(f"{k}:")
            out += [f"  - {x}" for x in v]
        elif v is None or v == "":
            continue
        else:
            out.append(f"{k}: {v}")
    out.append("---")
    return "\n".join(out)

def badge(x):
    """어디에 종속된 개념인지 — 대주제코드 · 중주제"""
    if x not in CSET:
        return ""
    return f" <sub>{BIGCODE[BIG[x]]}·{MID[x]}</sub>"


def num(n):
    return f"{n:,}"

def strength_tier(lift):
    if lift >= 4.0:  return "강", "🟥"
    if lift >= 2.5:  return "중", "🟧"
    return "약", "🟨"

def w_bar(w):
    return "█" * max(1, int(round(w * 5))) + "░" * (5 - max(1, int(round(w * 5))))

# ---------- 출력 폴더 ----------
# ⚠ OneDrive는 폴더 삭제에 잠금을 건다 → rmtree 대신 덮어쓰기 + 사후 잔재 청소
PREV = set()
if os.path.isdir(OUT):
    for r, d, fs in os.walk(OUT):
        if ".obsidian" in r:
            continue
        for f in fs:
            if f.endswith(".md"):
                PREV.add(os.path.join(r, f))
for d in ["00 시작", "01 대주제", "02 중주제", "03 개념", ".obsidian"]:
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
for b in BIGS:
    os.makedirs(os.path.join(OUT, "03 개념", safe(b)), exist_ok=True)

def write(path, text):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)

written = 0
MADE = set()

_w = write
def write(path, text):
    MADE.add(os.path.abspath(path))
    _w(path, text)

# ---------- 개념 노트 ----------
KIND_ICON = {
    "구성": "🧩", "전제": "🪜", "생": "🌱", "극": "⚔", "롤업": "⬆", "합": "🤝",
    "발현": "💥", "지장간": "🫙", "비화": "🟰", "소속": "📦", "적용": "🎯",
    "파생": "🌿", "귀결": "➡", "비교": "⚖", "육친": "👪", "충": "💢",
    "순서": "🔢", "형": "🔻", "관계": "🔗", "파": "🪓", "해": "🩸",
    "원진": "😖", "귀문": "🌀", "제화": "🛡", "인접": "↔", "반증": "❌",
    # ★260726 — 합·충·형을 종류별로 갈랐다(자축은 «육합»이면서 «방합»이다).
    #   여기 없으면 🔗로 폴백돼 «관계»와 구분이 안 된다.
    "천간합": "🤝", "육합": "🤝", "방합": "🧭", "삼합": "🔺", "반합": "🔻",
    "합화": "🔄", "천간충": "💢", "지지충": "💢", "삼형": "⛓", "상형": "🔻",
    "조건부": "⚖", "밀착": "🧠", "보강": "🌉", "산출": "📐", "절차": "🧮",
}

for c in CONCEPTS:
    nd = nodes.get(c, {})
    mt = metrics.get(c, {})
    b, m = BIG[c], MID[c]
    midnote = MIDNOTE[(b, m)]

    front = collections.OrderedDict()
    front["개념"] = c
    front["대주제"] = b
    front["중주제"] = m
    front["문단"] = mt.get("문단", nd.get("paras", 0))
    front["저자수"] = mt.get("저자수", 0)
    front["관계다리"] = mt.get("관계다리", 0)
    front["공기다리"] = mt.get("공기다리", 0)
    front["확장성지수"] = mt.get("확장성지수", 0)
    front["관계강도평균"] = mt.get("관계강도평균", 0)
    front["정의"] = ("정제" if REFINED.get(c) else
                    ("미정제" if DEFS.get(c, {}).get("defs") else "공백"))
    if alias_by_c.get(c):
        front["aliases"] = alias_by_c[c]
    front["tags"] = ["개념", BIGCODE[b]]

    L = [fm(front), ""]
    L.append(f"# {c}")
    L.append("")
    dcard = DEFS.get(c, {})
    dl = dcard.get("defs", [])
    ref = REFINED.get(c)
    if ref:
        L.append("> [!abstract] 정의")
        L.append(f"> {ref}")
        L.append("")
    elif dl:
        L.append("> [!abstract] 정의 <sub>— 정제 대기</sub>")
        L.append(f"> {dl[0]['quote']}")
        L.append("")
        if len(dl) > 1:
            L.append(f"<details><summary>다른 서술 {len(dl)-1}개 — 정제할 재료</summary>")
            L.append("")
            for x in dl[1:]:
                L.append(f"- {x['quote']}")
            L.append("")
            L.append("</details>")
            L.append("")
    else:
        L.append("> [!missing] 정의 공백")
        L.append(f"> 문단 {num(mt.get('문단',0))}개를 훑었지만 이 개념을 «무엇이다»라고 말한 문장을 못 찾았다.")
        L.append("")

    L.append(f"**계층** · {wl(b)} › {wl(midnote)} › **{c}**")
    L.append("")

    # 선수 개념 (전제)
    pre = []
    for d, r, o in REL.get(c, []):
        if r["kind"] == "전제" and d == "←" and o not in pre:
            pre.append(o)                      # 같은 개념이 두 규칙으로 전제돼도 한 번만
    if pre:
        L.append("> [!tip] 먼저 알아야 하는 것")
        L.append("> " + " · ".join(wl(o) for o in pre))
        L.append("")

    # ⛔260726 «실전 쓰임» 섹션 폐기 — 운영자 지적으로 제거했다.
    #   `임수2 = 해외·유학` 같은 «결론»을 노드에 박는 짓이었고, 그건 정제가 아니라 해석이다.
    #   *"어떠한 단어의 의미가 노드로 정해져있는거는 영어단어 사전이나 만들때 쓰는거지.
    #     확률론으로 예측하는 알고리즘에서는 안써야 오히려 정확하지. 99%는 100%가 아님."*
    #   → 노드는 앵커일 뿐이고 정보는 **간선**에 실린다. 부활시키지 말 것.

    # ── L1 결정론 관계 (뼈대)
    mine = ADJ.get(c, [])
    e1 = [(o, e) for o, e in mine if e["층"] == "L1결정론"]
    e2 = [(o, e) for o, e in mine if e["층"] == "L2밀착"]
    e15 = [(o, e) for o, e in mine if e["층"] == "L1½조건부"]
    e3 = [(o, e) for o, e in mine if e["층"] == "L3보강"]

    L.append(f"## 🔗 결정론 관계 — {len(e1)}개")
    L.append("")
    if e1:
        L.append("명리 규칙으로 정해져 있는 다리다. **판단은 이 위로만 흐른다.**")
        L.append("")
        # ★260728 «효과» 열 신설 — 부호와 발생량 방향은 다른 축이다.
        #   같은 '+'라도 역마→이동·이사는 «촉진»이고 천을귀인→구설·송사는 «해소»다.
        #   한 칸에 섞어 두면 읽는 사람이 정반대로 읽는다(평의회 4차 감독관 단독 적발).
        L.append("| | 관계 | 상대 | 부호 | 효과 | 강도 |")
        L.append("|---|---|---|---|---|---|")
        for o, e in sorted(e1, key=lambda t: (-t[1]["weight"], t[1]["kind"])):
            d = ("→" if e["dir"] == "a→b" else "←") if e["a"] == c else                 ("←" if e["dir"] == "a→b" else "→")
            ic = KIND_ICON.get(e["kind"], "🔗")
            eff = e.get("effect")
            eff_s = {"촉진": "🔺촉진", "해소": "🔻해소"}.get(eff, "") if eff else ""
            L.append(f"| {d} | {ic} {e['kind']} | {wl(o)}{badge(o)} | {e.get('polarity') or ''} "
                     f"| {eff_s} | {w_bar(e['weight'])} {e['weight']} |")
        L.append("")
        L.append("<details><summary>이 규칙들의 출처</summary>")
        L.append("")
        for o, e in e1:
            if e.get("source"):
                L.append(f"- **{e['kind']} · {o}** — {e['source']} <sub>({e.get('author','')})</sub>")
        L.append("")
        L.append("</details>")
        L.append("")
    else:
        L.append("> [!warning] 규칙 다리 없음")
        L.append("> 이 개념은 아직 «같이 나오더라»(아래 밀착)로만 매달려 있다. 판단에 쓰려면 규칙이 필요하다.")
        L.append("")

    # ── L1½ 조건부 (F6 대칭 분기) ────────────────────────────────
    #   여기가 «관계를 정의하고 의미를 정의하지 않는다»가 실물로 보이는 자리다.
    #   결론(임수2=유학)이 아니라 **조건이 서면 어디로 흐르는가**를 적는다.
    #   조건이 바뀌면 결과가 바뀐다 — 그 사실 자체가 저장 내용이다.
    # 「왜」 요약 — 이 개념에 달린 해석 중 이유를 못 대는 게 몇 개인가
    _wc = {}
    for _o, _e in (e15 + e2):
        _r = CHAIN.get(tuple(sorted((_e["a"], _e["b"]))))
        if _r:
            _wc[_r["판정"]] = _wc.get(_r["판정"], 0) + 1
    if _wc:
        _bad = _wc.get("낭설후보", 0)
        _tot = sum(_wc.values())
        L.append("> [!abstract] 이 개념의 «왜» — 검증된 해석 "
                 f"{_tot}건 중 **이유가 닫힌 것 {_wc.get('인과닫힘', 0)}** · "
                 f"작용까지 {_wc.get('작용까지', 0)} · 발현만 {_wc.get('발현만', 0)} · "
                 f"분류경로 {_wc.get('분류경로', 0)} · "
                 f"**🔴이유를 못 대는 것 {_bad}**"
                 + (f" ({_bad/_tot*100:.0f}%)" if _tot else ""))
        L.append("")
    L.append(f"## ⚖ 조건부 관계 — {len(e15)}개")
    L.append("")
    if e15:
        L.append("**조건이 설 때만** 흐르는 다리다. "
                 "조건은 원국 8글자에서 관측되는 것만 쓴다(자리·강약·합충·통근·운·글자존재).")
        L.append("")
        nx = sum(1 for _o, e in e15 if e.get("교차확인"))
        L.append(f"> [!note] 이 중 **{nx}개만 교차확인**됐다 (2곳 이상에서 같은 조건부 관계). "
                 f"나머지 {len(e15)-nx}개는 한 사람의 한 문장에서 나왔다 — **조건 분기는 본디 단일 증언**이라 "
                 f"그 자체가 흠은 아니지만, «그 사람은 그렇게 본다»와 «명리가 그렇다»는 다르다.")
        L.append("")
        L.append("| | 조건 | 상대 | 왜 | 부호 | 표본 | 출처 | 강도 |")
        L.append("|---|---|---|---|---|---:|---|---|")
        for o, e in sorted(e15, key=lambda t: -t[1]["weight"]):
            d = "→" if e["a"] == c else "←"
            cond = " · ".join(e.get("조건", []))
            vague = " <sub>총칭</sub>" if e.get("트리거총칭") else ""
            ns = e.get("출처수", 1)
            xc = f"✅{ns}곳" if e.get("교차확인") else f"{ns}곳"
            wm, wt = why_of(e["a"], e["b"])
            L.append(f"| {d} | `{cond}`{vague} | {wl(o)}{badge(o)} "
                     f"| {wm}<sub>{wt}</sub> | {e.get('polarity') or ''} "
                     f"| {e.get('표본', 1)} | {xc} | {w_bar(e['weight'])} {e['weight']} |")
        L.append("")
        L.append(f"<sub>{WHY_LEGEND}</sub>")
        L.append("")
        L.append("<details><summary>조건절 실물 — 어떤 문장에서 나온 조건인가</summary>")
        L.append("")
        for o, e in sorted(e15, key=lambda t: -t[1]["weight"])[:12]:
            for cl in e.get("조건절", [])[:2]:
                L.append(f"- **{o}** ← `{cl}`")
        L.append("")
        L.append("</details>")
        L.append("")
    else:
        L.append("> [!note] 조건부 다리 없음")
        L.append("> 이 개념을 조건으로 갈라 말한 문장이 코퍼스에 아직 없다. "
                 "«언제 이게 켜지는가»를 말한 자료가 없다는 뜻이다.")
        L.append("")

    # ── L2 밀착 (뉴런 · 등급별)
    L.append(f"## 🧠 밀착 개념 — {len(e2)}개")
    L.append("")
    if e2:
        nsolo = sum(1 for _o, e in e2 if e.get("출처수", 9) <= 2)
        L.append("같은 문단에 **우연보다 자주** 붙어 나온 개념. "
                 "등급은 (밀착도 × 근거량 × **출처 수**) 셋을 다 만족해야 올라간다.")
        L.append(f"«{{출처}}»는 **몇 개의 서로 다른 입에서 나왔는가**다. "
                 f"한 사람만 하는 말이면 그건 명리가 아니라 그 사람일 수 있다 — "
                 f"그래서 출처가 1~2곳이면 등급을 내린다(삭제하지는 않는다).")
        if nsolo:
            L.append("")
            L.append(f"> [!warning] 이 개념의 밀착 다리 {len(e2)}개 중 **{nsolo}개가 출처 2곳 이하**다"
                     f" ({nsolo/len(e2)*100:.0f}%). 소수 의견일 수 있으니 근거로 쓸 때 확인할 것.")
        L.append("")
        for tier, ic, desc, fold in (
                ("강", "🟥", "우연의 4배 이상 · 근거 12문단 이상", False),
                ("중", "🟧", "우연의 2.5배 이상 · 근거 8문단 이상", False),
                ("약", "🟨", "우연의 1.6배 이상 — 곁가지", True)):
            grp = sorted([(o, e) for o, e in e2 if e.get("등급") == tier],
                         key=lambda t: -t[1]["lift"])
            if not grp:
                continue
            if fold:
                L.append(f"<details><summary>{ic} <b>{tier}한 연결 {len(grp)}개</b> — {desc}</summary>")
                L.append("")
            else:
                L.append(f"**{ic} {tier}한 연결 {len(grp)}개** <sub>{desc}</sub>")
                L.append("")
            for o, e in grp:
                ns = e.get("출처수")
                mark = ""
                if ns is not None:
                    mark = f" · 출처 {ns}곳" + (" ⚠" if ns <= 2 else "")
                if e.get("강등"):
                    mark += f" <sub>{e['강등']}로 강등</sub>"
                wm, _wt = why_of(e["a"], e["b"])
                L.append(f"- {wm} {wl(o)}{badge(o)} — ×{e['lift']:.1f} · {e['동시문단']}문단{mark}")
            L.append("")
            if fold:
                L.append("</details>")
                L.append("")
    else:
        L.append("*임계를 넘는 밀착 이웃이 없다 — 코퍼스에서 얇은 개념이다.*")
        L.append("")

    # ── L3 보강
    if e3:
        L.append("## 🌉 보강 다리")
        L.append("")
        L.append("> [!caution] 약한 다리")
        L.append("> 임계 미달이지만 **이 개념을 망에서 떼어놓지 않으려고** 건 최소 연결이다. 근거로 쓰지 말 것.")
        L.append("")
        for o, e in e3:
            L.append(f"- {wl(o)}{badge(o)} — {e.get('source','')}")
        L.append("")

    # ── 2홉 (한 다리 건너)
    tw = TWO.get(c, [])
    if tw:
        L.append(f"## 🔀 한 다리 건너 — {len(tw)}곳")
        L.append("")
        L.append("직접 안 이어져 있지만 **중간 노드 하나만 거치면 닿는** 개념들. 센 경로 순.")
        L.append("")
        for _t, _bridge, _sc in tw:
            L.append(f"- {wl(_bridge)} ▸ **{wl(_t)}**{badge(_t)} <sub>경로강도 {_sc:.2f}</sub>")
        L.append("")

    # 같은 갈래
    sib = [x for x in TAX[b][m] if x != c]
    if sib:
        L.append(f"## 🌿 같은 갈래 — {m}")
        L.append("")
        L.append(" · ".join(wl(x) for x in sib))
        L.append("")

    # 근거
    L.append("## 📚 근거")
    L.append("")
    L.append(f"- **문단 {num(mt.get('문단', 0))}개** · 저자 {mt.get('저자수',0)}명 "
             f"· 확장성지수 {mt.get('확장성지수',0)} (1홉 {mt.get('확장_1홉',0)} → 2홉 {mt.get('확장_2홉',0)} → 3홉 {mt.get('확장_3홉',0)})")
    au = nd.get("authors", {})
    if au:
        top = sorted(au.items(), key=lambda t: -t[1])[:8]
        L.append("- **저자 분포:** " + " · ".join(f"{k} {num(v)}" for k, v in top))
    fl = nd.get("flags", {})
    if fl:
        top = sorted(fl.items(), key=lambda t: -t[1])[:8]
        L.append("- **깃발:** " + " · ".join(f"{k} {num(v)}" for k, v in top))
    L.append("")

    byau, seen = collections.OrderedDict(), set()
    for e in EV.get(c, []):
        pid = e.get("para_id")
        if not pid or pid in seen or not e.get("quote"):
            continue
        seen.add(pid)
        byau.setdefault(e.get("author", "?"), []).append(e)
    evs = []
    while len(evs) < 5 and any(byau.values()):
        for a in list(byau):
            if byau[a]:
                evs.append(byau[a].pop(0))
                if len(evs) >= 5:
                    break
    if evs:
        L.append("### 대표 축자 (원문 그대로)")
        L.append("")
        for e in evs:
            pid = e["para_id"].rsplit("-", 1)[0]
            title = posts.get(pid, {}).get("title", "")
            L.append(f"> {e['quote']}")
            L.append(f"> — **{e.get('author','?')}** · {title} <sub>`{e['para_id']}`</sub>")
            if e.get("gist"):
                L.append(f"> *요지: {e['gist']}*")
            L.append("")
    else:
        L.append("*축자 샘플 없음 — 리프트 이웃이 없는 개념이다.*")
        L.append("")

    L.append("---")
    L.append(f"<sub>↑ {wl(midnote)} · {wl(b)} · {wl('🏠 홈')}</sub>")

    write(os.path.join(OUT, "03 개념", safe(b), safe(c) + ".md"), "\n".join(L) + "\n")
    written += 1

# ---------- 중주제 노트 ----------
for b, mids in TAX.items():
    for m, cs in mids.items():
        name = MIDNOTE[(b, m)]
        tot = sum(metrics.get(x, {}).get("문단", 0) for x in cs)
        front = collections.OrderedDict()
        front["중주제"] = m
        front["대주제"] = b
        front["개념수"] = len(cs)
        front["문단합"] = tot
        front["tags"] = ["중주제", BIGCODE[b]]
        L = [fm(front), "", f"# {m}", "",
             f"**계층** · {wl(b)} › **{m}**", "",
             f"개념 {len(cs)}개 · 문단 {num(tot)}개", "",
             "| 개념 | 문단 | 저자 | 결정론다리 | 확장성 |", "|---|---:|---:|---:|---:|"]
        for x in sorted(cs, key=lambda y: -metrics.get(y, {}).get("문단", 0)):
            mt = metrics.get(x, {})
            L.append(f"| {wl(x)} | {num(mt.get('문단',0))} | {mt.get('저자수',0)} | "
                     f"{mt.get('관계다리',0)} | {mt.get('확장성지수',0)} |")
        L += ["", "---", f"<sub>↑ {wl(b)} · {wl('🏠 홈')}</sub>"]
        write(os.path.join(OUT, "02 중주제", safe(name) + ".md"), "\n".join(L) + "\n")
        written += 1

# ---------- 대주제 노트 ----------
BIG_DESC = {
    "S01 음양·오행": "모든 것의 원자. 음과 양, 그리고 다섯 기운.",
    "S02 천간": "하늘의 글자 10개.",
    "S03 지지·지장간": "땅의 글자 12개와 그 속에 숨은 천간.",
    "S04 합충형파해": "글자끼리 만나면 벌어지는 사건들.",
    "S05 십성·육친": "일간 기준으로 나머지를 부르는 열 개의 이름 — 해석의 문법.",
    "S06 신살": "글자 조합에 붙는 이름표. 유파차가 큰 구간.",
    "S07 십이운성": "글자의 기운을 12단계로 재는 법.",
    "S08 강약·격국·구조": "이 사주가 강한가 약한가, 어떤 틀인가.",
    "S09 용신": "이 사주에 무엇이 필요한가. 판단의 결론부.",
    "S10 대운·세운·운해석": "원국은 고정, 운은 흐른다.",
    "S11 상담론·화법·윤리": "글자를 사람의 말로 옮기는 법과 넘지 말 선.",
    "S12 역사·이론사·인물": "누가 무엇을 근거로 그렇게 말하는가.",
    "S13 자리(궁위)·원국 구조": "여덟 글자가 앉는 자리. 어디 앉느냐가 뜻을 바꾼다.",
    "S14 기본 골격어": "총칭어와 절기·역법 — 계산의 뼈대.",
    "S15 발현·결과": "실제로 겪는 일들. 글자가 착지하는 곳.",
}
big_rel = [r for r in rels if r["layer"] == "계층" and r["a"] in BIGS and r["b"] in BIGS]
for b, mids in TAX.items():
    cs = [x for v in mids.values() for x in v]
    tot = sum(metrics.get(x, {}).get("문단", 0) for x in cs)
    front = collections.OrderedDict()
    front["대주제"] = b
    front["중주제수"] = len(mids)
    front["개념수"] = len(cs)
    front["문단합"] = tot
    front["tags"] = ["대주제", BIGCODE[b]]
    L = [fm(front), "", f"# {b}", "", f"> {BIG_DESC.get(b,'')}", "",
         f"중주제 {len(mids)} · 개념 {len(cs)} · 문단 {num(tot)}", ""]
    for m, xs in mids.items():
        L.append(f"## {wl(MIDNOTE[(b,m)])}")
        L.append("")
        L.append(" · ".join(wl(x) for x in xs))
        L.append("")
    nxt = [r for r in big_rel if r["a"] == b]
    prv = [r for r in big_rel if r["b"] == b]
    if nxt or prv:
        L.append("## 🧭 대주제 사이의 흐름")
        L.append("")
        for r in prv:
            L.append(f"- ← {wl(r['a'])} 에서 갈라져 나옴 — *{r.get('source','')}*")
        for r in nxt:
            L.append(f"- → {wl(r['b'])} 로 뻗어감 — *{r.get('source','')}*")
        L.append("")
    L += ["---", f"<sub>↑ {wl('🏠 홈')} · {wl('📖 기초부터 읽는 순서')}</sub>"]
    write(os.path.join(OUT, "01 대주제", safe(b) + ".md"), "\n".join(L) + "\n")
    written += 1

# ---------- 홈 ----------
tot_paras = sum(metrics.get(x, {}).get("문단", 0) for x in CONCEPTS)
thin = sorted([(metrics.get(x, {}).get("문단", 0), x) for x in CONCEPTS])[:15]
norel = [x for x in CONCEPTS if not REL.get(x)]
home = f"""---
tags:
  - 입구
---

# 🏠 사주 지식 볼트

> [!quote] 이 볼트가 뭐냐면
> 사주명리 코퍼스 **글 {num(stats.get('글', 0))}편 · 문단 {num(stats.get('문단', 0))}개**에서 뽑아낸
> **개념 {len(CONCEPTS)}개**를 트리로 세우고 뉴런으로 이어놓은 것.
> 각 개념은 «위에서 내려오는 계층» + «옆으로 새는 관계» 두 방향으로 연결돼 있다.

## 어디부터 볼까

| | |
|---|---|
| 🔰 **처음이면** | {wl('📖 기초부터 읽는 순서')} — 10단계 커리큘럼 |
| 🧭 **쓰는 법** | {wl('🧭 볼트 사용법')} — 그래프 뷰 읽는 법 |
| 📊 **현재 상태** | {wl('📊 지금 어디까지 왔나')} — 실측 수치·정의 커버리지·공백 |
| 🧬 **신경망으로 보기** | `2. 정제작업\_현황판\사주신경망.html` — 판단이 흐르는 10개 층 |

## 15개 대주제

| 대주제 | 개념 | 문단 |
|---|---:|---:|
"""
for b, mids in TAX.items():
    cs = [x for v in mids.values() for x in v]
    tot = sum(metrics.get(x, {}).get("문단", 0) for x in cs)
    home += f"| {wl(b)} | {len(cs)} | {num(tot)} |\n"

home += f"""
## 가장 두꺼운 개념 20

| 개념 | 문단 | 저자 | 결정론다리 |
|---|---:|---:|---:|
"""
for x in sorted(CONCEPTS, key=lambda y: -metrics.get(y, {}).get("문단", 0))[:20]:
    mt = metrics.get(x, {})
    home += f"| {wl(x)} | {num(mt.get('문단',0))} | {mt.get('저자수',0)} | {mt.get('관계다리',0)} |\n"

home += """
---
<sub>생성: 이 볼트는 `2. 정제작업\\_현황판\\data\\`의 산출물에서 자동 생성됐다. 원본은 손대지 않았다.</sub>
"""
write(os.path.join(OUT, "00 시작", "🏠 홈.md"), home)
written += 1

# ---------- 읽는 순서 ----------
L = ["---", "tags:", "  - 입구", "---", "", "# 📖 기초부터 읽는 순서", "",
     "> [!info] 왜 이 순서인가",
     "> 코퍼스 저자 4명이 **각자 글을 쓴 순서**가 곧 교육 설계도였다 — 어떻게 써야 읽는 사람이",
     "> 이해할까를 따라 배치된 것이라, 그 순서에 원리의 의존관계가 들어 있다.",
     "> 아래 10단계는 그 합의 스파인이다. 위 단계를 건너뛰면 아래가 안 선다.", ""]
for i, (title, bigs, why) in enumerate(CURRICULUM, 1):
    L.append(f"## {title}")
    L.append("")
    L.append(f"> {why}")
    L.append("")
    for b in bigs:
        cs = [x for v in TAX[b].values() for x in v]
        L.append(f"### {wl(b)}")
        L.append("")
        for m, xs in TAX[b].items():
            L.append(f"- **{m}** — " + " · ".join(wl(x) for x in xs))
        L.append("")
L += ["---", f"<sub>↑ {wl('🏠 홈')}</sub>"]
write(os.path.join(OUT, "00 시작", "📖 기초부터 읽는 순서.md"), "\n".join(L) + "\n")
written += 1

# ---------- 사용법 ----------
usage = f"""---
tags:
  - 입구
---

# 🧭 볼트 사용법

## 이 볼트의 연결은 3층이다

| 층 | 정체 | 개수 | 어디에 보이나 |
|---|---|---:|---|
| **L0 계층(종속)** | 대주제 → 중주제 → 개념 | {len(BIGS)}+{sum(len(v) for v in TAX.values())}+{len(CONCEPTS)} | 노트 상단 «계층» 줄 · 모든 링크 뒤 <sub>배지</sub> |
| **L1 결정론** | 생·극·합·충·구성·전제… | **{len(E_REL)}** | «🔗 결정론 관계» 표 |
| **L2 밀착** | 리프트로 잰 공기 결합 | **{len(E_NEU)}** (강 {TIER_N['강']}·중 {TIER_N['중']}·약 {TIER_N['약']}) | «🧠 밀착 개념» |
| **L3 보강** | 안 그러면 떨어져 나갈 노드를 붙든 최소 다리 | {len(E_FIX)} | «🌉 보강 다리» |
| **2홉** | 한 다리 건너 닿는 곳 | 개념당 최대 10 | «🔀 한 다리 건너» |

> [!important] «가깝다»를 홉으로 읽지 마라 — 굵기로 읽어라
> 이 망은 **연결고리가 있는 노드는 전부 이어놨다**(도달불가 0% · 고아 0 · 지름 {G_ALL['지름']}).
> 그래서 평균 거리가 {G_ALL['평균거리']}홉이다 — 거의 다 한두 다리면 닿는다.
> **거리로는 관련도를 못 잰다. 등급(🟥강/🟧중/🟨약)과 강도 막대가 그 일을 한다.**
>
> 등급은 **둘 다** 만족해야 올라간다: 밀착도(우연 대비 몇 배) **×** 근거량(몇 문단).
> 리프트만 높고 표본이 8문단이면 «강»이 아니라 «약»이다 — 작은 분모에서 배수는 쉽게 튄다.
>
> 판단에 쓸 수 있는 건 **L1뿐이다.** L2는 "같이 나오더라"이고, L3는 "떨어뜨리지 않으려고 건 것"이다.

## 🧬 신경망 뷰 — 옵시디언 밖의 짝

같은 데이터를 **판단이 흐르는 순서대로 층에 세운** 그림이 따로 있다:
`2. 정제작업\_현황판\사주신경망.html` (더블클릭)

```
L0 바탕 → L1 글자 → L2 자리 → L3 작용 → L4 이름 → L5 판정 → L6 시간 → L7 발현 → L8 말하기
 음양오행  천간지지   네 기둥   합충형파해  십성·신살   강약·용신   대운·세운   재물·직업   화법·게이트
                                                                          ( L9 계보 = 옆에서 받치는 근거 )
```

옵시디언 그래프는 **구조가 없는 별자리**고, 저건 **흐름이 있는 회로**다. 둘 다 같은 249개 노드·같은 링크망이다.
뉴런에 마우스를 올리면 그 뉴런의 시냅스만 빛나고, 층 머리를 누르면 그 층이 접힌다.

## 그래프 뷰 읽는 법

1. 좌측 리본 → **그래프 뷰**(Ctrl+G)
2. 색은 대주제(S01~S15)별로 미리 칠해뒀다.
3. **필터 팁**
   - `tag:#개념` — 개념 249개만 (계층 노드 제거 → 순수 뉴런망)
   - `tag:#S05` — 십성만
   - `path:"01 대주제"` — 뼈대만
4. **로컬 그래프**(Ctrl+Shift+G)를 개념 노트에서 열고 깊이를 2~3으로 올리면
   "내려가다 옆으로 새는" 그 경로가 눈에 보인다.

## 노트 읽는 순서

```
한 줄 정의 → 계층(내 위치) → 먼저 알아야 할 것(선수 개념)
   → 🔗 결정론 관계 (판단의 뼈대)
   → 🧠 가까운 개념 (샐 수 있는 방향)
   → 🌿 같은 갈래 (형제)
   → 📚 근거 (몇 명이 몇 번 말했나 + 축자)
```

## 아직 안 채운 칸

- **한 줄 정의**는 전부 비어 있다. 정의 유닛(P2) 증류가 아직 안 끝났다.
- **결정론 관계가 0개인 개념 {len(norel)}개** — 지금은 «같이 나오더라»로만 매달려 있다.
- 문단 근거가 얇은 개념 상위: {' · '.join(wl(x) + f'({n})' for n, x in thin[:8])}

---
<sub>↑ {wl('🏠 홈')}</sub>
"""
write(os.path.join(OUT, "00 시작", "🧭 볼트 사용법.md"), usage)
written += 1

# ---------- 상태 ----------
relcnt = collections.Counter(r["kind"] for r in rels if r["layer"] == "관계")
st = f"""---
tags:
  - 입구
---

# 📊 지금 어디까지 왔나

## 원재료 (2026-07-26 실측)

| | |
|---|---:|
| 글 | {num(stats.get('글',0))} |
| 문단 | {num(stats.get('문단',0))} |
| 축자 인용 | {num(stats.get('인용',0))} |
| 개념 노드 | {len(CONCEPTS)} |
| 대주제 / 중주제 | {len(BIGS)} / {sum(len(v) for v in TAX.values())} |
| 계층 간선 | {N_HIER} |
| 결정론 관계 간선 | {N_REL} |
| 뉴런 간선(리프트 필터 후) | {EDGE_N} |
| 동시출현 원본 간선 | 21,869 (밀도 70.8% — 그대로 쓰면 무의미) |

## 관계 종류 분포

| 종류 | 개수 |
|---|---:|
"""
for k, v in relcnt.most_common():
    st += f"| {k} | {v} |\n"

N_REF = sum(1 for c in CONCEPTS if REFINED.get(c))
N_RAW = sum(1 for c in CONCEPTS if not REFINED.get(c) and DEFS.get(c, {}).get("defs"))
N_NONE = len(CONCEPTS) - N_REF - N_RAW
st += f"""
## 📖 정의 — 개념마다 «무엇이다»가 있는가

| 상태 | 개념 |
|---|---:|
| **정제 완료** | **{N_REF}** |
| 정제 대기(원재료만 있음) | {N_RAW} |
| 공백 | {N_NONE} |

> [!info] 정의에 출처가 없는 이유
> 개념 정의는 **누구의 주장이 아니라 공통 지식**이다. 우리는 분류하고 정제할 뿐이라
> 저자명·인용·원문 출처를 달지 않는다. "누가 이렇게 말했다"로 쓰면 공통 지식이
> 개인 의견처럼 보여 오히려 틀린 인상을 준다.
>
> 원재료(저자별 축자·para_id)는 `_현황판\data\정의카드.jsonl`에 **그대로 남아 있다** — 지우지 않았다.
> 정의문 원고는 `_현황판\정의원고\*.txt`에서 손으로 고칠 수 있고, `볼트_갱신.bat`이 다시 굳힌다.

## 📐 그래프 계기판 — «거리가 곧 관련도»인가

| 층 | 간선 | 밀도 | 평균거리 | 지름 | 도달불가 | 고아 |
|---|---:|---:|---:|---:|---:|---:|
| L1 결정론만 | {G_REL['간선']} | {G_REL['밀도']}% | {G_REL['평균거리']} | {G_REL['지름']} | {G_REL['도달불가']}% | {G_REL['고아']} |
| L2 밀착만 | {G_NEU['간선']} | {G_NEU['밀도']}% | {G_NEU['평균거리']} | {G_NEU['지름']} | {G_NEU['도달불가']}% | {G_NEU['고아']} |
| **볼트 전체(L1+L2+L3)** | **{G_ALL['간선']}** | **{G_ALL['밀도']}%** | **{G_ALL['평균거리']}** | **{G_ALL['지름']}** | **{G_ALL['도달불가']}%** | **{G_ALL['고아']}** |

**다리 수** — 중앙값 **{DEGS[len(DEGS)//2]}** · 최대 **{max(DEGS)}** · 최소 {min(DEGS)} · 0개인 개념 **{sum(1 for d in DEGS if d==0)}**

> [!success] 도달 보장 달성
> **개념 249개 중 서로 못 닿는 쌍이 0%다.** 고아도 0. 지름 {G_ALL['지름']} — 아무 개념에서 출발해도
> 최대 {G_ALL['지름']}다리면 나머지 전부에 닿는다.
>
> L1(결정론)만으로는 35.5%가 못 닿고 43개가 고아였다. 명리 규칙은 **글자↔글자만** 잇기 때문이다.
> 「재물·돈」·「직업·직무」 같은 **겪는 일**은 규칙으로 못 잇는다 — 그건 저자의 임상이라
> L2(코퍼스가 실제로 같이 말한 것)가 이어야 하고, 그래서 **가중치를 낮게 준다.**
>
> ⚠대신 평균거리가 {G_ALL['평균거리']}로 내려갔다. **거리는 이제 관련도를 못 잰다 — 등급으로 읽어라.**

## 🕳 공백

### 결정론 관계가 0개인 개념 — {len(norel)}개
{' · '.join(wl(x) for x in norel)}

> 이것들은 «같이 나오더라»로만 걸려 있어서 판단에 못 쓴다.
> 특히 {wl('S15 발현·결과')} 계열(재물·직업·결혼…)이 여기 몰려 있는데,
> **글자 → 겪는 일**을 잇는 건 규칙이 아니라 저자의 임상이라 규칙으로 못 만든다.
> 그게 판단 유닛(P2)이 실제로 채워야 할 과녁이다.

### 근거가 얇은 개념 15
| 개념 | 문단 |
|---|---:|
"""
for n, x in thin:
    st += f"| {wl(x)} | {n} |\n"

st += f"""
---
<sub>↑ {wl('🏠 홈')}</sub>
"""
write(os.path.join(OUT, "00 시작", "📊 지금 어디까지 왔나.md"), st)
written += 1

# ---------- .obsidian/graph.json ----------
PAL = [0xE05252, 0xE0873F, 0xE0C23F, 0xA8D14A, 0x4FC08D, 0x3FBFC0, 0x4A9BE0,
       0x5A6FE0, 0x8A5AE0, 0xC04FBF, 0xE04F92, 0x9E7B5A, 0x7A8B99, 0x5AA05A, 0xB0603F]
groups = [{"query": f"tag:#{BIGCODE[b]}", "color": {"a": 1, "rgb": PAL[i % len(PAL)]}}
          for i, b in enumerate(BIGS)]
graph = {
    "collapse-filter": False, "search": "", "showTags": False, "showAttachments": False,
    "hideUnresolved": True, "showOrphans": True, "collapse-color-groups": False,
    "colorGroups": groups, "collapse-display": False, "showArrow": True,
    "textFadeMultiplier": -1.2, "nodeSizeMultiplier": 1.15, "lineSizeMultiplier": 0.4,
    "collapse-forces": False, "centerStrength": 0.3, "repelStrength": 18.5,
    "linkStrength": 0.35, "linkDistance": 280, "scale": 0.35, "close": False,
}
write(os.path.join(OUT, ".obsidian", "graph.json"), json.dumps(graph, ensure_ascii=False, indent=2))
write(os.path.join(OUT, ".obsidian", "app.json"),
      json.dumps({"attachmentFolderPath": "_첨부", "alwaysUpdateLinks": True,
                  "newLinkFormat": "shortest", "useMarkdownLinks": False,
                  "readableLineLength": True}, ensure_ascii=False, indent=2))
write(os.path.join(OUT, ".obsidian", "appearance.json"),
      json.dumps({"accentColor": "#7a5af5", "theme": "obsidian"}, ensure_ascii=False, indent=2))

stale = [p for p in PREV if os.path.abspath(p) not in MADE]
for p in stale:
    try:
        os.remove(p)
    except OSError:
        pass
print(f"WROTE {written} notes  (stale removed: {len(stale)})")
print(f"concepts={len(CONCEPTS)} mids={sum(len(v) for v in TAX.values())} bigs={len(BIGS)}")
print(f"relation_edges(관계)={len(rels)-300}  neuron_pairs_after_lift={EDGE_N}")
print(f"no-relation concepts={len(norel)}")
print(f"graph all: {G_ALL}")
print(f"OUT={OUT}")
