# -*- coding: utf-8 -*-
"""
★앱 두뇌 팩 — 지도를 «앱이 먹을 수 있는 것»으로 내보낸다.

═══ 운영자 지시 ═══
  *"일단 지금 지식을 앱에 탑재해줄래? **앱에 뇌를 달아주셈**"*

═══ 앱은 지금 무엇을 갖고 있나 (실측) ═══
  `app/src/engine/index.js`가 런타임에 `kb.json`을 fetch 한다. 스키마 = `{index, aliases,
  distilled, bodies, meta}` 이고 **`index`는 «키 → 원문 유닛 참조» 598키**뿐이다.
  즉 앱의 현재 뇌는 **«어느 글을 보여줄까»**만 안다. **«왜 그런가»는 모른다.**

  ⚠절대원칙(계승): **검색(RAG) 금지 — 계산된 키셋의 결정론 조회.**
  그래서 이 팩도 «질의»가 아니라 **«앱이 이미 계산한 키»로 조회**되게 만든다.

═══ 앱이 계산하는 키 어휘 (keyset.js 실측) ═══
    frame/{신강|신약|중화|극신강|극신약|득령|조후|무관성…}   chain/{식상생재…}
    ilju/{60갑자}   cheongan/{갑…}   jiji/{자…}   sipsin/{정관…}
    sibiunseong/{장생…}   sinsal/{천을귀인·겁살…}   hapchung/{합|충|육합|삼합|방합|형|파|해|원진}
    unse/{연도}/…

  우리 노드명은 `갑목(甲)`·`자수(子)`·`편관(칠살)`처럼 **표기가 다르다.**
  → **키매핑을 만들고, 못 맞춘 키는 숨기지 않고 리포트에 적는다.**
    (이 프로젝트의 주적은 «조용한 누락»이다)

═══ 무엇을 싣는가 — «관계»이지 «결론»이 아니다 ═══
  운영자 1-36: *"**관계를 정의해야지 의미를 정의해버리면 절대안돼**"*
  1-38: *"그 맵이 그거 하나만 있으면 **앱을 복제할 수 있을정도로** 만들어야돼"*
  그래서 싣는 것 =  정의 · 관계(조건·부호·근거·왜) · 조견표 · 판정절차 · 역추론 색인.
  ⛔싣지 않는 것 = 「이러면 이렇게 산다」류 결론.
  ⚠**낭설 후보도 숨기지 않고 실어 보낸다** — 앱이 「이건 근거를 못 댄다」를 알아야
    도령님이 말한 «왜요? 몰라요»를 피한다. 대신 `왜` 칸에 그대로 적힌다.

출력: data/앱두뇌.json  ·  data/앱두뇌_리포트.md
"""
import json, re, sys
from pathlib import Path
from collections import Counter, defaultdict

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
sys.path.insert(0, str(HERE))
from 작업내역 import 단계          # noqa: E402


def jl(p):
    p = DATA / p
    if not p.exists():
        return []
    return [json.loads(l) for l in p.read_text(encoding="utf-8").split(chr(10))
            if l.strip() and not l.lstrip().startswith('{"_')]


# ── 앱 키 → 우리 노드 ────────────────────────────────────────────
#   ⚠«비슷하니까»로 매핑하지 않는다. 아래는 전부 표기 규칙이 확실한 것뿐이고,
#     못 맞춘 것은 리포트에 남긴다(그게 다음 사람의 할 일이 된다).
_GAN = {"갑": "갑목(甲)", "을": "을목(乙)", "병": "병화(丙)", "정": "정화(丁)",
        "무": "무토(戊)", "기": "기토(己)", "경": "경금(庚)", "신": "신금(辛)",
        "임": "임수(壬)", "계": "계수(癸)"}
_JI = {"자": "자수(子)", "축": "축토(丑)", "인": "인목(寅)", "묘": "묘목(卯)",
       "진": "진토(辰)", "사": "사화(巳)", "오": "오화(午)", "미": "미토(未)",
       "신": "신금(申)", "유": "유금(酉)", "술": "술토(戌)", "해": "해수(亥)"}
