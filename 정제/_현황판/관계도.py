# -*- coding: utf-8 -*-
"""망.py의 조건부 확률을 도식용 노드·방향 간선으로 내보낸다.

개념→개념은 문단, 개념→의미는 문장 기준이다. 화살표는 조건의 방향이며 인과가 아니다.
모든 값은 같은 원장·관법·맥락·제외 글에서 계산한다. 저장된 결과는 해당 조건의 스냅샷이다.
없는 근거를 보강선으로 만들지 않는다. 표시용 상한으로 숨긴 간선 수를 함께 반환한다.
"""
import argparse
import json
from pathlib import Path

import 망 as M


def 관계망(net, 관법=None, 맥락=(), 개념=None, 이웃=6, 최소동시=5):
    """각 개념의 두 종류별 상위 이웃. 정렬은 90% 하한/기준률이며 확률 자체와 구분한다."""
    맥락 = tuple(sorted(set(맥락)))
    sources = list(dict.fromkeys(net.nodes if 개념 is None else 개념))
    if not sources:
        raise ValueError("출발 개념을 하나 이상 지정해야 한다")
    unknown = (set(sources) | set(맥락)) - set(net.nodes)
    if unknown:
        raise ValueError("없는 개념: " + ", ".join(sorted(unknown)))
    if 관법:
        names = (관법,) if isinstance(관법, str) else tuple(관법)
        if set(names) - set(net.관법들):
            raise ValueError("없는 관법: " + ", ".join(sorted(set(names) - set(net.관법들))))
        관법 = names[0] if len(names) == 1 else tuple(sorted(set(names)))
    if 이웃 < 1 or 최소동시 < 1:
        raise ValueError("이웃·최소동시는 1 이상이어야 한다")
    if not net.qbase.any() or not net.base.any():
        raise ValueError("원장이 비었다. 웹·전사를 적재한 뒤 build_망.py를 실행해야 한다")
    cb = net.개념기준률(관법, 맥락)
    mb = net.기준률(관법, 맥락)
    _, cn, qN = net.공기(관법, 맥락)
    nodes = [{"id": c, "이름": c, "종류": "개념", "문단": int(cn[i])}
             for i, c in enumerate(net.nodes)]
    meaning_counts = net.Sm[net.행(관법, 맥락)].sum(axis=0).A1
    nodes += [{"id": "의:" + m, "이름": m, "종류": "의미", "문장": int(meaning_counts[i])}
              for i, m in enumerate(net.meanings)]
    edges, hidden = [], {"근거부족": 0, "표시상한": 0}
    for A in sources:
        for kind, dist, base, names, prefix, unit in (
            ("개념", net.개념분포(A, 관법, 맥락), cb, net.nodes, "", "문단"),
            ("의미", net.의미분포(A, 관법, 맥락), mb, net.meanings, "의:", "문장"),
        ):
            candidates = []
            for j, B in enumerate(names):
                if B not in dist:
                    continue
                p, lo, hi, n, k = dist[B]
                if n <= 0 or k < 최소동시:
                    hidden["근거부족"] += 1
                    continue
                e = {"시작": A, "끝": prefix + B, "종류": kind, "확률": p,
                     "구간90": [lo, hi], "분모": n, "동시": k, "단위": unit,
                     "기준률": float(base[j]), "배수": float(p / base[j])}
                if kind == "개념":
                    e["공기강도"] = net.강도(A, B, 관법, 맥락)
                candidates.append(e)
            candidates.sort(key=lambda e: (-e["구간90"][0] / e["기준률"], -e["동시"], e["끝"]))
            edges.extend(candidates[:이웃])
            hidden["표시상한"] += max(0, len(candidates) - 이웃)
    return {"버전": 1, "관법": 관법, "맥락": list(맥락), "출발개념": sources,
            "확률뜻": "문헌 동시언급의 베타 추정치; 개인 적중률·인과확률 아님",
            "구간뜻": "경험적 사전분포를 쓴 베타 사후 90% 구간",
            "선택문단": qN, "선택문장": int(net.행(관법, 맥락).sum()),
            "추정": {"α": net.α, "최소성공": net.최소성공, "문장창": net.창, "제목무게": net.제목무게},
            "표시": {"종류별이웃": 이웃, "최소동시": 최소동시, "숨김": hidden,
                     "정렬": "90% 하한/기준률", "없는선": "근거 부족·표시 상한이며 무관함의 증거가 아님"},
            "노드": nodes, "관계": edges}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--관법")
    ap.add_argument("--맥락", nargs="*", default=[])
    ap.add_argument("--개념", nargs="+")
    ap.add_argument("--이웃", type=int, default=6)
    ap.add_argument("--최소동시", type=int, default=5)
    ap.add_argument("--출력", type=Path)
    a = ap.parse_args()
    try:
        graph = 관계망(M.망(), a.관법, a.맥락, a.개념, a.이웃, a.최소동시)
    except (ValueError, FileNotFoundError) as e:
        ap.error(str(e))
    text = json.dumps(graph, ensure_ascii=False, indent=1, allow_nan=False) + "\n"
    if a.출력:
        a.출력.write_text(text, encoding="utf-8")
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
