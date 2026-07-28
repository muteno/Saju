# -*- coding: utf-8 -*-
"""
사주신경망.html — 판단 흐름을 신경망 층으로 그린다.

운영자 참조(260726): 층(HL1·HL2·HL3…) + 뉴런 + 층 사이를 잇는 곡선 다발.
  → 우리 249개 개념을 «사주 판단이 실제로 흐르는 순서»로 층에 세운다.
     장식이 아니다. 글자 → 자리 → 작용 → 이름 → 판정 → 시간 → 발현이
     실제 통변 순서이고, 링크는 그 사이를 잇는 시냅스다.

입력: data/링크망.jsonl · node_layers.jsonl · knowledge_metrics.jsonl · 정의카드.jsonl
출력: 사주신경망.html (자립형 — 외부 참조 0)
"""
import json
from pathlib import Path
from collections import defaultdict, Counter

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from 경로 import 현황판 as HERE, DATA


def jl(n):
    return [json.loads(l) for l in (DATA / n).read_text(encoding="utf-8").splitlines() if l.strip()]


layers = jl("node_layers.jsonl")
metrics = {r["concept"]: r for r in jl("knowledge_metrics.jsonl")}
web = jl("링크망.jsonl")
# 🔴260726 수리 — 저자명 노출(1-34 위반). 정제본으로 교체.
try:
    refined = {r["concept"]: r["정의"] for r in jl("정의_정제본.jsonl")}
except FileNotFoundError:
    refined = {}

BIG = {r["concept"]: r["big"] for r in layers}
MID = {r["concept"]: r["mid"] for r in layers}
CONCEPTS = [r["concept"] for r in layers]

# ── 판단 흐름 층 (사주를 실제로 보는 순서)
FLOW = [
    ("L0 바탕",  ["S01 음양·오행", "S14 기본 골격어"],
     "세계관과 역법", "음양·오행·절기 — 나머지 전부가 여기서 나온다"),
    ("L1 글자",  ["S02 천간", "S03 지지·지장간"],
     "여덟 글자의 재료", "하늘 10자·땅 12자와 그 속의 지장간"),
    ("L2 자리",  ["S13 자리(궁위)·원국 구조"],
     "글자를 앉힌다", "네 기둥 어디에 앉느냐가 뜻을 바꾼다(근묘화실)"),
    ("L3 작용",  ["S04 합충형파해"],
     "글자끼리 부딪친다", "합·충·형·파·해 — 원국 안에서 벌어지는 사건"),
    ("L4 이름",  ["S05 십성·육친", "S06 신살", "S07 십이운성"],
     "관계에 이름을 준다", "일간 기준 십성·신살 배정, 기운 세기 12단계"),
    ("L5 판정",  ["S08 강약·격국·구조", "S09 용신"],
     "세기와 필요를 정한다", "신강·신약 → 격국 → 무엇이 필요한가(용신)"),
    ("L6 시간",  ["S10 대운·세운·운해석"],
     "운이 흘러든다", "대운·세운·월운이 원국을 건드린다"),
    ("L7 발현",  ["S15 발현·결과"],
     "겪는 일로 나온다", "재물·직업·관계·건강 — 사람이 실제로 묻는 것"),
    ("L8 말하기", ["S11 상담론·화법·윤리"],
     "사람의 말로 옮긴다", "화법·헤지·금지선 — 출력층의 게이트"),
    ("L9 계보",  ["S12 역사·이론사·인물"],
     "누가 그렇게 말했나", "고전·인물·관법 — 근거의 출처(옆에서 받친다)"),
]

PAL = {
    "S01": "#e8543f", "S02": "#f0912f", "S03": "#e5c024", "S04": "#a8c93a",
    "S05": "#4cb96a", "S06": "#2fb99b", "S07": "#31b0d4", "S08": "#4a86e8",
    "S09": "#6c6ce0", "S10": "#9159d1", "S11": "#c74fbe", "S12": "#e8508f",
    "S13": "#b0876a", "S14": "#8a94a6", "S15": "#ff6b9d",
}