# 십이운성 — 지도는 12단계가 아니라 **9노드**로 묶여 있다(병·사 / 절·태·양 / 묘(입묘)).
_STAGE = {"장생": "장생", "목욕": "목욕", "관대": "관대", "건록": "건록", "제왕": "제왕",
          "쇠": "쇠", "병": "병·사", "사": "병·사", "묘": "묘(입묘)",
          "절": "절·태·양", "태": "절·태·양", "양": "절·태·양"}
# 신살 — 지도가 둘씩 묶은 것들이 있다
_SINSAL = {"겁살": "겁살·재살", "재살": "겁살·재살", "천살": "천살·지살", "지살": "천살·지살",
           "년살": "년살·월살", "월살": "년살·월살", "정록": "건록",
           "역마살": "역마", "화개살": "화개", "도화살": "도화",
           "문창": "문창·문곡", "문곡": "문창·문곡", "천덕": "천덕·월덕", "월덕": "천덕·월덕"}
_HAPCHUNG = {"합": "천간합", "충": "지지충", "육합": "육합", "삼합": "삼합",
             "방합": "방합", "형": "삼형", "파": "파", "해": "해", "원진": "원진"}
_FRAME = {"신강": "신강", "신약": "신약", "중화": "중화", "극신강": "극신강", "극신약": "극신약",
          "득령": "득령·득지·득세", "조후": "한난조습",
          "무관성": "고립·불급", "무식상": "고립·불급", "무재성": "고립·불급",
          "무인성": "고립·불급", "무비겁": "고립·불급"}


def map_key(key, nodes):
    """앱 키 → 우리 노드명(없으면 None)."""
    if "/" not in key:
        return None
    head, tail = key.split("/", 1)
    tail = tail.strip()
    cand = None
    if head == "cheongan":
        cand = _GAN.get(tail)
    elif head == "jiji":
        cand = _JI.get(tail)
    elif head == "sibiunseong":
        cand = _STAGE.get(tail)
    elif head == "sinsal":
        cand = _SINSAL.get(tail, tail)
    elif head == "hapchung":
        cand = _HAPCHUNG.get(tail)
    elif head == "frame":
        cand = _FRAME.get(tail)
    elif head in ("sipsin", "chain"):
        cand = tail                       # 정관·식상생재 등은 표기가 같다
    elif head == "ilju":
        cand = "일주"                      # 60갑자 개별 노드는 없다 — 총칭으로
    if cand and cand in nodes:
        return cand
    # 「편관」 → 「편관(칠살)」 같은 괄호 부연 형태를 한 번 더 본다
    for n in nodes:
        if n.split("(")[0].strip() == tail:
            return n
    return None


