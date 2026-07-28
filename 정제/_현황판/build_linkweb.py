# -*- coding: utf-8 -*-
"""
링크망 빌더 — 트리 + 무한 횡단 + 강도 + 도달 보장

운영자 지시(260726):
  "트리구조인데 각 노드마다는 n개(무한정) 서로간에 연결성이 있는것끼리 엮일수있게,
   추가적인 노드를 타고가면 … 한 사람 건너면 만날 수 있는 것처럼, 이 연결고리를 다 만들어놔야해.
   근데 무작정 묶는게 아니라, 그 강도 해석, 연결고리가 있는 노드는 무조건 엮이되,
   그 개념들이 어디에 종속되어있는지는 어느정도 보여야해"

→ 4층으로 나눠 담는다(합치지 않는다):
   L0 계층   : 대주제 → 중주제 → 개념   (종속. 항상 보임)
   L1 결정론 : 생·극·합·충·구성·전제…   (규칙. 판단이 타는 다리)
   L2 밀착   : 리프트로 잰 공기 결합     (강/중/약 3등급)
   L3 보강   : 위 셋으로 못 닿는 노드를 잇는 최소 다리 (약함을 명시)

출력: data/링크망.jsonl  ·  data/개념_문단색인.json  ·  data/링크망_리포트.md
"""
import json, sys, importlib.util, itertools, math, hashlib as _h
from pathlib import Path
from collections import defaultdict, Counter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from 경로 import 현황판 as HERE, DATA

spec = importlib.util.spec_from_file_location("bnm", HERE / "build_neuron_map.py")
bnm = importlib.util.module_from_spec(spec); spec.loader.exec_module(bnm)
bnm.SNAP_DIRS = bnm._snapshot_dirs()


def jl(n):
    return [json.loads(l) for l in (DATA / n).read_text(encoding="utf-8").splitlines() if l.strip()]


from 작업내역 import 단계          # noqa: E402  되돌릴 수 있게 남긴다
_st = 단계("링크망 재계산(전사 합류·출처수 관문)",
          "통합 색인 위에서 L2를 다시 계산. 출처 1곳뿐인 쌍은 등급 강등",
          ["data/링크망.jsonl", "data/링크망_리포트.md"])
_st.__enter__()

layers = jl("node_layers.jsonl")
CONCEPTS = [r["concept"] for r in layers]
CSET = set(CONCEPTS)
BIG = {r["concept"]: r["big"] for r in layers}
MID = {r["concept"]: r["mid"] for r in layers}
CODE = {c: BIG[c].split()[0] for c in CONCEPTS}
posts = {p["post_id"]: p for p in jl("posts_all.jsonl")}
paras = jl("paras_all.jsonl")
rels = jl("relation_edges.jsonl")

# ── 1. 개념 → 문단 색인 (한 번 만들어 캐시. 이후 전부 이 색인 위에서 계산)
IDX = DATA / "개념_문단색인.json"
if IDX.exists():
    raw = json.loads(IDX.read_text(encoding="utf-8"))
    occ = {c: set(v) for c, v in raw["occ"].items()}
    N = raw["N"]; IDXRAW = raw
    print(f"색인 재사용: 개념 {len(occ)} · 문단 {N:,}")
else:
    # ⛔260726 — 여기서 색인을 «조용히» 다시 만들던 코드를 없앴다. 그게 함정이었다.
    #   그 폴백은 필터가 없어 **운세 격자 보일러플레이트를 통계에 넣고**,
    #   `para_text()`가 앞에 붙이는 **gist(우리 이름표)까지 세고** 있었다.
    #   구 색인 N=38,072 vs 제대로 만든 N=47,088(웹 21,026 + 전사 26,062) —
    #   숫자가 비슷해 보여서 아무도 이상하다고 못 느낀다. 그게 이 함정의 성질이다.
    #   색인은 이제 `build_index.py` 한 곳에서만 만든다. 없으면 죽는다.
    sys.exit("색인이 없다. 먼저 `python build_index.py`를 돌려라.\n"
             "  (여기서 대충 만들면 격자·gist가 섞인 구 색인이 되살아난다 — 260726)")

