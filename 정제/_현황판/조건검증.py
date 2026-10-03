# -*- coding: utf-8 -*-
"""
조건 검증 — «관계 확률은 관법·맥락에 따라 달라진다»가 안 본 글에서도 맞나.

망은 P(의미|개념)을 조건(관법·대운·세운·성별·자리)마다 따로 세고, 부모 확률로 수축한다(망.의미분포).
그 조건별 값이 우연(과적합)이면 안 본 글에서는 조건 없는 값보다 못 맞힌다.
  · 5겹 교차(글 단위로 나눔 — 같은 글 문장이 학습·평가에 함께 들지 않는다)
  · 잣대 = 평가 글 문장의 (개념, 의미 55개) 베르누이 로그우도 / 문장-개념 쌍
  · 비교 = 의미 빈도만(개념 든 문장) → 조건 없는 P(의미|개념) → 조건별 P(의미|개념, 조건)  (수축 상수는 망과 같다)
  · 개선% = (조건 없음 − 조건) / |조건 없음| — 0보다 크면 그 조건의 차이가 안 본 글에서 재현된다
⚠ 문헌 속 문장끼리의 일치다. 개인 적중이 아니다.
"""
import sys
import zlib
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import 망 as M

조건들 = {"대운": ["대운"], "세운": ["세운(연운)"], "성별": ["성:남", "성:여"], "월지": ["월지"], "일지": ["일지"]}


def 실행(보기=True, 겹=5):
    net = M.망()
    S = net.S.tocsr()[:, :len(net.nodes)].astype(np.float64).tocsr()
    Y = net.Sm_raw.tocsr().astype(np.float64)
    fold = np.array([zlib.crc32(p.encode()) % 겹 for p in net.post_ids])[net.post]

    def 셈(rows):
        r = np.flatnonzero(rows)
        return np.asarray(S[r].sum(0)).ravel(), (S[r].T @ Y[r]).toarray(), len(r), np.asarray(Y[r].sum(0)).ravel()

    def 수축(nA, nAM, prior):
        α = np.maximum(net.α, net.최소성공 / np.clip(prior, 1e-9, 1)) if net.최소성공 else net.α
        return (nAM + α * prior) / (nA[:, None] + α)

    def 우도(p, nA, nAM):
        p = np.clip(p, 1e-9, 1 - 1e-9)
        return float((nAM * np.log(p) + (nA[:, None] - nAM) * np.log(1 - p)).sum())

    def 열(name):
        out = np.zeros(S.shape[0], dtype=bool)
        out[net.C[:, net.ni[name]].indices] = True
        return out

    가름 = {"관법": [net.kw == k for k in range(len(net.관법들))]}
    가름.update({g: [열(c) for c in cs] for g, cs in 조건들.items()})
    개념문장 = np.asarray(S.sum(1)).ravel() > 0
    합 = {g: [0.0, 0.0, 0] for g in ["(관계)"] + list(가름)}     # [조건 없음, 조건, 쌍]
    for f in range(겹):
        tr, te = fold != f, fold == f
        nA, nAM, n, ym = 셈(tr)
        base = np.broadcast_to((ym + 1) / (n + 2), nAM.shape)   # 망과 같은 사전(문장 전체 기준률)
        p0 = 수축(nA, nAM, base)
        tA, tAM, _, _ = 셈(te)
        hc = np.flatnonzero(tr & 개념문장)                     # 비교 잣대는 «개념이 든 문장»의 의미 빈도(공정 비교)
        bc = np.broadcast_to((np.asarray(Y[hc].sum(0)).ravel() + 1) / (len(hc) + 2), nAM.shape)
        합["(관계)"][0] += 우도(bc, tA, tAM); 합["(관계)"][1] += 우도(p0, tA, tAM); 합["(관계)"][2] += tA.sum()
        for g, masks in 가름.items():
            for ci, cm in enumerate(masks):
                tA, tAM, _, _ = 셈(te & cm)
                if tA.sum() == 0:
                    continue
                cA, cAM, _, _ = 셈(tr & cm)
                pc = 수축(cA, cAM, p0)
                if g != "관법":
                    # P(M|A,A)=P(M|A): 망.의미분포와 같이 출발 개념을 조건으로 두 번 갱신하지 않는다.
                    ai = net.ni[조건들[g][ci]]
                    pc[ai] = p0[ai]
                합[g][0] += 우도(p0, tA, tAM); 합[g][1] += 우도(pc, tA, tAM); 합[g][2] += tA.sum()
    out = {}
    for g, (a, b, k) in 합.items():
        out[g] = {"쌍": int(k), "조건없음": a / k, "조건": b / k, "개선%": 100 * (b - a) / abs(a)}
    if 보기:
        r = out.pop("(관계)")
        print(f"[관계] 의미 빈도만 {r['조건없음']:.4f} → P(의미|개념) {r['조건']:.4f} (로그우도/쌍, 개선 {r['개선%']:.1f}%)")
        for g, v in out.items():
            print(f"[조건 {g}] 쌍 {v['쌍']:,} · 조건 없음 {v['조건없음']:.4f} → 조건별 {v['조건']:.4f} (개선 {v['개선%']:+.1f}%)")
        out["(관계)"] = r
    return out


if __name__ == "__main__":
    실행()
