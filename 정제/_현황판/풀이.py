# -*- coding: utf-8 -*-
"""
풀이 — 생년월일시를 받아 «망을 타고» 사주를 본다.

흐름
  1. 만세력(앱 엔진, 만세력.mjs) → 원국 8글자·대운
  2. 명식.py → 이 명식에서 켜지는 개념(신호)과 무게 · 운_신호 → 대운이 켜는 개념
  3. 망.py → 개념마다 «이 의미가 함께 말해질 확률»(문헌 지지, 관법·맥락별, 베타 수축)
       의미 강도 = Σ 신호무게 × clip(ln P(의미|개념) − ln P(의미), −0.5, 3) × λ
       대운 신호는 «대운을 말하는 문단»에서 센 확률을 쓴다(맥락 = 대운) — 같은 십성도 대운 자리에선 값이 달라진다.
  4. 임계 — 같은 망으로 본 기준 명식(무작위 간지 조합) 중 이 명식의 강도가 몇 %보다 높은가(백분위).
       풀이  = 백분위 ≥ 90 이고 받치는 개념(기여 ≥ 0.1)이 2개 이상
       질문  = 원국은 «답에 따라 풀이가 가장 많이 바뀌는» 의미부터(정보가 큰 질문, _물을것),
               대운은 백분위 75~90 또는 90 이상인데 받치는 개념이 하나뿐인 의미 → 답으로 신호를 더 모은다
       답    = 그렇다/아니다 → 그 의미를 받친 개념의 무게를 받친 몫만큼 올리고/내려 다시 합산한다.
               답한 의미는 «확인됨»으로 따로 둔다(명식만으로 맞힌 것으로 세지 않는다).
  ⚠ 백분위는 «이 망 안에서 다른 명식과 견준 상대 위치», 확률은 «문헌이 그렇게 말하는 정도»다.
    그 사람에게 일어날 확률(적중률)이 아니다. 개인 적중은 따로 검증한다.
  ⚠ 임계(90·75·2개)·답폭(0.5)·λ는 구현 가정이다.

사용
  python 풀이.py 1990-05-15 14:30 남            # 시각 모르면 14:30 대신 -
  python 풀이.py 1990-05-15 14:30 남 --나이 35   # 그 나이 대운을 얹는다
  python 풀이.py 1990-05-15 14:30 남 --관법 현묘 # 한 고수 갈래의 확률로 본다
  python 풀이.py --기둥 경오 신사 경진 계미 남
  python 풀이.py ... --답 "연애·이성=예,이동·해외=아니"
"""
import json, subprocess, sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import 망 as M
import 명식 as Mi

ALWAYS = {"일간", "일주", "월주", "연주", "시주", "원국·명식", "점수론(110점)"}
λ = 0.6
임계_풀이, 임계_질문, 최소받침, 받침기여 = 90.0, 75.0, 2, 0.1
답폭 = 0.5   # 답 하나가 가장 크게 받친 개념의 무게를 ×(1±답폭), 덜 받친 개념은 받친 몫만큼만 바꾼다(구현 가정)


