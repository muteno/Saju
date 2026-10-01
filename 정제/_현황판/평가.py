# -*- coding: utf-8 -*-
"""
고수 대조 평가 — «망이 본 사주가 고수가 본 것과 얼마나 닮았나».

정답 = 고수가 특정 명식(지금은 일주)을 놓고 실제로 쓴 풀이 글에서 말해진 의미들.
       그 글들은 **전부 망 통계에서 뺀 채로** 예측한다(같은 일주의 다른 저자 글까지 엄격 제외).
예측 = 명식 신호(명식.py) → 개념마다 의미 확률(망.py) → 합산 점수.

지표
  ① 의미 판별력(AUC): 그 글에서 말해진 의미 vs 안 말해진 의미를 점수로 가르는 정도. 0.5 = 무작위.
     기준선 = 빈도 순 추측(명식과 무관한 기준률). 망이 이보다 높아야 «명식을 보고» 맞힌 것이다.
  ② 명식 판별(순위): 60일주 예측 각각을 그 글과 대조해 «그 글의 일주»가 몇 등인가. 무작위 = 30.5.
     이게 «이 사주를 저 고수처럼 봤나»에 가장 가까운 시험이다.

⚠이건 «문헌 속 고수의 풀이»와의 일치이지, 실제 사람의 삶과의 적중이 아니다.
"""
import json, re, sys
from collections import defaultdict
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import 망 as M
from 명식 import 명식_신호, STEMS, BRANCHES

G, B = STEMS, BRANCHES
GANJI60 = [G[i % 10] + B[i % 12] for i in range(60)]
# 명식마다 늘 켜지는 자리·골격 노드는 명식을 가르지 못한다 — 점수에서 뺀다.
ALWAYS = {"일간", "일주", "월주", "연주", "시주", "원국·명식", "점수론(110점)"}


def 정답_일주(net):
    """제목에 60갑자 일주 하나만 있는 글 → {post_id: 일주}."""
    HG, HB = "甲乙丙丁戊己庚辛壬癸", "子丑寅卯辰巳午未申酉戌亥"
    rx = re.compile(f"([{G}{HG}])([{B}{HB}])\\s?(?:일주|日柱)")
    anyg = re.compile("|".join(GANJI60))
    meta = json.loads((M.D / "meta.json").read_text(encoding="utf-8"))
    titles = {}
    import 코퍼스
    for r in 코퍼스.문단들():
        pid = r["post_id"] or r["para_id"]
        if pid not in titles:
            titles[pid] = (r["title"] or "", r["출처"])
    out = {}
    for pid, (t, src) in titles.items():
        if "60갑자" in t or "육십갑자 일주별" in t:
            continue
        ms = set()
        for a, b in rx.findall(t):
            si = G.index(a) if a in G else HG.index(a)
            bi = B.index(b) if b in B else HB.index(b)
            if si % 2 == bi % 2:
                ms.add(G[si] + B[bi])
        allg = set(anyg.findall(t)) | ms
        if len(ms) == 1 and len(allg) <= 1:
            out[pid] = {"일주": ms.pop(), "제목": t, "출처": src}
    return out


def 정답_의미(net, pid, 최소=1):
    """그 글의 문장들에서 말해진 의미 집합."""
    j = net.pi.get(pid)
    if j is None:
        return set()
    rows = net.post == j
    cnt = np.asarray(net.Sm_raw[np.flatnonzero(rows)].sum(axis=0)).ravel()
    return {net.meanings[i] for i, c in enumerate(cnt) if c >= 최소}


