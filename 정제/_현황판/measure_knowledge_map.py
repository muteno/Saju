# -*- coding: utf-8 -*-
"""
사주 정제 프로젝트 — ★지식망 계기판 (거리 · 확장성 · 신뢰도)

운영자 지시(260725 저녁, 원문):
> "거기서 이제 전사해서 뽑아낸거 살을 붙이고 개념을 잇고, 강도 트리구조 계층화 카테고라이징,
>  각각에 대한 **연결강도**, **붙어있는 지식**, **지식 간 거리**, **확장성** 이런거를 오늘 뉴런 모양
>  만든 그 맵처럼 붙여내면서 이를 **신뢰할수있게** 만들어가야되는거지"

운영자가 부른 6개 축을 하나씩 잰다. 넷은 이미 있고 둘(거리·확장성)은 오늘까지 아무도 안 쟀다.

| 운영자가 부른 축 | 이 스크립트가 재는 것 |
|---|---|
| 트리구조 계층화 카테고라이징 | 계층 간선으로 실제 트리가 서는가 · 고아 노드 |
| 연결강도 | weight 분포 · 최빈값 비율(균일하면 굵기가 정보를 못 나른다) |
| 붙어있는 지식 | 노드별 문단 수 + 저자 분포 |
| **지식 간 거리** ★신설 | 세 그래프(계층/관계/공기)에서의 최단 거리를 **따로** 잰다 |
| **확장성** ★신설 | k홉 도달 노드 수 — "여기서 몇 갈래로 뻗어나갈 수 있나" |
| 신뢰할 수 있게 | 근거유형 분포 · 결정론 대 가설 비율 |

■ 왜 거리를 세 벌로 따로 재는가 (이게 이 파일의 핵심)
  동시출현 간선(공기)은 밀도 71.0%다 — 아무 두 개념이나 71% 확률로 이미 이어져 있다.
  그 그래프에서 거리를 재면 **전부 1~2홉**으로 나와서 거리가 아무 정보도 못 나른다.
  "가깝다"가 의미를 가지려면 **종류가 있는 간선** 위에서 재야 한다.
  → 그래서 공기 거리와 관계 거리를 **절대 합치지 않는다.** 둘의 차이 자체가 진단이다.

입력:  data/neuron_nodes.jsonl · data/neuron_edges.jsonl (동시출현)
       data/relation_edges.jsonl (계층 + 결정론 관계) · data/node_layers.jsonl
출력:  data/knowledge_metrics.jsonl  노드별 계기판 수치
       콘솔 리포트 (요약 + 진단)

사용:  python measure_knowledge_map.py
       (콘솔 한글이 깨지면 PYTHONIOENCODING=utf-8)
"""
import json, sys, io
from pathlib import Path
from collections import Counter, defaultdict, deque
from datetime import datetime, timezone, timedelta

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
KST = timezone(timedelta(hours=9))
HOP_MAX = 3          # 확장성은 3홉까지 센다(그 이상은 71% 밀도 그래프에서 의미 없음)


# ══════════════════════════════════════════════════════════════════════
#  ★간선 종류를 두 부류로 가른다 (평의회 4차 O6 위원 실측으로 신설)
#
#  ⚠발견된 결함: 이 계기판이 **kind를 섞어 홉을 셌다.**
#    `갑목(甲) → 재물·돈 5홉`이라고 찍혔는데 실제 경로가
#    `구성 → 전제 → 전제 → 귀결 → 발현` — **명리 작용이 0개**였다.
#    구조 간선(우리가 분류하려고 만든 것)을 밟고 간 것을 "길이 뚫렸다"로 오독한 것이다.
#    → 작용류만으로 재면 도달불가가 36.8% → **95.9%**로 뛴다. 그게 진실이다.
#
#  · 작용류(作用) = 명리에서 **실제로 힘이 오가는** 관계. 통변이 이 위를 걷는다
#  · 구조류(構造) = 우리가 **분류·정의하려고** 만든 관계. 걷는 길이 아니라 서랍이다
#
#  ⛔둘을 합쳐서 거리를 재지 마라. 합치면 계기판이 실제보다 좋게 나온다.
# ══════════════════════════════════════════════════════════════════════
KIND_ACTION = {           # 작용류 — 힘이 오간다
    "생", "극", "합", "충", "형", "파", "해", "원진", "귀문",
    "비화", "제화", "지장간", "발현", "육친", "인접",
    # ★260726 — 합·충·형을 종류별로 갈랐다(자축은 «육합»이면서 «방합»이다).
    #   전부 «글자끼리 힘이 오가는 것»이라 작용류다. 옛 이름도 위에 남겨 둔다.
    #   ⚠이 파일이 미등록 kind를 보고 **스스로 죽어 준 덕에** 발견했다.
    #     "작용류로 잘못 넣으면 계기판이 실제보다 좋게 나온다"는 자기 경고가 정확했다.
    "천간합", "육합", "방합", "삼합", "반합", "합화",
    "천간충", "지지충", "삼형", "상형", "자형",
}
KIND_STRUCT = {           # 구조류 — 분류·정의
    "구성", "전제", "귀결", "롤업", "소속", "적용", "관계", "비교", "산출",
    "순서", "반증", "계층",
    "절차",               # ★260726 강약 점수제·득령득지득세 — 계산 규칙(힘이 아니다)
}


