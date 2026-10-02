# -*- coding: utf-8 -*-
"""
일주 문단 대조 — 한 글에 여러 일주를 설명한 모음 글의 «XX일주로 시작하는 문단»을 정답 단위로 쓴다.

일주 대조(평가.py)의 정답 99편 중 61편이 현묘다. 여기서는 그 밖의 고수(도화로운·초코·산책처럼·석우당 등)가
문단 하나로 일주를 풀이한 것을 더해 쏠림을 줄인다.
  · 정답 문단 = «XX일주»로 시작하고 150자 이상, 의미 2개 이상(정답 글 99편은 뺀다)
  · 강조 = 그 문단이 그 고수 평소 문장보다 더/덜 말한 의미(log((c+0.5)/(n·r+0.5)))
  · 홀드아웃 = 그 일주의 정답 글 전부 + 그 문단이 든 글 전체를 망에서 뺀다
  · 잣대 = 평가.py ③과 같다(60일주 중심화 예측과 강조의 순위상관으로 정답 일주 순위)
⚠ 문단 하나는 문장이 적어 잡음이 크다. 문헌 일치이지 개인 적중이 아니다.
"""
import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import 망 as M, 평가 as E

_HEAD = re.compile(r"^\W{0,5}(" + "|".join(E.GANJI60) + r")\s?(?:일주|日柱)")


def 정답_문단(net):
    import 코퍼스, build_망
    gold = E.정답_일주(net)
    meta_para = {p: i for i, p in enumerate(net.meta["para_ids"])}
    out = []
    for r in 코퍼스.문단들():
        if r["post_id"] in gold:
            continue
        t = build_망.전사_교정(r["text"]).strip()
        m = _HEAD.match(t)
        if not m or len(t) < 150 or r["para_id"] not in meta_para:
            continue
        out.append({"문단": meta_para[r["para_id"]], "일주": m.group(1), "출처": r["출처"], "글": r["post_id"]})
    return out


def 실행(보기=True):
    net = M.망()
    gold = E.정답_일주(net)
    none = np.zeros(len(net.post), dtype=bool)
    para = np.load(M.D / "rows.npz")["para"]
    units = 정답_문단(net)
    by = defaultdict(list)
    for u in units:
        by[u["일주"]].append(u)
    net.글제외 = {net.pi[p] for p in gold if p in net.pi} | {net.pi[u["글"]] for u in units if u["글"] in net.pi}
    ranks = []
    for j, us in by.items():
        ex = [net.pi[p] for p, g in gold.items() if g["일주"] == j and p in net.pi] + [net.pi[u["글"]] for u in us if u["글"] in net.pi]
        hold = M.망.__new__(M.망); hold.__dict__.update(net.__dict__); hold._cache = {}
        hold.base = net.base & ~np.isin(net.post, ex)
        Mx = np.array([[E.예측(hold, [None, None, k, None])[1][m] for m in net.meanings] for k in E.GANJI60])
        Z = (Mx - Mx.mean(0)) / (Mx.std(0) + 1e-6)
        for u in us:
            rows = np.flatnonzero(para == u["문단"])
            c = np.asarray(net.Sm_raw[rows].sum(axis=0)).ravel()
            if (c > 0).sum() < 2:
                continue
            kw = E.관법_of(net, u["출처"])
            ref = ((net.kw == net.ki[kw]) if kw else np.ones(len(net.post), dtype=bool)) & ~np.isin(net.post, ex)
            r = (np.asarray(net.Sm_raw[np.flatnonzero(ref)].sum(axis=0)).ravel() + 1) / (ref.sum() + 2)
            g = np.log((c + 0.5) / (len(rows) * r + 0.5))
            cs = np.array([E.spearman(Z[i], g) for i in range(60)])
            ranks.append((u, int((cs > cs[E.GANJI60.index(j)]).sum()) + 1))
    rk = np.array([r for _, r in ranks])
    if 보기:
        src = defaultdict(list)
        for u, r in ranks:
            src[u["출처"]].append(r)
        for k, v in sorted(src.items(), key=lambda x: -len(x[1])):
            print(f"  {k[:20]:20s} {len(v):2d}문단 · 평균 {np.mean(v):.1f}")
        print(f"[일주 문단 대조] {len(rk)}문단 · 정답 일주 평균 순위 {rk.mean():.1f}/60(무작위 30.5) · 5등 안 {np.mean(rk <= 5):.0%}")
    return {"문단": int(len(rk)), "평균순위": float(rk.mean()) if len(rk) else None, "5등안": float(np.mean(rk <= 5)) if len(rk) else None}


if __name__ == "__main__":
    실행()
