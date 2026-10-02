# -*- coding: utf-8 -*-
"""
운 대조 — 고수가 인물 풀이에서 «몇 년에 무슨 일»을 말한 문장을 사건으로 삼아, 그해의 대운·세운으로 망이 그 일을 짚나.

사건 = 사례평가.py의 생년월일 사례 글에서 «YYYY년»과 의미(의미.py)가 한 문장에 함께 나온 것(그 사람 나이 3~85세 해만).
예측 = 그해 대운(만세력)·세운(그해 간지)의 운 신호(명식.운_신호) → 합산(대운 문단·세운 문단의 확률).
       그 사람의 다른 해들(3~85세)과 견주어 의미마다 중심화한다.
잣대 = ① 그해 순위: 사건 의미의 평균 점수(나머지 의미 대비)로 후보 해들을 줄 세워 그해가 몇 번째인가(0=1등, 무작위 0.5)
       ② 의미 AUC: 그해 점수로 사건 의미 vs 나머지 의미를 가르는 정도(무작위 0.5)
홀드아웃 = 그 사례 글(사본 포함)을 망에서 뺀다.
⚠ 사건 추출은 문장 단위 기계 추출이다(연도와 의미가 한 문장에 있으면 사건으로 본다). 문헌 일치이지 개인 적중이 아니다.
"""
import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import 망 as M, 명식 as Mi, 풀이 as P, 사례평가 as C

YR = re.compile(r"((?:19|20)\d\d)\s?년")


def 그해간지(y):
    i = (y - 4) % 60
    return Mi.STEMS[i % 10] + Mi.BRANCHES[i % 12]


def 실행(보기=True, 끝해=2026):
    net = M.망()
    txt = M.문장_원문()
    ranks, aucs, rows = [], [], []
    for name, pids, x, 성별, why in C.사례:
        if isinstance(x, list):
            continue                       # 생년월일이 있어야 대운을 센다
        pids = [p for p in pids if p in net.pi]
        if not pids:
            continue
        y0 = x[0]
        c = P.만세력(x[0], x[1], x[2], x[3], 0, 성별 or "M")
        기둥, 대운 = c["기둥"], c["대운"]["목록"]
        hold = M.망.__new__(M.망); hold.__dict__.update(net.__dict__); hold._cache = {}
        hold.base = net.base & ~np.isin(net.post, [net.pi[p] for p in pids])
        hold.글제외 = {net.pi[p] for p in pids}
        lo, hi = y0 + 3, min(y0 + 85, 끝해)
        ev = defaultdict(set)
        for p in pids:
            for r in np.flatnonzero(net.post == net.pi[p]):
                ys = {int(m.group(1)) for m in YR.finditer(txt.get(r))}
                ms = {net.meanings[i] for i in net.Sm_raw[r].indices}
                for y in ys:
                    if lo <= y <= hi and ms:
                        ev[y] |= ms
        if not ev:
            continue
        cand = list(range(lo, hi + 1))

        def vec(y):
            du = [d for d in 대운 if d["나이"] <= y - y0]
            v = np.zeros(len(net.meanings))
            if du:
                v += P.합산(hold, Mi.운_신호(기둥, du[-1]["간지"], "대운"), None, ("대운",))[0]
            v += P.합산(hold, Mi.운_신호(기둥, 그해간지(y), "세운"), None, ("세운(연운)",))[0]
            return v
        V = np.array([vec(y) for y in cand])
        Z = (V - V.mean(0)) / (V.std(0) + 1e-6)
        rk = []
        for y, E in ev.items():
            if len(E) >= len(net.meanings) - 1:
                continue
            idx = [net.meanings.index(m) for m in E]
            rest = [i for i in range(len(net.meanings)) if i not in idx]
            sc = Z[:, idx].mean(1) - Z[:, rest].mean(1)
            k = cand.index(y)
            r = float((sc > sc[k]).sum()) / (len(cand) - 1)
            ranks.append(r); rk.append(r)
            z = Z[k]
            aucs.append(np.mean([1.0 if z[a] > z[b] else 0.5 if z[a] == z[b] else 0.0 for a in idx for b in rest]))
        rows.append((name, len(ev), float(np.mean(rk)) if rk else None))
    if 보기:
        for n, k, r in rows:
            print(f"  {n:8s} 사건 {k}해 · 그해 순위 {r:.2f}")
        print(f"[운 대조] 사건 {len(ranks)}건 · 그해 순위 {np.mean(ranks):.3f}(0=1등, 무작위 0.5) · 의미 AUC {np.mean(aucs):.3f}(무작위 0.5)")
    return {"사건": len(ranks), "그해순위": float(np.mean(ranks)), "의미AUC": float(np.mean(aucs)), "건별": rows}


if __name__ == "__main__":
    실행()
