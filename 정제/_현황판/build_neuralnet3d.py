# -*- coding: utf-8 -*-
"""
사주신경망_3D.html — xyz 원통 좌표 · 360° 회전

운영자 지시(260726):
  "계층을 xyz를 모두 활용해야됨. 2차원으로는 데이터 의존도가 표현이 안될거야"
  "1과 5가 가까운데 … 2d상에는 안보이지만 뒤로보니 가까운 z라인에 있었다.
   우주에서 특정 행성이 실제론 더 가까운데 다른 카메라 각도에서는 더 멀어보이는 그런거지"

★그 예시가 정확히 오행이다 — 목(1)과 수(5)는 상생 고리에서 바로 옆인데
  1-2-3-4-5로 펼치면 양 끝이 된다. 작용축 간선 249개가 층을 하나도 안 넘는 이유가 이것.

실측(260726 메인 검산):
  분류축 398간선 — 동일층 41% + 역행 39%   → 반경(r)으로 그려야 할 것을 층에 태웠다
  작용축 249간선 — 층 넘김 0.0%             → 원(θ)이다
  추론축 182간선 — 전진 5%                  → 이것만 흐름(x)

→ 축이 3개면 좌표도 3개다.
   x = 판단 단계(추론 흐름) · θ = 오행/십성 위상(작용 고리) · r = 분류 깊이
   y = r·cos θ,  z = r·sin θ   →  원통

입력: data/링크망.jsonl · node_layers.jsonl · knowledge_metrics.jsonl · 정의카드.jsonl
출력: 사주신경망_3D.html (자립형)
"""
import json, math
from pathlib import Path
from collections import defaultdict, Counter

HERE = Path(r"C:\Users\Hwang\OneDrive - GS칼텍스 예울마루\황세웅\6.  Nomute\3. 사주\2. 정제작업\_현황판")
DATA = HERE / "data"


def jl(n):
    return [json.loads(l) for l in (DATA / n).read_text(encoding="utf-8").splitlines() if l.strip()]


layers = jl("node_layers.jsonl")
metrics = {r["concept"]: r for r in jl("knowledge_metrics.jsonl")}
web = jl("링크망.jsonl")
# 🔴260726 수리 — `정의카드.jsonl`(저자 축자)을 읽어 **저자명을 화면에 240건 띄우고 있었다.**
#    운영자 1-34: "어떤 특정인이 한 말 - 이런식으로 할 필요도없음". 정제본으로 교체.
try:
    refined = {r["concept"]: r["정의"] for r in jl("정의_정제본.jsonl")}
except FileNotFoundError:
    refined = {}

BIG = {r["concept"]: r["big"] for r in layers}
MID = {r["concept"]: r["mid"] for r in layers}
CONCEPTS = [r["concept"] for r in layers]
CSET = set(CONCEPTS)
CODE = {c: BIG[c].split()[0] for c in CONCEPTS}

# ══════════════════════════════════════════════════════════════
# x축 — 판단 단계 (평의회 3인 수렴안: B0 바탕 → B5 판정·시간 + 옆판 3)
# ══════════════════════════════════════════════════════════════
STAGE = [
    ("B0 바탕",   "음양·오행·절기 — 나머지 전부가 여기서 나온다"),
    ("B1 글자",   "천간 10 · 지지 12 · 지장간"),
    ("B2 자리",   "원국 8칸 · 일간 · 궁위(근묘화실) — 판단의 닻"),
    ("B3 관계",   "십성·육친 — 오행×음양×일간의 함수, 별도 단계가 아니다"),
    ("B4 사건",   "합충형파해 · 십이운성 · 신살 — 자리에서 벌어지는 일"),
    ("B5 판정·시간", "강약 → 격국 → 용신 · 대운·세운"),
    ("옆판 발현",  "재물·직업·관계·건강 — 층이 아니라 출구"),
    ("옆판 화법",  "상담론·헤지·금지선 — 전 구간을 감싸는 게이트"),
    ("옆판 계보",  "고전·인물·관법 — 옆에서 가중치만 공급"),
]
BIG2STAGE = {
    "S01": 0, "S14": 0,
    "S02": 1, "S03": 1,
    "S13": 2,
    "S05": 3,
    "S04": 4, "S06": 4, "S07": 4,
    "S08": 5, "S09": 5, "S10": 5,
    "S15": 6, "S11": 7, "S12": 8,
}
# ✅260726 운영자 승인으로 데이터가 제자리로 갔다 — 화면 오버라이드는 더 이상 필요 없다.
#    근묘화실 → S13 원국 전체 · 만세력·시간보정 → S14 절기·역법 (build_concept_map.py TAXONOMY)
MOVED = {}