def 편차(net, pid, kw, ex_rows, 기준글=None):
    """그 글이 기준보다 어떤 의미를 더/덜 말했나 — log((c+0.5)/(기대+0.5)).

    기준 = 기준글(같은 고수의 다른 일주 글 등)이 주어지면 그 글들, 아니면 그 고수의 평소 글 전체.
    """
    j = net.pi.get(pid)
    rows = net.post == j
    n_p = int(rows.sum())
    c = np.asarray(net.Sm_raw[np.flatnonzero(rows)].sum(axis=0)).ravel()
    if 기준글:
        ref = np.isin(net.post, [net.pi[p] for p in 기준글 if p in net.pi and p != pid])
    else:
        ref = (net.kw == net.ki[kw]) if kw else np.ones_like(rows)
        ref &= ~ex_rows
    r = (np.asarray(net.Sm_raw[np.flatnonzero(ref)].sum(axis=0)).ravel() + 1) / (ref.sum() + 2)
    return np.log((c + 0.5) / (n_p * r + 0.5))


def spearman(a, b):
    from scipy.stats import spearmanr
    v = spearmanr(a, b).correlation
    return 0.0 if v != v else float(v)


def auc(scores, positive):
    pos = [s for m, s in scores.items() if m in positive]
    neg = [s for m, s in scores.items() if m not in positive]
    if not pos or not neg:
        return None
    wins = 0.0
    for p in pos:
        for n in neg:
            wins += 1.0 if p > n else 0.5 if p == n else 0.0
    return wins / (len(pos) * len(neg))


POS_NODES = {"일지", "월지", "연지", "시지", "월간", "연간", "시간(時干)", "일간"}


import 명식 as _명식
_TEN = set(_명식.TEN.values())


def 예측(net, 기둥, λ=0.6, 신호필터=None, 관법=None, 신호맥락=False, **_):
    """명식 → 의미별 점수(로그 기준률 + 명식 고유)와 명식 고유 부분. 계산은 풀이.합산 하나로 한다."""
    import 풀이 as P
    sig = 명식_신호(기둥)["신호"]
    if 신호필터:
        sig = {A: v for A, v in sig.items() if 신호필터(A)}
    P.λ = λ
    spec, 기여 = P.합산(net, sig, 관법, 신호맥락=신호맥락)
    lp0 = np.log(net.기준률(관법))
    full = {m: float(lp0[i] + spec[i]) for i, m in enumerate(net.meanings)}
    only = {m: float(spec[i]) for i, m in enumerate(net.meanings)}
    return full, only, list(기여)


_이웃캐시 = {}


def 갈래이웃(net, kw, 최소=30):
    """갈래끼리 개념→의미 배수(중심화)의 상관으로 가장 닮은 갈래 순서. 십성·천간·지지·주요 신살로 잰다."""
    if kw in _이웃캐시:
        return _이웃캐시[kw]
    import 명식 as Mi
    cs = list(set(Mi.TEN.values())) + Mi.STEM_NODE + Mi.BRANCH_NODE + ["도화", "역마", "화개", "백호", "괴강", "양인", "신강", "신약", "지지충", "육합"]

    def vec(k):
        out = []
        for A in cs:
            d = net.의미분포(A, k)
            v = np.log(np.array([d[m][0] for m in net.meanings])) - np.log(net.기준률(k))
            out.append(v - v.mean() if d[net.meanings[0]][3] >= 최소 else np.full(len(v), np.nan))
        return np.array(out)
    a = vec(kw)
    sims = []
    for k in net.관법들:
        if k in (kw, "기타"):
            continue
        b = vec(k)
        ok = ~(np.isnan(a).any(1) | np.isnan(b).any(1))
        if ok.sum() > 5:
            sims.append((k, float(np.corrcoef(a[ok].ravel(), b[ok].ravel())[0, 1])))
    _이웃캐시[kw] = [k for k, _ in sorted(sims, key=lambda x: -x[1])]
    return _이웃캐시[kw]


def 관법_of(net, 출처):
    import build_망
    k = build_망.관법(출처)
    return k if k in net.ki else None


