# -*- coding: utf-8 -*-
"""
역추론 색인 — 「관찰된 발현 → 어떤 구조일 수 있나」

═══ 왜 이게 필요한가 ═══
  운영자 260726: **"이거 모르면 역추론 못해"**
  지도의 최종 목적은 8글자 → 사람이다. 순방향(구조→발현)만으로는 절반이다.

═══ 왜 «역방향 간선»을 저장하지 않는가 (페이블 260726) ═══
  *"저장은 구조→발현 **단방향**(생성 방향이 기전을 보존한다), 역추론은 저장이 아니라
    **계산**으로 얻어라. 발현→구조는 다대일이라 역방향 간선을 따로 저장하면
    기전 없는 배속표가 또 생긴다. P(발현|구조) ≠ P(구조|발현)이므로
    **양방향 저장은 중복이 아니라 오류원**이다."*
  → 이 파일은 **파생물**이다. 순방향 간선에서 매번 다시 계산한다. 원본을 늘리지 않는다.

═══ 무엇을 거르는가 — 원인 후보가 아닌 것 ═══
  실측(260726): 그냥 들어오는 간선을 세면 **`강헌`(인명)이 건강·질병의 원인**,
  **`안도균`이 직업의 원인**으로 잡힌다. 그건 «같은 글에서 언급됐다»(L2 공기)일 뿐이다.
  ⛔거른다 : S12 역사·인물(인명·서명) · S11 상담론(화법·윤리) · L3 보강 · 낭설후보
  ⭕남긴다 : L1 결정론 · L1½ 조건부 · L2 중 **이유를 댈 수 있는 것**

═══ 강도를 숫자로 주지 않는다 ═══
  페이블: *"조건부 강도는 **필연/경향/희박 3단계면 충분**, 확률 숫자는 코퍼스가 못 준다."*
  운영자: *"99%는 100%가 아님."*
  → `필연`(결정론 + 이유 닫힘) / `경향`(조건부 또는 이유 있음) / `희박`(공기뿐)
    **숫자를 붙이면 없는 정밀도를 주장하게 된다.**

출력: data/역추론색인.jsonl · data/역추론_리포트.md
"""
import json, sys
from pathlib import Path
from collections import defaultdict, Counter

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
sys.path.insert(0, str(HERE))
from 작업내역 import 단계          # noqa: E402


def jl(n):
    p = DATA / n
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()] \
        if p.exists() else []


E = jl("링크망.jsonl")
lay = {r["concept"]: r for r in jl("node_layers.jsonl")}
BIG = {c: v.get("big", "") for c, v in lay.items()}
CH = {}
for r in jl("근거사슬.jsonl"):
    CH[tuple(sorted((r["a"], r["b"])))] = r

S15 = {c for c, b in BIG.items() if b.startswith("S15")}
# ⛔원인이 될 수 없는 것 — 사람 이름과 상담 화법은 사주 구조가 아니다
NOT_CAUSE_BIG = ("S12", "S11")
NOT_CAUSE = {c for c, b in BIG.items() if b.startswith(NOT_CAUSE_BIG)}

TIER = {"필연": 0, "경향": 1, "희박": 2}


def grade(e, ch):
    """3단계. 숫자를 주지 않는다 — 없는 정밀도를 주장하지 않으려고."""
    v = (ch or {}).get("판정")
    if e["층"] == "L1결정론":
        # ⚠🔴층만 보면 안 된다. 오늘 십성→발현 17건을 «정의급 9 / 임상급 8»로 갈랐는데,
        #   임상급도 층은 L1결정론이다(근거유형만 «통설·임상»으로 강등했다).
        #   그대로 두면 `편재→사업`이 «필연»으로 찍힌다 — 그건 저자마다 갈리는 임상 판단이다.
        #   경계선(페이블 260726): "글자→삶의 부호(+/−)부터는 창작이다."
        if e.get("근거유형") == "통설·임상":
            st = e.get("stance") or "저자별 갈림"
            return "경향", f"통설·임상 — {st} (규칙이 아니다)"
        return "필연", "명리 규칙 — 조건 없이 성립"
    if e["층"] == "L1½조건부":
        return "경향", "조건이 설 때 — " + " · ".join(e.get("조건") or []) or "경향"
    if v in ("인과닫힘", "작용까지"):
        return "경향", f"공기 결합이지만 이유를 댈 수 있다({v})"
    return "희박", "같은 문단에 자주 나올 뿐 — 이유를 못 댄다"