def 만세력(year, month, day, hour=None, minute=0, 성별="M"):
    arg = json.dumps({"year": year, "month": month, "day": day, "hour": hour, "minute": minute,
                      "gender": "M" if 성별 in ("M", "남") else "F"})
    out = subprocess.run(["node", str(HERE / "만세력.mjs"), arg], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


횟수가중 = 0.0   # 같은 개념이 다른 자리에서 또 켜질 때마다 무게 ×(1 + 이 값) (구현 가정, 사례평가로 고른다)


신호맥락_기본 = True
자르기 = (-0.5, 3.0)   # 로그 배수 자르기 — «함께 말해지지 않았다»는 약한 증거라 아래를 얕게 자른다(구현 가정)
신호중심 = True   # 신호마다 의미 배수의 평균을 뺀다 — «개념 문장은 원래 삶 얘기가 많다»는 공통 몫을 빼서 신호 많은 명식 쏠림을 막는다
확산 = 0.0      # 망을 한 걸음 더 탄다: 켜진 개념 A의 이웃 B(문단 공기 강도 상위 3)를 무게 × 강도 × 이 값으로 켠다
확산_이웃 = 3


글섞기 = 0.3   # 문장 공기 확률과 글 단위 프로필(그 개념을 제목으로 다룬 고수 글의 강조)을 섞는 비율
운글섞기 = True   # 운(대운·세운·월운)에도 같은 비율로 섞는다 — 운 문헌 대조(신년운세 420편) 0.181→0.169, 일주 짝·홀 절반 모두 개선


육친 = ("결혼·배우자", "이혼·이별", "연애·이성", "자녀", "부모·조상", "형제·친구")   # 성별에 따라 십성이 가리키는 사람이 바뀌는 의미


def _육친idx(net):
    return [net.meanings.index(m) for m in 육친 if m in net.meanings]


def _성분(net, 신호, 관법=None, 맥락=(), 배수=None, 최소=30, 신호맥락=None):
    """신호 → (문장 기여 dict, 글 기여 dict). 단위는 서로 다르다(척도로 맞춘다)."""
    신호맥락 = 신호맥락_기본 if 신호맥락 is None else 신호맥락
    S, Dg = {}, {}
    if 확산:
        신호 = _확산(net, 신호, 관법)
    for A, v in 신호.items():
        if A in ALWAYS or A not in net.ci:
            continue
        if net.의미분포(A, 관법)[net.meanings[0]][3] < 최소:   # 개념 자체가 드물면 쓰지 않는다
            continue
        ctx = tuple(맥락) + (tuple(c for c in v.get("맥락", ()) if c in net.ni and c != A) if 신호맥락 else ())
        d = net.의미분포(A, 관법, ctx)
        p = np.array([d[m][0] for m in net.meanings])
        lp0 = np.log(net.기준률(관법, ctx))
        lift = np.clip(np.log(p) - lp0, 자르기[0], 자르기[1])
        if v.get("성맥락"):          # 육친 의미만 성별 관점 문단에서 센 배수로 바꾼다(명식.성별맥락 = "육친")
            gctx = tuple(맥락) + tuple(c for c in v["성맥락"] if c in net.ni)
            dg = net.의미분포(A, 관법, gctx)
            pg = np.array([dg[m][0] for m in net.meanings])
            lg = np.clip(np.log(pg) - np.log(net.기준률(관법, gctx)), 자르기[0], 자르기[1])
            yi = _육친idx(net)
            lift[yi] = lg[yi]
        if 신호중심:
            lift = lift - lift.mean()
        w = v["무게"] * (배수 or {}).get(A, 1.0) * (1 + 횟수가중 * max(0, v.get("횟수", 1) - 1))
        S[A] = λ * w * lift
        if 글섞기 and (not 맥락 or 운글섞기):
            g, n = net.글프로필(A, 관법)
            if n:
                Dg[A] = λ * w * (g - g.mean() if 글중심 else g)
    return S, Dg


_척도캐시 = {}


def 척도(net, 관법=None, 종류="시", n=300, seed=3):
    """문장 성분·글 성분의 의미별 퍼짐 — 두 성분을 같은 단위로 섞으려고. 견주는 명식과 같은 종류에서 잰다.
    종류: "시" = 8글자 무작위 n개, "무시" = 시주 없는 6글자, "일주" = 60일주(일주만 있는 명식)."""
    key = (관법, 종류, int((M.D / "S.npz").stat().st_mtime), getattr(net, "글제외", None) is not None, 신호중심, 글중심, 자르기, Mi.성별맥락, 운글섞기)
    if key in _척도캐시:
        return _척도캐시[key]
    rng = np.random.default_rng(seed)
    if 종류.startswith("운:"):
        ctx = tuple(종류[2:].split("|"))
        A, B = [], []
        for _ in range(n):
            기둥, 성별, 운 = 무작위_명식(rng, True)
            S, Dg = _성분(net, Mi.운_신호(기둥, 운, "대운", 성별), 관법, ctx)
            A.append(sum(S.values()) if S else np.zeros(len(net.meanings)))
            B.append(sum(Dg.values()) if Dg else np.zeros(len(net.meanings)))
        out = (np.array(A).std(axis=0) + 1e-6, np.array(B).std(axis=0) + 1e-6)
        _척도캐시[key] = out
        return out
    if 종류 == "일주":
        charts = [([None, None, g, None], None) for g in (Mi.STEMS[i % 10] + Mi.BRANCHES[i % 12] for i in range(60))]
    else:
        charts = []
        for _ in range(n):
            기둥, 성별, _u = 무작위_명식(rng, 종류 == "시")
            charts.append((기둥, 성별))
    A, B = [], []
    for 기둥, 성별 in charts:
        S, Dg = _성분(net, Mi.명식_신호(기둥, 성별)["신호"], 관법)
        A.append(sum(S.values()) if S else np.zeros(len(net.meanings)))
        B.append(sum(Dg.values()) if Dg else np.zeros(len(net.meanings)))
    out = (np.array(A).std(axis=0) + 1e-6, np.array(B).std(axis=0) + 1e-6)
    _척도캐시[key] = out
    return out


척도_기본 = "시"
글중심 = False   # 글 성분은 이미 «그 고수 평소 대비» 편차라 신호별로 다시 빼지 않는다(빼면 일주 대조 14.0→14.5로 나빠짐)


def 합산(net, 신호, 관법=None, 맥락=(), 배수=None, 최소=30, 신호맥락=None, 척도종류=None):
    """신호 → (의미별 강도 벡터, 개념별 기여 dict). 배수 = 답으로 바뀐 개념 무게 배수.

    신호맥락: 신호마다 «어디서 켜졌나»(자리·오행·짝 글자)를 맥락으로 더해, 그 맥락이 함께 말해진 문단에서 센
    확률을 쓴다(상대 개념). 배수는 그 맥락의 기준률 대비로 잰다 — 맥락 자체의 쏠림(일지 문단은 늘 배우자 얘기)을 빼려고.
    글섞기 > 0이면(운은 운글섞기일 때), 문장 성분과 글 성분을 각자 퍼짐으로 나눠 (1−글섞기):글섞기로 섞는다.
    운의 퍼짐은 무작위 명식·무작위 운 간지에서 같은 맥락으로 잰다.
    """
    S, Dg = _성분(net, 신호, 관법, 맥락, 배수, 최소, 신호맥락)
    if 글섞기 and (not 맥락 or 운글섞기):
        종류 = ("운:" + "|".join(맥락)) if 맥락 else (척도종류 or 척도_기본)
        sS, sD = 척도(net, 관법, 종류)
        기여 = {A: (1 - 글섞기) * S[A] / sS + (글섞기 * Dg[A] / sD if A in Dg else 0) for A in S}
    else:
        기여 = S
    total = sum(기여.values()) if 기여 else np.zeros(len(net.meanings))
    return total, 기여


def _확산(net, 신호, 관법=None):
    """켜진 개념에서 한 걸음: 이웃 B = 공기 강도(오치아이) 상위 확산_이웃개(문단 30번 이상 함께). 이미 켜진 개념은 건너뛴다."""
    co, n, N = net.공기(관법)
    with np.errstate(divide="ignore", invalid="ignore"):
        S = co / np.sqrt(np.outer(n, n))
    out = dict(신호)
    add = {}
    for A, v in 신호.items():
        if A in ALWAYS or A not in net.ni:
            continue
        i = net.ni[A]
        row = np.where(co[i] >= 30, S[i], 0); row[i] = 0
        for j in np.argsort(-row)[:확산_이웃]:
            B = net.nodes[j]
            if row[j] <= 0 or B in 신호 or B in ALWAYS:
                continue
            w = v["무게"] * float(row[j]) * 확산
            if w > add.get(B, (0,))[0]:
                add[B] = (w, A)
    for B, (w, A) in add.items():
        out[B] = {"자리": [], "근거": [f"{A}에서 한 걸음(확산)"], "무게": w, "맥락": (), "횟수": 1}
    return out


# ── 기준 명식: 무작위 간지 조합(연·월은 오호둔, 일·시는 시두법으로 맞춘다)
def 무작위_명식(rng, 시주=True):
    y = int(rng.integers(60)); ys = y % 10
    mb = int(rng.integers(12)); ms = (((ys % 5) * 2 + 2) + (mb - 2) % 12) % 10
    d = int(rng.integers(60)); ds = d % 10
    hb = int(rng.integers(12)); hs = ((ds % 5) * 2 + hb) % 10
    g = lambda s, b: Mi.STEMS[s] + Mi.BRANCHES[b]
    기둥 = [g(y % 10, y % 12), g(ms, mb), g(ds, d % 12), g(hs, hb) if 시주 else None]
    성별 = "M" if rng.integers(2) else "F"
    순행 = (성별 == "M") == Mi.STEM_YANG[ys]
    i = int(rng.integers(1, 9))
    mi = next(k for k in range(60) if k % 10 == ms and k % 12 == mb)
    ui = (mi + (i if 순행 else -i)) % 60
    return 기둥, 성별, g(ui % 10, ui % 12)


_기준 = {}


def 기준분포(net, 관법=None, 시주=True, n=1500, seed=7):
    # 원장이 다시 만들어지면(의미 사전·코퍼스가 바뀌면) 기준분포도 다시 센다 — 원장 시각으로 확인한다.
    #   (문장 수만 보면 의미 사전만 고친 재생성을 못 알아본다)
    #   명식.py(신호 계산)·풀이.py(합산 설정)가 바뀌어도 다시 센다 — 원장·두 파일의 수정 시각과 설정값 전체를 열쇠로 쓴다.
    stamp = max(int((M.D / "S.npz").stat().st_mtime), int(Path(Mi.__file__).stat().st_mtime), int(Path(__file__).stat().st_mtime))
    설정 = repr((신호맥락_기본, 신호중심, 글섞기, 글중심, 자르기, λ, 횟수가중, 확산, Mi.성별맥락, 운글섞기))
    key = (관법, 시주, n, seed, stamp, 설정)
    if key in _기준:
        return _기준[key]
    f = M.D / f"기준분포_{관법 or '전체'}_{'시' if 시주 else '무시'}_{n}.npz"
    if f.exists():
        z = np.load(f)
        if "원장" in z and int(z["원장"]) == stamp and "설정" in z and str(z["설정"]) == 설정:
            _기준[key] = (z["원국"], z["대운"])
            return _기준[key]
    rng = np.random.default_rng(seed)
    A, B = [], []
    for _ in range(n):
        기둥, 성별, 운 = 무작위_명식(rng, 시주)
        A.append(합산(net, Mi.명식_신호(기둥, 성별)["신호"], 관법, 척도종류="시" if 시주 else "무시")[0])
        B.append(합산(net, Mi.운_신호(기둥, 운, "대운", 성별), 관법, ("대운",))[0])
    A, B = np.array(A), np.array(B)
    np.savez_compressed(f, 원국=A, 대운=B, 원장=stamp, 설정=설정)
    _기준[key] = (A, B)
    return _기준[key]


def _백분위(ref, x):
    return 100.0 * (ref < x[None, :]).mean(axis=0)


def _판정(net, 강도, 기준, 기여, 관법, 맥락, 근거=True, 답=None, 신호=None):
    pct = _백분위(기준, 강도)
    rows = []
    for i, m in enumerate(net.meanings):
        if m in (답 or {}):
            continue          # 답한 의미는 다시 묻거나 «맞혔다»고 내놓지 않는다
        받침 = sorted(((A, float(c[i])) for A, c in 기여.items() if c[i] >= 받침기여), key=lambda x: -x[1])
        if pct[i] >= 임계_풀이 and len(받침) >= 최소받침:
            kind = "풀이"
        elif pct[i] >= 임계_질문:
            kind = "질문"
        else:
            continue
        rows.append({"의미": m, "강도": float(강도[i]), "백분위": float(pct[i]), "판정": kind, "받침": 받침[:4]})
    rows.sort(key=lambda r: (r["판정"] != "풀이", -r["백분위"], -r["강도"]))
    if 근거:
        for r in rows:
            r["근거문장"] = []
            for A, _ in r["받침"][:2]:
                # 근거도 확률과 같은 맥락(신호의 성별·자리)에서 먼저 찾는다 — 남명에 «여명이라면…» 문장이 붙지 않게
                v = (신호 or {}).get(A, {})
                sc = v.get("성맥락") if r["의미"] in 육친 and v.get("성맥락") else v.get("맥락", ())
                sc = tuple(c for c in sc if c in net.ni and c != A)
                ev = ((sc and net.근거문장(A, r["의미"], 관법, tuple(맥락) + sc, k=1))
                      or net.근거문장(A, r["의미"], 관법, 맥락, k=1) or net.근거문장(A, r["의미"], None, (), k=1))
                r["근거문장"] += [dict(e, 개념=A) for e in ev]
    return rows


def _답배수(net, 기여0, 답):
    """답 → 그 의미를 받친 몫만큼 개념 무게 배수(가장 크게 받친 개념이 ×(1±답폭))."""
    배수 = {}
    for m, yes in (답 or {}).items():
        i = net.meanings.index(m)
        top = max([c[i] for c in 기여0.values()] + [0.0])
        if top <= 0:
            continue
        for A, c in 기여0.items():
            if c[i] > 0:
                share = float(c[i] / top)
                배수[A] = 배수.get(A, 1.0) * (1 + 답폭 * share if yes else 1 - 답폭 * share)
    return 배수


def _풀이집합(net, 강도, 기준, 기여):
    pct = _백분위(기준, 강도)
    out = set()
    for i, m in enumerate(net.meanings):
        if pct[i] >= 임계_풀이 and sum(1 for c in 기여.values() if c[i] >= 받침기여) >= 최소받침:
            out.add(m)
    return out


def _물을것(net, sig, 관법, 종류, 기여0, 답, ref_a, rows, k=4, 후보하한=50.0):
    """질문 고르기 — 답에 따라 풀이(임계 넘은 의미)가 가장 많이 바뀌는 의미부터 묻는다(정보가 큰 질문).

    후보 = 아직 답하지 않았고 풀이도 아닌 의미 중 백분위 ≥ 후보하한. 예/아니 두 답을 각각 넣어 다시 합산하고,
    지금 풀이 집합과 달라지는 의미 수(들어오고 나가는 것)를 센다. 같으면 임계에 가까운 것부터. (구현 가정)
    """
    now = {r["의미"] for r in rows if r["판정"] == "풀이"}
    강도0, 기여00 = 합산(net, sig, 관법, 배수=_답배수(net, 기여0, 답), 척도종류=종류)
    pct0 = _백분위(ref_a, 강도0)
    cands = [m for i, m in enumerate(net.meanings) if m not in 답 and m not in now and pct0[i] >= 후보하한]
    scored = []
    for m in cands:
        bian = {}
        for yes in (True, False):
            a = dict(답); a[m] = yes
            s_, c_ = 합산(net, sig, 관법, 배수=_답배수(net, 기여0, a), 척도종류=종류)
            new = _풀이집합(net, s_, ref_a, c_) - set(a)      # 답한 의미는 풀이에서 빠진다(_판정과 같다)
            bian[yes] = (sorted(new - now), sorted(now - new))
        n = sum(len(x) + len(y) for x, y in bian.values())
        scored.append((n, float(pct0[net.meanings.index(m)]), m, bian))
    scored.sort(key=lambda x: (-x[0], -x[1]))
    return [{"의미": m, "바뀜": n, "백분위": p, "예면": {"더함": b[True][0], "뺌": b[True][1]},
             "아니면": {"더함": b[False][0], "뺌": b[False][1]}} for n, p, m, b in scored[:k]]


def 풀이(기둥, 성별=None, 관법=None, 나이=None, 대운=None, 답=None, net=None, 근거=True):
    net = net or M.망()
    info = Mi.명식_신호(기둥, 성별)
    sig = info["신호"]
    시주 = len(기둥) > 3 and 기둥[3] is not None
    ref_a, ref_b = 기준분포(net, 관법, 시주)
    종류 = "시" if 시주 else "무시"
    _, 기여0 = 합산(net, sig, 관법, 척도종류=종류)
    배수 = _답배수(net, 기여0, 답)
    강도, 기여 = 합산(net, sig, 관법, 배수=배수, 척도종류=종류)
    out = {"기둥": 기둥, "일간": info["일간"], "강약": info["강약"], "점수": info["점수"],
           "신호": {A: {"무게": v["무게"], "근거": v["근거"][:2]} for A, v in sorted(sig.items(), key=lambda x: -x[1]["무게"])},
           "원국": _판정(net, 강도, ref_a, 기여, 관법, (), 근거, 답, sig), "답": 답 or {},
           "배수": {A: round(b, 3) for A, b in 배수.items() if abs(b - 1) >= 0.05}}
    out["물을것"] = _물을것(net, sig, 관법, 종류, 기여0, 답 or {}, ref_a, out["원국"])
    if not 시주:
        out["시주후보"] = 시주_후보(net, 기둥, 성별, 관법, 답)
    if 대운:
        usig = Mi.운_신호(기둥, 대운, "대운", 성별)
        u강도, u기여 = 합산(net, usig, 관법, ("대운",))
        out["대운"] = {"간지": 대운, "나이": 나이,
                     "신호": {A: v["근거"][:2] for A, v in usig.items()},
                     "풀이": _판정(net, u강도, ref_b, u기여, 관법, ("대운",), 근거, 답, usig)}
    return out


def 시주_후보(net, 기둥, 성별=None, 관법=None, 답=None):
    """생시 미상 — 12시주 후보마다 의미 백분위를 내고, (1) 후보를 가장 잘 가르는 질문 (2) 답과 맞는 후보 순서를 낸다.

    점수 = Σ(답한 의미) ±(백분위 − 50)/50  (예 = +, 아니 = −). 확률이 아니라 «답과 어울리는 순서»다(구현 가정).
    """
    ds = Mi.STEMS.index(기둥[2][0])
    ref_a, _ = 기준분포(net, 관법, True)
    cands = []
    for hb in range(12):
        hs = ((ds % 5) * 2 + hb) % 10
        g = Mi.STEMS[hs] + Mi.BRANCHES[hb]
        강도, _ = 합산(net, Mi.명식_신호(기둥[:3] + [g], 성별)["신호"], 관법)
        cands.append((g, _백분위(ref_a, 강도)))
    P = np.array([c[1] for c in cands])                    # 12 × 의미
    답 = 답 or {}
    score = np.zeros(12)
    for m, yes in 답.items():
        i = net.meanings.index(m)
        score += (P[:, i] - 50) / 50 * (1 if yes else -1)
    order = np.argsort(-score, kind="stable")
    spread = P.std(axis=0)
    qs = [(net.meanings[i], float(spread[i])) for i in np.argsort(-spread) if net.meanings[i] not in 답][:3]
    return {"순서": [{"시주": cands[k][0], "점수": float(score[k])} for k in order],
            "가르는질문": [{"의미": m, "후보간_퍼짐": v} for m, v in qs], "답수": len(답)}


주요관법 = ["산책처럼", "남석", "도화", "석우당", "초코", "현묘"]   # 문장 4만 개 이상 갈래


def 관법비교(기둥, 성별=None, net=None, 관법들=None, n=600):
    """같은 명식을 고수 갈래(이론 베이스)마다 따로 본다 — 여럿이 함께 짚는 것(공통)과 한 갈래만 짚는 것(갈래별)을 가른다.

    각 갈래는 그 갈래 문장으로 센 확률·그 갈래 기준 명식 분포(무작위 n개)로 백분위를 낸다.
      공통   = 갈래 절반 이상에서 백분위 ≥ 임계_질문(75)
      갈래별 = 한 갈래에서만 백분위 ≥ 임계_풀이(90)이고 나머지는 모두 75 미만
    """
    net = net or M.망()
    sig = Mi.명식_신호(기둥, 성별)["신호"]
    시주 = len(기둥) > 3 and 기둥[3] is not None
    kws = 관법들 or 주요관법
    PCT, TOP = {}, {}
    for kw in kws:
        ref_a, _ = 기준분포(net, kw, 시주, n=n)
        강도, 기여 = 합산(net, sig, kw, 척도종류="시" if 시주 else "무시")
        PCT[kw] = _백분위(ref_a, 강도)
        i_top = {i: sorted(((A, float(c[i])) for A, c in 기여.items() if c[i] > 0), key=lambda x: -x[1])[:2] for i in range(len(net.meanings))}
        TOP[kw] = i_top
    k = len(kws)
    공통, 갈래 = [], []
    for i, m in enumerate(net.meanings):
        hi = [kw for kw in kws if PCT[kw][i] >= 임계_질문]
        top = [kw for kw in kws if PCT[kw][i] >= 임계_풀이]
        if len(hi) >= max(2, (k + 1) // 2):
            공통.append((m, hi, float(np.median([PCT[kw][i] for kw in kws]))))
        elif len(top) == 1 and len(hi) == 1:
            kw = top[0]
            갈래.append((m, kw, float(PCT[kw][i]), [A for A, _ in TOP[kw][i]]))
    공통.sort(key=lambda x: (-len(x[1]), -x[2]))
    return {"갈래수": k, "공통": 공통, "갈래별": 갈래}


def 보이기_관법비교(c):
    print(f"\n■ 고수 갈래 {c['갈래수']}곳 비교 (갈래마다 그 갈래 문장으로 센 확률 · 그 갈래 기준 백분위)")
    print("  여럿이 함께 짚는 것(절반 이상 ≥75): " + (" · ".join(f"{m}({len(v)}곳)" for m, v, _ in c["공통"]) or "없음"))
    print("  한 갈래만 짚는 것(그 갈래만 ≥90): " + (" · ".join(f"{m}[{kw} {p:.0f} — {'·'.join(src)}]" for m, kw, p, src in c["갈래별"]) or "없음"))


def 보이기(r):
    g = " ".join(x or "??" for x in r["기둥"])
    print(f"■ 원국 {g}  (연 월 일 시) · 일간 {r['일간']} · 강약 {r['강약']} {r['점수']}")
    print("  켜진 개념: " + " · ".join(f"{A}({v['무게']:.1f})" for A, v in list(r["신호"].items())[:16]))

    def sect(rows, title, 질문=True):
        print(f"\n■ {title}")
        if not rows:
            print("  (임계를 넘은 의미 없음)")
        for x in rows:
            if x["판정"] != "풀이":
                continue
            src = " + ".join(f"{A} {c:+.2f}" for A, c in x["받침"])
            print(f"  ● {x['의미']} — 기준 명식보다 {x['백분위']:.0f}% 위 · 받침: {src}")
            for e in x.get("근거문장", [])[:2]:
                print(f"      └ [{e['개념']}·{e['출처']}] {e['문장']}")
        qs = [x for x in rows if x["판정"] == "질문"][:4] if 질문 else []
        if qs:
            print("  ? 질문(임계 아래 — 답을 받으면 다시 본다)")
            for x in qs:
                src = "·".join(A for A, _ in x["받침"]) or "여러 약한 신호"
                print(f"    - {x['의미']} 쪽 일이 실제로 두드러졌어? (백분위 {x['백분위']:.0f} · 받침 {src})")

    sect(r["원국"], "원국 풀이 (문헌 지지 · 상대 위치)", 질문=not r.get("물을것"))
    if r.get("물을것"):
        print("\n■ 먼저 물을 것 (답에 따라 풀이가 가장 많이 바뀌는 순서)")
        for q in r["물을것"]:
            y, n = q["예면"], q["아니면"]
            f = lambda d: " ".join(([f"+{'·'.join(d['더함'])}"] if d["더함"] else []) + ([f"−{'·'.join(d['뺌'])}"] if d["뺌"] else [])) or "변화 없음"
            print(f"  - {q['의미']} 쪽 일이 두드러졌어? (백분위 {q['백분위']:.0f}) 예 → {f(y)} / 아니 → {f(n)}")
    if "시주후보" in r:
        h = r["시주후보"]
        print("\n■ 생시 미상 — 시주 후보")
        print("  시를 가르는 질문: " + " · ".join(f"{q['의미']} 쪽 일이 두드러졌어? (후보 간 퍼짐 {q['후보간_퍼짐']:.0f})" for q in h["가르는질문"]))
        if h["답수"]:
            print("  답과 어울리는 순서(확률 아님): " + " > ".join(f"{c['시주']}({c['점수']:+.1f})" for c in h["순서"][:6]))
    if "대운" in r:
        d = r["대운"]
        print(f"\n  대운 {d['간지']}" + (f" ({d['나이']}세~)" if d["나이"] is not None else ""))
        print("  대운이 켠 개념: " + " · ".join(f"{A}" for A in d["신호"]))
        sect(d["풀이"], f"대운 {d['간지']}에 더해지는 것 (대운 문단의 확률)")
    if r["답"]:
        print("\n  확인됨(답 — 명식만으로 맞힌 것 아님): " + ", ".join(f"{m}={'예' if v else '아니'}" for m, v in r["답"].items()))
        print("  답으로 바뀐 개념 무게: " + ", ".join(f"{A}×{b:.2f}" for A, b in sorted(r["배수"].items(), key=lambda x: -abs(x[1] - 1))[:10]))
    print("\n  ⚠ 백분위 = 이 망이 본 다른 명식들과 견준 상대 위치 · 확률 = 문헌 지지. 개인에게 일어날 확률이 아니다.")


def _cli(argv):
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("날짜", nargs="?")
    ap.add_argument("시각", nargs="?")
    ap.add_argument("성별", nargs="?", default="남")
    ap.add_argument("--기둥", nargs="+")
    ap.add_argument("--관법")
    ap.add_argument("--나이", type=int)
    ap.add_argument("--대운")
    ap.add_argument("--답")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--관법비교", action="store_true")
    a = ap.parse_args(argv)
    성별 = a.성별
    대운, 나이 = a.대운, a.나이
    if a.기둥:
        if a.기둥[-1] in ("남", "여", "M", "F"):
            성별 = a.기둥.pop()
        기둥 = [None if x in ("-", "?") else x for x in a.기둥] + [None] * (4 - len(a.기둥))
    else:
        y, m, d = map(int, a.날짜.split("-"))
        hh = mm = None
        if a.시각 and a.시각 not in ("-", "?"):
            hh, mm = map(int, a.시각.split(":"))
        c = 만세력(y, m, d, hh, mm or 0, 성별)
        기둥 = c["기둥"]
        if 나이 is not None and not 대운:
            cur = [u for u in c["대운"]["목록"] if u["나이"] <= 나이]
            if cur:
                대운, 나이 = cur[-1]["간지"], cur[-1]["나이"]
    답 = {}
    if a.답:
        for kv in a.답.split(","):
            k, v = kv.split("=")
            답[k.strip()] = v.strip() in ("예", "네", "y", "yes", "1", "그렇다")
    r = 풀이(기둥, 성별, a.관법, 나이, 대운, 답)
    if a.json:
        print(json.dumps(r, ensure_ascii=False, indent=1, default=float))
    else:
        보이기(r)
        if a.관법비교:
            보이기_관법비교(관법비교(기둥, 성별))


if __name__ == "__main__":
    _cli(sys.argv[1:])