CNT = {c: len(occ.get(c, ())) for c in CONCEPTS}

# ── 2. 쌍 계산 (문단 → 그 안의 개념 조합)
para2c = defaultdict(list)
for c, ps in occ.items():
    for p in ps:
        para2c[p].append(c)

# ── 2-A. 문단 → 출처(저자/채널). 쌍이 «몇 개의 서로 다른 입»에서 나왔는지 세려고 쓴다.
#   채널 위원(260726): "한두 사람의 말버릇과 관법이 60% 비중으로 얹히면 관계 지도가
#   그 사람의 지도가 된다." 그렇다고 표집 상한을 걸어 자르면 소수 관법이 통째로 죽는다.
#   → **자르지 않고 «출처 수»를 등급 관문으로 쓴다.** 한 입에서만 나온 쌍은 «강»이 못 된다.
#   전사 para_id는 `T-<해시>-<번호>`라 post_id를 그대로 품고 있다(60MB 문단 파일 안 읽어도 된다).
TCH = {p["post_id"]: p.get("채널", "?") for p in jl("전사_글.jsonl")} if (DATA / "전사_글.jsonl").exists() else {}
WEBSRC = {}
for q in paras:
    a = posts.get(q["post_id"], {}).get("author")
    WEBSRC[q["para_id"]] = "웹:" + (a if a else str(posts.get(q["post_id"], {}).get("file", "?"))[:24])


def psrc(pid):
    if pid.startswith("T-"):
        return "전사:" + TCH.get(pid.rsplit("-", 1)[0], "?")
    return WEBSRC.get(pid, "웹:?")


pairw = Counter()
pairsrc = defaultdict(set)
for p, cs in para2c.items():
    if len(cs) < 2 or len(cs) > 40:     # 40개 넘게 걸린 문단은 나열형 → 쌍 신호 아님
        continue
    s = psrc(p)
    for a, b in itertools.combinations(sorted(cs), 2):
        pairw[(a, b)] += 1
        pairsrc[(a, b)].add(s)


def lift(a, b):
    w = pairw.get((a, b) if a < b else (b, a), 0)
    if not w or not CNT.get(a) or not CNT.get(b):
        return 0.0, w
    return w * N / (CNT[a] * CNT[b]), w


# ── 3. L1 결정론 (기존 정본 그대로)
L1 = []
for r in rels:
    if r["layer"] == "관계" and r["a"] in CSET and r["b"] in CSET:
        # 🔴260726 수리 — 여기서 조건·ratio·stance·effect·note·as_of 를 **버리고 있었다.**
        #    상위(relation_edges.jsonl)에 조건 6·ratio 33·stance 23·effect 29가 있는데
        #    링크망으로 내려오며 전량 증발했다. 조건이 없으면 간선은 «무조건 규칙»이 되고,
        #    그게 «임수2=유학»과 같은 형태다(운영자 260726 교정). 통과시킨다.
        e = {"a": r["a"], "b": r["b"], "kind": r["kind"], "dir": r["dir"],
             "polarity": r.get("polarity"), "weight": r["weight"],
             "근거유형": r.get("근거유형", "결정론규칙"), "source": r.get("source", ""),
             "author": r.get("author", ""), "층": "L1결정론"}
        # ★260728 — 발현 «살» 3필드 추가(근거없음·살축자·살para). **또 여기서 떨어질 뻔했다** —
        #   위 260726 주석이 경고한 그 허용목록에 새 필드를 안 넣으면 같은 증발이 재발한다.
        for k in ("조건", "ratio", "stance", "effect", "note", "as_of",
                  "근거없음", "살축자", "살para"):
            if r.get(k):
                e[k] = r[k]
        # 간선 주소 — 조건·프로브·유닛이 간선을 가리키려면 안정 키가 있어야 한다
        import hashlib as _h
        e["간선id"] = "E-" + _h.md5(f"{r['a']}|{r['b']}|{r['kind']}".encode()).hexdigest()[:8]
        L1.append(e)