# ── 노드 배치
nodes, idx = [], {}
for li, (lname, bigs, subtitle, desc) in enumerate(FLOW):
    members = [c for c in CONCEPTS if BIG[c] in bigs]
    members.sort(key=lambda c: (BIG[c], MID[c], -metrics.get(c, {}).get("문단", 0)))
    for k, c in enumerate(members):
        mt = metrics.get(c, {})
        code = BIG[c].split()[0]
        idx[c] = len(nodes)
        nodes.append({
            "n": c, "L": li, "k": k, "big": BIG[c], "mid": MID[c], "code": code,
            "col": PAL.get(code, "#888"),
            "p": mt.get("문단", 0), "au": mt.get("저자수", 0),
            "d": "정제" if refined.get(c) else "공백",
            "q": refined.get(c, ""),
        })
LAY_N = [sum(1 for n in nodes if n["L"] == i) for i in range(len(FLOW))]

# ── 간선
TIERCODE = {"강": 1, "중": 2, "약": 3}
edges = []
for e in web:
    a, b = e["a"], e["b"]
    if a not in idx or b not in idx:
        continue
    if e["층"] == "L1결정론":
        t = 0
    elif e["층"] == "L3보강":
        t = 4
    else:
        t = TIERCODE.get(e.get("등급"), 3)
    # 방향: 결정론은 dir 존중, 나머지는 층 순서(낮은 층 → 높은 층)
    s, d = idx[a], idx[b]
    if t == 0 and e.get("dir") == "b→a":
        s, d = d, s
    elif t != 0 and nodes[idx[a]]["L"] > nodes[idx[b]]["L"]:
        s, d = d, s
    edges.append([s, d, t, round(e["weight"], 2), e.get("kind", ""),
                  e.get("lift", 0) or 0, e.get("동시문단", 0) or 0])

deg = Counter()
for s, d, *_ in edges:
    deg[s] += 1; deg[d] += 1
for i, n in enumerate(nodes):
    n["deg"] = deg[i]

payload = {
    "flow": [{"name": f[0], "sub": f[2], "desc": f[3], "n": LAY_N[i]}
             for i, f in enumerate(FLOW)],
    "nodes": nodes, "edges": edges, "pal": PAL,
}

TPL = r"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>사주 신경망 — 판단이 흐르는 층</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:#04060d;color:#cfe0f5;
  font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif;overflow:hidden}
#cv{position:fixed;inset:0;cursor:grab}
#cv.drag{cursor:grabbing}
.panel{position:fixed;background:rgba(8,13,26,.93);border:1px solid #22304a;
  border-radius:10px;backdrop-filter:blur(8px);font-size:12px;line-height:1.55}
