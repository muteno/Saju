# -*- coding: utf-8 -*-
"""
관계도 정본 표 — **모든 층의 간선을 한 표로.** 이게 지도의 본체다.

═══ 왜 이 파일이 정본인가 (운영자 260726) ═══
  "그 맵이 사실 그거 하나만 있으면 앱을 복제할 수 있을정도로 만들어야돼.
   **그거 자체가 알고리즘이나 데이터의 총칭이야.**"
  "지금 그 관계도 모인 표 하나 주고, 그거 핵심으로 따로 보여지게해줘"

  그동안 간선은 4개 층(L1/L1½/L2/L3)에 흩어져 있었고, «왜»는 또 다른 파일
  (근거사슬.jsonl)에 있었다. 보려면 세 파일을 맞춰 봐야 했다.
  → **한 줄 = 한 관계.** 조건·부호·무게·출처·이유가 그 줄 안에 다 있다.

═══ 한 줄에 담기는 것 ═══
  A ─[관계]→ B   ·  조건  ·  부호  ·  무게  ·  출처 수  ·  왜(근거사슬)  ·  근거문
  · **조건**  : 언제 이 관계가 켜지는가 (없으면 «항상»)
  · **왜**    : L1 공리 경로로 이유를 댈 수 있나. 못 대면 **낭설후보**
  · **출처**  : 몇 개의 서로 다른 입에서 나왔나 (1곳이면 «그 사람 견해»일 수 있다)

═══ 이 표가 정직해야 하는 이유 ═══
  운영자: "이유를 모르면 연결할수가 없어 낭설임(그런식으로 알려주는 정제본은 나중에 싹 쳐낼거야)"
  → **낭설후보를 숨기지 않는다.** 빨간 칸으로 보여 주고, 필터로 그것만 볼 수 있게 한다.
    쳐내는 건 사람이 한다. 표는 «무엇을 쳐낼지»를 보여줄 뿐이다.

출력: 관계도.html (단독 실행 · 검색·필터·정렬) · data/관계도.csv (엑셀)
"""
import json, html, sys
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
KST = timezone(timedelta(hours=9))
sys.path.insert(0, str(HERE))
from 작업내역 import 단계          # noqa: E402


def jl(n):
    p = DATA / n
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()] \
        if p.exists() else []


E = jl("링크망.jsonl")
lay = {r["concept"]: r for r in jl("node_layers.jsonl")}
CH = {}
for r in jl("근거사슬.jsonl"):
    CH[(r["a"], r["b"])] = r
    CH.setdefault((r["b"], r["a"]), r)

LAYER_ORD = {"L1결정론": 0, "L1½조건부": 1, "L2밀착": 2, "L3보강": 3}
LAYER_NOTE = {
    "L1결정론": "명리 규칙 — 항상 참. 판단은 이 위로만 흐른다.",
    "L1½조건부": "조건이 설 때만 흐른다. 조건이 바뀌면 결과가 바뀐다.",
    "L2밀착": "같은 문단에 우연보다 자주 붙어 나온다. 방향도 조건도 없다.",
    "L3보강": "임계 미달이지만 노드를 망에 붙이려고 건 최소 다리. 근거로 쓰지 말 것.",
}
# ★260728 — 판정 어휘를 `판정어.py` 한 곳으로 갈라냈다.
#   같은 표가 여기에만 있고 `build_brain.py`엔 없어서, 발현 157건이
#   정본 표에선 「인과」인데 앱 두뇌 팩에선 `null`로 나갔다(두 벌 장부).
from 판정어 import L1KIND, VERDICT_NOTE  # noqa: E402
rows = []
for e in E:
    a, b = e["a"], e["b"]
    ch = CH.get((a, b))
    if e["층"] == "L1결정론":
        v = L1KIND.get(e["kind"], "공리")     # L1은 바탕이지 «검증 대상»이 아니다
    else:
        v = ch["판정"] if ch else "미검증"
    why = " · ".join(h["고리"] for h in ch["사슬"]) if (ch and ch.get("사슬")) else ""
    cond = e.get("조건") or []
    if isinstance(cond, str):
        cond = [cond]
    rows.append({
        "층": e["층"], "A": a, "관계": e["kind"], "B": b,
        "방향": e.get("dir", ""), "부호": e.get("polarity") or "",
        # ★260728 — 부호와 «효과»는 다른 축이다. 같은 '+'라도 역마→이동은 촉진이고
        #   천을귀인→구설·송사는 해소다. 한 칸에 섞으면 합산이 조용히 틀린다.
        "효과": e.get("effect") or "",
        "조건": " · ".join(cond),
        # ★«있으면»/«없으면». 이 칸이 없으면 읽는 사람이 방향을 거꾸로 읽는다(260726 페이블 감사)
        "조건극성": e.get("조건극성", ""), "무게": e.get("weight"),
        "등급": e.get("등급", ""), "표본": e.get("표본") or e.get("동시문단") or "",
        "출처수": e.get("출처수", ""), "교차확인": "✅" if e.get("교차확인") else "",
        "왜": v, "사슬": why,
        "근거": (e.get("source") or "")[:160],
        "대주제A": lay.get(a, {}).get("big", ""), "대주제B": lay.get(b, {}).get("big", ""),
        "간선id": e.get("간선id", ""),
    })