HAS1 = defaultdict(set)
for e in L1:
    HAS1[e["a"]].add(e["b"]); HAS1[e["b"]].add(e["a"])

# ── 4. L2 밀착 (리프트) — «연결고리가 있는 노드는 무조건 엮되» 강도를 나눈다
MIN_W = 5
T_STRONG, T_MID, T_WEAK = 4.0, 2.5, 1.6
CAP_WEAK = 14          # 약(1.6~2.5)만 상한. 강·중은 상한 없음(= n개 무한정)

cand = defaultdict(list)
for (a, b), w in pairw.items():
    if w < MIN_W:
        continue
    lf = w * N / (CNT[a] * CNT[b])
    if lf < T_WEAK:
        continue
    cand[a].append((b, lf, w)); cand[b].append((a, lf, w))

L2 = {}
for c, lst in cand.items():
    lst.sort(key=lambda t: -t[1])
    weak = 0
    for b, lf, w in lst:
        if b in HAS1[c]:
            continue                      # 결정론 다리가 이미 있으면 중복 안 건다
        if lf < T_MID:
            weak += 1
            if weak > CAP_WEAK:
                continue
        k = (c, b) if c < b else (b, c)
        if k in L2:
            continue
        # ★지지도 하한 — 리프트만 높고 표본이 적으면(예: 8문단) '강'이라 부를 수 없다.
        #   작은 분모에서 리프트는 쉽게 튄다. 등급은 (밀착도 × 근거량) 둘 다 만족할 때만 준다.
        if   lf >= T_STRONG and w >= 12: tier = "강"
        elif lf >= T_MID    and w >= 8:  tier = "중"
        else:                            tier = "약"
        # ★출처수 관문 (260726 채널 위원) — «몇 개의 서로 다른 입에서 나왔는가».
        #   w가 40이어도 그게 한 사람 말버릇이면 그건 명리가 아니라 그 사람이다.
        #   자르지 않고 **등급만 내린다**(자르면 소수 관법이 통째로 죽는다).
        srcs = pairsrc.get(k, set())
        ns = len(srcs)
        if ns <= 1 and tier == "강":
            tier, 강등 = "중", "출처1"
        elif ns <= 1 and tier == "중":
            tier, 강등 = "약", "출처1"
        elif ns <= 2 and tier == "강":
            tier, 강등 = "중", "출처2"
        else:
            강등 = ""
        wt = {"강": 0.7, "중": 0.5, "약": 0.35}[tier]
        L2[k] = {"a": k[0], "b": k[1], "kind": "밀착", "dir": "양방향", "polarity": None,
                 "weight": wt, "등급": tier, "lift": round(lf, 2), "동시문단": w,
                 "출처수": ns, "출처군": sorted(srcs)[:6], "강등": 강등,
                 "근거유형": "코퍼스공기",
                 "source": f"같은 문단 {w}회 · 우연 대비 {lf:.1f}배 · 서로 다른 출처 {ns}곳"
                           + (f" (→{강등}로 강등)" if 강등 else ""),
                 "author": "코퍼스 실측", "층": "L2밀착"}
L2 = list(L2.values())

# ── 5. 도달 보장 — 아직 못 닿는 노드/덩어리를 최소 다리로 잇는다 (L3)
g = defaultdict(set)
for e in L1 + L2:
    g[e["a"]].add(e["b"]); g[e["b"]].add(e["a"])


def components():
    seen, comps = set(), []
    for c in CONCEPTS:
        if c in seen:
            continue
        stack, comp = [c], []
        seen.add(c)
        while stack:
            u = stack.pop(); comp.append(u)
            for v in g[u]:
                if v not in seen:
                    seen.add(v); stack.append(v)
        comps.append(comp)
    return sorted(comps, key=len, reverse=True)