def 실행(λ=0.6, 엄격=True, 출력=True, 관법적용=False, 위치=False, 창=0, 상대=False, 최소성공=3.0, 중심=0, 제목무게=0.0, 장르기준=False, 이웃=0):
    net = M.망(창=창, 최소성공=최소성공, 제목무게=제목무게)
    gold = 정답_일주(net)
    by_ilju = defaultdict(list)
    for pid, g in gold.items():
        by_ilju[g["일주"]].append(pid)
    res = []
    for ilju in GANJI60:
        if ilju not in by_ilju:
            continue
        ex = by_ilju[ilju] if 엄격 else []
        hold = M.망.__new__(M.망)
        hold.__dict__.update(net.__dict__)
        hold._cache = {}
        hold.base = net.base & ~np.isin(net.post, [net.pi[p] for p in ex if p in net.pi])
        hold.qbase = net.qbase & ~np.isin(net.qpost, [net.pi[p] for p in ex if p in net.pi])
        cache = {}

        def P(j, kw):
            if (j, kw) not in cache:
                full, only, used = 예측(hold, [None, None, j, None], λ=λ, 관법=kw, 신호맥락=위치)
                cache[(j, kw)] = (full, only)
            return cache[(j, kw)]
        for pid in by_ilju[ilju]:
            pos = 정답_의미(net, pid)
            if len(pos) < 2 or len(pos) > len(net.meanings) - 2:
                continue
            kw = 관법_of(net, gold[pid]["출처"]) if 관법적용 else None
            if kw and 이웃:
                kw = (kw,) + tuple(갈래이웃(net, kw)[:이웃])
            preds = {j: P(j, kw) for j in GANJI60}
            if 중심:
                # 명식 고유 예측을 «60일주 평균에서 얼마나 벗어났나»로 바꾼다(모든 명식에 공통인 쏠림 제거).
                Mx = np.array([[preds[j][1][m] for m in net.meanings] for j in GANJI60])
                mu = Mx.mean(axis=0); sd = Mx.std(axis=0) + 1e-6
                Z = (Mx - mu) / (sd if 중심 == 2 else 1.0)
                preds = {j: (preds[j][0], {m: float(Z[k, i]) for i, m in enumerate(net.meanings)}) for k, j in enumerate(GANJI60)}
            base = {m: float(np.log(hold.기준률(kw)[i])) for i, m in enumerate(net.meanings)}
            a_full = auc(preds[ilju][0], pos)
            a_base = auc(base, pos)
            exr = ~hold.base
            kwp = 관법_of(net, gold[pid]["출처"])
            # 장르기준: 같은 고수의 다른 일주 글을 기준으로(일주 글이라면 늘 하는 말을 뺀다)
            same = [p for p, gg in gold.items() if 관법_of(net, gg["출처"]) == kwp and p != pid] if 장르기준 else []
            g = 편차(net, pid, kwp, exr, same if len(same) >= 5 else None)
            vec = lambda j: np.array([preds[j][1][m] for m in net.meanings])
            emph = {m for i, m in enumerate(net.meanings) if g[i] > 0.3}
            if emph:
                emph_auc = {j: auc(preds[j][1], emph) for j in GANJI60}
                order_e = sorted(GANJI60, key=lambda j: -(emph_auc[j] or 0))
                rank_e = order_e.index(ilju) + 1
                ea = emph_auc[ilju]
            else:
                rank_e, ea = None, None
            cors = {j: spearman(vec(j), g) for j in GANJI60}
            order_c = sorted(GANJI60, key=lambda j: -cors[j])
            rank_c = order_c.index(ilju) + 1
            # 명식 판별: 그 글과 가장 닮은 예측이 몇 등인가(명식 고유 부분으로 비교)
            sims = {j: auc(preds[j][1], pos) for j in GANJI60}
            order = sorted(GANJI60, key=lambda j: -(sims[j] or 0))
            rank = order.index(ilju) + 1
            res.append({"글": pid, "일주": ilju, "출처": gold[pid]["출처"], "의미수": len(pos),
                        "AUC_망": a_full, "AUC_빈도": a_base, "AUC_고유": sims[ilju], "순위": rank,
                        "강조상관": cors[ilju], "강조순위": rank_c, "강조AUC": ea, "강조AUC순위": rank_e})
    if 출력:
        A1 = np.mean([r["AUC_망"] for r in res]); A0 = np.mean([r["AUC_빈도"] for r in res])
        A2 = np.mean([r["AUC_고유"] for r in res]); R = np.mean([r["순위"] for r in res])
        top5 = np.mean([r["순위"] <= 5 for r in res]); top1 = np.mean([r["순위"] == 1 for r in res])
        print(f"[일주 대조] 글 {len(res)}편 · 일주 {len({r['일주'] for r in res})}개 · 엄격 홀드아웃={엄격} · λ={λ} · 관법={관법적용} · 위치={위치} · 창={창} · 상대={상대} · 최소성공={최소성공} · 중심={중심} · 제목무게={제목무게} · 장르기준={장르기준}")
        print(f"  ① 의미 판별력 AUC: 망 {A1:.3f}  vs  빈도 순 추측 {A0:.3f}  (명식 고유 부분만 {A2:.3f}, 무작위 0.5)")
        print(f"  ② 명식 판별: 그 일주의 평균 순위 {R:.1f} / 60 (무작위 30.5) · 1등 {top1:.0%} · 5등 안 {top5:.0%}")
        C = np.mean([r["강조상관"] for r in res]); RC = np.mean([r["강조순위"] for r in res])
        t1 = np.mean([r["강조순위"] == 1 for r in res]); t5 = np.mean([r["강조순위"] <= 5 for r in res])
        print(f"  ③ 고수가 이 명식에서 유독 강조한 의미 ↔ 망의 명식 고유 예측: 순위상관 {C:+.3f} (0 = 무관)")
        print(f"     그 상관으로 60일주 중 정답 일주 평균 순위 {RC:.1f} (무작위 30.5) · 1등 {t1:.0%} · 5등 안 {t5:.0%}")
        ee = [r for r in res if r["강조AUC"] is not None]
        print(f"  ④ 고수가 유독 강조한 의미를 망이 위로 올리나: AUC {np.mean([r['강조AUC'] for r in ee]):.3f} (무작위 0.5) · "
              f"그 AUC로 정답 일주 평균 순위 {np.mean([r['강조AUC순위'] for r in ee]):.1f} · 5등 안 {np.mean([r['강조AUC순위'] <= 5 for r in ee]):.0%} ({len(ee)}편)")
    return res


if __name__ == "__main__":
    λ = float(sys.argv[1]) if len(sys.argv) > 1 else 0.6
    opts = set(sys.argv[2:])
    창 = next((int(o[1:]) for o in opts if o.startswith("w")), 0)
    c = next((float(o[1:]) for o in opts if o.startswith("c")), 3.0)
    z = next((int(o[1:]) for o in opts if o.startswith("z")), 0)
    t = next((float(o[1:]) for o in opts if o.startswith("t")), 0.0)
    rs = 실행(λ=λ, 관법적용="관법" in opts, 위치="위치" in opts, 창=창, 상대="상대" in opts, 최소성공=c, 중심=z, 제목무게=t,
              장르기준="장르" in opts, 이웃=next((int(o[2:]) for o in opts if o.startswith("이웃")), 0))
    by = defaultdict(list)
    for r in rs:
        by[r["출처"]].append(r)
    for k, v in sorted(by.items(), key=lambda x: -len(x[1])):
        print(f"    {k:28s} {len(v):3d}편 · AUC 망 {np.mean([r['AUC_망'] for r in v]):.3f} vs 빈도 {np.mean([r['AUC_빈도'] for r in v]):.3f} · 평균 순위 {np.mean([r['순위'] for r in v]):.1f}")
