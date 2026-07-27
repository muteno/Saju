# -*- coding: utf-8 -*-
"""
개념→문단 색인 (통합본) — 웹 + 전사를 **한 통계 위에** 올린다.

═══ 이 파일이 생긴 두 가지 이유 ═══

① **전사가 밀착 통계에 없었다.**
   운영자 260726: "그 관계맵의 소스는 정제한 웹 / 그리고 전사한 유튜브 내용에서 오는거임".
   그런데 L2 밀착(4,665 간선)은 웹 38,072 문단만 보고 계산됐다.
   전사 34,943 문단(22.6M자, 웹의 4.2배)이 통째로 빠져 있었다.
   → 표본이 거의 두 배가 된다. 리프트는 표본이 커질수록 신뢰가 오른다.

② **🔴gist가 통계에 섞여 있었다.**
   구 색인은 `bnm.para_text()`를 그대로 썼는데, 그 함수는 **gist(우리가 붙인 이름표)를
   본문 앞에 붙여** 돌려준다. 그래서 «갑목·상생»이라 이름 붙인 문단에서
   갑목과 상생이 같이 나왔다고 세고 있었다. **우리가 붙인 이름이 우리 통계의 근거가 된다** —
   자기충족 회로다. 정의 증류에서 같은 함정을 밟아 고쳤는데(260726, 9/871 오염),
   색인에는 그 수리가 안 갔다. 여기서 뗀다.

═══ 전사를 넣을 때 조심한 것 ═══
  · 보류군(작명 532편) 제외 — 키셋이 다른 술수다.
  · 격자(운세) 제외 — 웹에서 이미 하던 것. 복붙 보일러플레이트가 공기 통계를 부풀린다.
  · **문단 크기 차이를 보정하지 않는다.** 대신 **잰다.** 전사 문단(구어 6문장)과
    웹 문단(블로그 한 단락)의 개념 밀도가 다르면 리프트 임계를 다시 잡아야 한다.
    보정을 먼저 하면 무엇이 달라졌는지 못 본다 — 재고 나서 정한다.

출력: data/개념_문단색인.json (통합) · data/색인_비교리포트.md
"""
import json, re, sys, importlib.util
from pathlib import Path
from collections import defaultdict, Counter

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location("bnm", HERE / "build_neuron_map.py")
bnm = importlib.util.module_from_spec(spec); spec.loader.exec_module(bnm)
bnm.SNAP_DIRS = bnm._snapshot_dirs()

from 작업내역 import 단계          # noqa: E402  되돌릴 수 있게 남긴다