L3 = []
comps = components()
print(f"L1+L2 덩어리 {len(comps)}개 (최대 {len(comps[0])})")
while len(comps) > 1:
    main = set(comps[0])
    moved = False
    for comp in comps[1:]:
        # 이 덩어리에서 본체로 가는 가장 센 다리 하나
        best = None
        for x in comp:
            for y in main:
                lf, w = lift(x, y)
                if w >= 2 and (best is None or lf > best[2]):
                    best = (x, y, lf, w)
        if best is None:       # 공기 근거가 아예 없으면 계층 형제로 잇는다
            for x in comp:
                sib = [y for y in main if MID[y] == MID[x]] or [y for y in main if BIG[y] == BIG[x]]
                if sib:
                    best = (x, sib[0], 0.0, 0)
                    break
        if best is None:
            continue
        x, y, lf, w = best
        L3.append({"a": x, "b": y, "kind": "보강", "dir": "양방향", "polarity": None,
                   "weight": 0.15, "등급": "보강", "lift": round(lf, 2), "동시문단": w,
                   "근거유형": "도달보장",
                   "source": (f"같은 문단 {w}회(리프트 {lf:.1f}) — 임계 미달이나 "
                              "이 노드를 망에 붙이기 위한 최소 다리")
                             if w else f"공기 근거 없음 — 계층 형제({MID[x]})로 연결",
                   "author": "링크망 보강", "층": "L3보강"})
        g[x].add(y); g[y].add(x)
        moved = True
    comps = components()
    if not moved:
        break
print(f"L3 보강 {len(L3)}개 → 덩어리 {len(comps)}개")