rows.sort(key=lambda r: (LAYER_ORD.get(r["층"], 9), -(r["무게"] or 0), r["A"]))

# ── CSV
cols = ["층", "A", "관계", "B", "방향", "조건", "조건극성", "부호", "효과", "무게", "등급", "표본",
        "출처수", "교차확인", "왜", "사슬", "근거", "대주제A", "대주제B", "간선id"]


def csvq(x):
    s = "" if x is None else str(x)
    return '"' + s.replace('"', '""') + '"'


(DATA / "관계도.csv").write_text(
    "\n".join([",".join(cols)] + [",".join(csvq(r[c]) for c in cols) for r in rows]),
    encoding="utf-8-sig")

# ── 통계
byl = Counter(r["층"] for r in rows)
byv = Counter(r["왜"] for r in rows)
byk = Counter(r["관계"] for r in rows)
nn = len({r["A"] for r in rows} | {r["B"] for r in rows})
now = datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")

# ── 뉴런 뷰용 노드 (대주제 = 색, 차수 = 크기)
deg = Counter()
for r in rows:
    deg[r["A"]] += 1; deg[r["B"]] += 1
BIGS = sorted({v.get("big", "") for v in lay.values()})
nodes = [{"id": c, "big": v.get("big", ""), "mid": v.get("mid", ""), "deg": deg.get(c, 0)}
         for c, v in lay.items()]

J = json.dumps(rows, ensure_ascii=False)
JN = json.dumps(nodes, ensure_ascii=False)
JB = json.dumps(BIGS, ensure_ascii=False)
esc = html.escape

