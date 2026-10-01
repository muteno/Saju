# -*- coding: utf-8 -*-
"""
관계망 질의 — 개념마다 «무엇인지 / 무엇을 나타낼 확률 / 그 확률을 바꾸는 조건 / 다른 개념과의 거리».

값을 저장하지 않고 원장(build_망.py)에서 **부를 때마다 센다.** 그래서 같은 질문이
  · 관법(이론 베이스: 도화·산책처럼·초코·현묘 …)
  · 맥락(같은 문단에 함께 켜진 개념 = 상대 개념)
  · 제외 목록(평가용 홀드아웃 글)
에 따라 다른 값을 낸다.

확률 = 문헌 지지 정도다. «이 개념이 말해진 문장에서 이 의미가 함께 말해질 확률»이며
       개인에게 일어날 확률(적중률)이 아니다. 개인 적중은 따로 검증한다.
추정 = 베타 수축(표본이 적으면 상위 값 쪽으로 당긴다):
       P(M|A,맥락,관법) ← P(M|A,관법) ← P(M|A) ← P(M)   (수축 세기 α)
구간 = 베타 사후분포 90% 구간.
거리 = −ln(공기 강도). 공기 강도 = 오치아이 계수 n(A∧B)/√(n(A)·n(B)) (문단 단위).
       여러 단계 거리 = 그 거리로 잰 최단 경로(곱해진 강도의 −ln).
"""
import json
from functools import lru_cache
from pathlib import Path

import numpy as np
from scipy import sparse
from scipy.stats import beta as _beta

HERE = Path(__file__).resolve().parent
D = HERE / "data" / "망"