# ══════════════════════════════════════════════════════════════
# θ축 — 오행/십성 위상 (5분할 72°). 십성은 오행 «관계»의 5각이라 같은 각을 쓴다.
#        → 회전시켜 겹쳐 보면 «십성은 오행의 재명명»이 눈으로 확인된다.
# ══════════════════════════════════════════════════════════════
OHAENG = {
    "목": ["갑목(甲)", "을목(乙)", "인목(寅)", "묘목(卯)", "목(木)"],
    "화": ["병화(丙)", "정화(丁)", "사화(巳)", "오화(午)", "화(火)"],
    "토": ["무토(戊)", "기토(己)", "진토(辰)", "술토(戌)", "축토(丑)", "미토(未)", "토(土)"],
    "금": ["경금(庚)", "신금(辛)", "신금(申)", "유금(酉)", "금(金)"],
    "수": ["임수(壬)", "계수(癸)", "해수(亥)", "자수(子)", "수(水)"],
}
SIPSEONG = {   # 일간 기준 관계 5각 — 비겁(同)→식상(生出)→재성(剋出)→관성(剋入)→인성(生入)
    "비겁": ["비견", "겁재", "비겁 일반"],
    "식상": ["식신", "상관", "식상 일반"],
    "재성": ["편재", "정재", "재성 일반"],
    "관성": ["편관(칠살)", "정관", "관성 일반"],
    "인성": ["편인", "정인", "인성 일반"],
}
SEED, SEEDLBL = {}, {}
for i, (k, v) in enumerate(OHAENG.items()):
    for c in v:
        if c in CSET:
            SEED[c] = i * 72.0; SEEDLBL[c] = k
for i, (k, v) in enumerate(SIPSEONG.items()):
    for c in v:
        if c in CSET:
            SEED[c] = i * 72.0; SEEDLBL[c] = k

# 전파 — 시드가 없는 개념은 이웃의 원형 평균각
# 🔴260726 수리 — 전파 이웃에 **L2 밀착 4,665개를 다 넣어서** 각이 무너졌다.
#    밀착은 방향 없는 동거 신호라 원형 평균이 전역 중심(≈148°)으로 빨려든다.
#    실측: 249개 중 207개가 추정각이었고 표준편차 8°, 좌표 완전 동일 23쌍.
#    → 위상은 «작용축»에서만 온다(생·극·합·충·비화·형·파·해). 그게 오행 고리의 정체다.
ACT_KIND = {"생", "극", "합", "비화", "충", "형", "파", "해", "원진", "귀문", "제화",
            "구성", "롤업", "소속", "지장간",
            # 🔴260726 페이블 점검 적발 — kind를 세분(합→육합/방합/삼합…)했는데
            #   여기에 안 넣어서 **합·충·형 간선 50개가 θ 전파에서 조용히 탈락**했다.
            #   그러면 그 노드들이 «각을 못 정한 것»으로 밀려나 미배정 링에 간다.
            #   에러는 안 난다 — 그냥 그림이 조금씩 틀려진다. 그게 제일 나쁘다.
            "천간합", "육합", "방합", "삼합", "반합", "합화",
            "천간충", "지지충", "삼형", "상형", "자형",
            "산출",      # 신살 조견표도 «일간→지지»라 구조를 잇는다
            "절차"}      # ★260726 강약 점수제·득령득지득세 (judge.js 이식)
adj = defaultdict(list)
for e in web:
    if e["층"] != "L1결정론" or e.get("kind") not in ACT_KIND:
        continue
    if e["a"] in CSET and e["b"] in CSET:
        adj[e["a"]].append((e["b"], e["weight"]))
        adj[e["b"]].append((e["a"], e["weight"]))
theta = dict(SEED)
conf = {c: 1.0 for c in SEED}          # ★신뢰도 — 시드는 1.0, 전파는 결과벡터 길이
for _ in range(14):
    nxt, ncf = {}, {}
    for c in CONCEPTS:
        if c in SEED:
            continue
        sx = sy = tot = 0.0
        for b, w in adj[c]:
            if b in theta:
                sx += w * math.cos(math.radians(theta[b]))
                sy += w * math.sin(math.radians(theta[b]))
                tot += w
        if tot > 0 and (sx or sy):
            nxt[c] = math.degrees(math.atan2(sy, sx)) % 360
            ncf[c] = min(1.0, math.hypot(sx, sy) / tot)   # 0=사방으로 흩어짐, 1=한 방향
    theta.update(nxt); conf.update(ncf)
for c in CONCEPTS:
    theta.setdefault(c, 0.0)
    conf.setdefault(c, 0.0)            # 각을 못 정한 노드 = 신뢰도 0 → 중심선에 세운다

# ══════════════════════════════════════════════════════════════
# r축 — 분류 깊이 (구성·롤업·소속…). 되먹임 0인 축이라 안전하게 반경으로 쓴다.
#        안쪽 = 총칭·묶음, 바깥 = 개별 글자
# ══════════════════════════════════════════════════════════════
CLS = {"구성", "롤업", "지장간", "소속", "육친"}
parent = defaultdict(set)          # 자식 → 부모(더 총칭)
for e in web:
    if e["층"] != "L1결정론" or e["kind"] not in CLS:
        continue
    a, b = e["a"], e["b"]
    if e["dir"] == "b→a":
        a, b = b, a
    if e["kind"] in ("롤업", "소속"):     # 개별 → 총칭
        parent[a].add(b)
    else:                                # 총칭(묶음) → 구성원
        parent[b].add(a)
