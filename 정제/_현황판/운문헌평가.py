# -*- coding: utf-8 -*-
"""
운 문헌 대조 — 고수가 «이 일주에 이 해(세운)가 오면»을 쓴 신년운세 글 vs 망의 세운 풀이.

운 사건 대조(운평가.py)는 정답이 38건뿐이고, 교과서 손 규칙(남 재성·여 관성 해 = 결혼 등)으로 맞혀도 0.50이라
좋은 이론과 나쁜 이론을 가르지 못한다. 여기서는 운 풀이를 다른 잣대처럼 «고수 풀이와의 일치»로 잰다.
  · 정답 글 = 코퍼스가 학습에서 빼 둔 운세 격자 글(현묘) — 학습 원장에 없다(자연 홀드아웃).
      해: «YYYY년 XX년 운세(XX일주)» 60일주 × 해 · 달: «YYYY년 M월 X일간 운세(XX년 XX월)» 10일간 × 달(예측은 그 일간 6일주 평균)
    원장에 같은 제목 글(사본)이 있으면 그 글도 망에서 뺀다.
  · 강조 = 그 글이 같은 일주(일간)의 다른 해(달) 글보다 더/덜 말한 의미(log((c+0.5)/(n·r+0.5))) — 해마다 달라지는 몫만 남긴다.
  · 예측 = 그 해(달) 간지의 운 신호(명식.운_신호) → 합산(세운·월운 문단의 확률), 후보 해(달)들 사이에서 의미마다 중심화.
  · 잣대 = 정답 해(달) 순위(0=1등, 무작위 0.5): 강조와 예측의 순위상관으로 후보를 줄 세운다.
          손 규칙 기준선(그해 천간·지지 십성 무리의 일간 대비 «교과서 의미» 표)도 같은 잣대로 잰다.
⚠ 문헌 속 고수 풀이와의 일치다. 개인 적중이 아니다.
"""
import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import 망 as M, 명식 as Mi, 풀이 as P, 평가 as E

_G = "|".join(E.GANJI60)
_TITLE = re.compile(rf"(20\d\d)\s?년\s?({_G})\s?년\s?운세\s?\(\s?({_G})\s?일주\s?\)")
_MONTH = re.compile(rf"(20\d\d)\s?년\s?(\d+)\s?월\s?([갑을병정무기경신임계])[목화토금수]\s?일간\s?운세\s?\(\s?({_G})\s?년\s?({_G})\s?월")


def _정규(t):
    return re.sub(r"\W", "", t or "")


def 정답_글(net, 종류="해"):
    """학습에서 빠진 운세 글 → {post_id: {"주"(일주 또는 일간), "때"(해 또는 (해, 달)), "간지", "c"(의미 수), "n"(문장 수), "사본"}}.
    종류 "해" = 신년운세(일주별) · "달" = 이달의 운세(일간별)."""
    import 코퍼스, build_망, 의미
    mi = {m: i for i, m in enumerate(net.meanings)}
    글 = {}
    for r in 코퍼스.문단들(격자=True):
        m = (_TITLE if 종류 == "해" else _MONTH).search(r["title"] or "")
        if not m or r["post_id"] in net.pi:
            continue
        주, 때, 간지 = ((m.group(3), int(m.group(1)), m.group(2)) if 종류 == "해"
                     else (m.group(3), (int(m.group(1)), int(m.group(2))), m.group(5)))
        g = 글.setdefault(r["post_id"], {"주": 주, "때": 때, "간지": 간지, "제목": _정규(r["title"]),
                                         "c": np.zeros(len(net.meanings)), "n": 0})
        for s in build_망.문장들(build_망.전사_교정(r["text"])):
            g["n"] += 1
            for x in 의미.의미들(s):
                g["c"][mi[x]] += 1
    # 원장 안의 사본(같은 제목) — 그 글을 망에서 뺀다
    want = {g["제목"] for g in 글.values()}
    사본 = defaultdict(set)
    for r in 코퍼스.문단들():
        k = _정규(r["title"])
        if k in want and r["post_id"] in net.pi:
            사본[k].add(net.pi[r["post_id"]])
    for g in 글.values():
        g["사본"] = sorted(사본.get(g["제목"], ()))
    return {p: g for p, g in 글.items() if g["n"] >= 5}