class 망:
    def __init__(self, 제외_글=None, α=20.0):
        self.meta = json.loads((D / "meta.json").read_text(encoding="utf-8"))
        S = sparse.load_npz(D / "S.npz")
        self.S = S.tocsc()
        self.Sm = S.tocsr()[:, len(json.loads((D / "meta.json").read_text(encoding="utf-8"))["nodes"]):].tocsr()
        self.C = sparse.load_npz(D / "C.npz").tocsc()
        self.Q = sparse.load_npz(D / "Q.npz").tocsc()
        rows = np.load(D / "rows.npz")
        self.post = rows["post"]; self.kw = rows["kw"]
        paras = np.load(D / "paras.npz")
        self.qpost = paras["post"]; self.qkw = paras["kw"]
        self.nodes = self.meta["nodes"]; self.meanings = self.meta["meanings"]
        self.cols = self.meta["cols"]
        self.ci = {c: i for i, c in enumerate(self.cols)}
        self.ni = {c: i for i, c in enumerate(self.nodes)}
        self.mcols = np.arange(len(self.nodes), len(self.cols))
        self.관법들 = self.meta["관법"]
        self.ki = {k: i for i, k in enumerate(self.관법들)}
        self.post_ids = self.meta["post_ids"]
        self.pi = {p: i for i, p in enumerate(self.post_ids)}
        self.α = α
        self.base = np.ones(self.S.shape[0], dtype=bool)
        self.qbase = np.ones(self.Q.shape[0], dtype=bool)
        if 제외_글:
            ex = np.array(sorted(self.pi[p] for p in 제외_글 if p in self.pi), dtype=np.int64)
            if len(ex):
                self.base &= ~np.isin(self.post, ex)
                self.qbase &= ~np.isin(self.qpost, ex)
        self._cache = {}

    # ── 행 고르기
    def _col(self, M, j):
        out = np.zeros(M.shape[0], dtype=bool)
        out[M[:, j].indices] = True
        return out

    def 행(self, 관법=None, 맥락=()):
        key = ("행", 관법, tuple(sorted(맥락)))
        if key in self._cache:
            return self._cache[key]
        m = self.base.copy()
        if 관법:
            m &= self.kw == self.ki[관법]
        for c in 맥락:
            m &= self._col(self.C, self.ni[c])
        self._cache[key] = m
        return m

    # ── 개념 → 의미 확률 (모든 의미를 한 번에)
    def 의미분포(self, A, 관법=None, 맥락=(), 이전=None):
        """A가 말해진 문장에서 각 의미가 함께 말해질 확률. 반환 dict(의미 → (p, lo, hi, n_A, n_AM))."""
        key = ("의미", A, 관법, tuple(sorted(맥락)))
        if key in self._cache:
            return self._cache[key]
        idx = self.S[:, self.ci[A]].indices
        idx = idx[self.행(관법, 맥락)[idx]]
        n_A = int(len(idx))
        n_AM = np.asarray(self.Sm[idx].sum(axis=0)).ravel() if n_A else np.zeros(len(self.mcols))
        if 이전 is None:
            if 맥락 or 관법:
                parent = self.의미분포(A, 관법 if 맥락 else None, ()) if (맥락 or 관법) else None
                prior = np.array([parent[m][0] for m in self.meanings])
            else:
                prior = self.기준률()
        else:
            prior = 이전
        a = n_AM + self.α * prior
        b = (n_A - n_AM) + self.α * (1 - prior)
        p = a / (a + b)
        lo = _beta.ppf(0.05, a, b); hi = _beta.ppf(0.95, a, b)
        out = {m: (float(p[i]), float(lo[i]), float(hi[i]), n_A, int(n_AM[i])) for i, m in enumerate(self.meanings)}
        self._cache[key] = out
        return out

    def 기준률(self, 관법=None):
        key = ("기준", 관법)
        if key in self._cache:
            return self._cache[key]
        rows = self.행(관법)
        n = rows.sum()
        cnt = np.asarray(self.Sm[np.flatnonzero(rows)].sum(axis=0)).ravel()
        r = (cnt + 1) / (n + 2)
        self._cache[key] = r
        return r

    # ── 조건: 어떤 상대 개념이 A→M 확률을 올리고 내리나
    def 조건효과(self, A, M, 후보=None, 관법=None, 최소=30):
        """P(M|A,C) vs P(M|A,¬C). 반환 [(C, p_with, p_without, n_with, 로그오즈차, z)] 내림차순."""
        a_rows = self.행(관법) & self._col(self.S, self.ci[A])
        m_col = self._col(self.S, self.ci["의:" + M]) if not M.startswith("의:") else self._col(self.S, self.ci[M])
        out = []
        for c in (후보 or self.nodes):
            if c == A:
                continue
            cc = self._col(self.C, self.ni[c])
            w = a_rows & cc; wo = a_rows & ~cc
            n1, n0 = int(w.sum()), int(wo.sum())
            if n1 < 최소 or n0 < 최소:
                continue
            k1, k0 = int((w & m_col).sum()), int((wo & m_col).sum())
            p1 = (k1 + 0.5) / (n1 + 1); p0 = (k0 + 0.5) / (n0 + 1)
            lo = np.log(p1 / (1 - p1)) - np.log(p0 / (1 - p0))
            se = np.sqrt(1 / (k1 + 0.5) + 1 / (n1 - k1 + 0.5) + 1 / (k0 + 0.5) + 1 / (n0 - k0 + 0.5))
            out.append((c, p1, p0, n1, float(lo), float(lo / se)))
        out.sort(key=lambda x: -abs(x[5]))
        return out

    # ── 개념끼리: 강도·거리 (문단 단위)
    def 공기(self, 관법=None, 맥락=()):
        key = ("공기", 관법, tuple(sorted(맥락)))
        if key in self._cache:
            return self._cache[key]
        q = self.qbase.copy()
        if 관법:
            q &= self.qkw == self.ki[관법]
        for c in 맥락:
            q &= self.Q[:, self.ni[c]].toarray().ravel().astype(bool)
        X = self.Q[q].astype(np.float32)
        co = (X.T @ X).toarray()
        n = np.diag(co).copy()
        self._cache[key] = (co, n, int(q.sum()))
        return self._cache[key]

    def 강도(self, A, B, 관법=None, 맥락=()):
        co, n, N = self.공기(관법, 맥락)
        i, j = self.ni[A], self.ni[B]
        if n[i] == 0 or n[j] == 0:
            return 0.0
        return float(co[i, j] / np.sqrt(n[i] * n[j]))

    def 거리행렬(self, 관법=None, 맥락=(), 최소공기=5):
        from scipy.sparse.csgraph import dijkstra
        key = ("거리", 관법, tuple(sorted(맥락)), 최소공기)
        if key in self._cache:
            return self._cache[key]
        co, n, N = self.공기(관법, 맥락)
        with np.errstate(divide="ignore", invalid="ignore"):
            s = co / np.sqrt(np.outer(n, n))
        s[co < 최소공기] = 0
        np.fill_diagonal(s, 0)
        w = np.where(s > 0, -np.log(np.clip(s, 1e-12, 1)), 0)
        d = dijkstra(sparse.csr_matrix(w), directed=False)
        self._cache[key] = d
        return d

    def 거리(self, A, B, 관법=None, 맥락=()):
        d = self.거리행렬(관법, 맥락)
        return float(d[self.ni[A], self.ni[B]])

    # ── 개념 카드: 무엇인지 + 의미 확률 + 가까운 개념
    def 카드(self, A, 관법=None, 맥락=(), k=8):
        dist = self.의미분포(A, 관법, 맥락)
        base = self.기준률(관법)
        rows = []
        for i, m in enumerate(self.meanings):
            p, lo, hi, nA, nAM = dist[m]
            rows.append((m, p, lo, hi, p / base[i], nAM))
        rows.sort(key=lambda r: -r[4])
        d = self.거리행렬(관법, 맥락)
        i = self.ni[A]
        near = sorted(((self.nodes[j], float(d[i, j])) for j in range(len(self.nodes)) if j != i and np.isfinite(d[i, j])), key=lambda x: x[1])[:k]
        return {"개념": A, "문장수": dist[self.meanings[0]][3], "의미": rows, "가까운": near}


@lru_cache(maxsize=1)
def 정의():
    p = HERE / "data" / "정의_정제본.jsonl"
    out = {}
    if p.exists():
        for l in p.read_text(encoding="utf-8").splitlines():
            if l.strip():
                r = json.loads(l)
                out[r.get("개념") or r.get("concept")] = r.get("정의") or r.get("definition")
    return out


if __name__ == "__main__":
    import sys
    A = sys.argv[1] if len(sys.argv) > 1 else "편관(칠살)"
    net = 망()
    c = net.카드(A)
    print(f"■ {A} — {정의().get(A, '(정의 없음)')}")
    print(f"  말해진 문장 {c['문장수']:,}")
    print("  의미(확률 · 90%구간 · 기준 대비 배수 · 함께 말해진 문장)")
    for m, p, lo, hi, lift, k in c["의미"][:12]:
        print(f"    {m:8s} {p:.3f} [{lo:.3f}–{hi:.3f}] ×{lift:.2f} ({k})")
    print("  가까운 개념(거리)")
    for b, dd in c["가까운"]:
        print(f"    {b} {dd:.2f}")