depth = {}
for c in CONCEPTS:
    seen, cur, d = {c}, {c}, 0
    while cur and d < 8:
        nx = set()
        for u in cur:
            for p in parent.get(u, ()):
                if p not in seen:
                    seen.add(p); nx.add(p)
        if not nx:
            break
        cur = nx; d += 1
    depth[c] = d
DMAX = max(depth.values()) or 1

# ══════════════════════════════════════════════════════════════
nodes, idx = [], {}
for c in CONCEPTS:
    mt = metrics.get(c, {})
    st = MOVED.get(c, (None,))[0]
    if st is None:
        st = BIG2STAGE.get(CODE[c], 8)
    r = 0.34 + 0.66 * (depth[c] / DMAX)
    # 🔴260726 수리 — 전에는 «각을 못 믿으면 r×0.35»로 **중심 쪽에 밀어** 넣었다.
    #   페이블 감사: "249개 중 189개(76%)가 중심선이면 θ축은 사실상 실패한 축이다.
    #                시각화에서 **중심은 «핵심/허브»로 읽히므로** «각도 미상»이
    #                «가장 중요»로 오독되는 건 확실하다."
    #   맞는 지적이다. 중심은 그림에서 가장 눈에 띄는 자리인데 거기에 «모르는 것»을 쌓았다.
    #   → **최외곽 «미배정 링»으로 뺀다.** 바깥은 «변두리»로 읽히고, 그게 사실에 가깝다.
    #     그리고 링을 하나 더 밖에 둬서 «본체와 다른 층»임이 형태로 보이게 한다.
    미배정 = conf.get(c, 0.0) < 0.30
    if 미배정:
        r = 1.18 + 0.10 * (depth[c] / DMAX)   # 본체(0.34~1.00) 밖 링
    th = math.radians(theta[c])
    idx[c] = len(nodes)
    nodes.append({
        "n": c, "s": st, "big": BIG[c], "mid": MID[c], "code": CODE[c],
        "th": round(theta[c], 1), "r": round(r, 3), "dep": depth[c],
        "cf": round(conf.get(c, 0.0), 2), "un": 미배정,
        "ph": SEEDLBL.get(c, ""), "seed": c in SEED,
        "y": round(r * math.cos(th), 4), "z": round(r * math.sin(th), 4),
        "p": mt.get("문단", 0), "au": mt.get("저자수", 0),
        "d": "정제" if refined.get(c) else "공백",
        "q": refined.get(c, ""),
        "mv": MOVED.get(c, (None, ""))[1],
    })

AXIS = {}
for k in ("구성", "롤업", "지장간", "소속", "육친", "비교", "순서", "관계", "인접"):
    AXIS[k] = 0                                    # 분류 = 반경
for k in ("생", "극", "합", "비화", "충", "형", "파", "해", "원진", "귀문", "제화"):
    AXIS[k] = 1                                    # 작용 = 고리
for k in ("전제", "발현", "적용", "귀결", "반증"):
    AXIS[k] = 2                                    # 추론 = 흐름

TIER = {"강": 1, "중": 2, "약": 3}
edges = []
for e in web:
    a, b = e["a"], e["b"]
    if a not in idx or b not in idx:
        continue
    if e["층"] == "L1결정론":
        t = 0; ax = AXIS.get(e["kind"], 2)
    elif e["층"] == "L3보강":
        t = 4; ax = 3
    else:
        t = TIER.get(e.get("등급"), 3); ax = 3      # 밀착 = 축 없음
    s, d = idx[a], idx[b]
    if t == 0 and e.get("dir") == "b→a":
        s, d = d, s
    edges.append([s, d, t, round(e["weight"], 2), ax, e.get("kind", ""),
                  round(float(e.get("lift", 0) or 0), 1), e.get("동시문단", 0) or 0])

deg = Counter()
for s, d, *_ in edges:
    deg[s] += 1; deg[d] += 1
for i, n in enumerate(nodes):
    n["deg"] = deg[i]

PAL = {"S01": "#e8543f", "S02": "#f0912f", "S03": "#e5c024", "S04": "#a8c93a",
       "S05": "#4cb96a", "S06": "#2fb99b", "S07": "#31b0d4", "S08": "#4a86e8",
       "S09": "#6c6ce0", "S10": "#9159d1", "S11": "#c74fbe", "S12": "#e8508f",
       "S13": "#b0876a", "S14": "#8a94a6", "S15": "#ff6b9d"}

payload = {"stage": [{"name": s[0], "desc": s[1],
                      "n": sum(1 for x in nodes if x["s"] == i)}
                     for i, s in enumerate(STAGE)],
           "nodes": nodes, "edges": edges, "pal": PAL,
           "phase": [{"k": k, "deg": i * 72} for i, k in enumerate(OHAENG)]}

TPL = r"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>사주 신경망 3D — 원통 좌표</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:#03050b;color:#cfe0f5;overflow:hidden;
 font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif}
