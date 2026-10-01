# -*- coding: utf-8 -*-
"""
천장 재기 — «고수끼리는 같은 일주를 얼마나 비슷하게 보나».

현묘 일주론(60일주 전부)의 강조 의미를 «예측기»로 삼아, 다른 고수(석우당·남석·명리학탐구·초코…)의
같은 일주 글이 60일주 중 어느 것인지 맞혀 본다. 망과 같은 잣대(강조 편차 순위상관, 정답 일주 순위)로 잰다.
망이 이 수준에 닿으면 «다른 고수만큼 그 고수처럼 본다»는 뜻이다.
"""
import sys
from pathlib import Path
import numpy as np
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import 평가 as E, 망 as M


def 실행(창=1, λ=0.6):
    net = M.망(창=창)
    gold = E.정답_일주(net)
    hm = {g["일주"]: pid for pid, g in gold.items() if "현묘" in g["출처"]}
    others = {pid: g for pid, g in gold.items() if "현묘" not in g["출처"]}
    none = np.zeros(len(net.post), dtype=bool)
    H = {j: E.편차(net, pid, "현묘", none) for j, pid in hm.items()}
    rows = []
    for pid, g in others.items():
        j = g["일주"]
        if j not in H:
            continue
        pos = E.정답_의미(net, pid)
        if len(pos) < 2:
            continue
        kw = E.관법_of(net, g["출처"])
        gp = E.편차(net, pid, kw, none)
        cors = {k: E.spearman(H[k], gp) for k in H}
        order = sorted(cors, key=lambda k: -cors[k])
        # 망(같은 글, 같은 일주의 정답 글 전부를 뺀 엄격 홀드아웃)
        ex = [p for p, gg in gold.items() if gg["일주"] == j]
        hold = M.망.__new__(M.망); hold.__dict__.update(net.__dict__); hold._cache = {}
        hold.base = net.base & ~np.isin(net.post, [net.pi[p] for p in ex if p in net.pi])
        pc = {}
        for k in H:
            _, only, _ = E.예측(hold, [None, None, k, None], λ=λ)
            pc[k] = E.spearman(np.array([only[m] for m in net.meanings]), gp)
        order_n = sorted(pc, key=lambda k: -pc[k])
        rows.append((pid, g["출처"], j, cors[j], order.index(j) + 1, len(H), pc[j], order_n.index(j) + 1))
    print(f"[고수 간 대조] 다른 고수 글 {len(rows)}편 · 예측기 = 현묘 일주론 {len(H)}일주")
    print(f"  현묘의 풀이로 맞히기: 강조상관 {np.mean([r[3] for r in rows]):+.3f} · 정답 일주 평균 순위 {np.mean([r[4] for r in rows]):.1f}/{len(H)} · 5등 안 {np.mean([r[4] <= 5 for r in rows]):.0%}")
    print(f"  망으로 맞히기(같은 글): 강조상관 {np.mean([r[6] for r in rows]):+.3f} · 정답 일주 평균 순위 {np.mean([r[7] for r in rows]):.1f}/{len(H)} · 5등 안 {np.mean([r[7] <= 5 for r in rows]):.0%}")
    for r in rows:
        print(f"    {r[0]:14s} {r[1][:14]:14s} {r[2]}  현묘 {r[3]:+.2f}({r[4]}위)  망 {r[6]:+.2f}({r[7]}위)")
    return rows


if __name__ == "__main__":
    실행()