# ── 5.5 L1½ 조건부 (F6 대칭 분기) ────────────────────────────────────
#   왜 L1과 L2 사이인가 —
#     L1은 «항상 참»(갑목 극 무토). L2는 «자주 같이 나온다»(방향도 조건도 없다).
#     F6이 주는 것은 그 중간이다: **조건이 서면 방향까지 정해진 관계.**
#     조건을 못 담는 L2로 내리면 조건이 증발하고, L1으로 올리면 «항상»이 되어 거짓말이 된다.
#   무게는 낮게 잡는다 — 표본이 문장 하나짜리다. 「99%는 100%가 아님」(운영자 260726).
L15 = []
CF = DATA / "조건부간선.jsonl"
# ★260726 — 조건부는 이제 **두 갈래**다.
#   ①자동 채굴(`build_branch_edges.py`) — 한 문장 안의 대칭 분기만 잡는다
#   ②수기(`build_manual_conditions.py`) — 조건과 귀결이 문장을 걸쳐 있거나 표로 적힌 것.
#     자동이 구조적으로 못 잡는 몫이라 «보충»이지 «중복»이 아니다.
#     수기는 축자 검증(검증구가 그 문단에 실재하는가)을 통과한 것만 온다.
#   ⚠같은 (a,b)면 아래 fold가 합친다 — 조건이 누적되지 사라지지 않는다.
_CFM = DATA / "조건부간선_수기.jsonl"
if CF.exists():
    raw = [json.loads(l) for l in CF.read_text(encoding="utf-8").splitlines() if l.strip()]
    if _CFM.exists():
        _m = [json.loads(l) for l in _CFM.read_text(encoding="utf-8").splitlines() if l.strip()]
        print(f"L1½ 조건부 — 자동 {len(raw)} + 수기 {len(_m)}")
        raw += _m
    fold = defaultdict(list)
    for e in raw:
        if e["a"] in CONCEPTS and e["b"] in CONCEPTS:
            fold[(e["a"], e["b"])].append(e)
    for (a, b), es in fold.items():
        conds = sorted({k for e in es for k in e["조건"]})
        srcs = sorted({e["출처"] for e in es})
        who = sorted({e.get("출처처", "?") for e in es} - {"?"})
        # ★조건극성 — «있으면»과 «없으면»은 반대 방향이다. 섞으면 지도가 거꾸로 말한다.
        pol_c = Counter(e.get("조건극성", "존재") for e in es)
        극성 = pol_c.most_common(1)[0][0] if pol_c else "존재"
        혼재 = len(pol_c) > 1
        # ★260726 설계 정정 — 처음엔 L2와 똑같이 «출처 1곳이면 등급 강등»을 걸었는데,
        #   그러니 상이 161→10으로 무너졌다. 원인을 재 보니 조건부 간선의 **82%가 문장 1건**
        #   에서 나온다(표본1 299/363). 조건 분기는 본디 한 사람의 한 문장이다.
        #   ⚠**등급과 증거 강도는 다른 축이었다.**
        #     · `등급`   = 추출 품질 — 문장이 깨끗하게 파싱됐나(조건 2종↑, 트리거·귀결 다 섬)
        #     · `교차확인` = 증거 강도 — 몇 사람의 입에서 나왔나
        #   L2에서는 둘이 섞여도 티가 안 났다(공기 통계는 애초에 여러 문단의 합이라).
        #   L1½에서는 섞으면 «파싱이 깨끗한 것»과 «여럿이 말한 것»이 구분 불가가 된다.
        #   → 등급은 추출 품질로 되돌리고, 교차확인은 **별도 칸 + 무게 계수**로 뺀다.
        top = "상" if any(e["등급"] == "상" for e in es) else "중"
        교차 = len(who) >= 2
        pol = Counter(e["polarity"] for e in es if e["polarity"] != "중립")
        n = len(es)
        # 0.30(중)~0.45(상) + 반복 가산. 상한 0.75 — L1(1.0)을 절대 못 넘는다.
        w = min(0.75, (0.45 if top == "상" else 0.30) + 0.08 * (n - 1))
        # ×트리거 품질 — 총칭(오행(총칭)·천간(총칭)·일간…)이 트리거면 절반 아래로 눌린다.
        #   총칭은 사주 이야기라면 어디든 서 있다. 서 있다는 사실이 정보가 아니다.
        tq = sum(e.get("트리거품질", 1.0) for e in es) / n
        w *= tq
        # 교차확인 계수 — 한 입에서만 나온 조건은 «그 사람은 그렇게 본다»에 가깝다.
        #   지우지 않는다. 0.7을 곱하고 칸에 적어 둔다.
        w *= 1.0 if 교차 else 0.7
        L15.append({
            "a": a, "b": b, "kind": "조건부", "dir": "→",
            "polarity": (pol.most_common(1)[0][0] if pol else None),
            "weight": round(w, 3), "등급": top, "조건": conds, "표본": n,
            "출처군": srcs, "출처수": len(who), "출처처": who[:6], "교차확인": 교차,
            "조건극성": 극성, "극성혼재": 혼재,
            "트리거품질": round(tq, 2),
            "트리거총칭": any(e.get("트리거총칭") for e in es),
            "조건절": [e["조건절"] for e in es[:3]],
            "근거유형": "대칭분기(F6)",
            "source": ("«없을 때» 성립 — " if 극성 == "부재" else "")
                      + f"조건 분기 문장 {n}건 · 서로 다른 출처 {len(who)}곳"
                      + ("(교차확인)" if 교차 else "(단일 출처 — 무게 ×0.7)")
                      + f" — 조건 {'·'.join(conds)}",
            "author": "", "층": "L1½조건부",
            "간선id": "F-" + _h.md5(f"{a}|{b}|조건부".encode()).hexdigest()[:8]})
    print(f"L1½ 조건부 {len(L15)}개 (원본 {len(raw)}건 접음) · "
          f"상 {sum(1 for e in L15 if e['등급']=='상')} · "
          f"출처 {dict(Counter(s for e in L15 for s in e['출처군']))}")
else:
    print("L1½ 조건부 — data/조건부간선.jsonl 없음. build_branch_edges.py 먼저 돌려라")