#cv{position:fixed;inset:0;cursor:grab}#cv.drag{cursor:grabbing}
.p{position:fixed;background:rgba(7,12,24,.94);border:1px solid #22304a;border-radius:10px;
 backdrop-filter:blur(8px);font-size:12px;line-height:1.55}
#ctl{top:12px;left:12px;padding:12px 14px;width:252px;max-height:calc(100vh - 24px);overflow:auto}
#ctl h1{font-size:14px;color:#fff}#ctl .sub{color:#6d82a3;font-size:11px;margin-bottom:9px}
.grp{border-top:1px solid #1b2740;padding-top:9px;margin-top:9px}
.grp b{display:block;color:#8fa8cc;font-size:11px;margin-bottom:6px;letter-spacing:.04em}
label{display:flex;align-items:center;gap:7px;padding:2px 0;cursor:pointer;color:#b9cbe6}
label:hover{color:#fff}
input[type=checkbox]{accent-color:#4a86e8;width:13px;height:13px}
input[type=range]{width:100%;accent-color:#4a86e8}
.sw{width:20px;height:3px;border-radius:2px;flex:none}
.cnt{margin-left:auto;color:#5b6f8f;font-size:10px}
button{background:#16233c;border:1px solid #2a3c5c;color:#b9cbe6;border-radius:6px;
 padding:5px 8px;font-size:11px;cursor:pointer;font-family:inherit;margin:2px 2px 0 0}
button:hover{background:#1e2f4e;color:#fff}button.on{background:#2b4674;border-color:#4a86e8;color:#fff}
#info{top:12px;right:12px;padding:13px 15px;width:336px;max-height:calc(100vh - 24px);overflow:auto;display:none}
#info h2{font-size:15px;color:#fff}#info .path{color:#6d82a3;font-size:11px;margin-bottom:8px}
#info .def{border-left:2px solid #4a86e8;padding:7px 10px;background:#0b1424;border-radius:0 6px 6px 0;
 margin-bottom:9px;color:#dce9fa;font-size:12px}
#info .def .who{display:block;color:#6d82a3;font-size:10.5px;margin-top:4px}
#info .row{display:flex;gap:6px;align-items:baseline;padding:2.5px 0;border-bottom:1px solid #111c2f}
#info .meta{margin-left:auto;color:#5b6f8f;font-size:10px;white-space:nowrap}
#info .sec{color:#8fa8cc;font-size:11px;margin:9px 0 3px;letter-spacing:.04em}
#tip{position:fixed;pointer-events:none;background:#0a1322;border:1px solid #2a3c5c;border-radius:6px;
 padding:6px 9px;font-size:11.5px;color:#dce9fa;display:none;z-index:9}
#hint{bottom:12px;left:12px;padding:8px 12px;color:#5b6f8f;font-size:11px;max-width:640px}
kbd{background:#16233c;border:1px solid #2a3c5c;border-radius:3px;padding:0 4px;font-size:10px}
.warn{color:#e8a05a;font-size:10.5px;margin-top:5px;line-height:1.45}
</style></head><body>
<canvas id="cv"></canvas>

<div class="p" id="ctl">
  <h1>사주 신경망 3D</h1>
  <div class="sub">원통 좌표 · <b id="nN"></b>개념 · <b id="eN"></b>시냅스</div>

  <div class="grp"><b>축이 3개다</b>
    <div style="color:#8fa8cc;font-size:10.8px;line-height:1.6">
      <b style="color:#7fb0ff">x</b> 판단 단계 — 추론축(전진 5%뿐이라 이것만 흐름)<br>
      <b style="color:#f0912f">θ</b> 오행·십성 위상 — 작용축(<b>층 넘김 0%</b> = 원이다)<br>
      <b style="color:#4cb96a">r</b> 분류 깊이 — 분류축(되먹임 0%, 안=총칭 밖=개별)
    </div>
  </div>

  <div class="grp"><b>카메라</b>
    <button id="camRing">오행 고리 정면</button><button id="camFlow">판단 흐름 측면</button>
    <button id="camIso">비스듬히</button><button id="spin" class="on">자동 회전</button>
  </div>

  <div class="grp"><b>시냅스</b><div id="tierBox"></div></div>
  <div class="grp"><b>최소 강도 <span id="wv" style="color:#4a86e8">0.00</span></b>
    <input type="range" id="wmin" min="0" max="0.9" step="0.05" value="0"></div>
  <div class="grp"><b>보기</b>
    <label><input type="checkbox" id="lbl" checked> 개념 이름</label>
    <label><input type="checkbox" id="guide" checked> 원통 가이드·오행 방위</label>
    <label><input type="checkbox" id="fog" checked> 원근 흐림(뒤쪽 어둡게)</label>
  </div>
  <div class="grp"><b>단계</b><div id="stgBox"></div></div>
  <div class="grp"><b>대주제</b><div id="bigBox" style="max-height:170px;overflow:auto"></div></div>
  <div class="grp">
    <div class="warn">⚠ <b>θ(오행 위상)는 42개만 실좌표</b>다. 나머지는 작용축 간선으로 전파한
    <b>추정각</b>이라 신뢰도가 낮을수록 흐리게 그렸고, 0.3 미만은
    <b style="color:#ff9ecd">바깥 «미배정 링»</b>으로 뺐다 &mdash; 각을 못 정한 것이지 중요한 게 아니다
    (전에는 중심에 몰아놨는데, 중심은 &laquo;허브&raquo;로 읽혀 정반대로 오독된다).
    <b>흐린 노드의 각도는 믿지 마라.</b></div>
  </div>
</div>

<div class="p" id="info"></div><div id="tip"></div>
<div class="p" id="hint">
  <kbd>드래그</kbd> 360° 회전 · <kbd>휠</kbd> 줌 · <kbd>클릭</kbd> 고정 —
  <b style="color:#7fb0ff">화면에서 멀어 보여도 실제 3D 거리가 가까운 이웃</b>을 패널이 따로 보여준다.
  «오행 고리 정면»을 누르면 목→화→토→금→수가 원으로 닫히는 게 보인다.
</div>

<script>
const D=__DATA__;
const TIERS=[{name:"결정론 규칙",col:"#7fe8d8"},{name:"밀착 강",col:"#f0912f"},
 {name:"밀착 중",col:"#4a86e8"},{name:"밀착 약",col:"#4b5c74"},{name:"보강",col:"#e0483f"}];
const AXCOL=["#4cb96a","#f0912f","#7fb0ff","#4b5c74"];   // 분류·작용·추론·밀착
const cv=document.getElementById('cv'),ctx=cv.getContext('2d');
const N=D.nodes,E=D.edges,S=D.stage;
let W=0,H=0,DPR=Math.min(devicePixelRatio||1,2);

// ── 3D 좌표 (원통) : x=단계, y/z=반경×각도
const XGAP=1.05;
for(const n of N){ n.X=n.s*XGAP; n.Y=n.y; n.Z=n.z;
  n.R=Math.max(2.0,Math.min(7.0,1.6+Math.log10(1+n.p)*1.45)); }
const CX=(S.length-1)*XGAP/2;

// ── 카메라 (궤도)
let yaw=0.62, pitch=0.30, dist=7.4, spin=true;
function project(n){
  let x=n.X-CX, y=n.Y, z=n.Z;
  // x축 둘레 회전(yaw) → 오행 고리가 돈다
  let cy=Math.cos(yaw),sy=Math.sin(yaw);
  let y2=y*cy - z*sy, z2=y*sy + z*cy;
  // 위아래(pitch)
  let cp=Math.cos(pitch),sp=Math.sin(pitch);
  let x2=x*cp - z2*sp, z3=x*sp + z2*cp;
  const d=dist+z3;
  const f=(dist*1.02)/Math.max(0.35,d);
  return {sx:x2*f, sy:-y2*f, depth:d, f:f};
}
let SC=1, OX=0, OY=0;
function toScreen(p){ return {x:OX+p.sx*SC, y:OY+p.sy*SC}; }

// ── 상태
const tierOn=[true,true,true,false,true];
const stgOn=S.map(()=>true), bigOn={};
Object.keys(D.pal).forEach(k=>bigOn[k]=true);
let wmin=0,showLbl=true,showGuide=true,useFog=true,hover=null,lock=null,LOD=false;

const ADJ=N.map(()=>[]);
E.forEach((e,i)=>{ADJ[e[0]].push(i);ADJ[e[1]].push(i)});

const vis=n=>bigOn[n.code]&&stgOn[n.s];
function eVis(e){ return tierOn[e[2]] && e[3]>=wmin && vis(N[e[0]]) && vis(N[e[1]]); }

// ── 실제 3D 거리
function dist3(a,b){ const A=N[a],B=N[b];
  return Math.hypot(A.X-B.X,A.Y-B.Y,A.Z-B.Z); }

// ── 그리기
let PT=[];
function draw(){
  if(W<2||H<2) return;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  const g=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*.8);
  g.addColorStop(0,'#080f20');g.addColorStop(1,'#03050b');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);

  SC=Math.min(W,H)*0.40; OX=W/2; OY=H/2;
  PT=N.map(n=>{const p=project(n);const s=toScreen(p);return {x:s.x,y:s.y,d:p.depth,f:p.f};});
  const dmin=Math.min(...PT.map(p=>p.d)), dmax=Math.max(...PT.map(p=>p.d));
  const fog=p=>useFog?Math.max(0.12,Math.min(1,1.12-(p.d-dmin)/Math.max(.001,dmax-dmin)*0.92)):1;

  if(showGuide) drawGuide();

  const foc=lock!=null?lock:hover;
  const focSet=foc!=null?new Set(ADJ[foc].flatMap(i=>[E[i][0],E[i][1]])):null;

  // 시냅스 — 뒤에서 앞으로
  ctx.lineCap='round'; ctx.globalCompositeOperation='lighter';
  const ord=[3,2,1,4,0];
  for(const t of ord){
    if(!tierOn[t])continue;
    const li=[];
    for(let i=0;i<E.length;i++){const e=E[i];
      if(e[2]!==t||!eVis(e))continue;
      if(foc!=null&&e[0]!==foc&&e[1]!==foc)continue;
      if(LOD&&t===3)continue;            // 회전 중엔 약한 다리 생략
      li.push(i);}
    li.sort((a,b)=>(PT[E[b][0]].d+PT[E[b][1]].d)-(PT[E[a][0]].d+PT[E[a][1]].d));
    for(const i of li){
      const e=E[i],A=PT[e[0]],B=PT[e[1]];
      const col = t===0 ? AXCOL[e[4]] : TIERS[t].col;
      const al = foc!=null?0.9:(t===0?0.40:(t===1?0.26:(t===2?0.14:(t===3?0.055:0.30))));
      ctx.strokeStyle=col;
      ctx.globalAlpha=al*Math.min(fog(A),fog(B));
      ctx.lineWidth=Math.max(0.45,(t===0?1.4:0.5+e[3]*1.4)*(foc!=null?1.8:1));
      ctx.beginPath(); ctx.moveTo(A.x,A.y);
      if(e[4]===1&&t===0){                        // 작용축 = 고리를 따라 휜다
        const mx=(A.x+B.x)/2,my=(A.y+B.y)/2;
        const cx2=OX+(mx-OX)*1.34, cy2=OY+(my-OY)*1.34;
        ctx.quadraticCurveTo(cx2,cy2,B.x,B.y);
      }else{
        const mx=(A.x+B.x)/2,my=(A.y+B.y)/2;
        ctx.quadraticCurveTo(mx+(B.y-A.y)*0.06,my-(B.x-A.x)*0.06,B.x,B.y);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';

  // 뉴런 — 뒤에서 앞으로
  const ni=N.map((_,i)=>i).filter(i=>vis(N[i])).sort((a,b)=>PT[b].d-PT[a].d);
  for(const i of ni){
    const n=N[i],p=PT[i],a=fog(p);
    const dim=focSet&&!focSet.has(i)&&i!==foc;
    const r=Math.max(1.3,n.R*p.f*SC/210);
    ctx.globalAlpha=(dim?0.10:1)*a*(0.35+0.65*(n.cf==null?1:n.cf));
    if(!dim){ctx.beginPath();ctx.arc(p.x,p.y,r*2.6,0,6.284);ctx.fillStyle=n.col||D.pal[n.code];
      ctx.globalAlpha=(dim?0.05:0.16)*a;ctx.fill();ctx.globalAlpha=(dim?0.10:1)*a;}
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,6.284);
    ctx.fillStyle=D.pal[n.code];ctx.fill();
    if(n.mv){ctx.strokeStyle='#e8a05a';ctx.lineWidth=1.3;ctx.stroke();}
    else if(n.d==='공백'){ctx.strokeStyle='#e0483f';ctx.lineWidth=1;ctx.stroke();}
    ctx.globalAlpha=1;
  }

  // 이름
  if(showLbl){
    ctx.font=`${Math.max(9,10.5)}px "Pretendard","Malgun Gothic",sans-serif`;
    ctx.textBaseline='middle';ctx.textAlign='left';
    const drawn=[];
    for(const i of ni.slice().reverse()){
      const n=N[i],p=PT[i];
      const near=foc!=null&&(i===foc||(focSet&&focSet.has(i)));
      if(!near){
        if(fog(p)<0.55) continue;
        if(n.p<300 && !n.seed) continue;
        if(drawn.some(q=>Math.abs(q.x-p.x)<58&&Math.abs(q.y-p.y)<12)) continue;
      }
      drawn.push(p);
      ctx.globalAlpha=near?1:0.72*fog(p);
      ctx.fillStyle=(i===foc)?'#fff':'#a8bdd8';
      ctx.fillText(n.n,p.x+7,p.y);ctx.globalAlpha=1;
    }
  }
  drawStageLabels();
}

function drawGuide(){
  ctx.save();ctx.globalAlpha=1;
  // 각 단계마다 원통 링
  for(let s=0;s<S.length;s++){
    if(!stgOn[s])continue;
    ctx.strokeStyle=s<6?'rgba(70,100,160,.30)':'rgba(90,80,120,.22)';
    ctx.lineWidth=1;ctx.beginPath();
    for(let k=0;k<=72;k++){
      const t=k/72*Math.PI*2;
      const p=toScreen(project({X:s*XGAP,Y:Math.cos(t),Z:Math.sin(t)}));
      k?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);
    }
    ctx.stroke();
  }
  // 중심축
  ctx.strokeStyle='rgba(70,100,160,.30)';ctx.setLineDash([4,7]);ctx.beginPath();
  let a=toScreen(project({X:0,Y:0,Z:0})),b=toScreen(project({X:(S.length-1)*XGAP,Y:0,Z:0}));
  ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
  // 오행 5방위
  ctx.font='bold 12px "Pretendard",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const ph of D.phase){
    const t=ph.deg*Math.PI/180;
    const p=toScreen(project({X:0,Y:1.24*Math.cos(t),Z:1.24*Math.sin(t)}));
    ctx.fillStyle='#e8543f';ctx.globalAlpha=.85;ctx.fillText(ph.k,p.x,p.y);ctx.globalAlpha=1;
  }
  ctx.restore();
}
function drawStageLabels(){
  ctx.textAlign='center';ctx.textBaseline='bottom';
  for(let s=0;s<S.length;s++){
    if(!stgOn[s])continue;
    const p=toScreen(project({X:s*XGAP,Y:1.55,Z:0}));
    ctx.font='bold 12px "Pretendard",sans-serif';
    ctx.fillStyle=s<6?'#7fb0ff':'#8a7fb0';ctx.globalAlpha=.92;
    ctx.fillText(S[s].name,p.x,p.y);
    ctx.font='10.5px "Pretendard",sans-serif';ctx.fillStyle='#5b6f8f';
    ctx.fillText('개념 '+S[s].n,p.x,p.y+14);ctx.globalAlpha=1;
  }
}

// ── 상호작용
function pick(mx,my){let b=null,bd=14;
  for(let i=0;i<N.length;i++){if(!vis(N[i]))continue;
    const p=PT[i];if(!p)continue;const d=Math.hypot(p.x-mx,p.y-my);
    if(d<12&&d<bd){bd=d;b=i;}}
  return b;}

const info=document.getElementById('info');
function showInfo(i){
  if(i==null){info.style.display='none';return;}
  const n=N[i];
  const mine=ADJ[i].map(k=>E[k]).filter(eVis);
  const grp=[[],[],[],[],[]];
  for(const e of mine){const o=e[0]===i?e[1]:e[0];
    grp[e[2]].push({o,w:e[3],k:e[5],lf:e[6],p:e[7],ax:e[4],out:e[0]===i});}
  let h=`<h2>${n.n}</h2><div class="path">${n.big} › ${n.mid} · ${S[n.s].name}</div>`;
  if(n.mv) h+=`<div class="def" style="border-color:#e8a05a;color:#e8c49a">◇ 화면 재배치(제안): ${n.mv}<span class="who">데이터는 안 바꿨다 — 승인 사안</span></div>`;
  if(n.q) h+=`<div class="def">${n.q}</div>`;
  else h+=`<div class="def" style="border-color:#e0483f;color:#e8a0a0">정의 공백<span class="who">근거는 ${n.p.toLocaleString()}문단 있다</span></div>`;
  h+=`<div class="row"><span>좌표</span><span class="meta">x ${S[n.s].name.split(' ')[0]} · θ ${n.th}° ${n.ph?'('+n.ph+')':''} · r ${n.r}</span></div>`;
  h+=`<div class="row"><span>문단 / 저자 / 시냅스</span><span class="meta">${n.p.toLocaleString()} / ${n.au} / ${n.deg}</span></div>`;
  // ★ 실제 3D 거리로 가까운 이웃 (직접 연결 아님)
  const near=[];
  for(let j=0;j<N.length;j++){ if(j===i||!vis(N[j]))continue;
    near.push([j,dist3(i,j)]); }
  near.sort((a,b)=>a[1]-b[1]);
  const direct=new Set(mine.map(e=>e[0]===i?e[1]:e[0]));
  h+=`<div class="sec" style="color:#7fb0ff">3D 실제 거리로 가까운 곳 — 화면 각도와 무관</div>`;
  for(const [j,dd] of near.slice(0,10)){
    const o=N[j];
    h+=`<div class="row"><span style="color:${D.pal[o.code]}">●</span><span>${o.n}</span>`+
       `<span class="meta">${dd.toFixed(2)} ${direct.has(j)?'· 연결됨':'· <b style="color:#e8a05a">연결 없음</b>'}</span></div>`;
  }
  for(const t of [0,1,2,3,4]){
    if(!grp[t].length)continue;
    grp[t].sort((a,b)=>b.w-a.w||b.lf-a.lf);
    h+=`<div class="sec" style="color:${TIERS[t].col}">${TIERS[t].name} — ${grp[t].length}</div>`;
    for(const g of grp[t].slice(0,22)){const o=N[g.o];
      const m=t===0?`${g.out?'→':'←'} ${g.k} · ${['분류','작용','추론','밀착'][g.ax]}`:`×${g.lf} · ${g.p}문단`;
      h+=`<div class="row"><span style="color:${D.pal[o.code]}">●</span><span>${o.n}</span><span class="meta">${m}</span></div>`;}
    if(grp[t].length>22)h+=`<div class="row"><span class="meta">… 외 ${grp[t].length-22}</span></div>`;
  }
  info.innerHTML=h;info.style.display='block';
}

const tip=document.getElementById('tip');
let drag=false,px=0,py=0,moved=false;
cv.addEventListener('mousedown',e=>{drag=true;moved=false;px=e.clientX;py=e.clientY;cv.classList.add('drag')});
addEventListener('mouseup',()=>{drag=false;cv.classList.remove('drag')});
cv.addEventListener('mousemove',e=>{
  if(drag){const dx=e.clientX-px,dy=e.clientY-py;
    if(Math.abs(dx)+Math.abs(dy)>3)moved=true;
    LOD=true;settle();
    yaw+=dx*0.0075; pitch=Math.max(-1.5708,Math.min(1.5708,pitch+dy*0.006));
    px=e.clientX;py=e.clientY;draw();return;}
  const i=pick(e.clientX,e.clientY);
  if(i!==hover){hover=i;draw();if(lock==null)showInfo(i);}
  if(i!=null){const n=N[i];tip.style.display='block';
    tip.style.left=(e.clientX+13)+'px';tip.style.top=(e.clientY+13)+'px';
    tip.innerHTML=`<b>${n.n}</b> <span style="color:#6d82a3">${n.code}·${n.mid}</span><br>`+
     `<span style="color:#6d82a3">θ ${n.th}° · r ${n.r} · 시냅스 ${n.deg}</span>`;}
  else tip.style.display='none';
});
cv.addEventListener('click',e=>{if(moved)return;
  const i=pick(e.clientX,e.clientY);lock=(i!=null&&i!==lock)?i:null;
  showInfo(lock!=null?lock:hover);draw();});
cv.addEventListener('wheel',e=>{e.preventDefault();
  dist=Math.max(2.2,Math.min(24,dist*Math.exp(e.deltaY*0.0011)));draw();},{passive:false});

// ── 컨트롤
const tb=document.getElementById('tierBox');
TIERS.forEach((t,i)=>{const c=E.filter(e=>e[2]===i).length;
  const l=document.createElement('label');
  l.innerHTML=`<input type="checkbox" ${tierOn[i]?'checked':''}><span class="sw" style="background:${t.col}"></span>${t.name}<span class="cnt">${c}</span>`;
  l.querySelector('input').onchange=ev=>{tierOn[i]=ev.target.checked;draw()};tb.appendChild(l);});
const sb=document.getElementById('stgBox');
S.forEach((s,i)=>{const l=document.createElement('label');
  l.innerHTML=`<input type="checkbox" checked>${s.name}<span class="cnt">${s.n}</span>`;
  l.title=s.desc;
  l.querySelector('input').onchange=ev=>{stgOn[i]=ev.target.checked;draw()};sb.appendChild(l);});
const bb=document.getElementById('bigBox'),bn={};
N.forEach(n=>bn[n.code]=n.big);
Object.keys(D.pal).sort().forEach(c=>{if(!bn[c])return;
  const k=N.filter(n=>n.code===c).length;const l=document.createElement('label');
  l.innerHTML=`<input type="checkbox" checked><span class="sw" style="background:${D.pal[c]}"></span>${bn[c].replace(/^S\d+ /,'')}<span class="cnt">${k}</span>`;
  l.querySelector('input').onchange=ev=>{bigOn[c]=ev.target.checked;draw()};bb.appendChild(l);});
document.getElementById('nN').textContent=N.length;
document.getElementById('eN').textContent=E.length.toLocaleString();
document.getElementById('wmin').oninput=e=>{wmin=+e.target.value;
  document.getElementById('wv').textContent=wmin.toFixed(2);draw()};
document.getElementById('lbl').onchange=e=>{showLbl=e.target.checked;draw()};
document.getElementById('guide').onchange=e=>{showGuide=e.target.checked;draw()};
document.getElementById('fog').onchange=e=>{useFog=e.target.checked;draw()};
document.getElementById('camRing').onclick=()=>{yaw=0;pitch=Math.PI/2;dist=7.0;draw()};
document.getElementById('camFlow').onclick=()=>{yaw=0;pitch=0;dist=7.6;draw()};
document.getElementById('camIso').onclick=()=>{yaw=.62;pitch=.30;dist=7.4;draw()};
const sp=document.getElementById('spin');
sp.onclick=()=>{spin=!spin;sp.classList.toggle('on',spin);if(!spin){LOD=false;draw();}};

let idleT=null;
function loop(){ if(spin&&!drag){LOD=true;yaw+=0.0026;draw();} requestAnimationFrame(loop); }
function settle(){clearTimeout(idleT);idleT=setTimeout(()=>{if(!spin){LOD=false;draw();}},110);}
function resize(){W=innerWidth;H=innerHeight;cv.width=W*DPR;cv.height=H*DPR;
  cv.style.width=W+'px';cv.style.height=H+'px';draw();}
addEventListener('resize',resize);
resize();loop();
</script></body></html>
"""

out = HERE / "사주신경망_3D.html"
out.write_text(TPL.replace("__DATA__", json.dumps(payload, ensure_ascii=False)), encoding="utf-8")
print(f"→ {out}  ({out.stat().st_size/1024:.0f}KB)")
print(f"노드 {len(nodes)} · 간선 {len(edges)}")
print(f"θ 시드 {len(SEED)} → 전파 후 {sum(1 for c in CONCEPTS if c in theta)}/{len(CONCEPTS)}")
print(f"r 분류깊이 분포 {dict(Counter(depth.values()))}")
for i, s in enumerate(STAGE):
    print(f"  {s[0]:<12} {sum(1 for n in nodes if n['s']==i):>3}")
