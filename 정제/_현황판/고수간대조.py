# -*- coding: utf-8 -*-
"""
천장 재기 — «고수끼리는 같은 일주를 얼마나 비슷하게 보나».

고수 P의 일주 글(그 고수 평소 틀 대비 강조 편차)을 «예측기»로 삼아, 다른 고수 T의 같은 일주 글이
두 고수가 함께 다룬 일주들 중 어느 것인지 맞혀 본다. 망도 같은 후보·같은 잣대로 맞힌다.
  · 잣대 = 강조 편차 순위상관 → 정답 일주의 순위(후보 K개 중, 무작위 = (K+1)/2)
  · 망 = 그 일주 정답 글 전부를 뺀 엄격 홀드아웃, 명식 고유 예측을 60일주 평균에서 뺀 값(중심화)
망이 «다른 고수가 맞히는 만큼» 맞히면 «그 고수처럼 본다»에 닿은 것이다.
"""
import sys
from collections import defaultdict
from itertools import permutations
from pathlib import Path
import numpy as np
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import 평가 as E, 망 as M


def 실행(창=0, λ=0.6, 최소성공=3.0, 최소후보=8):
    net = M.망(창=창, 최소성공=최소성공)
    gold = E.정답_일주(net)
    none = np.zeros(len(net.post), dtype=bool)
    by = defaultdict(dict)                       # 관법 → 일주 → [글]
    for pid, g in gold.items():
        if len(E.정답_의미(net, pid)) < 2:
            continue
        by[E.관법_of(net, g["출처"]) or "기타"].setdefault(g["일주"], []).append(pid)
    # 정답·예측기 모두 «같은 고수의 다른 일주 글» 대비 편차(일주 글이면 늘 하는 말을 뺀다 — 평가.py 장르기준과 같다)
    kwof = {pid: E.관법_of(net, g["출처"]) or "기타" for pid, g in gold.items()}
    G = {}
    for pid in gold:
        same = [p for p in gold if kwof[p] == kwof[pid] and p != pid]
        G[pid] = E.편차(net, pid, E.관법_of(net, gold[pid]["출처"]), none, same if len(same) >= 5 else None)

    # 망 예측(일주마다 엄격 홀드아웃, 60일주 중심화)
    Z = {}
    for j in E.GANJI60:
        ex = [p for p, gg in gold.items() if gg["일주"] == j]
        hold = M.망.__new__(M.망); hold.__dict__.update(net.__dict__); hold._cache = {}
        hold.base = net.base & ~np.isin(net.post, [net.pi[p] for p in ex if p in net.pi])
        Mx = np.array([[E.예측(hold, [None, None, k, None], λ=λ)[1][m] for m in net.meanings] for k in E.GANJI60])
        Mx = (Mx - Mx.mean(axis=0)) / (Mx.std(axis=0) + 1e-6)
        Z[j] = {k: Mx[i] for i, k in enumerate(E.GANJI60)}   # Z[홀드아웃 일주][후보] = 예측

    rows = []
    for P, T in permutations(by, 2):
        K = sorted(set(by[P]) & set(by[T]))
        if len(K) < 최소후보:
            continue
        prof = {k: np.mean([G[p] for p in by[P][k]], axis=0) for k in K}
        for j in K:
            for pid in by[T][j]:
                gp = G[pid]
                cm = {k: E.spearman(prof[k], gp) for k in K}
                cn = {k: E.spearman(Z[j][k], gp) for k in K}
                rm = sorted(K, key=lambda k: -cm[k]).index(j) + 1
                rn = sorted(K, key=lambda k: -cn[k]).index(j) + 1
                rows.append((P, T, len(K), pid, j, (rm - 1) / (len(K) - 1), (rn - 1) / (len(K) - 1), cm[j], cn[j]))
    print(f"[고수 간 대조] 예측기 고수 → 대상 고수 · 함께 다룬 일주 {최소후보}개 이상 · 순위는 0(1등)~1(꼴찌), 무작위 0.5")
    pairs = defaultdict(list)
    for r in rows:
        pairs[(r[0], r[1], r[2])].append(r)
    for (P, T, K), rs in sorted(pairs.items()):
        print(f"  {P:6s} → {T:6s} 후보 {K:2d} · 글 {len(rs):2d}편 · 고수 순위 {np.mean([r[5] for r in rs]):.2f} 상관 {np.mean([r[7] for r in rs]):+.3f}"
              f"  |  망 순위 {np.mean([r[6] for r in rs]):.2f} 상관 {np.mean([r[8] for r in rs]):+.3f}")
    print(f"  전체 {len(rows)}건 · 고수가 맞힌 순위 {np.mean([r[5] for r in rows]):.3f} · 망이 맞힌 순위 {np.mean([r[6] for r in rows]):.3f}"
          f" · 망이 고수보다 앞선 건 {np.mean([r[6] < r[5] for r in rows]):.0%} · 같은 건 {np.mean([r[6] == r[5] for r in rows]):.0%}")
    return rows


if __name__ == "__main__":
    실행()