rows = []
for c in sorted(S15):
    cand = []
    for e in E:
        if e["층"] == "L3보강":
            continue
        if e["b"] == c and e["a"] not in S15:
            src, other = e["a"], "a→b"
        elif e["a"] == c and e["b"] not in S15:
            src, other = e["b"], "b→a"
        else:
            continue
        if src in NOT_CAUSE:
            continue
        ch = CH.get(tuple(sorted((e["a"], e["b"]))))
        if (ch or {}).get("판정") == "낭설후보" and e["층"] == "L2밀착":
            continue                       # 이유도 없고 규칙도 아니면 원인 후보가 아니다
        g, why = grade(e, ch)
        cand.append({
            "원인": src, "강도": g, "왜": why, "층": e["층"],
            "관계": e.get("kind"), "부호": e.get("polarity"),
            "조건": e.get("조건") or [], "조건극성": e.get("조건극성", ""),
            "무게": e.get("weight"), "대주제": BIG.get(src, ""),
            "간선id": e.get("간선id"),
            "사슬": " · ".join(h["고리"] for h in (ch or {}).get("사슬", [])) or "",
        })
    cand.sort(key=lambda r: (TIER[r["강도"]], -(r["무게"] or 0)))
    rows.append({"발현": c, "원인후보": cand,
                 "요약": dict(Counter(x["강도"] for x in cand))})

(DATA / "역추론색인.jsonl").write_text(
    "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")

tot = sum(len(r["원인후보"]) for r in rows)
agg = Counter(x["강도"] for r in rows for x in r["원인후보"])

L = ["# 역추론 색인 — 「이 발현이 보인다 → 어떤 구조일 수 있나」", "",
     "> 운영자 260726: **\"이거 모르면 역추론 못해\"**", "",
     "**저장이 아니라 계산이다.** 역방향 간선을 따로 저장하면 기전 없는 배속표가 또 생긴다",
     "(P(발현|구조) ≠ P(구조|발현)). 순방향 간선에서 매번 다시 뽑는다.", "",
     "**숫자를 주지 않는다.** 필연 / 경향 / 희박 3단계뿐이다 —",
     "확률을 붙이면 코퍼스가 주지 못한 정밀도를 주장하게 된다(*\"99%는 100%가 아님\"*).", "",
     f"- 발현 노드 {len(rows)} · 원인 후보 **{tot}** · " +
     " · ".join(f"{k} {v}" for k, v in agg.most_common()),
     f"- ⛔거른 것: 인명·서명(S12) · 상담화법(S11) · L3 보강 · 「낭설후보」인 공기 결합", "",
     "> 실측 근거 — 안 거르면 `강헌`(인명)이 건강·질병의 원인, `안도균`이 직업의 원인으로 잡힌다.", ""]

for r in rows:
    c = r["발현"]
    L += [f"## {c}", "",
          f"원인 후보 **{len(r['원인후보'])}** · " +
          (" · ".join(f"{k} {v}" for k, v in r["요약"].items()) or "없음"), ""]
    if not r["원인후보"]:
        L += ["*원인 후보가 없다 — 이 발현은 지도에서 아직 뜬 섬이다.*", ""]
        continue
    L += ["| 강도 | 원인 | 관계 | 조건 | 왜 |", "|---|---|---|---|---|"]
    for x in r["원인후보"][:18]:
        cond = " · ".join(x["조건"]) + (" <b>·없을때</b>" if x["조건극성"] == "부재" else "")
        L.append(f"| **{x['강도']}** | {x['원인']} <sub>{x['대주제'][:3]}</sub> | "
                 f"{x['관계']}{x['부호'] or ''} | {cond or '—'} | {x['왜']} |")
    if len(r["원인후보"]) > 18:
        L.append(f"| … | *{len(r['원인후보'])-18}건 더 (역추론색인.jsonl)* | | | |")
    L.append("")

(DATA / "역추론_리포트.md").write_text("\n".join(L) + "\n", encoding="utf-8")

with 단계("역추론 색인", "「발현 → 어떤 구조일 수 있나」를 순방향 간선에서 계산. 저장 아님",
        ["data/역추론색인.jsonl", "data/역추론_리포트.md"]) as st:
    st.기록(f"발현 {len(rows)}개 · 원인 후보 {tot} · {dict(agg)}")
    st.기록("거름: 인명(S12)·화법(S11)·L3보강·낭설후보 공기결합")

print(f"역추론 색인 — 발현 {len(rows)} · 원인 후보 {tot} · {dict(agg)}")
for r in rows:
    top = r["원인후보"][:4]
    print(f"   {r['발현']:10s} {len(r['원인후보']):3d}  " +
          ", ".join(f"{x['원인']}({x['강도']})" for x in top))