def jl(p):
    if not p.exists():
        sys.stderr.write(f"[없음] {p}\n  — 먼저 생성기를 돌려라.\n")
        raise SystemExit(1)
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def bfs_reach(adj, start, hop_max):
    """start에서 k홉으로 닿는 노드 수 (k=1..hop_max). 자기 자신 제외."""
    seen = {start}
    frontier = [start]
    out = []
    for _ in range(hop_max):
        nxt = []
        for u in frontier:
            for v in adj.get(u, ()):
                if v not in seen:
                    seen.add(v)
                    nxt.append(v)
        frontier = nxt
        out.append(len(seen) - 1)
    return out


def all_pairs_stats(adj, nodes, sample_cap=None):
    """평균 최단거리·지름·도달 불가 쌍 비율. 249노드면 전수(BFS 249회)로 충분히 빠르다."""
    targets = list(nodes) if sample_cap is None else list(nodes)[:sample_cap]
    total, cnt, diam, unreach = 0, 0, 0, 0
    for s in targets:
        dist = {s: 0}
        q = deque([s])
        while q:
            u = q.popleft()
            for v in adj.get(u, ()):
                if v not in dist:
                    dist[v] = dist[u] + 1
                    q.append(v)
        for t in nodes:
            if t == s:
                continue
            if t in dist:
                total += dist[t]
                cnt += 1
                diam = max(diam, dist[t])
            else:
                unreach += 1
    return {
        "평균거리": round(total / cnt, 2) if cnt else None,
        "지름": diam,
        "도달불가쌍": unreach,
        "도달불가비율": round(unreach / (len(targets) * (len(nodes) - 1)) * 100, 1)
        if len(nodes) > 1 else 0.0,
    }


