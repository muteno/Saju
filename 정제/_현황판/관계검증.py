# -*- coding: utf-8 -*-
"""개념→개념 확률 검증: 글 단위 교차검증으로 문단 공기 예측을 잰다.

실제 망.개념분포를 호출한다. 도식의 상위 이웃·최소 근거 필터를 쓰지 않고
양성/음성 모두 채점한다. 자기 자신과 이미 주어진 맥락은 정답에서 제외한다.
로그손실·Brier는 작을수록 좋다. 문헌 재현 시험이며 개인 적중 측정은 아니다.
"""
import argparse
import copy
import json
import zlib
from pathlib import Path

import numpy as np

import 망 as M


def 실행(net=None, 겹=5, 조건=None):
    net = net if net is not None else M.망()
    if 겹 < 2:
        raise ValueError("교차검증은 2겹 이상이어야 한다")
    if 조건 is None:
        조건 = [("관법:" + k, k, ()) for k in net.관법들]
        조건 += [(c, None, (c,)) for c in ("대운", "세운(연운)", "월지", "일지") if c in net.ni]
    specs = [("전체", None, ())] + list(조건)
    totals = {name: {"판정수": 0, "출발문단수": 0, "기준손실": 0.0, "관계손실": 0.0,
                     "기준Brier": 0.0, "관계Brier": 0.0} for name, _, _ in specs}
    post_fold = np.array([zlib.crc32(p.encode()) % 겹 for p in net.post_ids])
    fold_sizes = []
    for f in range(겹):
        tr, te = copy.copy(net), copy.copy(net)
        tr._cache, te._cache = {}, {}
        tr.base, te.base = net.base & (post_fold[net.post] != f), net.base & (post_fold[net.post] == f)
        tr.qbase, te.qbase = net.qbase & (post_fold[net.qpost] != f), net.qbase & (post_fold[net.qpost] == f)
        fold_sizes.append({"학습문단": int(tr.qbase.sum()), "평가문단": int(te.qbase.sum())})
        if not tr.qbase.any() or not te.qbase.any():
            raise ValueError("빈 학습/평가 겹이 있다. 더 많은 글 또는 더 적은 겹이 필요하다")
        global_base = tr.개념기준률()
        plain = {A: tr.개념분포(A) for A in net.nodes}
        for name, school, context in specs:
            co, ns, _ = te.공기(school, context)
            acc = totals[name]
            for i, A in enumerate(net.nodes):
                n = int(ns[i])
                if not n:
                    continue
                d = tr.개념분포(A, school, context)
                targets = [j for j, B in enumerate(net.nodes) if B != A and B not in context]
                if not targets:
                    continue
                p = np.array([d[net.nodes[j]][0] for j in targets])
                # 전체: 빈도→관계, 조건: 조건 없는 관계→조건별 관계. 같은 평가 문단·대상을 비교한다.
                p0 = global_base[targets] if name == "전체" else np.array([plain[A][net.nodes[j]][0] for j in targets])
                k = co[i, targets].astype(float)
                for prefix, pred in (("기준", p0), ("관계", p)):
                    pred = np.clip(pred, 1e-9, 1 - 1e-9)
                    acc[prefix + "손실"] += float(-(k * np.log(pred) + (n - k) * np.log1p(-pred)).sum())
                    acc[prefix + "Brier"] += float((k * (1 - pred) ** 2 + (n - k) * pred ** 2).sum())
                acc["판정수"] += n * len(targets)
                acc["출발문단수"] += n
    for v in totals.values():
        n = v["판정수"]
        for key in ("기준손실", "관계손실", "기준Brier", "관계Brier"):
            v[key] = v[key] / n if n else None
        v["손실개선%"] = 100 * (1 - v["관계손실"] / v["기준손실"]) if n and v["기준손실"] else None
    return {"주의": "문헌 재현·글 단위 분리. 문단/개념쌍은 서로 의존하며 개인 적중률이 아니다.",
            "분할": "글 id crc32 % 겹", "겹": 겹, "분할크기": fold_sizes,
            "추정": {"α": net.α, "최소성공": net.최소성공}, "결과": totals}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--출력", type=Path)
    a = ap.parse_args()
    result = 실행()
    text = json.dumps(result, ensure_ascii=False, indent=1, allow_nan=False) + "\n"
    if a.출력:
        a.출력.write_text(text, encoding="utf-8")
    print(text, end="")
