# -*- coding: utf-8 -*-
"""
개념 카드 — 한 개념의 지표를 한 장에: 무엇인지 · 무엇을 나타낼 확률 · 그 확률을 바꾸는 조건 · 다른 개념과의 거리 · 관법별 차이.

값은 저장하지 않고 원장(build_망.py)에서 부를 때마다 센다(망.py). 그래서 --관법(이론 베이스)·--맥락(상대 개념)을 바꾸면 값이 바뀐다.
  확률 = 그 개념이 말해진 문장에서 그 의미가 함께 말해질 확률(문헌 지지, 베타 수축, 90% 구간). 개인 적중률이 아니다.
  배수 = 확률 ÷ 기준률(아무 문장에서나 그 의미가 말해질 확률).
  조건 = 같은 문단에 어떤 개념이 함께 있을 때 그 확률이 오르내리는 정도(로그 오즈 차, z ≥ 2만).
  거리 = −ln(문단 공기 강도) 최단 경로. 강도 = 오치아이 n(A∧B)/√(n(A)n(B)).
  닮음 = 두 개념의 의미 배수(로그) 벡터 코사인 — 같이 말해지지 않아도 같은 뜻 쪽으로 기우는 정도(문장 200개 이상인 개념끼리).

사용
  python 개념카드.py 편관(칠살)
  python 개념카드.py 편관(칠살) --관법 현묘 --맥락 월지
  python 개념카드.py 도화 --대상 연애·이성        # 의미 하나를 콕 집어 조건·근거
  python 개념카드.py 도화 --거리 홍염             # 특정 개념까지 거리·경로
"""
import argparse, json, sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import 망 as M


def 정의문(A):
    d = M.정의().get(A)
    if d:
        return d
    if A.startswith("간지:"):
        return f"{A[3:]} 일주 — 일간 {A[3]}이(가) 일지 {A[4]} 위에 앉은 60갑자의 한 짝(정의 없음: 일주론 글의 말로 대신 본다)."
    if A.startswith("의:"):
        import 의미
        return f"의미 노드 — 문장에서 이 표기로 찾는다: {의미.MEANINGS[A[2:]][1]}"
    return "(정의 없음)"


def 카드(net, A, 관법=None, 맥락=(), 대상=None, 거리대상=None, k의미=8, k조건=3, 근거=True):
    out = {"개념": A, "정의": 정의문(A), "관법": 관법 or "전체", "맥락": list(맥락)}
    dist = net.의미분포(A, 관법, tuple(맥락))
    base = net.기준률(관법, tuple(맥락))
    nA = dist[net.meanings[0]][3]
    out["문장수"] = nA
    rows = []
    for i, m in enumerate(net.meanings):
        p, lo, hi, _, k = dist[m]
        rows.append({"의미": m, "확률": p, "구간": [lo, hi], "배수": p / base[i], "함께": k})
    rows.sort(key=lambda r: -r["배수"])
    out["의미"] = rows[:k의미]
    out["덜함"] = sorted(rows, key=lambda r: r["배수"])[:3]
    targets = [대상] if 대상 else [r["의미"] for r in rows[:3]]
    # 조건: 후보 = 이 개념과 같은 문단에 30번 이상 함께 나온 개념
    co, n, N = net.공기(관법)
    i = net.ni[A]
    cand = [net.nodes[j] for j in np.flatnonzero(co[i] >= 30) if j != i]
    out["조건"] = {}
    for m in targets:
        eff = [e for e in net.조건효과(A, m, cand, 관법, 최소=30) if abs(e[5]) >= 2]
        up = [e for e in eff if e[4] > 0][:k조건]
        dn = [e for e in eff if e[4] < 0][:k조건]
        out["조건"][m] = {"올림": [{"조건": e[0], "함께일때": e[1], "없을때": e[2], "문장": e[3], "z": e[5]} for e in up],
                         "내림": [{"조건": e[0], "함께일때": e[1], "없을때": e[2], "문장": e[3], "z": e[5]} for e in dn]}
    # 관법별 — 같은 개념·같은 의미가 이론 베이스마다 얼마나 달리 말해지나
    kws = []
    for kw in net.관법들:
        d = net.의미분포(A, kw, ())
        if d[net.meanings[0]][3] >= 30:
            kws.append((kw, d))
    out["관법별"] = {m: {kw: d[m][0] for kw, d in kws} for m in targets}
    # 거리
    d = net.거리행렬(관법, tuple(맥락))
    near = sorted(((net.nodes[j], float(d[i, j]), net.강도(A, net.nodes[j], 관법, tuple(맥락)))
                   for j in range(len(net.nodes)) if j != i and np.isfinite(d[i, j])), key=lambda x: x[1])[:8]
    out["가까운"] = [{"개념": b, "거리": x, "강도": s} for b, x, s in near]
    out["닮은"] = [{"개념": b, "닮음": c} for b, c in net.닮은개념(A, 관법, k=6)] if nA >= 200 else []
    if 거리대상:
        out["거리대상"] = {"대상": 거리대상, "거리": net.거리(A, 거리대상, 관법, tuple(맥락)),
                       "경로": net.경로(A, 거리대상, 관법, tuple(맥락))}
    if 근거:
        out["근거문장"] = {m: net.근거문장(A, m, 관법, tuple(맥락), k=2) for m in targets}
    return out