def main():
    nodes = {r["concept"]: r for r in jl("node_layers.jsonl")}
    정의 = {r["concept"]: r.get("정의", "") for r in jl("정의_정제본.jsonl")}
    idx = json.loads((DATA / "개념_문단색인.json").read_text(encoding="utf-8"))
    occ, srcs = idx.get("occ", {}), idx.get("src", {})

    def N(x):
        v = occ.get(x, 0)
        return v if isinstance(v, int) else len(v or [])

    def S(x):
        v = srcs.get(x, [])
        return len(v) if isinstance(v, (list, dict, set)) else int(v or 0)

    # ── 관계 — 정본 표(관계도)를 그대로 싣되 앱에 필요한 칸만
    # ★260728 — 판정 어휘를 정본 표와 **같은 문**으로 받는다.
    #   그전엔 이 파일이 `근거사슬.jsonl`만 봐서, L1 결정론 1,555건이 전부
    #   `왜 = null`로 나갔다. 앱은 `왜`가 없는 관계를 「이유 있는 것」에서 빼므로
    #   **「글자 → 겪는 일」을 말하는 유일한 층인 발현 157건이 화면에서 통째로 사라졌다.**
    #   정본 표(관계도.csv)는 같은 간선을 「인과」로 찍고 있었다 = 두 벌 장부.
    from 판정어 import 판정 as _판정
    링크 = jl("링크망.jsonl")
    사슬 = {}
    for r in jl("근거사슬.jsonl"):
        사슬[(r["a"], r["b"])] = {"판정": r.get("판정"), "홉": r.get("홉"),
                                 "사슬": [h.get("고리") for h in (r.get("사슬") or [])]}
    관계 = []
    for e in 링크:
        a, b = e.get("a"), e.get("b")
        if a not in nodes or b not in nodes:
            continue
        ch = 사슬.get((a, b)) or 사슬.get((b, a)) or {}
        관계.append({
            "a": a, "b": b, "관계": e.get("kind") or e.get("관계"), "층": e.get("층"),
            "방향": e.get("dir"), "부호": e.get("polarity"), "무게": e.get("weight"),
            # ★260728 — 「한 군데만 고치기」 13회째를 여기서 끊는다.
            #   `effect`(촉진/해소)는 260725 평의회가 잡아낸 결함의 처방으로
            #   **생산자에는 이미 심겨 있었는데 읽는 코드가 하나도 없었다**(grep 0).
            #   그래서 `천을귀인 ─발현→ 구설·송사`의 «+·해소»가 앱에선 «+»로만 보이고,
            #   앱은 그걸 «구설을 늘린다»로 정반대로 읽는다. polarity는 관계의 부호이고
            #   발생량의 방향은 이 칸이다 — **합산은 이 칸으로만 해야 한다.**
            "효과": e.get("effect"),
            "등급": e.get("등급"), "조건": e.get("조건"), "근거유형": e.get("근거유형"),
            "stance": e.get("stance"),
            "왜": _판정(e, 사슬), "사슬": ch.get("사슬"),
            "근거": (e.get("source") or "")[:300],
        })

    # ── 조견표(산출·절차) — «입력→글자». 앱이 계산에 바로 쓸 수 있는 층
    조견 = [{"a": e["a"], "b": e["b"], "kind": e["kind"], "조건": e.get("조건"),
            "근거": (e.get("source") or "")[:220], "stance": e.get("stance")}
           for e in jl("relation_edges.jsonl") if e.get("kind") in ("산출", "절차")]

    판정 = jl("판정절차.jsonl")
    역추론 = jl("역추론색인.jsonl")

    # ── 앱 키 커버리지 — **뇌가 실제로 얼마나 달렸나**를 정직하게 잰다
    앱키 = []
    for g in _GAN:
        앱키.append(f"cheongan/{g}")
    for j in _JI:
        앱키.append(f"jiji/{j}")
    for s in _STAGE:
        앱키.append(f"sibiunseong/{s}")
    for s in ("겁살", "재살", "천살", "지살", "년살", "월살", "망신살", "장성살", "반안살",
              "역마살", "육해살", "화개살", "천을귀인", "문창", "문곡", "금여", "암록",
              "건록", "양인", "홍염", "천덕", "월덕", "공망", "괴강", "백호"):
        앱키.append(f"sinsal/{s}")
    for h in _HAPCHUNG:
        앱키.append(f"hapchung/{h}")
    for f in _FRAME:
        앱키.append(f"frame/{f}")
    for sp in ("비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"):
        앱키.append(f"sipsin/{sp}")
    for c in ("식상생재", "관인상생", "재다신약", "군겁쟁재", "살인상생", "탐재괴인", "상관견관"):
        앱키.append(f"chain/{c}")

    키매핑, 미매핑 = {}, []
    for k in 앱키:
        n = map_key(k, nodes)
        if n:
            키매핑[k] = n
        else:
            미매핑.append(k)

    # ── 노드 카드 — 앱이 «이 글자가 뭔가»에 답할 재료
    노드 = {}
    for c, meta in nodes.items():
        노드[c] = {
            "대주제": meta.get("big"), "중주제": meta.get("mid"),
            "정의": 정의.get(c, ""), "문단": N(c), "출처수": S(c),
        }

    pack = {
        "meta": {
            "생성": "build_brain.py",
            "원칙": "계산된 키셋의 결정론 조회 — 검색(RAG) 금지",
            "노드": len(노드), "관계": len(관계), "조견표": len(조견),
            "판정절차": len(판정), "역추론": len(역추론),
            "앱키_매핑": len(키매핑), "앱키_미매핑": len(미매핑),
            "⚠읽는 법": ("`왜` 칸이 «낭설후보»면 그 관계는 **이유를 못 댄다**. "
                       "앱은 그걸 근거로 단정하면 안 되고, 대화로 신호를 더 모아야 한다."),
        },
        "키매핑": 키매핑,
        "노드": 노드,
        "관계": 관계,
        "조견표": 조견,
        "판정절차": 판정,
        "역추론": 역추론,
    }
    out = DATA / "앱두뇌.json"
    out.write_text(json.dumps(pack, ensure_ascii=False), encoding="utf-8")

    # ── 리포트 — 조용한 누락을 막는다
    왜 = Counter(r["왜"] for r in 관계 if r.get("왜"))
    mb = out.stat().st_size / 1e6
    L = ["# 앱 두뇌 팩 — 지도를 앱이 먹을 수 있게", "",
         "> 운영자: *\"일단 지금 지식을 앱에 탑재해줄래? **앱에 뇌를 달아주셈**\"*", "",
         f"- 파일 `data/앱두뇌.json` · **{mb:.1f} MB**",
         f"- 노드 **{len(노드)}** · 관계 **{len(관계):,}** · 조견표 **{len(조견):,}** · "
         f"판정절차 {len(판정)} · 역추론 발현 {len(역추론)}",
         "",
         "## 앱 키 커버리지 — 뇌가 실제로 얼마나 달렸나", "",
         f"- 앱이 만드는 키 {len(앱키)}종 중 **{len(키매핑)}종({len(키매핑)/max(len(앱키),1):.0%})**을 "
         f"우리 노드로 맞췄다.",
         f"- 🔴**못 맞춘 {len(미매핑)}종** — 숨기지 않고 적는다:", ""]
    for k in 미매핑:
        L.append(f"  - `{k}`")
    L += ["", "## 관계의 «왜» 분포 — 앱이 근거를 댈 수 있는 비율", "",
          "| 판정 | 건수 |", "|---|---:|"]
    for k, v in 왜.most_common():
        L.append(f"| {k} | {v:,} |")
    L += ["", "⚠**「낭설후보」도 팩에 실어 보낸다.** 앱이 «이건 근거를 못 댄다»를 알아야",
          "운영자가 말한 *「자미원진이 애증관계예요? 왜요? > 몰라요 > (실패)」*를 피한다.",
          "숨기면 앱이 그걸 근거처럼 쓴다.", "",
          "## 앱에서 쓰는 법", "",
          "```js",
          "// keyset.js 가 만든 키를 그대로 던진다 — 질의가 아니라 조회다",
          "const node = brain.키매핑[key]            // 'cheongan/갑' → '갑목(甲)'",
          "const card = brain.노드[node]             // 정의·대주제·근거량",
          "const rels = brain.관계.filter(r => r.a === node || r.b === node)",
          "const why  = rels.filter(r => r.왜 && r.왜 !== '낭설후보')   // 이유를 댈 수 있는 것만",
          "```"]
    (DATA / "앱두뇌_리포트.md").write_text("\n".join(L) + "\n", encoding="utf-8")

    print(f"앱 두뇌 팩 — {mb:.1f}MB · 노드 {len(노드)} · 관계 {len(관계):,} · 조견표 {len(조견):,}")
    print(f"  앱 키 {len(앱키)}종 중 매핑 {len(키매핑)} · 🔴미매핑 {len(미매핑)}")
    if 미매핑:
        print("     " + " · ".join(미매핑[:10]))
    print(f"  왜 분포: {dict(왜.most_common(6))}")
    print(f"→ {out}")
    return pack, 미매핑


if __name__ == "__main__":
    with 단계("앱 두뇌 팩", "지도를 앱이 «계산된 키»로 조회할 수 있는 형태로 내보낸다",
            ["data/앱두뇌.json", "data/앱두뇌_리포트.md"]) as st:
        pack, 미매핑 = main()
        st.기록(f"노드 {pack['meta']['노드']} · 관계 {pack['meta']['관계']:,} · "
               f"조견표 {pack['meta']['조견표']:,}")
        st.기록(f"앱키 매핑 {pack['meta']['앱키_매핑']} · 미매핑 {pack['meta']['앱키_미매핑']}")
