# -*- coding: utf-8 -*-
"""
사례 대조 — 고수가 «실제 한 사람의 명식»을 놓고 쓴 풀이와, 망이 같은 명식을 본 결과를 견준다.

일주 대조(평가.py)는 일주 두 글자만 본다. 여기서는 연·월·일(·시) 전체 명식이다.
사례 = 글에 그 사람의 명식(간지)이나 생년월일(시)이 적혀 있고, 그 명식을 풀이한 글(아래 표, 손으로 고른 29건).
  · 가상의 예시 명식·사주 세우는 법·두 사람을 섞은 궁합 글은 뺐다.
  · 생년월일만 있으면 앱 만세력으로 기둥을 세운다(시를 모르면 연·월·일).

잣대
  · 그 글을 망에서 뺀 채(같은 글의 웹·전사 사본까지) 예측한다.
  · 정답 = 그 글이 그 고수의 평소 틀보다 더/덜 말한 의미(강조 편차, 평가.편차).
  · 순위 = 진짜 명식과 무작위 명식 199개(기둥 수를 맞춤) 중, 강조 편차와 가장 닮은 예측이 진짜 명식인가.
    0 = 1등, 1 = 꼴찌, 무작위 0.5.
⚠ 사례 29건 — 수치는 방향만 본다. 문헌 속 고수 풀이와의 일치이지 그 사람 삶의 적중이 아니다.
"""
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import 망 as M, 명식 as Mi, 평가 as E, 풀이 as P

# (이름, 글 id들, 기둥 또는 생년월일시, 성별, 근거 문장)
사례 = [
    ("초명 본인", ["CT-P027", "T-2e7862dc48"], (1985, 9, 4, 14), "M", "「1985년 9월 4일에 태어났고요 미시에 태어났어요」"),
    ("천명도사", ["DT-P229", "T-6136d1db80"], ["계유", "병진", "갑신", None], None, "「제가 계유년 병진월 갑신일이에요」"),
    ("세종대왕", ["HM-P043"], ["경자", "병술", "갑신", None], "M", "「경자년 병술월 갑신일」(현묘 판본)"),
    ("유명희", ["HM-P045"], (1967, 6, 5, None), "F", "「1967년 6월 5일」 시 모름"),
    ("박나래", ["HM-P257"], ["을축", "병술", "병신", "경자"], "F", "현묘 인시일수론 판본(병신일 경자시)"),
    ("석우당 삼촌", ["T-f02f4ce4ac"], ["신축", "병신", "을유", "병술"], "M", "「신축년 병신월 을유일 병술 남자」"),
    ("어부", ["T-fe1adb8499"], (1955, 7, 2, None), "M", "「1955년 7월 2일생」"),
    ("케네디", ["T-5252f72aa4", "T-291ec467c7"], ["정사", "을사", "신미", "병신"], "M", "「1917년 5월 29일 15시」"),
    ("정윤정", ["PL-READ-P021"], (1976, 6, 14, None), "F", "「1976년 6월 14일생」"),
    ("리사 수", ["PL-FAMOUS-P009"], (1969, 11, 7, None), "F", "「1969년 11월 7일 생」"),
    ("이상원", ["T-0432d51db2"], (2003, 5, 8, None), "M", "「양력 2003년 5월 8일 생」 시 모름"),
    # 261001 추가 — 글에 생년월일이 적힌 실제 인물 풀이(사망일·불확실 날짜인 글은 뺐다: 엘비스·먼로·잡스·모택동)
    ("오드리 햅번", ["PL-FAMOUS-P007"], (1929, 5, 4, None), "F", "「1929년 5월 4일」"),
    ("이관희", ["T-afc338f8f6"], (1988, 4, 29, None), "M", "「1988년 4월 29일」"),
    ("지드래곤", ["T-cb9e0783db"], (1988, 8, 18, None), "M", "「1988년 8월 18일」"),
    ("임창정", ["DR-P025"], (1973, 11, 30, None), "M", "「1973년 11월 30일」"),
    ("체 게바라", ["HM-P064"], (1928, 6, 14, None), "M", "「1928년 6월 14일」"),
    ("네타냐후", ["PL-FAMOUS-P001"], (1949, 10, 21, None), "M", "「1949년 10월 21일」"),
    ("트럼프", ["PL-FAMOUS-P002"], (1946, 6, 14, None), "M", "「1946년 6월 14일」"),
    ("노무현", ["PL-READ-P007"], (1946, 9, 1, None), "M", "「1946년 9월 1일」"),
    ("정명석", ["PL-READ-P013"], (1945, 3, 16, None), "M", "「양력 1945년 3월 16일」(글이 든 판본)"),
    ("에바 페론", ["PL-READ-P024"], (1919, 5, 7, None), "F", "「1919년 5월 7일」"),
    ("임영웅", ["T-ec43f12e9d"], (1991, 6, 16, None), "M", "「1991년 6월 16일」"),
    ("박수근", ["HM-P069"], (1914, 2, 21, None), "M", "「1914년 2월 21일」"),
    ("김지훈", ["T-3f5dac9a20"], (1981, 5, 9, None), "M", "「1981년 5월 9일」"),
    ("이사벨 페론", ["PL-READ-P023"], (1931, 2, 4, None), "F", "「1931년 2월 4일」"),
    ("오나시스", ["T-590902516c"], (1906, 1, 15, None), "M", "「1906년 1월 15일」"),
    ("정관격 여명", ["PL-READ-P016"], (1990, 3, 23, None), "F", "「1990년 3월 23일」"),
    ("서세원", ["PL-READ-P018"], (1956, 3, 18, None), "M", "「약력 출생 : 1956년 3월 18일」"),
    ("김대호", ["T-3b6f9cfe20"], (1984, 10, 8, None), "M", "「1984년 10월 8일 남자」 시 모름"),
]