def jl(n):
    p = DATA / n
    return ([json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
            if p.exists() else [])


CONCEPTS = [r["concept"] for r in jl("node_layers.jsonl")]
CSET = set(CONCEPTS)
posts = {p["post_id"]: p for p in jl("posts_all.jsonl")}
paras = jl("paras_all.jsonl")
tposts = {p["post_id"]: p for p in jl("전사_글.jsonl")}
tparas = jl("전사_문단.jsonl")

_st = 단계("색인 통합(웹+전사·gist제거)",
          "L2 밀착 통계가 웹만 보고 있었고 gist(우리 이름표)까지 세고 있었다",
          ["data/개념_문단색인.json", "data/링크망.jsonl"])
_st.__enter__()

GRID = re.compile(r"운세|이달의|경자년|신축년|임인년|계묘년|갑진년|을사년|병오년")
HOLD = re.compile(r"^(?:hand|face|taro|pungsu|dang|gusung|mehwa|tojung|name)-|"
                  r"토정비결|타로|관상|수상|풍수|당사주|구성학|매화역수|작명|플러스작명|지문학")

occ_web, occ_all = defaultdict(set), defaultdict(set)
occ_gist = defaultdict(set)          # 비교용 — 구 방식(gist 포함) 재현
src = defaultdict(set)               # 개념 → 그 개념이 나온 «출처»(웹=저자 / 전사=채널)
n_web = n_tr = 0
dens = {"웹": [], "전사": []}
# ★과분산 실측 — 창 크기를 맞춰 놓고 «같은 길이일 때 개념이 더 많이 얹히는가»를 본다.
#   창 크기 위원(260726)의 이론: 전사 문단은 담화상 «화제 뭉치»라 무관한 개념도 같이 얹힌다.
#   이론은 이론이고 재 봐야 안다. 길이 구간별로 개념/문단을 나란히 세운다.
BINS = [(0, 300), (300, 500), (500, 800), (800, 1200), (1200, 10 ** 9)]
od = {k: {b: [] for b in BINS} for k in ("웹", "전사")}


def _bin(n):
    for b in BINS:
        if b[0] <= n < b[1]:
            return b
    return BINS[-1]


chan_par = Counter()
hit_web, hit_tr = Counter(), Counter()   # 개념별 문단 히트 (오탐 의심 지표용)
ch_web = ch_tr = 0                       # 출처별 총 글자수

for q in paras:
    f = posts.get(q["post_id"], {}).get("file", "")
    if HOLD.search(f) or GRID.search(f) or q.get("kind") in ("잡동", "공지", "운세"):
        continue
    full = bnm.para_text(q, posts)
    if not full:
        continue
    g = (q.get("gist") or "").strip()
    body = full[len(g):] if g and full.startswith(g) else full     # ★gist를 뗀다
    cs = {c for c in bnm.concepts_in(body) if c in CSET}
    n_web += 1
    dens["웹"].append(len(cs))
    od["웹"][_bin(len(body))].append(len(cs))
    ch_web += len(body)
    au = posts.get(q["post_id"], {}).get("author") or Path(f).stem[:20] or "웹?"
    for c in cs:
        occ_web[c].add(q["para_id"]); occ_all[c].add(q["para_id"])
        src[c].add(f"웹:{au}")
        hit_web[c] += 1
    for c in bnm.concepts_in(full):                                 # 구 방식 재현
        if c in CSET:
            occ_gist[c].add(q["para_id"])

for q in tparas:
    p = tposts.get(q["post_id"], {})
    if p.get("보류군"):
        continue
    t = q.get("text", "")
    cs = {c for c in bnm.concepts_in(t) if c in CSET}
    n_tr += 1
    dens["전사"].append(len(cs))
    od["전사"][_bin(len(t))].append(len(cs))
    ch_tr += len(t)
    ch = p.get("채널", "?")
    chan_par[ch] += 1
    for c in cs:
        occ_all[c].add(q["para_id"])
        src[c].add(f"전사:{ch}")
        hit_tr[c] += 1

N = n_web + n_tr
DATA.mkdir(exist_ok=True)
(DATA / "개념_문단색인.json").write_text(
    json.dumps({"N": N, "n_web": n_web, "n_전사": n_tr,
                "occ": {c: sorted(v) for c, v in occ_all.items()},
                "src": {c: sorted(v) for c, v in src.items()}}, ensure_ascii=False),
    encoding="utf-8")

# ── 오탐 의심 지표 (ASR 위원 260726: «치환하지 말고 오탐률만 측정해 표시»)
#   치환 사전은 자기충족 회로다 — 신금↔심금은 양방향 충돌이라 어느 쪽으로 고쳐도
#   반대쪽 진짜 용례가 새 오탐이 된다. 그래서 고치지 않는다.
#   대신 **백만자당 히트율을 웹과 전사에서 나란히 세운다.** 전사에서만 유독 튀는 마커는
#   ⓐ오전사가 그 마커에 걸리고 있거나 ⓑ구어에서만 쓰는 말이거나 둘 중 하나다.
#   어느 쪽인지는 이 표가 답하지 않는다 — **사람이 볼 목록을 만드는 것이 목적이다.**
def rate(cnt, chars):
    return cnt * 1_000_000 / chars if chars else 0.0


susp = []
for c in CONCEPTS:
    rw, rt = rate(hit_web[c], ch_web), rate(hit_tr[c], ch_tr)
    if hit_tr[c] >= 30 and rw > 0:
        susp.append((rt / rw, c, hit_web[c], hit_tr[c], rw, rt))
    elif hit_tr[c] >= 30 and rw == 0:
        susp.append((float("inf"), c, 0, hit_tr[c], 0.0, rt))
susp.sort(reverse=True)
(DATA / "마커_출처편차.jsonl").write_text(
    "\n".join(json.dumps({"개념": c, "배율": (None if r == float("inf") else round(r, 2)),
                          "웹히트": hw, "전사히트": ht,
                          "웹_백만자당": round(rw, 1), "전사_백만자당": round(rt, 1),
                          "판정": ("전사전용" if r == float("inf") else
                                 "전사쏠림" if r >= 3 else
                                 "웹쏠림" if r <= 0.33 else "무난")}, ensure_ascii=False)
              for r, c, hw, ht, rw, rt in susp) + "\n", encoding="utf-8")


def med(v):
    v = sorted(v)
    return v[len(v) // 2] if v else 0


def mean(v):
    return sum(v) / len(v) if v else 0


gist_only = {c: len(occ_gist.get(c, ())) - len(occ_web.get(c, ())) for c in CONCEPTS}
infl = sorted(((v, c) for c, v in gist_only.items() if v > 0), reverse=True)
tot_g = sum(len(v) for v in occ_gist.values())
tot_w = sum(len(v) for v in occ_web.values())

rep = ["# 색인 비교 리포트", "",
       f"- 통합 문단 **{N:,}** = 웹 {n_web:,} + 전사 {n_tr:,} "
       f"(전사 비중 {n_tr/N*100:.0f}%)", "",
       "## ① gist 오염 제거 효과 (웹 구간)", "",
       f"- 구 방식(gist 포함) 개념-문단 출현 **{tot_g:,}** → 본문만 **{tot_w:,}** "
       f"(**−{tot_g-tot_w:,} · {(tot_g-tot_w)/max(1,tot_g)*100:.1f}%**)",
       f"- 즉 밀착 통계의 {(tot_g-tot_w)/max(1,tot_g)*100:.1f}%가 **우리가 붙인 이름표**였다.",
       "", "| 개념 | gist에서만 온 문단 |", "|---|---:|"]
for v, c in infl[:15]:
    rep.append(f"| {c} | +{v} |")
rep += ["", "## ② 문단 크기 — 전사와 웹은 다른가", "",
        "| 출처 | 문단 | 총 글자 | 개념/문단 평균 | 중앙값 | 개념 0개 | 개념 10개↑ |",
        "|---|---:|---:|---:|---:|---:|---:|"]
for k, cc in (("웹", ch_web), ("전사", ch_tr)):
    d = dens[k]
    rep.append(f"| {k} | {len(d):,} | {cc:,} | {mean(d):.2f} | {med(d)} | "
               f"{sum(1 for x in d if x==0):,} | {sum(1 for x in d if x>=10):,} |")
rep += ["", "### ②-1 과분산 실측 — **같은 길이 구간**에서 개념이 더 얹히는가", "",
        "> 창 크기 위원(260726)의 이론: 전사 문단은 담화상 «화제 뭉치»라 무관한 개념도 같이",
        "> 얹혀 리프트가 부푼다. 길이를 맞춰 놓고 재면 그 이론이 맞는지 보인다.",
        "> **비가 1.0에 가까우면 길이만 맞추면 되고, 크게 넘으면 전사 쌍을 못 믿는다.**", "",
        "| 문단 길이 | 웹 개념/문단 | 전사 개념/문단 | 비(전사÷웹) | 웹 표본 | 전사 표본 |",
        "|---|---:|---:|---:|---:|---:|"]
for b in BINS:
    w, t = od["웹"][b], od["전사"][b]
    lbl = f"{b[0]}–{b[1]}자" if b[1] < 10 ** 9 else f"{b[0]}자↑"
    r = (mean(t) / mean(w)) if w and t and mean(w) else 0
    rep.append(f"| {lbl} | {mean(w):.2f} | {mean(t):.2f} | **{r:.2f}** | {len(w):,} | {len(t):,} |")
rep += ["", "## ②-2 마커 출처 편차 — 전사에서만 튀는 마커 (오탐 의심 목록)", "",
        "> ASR 위원(260726): «치환 사전은 자기충족 회로다(신금↔심금 양방향 충돌).",
        "> 고치지 말고 오탐률만 측정해 표시하라.» 아래는 **고칠 목록이 아니라 볼 목록**이다.",
        "> 배율이 높은 이유는 ⓐ오전사가 그 마커에 걸림 ⓑ구어에서만 쓰는 말 — 표가 구분해 주진 않는다.", "",
        "| 개념 | 배율 | 웹/백만자 | 전사/백만자 | 웹 히트 | 전사 히트 |", "|---|---:|---:|---:|---:|---:|"]
for r, c, hw, ht, rw, rt in susp[:20]:
    rep.append(f"| {c} | {'∞' if r==float('inf') else f'{r:.1f}×'} | {rw:.1f} | {rt:.1f} | {hw:,} | {ht:,} |")
rep += ["", "## ③ 채널별 전사 문단", "", "| 채널 | 문단 |", "|---|---:|"]
for ch, n in chan_par.most_common():
    rep.append(f"| {ch} | {n:,} |")
rep += ["", "## ④ 전사가 가장 많이 늘린 개념 20", "", "| 개념 | 웹 | 통합 | 증가 |", "|---|---:|---:|---:|"]
gain = sorted(((len(occ_all.get(c, ())) - len(occ_web.get(c, ())), c) for c in CONCEPTS), reverse=True)
for v, c in gain[:20]:
    rep.append(f"| {c} | {len(occ_web.get(c,())):,} | {len(occ_all.get(c,())):,} | +{v:,} |")
rep += ["", "## ⑤ 전사가 하나도 못 늘린 개념", ""]
zero = [c for c in CONCEPTS if len(occ_all.get(c, ())) == len(occ_web.get(c, ()))]
rep.append(f"- **{len(zero)}개** — " + (", ".join(zero[:40]) if zero else "없음"))
(DATA / "색인_비교리포트.md").write_text("\n".join(rep) + "\n", encoding="utf-8")

print(f"통합 색인 N={N:,} (웹 {n_web:,} + 전사 {n_tr:,})")
print(f"gist 오염 제거: {tot_g:,} → {tot_w:,} (−{(tot_g-tot_w)/max(1,tot_g)*100:.1f}%)")
print(f"개념/문단  웹 {mean(dens['웹']):.2f} · 전사 {mean(dens['전사']):.2f}")
print(f"전사가 못 늘린 개념 {len(zero)}")
print("가장 늘어난:", ", ".join(f"{c}+{v:,}" for v, c in gain[:6]))
print("과분산비(전사÷웹):", " · ".join(
    f"{b[0]}~{'' if b[1]>10**8 else b[1]} {(mean(od['전사'][b])/mean(od['웹'][b]) if od['웹'][b] and mean(od['웹'][b]) else 0):.2f}"
    for b in BINS))
print(f"전사쏠림 마커(3배↑) {sum(1 for r,*_ in susp if r >= 3)} · 상위:",
      ", ".join(f"{c}({'∞' if r==float('inf') else f'{r:.0f}x'})" for r, c, *_ in susp[:5]))

_st.기록(f"N {n_web:,}(웹) + {n_tr:,}(전사) = {N:,}")
_st.기록(f"gist 오염 제거 {tot_g:,} → {tot_w:,} (−{(tot_g-tot_w)/max(1,tot_g)*100:.1f}%)")
_st.기록(f"전사가 못 늘린 개념 {len(zero)} · 전사쏠림 마커 {sum(1 for r,*_ in susp if r >= 3)}")
_st.__exit__(None, None, None)