def 보이기(c):
    ctx = f" · 맥락 {'+'.join(c['맥락'])}" if c["맥락"] else ""
    print(f"■ {c['개념']}  (관법 {c['관법']}{ctx} · 말해진 문장 {c['문장수']:,})")
    print(f"  무엇: {c['정의']}")
    print("  나타낼 확률(문헌 지지) — 확률 [90% 구간] · 기준 대비 배수 · 함께 말해진 문장")
    for r in c["의미"]:
        print(f"    {r['의미']:8s} {r['확률']:.3f} [{r['구간'][0]:.3f}–{r['구간'][1]:.3f}] ×{r['배수']:.2f} ({r['함께']})")
    print("  덜 말해지는 것: " + " · ".join(f"{r['의미']} ×{r['배수']:.2f}" for r in c["덜함"]))
    for m, e in c["조건"].items():
        up = " · ".join(f"{x['조건']} {x['없을때']:.3f}→{x['함께일때']:.3f}(z{x['z']:+.1f})" for x in e["올림"]) or "없음"
        dn = " · ".join(f"{x['조건']} {x['없을때']:.3f}→{x['함께일때']:.3f}(z{x['z']:+.1f})" for x in e["내림"]) or "없음"
        print(f"  조건 [{m}] 올림: {up}")
        print(f"  {' ' * (len(m) + 7)}내림: {dn}")
    for m, kv in c["관법별"].items():
        if kv:
            vals = sorted(kv.items(), key=lambda x: -x[1])
            print(f"  관법별 [{m}]: " + " · ".join(f"{k} {v:.3f}" for k, v in vals))
    print("  가까운 개념(거리 · 강도): " + " · ".join(f"{x['개념']} {x['거리']:.2f}·{x['강도']:.2f}" for x in c["가까운"]))
    if c.get("닮은"):
        print("  뜻이 닮은 개념(의미 닮음): " + " · ".join(f"{x['개념']} {x['닮음']:.2f}" for x in c["닮은"]))
    if "거리대상" in c:
        g = c["거리대상"]
        path = " → ".join(f"{b}({s:.2f})" if k else b for k, (b, s) in enumerate(g["경로"]))
        print(f"  거리 {c['개념']} ↔ {g['대상']}: {g['거리']:.2f}  경로 {path or '없음'}")
    for m, ev in c.get("근거문장", {}).items():
        for e in ev:
            print(f"  근거 [{m}·{e['출처']}] {e['문장']}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("개념")
    ap.add_argument("--관법")
    ap.add_argument("--맥락", nargs="*", default=[])
    ap.add_argument("--대상")
    ap.add_argument("--거리")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    net = M.망()
    c = 카드(net, a.개념, a.관법, a.맥락, a.대상, a.거리)
    if a.json:
        print(json.dumps(c, ensure_ascii=False, indent=1, default=float))
    else:
        보이기(c)