def 기둥_of(x, 성별):
    if isinstance(x, list):
        return x
    y, m, d, h = x
    return P.만세력(y, m, d, h, 0, 성별 or "M")["기둥"]


def 실행(n후보=199, seed=11, 보기=True, 관법적용=False):
    net = M.망()
    none = np.zeros(len(net.post), dtype=bool)
    rng = np.random.default_rng(seed)
    rows = []
    for name, pids, x, 성별, why in 사례:
        pids = [p for p in pids if p in net.pi]
        if not pids:
            continue
        기둥 = 기둥_of(x, 성별)
        hold = M.망.__new__(M.망); hold.__dict__.update(net.__dict__); hold._cache = {}
        hold.base = net.base & ~np.isin(net.post, [net.pi[p] for p in pids])
        # 정답: 사본이 여럿이면 편차를 평균한다
        src_kw = net.관법들[net.kw[np.flatnonzero(net.post == net.pi[pids[0]])[0]]]
        g = np.mean([E.편차(net, p, src_kw if src_kw in net.ki else None, none) for p in pids], axis=0)
        시주 = 기둥[3] is not None
        cands = [기둥] + [P.무작위_명식(rng, 시주)[0] for _ in range(n후보)]
        kwu = (src_kw if src_kw in net.ki and src_kw != "기타" else None) if 관법적용 else None
        S = np.array([P.합산(hold, Mi.명식_신호(c, 성별)["신호"], kwu, 척도종류="시" if 시주 else "무시")[0] for c in cands])
        Z = (S - S.mean(axis=0)) / (S.std(axis=0) + 1e-6)
        cs = np.array([E.spearman(Z[i], g) for i in range(len(cands))])
        rank = float((cs > cs[0]).sum()) / n후보
        top_g = [net.meanings[i] for i in np.argsort(-g)[:6]]
        top_n = [net.meanings[i] for i in np.argsort(-Z[0])[:6]]
        emph = {net.meanings[i] for i in range(len(g)) if g[i] > 0.3}
        a = E.auc({m: float(Z[0][i]) for i, m in enumerate(net.meanings)}, emph) if emph else None
        rows.append((name, " ".join(c or "??" for c in 기둥), src_kw, cs[0], rank, a, top_g, top_n))
    if 보기:
        print(f"[사례 대조] 실제 명식 풀이 {len(rows)}건 · 후보 = 진짜 + 무작위 {n후보} · 순위 0=1등 1=꼴찌(무작위 0.5)")
        for r in rows:
            print(f"  {r[0]:8s} {r[1]:15s} {r[2]:6s} 상관 {r[3]:+.2f} · 순위 {r[4]:.2f} · 강조AUC {r[5] if r[5] is None else round(r[5], 2)}")
            print(f"      고수 강조: {', '.join(r[6])}")
            print(f"      망 예측  : {', '.join(r[7])}")
        rk = [r[4] for r in rows]; aa = [r[5] for r in rows if r[5] is not None]
        print(f"  평균: 상관 {np.mean([r[3] for r in rows]):+.3f} · 순위 {np.mean(rk):.2f} (무작위 0.50) · 상위 25% 안 {np.mean(np.array(rk) <= .25):.0%}"
              f" · 강조AUC {np.mean(aa):.3f}")
    return rows


if __name__ == "__main__":
    실행()