#ctl{top:12px;left:12px;padding:12px 14px;width:246px;max-height:calc(100vh - 24px);overflow:auto}
#ctl h1{font-size:14px;color:#fff;margin-bottom:2px;letter-spacing:.02em}
#ctl .sub{color:#6d82a3;font-size:11px;margin-bottom:10px}
.grp{border-top:1px solid #1b2740;padding-top:9px;margin-top:9px}
.grp b{display:block;color:#8fa8cc;font-size:11px;margin-bottom:6px;letter-spacing:.04em}
label{display:flex;align-items:center;gap:7px;padding:2px 0;cursor:pointer;color:#b9cbe6}
label:hover{color:#fff}
input[type=checkbox]{accent-color:#4a86e8;width:13px;height:13px}
input[type=range]{width:100%;accent-color:#4a86e8}
.sw{width:22px;height:3px;border-radius:2px;flex:none}
.cnt{margin-left:auto;color:#5b6f8f;font-size:10px}
button{background:#16233c;border:1px solid #2a3c5c;color:#b9cbe6;border-radius:6px;
  padding:5px 9px;font-size:11px;cursor:pointer;font-family:inherit}
button:hover{background:#1e2f4e;color:#fff}
button.on{background:#2b4674;border-color:#4a86e8;color:#fff}
#info{top:12px;right:12px;padding:13px 15px;width:330px;max-height:calc(100vh - 24px);
  overflow:auto;display:none}
#info h2{font-size:15px;color:#fff;margin-bottom:3px}
#info .path{color:#6d82a3;font-size:11px;margin-bottom:9px}
#info .def{border-left:2px solid #4a86e8;padding:7px 10px;background:#0c1626;
  border-radius:0 6px 6px 0;margin-bottom:10px;color:#dce9fa;font-size:12px}
#info .def .who{display:block;color:#6d82a3;font-size:10.5px;margin-top:5px}
#info .row{display:flex;gap:6px;align-items:baseline;padding:2.5px 0;border-bottom:1px solid #121d31}
#info .row .nm{color:#dce9fa}
#info .row .meta{margin-left:auto;color:#5b6f8f;font-size:10px;white-space:nowrap}
#info .sec{color:#8fa8cc;font-size:11px;margin:10px 0 4px;letter-spacing:.04em}
#tip{position:fixed;pointer-events:none;background:#0b1424;border:1px solid #2a3c5c;
  border-radius:6px;padding:6px 9px;font-size:11.5px;color:#dce9fa;display:none;z-index:9}
#hint{bottom:12px;left:12px;padding:8px 12px;color:#5b6f8f;font-size:11px}
kbd{background:#16233c;border:1px solid #2a3c5c;border-radius:3px;padding:0 4px;font-size:10px}
</style></head><body>
<canvas id="cv"></canvas>

<div class="panel" id="ctl">
  <h1>사주 신경망</h1>
  <div class="sub">개념 <b id="nN"></b> · 시냅스 <b id="eN"></b> · 층 10</div>

  <div class="grp"><b>시냅스 층</b><div id="tierBox"></div></div>

  <div class="grp"><b>최소 강도 <span id="wv" style="color:#4a86e8">0.00</span></b>
    <input type="range" id="wmin" min="0" max="0.9" step="0.05" value="0">
  </div>

  <div class="grp"><b>보기</b>
    <label><input type="checkbox" id="lbl" checked> 개념 이름</label>
    <label><input type="checkbox" id="glow" checked> 발광(가산 합성)</label>
    <label><input type="checkbox" id="fwd"> 진행 방향만 (역방향 숨김)</label>
  </div>

  <div class="grp"><b>대주제</b><div id="bigBox" style="max-height:190px;overflow:auto"></div></div>

  <div class="grp" style="display:flex;gap:6px;flex-wrap:wrap">
    <button id="fit">전체 맞춤</button><button id="reset">선택 해제</button>
  </div>
</div>

<div class="panel" id="info"></div>
<div id="tip"></div>
<div class="panel" id="hint">
  마우스 올리면 그 뉴런의 시냅스만 빛난다 · <kbd>클릭</kbd> 고정 · <kbd>휠</kbd> 확대 · <kbd>드래그</kbd> 이동 · 층 머리를 클릭하면 접힌다
</div>

<script>
const D = __DATA__;
const TIERS = [
  {i:0, name:"결정론 규칙",  col:"#7fe8d8", desc:"명리가 정해놓은 다리 — 판단은 여기로만"},
  {i:1, name:"밀착 강",      col:"#f0912f", desc:"우연의 4배+ · 근거 12문단+"},
  {i:2, name:"밀착 중",      col:"#4a86e8", desc:"우연의 2.5배+ · 근거 8문단+"},
  {i:3, name:"밀착 약",      col:"#4b5c74", desc:"우연의 1.6배+ — 곁가지"},
  {i:4, name:"보강 다리",    col:"#e0483f", desc:"떨어뜨리지 않으려고 건 최소 연결"},
];
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
const N = D.nodes, E = D.edges, F = D.flow;
let W=0, H=0, DPR=Math.min(devicePixelRatio||1, 2);

// ── 레이아웃
const COLW = 262, PADX = 195, PADY = 138, ROWMIN = 21;
let maxRows = Math.max(...F.map(f=>f.n));
let layH = Math.max(760, maxRows*ROWMIN);
const collapsed = new Array(F.length).fill(false);

function layout(){
  const colX = [];
  let x = PADX;
  for(let i=0;i<F.length;i++){ colX.push(x); x += collapsed[i] ? 96 : COLW; }
  D.colX = colX; D.totalW = x + PADX;
  for(const n of N){
    const cnt = F[n.L].n;
    const span = collapsed[n.L] ? 0 : Math.min(layH, cnt*ROWMIN);
    n.x = colX[n.L];
    n.y = PADY + (cnt<=1 ? span/2 : (n.k/(cnt-1))*span) + (layH-span)/2;
    n.r = collapsed[n.L] ? 0 : Math.max(2.1, Math.min(7.5, 1.7+Math.log10(1+n.p)*1.55));
  }
  D.totalH = PADY + layH + 90;
}
layout();

// ── 뷰
let vx=0, vy=0, vs=1;
function fit(){
  if(W<2||H<2) return;
  vs = Math.min(W/D.totalW, H/D.totalH)*0.94;
  vx = (W - D.totalW*vs)/2; vy = (H - D.totalH*vs)/2;
  draw();
}
function toS(p){ return {x:p.x*vs+vx, y:p.y*vs+vy}; }

// ── 상태
const tierOn = [true,true,true,false,true];
const bigOn = {};
Object.keys(D.pal).forEach(k=>bigOn[k]=true);
let wmin=0, showLbl=true, glow=true, fwdOnly=false;
let hover=null, lock=null;

// 인접
const ADJ = N.map(()=>[]);
E.forEach((e,i)=>{ ADJ[e[0]].push(i); ADJ[e[1]].push(i); });

// ── 성능 골격(260728) — 그림은 그대로, 그리는 횟수·낭비만 줄인다
//  ① sched = rAF 병합(mousemove 폭주 → 프레임당 1회)
//  ② visEdges = 가시 간선 캐시(7천 간선 × 티어 5회 스캔을 필터 바뀔 때만)
//  ③ 스냅샷 = 정지 화면 비트맵 저장 → 같은 화면 재요청은 복원, 팬·줌 중엔 밀어 보여주고 멈추면 정밀 재렌더
let _rev=0, _visE=null;
function inval(){ _rev++; _visE=null; }
function visEdges(){ if(_visE) return _visE;
  _visE=[[],[],[],[],[]];
  for(let i=0;i<E.length;i++){ const e=E[i]; if(edgeVisible(e)) _visE[e[2]].push(i); }
  return _visE; }
const _off=document.createElement('canvas');
let _snap=false, _snapKey='', _sv=null;
const _vKey=()=>_rev+'|'+vx.toFixed(2)+'|'+vy.toFixed(2)+'|'+vs.toFixed(4)+'|'+W+'x'+H;
const _snapRevOk=()=>_snap && _sv && _snapKey.split('|')[0]===String(_rev) && _off.width===cv.width;
function _takeSnap(){
  if(_off.width!==cv.width||_off.height!==cv.height){ _off.width=cv.width; _off.height=cv.height; }
  _off.getContext('2d').drawImage(cv,0,0); _snap=true; _snapKey=_vKey(); _sv={vx,vy,vs}; }
function _restore(){ ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,cv.width,cv.height); ctx.drawImage(_off,0,0); }
function _blitView(){                       // 스냅샷을 현재 뷰로 밀어서 그린다(팬=동일 픽셀 이동 · 줌=잠깐 근사)
  ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,W,H);
  const g=ctx.createRadialGradient(W*0.5,H*0.45,0,W*0.5,H*0.45,Math.max(W,H)*0.75);
  g.addColorStop(0,'#0a1122'); g.addColorStop(1,'#04060d'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  const k=vs/_sv.vs;
  ctx.drawImage(_off,0,0,_off.width,_off.height, vx-_sv.vx*k, vy-_sv.vy*k, W*k, H*k); }
let _dq=false, _stT=null;
function sched(){ if(_dq) return; _dq=true;
  requestAnimationFrame(()=>{ _dq=false;
    const f=lock!=null?lock:hover;
    if(f==null && _snap && _snapKey===_vKey() && _off.width===cv.width) _restore(); else draw(); }); }
function schedMotion(){                     // 드래그·휠 중 전용 — 멈추면 120ms 뒤 정밀 재렌더
  if(!_dq){ _dq=true;
    requestAnimationFrame(()=>{ _dq=false;
      const f=lock!=null?lock:hover;
      if(f==null && _snapRevOk()) _blitView(); else draw(); }); }
  clearTimeout(_stT); _stT=setTimeout(()=>{ const f=lock!=null?lock:hover; if(f==null) draw(); else sched(); }, 120); }

function edgeVisible(e){
  if(!tierOn[e[2]]) return false;
  if(e[3] < wmin) return false;
  const a=N[e[0]], b=N[e[1]];
  if(!bigOn[a.code] || !bigOn[b.code]) return false;
  if(collapsed[a.L] || collapsed[b.L]) return false;
  if(fwdOnly && a.L > b.L) return false;
  return true;
}
function nodeVisible(n){ return bigOn[n.code] && !collapsed[n.L]; }

// ── 그리기
function curve(a,b){
  const A=toS(a), B=toS(b);
  const dx = B.x-A.x, dy = B.y-A.y;
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  if(Math.abs(dx) < 6){                      // 같은 층 → 옆으로 부풀린다
    const bow = Math.min(190, 42+Math.abs(dy)*0.42)*vs;
    ctx.bezierCurveTo(A.x+bow, A.y+dy*0.18, B.x+bow, B.y-dy*0.18, B.x, B.y);
  }else{
    const c = Math.abs(dx)*0.55;
    ctx.bezierCurveTo(A.x+c, A.y, B.x-c, B.y, B.x, B.y);
  }
  ctx.stroke();
}

let _fitted=false;
function draw(){
  if(W<2||H<2) return;                 // 패널이 아직 안 떠서 크기가 0인 상태
  if(!_fitted){ _fitted=true; fit(); return; }
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,W,H);
  // 배경 성운
  const g = ctx.createRadialGradient(W*0.5,H*0.45,0,W*0.5,H*0.45,Math.max(W,H)*0.75);
  g.addColorStop(0,'#0a1122'); g.addColorStop(1,'#04060d');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  const foc = lock!=null ? lock : hover;
  const focSet = foc!=null ? new Set(ADJ[foc].flatMap(i=>[E[i][0],E[i][1]])) : null;

  // 층 기둥
  ctx.save();
  for(let i=0;i<F.length;i++){
    const x = D.colX[i]*vs+vx;
    const y0 = PADY*vs+vy-20*vs, y1 = (PADY+layH)*vs+vy+16*vs;
    ctx.strokeStyle='rgba(40,60,95,.5)'; ctx.lineWidth=1;
    ctx.setLineDash([3,7]); ctx.beginPath();
    ctx.moveTo(x,y0); ctx.lineTo(x,y1); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();

  // 시냅스
  ctx.lineCap='round';
  if(glow) ctx.globalCompositeOperation='lighter';
  const order = [3,2,1,4,0];               // 약한 것부터 깔고 센 것을 위에
  const VE = visEdges();                    // 캐시된 가시 간선(필터 바뀔 때만 재계산)
  for(const t of order){
    if(!tierOn[t]) continue;
    const C = TIERS[t].col;
    for(const i of VE[t]){
      const e=E[i];
      const inFoc = foc==null || e[0]===foc || e[1]===foc;
      if(foc!=null && !inFoc) continue;
      let a = foc!=null ? 0.85 : (t===0?0.42:(t===1?0.30:(t===2?0.17:(t===3?0.07:0.34))));
      ctx.strokeStyle = C;
      ctx.globalAlpha = a;
      ctx.lineWidth = Math.max(0.5, (t===0? 1.5 : 0.55+e[3]*1.5) * (foc!=null?1.7:1) * Math.min(1.6,vs));
      if(t===4){ ctx.setLineDash([4,4]); }
      curve(N[e[0]], N[e[1]]);
      if(t===4) ctx.setLineDash([]);
    }
  }
  ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';

  // 뉴런
  for(let ni=0;ni<N.length;ni++){
    const n=N[ni];
    if(!nodeVisible(n)) continue;
    const P=toS(n), r=Math.max(1.6, n.r*vs);
    const dim = focSet && !focSet.has(ni) && ni!==foc;
    ctx.globalAlpha = dim ? 0.13 : 1;
    if(!dim){
      ctx.beginPath(); ctx.arc(P.x,P.y,r*2.5,0,6.284);
      ctx.fillStyle = n.col+'22'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(P.x,P.y,r,0,6.284);
    ctx.fillStyle = n.col; ctx.fill();
    if(n.d==='공백'){ ctx.strokeStyle='#e0483f'; ctx.lineWidth=1.2; ctx.stroke(); }
    ctx.globalAlpha=1;
  }

  // 이름 — 층마다 화면 간격을 재서, 겹칠 층은 접어둔다(포커스된 것만 남김)
  const gapOK = F.map((f,i)=>{
    const span = collapsed[i] ? 0 : Math.min(layH, f.n*ROWMIN);
    return f.n<=1 ? 999 : (span/(f.n-1))*vs;
  });
  if(showLbl){
    ctx.font = `${Math.max(8.5, 10.5*Math.min(1.35,vs))}px "Pretendard","Malgun Gothic",sans-serif`;
    ctx.textBaseline='middle';
    for(let ni=0;ni<N.length;ni++){
      const n=N[ni];
      if(!nodeVisible(n)) continue;
      const dim = focSet && !focSet.has(ni) && ni!==foc;
      const near = foc!=null && (ni===foc || (focSet && focSet.has(ni)));
      if(gapOK[n.L] < 12.5 && !near) continue;    // 겹칠 자리면 생략 — 줌인하면 나타난다
      if(dim && vs<1.1) continue;
      const P=toS(n);
      ctx.globalAlpha = dim?0.16:(foc!=null&&(ni===foc)?1:0.82);
      ctx.fillStyle = (foc!=null&&ni===foc)?'#fff':'#9fb6d4';
      ctx.textAlign='left';
      ctx.fillText(n.n, P.x + Math.max(3,n.r*vs)+5, P.y);
      ctx.globalAlpha=1;
    }
  }

  // 층 머리
  for(let i=0;i<F.length;i++){
    const x=D.colX[i]*vs+vx, y=(PADY-74)*vs+vy;
    const f=F[i];
    const k=Math.min(1.2,vs), bw=176*k, bh=52*k;
    ctx.strokeStyle = collapsed[i]?'rgba(60,78,110,.55)':'rgba(90,140,220,.42)';
    ctx.lineWidth=1; ctx.fillStyle='rgba(8,14,28,.72)';
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x-14, y-7, bw, bh, 5*k);
    else ctx.rect(x-14, y-7, bw, bh);
    ctx.fill(); ctx.stroke();
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.font=`bold ${Math.max(10,12.5*Math.min(1.2,vs))}px "Pretendard",sans-serif`;
    ctx.fillStyle = collapsed[i] ? '#4b5c74' : '#7fb0ff';
    ctx.fillText(f.name, x-8, y);
    ctx.font=`${Math.max(9,11*Math.min(1.2,vs))}px "Pretendard",sans-serif`;
    ctx.fillStyle='#5b6f8f'; ctx.fillText('개념: '+f.n, x-8, y+17*Math.min(1.2,vs));
    ctx.fillStyle = collapsed[i]?'#5b6f8f':'#e8508f';
    ctx.fillText(f.sub+'  (클릭)', x-8, y+32*Math.min(1.2,vs));
    f._hit = {x:x-14, y:y-7, w:bw, h:bh};
  }
  if(foc==null) _takeSnap();               // 정지 화면 저장 — 다음 같은 화면 요청은 복원으로 끝
}

// ── 히트 테스트
function pick(mx,my){
  let best=null, bd=15;
  for(let i=0;i<N.length;i++){
    const n=N[i]; if(!nodeVisible(n)) continue;
    const P=toS(n), d=Math.hypot(P.x-mx,P.y-my);
    if(d < Math.max(7, n.r*vs+5) && d<bd){ bd=d; best=i; }
  }
  return best;
}

// ── 정보 패널
const info=document.getElementById('info');
function showInfo(i){
  if(i==null){ info.style.display='none'; return; }
  const n=N[i];
  const mine = ADJ[i].map(k=>E[k]).filter(edgeVisible);
  const grp = [[],[],[],[],[]];
  for(const e of mine){
    const other = e[0]===i ? e[1] : e[0];
    grp[e[2]].push({o:other, w:e[3], k:e[4], lf:e[5], p:e[6], out:e[0]===i});
  }
  let h = `<h2>${n.n}</h2><div class="path">${n.big} › ${n.mid} · ${F[n.L].name}</div>`;
  if(n.q) h += `<div class="def">${n.q}</div>`;
  else h += `<div class="def" style="border-color:#e0483f;color:#e8a0a0">정의 공백 — 저자가 «무엇이다»라고 말한 문장이 없다<span class="who">근거는 ${n.p.toLocaleString()}문단 있다</span></div>`;
  h += `<div class="row"><span class="nm">문단</span><span class="meta">${n.p.toLocaleString()}</span></div>`;
  h += `<div class="row"><span class="nm">저자</span><span class="meta">${n.au}명</span></div>`;
  h += `<div class="row"><span class="nm">시냅스</span><span class="meta">${n.deg}개</span></div>`;
  for(const t of [0,1,2,3,4]){
    if(!grp[t].length) continue;
    grp[t].sort((a,b)=>b.w-a.w || b.lf-a.lf);
    h += `<div class="sec" style="color:${TIERS[t].col}">${TIERS[t].name} — ${grp[t].length}</div>`;
    for(const g of grp[t].slice(0,26)){
      const o=N[g.o];
      const meta = t===0 ? `${g.out?'→':'←'} ${g.k} · ${g.w}`
                         : `×${(+g.lf).toFixed(1)} · ${g.p}문단`;
      h += `<div class="row"><span class="nm" style="color:${o.col}">●</span>`+
           `<span class="nm">${o.n}</span><span class="meta">${o.code} · ${meta}</span></div>`;
    }
    if(grp[t].length>26) h += `<div class="row"><span class="meta">… 외 ${grp[t].length-26}개</span></div>`;
  }
  info.innerHTML=h; info.style.display='block';
}

// ── 이벤트
const tip=document.getElementById('tip');
let dragging=false, sx=0, sy=0, moved=false;
cv.addEventListener('mousedown',e=>{dragging=true;moved=false;sx=e.clientX;sy=e.clientY;cv.classList.add('drag')});
addEventListener('mouseup',()=>{dragging=false;cv.classList.remove('drag')});
cv.addEventListener('mousemove',e=>{
  if(dragging){
    const dx=e.clientX-sx, dy=e.clientY-sy;
    if(Math.abs(dx)+Math.abs(dy)>3) moved=true;
    vx+=dx; vy+=dy; sx=e.clientX; sy=e.clientY; schedMotion(); return;
  }
  const i=pick(e.clientX,e.clientY);
  if(i!==hover){ hover=i; sched(); if(lock==null) showInfo(i); }
  if(i!=null){
    const n=N[i];
    tip.style.display='block';
    tip.style.left=(e.clientX+13)+'px'; tip.style.top=(e.clientY+13)+'px';
    tip.innerHTML=`<b>${n.n}</b> <span style="color:#6d82a3">${n.code}·${n.mid}</span><br>`+
      `<span style="color:#6d82a3">문단 ${n.p.toLocaleString()} · 시냅스 ${n.deg}</span>`;
  } else tip.style.display='none';
});
cv.addEventListener('click',e=>{
  if(moved) return;
  for(let i=0;i<F.length;i++){
    const r=F[i]._hit;
    if(r && e.clientX>=r.x && e.clientX<=r.x+r.w && e.clientY>=r.y && e.clientY<=r.y+r.h){
      collapsed[i]=!collapsed[i]; layout(); inval(); sched(); return;
    }
  }
  const i=pick(e.clientX,e.clientY);
  lock = (i!=null && i!==lock) ? i : null;
  showInfo(lock!=null?lock:hover); sched();
});
cv.addEventListener('wheel',e=>{
  e.preventDefault();
  const f=Math.exp(-e.deltaY*0.0013), nx=Math.max(0.12,Math.min(7,vs*f));
  vx = e.clientX-(e.clientX-vx)*(nx/vs); vy = e.clientY-(e.clientY-vy)*(nx/vs);
  vs=nx; schedMotion();
},{passive:false});

// ── 컨트롤
const tierBox=document.getElementById('tierBox');
TIERS.forEach(t=>{
  const cnt=E.filter(e=>e[2]===t.i).length;
  const l=document.createElement('label');
  l.innerHTML=`<input type="checkbox" ${tierOn[t.i]?'checked':''}>
    <span class="sw" style="background:${t.col}"></span>${t.name}<span class="cnt">${cnt}</span>`;
  l.title=t.desc;
  l.querySelector('input').onchange=ev=>{tierOn[t.i]=ev.target.checked;inval();sched()};
  tierBox.appendChild(l);
});
const bigBox=document.getElementById('bigBox');
const bigNames={};
N.forEach(n=>bigNames[n.code]=n.big);
Object.keys(D.pal).sort().forEach(code=>{
  if(!bigNames[code]) return;
  const cnt=N.filter(n=>n.code===code).length;
  const l=document.createElement('label');
  l.innerHTML=`<input type="checkbox" checked><span class="sw" style="background:${D.pal[code]}"></span>${bigNames[code].replace(/^S\d+ /,'')}<span class="cnt">${cnt}</span>`;
  l.querySelector('input').onchange=ev=>{bigOn[code]=ev.target.checked;inval();sched()};
  bigBox.appendChild(l);
});
document.getElementById('nN').textContent=N.length;
document.getElementById('eN').textContent=E.length.toLocaleString();
document.getElementById('wmin').oninput=e=>{wmin=+e.target.value;
  document.getElementById('wv').textContent=wmin.toFixed(2);inval();sched()};
document.getElementById('lbl').onchange=e=>{showLbl=e.target.checked;inval();sched()};
document.getElementById('glow').onchange=e=>{glow=e.target.checked;inval();sched()};
document.getElementById('fwd').onchange=e=>{fwdOnly=e.target.checked;inval();sched()};
document.getElementById('fit').onclick=fit;
document.getElementById('reset').onclick=()=>{lock=null;hover=null;showInfo(null);sched()};

function resize(){
  W=innerWidth;H=innerHeight;
  cv.width=W*DPR;cv.height=H*DPR;cv.style.width=W+'px';cv.style.height=H+'px';
  _snap=false; inval();
  draw();
}
addEventListener('resize',()=>{resize();});
resize(); fit();
</script></body></html>
"""

out = HERE / "사주신경망.html"
out.write_text(TPL.replace("__DATA__", json.dumps(payload, ensure_ascii=False)),
               encoding="utf-8")
print(f"→ {out}  ({out.stat().st_size/1024:.0f}KB)")
print(f"노드 {len(nodes)} · 간선 {len(edges)}")
for i, f in enumerate(FLOW):
    print(f"  {f[0]:<9} {LAY_N[i]:>3}개  {f[2]}")