# ── 5.9 층간 중복 해소 ────────────────────────────────────────
#   🔴260726 감사 적발 — 정본 표가 **«한 줄 = 한 관계»를 어기고 있었다.**
#   실측: 154쌍이 2개 층에 동시에 있었다(L1½+L2 96 · L1½+L1 58).
#     예) `병화↔화(火)` 가 L1결정론(소속 w1.0)이면서 L1½조건부(w0.148)로 **두 줄**.
#   왜 나쁜가: 낭설을 한 층에서 쳐내도 **같은 관계가 딴 층에 살아남는다.**
#   그리고 무게가 두 개면 「이 관계가 얼마나 센가」에 답이 둘이 된다.
#
#   해소 규칙 — **정보를 버리지 않고 한 줄로 접는다.**
#     · L1½ ∩ L1  → L1이 이긴다(«항상 참»이 조건부보다 세다).
#                   단 조건을 **L1 간선에 옮겨 적는다** — 그게 원래 «조건으로 정밀화»의 뜻이다.
#     · L1½ ∩ L2  → L1½이 이긴다(방향과 조건이 있으니 공기 통계보다 정보가 많다).
#                   L2 쪽 리프트·동시문단은 L1½ 간선에 옮겨 적는다.
_k = lambda e: tuple(sorted((e["a"], e["b"])))
_L1K = {_k(e): e for e in L1}
_L15K = {}
for e in L15:
    _L15K.setdefault(_k(e), e)

_merged_1, _merged_2, _dropped_ax = 0, 0, 0
_keep15 = []
for e in L15:
    p = _k(e)
    host = _L1K.get(p)
    # ⚠🔴260726 2차 — 처음엔 «L1이 알면 조건을 L1에 옮겨 적는다»고 했는데, 돌려 보니
    #   `병화 ─소속→ 화(火)` 에 조건 「상반기에는 화의 기운이 집중되면」이 붙었다.
    #   **병화가 화에 속하는 건 무조건이다.** 공리에 조건을 붙이면 공리가 오염된다.
    #   → 상대가 **공리(소속·롤업·구성·비화·지장간·육친·음양·생·극)**면 조건을 버리고
    #     L1½ 행만 접는다. 조건이 뜻을 갖는 건 «발현·적용·귀결» 같은 비공리 간선뿐이다.
    _AX = {"소속", "롤업", "구성", "비화", "지장간", "육친", "음양", "생", "극"}
    if host is not None and host.get("kind") in _AX:
        _dropped_ax += 1
        continue                              # 공리 + 조건 = 헛것. 그냥 접는다.
    if host is not None:                      # 비공리 L1 → 조건이 실제로 정밀화한다
        if e.get("조건"):
            # ⚠L1의 `조건`은 문자열(relation_edges가 그렇게 넣는다), L1½은 리스트다.
            #   섞이면 `.append`가 터진다 — 한쪽으로 정규화하고 합친다.
            hc = host.get("조건") or []
            if isinstance(hc, str):
                hc = [hc]
            for c in (e["조건"] if isinstance(e["조건"], list) else [e["조건"]]):
                if c not in hc:
                    hc.append(c)
            host["조건"] = hc
        host["조건극성"] = e.get("조건극성", host.get("조건극성"))
        host["조건절예"] = (e.get("조건절") or [None])[0]
        host["정밀화"] = "L1½ 흡수 — 조건이 붙었지만 관계 자체는 결정론"
        _merged_1 += 1
        continue
    _keep15.append(e)
L15 = _keep15

_L15K = {_k(e) for e in L15}
_keep2 = []
for e in L2:
    p = _k(e)
    if p in _L15K:                            # L1½이 방향·조건을 안다 → L2는 접는다
        for h in L15:
            if _k(h) == p:
                h["공기lift"] = e.get("lift")
                h["공기문단"] = e.get("동시문단")
                h["공기등급"] = e.get("등급")
                # ⚠260726 페이블 점검 — L1½의 무게는 «문장 1건 ×0.7»이라 매우 낮은데,
                #   접힌 L2는 표본이 수십~수백일 수 있다. 그대로 두면 **표본 수백짜리 쌍이
                #   «약한 간선»으로 읽힌다.** 무게는 둘 중 **센 쪽**을 쓰고, 근거에 둘 다 남긴다.
                if (e.get("weight") or 0) > (h.get("weight") or 0):
                    h["무게출처"] = f"L2 공기(리프트 {e.get('lift')} · {e.get('동시문단')}문단)"
                    h["weight"] = e["weight"]
                h["source"] = (h.get("source", "") +
                               f" · [공기] {e.get('동시문단')}문단·우연대비 {e.get('lift')}배").strip()
                break
        _merged_2 += 1
        continue
    _keep2.append(e)