page = f"""<!doctype html><html lang="ko"><meta charset="utf-8">
<title>사주 관계도 — 정본 표</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{{--bg:#0f1115;--fg:#e8eaed;--dim:#9aa0a6;--line:#2a2f3a;--card:#161a22;
 --l1:#7cc4ff;--l15:#ffc978;--l2:#8fd18f;--l3:#b0a0d0;--bad:#ff6b6b;--ok:#5fd39a}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--fg);font:14px/1.55 -apple-system,"Segoe UI",
 "Malgun Gothic",sans-serif}}
header{{padding:18px 22px 10px;border-bottom:1px solid var(--line);position:sticky;top:0;
 background:var(--bg);z-index:20}}
h1{{margin:0 0 4px;font-size:19px;letter-spacing:-.3px}}
.sub{{color:var(--dim);font-size:12.5px}}
.stats{{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 6px}}
.chip{{background:var(--card);border:1px solid var(--line);border-radius:14px;
 padding:5px 11px;font-size:12px;cursor:pointer;user-select:none}}
.chip:hover{{border-color:#4a5262}}
.chip.on{{background:#243040;border-color:var(--l1);color:#fff}}
.chip b{{font-weight:700}}
.ctl{{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}}
input,select{{background:var(--card);border:1px solid var(--line);color:var(--fg);
 border-radius:8px;padding:7px 10px;font:inherit;font-size:13px}}
input#q{{min-width:260px;flex:1}}
table{{width:100%;border-collapse:collapse;font-size:13px}}
th{{position:sticky;top:0;background:#12161e;text-align:left;padding:9px 10px;
 border-bottom:1px solid var(--line);font-weight:600;font-size:12px;color:var(--dim);
 cursor:pointer;white-space:nowrap}}
th:hover{{color:var(--fg)}}
td{{padding:8px 10px;border-bottom:1px solid #1c212b;vertical-align:top}}
tr:hover td{{background:#151a24}}
.lay{{font-size:11px;padding:2px 7px;border-radius:9px;white-space:nowrap;font-weight:600}}
.L1결정론{{background:#12304a;color:var(--l1)}}
.L1½조건부{{background:#3d2f14;color:var(--l15)}}
.L2밀착{{background:#16301c;color:var(--l2)}}
.L3보강{{background:#2a2440;color:var(--l3)}}
.node{{font-weight:600}}
.k{{color:var(--dim);font-size:12px}}
.cond{{color:var(--l15);font-size:12px}}
.why-낭설후보{{color:var(--bad);font-weight:700}}
.why-사슬있음,.why-공리직결,.why-공리{{color:var(--ok)}}
.why-파생{{color:var(--l1)}}
.why-인과{{color:#ff9ecd;font-weight:700}}
.why-구조만{{color:var(--l15)}}
.why-목차,.why-미검증{{color:#5a6070}}
.chain{{color:var(--dim);font-size:11.5px;max-width:420px}}
.src{{color:#7c8697;font-size:11.5px;max-width:330px}}
.bar{{display:inline-block;height:6px;border-radius:3px;background:var(--l1);vertical-align:middle}}
#wrap{{padding:0 22px 60px}}
#n{{color:var(--dim);font-size:12.5px;margin:10px 0}}
.note{{background:var(--card);border-left:3px solid var(--l15);padding:10px 14px;
 margin:12px 0;font-size:12.5px;color:#c8cdd6;border-radius:0 8px 8px 0}}
#cv{{width:100%;height:74vh;background:#0b0d12;border:1px solid var(--line);
 border-radius:10px;cursor:grab;display:block}}
</style>
<header>
<h1>사주 관계도 — 정본 표</h1>
<div class="sub">한 줄 = 한 관계. 조건·부호·무게·출처·<b>왜</b>가 그 줄 안에 다 있다.
 · 개념 {nn} · 간선 <b>{len(rows):,}</b> · {now}</div>
<div class="stats" id="lay"></div>
<div class="stats" id="ver"></div>
<div class="ctl">
 <input id="q" placeholder="개념·조건·근거 검색 (예: 원진, 신약, 무정지극)">
 <select id="kind"><option value="">관계 전체</option></select>
 <select id="big"><option value="">대주제 전체</option></select>
 <label class="chip"><input type="checkbox" id="onlybad" style="min-width:auto"> 낭설후보만</label>
 <span style="flex:1"></span>
 <span class="chip mode on" data-m="table">&#128203; 표</span>
 <span class="chip mode" data-m="graph">&#129504; 뉴런</span>
</div>
<div id="n"></div>
</header>
<div id="wrap">
<div class="note">
<b>층</b> — L1 결정론(항상 참) · L1½ 조건부(조건이 설 때만) · L2 밀착(같이 나온다, 방향·조건 없음) · L3 보강(약한 다리).<br>
<b>왜</b> — 그 관계의 이유를 L1 공리 경로로 댈 수 있는가. <span class="why-낭설후보">낭설후보</span>는 못 댄다는 뜻이다.
지우지 않고 <b>보여준다</b> — 쳐내는 건 사람이 한다.
</div>
<div id="gwrap" style="display:none">
 <div class="ctl" style="margin:6px 0 10px">
   <span class="k">색:</span>
   <span class="chip col on" data-c="big">대주제</span>
   <span class="chip col" data-c="why">왜(이유 유무)</span>
   <span class="chip col" data-c="layer">층</span>
   <label class="chip"><input type="checkbox" id="lbl" checked style="min-width:auto"> 이름</label>
   <span class="chip" id="re">재배치</span>
   <span class="k" id="ginfo"></span>
 </div>
 <canvas id="cv"></canvas>
 <div class="note" style="margin-top:10px">
  <b>휠</b> 확대 · <b>드래그</b> 이동 · <b>노드 클릭</b> = 그 개념으로 표 검색.
  위 필터(층·왜·검색)가 <b>그대로 적용</b>된다 — 「낭설후보만」을 켜면
  <b>이유를 못 대는 관계만으로 이루어진 망</b>이 보인다.
 </div>
</div>
<table id="tbl"><thead><tr>
<th data-s="층">층</th><th data-s="A">A</th><th data-s="관계">관계</th><th data-s="B">B</th>
<th data-s="조건">조건</th><th data-s="부호">부호</th><th data-s="효과">효과</th><th data-s="무게">무게</th>
<th data-s="출처수">출처</th><th data-s="왜">왜</th><th>사슬 / 근거</th>
</tr></thead><tbody id="tb"></tbody></table>
</div>
<script>
const R = {J};
const LN = {json.dumps(LAYER_NOTE, ensure_ascii=False)};
const VN = {json.dumps(VERDICT_NOTE, ensure_ascii=False)};
let fL=new Set(), fV=new Set(), sortK="", sortD=1;

function count(k){{const m={{}};R.forEach(r=>m[r[k]]=(m[r[k]]||0)+1);return m}}
function chips(id,key,set){{
  const m=count(key), el=document.getElementById(id);
  el.innerHTML=Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([k,v])=>
    `<span class="chip" data-k="${{k}}" title="${{(id=='lay'?LN:VN)[k]||''}}">${{k}} <b>${{v.toLocaleString()}}</b></span>`).join("");
  el.querySelectorAll(".chip").forEach(c=>c.onclick=()=>{{
    const k=c.dataset.k; set.has(k)?set.delete(k):set.add(k);
    c.classList.toggle("on"); draw();
  }});
}}
function fill(id,key){{
  const m=count(key), s=document.getElementById(id);
  Object.keys(m).sort().forEach(k=>{{if(k)s.insertAdjacentHTML("beforeend",`<option>${{k}}</option>`)}});
}}
function draw(){{
  const q=document.getElementById("q").value.trim().toLowerCase();
  const kd=document.getElementById("kind").value, bg=document.getElementById("big").value;
  const ob=document.getElementById("onlybad").checked;
  let d=R.filter(r=>{{
    if(fL.size&&!fL.has(r["층"]))return false;
    if(fV.size&&!fV.has(r["왜"]))return false;
    if(kd&&r["관계"]!==kd)return false;
    if(bg&&r["대주제A"]!==bg&&r["대주제B"]!==bg)return false;
    if(ob&&r["왜"]!=="낭설후보")return false;
    if(q){{const s=(r.A+r.B+r["조건"]+r["근거"]+r["사슬"]+r["관계"]).toLowerCase();
      if(!s.includes(q))return false}}
    return true;
  }});
  if(sortK)d.sort((a,b)=>{{const x=a[sortK],y=b[sortK];
    return (typeof x==="number"?x-y:String(x).localeCompare(String(y),"ko"))*sortD}});
  document.getElementById("n").textContent=`${{d.length.toLocaleString()}}건 표시 / 전체 ${{R.length.toLocaleString()}}건`;
  if(document.getElementById("gwrap").style.display!=="none"){{ graphData(d); return; }}
  const cap=d.slice(0,4000);
  document.getElementById("tb").innerHTML=cap.map(r=>`<tr>
   <td><span class="lay ${{r["층"]}}">${{r["층"]}}</span></td>
   <td class="node">${{r.A}}</td>
   <td class="k">${{r["관계"]}} ${{r["방향"]==="→"?"→":""}}</td>
   <td class="node">${{r.B}}</td>
   <td class="cond">${{r["조건"]||'<span style="color:#4a5262">—</span>'}}${{
       r["조건극성"]==="부재"?'<b style="color:#ff9ecd"> ·없을때</b>':''}}</td>
   <td>${{r["부호"]||""}}</td>
   <td>${{r["효과"]?(r["효과"]==="해소"?'<b style="color:#7fd6a0">해소</b>':'<b style="color:#ffb36b">촉진</b>'):""}}</td>
   <td><span class="bar" style="width:${{Math.round((r["무게"]||0)*38)}}px"></span> ${{r["무게"]??""}}</td>
   <td>${{r["출처수"]!==""?r["출처수"]+"곳":""}} ${{r["교차확인"]||""}}</td>
   <td class="why-${{r["왜"]}}" title="${{VN[r["왜"]]||''}}">${{r["왜"]}}</td>
   <td><div class="chain">${{r["사슬"]||""}}</div><div class="src">${{r["근거"]||""}}</div></td>
  </tr>`).join("") + (d.length>cap.length?
    `<tr><td colspan="10" style="color:#9aa0a6;padding:14px">… ${{(d.length-cap.length).toLocaleString()}}건 더 있다. 검색·필터로 좁혀라 (표 전체는 data/관계도.csv).</td></tr>`:"");
}}

// ══ 뉴런 뷰 — 표와 **같은 데이터·같은 필터**를 그래프로 본다 ══════════════
const NODES = {JN}, BIGS = {JB};
const PAL=["#7cc4ff","#ffc978","#8fd18f","#ff9ecd","#b0a0d0","#ffd6a5","#9bf6ff",
           "#caffbf","#ffadad","#bdb2ff","#a0c4ff","#fdffb6","#ffc6ff","#8ecae6","#e9c46a"];
const BC={{}}; BIGS.forEach((b,i)=>BC[b]=PAL[i%PAL.length]);
const WC={{"낭설후보":"#ff5f5f","구조만":"#ffc978","사슬있음":"#5fd39a","공리직결":"#5fd39a",
          "공리":"#4a90d9","파생":"#7cc4ff","인과":"#ff9ecd","목차":"#454c5a","미검증":"#333a46"}};
const LC={{"L1결정론":"#7cc4ff","L1½조건부":"#ffc978","L2밀착":"#5a8f5a","L3보강":"#b0a0d0"}};
const P={{}};
let colorBy="big", view={{x:0,y:0,k:1}}, drag=null, hover=null, gE=[], gN=[], raf=null;
const cv=document.getElementById("cv"), cx=cv.getContext("2d");

function sizeCanvas(){{
  const d=window.devicePixelRatio||1, r=cv.getBoundingClientRect();
  cv.width=Math.max(300,r.width*d); cv.height=Math.max(300,r.height*d);
}}
function layout(){{
  // 대주제별 원형 클러스터에서 시작 — 무작위보다 훨씬 빨리 안정된다
  const W=cv.width,H=cv.height,R=Math.min(W,H)*0.34;
  BIGS.forEach((b,i)=>{{
    const th=i/BIGS.length*Math.PI*2, ox=W/2+Math.cos(th)*R, oy=H/2+Math.sin(th)*R;
    const grp=NODES.filter(n=>n.big===b);
    grp.forEach((n,j)=>{{
      const a=j/Math.max(1,grp.length)*Math.PI*2, rr=26+Math.sqrt(grp.length)*10;
      P[n.id]={{x:ox+Math.cos(a)*rr,y:oy+Math.sin(a)*rr,vx:0,vy:0}};
    }});
  }});
}}
function step(){{
  const W=cv.width,H=cv.height,n=gN.length;
  for(let i=0;i<n;i++){{
    const a=P[gN[i].id]; if(!a)continue;
    for(let j=i+1;j<n;j++){{
      const b=P[gN[j].id]; if(!b)continue;
      let dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy||1;
      if(d2>120000)continue;
      const d=Math.sqrt(d2),f=620/d2;
      a.vx-=dx/d*f;a.vy-=dy/d*f;b.vx+=dx/d*f;b.vy+=dy/d*f;
    }}
  }}
  for(const e of gE){{
    const a=P[e.A],b=P[e.B]; if(!a||!b)continue;
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
    const f=(d-100)*0.0015*(0.35+(e["무게"]||0.3));
    a.vx+=dx/d*f;a.vy+=dy/d*f;b.vx-=dx/d*f;b.vy-=dy/d*f;
  }}
  for(const nd of gN){{
    const p=P[nd.id]; if(!p)continue;
    p.vx+=(W/2-p.x)*0.0010; p.vy+=(H/2-p.y)*0.0010;
    p.vx*=0.85; p.vy*=0.85; p.x+=p.vx; p.y+=p.vy;
  }}
}}
function nbrs(id){{
  const s=new Set();
  for(const e of gE){{ if(e.A===id)s.add(e.B); else if(e.B===id)s.add(e.A); }}
  return s;
}}
function paint(){{
  cx.setTransform(1,0,0,1,0,0); cx.clearRect(0,0,cv.width,cv.height);
  cx.translate(view.x,view.y); cx.scale(view.k,view.k);
  const hs = hover?nbrs(hover):null;
  for(const e of gE){{
    const a=P[e.A],b=P[e.B]; if(!a||!b)continue;
    const on = hover&&(e.A===hover||e.B===hover);
    cx.strokeStyle = colorBy==="why" ? (WC[e["왜"]]||"#333a46")
                   : colorBy==="layer" ? (LC[e["층"]]||"#555") : "#39404e";
    cx.globalAlpha = on?0.95:(hover?0.04:0.09+(e["무게"]||0.3)*0.32);
    cx.lineWidth = on?1.9:0.7;
    cx.beginPath(); cx.moveTo(a.x,a.y); cx.lineTo(b.x,b.y); cx.stroke();
  }}
  cx.globalAlpha=1;
  const showL=document.getElementById("lbl").checked;
  for(const n of gN){{
    const p=P[n.id]; if(!p)continue;
    const r=3.0+Math.sqrt(n.deg)*0.8, on=hover===n.id;
    cx.globalAlpha = (hover && !on && !(hs&&hs.has(n.id)))?0.15:1;
    cx.fillStyle = colorBy==="big" ? (BC[n.big]||"#889") : "#c8cdd6";
    cx.beginPath(); cx.arc(p.x,p.y,on?r*1.8:r,0,6.283); cx.fill();
    if(on){{ cx.strokeStyle="#fff"; cx.lineWidth=1.7; cx.stroke(); }}
    if(showL && (n.deg>=30 || on || (hs&&hs.has(n.id)))){{
      cx.fillStyle = on?"#fff":"#aeb4be";
      cx.font=(on?"bold 13px ":"11px ")+'-apple-system,"Malgun Gothic",sans-serif';
      cx.fillText(n.id,p.x+r+3,p.y+3.5);
    }}
    cx.globalAlpha=1;
  }}
}}
function loop(){{ step(); paint(); raf=requestAnimationFrame(loop); }}
function graphData(d){{
  gE=d;
  const used=new Set(); for(const e of d){{used.add(e.A);used.add(e.B)}}
  gN=NODES.filter(n=>used.has(n.id));
  for(const n of gN){{ if(!P[n.id]) P[n.id]={{x:cv.width/2+(Math.random()-.5)*280,
                                            y:cv.height/2+(Math.random()-.5)*280,vx:0,vy:0}}; }}
  document.getElementById("ginfo").textContent =
    "노드 "+gN.length+" · 간선 "+d.length.toLocaleString();
}}
function pick(mx,my){{
  let b=null,bd=1e9;
  for(const n of gN){{const p=P[n.id]; if(!p)continue;
    const d=Math.hypot(p.x-mx,p.y-my); if(d<bd){{bd=d;b=n.id}}}}
  return bd<18?b:null;
}}
cv.addEventListener("mousemove",ev=>{{
  const r=cv.getBoundingClientRect(), dp=window.devicePixelRatio||1;
  if(drag){{ view.x+=(ev.clientX-drag.x)*dp; view.y+=(ev.clientY-drag.y)*dp;
             drag={{x:ev.clientX,y:ev.clientY}}; return; }}
  const mx=((ev.clientX-r.left)*dp-view.x)/view.k, my=((ev.clientY-r.top)*dp-view.y)/view.k;
  const h=pick(mx,my); if(h!==hover){{ hover=h; cv.title=h||""; }}
}});
cv.addEventListener("mousedown",ev=>{{drag={{x:ev.clientX,y:ev.clientY}};cv.style.cursor="grabbing"}});
window.addEventListener("mouseup",()=>{{drag=null;cv.style.cursor="grab"}});
cv.addEventListener("wheel",ev=>{{ev.preventDefault();
  view.k=Math.max(.2,Math.min(6,view.k*(ev.deltaY<0?1.12:.89)));}},{{passive:false}});
cv.addEventListener("click",()=>{{ if(hover){{ document.getElementById("q").value=hover;
  setMode("table"); draw(); }} }});
document.querySelectorAll(".chip.col").forEach(c=>c.onclick=()=>{{
  document.querySelectorAll(".chip.col").forEach(x=>x.classList.remove("on"));
  c.classList.add("on"); colorBy=c.dataset.c;
}});
document.getElementById("re").onclick=()=>layout();
function setMode(m){{
  document.querySelectorAll(".chip.mode").forEach(x=>x.classList.toggle("on",x.dataset.m===m));
  const g=(m==="graph");
  document.getElementById("gwrap").style.display=g?"":"none";
  document.getElementById("tbl").style.display=g?"none":"";
  if(g){{ sizeCanvas(); if(!Object.keys(P).length) layout(); if(!raf) loop(); }}
  else if(raf){{ cancelAnimationFrame(raf); raf=null; }}
}}
document.querySelectorAll(".chip.mode").forEach(c=>c.onclick=()=>{{setMode(c.dataset.m);draw()}});
window.addEventListener("resize",()=>{{ if(raf) sizeCanvas(); }});

chips("lay","층",fL); chips("ver","왜",fV);
fill("kind","관계"); fill("big","대주제A");
["q","kind","big","onlybad"].forEach(i=>document.getElementById(i).addEventListener("input",draw));
document.querySelectorAll("th[data-s]").forEach(th=>th.onclick=()=>{{
  const k=th.dataset.s; sortD=(sortK===k)?-sortD:1; sortK=k; draw();
}});
draw();
</script></html>"""

with 단계("관계도 정본 표", "4개 층에 흩어진 간선 + 근거사슬을 한 표로 — 운영자: «관계도 모인 표 하나»",
        ["관계도.html", "data/관계도.csv"]) as st:
    (HERE / "관계도.html").write_text(page, encoding="utf-8")
    st.기록(f"간선 {len(rows):,} · 개념 {nn} · 층 {dict(byl)}")
    st.기록(f"왜 판정 {dict(byv)}")

print(f"관계도 {len(rows):,}행 · 개념 {nn}")
print("  층:", dict(byl))
print("  왜:", dict(byv))
print("  관계 상위:", dict(byk.most_common(8)))
print(f"→ {HERE/'관계도.html'}")
print(f"→ {DATA/'관계도.csv'}")