# 손 규칙 기준선: 십성 무리 → 교과서가 그 운에 붙이는 의미(구현 가정, 비교용 — 망 계산에는 안 쓴다)
_손 = {"비겁 일반": ["형제·친구", "독립·자유", "재물 손실", "욕심·승부"],
      "식상 일반": ["표현·언변", "창의·재주", "자녀", "사업·창업"],
      "재성 일반": ["재물 축적", "사업·창업", "연애·이성", "결혼·배우자"],
      "관성 일반": ["직장·조직", "승진·출세", "명예·체면", "구설·송사"],
      "인성 일반": ["학업·시험", "문서·부동산", "부모·조상", "지식·탐구"]}


def _손예측(net, 일주, 간지):
    ds = Mi.STEMS.index(일주[0])
    us, ub = Mi.간지(간지)
    v = np.zeros(len(net.meanings))
    for t in (Mi.십성(ds, us), Mi.십성(ds, Mi.BRANCH_MAIN[ub])):
        for m in _손[Mi.GROUP[t]]:
            v[net.meanings.index(m)] += 1
    return v


def _예측(net, 주, 간지, 종류):
    """운 신호 → 합산. 일간만 아는 월운은 그 일간의 6일주 평균(구현 가정)."""
    if 종류 == "해":
        return P.합산(net, Mi.운_신호([None, None, 주, None], 간지, "세운"), None, ("세운(연운)",))[0]
    js = [g for g in E.GANJI60 if g[0] == 주]
    return np.mean([P.합산(net, Mi.운_신호([None, None, j, None], 간지, "월운"), None, ("월운",))[0] for j in js], axis=0)


def _손평균(net, 주, 간지):
    return np.mean([_손예측(net, j, 간지) for j in ([주] if len(주) == 2 else [g for g in E.GANJI60 if g[0] == 주])], axis=0)


def 대조(net, 종류="해"):
    글 = 정답_글(net, 종류)
    by = defaultdict(list)
    for p, g in 글.items():
        by[g["주"]].append(p)
    rk_net, rk_hand, rows = [], [], []
    for j, ps in sorted(by.items()):
        if len(ps) < 3:
            continue
        때들 = sorted({글[p]["때"] for p in ps})
        간지 = {글[p]["때"]: 글[p]["간지"] for p in ps}
        ex = sorted({i for p in ps for i in 글[p]["사본"]})
        hold = M.망.__new__(M.망); hold.__dict__.update(net.__dict__); hold._cache = {}
        hold.base = net.base & ~np.isin(net.post, ex)
        V = np.array([_예측(hold, j, 간지[t], 종류) for t in 때들])
        Z = (V - V.mean(0)) / (V.std(0) + 1e-6)
        H = np.array([_손평균(net, j, 간지[t]) for t in 때들])
        Hz = H - H.mean(0)
        for p in ps:
            g = 글[p]
            oth = [q for q in ps if q != p]
            r = (sum(글[q]["c"] for q in oth) + 1) / (sum(글[q]["n"] for q in oth) + 2)
            emph = np.log((g["c"] + 0.5) / (g["n"] * r + 0.5))
            k = 때들.index(g["때"])
            for mat, out in ((Z, rk_net), (Hz, rk_hand)):
                cs = np.nan_to_num(np.array([E.spearman(mat[i], emph) for i in range(len(때들))]), nan=0.0)
                out.append(float((cs > cs[k]).sum() + 0.5 * ((cs == cs[k]).sum() - 1)) / (len(때들) - 1))
            rows.append((j, g["때"], rk_net[-1], rk_hand[-1]))
    return {"글": len(rows), "단위": len({r[0] for r in rows}), "망_순위": float(np.mean(rk_net)) if rows else None,
            "손규칙_순위": float(np.mean(rk_hand)) if rows else None, "무작위": 0.5, "_rows": rows}


def 실행(보기=True):
    net = M.망()
    out = {"해": 대조(net, "해"), "달": 대조(net, "달")}
    if 보기:
        y, m = out["해"], out["달"]
        for t in sorted({r[1] for r in y["_rows"]}):
            a = [r[2] for r in y["_rows"] if r[1] == t]; b = [r[3] for r in y["_rows"] if r[1] == t]
            print(f"  {t}년 {len(a):2d}편 · 망 {np.mean(a):.3f} · 손 규칙 {np.mean(b):.3f}")
        print(f"[운 문헌 대조·해] 신년운세 {y['글']}편({y['단위']}일주) · 정답 해 순위 망 {y['망_순위']:.3f} · 손 규칙 {y['손규칙_순위']:.3f} (0=1등, 무작위 0.5)")
        print(f"[운 문헌 대조·달] 월운 {m['글']}편({m['단위']}일간) · 정답 달 순위 망 {m['망_순위']:.3f} · 손 규칙 {m['손규칙_순위']:.3f}")
    for v in out.values():
        v.pop("_rows")
    return out


if __name__ == "__main__":
    실행()