L2 = _keep2

# ── 간선id 전량 부여 (L2 4,895 · L3 3 이 공란이었다)
#   id가 없으면 조건·프로브·유닛이 그 간선을 **가리킬 수 없다.**
for e in L2:
    e.setdefault("간선id", "N-" + _h.md5(f"{e['a']}|{e['b']}|밀착".encode()).hexdigest()[:8])
for e in L3:
    e.setdefault("간선id", "B-" + _h.md5(f"{e['a']}|{e['b']}|보강".encode()).hexdigest()[:8])
print(f"층간 중복 해소 — 공리와 겹쳐 버림 {_dropped_ax} · L1에 조건 흡수 {_merged_1} · "
      f"L2 접음 {_merged_2} · 간선id 전량 부여")

ALL = L1 + L15 + L2 + L3
(DATA / "링크망.jsonl").write_text(
    "\n".join(json.dumps(e, ensure_ascii=False) for e in ALL) + "\n", encoding="utf-8")

# ── 6. 계기판
def stats(E):
    gg = defaultdict(set)
    for a, b in E:
        gg[a].add(b); gg[b].add(a)
    n = len(CONCEPTS); tot = cnt = unre = dia = 0
    for s in CONCEPTS:
        d = {s: 0}; q = [s]
        while q:
            nq = []
            for u in q:
                for v in gg[u]:
                    if v not in d:
                        d[v] = d[u] + 1; nq.append(v)
            q = nq
        for t in CONCEPTS:
            if t == s: continue
            if t in d: tot += d[t]; cnt += 1; dia = max(dia, d[t])
            else: unre += 1
    return {"간선": len(E), "밀도": round(len(E)/(n*(n-1)/2)*100, 1),
            "평균거리": round(tot/cnt, 2) if cnt else 0, "지름": dia,
            "도달불가": round(unre/(n*(n-1))*100, 1),
            "고아": sum(1 for c in CONCEPTS if not gg[c])}

E1 = {(e["a"], e["b"]) for e in L1}
E15 = {(e["a"], e["b"]) for e in L15}
E12 = E1 | E15 | {(e["a"], e["b"]) for e in L2}
EALL = E12 | {(e["a"], e["b"]) for e in L3}
S = {"L1": stats(E1), "L1+L1½": stats(E1 | E15),
     "L1+L1½+L2": stats(E12), "전체": stats(EALL)}

# ★L1½가 실제로 «새로» 무엇을 놓았는가 — 겹치면 정밀화, 안 겹치면 신규 다리
K = lambda s: {tuple(sorted(p)) for p in s}
k1, k15, k2 = K(E1), K(E15), K({(e["a"], e["b"]) for e in L2})
새쌍 = k15 - k1 - k2
deg = Counter()
for e in ALL:
    deg[e["a"]] += 1; deg[e["b"]] += 1