def main():
    nodes = jl(DATA / "neuron_nodes.jsonl")
    air = jl(DATA / "neuron_edges.jsonl")            # 동시출현 = 공기
    rel_all = jl(DATA / "relation_edges.jsonl")      # 계층 + 결정론 관계
    layers = {r["concept"]: r for r in jl(DATA / "node_layers.jsonl")}

    concepts = [n["concept"] for n in nodes]
    cset = set(concepts)
    meta = {n["concept"]: n for n in nodes}

    # ── 그래프 3벌을 따로 만든다 (절대 합치지 않는다)
    adj_hier = defaultdict(set)     # 계층(트리 뼈대) — 가상 중주제 노드 포함
    adj_rel = defaultdict(set)      # 결정론 관계 전체(작용+구조)
    adj_act = defaultdict(set)      # ★작용류만 — 통변이 실제로 걷는 길
    adj_air = defaultdict(set)      # 동시출현(공기)

    rel_edges, hier_edges, act_edges = [], [], []
    unknown_kind = Counter()
    for e in rel_all:
        a, b = e["a"], e["b"]
        k = e.get("kind", "")
        if e.get("layer") == "계층":
            hier_edges.append(e)
            adj_hier[a].add(b)
            adj_hier[b].add(a)
            continue
        rel_edges.append(e)
        adj_rel[a].add(b)
        adj_rel[b].add(a)
        if k in KIND_ACTION:
            act_edges.append(e)
            adj_act[a].add(b)
            adj_act[b].add(a)
        elif k not in KIND_STRUCT:
            unknown_kind[k] += 1
    # ★새 kind가 생겼는데 분류표에 없으면 조용히 구조류로 취급된다 — 그게 오작동이다.
    if unknown_kind:
        sys.stderr.write(
            f"\n[분류 미등록 kind] {dict(unknown_kind)}\n"
            "  KIND_ACTION / KIND_STRUCT 중 어디인지 정하기 전에는 거리 수치를 믿지 마라.\n"
            "  (작용류로 잘못 넣으면 계기판이 실제보다 좋게 나온다)\n")
        raise SystemExit(1)
    for e in air:
        adj_air[e["a"]].add(e["b"])
        adj_air[e["b"]].add(e["a"])

    # ── 노드별 계기판
    out = []
    for c in concepts:
        n = meta[c]
        r1, r2, r3 = bfs_reach(adj_rel, c, HOP_MAX)
        a1 = len(adj_air.get(c, ()))
        rel_w = [e["weight"] for e in rel_edges if c in (e["a"], e["b"])]
        rel_kinds = Counter(e["kind"] for e in rel_edges if c in (e["a"], e["b"]))
        out.append({
            "concept": c,
            "big": n["big"], "mid": n["mid"],
            "layer": layers.get(c, {}).get("layer", "개념"),
            # 붙어있는 지식
            "문단": n["paras"],
            "저자수": len(n.get("authors", {})),
            # 연결
            "관계다리": len(adj_rel.get(c, ())),
            "공기다리": a1,
            "계층부모": sorted(x for x in adj_hier.get(c, ()) if " › " in str(x)),
            # 확장성 (관계 그래프에서 k홉 도달)
            "확장_1홉": r1, "확장_2홉": r2, "확장_3홉": r3,
            "확장성지수": round(r3 / max(1, len(concepts) - 1) * 100, 1),
            # 신뢰
            "관계강도평균": round(sum(rel_w) / len(rel_w), 2) if rel_w else None,
            "관계종류": dict(rel_kinds.most_common(6)),
        })
    with (DATA / "knowledge_metrics.jsonl").open("w", encoding="utf-8") as fh:
        for r in out:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")

    # ── 전역 진단
    stamp = datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")
    n_all = len(concepts)
    max_pairs = n_all * (n_all - 1) // 2
    print(f"■ 지식망 계기판 — {stamp}")
    print(f"  개념 {n_all}개")
    print()

    print("── ① 트리구조 계층화 (운영자 축 1)")
    print(f"  계층 간선 {len(hier_edges)}개 · 대주제 {len({e['a'] for e in hier_edges if ' › ' not in e['a']})}"
          f" → 중주제 {len({e['a'] for e in hier_edges if ' › ' in e['a']})} → 개념 {n_all}")
    orphan = [c for c in concepts if not any(" › " in str(x) for x in adj_hier.get(c, ()))]
    print(f"  계층 부모가 없는 개념(고아): {len(orphan)}개 {orphan[:8] if orphan else ''}")
    print()

    print("── ② 연결강도 (운영자 축 2)")
    wc = Counter(e["weight"] for e in rel_edges)
    top_w, top_n = wc.most_common(1)[0]
    print(f"  결정론 관계 간선 {len(rel_edges)}개 · weight 고유값 {len(wc)}종")
    print(f"  최빈 weight {top_w} = {top_n}개 ({top_n/len(rel_edges)*100:.1f}%)")
    if top_n / len(rel_edges) > 0.8:
        print("  ⚠최빈값이 80%를 넘는다 — 화면에서 굵기가 나르는 정보가 사실상 없다")
    else:
        print("  ✅굵기가 실제로 갈린다")
    print(f"  분포: {dict(sorted(wc.items(), reverse=True))}")
    print()

    print("── ③ 붙어있는 지식 (운영자 축 3)")
    paras = sorted((n["paras"] for n in nodes), reverse=True)
    print(f"  문단: 최대 {paras[0]:,} · 중앙 {paras[n_all//2]:,} · 최소 {paras[-1]:,}")
    print(f"  문단 0개(자료 없음): {sum(1 for p in paras if p == 0)}개")
    print(f"  문단 100개 미만(얇음): {sum(1 for p in paras if p < 100)}개")
    print()

    print("── ④ ★지식 간 거리 (운영자 축 4)")
    print("   ※네 그래프를 절대 합치지 않는다. 합치면 공기가 전부를 덮고, 구조류가 길을 만든다.")
    s_air = all_pairs_stats(adj_air, concepts)
    s_rel = all_pairs_stats(adj_rel, concepts)
    s_act = all_pairs_stats(adj_act, concepts)
    # ⚠계층 노드집합에서 대주제 15개를 빠뜨리면 평균이 3.03/3.14/3.46로 흔들린다(O6 실측).
    #   BFS는 경유하는데 통계에서만 빠지는 조용한 오작동이라, 그래프의 전 노드를 쓴다.
    hier_nodes = sorted(adj_hier)
    s_hier = all_pairs_stats(adj_hier, hier_nodes)
    print(f"  공기(동시출현)  밀도 {len(air)/max_pairs*100:5.1f}% → "
          f"평균 {s_air['평균거리']} · 지름 {s_air['지름']:2} · 도달불가 {s_air['도달불가비율']:5.1f}%")
    print(f"  관계 전체       밀도 {len(rel_edges)/max_pairs*100:5.1f}% → "
          f"평균 {s_rel['평균거리']} · 지름 {s_rel['지름']:2} · 도달불가 {s_rel['도달불가비율']:5.1f}%"
          "   ←구조류 포함(길처럼 보이지만 아님)")
    print(f"  ★작용류만      밀도 {len(act_edges)/max_pairs*100:5.1f}% → "
          f"평균 {s_act['평균거리']} · 지름 {s_act['지름']:2} · 도달불가 {s_act['도달불가비율']:5.1f}%"
          "   ←★이게 통변이 실제로 걷는 길")
    print(f"  계층(트리, 노드 {len(hier_nodes)})    → "
          f"평균 {s_hier['평균거리']} · 지름 {s_hier['지름']:2} · 도달불가 {s_hier['도달불가비율']:5.1f}%")
    print(f"     간선 내역: 작용류 {len(act_edges)} · 구조류 {len(rel_edges)-len(act_edges)}"
          f" · 계층 {len(hier_edges)} · 공기 {len(air):,}")
    if s_air["평균거리"] and s_air["평균거리"] < 2.0:
        print(f"  ⚠공기 평균거리 {s_air['평균거리']} — 전부 이웃이라 '가깝다'가 의미를 잃는다.")
    if s_act["도달불가비율"] - s_rel["도달불가비율"] > 10:
        print(f"  🔴구조류를 빼면 도달불가가 {s_rel['도달불가비율']:.1f}% → {s_act['도달불가비율']:.1f}%로 뛴다.")
        print("     = 지금 '길이 뚫렸다'고 보이는 것 상당수가 **분류 서랍을 밟고 간 것**이다.")
        print("     통변은 작용류 위에서만 성립한다. 그 격차가 P2 유닛이 메울 몫이다.")
    print()

    print("── ⑤ ★확장성 (운영자 축 5)")
    print("   = 이 개념에서 결정론 관계를 타고 3홉 안에 닿는 개념 수 / 전체")
    print("   ⚠이름 주의: 1홉과 3홉의 상관이 0.772라 사실상 '허브 근접도'다(O6 실측). 확장성 ≠ 유용성")
    ext = sorted(out, key=lambda r: -r["확장성지수"])
    print("  상위: " + " · ".join(f"{r['concept']}({r['확장성지수']}%)" for r in ext[:8]))
    dead = [r for r in out if r["관계다리"] == 0]
    dead_act = [c for c in concepts if not adj_act.get(c)]
    print(f"  관계 다리 0개(구조류 포함해도 못 닿음): {len(dead)}개")
    print(f"     → {[r['concept'] for r in dead[:10]]}")
    print(f"  🔴**작용류 다리 0개**(명리 작용이 하나도 안 붙은 개념): {len(dead_act)}개")
    print(f"     → {dead_act[:10]}")
    print("  ※이건 결함이 아니라 '규칙으로는 못 잇는 개념'이다.")
    print("     글자↔글자는 규칙이 잇지만 **글자→겪는 일**은 저자의 임상이라 규칙이 못 만든다.")
    print("     → 판단 유닛이 축자와 함께 이어줄 자리 = P2의 실제 과녁.")
    print()

    # ★P2 작업 큐 — "공기는 굵은데 규칙이 0인 쌍" (평의회 4차 O6 위원 제안)
    #   코퍼스가 수천 문단에서 같이 말하는데 규칙망에 한 가닥도 없는 곳 = 유닛이 가장 급한 자리
    print("── ★P2 작업 큐 — 공기는 굵은데 작용류가 0인 개념 (유닛이 가장 급한 자리)")
    air_w = defaultdict(int)
    for e in air:
        air_w[e["a"]] += e["w"]
        air_w[e["b"]] += e["w"]
    queue = sorted(((air_w.get(c, 0), c) for c in dead_act), reverse=True)[:15]
    tot = sum(w for w, _ in queue)
    for w, c in queue:
        n = meta.get(c, {})
        print(f"     {c:14} 문단 {n.get('paras', 0):>6,} · 공기무게 {w:>7,} · 작용류 0")
    print(f"  상위 15개 합계 공기무게 {tot:,} — 코퍼스는 이만큼 말하는데 규칙망은 한 가닥도 없다.")
    print()

    print("── ⑥ 신뢰 (운영자 축 6)")
    ev = Counter(e.get("근거유형", "?") for e in rel_all)
    print(f"  근거유형 분포: {dict(ev)}")
    print("  ※결정론규칙·분류체계는 코퍼스 축자가 아니라 계산 규칙이다.")
    print("    판단 유닛의 축자 근거와 섞어 세면 근거 등급이 거짓말을 한다.")
    print()

    print("── ★한 줄 진단")
    if s_rel["도달불가비율"] > 20:
        print(f"  결정론 관계만으로는 개념 쌍의 {s_rel['도달불가비율']}%가 서로 못 닿는다.")
        print("  그 사이를 잇는 것이 판단 유닛(chain)이고, 그게 '풀이'다 —")
        print("  운영자 원문: \"그거보고는 사주를 못풀어\" 가 이 숫자다.")
    print(f"  → {DATA / 'knowledge_metrics.jsonl'}")


if __name__ == "__main__":
    main()