rep = ["# 링크망 리포트", "",
       f"- 개념 {len(CONCEPTS)} · 문단 {N:,}",
       f"- L1 결정론 {len(L1)} · L2 밀착 {len(L2)}(강 {sum(1 for e in L2 if e['등급']=='강')}"
       f"/중 {sum(1 for e in L2 if e['등급']=='중')}/약 {sum(1 for e in L2 if e['등급']=='약')})"
       f" · L3 보강 {len(L3)}",
       f"- **L1½ 조건부 {len(L15)}** (F6 대칭 분기) · "
       f"상 {sum(1 for e in L15 if e['등급']=='상')} · "
       f"출처 {dict(Counter(s for e in L15 for s in e['출처군']))}",
       f"  - L1과 겹침 {len(k15 & k1)} = 결정론 간선에 **조건을 붙여 정밀화**한 것",
       f"  - L2와 겹침 {len(k15 & k2)} = 공기 통계로만 있던 쌍에 **방향·조건을 준 것**",
       f"  - ★**완전히 새 쌍 {len(새쌍)}** ({len(새쌍)/max(1,len(k15))*100:.0f}%)",
       f"  - 트리거가 총칭이라 눌린 것 {sum(1 for e in L15 if e.get('트리거총칭'))} "
       f"(무게 ×{0.45}/√분기수)",
       f"  - **교차확인 {sum(1 for e in L15 if e.get('교차확인'))}** (2곳 이상에서 같은 조건부 관계) · "
       f"단일 출처 {sum(1 for e in L15 if not e.get('교차확인'))} (무게 ×0.7)",
       f"    ↳ 조건부 간선의 82%가 문장 1건에서 나온다 — **조건 분기는 본디 단일 증언이다.** "
       f"등급(추출 품질)과 교차확인(증거 강도)은 다른 축이라 따로 적는다.",
       f"- 총 간선 {len(ALL)} · **한 쌍 = 한 줄** (층간 중복 해소: 공리중복 버림 {_dropped_ax} · L1 조건흡수 {_merged_1} · L2 접음 {_merged_2})",
       f"- **코퍼스** 문단 {N:,} = 웹 {IDXRAW.get('n_web','?'):,} + 전사 {IDXRAW.get('n_전사','?'):,} "
       f"(구 색인은 38,072 — 운세 격자·보류군을 안 걸렀고 gist를 세고 있었다)",
       f"- **L2 출처수 관문**: 강등 {sum(1 for e in L2 if e.get('강등'))} · "
       f"출처 1곳 {sum(1 for e in L2 if e.get('출처수',0)<=1)} · "
       f"2곳 {sum(1 for e in L2 if e.get('출처수',0)==2)} · "
       f"3곳↑ {sum(1 for e in L2 if e.get('출처수',0)>=3)}", "",
       "| 층 | 간선 | 밀도 | 평균거리 | 지름 | 도달불가 | 고아 |", "|---|---:|---:|---:|---:|---:|---:|"]
for k, v in S.items():
    rep.append(f"| {k} | {v['간선']} | {v['밀도']}% | {v['평균거리']} | {v['지름']} | {v['도달불가']}% | {v['고아']} |")
rep += ["", f"- 다리 수 중앙값 {sorted(deg.values())[len(deg)//2]} · 최대 {max(deg.values())} · 최소 {min(deg.values())}",
        f"- 다리 0개 개념: {sum(1 for c in CONCEPTS if deg[c]==0)}"]
(DATA / "링크망_리포트.md").write_text("\n".join(rep) + "\n", encoding="utf-8")
print("\n".join(rep[2:]))

# 🔴260726 수리 — **이 파일만 `__exit__`을 안 부르고 있었다.**
#   압축담당자 규명: 작업로그 결번 15건이 **예외 없이 전부 «링크망 재계산»**이었다.
#   내 1차 진단(「프로세스 강제 종료」)은 틀렸다 — 그냥 닫는 줄이 후속 패치에 유실됐다.
#   부수 손실: **링크망의 수치 메모가 한 번도 로그에 남은 적이 없다.**
#   (`with 단계(...)`를 썼으면 애초에 안 났을 사고다. 수동 `__enter__`는 위험하다.)
_st.기록(f"코퍼스 {N:,} · 총 간선 {len(ALL):,}")
_st.기록(f"L1 {len(L1)} · L1½ {len(L15)} · L2 {len(L2)} · L3 {len(L3)}")
_st.기록(f"층간중복 해소 — 공리중복 버림 {_dropped_ax} · 조건흡수 {_merged_1} · L2접음 {_merged_2}")
_st.__exit__(None, None, None)
