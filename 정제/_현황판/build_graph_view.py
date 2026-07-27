# -*- coding: utf-8 -*-
"""
사주 정제 프로젝트 — 지식망 (그래프 뷰)

운영자 지시(260725): "옵시디언 그래프 뷰 같은 느낌. 이어져 있되 강도는 굵기·채색으로
나뉘고, 확신도·관계의 정도가 색으로 보이는 것. 지구본이나 뉴런 구조처럼."
  → 뉴런망.html은 '표'라서 연결이 안 보인다. 이 스크립트가 만드는 것은 그 연결 자체를
     그림으로 보여주는 화면이다. 굵기 = 얼마나 자주 같이 나왔나, 색 = 어떤 관계인가.

★260725 저녁 개정 — 3층 구조. 운영자: "기본 개념에 대한 계층화 트리구조가 조금 약한듯"
  진단(실측): 노드 249·간선 21,916인데 밀도 71.0%. 아무 두 개념이나 71% 확률로 이미 연결이라
  다 그리면 털뭉치, 잘라내면 점만 남는다. 게다가 간선이 전부 동시출현 하나뿐이라
  종류·방향·강도가 없고, 계층은 노드의 big/mid '문자열'로만 있어 선이 아예 없었다.
  → 층을 셋으로 나눠 켜고 끌 수 있게 한다. 삭제는 없다(평의회 금지 #10).
    1층 계층(뼈대)   대주제 15 → 중주제 51 → 개념 249  = 간선 300. 굵고 차분한 색. 기본 ON
    2층 관계(뉴런)   생·극·합·충·형·파·해·지장간·롤업… = 간선 480. kind별 색·화살표. 기본 ON
    3층 동시출현(공기) 21,916. 기본 OFF. 켜면 최소 강도 슬라이더로 하한 조절. 판단 경로 아님

입력:  data/neuron_nodes.jsonl   개념 노드 249개  (concept·big·mid·paras·bridges·authors·flags·subj·top_links)
       data/neuron_edges.jsonl   동시출현 간선 21,916개 (a·b·w·ev)      ← 3층(공기)
       data/relation_edges.jsonl 계층 300 + 결정론 관계 480              ← 1·2층 ★신규
       data/node_layers.jsonl    노드별 layer·한자·오행·음양(體/用)·분류  ★신규
       ../P2_유닛/pilot_UI.jsonl  판단 유닛 (U-INV)
       ../P2_유닛/pilot_UJ.jsonl  판단 유닛 (U-JUDGE)
출력:  지식망.html               외부 라이브러리 0개 · 오프라인 더블클릭으로 열림

사용:  python build_graph_view.py
       (콘솔 한글이 깨지면  $env:PYTHONIOENCODING="utf-8"  먼저)

※ 기존 build_neuron_map.py·build_dashboard.py 는 건드리지 않는다. 이 파일은 읽기만 한다.
※ ⚠필드명을 추측하지 말 것. 이 스크립트는 로딩 직후 assert 로 스키마를 검증한다
   (260725 실측: 필드명 오독으로 221개 노드를 통째로 못 찾은 사고가 있었다).
"""
import json, html, math, sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import Counter

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
UNITS_DIR = HERE.parent / "P2_유닛"
KST = timezone(timedelta(hours=9))

# ── 대주제 14색 팔레트 (S01~S14). 색상환을 한 바퀴 돌아 서로 안 헷갈리게 배치.
BIG_COLORS = [
    "#e8543f",  # S01 음양·오행
    "#f0912f",  # S02 천간
    "#e5c024",  # S03 지지·지장간
    "#a8c93a",  # S04 합충형파해
    "#4cb96a",  # S05 십성·육친
    "#2fb99b",  # S06 신살
    "#31b0d4",  # S07 십이운성
    "#4a86e8",  # S08 강약·격국·구조
    "#6c6ce0",  # S09 용신
    "#9159d1",  # S10 대운·세운·운해석
    "#c74fbe",  # S11 상담론·화법·윤리
    "#e8508f",  # S12 역사·이론사·인물
    "#b0876a",  # S13 자리(궁위)·원국 구조
    "#8a94a6",  # S14 기본 골격어
]

# ── 유닛 횡단 링크의 rel(관계 이름)을 6개 색 그룹으로 접는다.
#    ⚠실측(파일럿 11유닛): rel 이 22종이나 나왔다. 색을 22개 쓰면 아무도 못 읽는다.
REL_GROUP = {
    "전제": "전제", "근거": "전제", "조건": "전제", "기준": "전제",
    "귀결": "귀결", "적용": "귀결", "적용받음": "귀결", "선행": "귀결",
    "구성": "정밀화", "정밀화": "정밀화", "보정": "정밀화", "계층": "정밀화",
    "위치": "정밀화", "인접": "정밀화", "관계": "정밀화", "관련": "정밀화", "대상": "정밀화",
    "예시": "예시",
    "비교": "비교", "대안": "비교", "형제": "비교",
    # ★260725 신설. UJ-0004의 월지/일지처럼 '어느 쪽이 강하냐'로 갑론을박이 갈리는 축.
    #   우열 주장이 아니라 분기 자체를 보존하는 링크라 '비교' 계열로 접는다.
    "분기후보": "비교",
    "반증": "반증",
}
GROUP_COLOR = {
    "전제": "#4a86e8",    # 푸른 = 앞에서 받쳐주는 것
    "귀결": "#33a86b",    # 녹색 = 뒤로 흘러나가는 것
    "정밀화": "#22a8a0",  # 청록 = 구성·조정
    "예시": "#8e6fd8",    # 보라 = 사례
    "비교": "#d89b2a",    # 노랑 = 나란히 놓고 보기
    "반증": "#e0483f",    # 붉은 = 뒤집는 것
}
GROUP_DESC = {
    "전제": "전제·근거·조건 (이게 있어야 성립)",
    "귀결": "귀결·적용·선행 (여기서 흘러나감)",
    "정밀화": "구성·정밀화·보정 (조립·조정)",
    "예시": "예시 (사례로 보여줌)",
    "비교": "비교·대안·형제 (나란히 둠)",
    "반증": "반증·부정 (뒤집음)",
}
# polarity 가 '-' 면 rel 이 무엇이든 붉은 계열로 간다 — 한눈에 갈려야 하므로.
NEG_COLOR = "#e0483f"

# ── 근거유형 → weight 정본 사다리 (운영자 지시 260725).
#    "연결의 강도는 얼마나 이게 강하게 붙어있느냐" — 굵기의 정본은 유닛의 weight 필드다.
#    이 표는 굵기 계산에 쓰지 않는다(weight 를 그대로 쓴다). 대조·범례 표시용이다.
EVID_LADDER = [
    ("축자정의", 1.0, "저자가 글자 그대로 정의한 것"),
    ("다저자합의", 0.9, "여러 저자가 같은 말을 함"),
    ("단일저자논증", 0.7, "한 저자가 논증으로 세움"),
    ("사례", 0.5, "실제 명식 사례로 보임"),
    ("권위·임상", 0.2, "\"임상적으로 그렇더라\" — 근거력 약함"),
    ("추론", 0.1, "우리가 미뤄 짐작한 것"),
]
EVID_W = {k: w for k, w, _ in EVID_LADDER}

# ── 계층 링크에 적힌 개념 이름이 정본 concept 과 다를 때의 수동 보정.
#    자동 해소(괄호형·가운뎃점 분해·유일 부분일치)로 안 풀리는 것만 여기 적는다.
#    ※260725 운영자가 유닛 쪽 표기를 전부 정본화해서 지금은 비어 있다.
#      비었다고 지우지 마라 — 다음 유닛 배치에서 또 어긋나면 여기가 완충지대다.
MANUAL_ALIAS = {}

# ⚠★자동 해소를 절대 걸면 안 되는 이름 (운영자 지시 260725).
#   '건강'을 '음식·건강 개운'(개운법)에 조용히 붙였더니 문맥이 통째로 달랐다
#   ("금 과다·고립으로 인한 호흡기·갑상선 손상" ≠ 개운 처방).
#   진짜 원인은 사전에 '건강·질병' 노드가 없다는 것 — 파일럿이 찾아낸 실제 사전 공백이다.
#   조용히 다른 노드에 붙이면 공백이 안 보인다. 이 프로젝트 사고는 100% '조용한 오작동'이었다.
#   → 여기 적힌 이름은 해소를 시도조차 하지 않고 '미등재 개념' 노드로 띄운다.
NEVER_RESOLVE = {"건강"}

# ══════════════════════════════════════════════════════════════════════════
#  ★1층 계층(뼈대) · 2층 결정론 관계(뉴런) — 색·설명 정본
#    운영자는 비전문가다. 색이 무슨 뜻인지 화면 안에서 읽혀야 하므로
#    여기 적은 설명이 그대로 범례에 나간다(코드와 범례가 갈라지지 않게 한 곳에서 관리).
# ══════════════════════════════════════════════════════════════════════════
HIER_COLOR = "#93a8c8"          # 1층 계층 = 차분한 청회색. 굵게, 그러나 튀지 않게
CO_COLOR = "#a8b4c8"            # 3층 동시출현 = 무채색 회색. '판단 경로 아님'을 색으로 못 박는다

# kind → (색, 그룹키, 한 줄 설명)   ※ 'kind' 값은 build_relation_edges.py 가 쓰는 그대로다
REL_KIND = {
    "생":     ("#3ec98a", "힘",   "상생 — 낳아준다 (목생화)"),
    "극":     ("#e0483f", "힘",   "상극 — 누른다 (목극토)"),
    # ★260725 신설 — 생극제화를 음양까지 맞춘 결과 생긴 두 종류(운영자: "제일 기초")
    "비화":   ("#7fb27a", "힘",   "비화 — 같은 오행끼리 서로 돕는다 (갑목↔을목)"),
    "제화":   ("#ffd166", "합충", "★제화 — 극인데 합으로 묶여 극이 풀린다 (갑목↔기토)"),
    "합":     ("#ffb02e", "합충", "합 — 서로 붙는다 (갑기합)"),
    # 🔴260726 — kind 세분(자축은 «육합»이면서 «방합»이다)을 여기 안 전했더니
    #   회색 «기타»로 폴백되고 음성(−) 표시가 빠졌다. 색이 곧 뜻인 화면이라 치명적이다.
    "천간합": ("#ffb02e", "합충", "천간 오합 — 갑기·을경·병신·정임·무계"),
    "육합":   ("#ffb02e", "합충", "지지 육합 — 자축·인해·묘술·진유·사신·오미"),
    "방합":   ("#ffc95c", "합충", "방합 — 계절 방위로 뭉친다 (인묘진=동방목)"),
    "삼합":   ("#ff9f1c", "합충", "삼합 — 생·왕·고 셋이 국을 이룬다"),
    "반합":   ("#ffd89b", "합충", "반합 — 삼합에서 한 글자 빠진 것"),
    "합화":   ("#ffe6b3", "합충", "합화 — 합이 다른 오행으로 化한다"),
    "천간충": ("#e0483f", "합충", "천간충(칠충) — 갑경·을신·병임·정계"),
    "지지충": ("#e0483f", "합충", "지지 육충 — 자오·축미·인신·묘유·진술·사해"),
    "삼형":   ("#c9484f", "합충", "삼형 — 인사신(무은지형)·축술미(지세지형)"),
    "상형":   ("#c9484f", "합충", "상형 — 자묘(무례지형)"),
    "산출":   ("#8ab4f8", "구조", "★조견표 — 일간/월지에서 그 글자를 뽑는 표"),
    "절차":   ("#6fa8f5", "구조", "★판정 절차 — 강약 점수제(110점)·득령득지득시득세"),
    "충":     ("#ff5c3a", "합충", "충 — 정면으로 부딪힌다 (자오충)"),
    "형":     ("#e8407a", "어긋", "형 — 서로 깎는다 (인사신 삼형)"),
    "파":     ("#d9527f", "어긋", "파 — 깨뜨린다"),
    "해":     ("#c85a86", "어긋", "해(害) — 해를 끼친다  ※해수(亥)와 다른 글자"),
    "원진":   ("#b8548f", "어긋", "원진 — 까닭 없이 미워한다"),
    "귀문":   ("#a35a9c", "어긋", "귀문관살 — 판본이 갈린다(그래서 가늘게)"),
    "소속":   ("#8ea6c8", "조립", "소속 — 어디에 속하나 (갑목→목)"),
    "구성":   ("#6f8bb5", "조립", "구성 — 무엇으로 이뤄지나 (삼합→세 글자)"),
    "롤업":   ("#a58ae0", "조립", "롤업 — 총칭↔개별 (비겁 일반→비견)"),
    "지장간": ("#5ac8e8", "조립", "지장간 — 지지 속에 든 천간 (굵기 = 비율)"),
    "육친":   ("#f08fb0", "배속", "육친 — 십성이 가리키는 사람 (인성→부모)"),
    "순서":   ("#c9a04d", "배속", "순서 — 차례 (장생→목욕)"),
    "인접":   ("#9aa3b2", "배속", "인접 — 옆칸 (연주-월주)"),
    "비교":   ("#d89b2a", "배속", "비교 — 나란히 놓고 봄"),
    "관계":   ("#22a8a0", "배속", "관계 — 운용상 짝 (용신↔희신)"),
    "전제":   ("#4a86e8", "논리", "전제 — 이게 있어야 성립한다"),
    "귀결":   ("#33a86b", "논리", "귀결 — 여기서 흘러나간다"),
    "적용":   ("#5aa9e6", "논리", "적용 — 어디에 걸리나 (운의 유불리→대운·세운)"),
    "반증":   ("#e0483f", "논리", "반증 — 뒤집는다 (현묘 폐기론 → 십이운성)"),
    # ★S15 발현·결과 축. S01~S14 가 전부 '입력 쪽 글자'라 결과가 착지할 곳이 없었다(7대 세션 발견).
    "발현":   ("#ff8fa3", "발현", "발현 — 글자가 몸·삶에서 실제로 나타나는 것 (목→간·담)"),
}
REL_GROUPS = [   # 화면 체크박스 순서 = 이 순서
    ("힘",   "생·극 — 오행의 힘"),
    ("합충", "합·충 — 끌어당김과 부딪힘"),
    ("어긋", "형·파·해·원진·귀문 — 어긋남"),
    ("조립", "소속·구성·롤업·지장간 — 뼈대 조립"),
    ("배속", "육친·순서·인접·비교·관계 — 배속과 자리"),
    ("논리", "전제·귀결·적용 — 논리 흐름"),
    ("발현", "발현 — 실제로 나타나는 결과(S15)"),
]
# polarity 가 '-' 인데 kind 자체는 붉은 계열이 아닌 경우(구성 4·전제 1·귀결 1) 붉게 덮어쓴다.
# 운영자 지시: "polarity:'-' 는 붉은 계열로 한눈에 갈리게".
NEG_KINDS = {"극", "충", "형", "파", "해", "원진", "귀문"
    # 260726 — 세분된 충·형도 음성이다(색만 바뀌고 부호가 빠지면 안 된다)
    "천간충", "지지충", "삼형", "상형",
}


def load_jsonl(path):
    return [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]


# ─────────────────────────── 1. 입력 로딩 + 스키마 방어
def load_all():
    nodes = load_jsonl(DATA / "neuron_nodes.jsonl")
    edges = load_jsonl(DATA / "neuron_edges.jsonl")

    # ★방어 코드 — 필드명 오독·경로 오류를 여기서 죽인다(조용히 0개로 지나가지 않게).
    assert len(nodes) > 200, f"개념 노드가 {len(nodes)}개뿐이다 — 파일·필드명 확인 필요"
    assert len(edges) > 1000, f"간선이 {len(edges)}개뿐이다 — 파일·필드명 확인 필요"
    need_n = {"concept", "big", "mid", "paras", "bridges", "authors", "flags", "top_links"}
    miss_n = need_n - set(nodes[0])
    assert not miss_n, f"노드 스키마 불일치 — 없는 필드: {miss_n}"
    need_e = {"a", "b", "w"}
    miss_e = need_e - set(edges[0])
    assert not miss_e, f"간선 스키마 불일치 — 없는 필드: {miss_e}"

    # ★★1·2층 입력 — 없거나 비면 여기서 죽는다.
    #   조용히 0개로 지나가는 것이 이 프로젝트 최대의 사고 패턴이었다(평의회 3차 R4).
    #   "계층 간선 0개인데 화면은 멀쩡히 떴다" 가 정확히 그 사고다. 그래서 assert 가 아니라
    #   SystemExit 으로 죽인다(python -O 로 assert 가 꺼져도 살아남게).
    rel_path = DATA / "relation_edges.jsonl"
    if not rel_path.exists():
        raise SystemExit(
            f"\n[치명] {rel_path} 가 없다.\n"
            "  이 파일이 1층(계층 뼈대)·2층(결정론 관계)의 유일한 입력이다. 없으면 화면이\n"
            "  예전처럼 '동시출현 하나뿐인 털뭉치'로 되돌아간다.\n"
            "  → 먼저  python build_relation_edges.py  를 돌려라.\n")
    rel = load_jsonl(rel_path)
    if not rel:
        raise SystemExit(f"\n[치명] {rel_path} 가 비었다(0줄). build_relation_edges.py 를 다시 돌려라.\n")

    need_r = {"a", "b", "kind", "dir", "polarity", "weight", "근거유형", "layer", "source", "author"}
    miss_r = need_r - set(rel[0])
    if miss_r:
        raise SystemExit(f"\n[치명] relation_edges.jsonl 스키마 불일치 — 없는 필드: {sorted(miss_r)}\n"
                         f"  첫 줄이 가진 필드: {sorted(rel[0])}\n")
    n_hier = sum(1 for e in rel if e["layer"] == "계층")
    n_relx = sum(1 for e in rel if e["layer"] == "관계")
    bad_layer = sorted({e["layer"] for e in rel} - {"계층", "관계"})
    if bad_layer:
        raise SystemExit(f"\n[치명] layer 값이 '계층'/'관계' 외에 있다: {bad_layer}\n"
                         "  화면은 이 두 값으로만 층을 가른다 — 새 값이 생겼으면 렌더러도 같이 고쳐라.\n")
    if n_hier < 100:
        raise SystemExit(f"\n[치명] 계층 간선이 {n_hier}개뿐이다(대주제→중주제→개념이면 300 근처여야 한다).\n"
                         "  운영자가 '계층화가 약하다'고 한 그 층이다. 0에 가까우면 화면에 뼈대가 안 선다.\n")
    if n_relx < 100:
        raise SystemExit(f"\n[치명] 결정론 관계 간선이 {n_relx}개뿐이다(생·극·합·충… 480 근처여야 한다).\n")

    lay_path = DATA / "node_layers.jsonl"
    if not lay_path.exists():
        raise SystemExit(f"\n[치명] {lay_path} 가 없다 — build_relation_edges.py 를 돌려라.\n")
    layers = load_jsonl(lay_path)
    if not layers or "concept" not in layers[0] or "layer" not in layers[0]:
        raise SystemExit(f"\n[치명] node_layers.jsonl 스키마 불일치 — concept·layer 필드가 필요하다.\n"
                         f"  읽은 줄 수 {len(layers)}\n")

    units = []
    for fn in ("pilot_UI.jsonl", "pilot_UJ.jsonl"):
        p = UNITS_DIR / fn
        if p.exists():
            units += load_jsonl(p)
    assert units, "판단 유닛을 하나도 못 읽었다 — P2_유닛 경로 확인"
    assert "links" in units[0], "유닛에 links 필드가 없다"
    return nodes, edges, units, rel, layers


# ─────────────────────────── 2. 이름 해소 (정본 concept 로 맞추기)
def resolve_big(label, bigs):
    """유닛의 links.계층.대주제 → 노드의 big.
    ⚠실측: 유닛 쪽 S코드가 노드와 한 칸 밀려 있다(유닛 'S02 오행' vs 노드 'S01 음양·오행').
      그래서 코드는 믿지 않고 이름으로만 맞춘다."""
    if not label:
        return -1
    name = label.split(" ", 1)[1] if " " in label else label
    for i, b in enumerate(bigs):
        if b.split(" ", 1)[-1] == name:
            return i
    for i, b in enumerate(bigs):
        bn = b.split(" ", 1)[-1]
        if name in bn or bn in name:
            return i
    return -1


def resolve_concept(name, idx_of, nodes, prefer_big=-1):
    """짧게 적힌 개념 이름을 정본 concept 로 해소. 못 찾으면 None.
    ⚠NEVER_RESOLVE 에 든 이름은 시도조차 하지 않는다 — 조용히 엉뚱한 데 붙는 것을 막는다."""
    if name in idx_of:
        return idx_of[name]
    if name in NEVER_RESOLVE:
        return None
    if name in MANUAL_ALIAS and MANUAL_ALIAS[name] in idx_of:
        return idx_of[MANUAL_ALIAS[name]]

    def pick(cands):
        if not cands:
            return None
        if len(cands) == 1:
            return cands[0]
        if prefer_big >= 0:
            same = [c for c in cands if nodes[c]["_b"] == prefer_big]
            if len(same) == 1:
                return same[0]
            if same:
                cands = same
        return sorted(cands, key=lambda c: len(nodes[c]["concept"]))[0]

    # ① 괄호형:  신금 → 신금(辛)
    c = pick([i for i, n in enumerate(nodes) if n["concept"].startswith(name + "(")])
    if c is not None:
        return c
    # ② 가운뎃점 분해:  고립 → 고립·불급
    c = pick([i for i, n in enumerate(nodes) if name in n["concept"].split("·")])
    if c is not None:
        return c
    # ③ 유일 부분일치
    c = pick([i for i, n in enumerate(nodes) if name in n["concept"]])
    return c


# ─────────────────────────── 3. 화면용 데이터 만들기
def build_db(nodes, edges, units, rel_edges, layers):
    bigs = sorted({n["big"] for n in nodes})
    big_idx = {b: i for i, b in enumerate(bigs)}
    for n in nodes:
        n["_b"] = big_idx[n["big"]]
    idx_of = {n["concept"]: i for i, n in enumerate(nodes)}

    maxw = max(e["w"] for e in edges)
    # 간선 상한: 기본으로 보여줄 최소 강도를 실측으로 정한다.
    # ⚠실측 튜닝(260725): 3,000개를 기본으로 두니 허브 주변이 흰 덩어리가 돼서 아무것도 안 읽혔다
    #   (개념당 평균 다리 39개). 1,500개(평균 25개)가 '엉킨 느낌은 살되 읽히는' 지점.
    #   더 보고 싶으면 화면의 최소 강도 슬라이더를 왼쪽으로 밀면 18,083개까지 간다.
    #   ★260725 저녁 추가: 3층(공기)은 기본 OFF 이고, 켰을 때의 하한도 최소 10 이상으로 못 박는다.
    #     실측 — w==1(딱 한 문단에서 우연히 같이 나옴)이 3,404개=15.5%, w<10 이 11,035개=50.3%.
    #     그걸 `목생화`와 같은 굵기로 그리던 것이 "다 연결돼 보이는데 아무것도 안 읽히는" 원인이었다.
    ws = sorted((e["w"] for e in edges), reverse=True)
    defw = max(10, ws[min(1500, len(ws) - 1)])

    # 노드 속성(layer·한자·오행·음양 體/用·분류) — node_layers.jsonl 에서 붙인다.
    lay_of = {r["concept"]: r for r in layers}
    miss_lay = [n["concept"] for n in nodes if n["concept"] not in lay_of]
    if miss_lay:
        print(f"  ⚠node_layers.jsonl 에 없는 개념 {len(miss_lay)}개: {miss_lay[:10]}", file=sys.stderr)

    out_nodes = []
    for n in nodes:
        L = lay_of.get(n["concept"], {})
        rec = {
            "c": n["concept"], "b": n["_b"], "m": n["mid"],
            "p": n["paras"], "g": n["bridges"],
            "au": dict(list(n["authors"].items())[:6]),
            "fl": dict(list(n["flags"].items())[:6]),
            "sj": n.get("subj", {}),
            "tl": [[l["to"], l["w"]] for l in n["top_links"][:12]],
            "ly": L.get("layer", "개념"),
        }
        for k_src, k_dst in (("한자", "hj"), ("오행", "oh"), ("음양", "ym"),
                             ("음양_體", "ymc"), ("음양_用", "ymy"), ("분류", "cls"), ("계열", "ser")):
            if L.get(k_src):
                rec[k_dst] = L[k_src]
        out_nodes.append(rec)

    out_edges = [[idx_of[e["a"]], idx_of[e["b"]], e["w"]]
                 for e in edges if e["a"] in idx_of and e["b"] in idx_of]

    # ── 유닛
    out_units, ulinks, hlinks = [], [], []
    uid_of = {u["unit_id"]: i for i, u in enumerate(units)}
    miss_x, miss_h = [], []
    # 감사용 — 정확 일치가 아니라 '별칭 해소'로 겨우 붙인 것들. 사람 눈으로 한 번 봐야 한다.
    alias_x, alias_h, exact_x = [], [], 0
    # ★미등재 개념 — 정확 일치도 별칭 해소도 실패한 이름. 조용히 버리거나 엉뚱한 데 붙이지 않고
    #   회색 점선 노드로 화면에 띄운다. '사전에 구멍이 있다'는 사실 자체가 산출물이다.
    ghost_idx = {}
    evid_mismatch = []
    unknown_rel = set()

    def ghost(name):
        """미등재 개념 노드를 만들어(또는 재사용해) 인덱스를 준다."""
        if name in ghost_idx:
            return ghost_idx[name]
        gi = len(out_nodes)
        out_nodes.append({"c": name, "b": -1, "m": "(사전 미등재)", "p": 0, "g": 0,
                          "au": {}, "fl": {}, "sj": {}, "tl": [], "miss": 1})
        ghost_idx[name] = gi
        return gi
    for ui, u in enumerate(units):
        L = u.get("links", {}) or {}
        hier = L.get("계층", {}) or {}
        ub = resolve_big(hier.get("대주제", ""), bigs)
        prob = u.get("확률", {}) or {}
        hedge = prob.get("헤지등급") or ""
        out_units.append({
            "id": u["unit_id"], "k": u.get("kind", ""), "t": u.get("title", ""),
            "b": ub, "bl": hier.get("대주제", ""), "m": hier.get("중주제", ""),
            "h": hedge, "f": prob.get("코퍼스빈도", 0),
            "au": u.get("author_cluster", ""),
            "cc": u.get("결론", ""),
            "mt": u.get("방법론", []) or [],
            "nc": len(u.get("chain", []) or []),
            "ne": len(u.get("근거", []) or []),
            "dl": (u.get("delta", {}) or {}).get("가심비", ""),
        })
        # 계층 링크 (유닛 → 그 유닛이 매달린 개념)
        for cname in hier.get("개념", []) or []:
            ci = resolve_concept(cname, idx_of, nodes, ub)
            al = 0
            if ci is None:                       # 미등재 → 유령 노드로 띄운다(버리지 않는다)
                miss_h.append((u["unit_id"], cname))
                ci = ghost(cname); al = 2
            elif cname not in idx_of:
                alias_h.append((u["unit_id"], cname, out_nodes[ci]["c"]))
                al = 1
            hlinks.append([ui, ci, al])
        # 횡단 링크 (유닛 → 개념 / 유닛 → 유닛)
        for lk in L.get("횡단", []) or []:
            to = lk.get("to", "") or ""
            rel = lk.get("rel", "") or ""
            if rel not in REL_GROUP:               # 새 rel 이 조용히 기본값으로 빠지지 않게
                unknown_rel.add(rel)
            grp = REL_GROUP.get(rel, "정밀화")
            pol = lk.get("polarity", "+") or "+"
            dr = lk.get("dir", "→") or "→"
            adj = 1 if lk.get("adjacent") else 0
            # ★굵기의 정본 = weight. 근거유형은 표시·대조용이지 굵기 계산에 쓰지 않는다.
            ev = lk.get("근거유형", "") or ""
            wt = lk.get("weight")
            if wt is None:                          # 없으면 근거유형 사다리로 보수적 추정
                wt = EVID_W.get(ev, 0.5)
            wt = max(0.0, min(1.0, float(wt)))
            if ev in EVID_W and abs(EVID_W[ev] - wt) > 1e-6:
                evid_mismatch.append((u["unit_id"], to, ev, EVID_W[ev], wt))
            note = lk.get("주", "") or ""
            if to.startswith("개념:"):
                cname = to[3:]
                ci = idx_of.get(cname)
                al = 0
                if ci is not None:
                    exact_x += 1
                else:                                # 정확 일치 실패 → 별칭 해소 시도
                    ci = resolve_concept(cname, idx_of, nodes, ub)
                    if ci is not None:
                        alias_x.append((u["unit_id"], cname, nodes[ci]["concept"]))
                        al = 1
                if ci is None:                       # 둘 다 실패 → 미등재 개념 노드로 띄운다
                    miss_x.append((u["unit_id"], cname))
                    ci = ghost(cname); al = 2
                ulinks.append([ui, 0, ci, grp, pol, dr, rel, adj, wt, ev, note, al])
            elif to in uid_of:
                ulinks.append([ui, 1, uid_of[to], grp, pol, dr, rel, adj, wt, ev, note, 0])
            else:
                miss_x.append((u["unit_id"], to))

    # ══════════════════════════════════════════════════════════════════
    #  ★1층 계층(뼈대) + 2층 결정론 관계 — 여기서 화면 좌표계에 태운다.
    #    ⚠항목(item) 인덱스 규약 — JS 와 반드시 같아야 한다:
    #        0        ~ NC-1        개념(+미등재 유령)
    #        NC       ~ NC+NU-1     판단 유닛
    #        NC+NU    ~ ...         계층 허브 (0=뿌리, 1..15=대주제, 16..66=중주제)
    #      유령 노드는 위 유닛 루프에서 이미 다 붙었으므로 NC 는 지금 확정된다.
    # ══════════════════════════════════════════════════════════════════
    NC, NU = len(out_nodes), len(out_units)
    HUB0 = NC + NU

    hier_e = [e for e in rel_edges if e["layer"] == "계층"]
    rel_e = [e for e in rel_edges if e["layer"] == "관계"]

    # 허브 이름 사전을 만든다. 대주제 이름 = bigs 그대로, 중주제 가상 노드 = "{대주제} › {중주제}"
    hubs = [{"n": "사주 지식망", "lv": 0, "b": -1}]
    hub_idx = {}                                   # 이름 → 전역 항목 인덱스
    for bi, b in enumerate(bigs):
        hub_idx[b] = HUB0 + len(hubs)
        hubs.append({"n": b, "lv": 1, "b": bi})
    # 중주제는 계층 간선에 실제로 등장한 것만 (순서는 대주제 → 등장 순)
    seen_mid = set()
    mids_by_big = {}
    for e in hier_e:
        for nm in (e["a"], e["b"]):
            if " › " in nm and nm not in seen_mid:
                seen_mid.add(nm)
                mids_by_big.setdefault(nm.split(" › ")[0], []).append(nm)
    for b in bigs:
        for nm in mids_by_big.get(b, []):
            hub_idx[nm] = HUB0 + len(hubs)
            hubs.append({"n": nm, "lv": 2, "b": big_idx.get(b, -1)})

    # ── ★방어: 관계·계층 간선의 a/b 중 정본 개념도 아니고 허브도 아닌 이름이 있으면 목록 찍고 exit 1.
    #    조용히 건너뛰면 "간선 480개인데 화면엔 400개"가 되고 아무도 눈치채지 못한다.
    unknown_ep = Counter()
    for e in rel_edges:
        for nm in (e["a"], e["b"]):
            if nm not in idx_of and nm not in hub_idx:
                unknown_ep[nm] += 1
    if unknown_ep:
        sys.stderr.write(
            "\n[치명] relation_edges.jsonl 의 간선 끝점 중 정본 개념도 아니고 계층 가상 노드도 아닌 이름이 있다.\n"
            "  이걸 조용히 버리면 화면 숫자가 거짓말을 한다(간선 480 → 실제로는 덜 그림).\n"
            f"  미확인 {len(unknown_ep)}종:\n")
        for nm, c in unknown_ep.most_common():
            sys.stderr.write(f"     '{nm}'  ({c}회)\n")
        sys.stderr.write("  → build_relation_edges.py 의 정본 노드명 또는 개념 사전(TAXONOMY)을 맞춰라.\n")
        raise SystemExit(1)

    def gi(name):
        return idx_of[name] if name in idx_of else hub_idx[name]

    # 1층: [부모, 자식, 레벨]  레벨 0=뿌리→대주제, 1=대주제→중주제, 2=중주제→개념
    hier_links = [[HUB0, hub_idx[b], 0] for b in bigs]      # 뿌리→대주제 (파일에 없는 최상단 한 칸)
    for e in hier_e:
        a, b = gi(e["a"]), gi(e["b"])
        lv = 1 if (" › " in e["b"]) else 2
        hier_links.append([a, b, lv])

    # 2층: [a, b, kind, dir, polarity, weight, source, note, stance, 조건]
    KINDS = sorted({e["kind"] for e in rel_e})
    unknown_kind = sorted(k for k in KINDS if k not in REL_KIND)
    rel_links = [[gi(e["a"]), gi(e["b"]), e["kind"], e["dir"], e["polarity"],
                  float(e["weight"]), e.get("source", ""), e.get("note", ""),
                  e.get("stance", ""), e.get("조건", "")] for e in rel_e]

    db = {
        "stamp": datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "bigs": [{"n": b, "c": BIG_COLORS[i % len(BIG_COLORS)]} for i, b in enumerate(bigs)],
        "nodes": out_nodes, "edges": out_edges,
        "units": out_units, "ulinks": ulinks, "hlinks": hlinks,
        "maxw": maxw, "defw": defw,
        "relc": GROUP_COLOR, "reld": GROUP_DESC, "negc": NEG_COLOR,
        "ladder": [{"k": k, "w": w, "d": d} for k, w, d in EVID_LADDER],
        "nconcept": len(nodes),          # 이 뒤는 전부 미등재(유령) 노드
        # ── 1·2층
        "hubs": hubs, "hier": hier_links, "rel": rel_links,
        "kindc": {k: v[0] for k, v in REL_KIND.items()},
        "kindg": {k: v[1] for k, v in REL_KIND.items()},
        "kindd": {k: v[2] for k, v in REL_KIND.items()},
        "kgroups": [{"g": g, "d": d} for g, d in REL_GROUPS],
        "negk": sorted(NEG_KINDS),
        "hierc": HIER_COLOR, "coc": CO_COLOR,
        "kindn": dict(Counter(e["kind"] for e in rel_e)),
    }
    # ★안전망 — build_relation_edges.py 가 새 kind 를 추가해도 조용히 사라지지 않게.
    #   색표에 없으면 회색 '기타' 그룹으로 몰아 화면에 그리고, 콘솔에도 경고를 찍는다.
    #   (색표에 없다고 안 그리면 "간선 568개인데 화면엔 559개"가 되고 아무도 못 본다)
    if unknown_kind:
        for k in unknown_kind:
            db["kindc"][k] = "#8a94a6"
            db["kindg"][k] = "기타"
            db["kindd"][k] = k + " — ※색표 미등록. build_graph_view.py 의 REL_KIND 에 추가할 것"
        db["kgroups"].append({"g": "기타", "d": "기타 — 색표에 아직 없는 관계(회색)"})
    audit = {"miss_x": miss_x, "miss_h": miss_h,
             "alias_x": alias_x, "alias_h": alias_h, "exact_x": exact_x,
             "ghosts": list(ghost_idx), "evid_mismatch": evid_mismatch,
             "unknown_rel": sorted(unknown_rel),
             "unknown_kind": unknown_kind,
             "n_hier": len(hier_links), "n_rel": len(rel_links), "n_hub": len(hubs),
             "rel_kind_cnt": Counter(e["kind"] for e in rel_e),
             "rel_pol_cnt": Counter(e["polarity"] for e in rel_e),
             "miss_lay": miss_lay}
    return db, audit


# ─────────────────────────── 4. HTML
# f-string 을 쓰면 JS 중괄호를 전부 두 번 써야 해서 사고가 난다 → 자리표시자 치환 방식.
TEMPLATE = r"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- ★라이트 테마 OS 에서도 슬라이더·체크박스가 어두운 패널 위에서 제대로 보이게.
     이게 없으면 라이트 모드 윈도우에서 컨트롤만 흰색으로 떠서 화면이 망가진다. -->
<meta name="color-scheme" content="dark">
<title>지식망 — 개념·판단 유닛 연결 지도</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  background:#0e1014;color:#e6e8ec;overflow:hidden}
#top{height:44px;display:flex;align-items:center;gap:14px;padding:0 14px;
  background:#151922;border-bottom:1px solid #262b35;position:relative;z-index:20}
#top h1{font-size:15px;margin:0;font-weight:700;white-space:nowrap}
#top .stamp{font-size:11px;color:#7c8494;white-space:nowrap}
#top nav{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
#top nav a{font-size:12px;color:#9aa3b2;text-decoration:none;padding:5px 10px;border-radius:7px;
  border:1px solid #2a303b;white-space:nowrap}
#top nav a:hover{background:#20262f;color:#e6e8ec}
#top nav a.on{background:#2a3346;color:#cfe0ff;border-color:#3d4c6b}
#wrap{position:absolute;top:44px;left:0;right:0;bottom:0}
canvas{display:block;width:100%;height:100%;cursor:grab}
canvas.grab{cursor:grabbing}

.panel{position:absolute;top:10px;background:#151922ee;border:1px solid #262b35;border-radius:12px;
  backdrop-filter:blur(6px);font-size:12px;max-height:calc(100% - 20px);overflow:auto}
#left{left:10px;width:246px;padding:12px}
#right{right:10px;width:300px;padding:0}
.panel::-webkit-scrollbar{width:8px}
.panel::-webkit-scrollbar-thumb{background:#2c3340;border-radius:4px}
h3{font-size:11px;color:#7c8494;margin:14px 0 7px;letter-spacing:.4px;font-weight:700}
h3:first-child{margin-top:0}
.seg{display:flex;gap:4px;background:#0e1218;padding:3px;border-radius:9px}
.seg button{flex:1;border:0;background:transparent;color:#9aa3b2;padding:7px 4px;border-radius:7px;
  font-size:12px;cursor:pointer;font-family:inherit}
.seg button.on{background:#33507f;color:#fff;font-weight:700}
.seg button:hover:not(.on){background:#1d232d}
input[type=search],input[type=text]{width:100%;padding:8px 10px;border:1px solid #2c3340;border-radius:8px;
  background:#0e1218;color:#e6e8ec;font-size:13px;font-family:inherit}
input[type=range]{width:100%;accent-color:#4a86e8}
label.ck{display:flex;align-items:center;gap:7px;padding:3px 0;cursor:pointer;line-height:1.3}
label.ck input{accent-color:#4a86e8;flex:none}
.sw{width:11px;height:11px;border-radius:3px;flex:none}
.mini{font-size:11px;color:#7c8494}
.row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:6px 0}
button.act{width:100%;padding:8px;border:1px solid #2c3340;background:#1a2029;color:#c3cbd8;
  border-radius:8px;cursor:pointer;font-size:12px;font-family:inherit}
button.act:hover{background:#232b36}
#legend{padding:12px;border-bottom:1px solid #262b35}
.lg{display:flex;align-items:center;gap:8px;margin:5px 0;line-height:1.35}
.lgline{width:34px;height:0;border-top-style:solid;flex:none}
#info{padding:12px}
#info .ttl{font-size:16px;font-weight:700;margin-bottom:2px;line-height:1.3}
#info .sub{font-size:11px;color:#8b94a4;margin-bottom:10px}
#info .kv{display:flex;gap:8px;margin:14px 0 6px}
.stat{flex:1;background:#0e1218;border:1px solid #232935;border-radius:9px;padding:8px}
.stat .k{font-size:10px;color:#7c8494}
.stat .v{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums}
.bar{height:6px;border-radius:3px;background:#232935;overflow:hidden;margin-top:3px}
.bar i{display:block;height:100%}
.brow{margin:6px 0;font-size:11px}
.brow b{float:right;color:#9aa3b2;font-weight:600}
.chip{display:inline-block;background:#1c2430;border-radius:6px;padding:2px 7px;margin:2px 3px 2px 0;
  font-size:11px;cursor:pointer}
.chip:hover{background:#2a3547}
.chip b{color:#6f9bea;margin-left:4px;font-size:10px}
.q{font-size:12px;line-height:1.65;color:#c3cbd8;background:#0e1218;border:1px solid #232935;
  border-radius:8px;padding:9px;margin:6px 0}
#hint{position:absolute;left:266px;bottom:10px;right:320px;font-size:11px;color:#6f7787;background:#151922e6;
  border:1px solid #232935;border-radius:8px;padding:6px 10px;z-index:15;line-height:1.7}
#hint b{color:#c3cbd8;font-variant-numeric:tabular-nums}
#tip{position:absolute;pointer-events:none;background:#0b0e13ee;border:1px solid #313a48;
  border-radius:7px;padding:5px 9px;font-size:12px;z-index:30;display:none;white-space:nowrap}
.dim{opacity:.45}
.mono{font-variant-numeric:tabular-nums}
</style></head><body>

<div id="top">
  <h1>지식망</h1>
  <span class="stamp">%%STAMP%% · 개념 %%NNODE%%%%NMISS%% · 판단유닛 %%NUNIT%%
    &nbsp;|&nbsp; <b style="color:#93a8c8">1층 계층 %%NHIER%%</b>
    · <b style="color:#ffb02e">2층 관계 %%NREL%%</b>
    · <span style="color:#7c8494">3층 동시출현 %%NCO%%</span></span>
  <nav>
    <a class="on" href="#">지식망</a>
    <a href="현황판.html">현황판</a>
    <a href="개념지도.html">개념지도</a>
    <a href="뉴런망.html">뉴런망(표)</a>
    <a href="개념트리.html">개념트리</a>
  </nav>
</div>

<div id="wrap">
  <canvas id="cv"></canvas>

  <div class="panel" id="left">
    <h3>보기 방식</h3>
    <div class="seg" id="modes">
      <button data-m="neuron" class="on">뉴런</button>
      <button data-m="cyl">원기둥</button>
      <button data-m="tree">트리</button>
      <button data-m="hier">방사</button>
      <button data-m="globe">지구본</button>
    </div>
    <div class="mini" id="modedesc" style="margin-top:6px"></div>

    <h3>검색</h3>
    <input type="search" id="q" placeholder="개념·유닛 이름 (예: 용신, 신강)">

    <!-- ★층(레이어) — 이 화면의 뼈대. 지우는 게 아니라 켜고 끈다. -->
    <h3>층 (레이어) <span class="mini">— 켜고 끄기</span></h3>
    <label class="ck"><input type="checkbox" id="e_hi" checked>
      <span class="sw" style="background:#93a8c8"></span>
      <span style="flex:1"><b>1층 계층</b> — 뼈대(트리)</span>
      <span class="mini mono" id="c_hi"></span></label>
    <label class="ck"><input type="checkbox" id="e_re" checked>
      <span class="sw" style="background:#ffb02e"></span>
      <span style="flex:1"><b>2층 관계</b> — 생·극·합·충…</span>
      <span class="mini mono" id="c_re"></span></label>
    <label class="ck"><input type="checkbox" id="e_co">
      <span class="sw" style="background:#5a6472"></span>
      <span style="flex:1"><b>3층 동시출현</b> — 공기</span>
      <span class="mini mono" id="c_co"></span></label>
    <div id="cobox" style="margin:6px 0 0;padding:8px;border:1px solid #2a2418;background:#181510;border-radius:8px">
      <div class="mini" style="color:#c9a04d;line-height:1.55;margin-bottom:6px">
        ⚠ 3층은 <b>“같은 문단에 같이 나왔다”</b>일 뿐이다. 뜻이 아니라 <b>빈도</b>이고
        <b>판단 경로가 아니다.</b> <span id="conote">…</span></div>
      <!-- ★백본 필터 — 기본 방식. 개념마다 자기 상위 k개만 남겨서 아무도 사라지지 않게 한다. -->
      <div class="mini mono" style="margin-bottom:3px">
        백본 — 개념마다 상위 <b id="tklab">5</b>개</div>
      <input type="range" id="tk" min="1" max="30" value="5">
      <label class="ck" style="margin-top:4px"><input type="checkbox" id="glow" checked>
        <span style="flex:1">빛 번짐 <span class="mini">(겹칠수록 밝아짐 — 밀도가 빛으로 보인다)</span></span></label>
      <div class="mini" id="wcnt" style="margin-top:5px"></div>
      <details style="margin-top:6px">
        <summary class="mini" style="cursor:pointer;color:#8b94a4">옛 방식(전역 임계)로 보기</summary>
        <div class="mini mono" id="wlab" style="margin:5px 0 3px"></div>
        <input type="range" id="w" min="0" max="100" value="0">
        <div class="mini" style="color:#8b94a4;line-height:1.5;margin-top:4px">
          모든 간선에 같은 하한을 건다. 굵은 것만 남아서 <b>가는 개념은 통째로 사라진다</b> —
          실측: 하한 219회면 개념 142개(57%)의 다리가 0개가 됐다.</div>
      </details>
    </div>

    <h3>2층 — 관계 종류</h3>
    <div id="kindbox"></div>

    <h3>판단 유닛 <span class="mini mono" id="c_un"></span></h3>
    <label class="ck"><input type="checkbox" id="showu" checked>
      <span class="sw" style="background:#ffcc4d;transform:rotate(45deg)"></span> 유닛 노드 보이기</label>
    <label class="ck"><input type="checkbox" id="e_ux" checked> 유닛 횡단 링크 (색)</label>
    <label class="ck"><input type="checkbox" id="e_uh" checked> 유닛 계층 링크 (노란 점선)</label>

    <h3>뭉침 정도 <span class="mini">(뉴런 모드)</span></h3>
    <input type="range" id="cl" min="0" max="100" value="38">
    <div class="mini">0 = 자유롭게 · 100 = 대주제끼리 뭉치게</div>

    <h3>이름표</h3>
    <input type="range" id="lb" min="0" max="3" value="1">
    <div class="mini" id="lblab"></div>

    <h3>대주제 <span class="mini" id="bigcnt"></span></h3>
    <div class="mini" style="margin-bottom:5px;line-height:1.5">
      하나만 켜면 <b>그 가지만</b> 크게 펴진다 — 트리 모드에서 가장 잘 읽힌다.</div>
    <div id="bigbox"></div>
    <label class="ck" style="margin-top:6px;border-top:1px solid #232935;padding-top:7px">
      <input type="checkbox" id="showmiss" checked>
      <span class="sw" style="border:2px dashed #8b94a4;background:transparent;border-radius:50%"></span>
      미등재 개념 <span class="mini mono" id="misscnt"></span></label>
    <div class="row" style="margin-top:4px">
      <button class="act" id="allon">전체 켜기</button>
      <button class="act" id="alloff">전체 끄기</button>
    </div>

    <h3>기타</h3>
    <button class="act" id="fit">화면에 맞추기</button>
    <button class="act" id="reheat" style="margin-top:5px">다시 배치하기</button>
    <label class="ck" style="margin-top:7px"><input type="checkbox" id="spin" checked> 지구본 자동 회전</label>
  </div>

  <div class="panel" id="right">
    <div id="legend"></div>
    <div id="info"></div>
  </div>

  <div id="hint"></div>
  <div id="tip"></div>
</div>

<script>
const DB = %%DATA%%;
/* ══════════════════════════════════════════════════════════════════
   1. 항목(item) 배열 — 개념·판단 유닛·계층 허브를 한 배열에 담는다.
      0        ~ NC-1        = 개념 (+ 미등재 유령)
      NC       ~ NC+NU-1     = 판단 유닛
      NC+NU    ~ NT-1        = 계층 허브 (0=뿌리, 1..15=대주제, 그 뒤 = 중주제)
      ⚠이 순서는 파이썬 build_db() 가 인덱스를 계산할 때 쓴 규약과 같아야 한다. 바꾸면 둘 다 바꿔라.
   ══════════════════════════════════════════════════════════════════ */
const NC = DB.nodes.length, NU = DB.units.length, NH = DB.hubs.length;
const HUB0 = NC + NU, NT = NC + NU + NH;
const IT = [];
let maxParas = 1;
for (const n of DB.nodes) maxParas = Math.max(maxParas, n.p);
for (let i = 0; i < NC; i++) {
  const n = DB.nodes[i];
  IT.push({ t: n.miss ? 'g' : 'c', i: i, name: n.c, big: n.b, mid: n.m,
            r: n.miss ? 7 : 5.5 + 18 * Math.log(1 + n.p) / Math.log(1 + maxParas), // 크기 = 문단 수(log)
            col: n.miss ? '#8b94a4' : DB.bigs[n.b].c, d: n });
}
for (let u = 0; u < NU; u++) {
  const q = DB.units[u];
  IT.push({ t: 'u', i: u, name: q.id, big: q.b, mid: q.m,
            r: 11, col: q.k === 'U-JUDGE' ? '#ffb347' : '#ffe066', d: q });
}
/* ★계층 허브 — 지금까지 대주제·중주제는 노드의 '문자열'로만 있었고 점도 선도 없었다.
   그래서 화면에서 `오행(총칭)`과 `신금(辛)`이 형제처럼 나란히 떴다(운영자가 본 그 화면).
   여기서 진짜 노드로 만든다 → 물리에도 참여하고, 클릭·검색도 되고, 트리도 설 수 있다. */
for (let k = 0; k < NH; k++) {
  const h = DB.hubs[k];
  IT.push({ t: 'h', i: k, lv: h.lv,
            name: h.lv === 2 ? h.n.split(' › ')[1] : h.n, full: h.n,
            big: h.b, mid: '',
            r: h.lv === 0 ? 15 : (h.lv === 1 ? 11 : 7.5),
            col: h.lv === 0 ? '#dfe6f2' : (DB.bigs[h.b] ? DB.bigs[h.b].c : '#8b94a4'),
            d: h });
}

/* 간선 5종을 공통 형태로 정리 */
const E_CO = DB.edges;                       // 3층 동시출현  [i, j, w]
/* 1층 계층 — [부모, 자식, 레벨(0 뿌리→대주제 · 1 대주제→중주제 · 2 중주제→개념)] */
const E_HI = DB.hier.map(function (l) { return { a: l[0], b: l[1], lv: l[2] }; });
/* 2층 결정론 관계 — [a, b, kind, dir, polarity, weight, source, note, stance, 조건] */
const E_RE = DB.rel.map(function (l) {
  return { a: l[0], b: l[1], kind: l[2], dir: l[3], pol: l[4], wt: l[5],
           src: l[6], note: l[7], stance: l[8], cond: l[9], grp: DB.kindg[l[2]] || '기타' };
});
const E_UX = DB.ulinks.map(function (l) {    // 유닛 횡단
  return { a: NC + l[0], b: (l[1] === 0 ? l[2] : NC + l[2]),
           grp: l[3], pol: l[4], dir: l[5], rel: l[6], adj: l[7],
           wt: l[8], ev: l[9], note: l[10], al: l[11] };
});
const E_UH = DB.hlinks.map(function (l) { return { a: NC + l[0], b: l[1], al: l[2] || 0 }; });

/* ★2층 색 정본 — kind 색이 기본. 단 polarity 가 '-' 인데 kind 자체가 붉은 계열이 아니면
   붉은색으로 덮어쓴다. 운영자 지시: "부호 −는 한눈에 갈리게". */
const NEGSET = {}; for (const k of DB.negk) NEGSET[k] = 1;
function relColor(e) {
  if (e.pol === '-' && !NEGSET[e.kind]) return DB.negc;
  return DB.kindc[e.kind] || '#8a94a6';
}
/* 자식 목록 — 트리 배치·정보판에서 쓴다 */
const KIDS = []; for (let i = 0; i < NT; i++) KIDS.push([]);
const PARENT = new Int32Array(NT).fill(-1);
for (const e of E_HI) { KIDS[e.a].push(e.b); PARENT[e.b] = e.a; }

/* ★굵기의 정본 = weight (운영자 지시 260725: "연결의 강도는 얼마나 강하게 붙어있느냐").
   지수 1.35 를 먹여 약한 링크가 확실히 가늘어지게 한다 — 권위·임상 0.2 짜리가
   단일저자논증 0.7 짜리와 눈으로 갈려야 시각화가 제 일을 한 것이다.
   실측: 0.2 → 1.2px · 0.7 → 4.0px · 0.9 → 5.3px (약 3.2배 차이) */
function wtWidth(w) { return 0.6 + Math.pow(Math.max(0, Math.min(1, w)), 1.35) * 5.4; }

/* 인접 목록 (이웃 하이라이트용) */
const NB = []; for (let i = 0; i < NT; i++) NB.push(new Set());
for (const e of E_CO) { NB[e[0]].add(e[1]); NB[e[1]].add(e[0]); }
for (const e of E_HI) { NB[e.a].add(e.b); NB[e.b].add(e.a); }
for (const e of E_RE) { NB[e.a].add(e.b); NB[e.b].add(e.a); }
for (const e of E_UX) { NB[e.a].add(e.b); NB[e.b].add(e.a); }
for (const e of E_UH) { NB[e.a].add(e.b); NB[e.b].add(e.a); }

/* ══════════════════════════════════════════════════════════════════
   2. 상태
   ══════════════════════════════════════════════════════════════════ */
/* ★기본값 — 1·2층 기본 ON, 3층(공기) 기본 OFF.
   ★첫 화면 = '뉴런'(옵시디언). 운영자 판정(260726):
     > "결과적으로 내 생각엔 **옵시디언 형태 또는 옵시디언에 테서랙트를 결합한게 맞음.
     >  저 형태는 잘못됬어**"   ("저 형태" = 트리 — 일렬 배치)
     > "뉴런 신경망처럼 가야되는거지"
   ⚠트리를 기본으로 뒀던 게 왜 틀렸나 — **일렬로 늘어놓으면 거리가 거짓말을 한다.**
     운영자 원문: *"1번하고 15번이 멀리 떨어져있어서 5번 15번보다 관련없는거처럼 연출이 되는거고"*
     실제로 `음양·오행 → 장부·증상` 발현 간선이 있는데도 트리에서는 양 끝에 서서 남남처럼 보였다.
     *"저게 테서렉트도 아니여서 웜홀처럼 알고보니 1과 13이 가까이 있다의 개념도 아닌데"*
     → 배치는 **관계가 정해야** 한다. 계층은 배치가 아니라 다른 채널(색·크기·원기둥 높이)로. */
const S = {
  mode: 'neuron', minW: DB.defw,
  /* ★공기 층 솎는 방식 — 기본은 노드별 top-k(백본).
     전역 임계는 굵은 허브만 남기고 가는 개념을 통째로 지운다(실측: 개념 57%가 다리 0개).
     top-k 는 모든 개념이 자기 상위 k개를 지켜서 아무도 사라지지 않는다. */
  coMode: 'topk', topK: 5,
  coSpring: false,                         // 공기는 배치에 관여하지 않는다(O2 실측)
  glow: true,                              // 가산합성(밀도가 빛으로 보임)
  showHi: true, showRe: true, showCo: false, showUX: true, showUH: true,
  kindOn: {},                              // 관계 그룹(힘·합충·어긋·조립·배속·논리)별 on/off
  bigOn: DB.bigs.map(function () { return true; }), showU: true, showMiss: true,
  q: '', label: 1, cluster: 0.38, spin: true,
  sel: -1, hover: -1, drag: -1,
  cam: { x: 0, y: 0, k: 1 },
  yaw: 0.4, pitch: -0.25,
  alpha: 1, autofit: true      // 사람이 화면을 만지면 꺼진다
};
for (const g of DB.kgroups) S.kindOn[g.g] = true;
S.kindOn['기타'] = true;

/* 위치·속도 (물리) */
const X = new Float64Array(NT), Y = new Float64Array(NT);
const VX = new Float64Array(NT), VY = new Float64Array(NT);
const FX = new Float64Array(NT), FY = new Float64Array(NT);
const M = new Float64Array(NT);
const TX = new Float64Array(NT), TY = new Float64Array(NT);   // 계층 모드 목표점
const SPH = [];                                                // 지구본 구면좌표
const VIS = new Uint8Array(NT);
const PIN = new Uint8Array(NT);
const DEG = new Int32Array(NT);      // 지금 보이는 간선 기준 차수 (스프링 정규화에 쓴다)

/* 대주제 앵커 (뭉침 목표) */
const NB_BIG = DB.bigs.length;
const ANC = [];
for (let b = 0; b < NB_BIG; b++) {
  const a = Math.PI * 2 * b / NB_BIG - Math.PI / 2;
  ANC.push([Math.cos(a) * 560, Math.sin(a) * 560]);
}

function seedPositions() {
  for (let i = 0; i < NT; i++) {
    const b = IT[i].big >= 0 ? IT[i].big : 0;
    const a = Math.random() * Math.PI * 2, rr = 40 + Math.random() * 260;
    X[i] = ANC[b][0] * 0.55 + Math.cos(a) * rr;
    Y[i] = ANC[b][1] * 0.55 + Math.sin(a) * rr;
    VX[i] = VY[i] = 0;
    M[i] = IT[i].r;
  }
}
seedPositions();

/* 계층 허브 인덱스 헬퍼 — 규약: HUB0=뿌리, HUB0+1+b=대주제 b, 그 뒤가 중주제 */
const ROOT = HUB0;
function bigHub(b) { return HUB0 + 1 + b; }
const MIDS_OF = {};                       // 대주제 b -> [중주제 허브 인덱스…]
for (let b = 0; b < DB.bigs.length; b++) MIDS_OF[b] = [];
for (let k = 1 + DB.bigs.length; k < NH; k++) MIDS_OF[DB.hubs[k].b].push(HUB0 + k);
const UNITS_OF = {};                      // 대주제 b -> [유닛 항목 인덱스…]
for (let u = 0; u < NU; u++) { const b = DB.units[u].b; (UNITS_OF[b] = UNITS_OF[b] || []).push(NC + u); }
const GHOSTS = []; for (let i = 0; i < NC; i++) if (IT[i].t === 'g') GHOSTS.push(i);

/* ══════════════════════════════════════════════════════════════════
   ★원기둥 모드 — 운영자 지시(260726)
   > "그 옵시디언 형태로 하면서 이 계층 구조를 살릴 수 있어? **원기둥으로 옵시디언을 만들던지**"

   트리 모드는 계층이 보이지만 뻣뻣하고, 뉴런 모드는 유기적이지만 계층이 안 보인다.
   원기둥은 둘을 축으로 나눠 가진다:
     · **세로(z) = 계층**   뿌리 → 대주제 → 중주제 → 개념 → 유닛 이 층으로 쌓인다
     · **가로(xy) = 옵시디언**  각 층 안에서는 힘기반으로 자유롭게 뭉친다
   → 위에서 보면 옵시디언, 옆에서 보면 계층. 돌리면 둘 다 보인다.

   ⚠왜 구(球)가 아니라 원기둥인가 — 구는 대주제를 표면에 흩뿌려서 **계층이 사라진다**
     (지구본 모드가 그렇다). 층을 살리려면 한 축을 계층에 통째로 내줘야 한다.
   ══════════════════════════════════════════════════════════════════ */
const CZ = new Float64Array(NT);        // 층 높이 −1(아래) ~ +1(위)
for (let i = 0; i < NT; i++) {
  const it = IT[i];
  CZ[i] = it.t === 'h' ? (it.lv === 0 ? 1.00 : (it.lv === 1 ? 0.55 : 0.10))
        : (it.t === 'u' ? -0.92 : -0.48);   // 유닛은 개념보다 한 칸 아래
}

/* ══════════════════════════════════════════════════════════════════
   ★트리 모드 — 위에서 아래로 서는 진짜 계층 배치.
     뿌리 → 대주제 15 → 중주제 51 → 개념 249.
     운영자가 "계층화 트리구조가 약하다"고 한 것이 이 그림이 없어서다.
     ⚠249개 잎을 한 화면에 이름까지 다 띄우는 것은 물리적으로 불가능하다.
       그래서 (a)허브 이름표는 화면 고정 크기로 항상 읽히게 하고
             (b)대주제를 하나만 켜면 그 가지만 남아 통째로 크게 펴지게 했다.
     ══════════════════════════════════════════════════════════════ */
const TREE_Y = [0, 360, 720, 900];      // 뿌리 · 대주제 · 중주제 · 첫 개념 줄
const TREE_ROW = 32, TREE_BGAP = 90;
let treeSpan = 1, treeCol = 112, treeStagger = 0;
function layoutTree() {
  let x = 0, maxRow = 1;
  const onBigs = [];
  for (let b = 0; b < DB.bigs.length; b++) if (S.bigOn[b]) onBigs.push(b);
  const bigs = onBigs.length ? onBigs : [];
  /* ★칸 너비를 켜진 대주제 수에 따라 바꾼다.
     전체(15개)를 켜면 좁게 = 구조를 한눈에. 몇 개만 켜면 넓게 = 이름표까지 읽히게.
     화면 폭은 정해져 있으므로 이렇게 하지 않으면 둘 중 하나는 반드시 못 읽는다. */
  treeCol = bigs.length <= 2 ? 300 : (bigs.length <= 5 ? 200 : 112);
  /* 대주제가 많으면 이름표가 가로로 겹친다 → 두 줄로 엇갈려 놓는다(조직도에서 흔한 처리) */
  treeStagger = bigs.length >= 8 ? 96 : 0;
  for (let j = 0; j < bigs.length; j++) {
    const b = bigs[j], ms = MIDS_OF[b], start = x;
    for (const mh of ms) {
      TX[mh] = x; TY[mh] = TREE_Y[2];
      const kids = KIDS[mh];
      for (let t = 0; t < kids.length; t++) { TX[kids[t]] = x; TY[kids[t]] = TREE_Y[3] + t * TREE_ROW; }
      if (kids.length > maxRow) maxRow = kids.length;
      x += treeCol;
    }
    if (!ms.length) x += treeCol;
    TX[bigHub(b)] = (start + x - treeCol) / 2; TY[bigHub(b)] = TREE_Y[1] + (j % 2) * treeStagger;
    x += TREE_BGAP;
  }
  const span = Math.max(1, x - TREE_BGAP), cx = span / 2;
  treeSpan = span;
  // 유닛은 자기 대주제 밑 맨 아래 줄에
  const uy = TREE_Y[3] + maxRow * TREE_ROW + 70;
  const on = {}; for (const b of bigs) on[b] = 1;
  for (const b of bigs) {
    const arr = UNITS_OF[b] || [];
    for (let t = 0; t < arr.length; t++) {
      TX[arr[t]] = TX[bigHub(b)] + (t - (arr.length - 1) / 2) * 60; TY[arr[t]] = uy;
    }
  }
  /* ⚠꺼진 대주제의 유닛은 계속 보이므로(유닛은 대주제 필터를 안 탄다) 여기서 자리를 안 주면
     이전 배치의 좌표에 그대로 남아 트리 폭을 통째로 늘린다 — 그러면 대주제 하나만 켜도
     화면이 안 커지고 이름표가 끝내 안 뜬다. 실측으로 잡은 버그(260725). → 오른쪽 별도 칸으로. */
  const stray = [];
  for (let u = 0; u < NU; u++) { const b = DB.units[u].b; if (b >= 0 && !on[b]) stray.push(NC + u); }
  const orphan = (UNITS_OF[-1] || []).concat(stray, GHOSTS);
  for (let t = 0; t < orphan.length; t++) { TX[orphan[t]] = span + treeCol; TY[orphan[t]] = TREE_Y[3] + t * TREE_ROW; }
  TX[ROOT] = cx; TY[ROOT] = TREE_Y[0];
  for (let i = 0; i < NT; i++) TX[i] -= cx;
  // 꺼진 대주제의 허브·개념은 화면 밖으로(어차피 VIS=0)
  for (let b = 0; b < DB.bigs.length; b++) {
    if (S.bigOn[b]) continue;
    TX[bigHub(b)] = 0; TY[bigHub(b)] = TREE_Y[1];
    for (const mh of MIDS_OF[b]) { TX[mh] = 0; TY[mh] = TREE_Y[2]; for (const c of KIDS[mh]) { TX[c] = 0; TY[c] = TREE_Y[3]; } }
  }
}

/* ── 방사 모드 목표 좌표: 중심 → 대주제 → 중주제 → 개념 (원형) */
function layoutHier() {
  const NBG = DB.bigs.length;
  let totalLeaf = 0;
  const weight = {};
  for (let b = 0; b < NBG; b++) {
    let c = 0;
    for (const mh of MIDS_OF[b]) c += KIDS[mh].length;
    weight[b] = Math.max(c, 1); totalLeaf += weight[b];
  }
  let ang = -Math.PI / 2;
  const R1 = 300, R2 = 520, R3 = 760;
  TX[ROOT] = 0; TY[ROOT] = 0;
  for (let b = 0; b < NBG; b++) {
    const span = Math.PI * 2 * weight[b] / totalLeaf;
    const ac = ang + span / 2;
    TX[bigHub(b)] = Math.cos(ac) * R1; TY[bigHub(b)] = Math.sin(ac) * R1;
    let sub = ang;
    for (const mh of MIDS_OF[b]) {
      const arr = KIDS[mh];
      const sp = span * Math.max(arr.length, 0.4) / weight[b];
      const mc = sub + sp / 2;
      TX[mh] = Math.cos(mc) * R2; TY[mh] = Math.sin(mc) * R2;
      for (let t = 0; t < arr.length; t++) {
        const a2 = sub + sp * (t + 0.5) / arr.length;
        const rr = R3 + (t % 3) * 46;
        TX[arr[t]] = Math.cos(a2) * rr; TY[arr[t]] = Math.sin(a2) * rr;
      }
      sub += sp;
    }
    // 판단 유닛은 자기 대주제 바깥 고리에
    const arr = UNITS_OF[b] || [];
    for (let t = 0; t < arr.length; t++) {
      const a2 = ac + (t - (arr.length - 1) / 2) * 0.12;
      TX[arr[t]] = Math.cos(a2) * 980; TY[arr[t]] = Math.sin(a2) * 980;
    }
    ang += span;
  }
  const orphan = (UNITS_OF[-1] || []).concat(GHOSTS);
  for (let t = 0; t < orphan.length; t++) {
    const a2 = Math.PI * 2 * t / Math.max(1, orphan.length);
    TX[orphan[t]] = Math.cos(a2) * 1080; TY[orphan[t]] = Math.sin(a2) * 1080;
  }
}
layoutHier(); layoutTree();

/* ── 지구본 모드: 대주제별로 구면 위 영역을 나눠 준다 */
function layoutSphere() {
  SPH.length = 0;
  const cnt = {}, seen = {};
  for (let i = 0; i < NT; i++) { const b = IT[i].big >= 0 ? IT[i].big : NB_BIG - 1; cnt[b] = (cnt[b] || 0) + 1; }
  // 대주제 중심 = 피보나치 구
  const gc = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let b = 0; b < NB_BIG; b++) {
    const z = 1 - 2 * (b + 0.5) / NB_BIG, rr = Math.sqrt(Math.max(0, 1 - z * z)), th = ga * b;
    gc.push([Math.cos(th) * rr, Math.sin(th) * rr, z]);
  }
  for (let i = 0; i < NT; i++) {
    const b = IT[i].big >= 0 ? IT[i].big : NB_BIG - 1;
    const k = (seen[b] = (seen[b] || 0) + 1) - 1, n = cnt[b];
    const c = gc[b];
    // 중심 주변 캡 안에 나선형으로 배치
    const cap = 0.62;
    const t = n <= 1 ? 0 : k / (n - 1);
    const rad = cap * Math.sqrt(t), phi = k * ga;
    // c 를 북극으로 하는 국소 좌표계
    let ux = -c[1], uy = c[0], uz = 0;
    const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const vx = c[1] * uz - c[2] * uy, vy = c[2] * ux - c[0] * uz, vz = c[0] * uy - c[1] * ux;
    const sr = Math.sin(rad), cr = Math.cos(rad);
    const px = c[0] * cr + (ux * Math.cos(phi) + vx * Math.sin(phi)) * sr;
    const py = c[1] * cr + (uy * Math.cos(phi) + vy * Math.sin(phi)) * sr;
    const pz = c[2] * cr + (uz * Math.cos(phi) + vz * Math.sin(phi)) * sr;
    const L = Math.hypot(px, py, pz) || 1;
    SPH.push([px / L, py / L, pz / L]);
  }
}
layoutSphere();

/* ══════════════════════════════════════════════════════════════════
   3. 가시성 계산
   ══════════════════════════════════════════════════════════════════ */
let visN = 0, visE = 0;
let coShown = [], hiShown = [], reShown = [];   // 층별로 '지금 실제로 그려지는' 간선
let coLost = 0;                                 // 공기 다리가 통째로 사라진 개념 수(조용한 삭제 감시)
function recomputeVis() {
  visN = 0;
  for (let i = 0; i < NT; i++) {
    const it = IT[i];
    let v;
    if (it.t === 'u') v = S.showU;
    else if (it.t === 'g') v = S.showMiss;
    else if (it.t === 'h') v = S.showHi && (it.lv === 0 || S.bigOn[it.big]);
    else v = true;
    if (v && it.t === 'c' && it.big >= 0 && !S.bigOn[it.big]) v = false;
    VIS[i] = v ? 1 : 0;
    if (v) visN++;
  }
  hiShown = [];
  if (S.showHi) for (const e of E_HI) { if (VIS[e.a] && VIS[e.b]) hiShown.push(e); }
  reShown = [];
  if (S.showRe) for (const e of E_RE) {
    if (!S.kindOn[e.grp]) continue;
    if (VIS[e.a] && VIS[e.b]) reShown.push(e);
  }
  /* ★백본 필터 (평의회 4차 O2·O11 실측으로 신설)
     전역 임계(모든 간선에 같은 하한)는 굵은 허브만 남기고 **가는 개념을 통째로 지운다**.
     실측: 전역 w>=219 는 간선 1,534개를 남기는데 **개념 142개(57%)의 공기 다리가 0개**가 됐고
           화면은 그 사실을 말하지 않았다(조용한 truncation).
           노드별 top-5 는 간선이 더 적은데도(1,186) **다리 0개가 되는 개념이 0개**다.
     → 기본을 노드별 top-k 로 바꾼다. 전역 임계는 남겨두되 선택지로 내린다(가역). */
  coShown = [];
  coLost = 0;
  if (S.showCo) {
    if (S.coMode === 'topk') {
      const byNode = new Map();
      for (const e of E_CO) {
        if (!VIS[e[0]] || !VIS[e[1]]) continue;
        for (let s = 0; s < 2; s++) {
          const n = e[s];
          let arr = byNode.get(n);
          if (!arr) { arr = []; byNode.set(n, arr); }
          arr.push(e);
        }
      }
      const keep = new Set();
      for (const arr of byNode.values()) {
        arr.sort(function (x, y) { return y[2] - x[2]; });
        const k = Math.min(S.topK, arr.length);
        for (let i = 0; i < k; i++) keep.add(arr[i]);
      }
      keep.forEach(function (e) { coShown.push(e); });
      /* 다리가 통째로 사라진 개념 수 — 안 세면 조용히 지워진다 */
      const alive = new Set();
      for (const e of coShown) { alive.add(e[0]); alive.add(e[1]); }
      byNode.forEach(function (_v, n) { if (!alive.has(n)) coLost++; });
    } else {
      const byNode = new Map();
      for (const e of E_CO) {
        if (!VIS[e[0]] || !VIS[e[1]]) continue;
        byNode.set(e[0], 1); byNode.set(e[1], 1);
        if (e[2] < S.minW) continue;
        coShown.push(e);
      }
      const alive = new Set();
      for (const e of coShown) { alive.add(e[0]); alive.add(e[1]); }
      byNode.forEach(function (_v, n) { if (!alive.has(n)) coLost++; });
    }
  }
  visE = coShown.length + hiShown.length + reShown.length
       + (S.showUX ? E_UX.filter(function (e) { return VIS[e.a] && VIS[e.b]; }).length : 0)
       + (S.showUH ? E_UH.filter(function (e) { return VIS[e.a] && VIS[e.b]; }).length : 0);
  DEG.fill(0);
  for (const e of coShown) { DEG[e[0]]++; DEG[e[1]]++; }
  for (const e of hiShown) { DEG[e.a]++; DEG[e.b]++; }
  for (const e of reShown) { DEG[e.a]++; DEG[e.b]++; }
  if (S.showUX) for (const e of E_UX) { if (VIS[e.a] && VIS[e.b]) { DEG[e.a]++; DEG[e.b]++; } }
  if (S.showUH) for (const e of E_UH) { if (VIS[e.a] && VIS[e.b]) { DEG[e.a]++; DEG[e.b]++; } }
  counts();
  hint();
}

/* ★조용한 truncation 금지 — "N개 중 M개만 표시 중"을 화면에 항상 적는다.
   화면에 안 그린 게 있으면 숫자로 말해야 한다(운영자 지시 260725). */
function counts() {
  function set(id, shown, total, extra) {
    const el = document.getElementById(id); if (!el) return;
    el.textContent = shown.toLocaleString() + ' / ' + total.toLocaleString() + (extra || '');
    el.style.color = (shown < total) ? '#c9a04d' : '#6f7787';
  }
  set('c_hi', hiShown.length, E_HI.length);
  set('c_re', reShown.length, E_RE.length);
  set('c_co', coShown.length, E_CO.length);
  const un = (S.showUX ? E_UX.filter(function (e) { return VIS[e.a] && VIS[e.b]; }).length : 0)
           + (S.showUH ? E_UH.filter(function (e) { return VIS[e.a] && VIS[e.b]; }).length : 0);
  set('c_un', un, E_UX.length + E_UH.length);
}

/* 화면 맞춤 — 바깥으로 튄 몇 개가 축척을 잡아먹지 않게 2~98 백분위로 자른다 */
function fitView(pad) {
  if (S.mode === 'globe' || S.mode === 'cyl') { S.cam = { x: 0, y: 0, k: 1 }; return; }
  pad = pad || 1.10;
  const xs = [], ys = [];
  for (let i = 0; i < NT; i++) if (VIS[i]) { xs.push(X[i]); ys.push(Y[i]); }
  if (xs.length < 3) return;
  xs.sort(function (a, b) { return a - b; }); ys.sort(function (a, b) { return a - b; });
  const lo = Math.floor(xs.length * 0.02), hi = Math.ceil(xs.length * 0.98) - 1;
  const x0 = xs[lo], x1 = xs[hi], y0 = ys[lo], y1 = ys[hi];
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  S.cam.k = Math.max(0.08, Math.min(4, Math.min(W / (w * pad), H / (h * pad))));
  S.cam.x = -((x0 + x1) / 2) * S.cam.k; S.cam.y = -((y0 + y1) / 2) * S.cam.k;
}
function matchQ(i) {
  const q = S.q.trim(); if (!q) return true;
  const it = IT[i];
  if (it.name.indexOf(q) >= 0) return true;
  if (it.full && it.full.indexOf(q) >= 0) return true;
  if (it.mid && it.mid.indexOf(q) >= 0) return true;
  if (it.t === 'u' && it.d.t.indexOf(q) >= 0) return true;
  if (it.big >= 0 && DB.bigs[it.big].n.indexOf(q) >= 0) return true;
  return false;
}

/* ══════════════════════════════════════════════════════════════════
   4. 물리 (Barnes-Hut 사분트리 + 스프링)
   ══════════════════════════════════════════════════════════════════ */
/* ⚠실측 튜닝값(260725). 손대기 전에 왜 이 값인지 읽을 것.
   처음엔 CHARGE=260·스프링 균일이었는데, 허브(다리 114개)가 스프링 114개에 끌려 들어가
   가운데가 흰 덩어리로 뭉쳤다. 고친 것 두 가지:
     ① 스프링 세기를 두 노드 중 작은 쪽 차수로 나눈다(허브가 안 짜부라진다)
     ② 반발(CHARGE)과 중심중력(CTR)의 비가 그래프 전체 크기를 정한다 — 반지름 ≈ ∛(CHARGE·총질량/CTR).
        지금 값은 전체 폭 ≈1,500 → 1400×900 화면에 자동 맞춤 시 배율 0.5~0.6, 노드 5~12px.
        CHARGE만 올리면 그래프가 통째로 커져서 자동맞춤이 축소해버려 노드가 오히려 작아진다. 둘을 같이 움직여라. */
const THETA2 = 0.81, CHARGE = 1600, CTR = 0.0110;
const K_SPRING = 0.22, REST_BASE = 170, REST_DROP = 100;
function QT(x0, y0, s) { return { x0: x0, y0: y0, s: s, m: 0, cx: 0, cy: 0, pt: -1, kids: null, ex: null }; }
function qtPut(n, i, d) {
  const h = n.s / 2, qx = X[i] >= n.x0 + h ? 1 : 0, qy = Y[i] >= n.y0 + h ? 1 : 0, k = qy * 2 + qx;
  if (!n.kids[k]) n.kids[k] = QT(n.x0 + qx * h, n.y0 + qy * h, h);
  qtIns(n.kids[k], i, d + 1);
}
function qtIns(n, i, d) {
  const tm = n.m + M[i];
  n.cx = (n.cx * n.m + X[i] * M[i]) / tm; n.cy = (n.cy * n.m + Y[i] * M[i]) / tm; n.m = tm;
  if (n.kids === null) {
    if (n.pt === -1) { n.pt = i; return; }
    if (d >= 22) { (n.ex = n.ex || []).push(i); return; }
    const p = n.pt; n.pt = -1; n.kids = [null, null, null, null];
    qtPut(n, p, d);
  }
  qtPut(n, i, d);
}
function qtForce(n, i) {
  if (n.m === 0) return;
  let dx = n.cx - X[i], dy = n.cy - Y[i], d2 = dx * dx + dy * dy;
  if (n.kids === null && n.pt === i && !n.ex) return;
  if (n.kids === null || n.s * n.s < THETA2 * d2) {
    if (d2 < 4) { d2 = 4; dx = (Math.random() - 0.5) * 2; dy = (Math.random() - 0.5) * 2; }
    const d = Math.sqrt(d2), f = -CHARGE * n.m / d2;
    FX[i] += f * dx / d; FY[i] += f * dy / d; return;
  }
  for (let k = 0; k < 4; k++) if (n.kids[k]) qtForce(n.kids[k], i);
}
const LOGMAX = Math.log(1 + DB.maxw);
function wnorm(w) { return Math.log(1 + w) / LOGMAX; }

function physics() {
  if (S.mode === 'globe') return;
  /* ★원기둥은 뉴런과 같은 자유 물리를 쓴다 — 세로(계층)는 project()가 고정하므로
     여기서는 가로 배치만 정하면 된다. 그래서 각 층이 옵시디언처럼 유기적으로 뭉친다. */
  if (S.mode === 'hier' || S.mode === 'tree') {   // 계층 배치 = 목표 좌표로 스르르
    for (let i = 0; i < NT; i++) {
      if (PIN[i]) continue;
      X[i] += (TX[i] - X[i]) * 0.10; Y[i] += (TY[i] - Y[i]) * 0.10;
    }
    return;
  }
  const A = S.alpha;
  FX.fill(0); FY.fill(0);
  // 사분트리
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < NT; i++) { if (!VIS[i]) continue; if (X[i] < x0) x0 = X[i]; if (Y[i] < y0) y0 = Y[i]; if (X[i] > x1) x1 = X[i]; if (Y[i] > y1) y1 = Y[i]; }
  if (x0 > x1) return;
  const s = Math.max(x1 - x0, y1 - y0) + 2;
  const root = QT(x0 - 1, y0 - 1, s);
  for (let i = 0; i < NT; i++) if (VIS[i]) qtIns(root, i, 0);
  for (let i = 0; i < NT; i++) if (VIS[i]) qtForce(root, i);
  /* ★공기 스프링 제거 (평의회 4차 O2 통제실험)
     동시출현 밀도가 70.8%라 공기 스프링을 켜면 **모든 노드가 모든 노드를 당긴다.**
     실측: 공기 스프링을 켜면 그림이 33% 압축되고 공간순도는 오히려 떨어졌다(이득 0).
           계층 간선만 켜고 공기를 끄면 순도 0.315 → 0.545.
     → 공기는 **그리기·탐색 채널로만** 남기고 배치에서는 뺀다(삭제 아님).
       배치는 계층이 정하고, 거리는 관계가 정한다.
     ⚠되돌리려면 S.coSpring 을 true 로. 기본은 false 다. */
  if (S.coSpring) {
    for (let t = 0; t < coShown.length; t++) {
      const e = coShown[t], i = e[0], j = e[1], nw = wnorm(e[2]);
      let dx = X[j] - X[i], dy = Y[j] - Y[i], d = Math.hypot(dx, dy) || 0.01;
      const L = REST_BASE - REST_DROP * nw;
      const k = K_SPRING * (0.25 + nw) / (1 + Math.min(DEG[i], DEG[j]));
      const f = k * (d - L);
      dx /= d; dy /= d;
      FX[i] += f * dx; FY[i] += f * dy; FX[j] -= f * dx; FY[j] -= f * dy;
    }
  }
  // 스프링 — 유닛 링크(강하게: 유닛은 자기 개념 옆에 붙어야 읽힌다)
  function pull(a, b, k, L) {
    if (!VIS[a] || !VIS[b]) return;
    let dx = X[b] - X[a], dy = Y[b] - Y[a], d = Math.hypot(dx, dy) || 0.01;
    const kk = k / (1 + Math.min(DEG[a], DEG[b]) * 0.25), f = kk * (d - L);
    dx /= d; dy /= d;
    FX[a] += f * dx; FY[a] += f * dy; FX[b] -= f * dx; FY[b] -= f * dy;
  }
  /* ★1층 계층 스프링 — 뉴런 모드에서도 트리가 '중력'으로 살아 있게 한다.
     허브가 자기 자식을 잡아당기므로 대주제 덩어리가 저절로 갈라진다.
     이게 있어야 뉴런 모드에서도 "계층화가 됐구나"가 눈에 보인다. */
  for (const e of hiShown) pull(e.a, e.b, e.lv === 0 ? 0.55 : (e.lv === 1 ? 0.50 : 0.42),
                                e.lv === 0 ? 300 : (e.lv === 1 ? 190 : 105));
  /* ★2층 관계 스프링 — 결정론으로 이어진 것끼리 가까이. 강도는 weight 에 비례.
     공기 스프링을 뺀 만큼 여기를 키운다(0.10+0.22wt → 0.18+0.34wt, O2 권고).
     이제 **거리를 정하는 것은 명리 관계뿐**이다 — "같이 나왔다"는 배치에 관여하지 않는다. */
  for (const e of reShown) pull(e.a, e.b, 0.18 + 0.34 * e.wt, 130);
  if (S.showUX) for (const e of E_UX) pull(e.a, e.b, 0.30, 150);
  if (S.showUH) for (const e of E_UH) pull(e.a, e.b, 0.45, 100);
  // 뭉침 + 중심
  for (let i = 0; i < NT; i++) {
    if (!VIS[i]) continue;
    const b = IT[i].big >= 0 ? IT[i].big : 0;
    FX[i] += (ANC[b][0] - X[i]) * 0.0064 * S.cluster;
    FY[i] += (ANC[b][1] - Y[i]) * 0.0064 * S.cluster;
    FX[i] += -X[i] * CTR; FY[i] += -Y[i] * CTR;
  }
  // 적분
  for (let i = 0; i < NT; i++) {
    if (!VIS[i] || PIN[i]) { VX[i] *= 0.5; VY[i] *= 0.5; continue; }
    VX[i] = (VX[i] + FX[i] * A) * 0.82; VY[i] = (VY[i] + FY[i] * A) * 0.82;
    const v = Math.hypot(VX[i], VY[i]);
    if (v > 28) { VX[i] *= 28 / v; VY[i] *= 28 / v; }
    X[i] += VX[i]; Y[i] += VY[i];
  }
  S.alpha += (0.055 - S.alpha) * 0.014;
}

/* ══════════════════════════════════════════════════════════════════
   5. 렌더링
   ══════════════════════════════════════════════════════════════════ */
const cv = document.getElementById('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = cv.clientWidth; H = cv.clientHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (S.autofit) fitView();
}
window.addEventListener('resize', resize);

const PJ = new Float64Array(NT * 3);   // 화면 좌표 x,y,depth(0~1)
function project() {
  /* ★원기둥 — 세로는 계층(고정), 가로는 힘기반(옵시디언). 돌리면 층이 겹쳐 보였다 갈라진다. */
  if (S.mode === 'cyl') {
    const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
    const tilt = Math.max(0.12, Math.sin(S.pitch));      // 원판이 타원으로 보이는 기울기
    const R = Math.min(W, H) * 0.46 * S.cam.k;           // 단면 반지름
    const HH = Math.min(W, H) * 0.40 * S.cam.k;          // 원기둥 높이(절반)
    const D = R * 3.6;
    // 층 안 좌표를 원판에 담기게 정규화 — 물리 좌표는 층마다 퍼진 범위가 다르다
    let mx = 1;
    for (let i = 0; i < NT; i++) { if (!VIS[i]) continue; const m = Math.hypot(X[i], Y[i]); if (m > mx) mx = m; }
    const sc = 1 / mx;
    for (let i = 0; i < NT; i++) {
      const px = X[i] * sc, py = Y[i] * sc;
      const x = px * cy + py * sy;
      const d = -px * sy + py * cy;                      // 깊이(−1 뒤 ~ +1 앞)
      const pr = D / (D - d * R * 0.55);
      PJ[i * 3] = W / 2 + S.cam.x + x * R * pr;
      PJ[i * 3 + 1] = H / 2 + S.cam.y + (-CZ[i] * HH + d * R * tilt * 0.30) * pr;
      PJ[i * 3 + 2] = (d + 1) / 2;                       // 0 뒤 ~ 1 앞 (깊이 페이드용)
    }
    return;
  }
  if (S.mode === 'globe') {
    const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw), cp = Math.cos(S.pitch), sp = Math.sin(S.pitch);
    const R = Math.min(W, H) * 0.40 * S.cam.k, D = R * 3.4;
    for (let i = 0; i < NT; i++) {
      const p = SPH[i];
      let x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy, y = p[1];
      const y2 = y * cp - z * sp, z2 = y * sp + z * cp;
      const pr = D / (D - z2 * R);
      PJ[i * 3] = W / 2 + S.cam.x + x * R * pr;
      PJ[i * 3 + 1] = H / 2 + S.cam.y + y2 * R * pr;
      PJ[i * 3 + 2] = (z2 + 1) / 2;
    }
  } else {
    for (let i = 0; i < NT; i++) {
      PJ[i * 3] = W / 2 + S.cam.x + X[i] * S.cam.k;
      PJ[i * 3 + 1] = H / 2 + S.cam.y + Y[i] * S.cam.k;
      PJ[i * 3 + 2] = 1;
    }
  }
}
function hexa(c, a) {
  const n = parseInt(c.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a.toFixed(3) + ')';
}
function focusSet() {
  const f = S.hover >= 0 ? S.hover : S.sel;
  if (f < 0) return null;
  const s = new Set(NB[f]); s.add(f); return s;
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  project();
  const foc = focusSet();
  const qOn = S.q.trim().length > 0;
  const glob = S.mode === 'globe';
  /* ★원기둥도 3D라 깊이 처리를 받는다. 단 구처럼 '모든 간선이 지름을 가로지르는' 상태는
     아니므로(층 안에서만 퍼진다) 감쇠를 약하게 준다. */
  const cyl = S.mode === 'cyl';
  const d3 = glob || cyl;
  /* ⚠계층·지구본 모드는 노드가 원/구 위에 고르게 놓여서 모든 간선이 '지름을 가로지르는 현'이 된다.
     뉴런 모드와 같은 진하기로 깔면 가운데가 뿌옇게 떠서 구조가 안 읽힌다.
     실측(중앙부 평균 밝기, 배경 합성 후 0~255): 뉴런 35.7 · 계층 55.8 · 지구본 82.8.
     → 계층 ×0.50, 지구본 ×0.28 을 곱해 셋의 시각적 무게를 뉴런 모드에 맞췄다.
     ※측정할 땐 반드시 배경(#0e1014)과 알파 합성해서 재라. 캔버스는 투명 위에 그려지므로
       getImageData 의 RGB 만 보면 흐린 선도 '밝다'고 나와서 진단이 통째로 틀린다(260725 실측). */
  const EA = glob ? 0.28 : (cyl ? 0.62 : (S.mode === 'hier' ? 0.50 : 1));
  const tree = S.mode === 'tree';
  function depthA(a, b) {    // 지구본·원기둥: 뒤쪽으로 넘어간 간선일수록 흐리게
    if (!d3) return 1;
    if (cyl) { const m = (PJ[a * 3 + 2] + PJ[b * 3 + 2]) / 2; return 0.42 + m * 0.72; }
    const m = (PJ[a * 3 + 2] + PJ[b * 3 + 2]) / 2;
    return 0.12 + m * m * 1.05;
  }

  // ── 동시출현 간선: (굵기 × 깊이) 버킷으로 묶어 한 번에 긋는다(성능).
  //    한 버킷 = beginPath/stroke 한 번 → 1,500개든 18,000개든 stroke 호출은 7~28번뿐.
  if (S.showCo) {
    /* ★가산합성 — 운영자가 레퍼런스로 보낸 신경망 그림의 그 '발광'.
       실측(평의회 4차 O11): 반투명(source-over)은 같은 알파에서 화면 밝기가 배경값 14 그대로라
       사실상 안 보인다. `lighter` 는 14 → 242. 그리고 겹칠수록 진짜로 밝아진다 —
       간선 절반일 때 순수신호 22.3, 전량일 때 44.9 (정확히 2배).
       = **밀도가 밝기로 번역된다.** 선을 세지 않고도 "여기가 빽빽하다"가 눈에 보인다.
       ⚠배칭해도 가산은 유지된다(1개씩/500개씩/한번에 stroke 밝기 동일 — 실측).
       ⚠번들링과 동시에 켜면 ×11 느려진다(308→3,447ms). 우린 번들링을 안 쓰므로 안전.
       ⚠반드시 복원할 것 — 안 되돌리면 노드·이름표까지 발광해서 화면이 하얗게 포화된다. */
    const glowOn = S.glow;
    if (glowOn) ctx.globalCompositeOperation = 'lighter';
    const BUCK = 7, DBK = glob ? 4 : 1, paths = [];
    for (let k = 0; k < BUCK * DBK; k++) paths.push([]);
    for (let t = 0; t < coShown.length; t++) {
      const e = coShown[t], nw = wnorm(e[2]);
      const wb = Math.min(BUCK - 1, Math.floor(nw * BUCK));
      let db = 0;
      if (glob) db = Math.min(DBK - 1, Math.floor((PJ[e[0] * 3 + 2] + PJ[e[1] * 3 + 2]) / 2 * DBK));
      paths[wb * DBK + db].push(e[0], e[1]);
    }
    for (let wb = 0; wb < BUCK; wb++) {
      const nw = (wb + 0.5) / BUCK;
      ctx.lineWidth = Math.max(0.4, (0.35 + nw * 3.2) * Math.min(1, S.cam.k * 1.2));
      for (let db = 0; db < DBK; db++) {
        const arr = paths[wb * DBK + db];
        if (!arr.length) continue;
        const dm = glob ? (0.15 + Math.pow((db + 0.5) / DBK, 2) * 1.20) : 1;
        const base = (0.055 + nw * 0.30) * EA * dm;
        ctx.strokeStyle = 'rgba(168,180,200,' + base.toFixed(3) + ')';
        ctx.beginPath();
        for (let t = 0; t < arr.length; t += 2) {
          const a = arr[t], b = arr[t + 1];
          if (foc && !(foc.has(a) && foc.has(b))) continue;
          ctx.moveTo(PJ[a * 3], PJ[a * 3 + 1]); ctx.lineTo(PJ[b * 3], PJ[b * 3 + 1]);
        }
        ctx.stroke();
        if (foc) {   // 초점 밖 간선은 아주 흐리게 남겨 맥락을 유지
          ctx.strokeStyle = 'rgba(168,180,200,' + (base * 0.16).toFixed(3) + ')';
          ctx.beginPath();
          for (let t = 0; t < arr.length; t += 2) {
            const a = arr[t], b = arr[t + 1];
            if (foc.has(a) && foc.has(b)) continue;
            ctx.moveTo(PJ[a * 3], PJ[a * 3 + 1]); ctx.lineTo(PJ[b * 3], PJ[b * 3 + 1]);
          }
          ctx.stroke();
        }
      }
    }
    if (glowOn) ctx.globalCompositeOperation = 'source-over';   // ★반드시 복원
  }

  // ══════════════════════════════════════════════════════════════
  //  ★1층 계층(뼈대) — 굵고 차분하게. 이 화면의 척추다.
  //    트리 모드에서는 직선 대신 ㄱ자(엘보)로 꺾어 그린다. 조직도처럼 보여야
  //    "위아래로 서 있다"가 눈에 박힌다(운영자 지시 260725).
  // ══════════════════════════════════════════════════════════════
  if (S.showHi) {
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    for (const e of hiShown) {
      if (foc && !(foc.has(e.a) && foc.has(e.b))) continue;
      const ax = PJ[e.a * 3], ay = PJ[e.a * 3 + 1], bx = PJ[e.b * 3], by = PJ[e.b * 3 + 1];
      const base = e.lv === 0 ? 3.4 : (e.lv === 1 ? 2.6 : 1.7);
      const al = (e.lv === 0 ? 0.72 : (e.lv === 1 ? 0.62 : 0.44)) * depthA(e.a, e.b) * (glob ? 0.6 : 1);
      // 색: 대주제 색을 옅게 섞어 어느 가지인지 알아보게. 뿌리 줄기는 중립색.
      const bcol = (IT[e.b].big >= 0 && DB.bigs[IT[e.b].big]) ? DB.bigs[IT[e.b].big].c : DB.hierc;
      ctx.strokeStyle = hexa(e.lv === 0 ? DB.hierc : bcol, al);
      ctx.lineWidth = Math.max(1.0, base * Math.min(1.5, Math.max(0.62, S.cam.k * 1.3)));
      ctx.beginPath();
      if (tree) {
        const my = (ay + by) / 2;
        ctx.moveTo(ax, ay); ctx.lineTo(ax, my); ctx.lineTo(bx, my); ctx.lineTo(bx, by);
      } else { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); }
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  // ══════════════════════════════════════════════════════════════
  //  ★2층 결정론 관계(뉴런) — kind 별 색 · polarity 로 +/− · dir 이면 화살표.
  //    굵기 = weight(결정론 1.0 … 판본 갈리는 귀문 0.5 … 지장간은 비율 그대로).
  // ══════════════════════════════════════════════════════════════
  if (S.showRe) {
    for (const e of reShown) {
      if (foc && !(foc.has(e.a) && foc.has(e.b))) continue;
      const ax = PJ[e.a * 3], ay = PJ[e.a * 3 + 1], bx = PJ[e.b * 3], by = PJ[e.b * 3 + 1];
      const col = relColor(e), da = depthA(e.a, e.b);
      ctx.strokeStyle = hexa(col, (0.42 + 0.46 * e.wt) * da * (tree ? 0.70 : 1));
      ctx.lineWidth = wtWidth(e.wt) * Math.min(1.25, Math.max(0.4, S.cam.k * 1.6));
      ctx.setLineDash(e.stance ? [6, 4] : []);      // stance = 판본이 갈리는 것 → 점선으로 티를 낸다
      ctx.beginPath();
      if (tree) {                                   // 트리에서는 살짝 휘어 뼈대와 안 겹치게
        const mx2 = (ax + bx) / 2 + (by - ay) * 0.12, my2 = (ay + by) / 2 - (bx - ax) * 0.12;
        ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx2, my2, bx, by);
      } else { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); }
      ctx.stroke();
      ctx.setLineDash([]);
      if (e.dir === 'a→b') {                        // 방향 = 화살촉 (무향이면 안 그린다)
        const d = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / d, uy = (by - ay) / d;
        const tr = IT[e.b].r * S.cam.k + 3;
        const hx = bx - ux * tr, hy = by - uy * tr, L = 7 + e.wt * 4;
        ctx.fillStyle = hexa(col, (0.55 + 0.4 * e.wt) * da);
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - ux * L - uy * L * 0.45, hy - uy * L + ux * L * 0.45);
        ctx.lineTo(hx - ux * L + uy * L * 0.45, hy - uy * L - ux * L * 0.45);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  // ── 유닛 계층 간선 (점선)
  if (S.showUH) {
    ctx.lineWidth = 1.3;
    for (const e of E_UH) {
      if (!VIS[e.a] || !VIS[e.b]) continue;
      if (foc && !(foc.has(e.a) && foc.has(e.b))) continue;
      ctx.setLineDash(e.al === 2 ? [2, 3] : (e.al === 1 ? [7, 3] : [3, 4]));
      ctx.strokeStyle = (e.al === 2 ? 'rgba(139,148,164,' : 'rgba(255,204,77,')
                        + (0.42 * depthA(e.a, e.b)).toFixed(3) + ')';
      ctx.beginPath();
      ctx.moveTo(PJ[e.a * 3], PJ[e.a * 3 + 1]); ctx.lineTo(PJ[e.b * 3], PJ[e.b * 3 + 1]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // ── 유닛 횡단 간선 (관계 색 + 확신도 진하기 + 화살표)
  if (S.showUX) {
    for (const e of E_UX) {
      if (!VIS[e.a] || !VIS[e.b]) continue;
      if (foc && !(foc.has(e.a) && foc.has(e.b))) continue;
      const u = DB.units[IT[e.a].i];
      const hv = u.h ? (parseInt(u.h.slice(1), 10) || 3) : 3;      // 헤지등급 L2~L7 = 확신도
      const conf = Math.max(0, Math.min(1, (hv - 1) / 6));
      const col = e.pol === '-' ? DB.negc : (DB.relc[e.grp] || '#8a94a6');
      const ax = PJ[e.a * 3], ay = PJ[e.a * 3 + 1], bx = PJ[e.b * 3], by = PJ[e.b * 3 + 1];
      const da = depthA(e.a, e.b);
      ctx.strokeStyle = hexa(col, (0.30 + conf * 0.62) * da);   // 색 진하기 = 확신도(헤지등급)
      ctx.lineWidth = wtWidth(e.wt) * Math.min(1, S.cam.k * 1.6); // 굵기 = 근거 강도(weight)
      // 별칭으로 겨우 붙인 링크·미등재 대상은 점선 — 화면에서도 보이게(콘솔만으론 다음 세션이 못 본다)
      if (e.al) ctx.setLineDash(e.al === 2 ? [2, 3] : [7, 3]); else ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.setLineDash([]);
      // 화살촉 (dir 이 → 면 b 쪽, ↔ 면 생략)
      if (e.dir !== '↔') {
        const [sx, sy, ex, ey] = e.dir === '←' ? [bx, by, ax, ay] : [ax, ay, bx, by];
        const d = Math.hypot(ex - sx, ey - sy) || 1, ux = (ex - sx) / d, uy = (ey - sy) / d;
        const tr = IT[e.dir === '←' ? e.a : e.b].r * S.cam.k + 3;
        const hx = ex - ux * tr, hy = ey - uy * tr, L = 7 + conf * 3;
        ctx.fillStyle = hexa(col, (0.35 + conf * 0.6) * da);
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx - ux * L - uy * L * 0.45, hy - uy * L + ux * L * 0.45);
        ctx.lineTo(hx - ux * L + uy * L * 0.45, hy - uy * L - ux * L * 0.45);
        ctx.closePath(); ctx.fill();
      }
    }
  }

  // ── 노드
  const order = [];
  for (let i = 0; i < NT; i++) if (VIS[i]) order.push(i);
  if (glob) order.sort(function (a, b) { return PJ[a * 3 + 2] - PJ[b * 3 + 2]; });
  for (const i of order) {
    const it = IT[i];
    const px = PJ[i * 3], py = PJ[i * 3 + 1], dep = PJ[i * 3 + 2];
    if (px < -80 || px > W + 80 || py < -80 || py > H + 80) continue;
    let a = 1;
    if (glob) a = 0.20 + dep * 0.80;
    if (foc && !foc.has(i)) a *= 0.16;
    if (qOn && !matchQ(i)) a *= 0.13;
    const r = Math.max(2, it.r * S.cam.k * (glob ? (0.55 + dep * 0.7) : 1));
    if (it.t === 'u') {                                  // 판단 유닛 = 마름모/육각형
      ctx.beginPath();
      if (it.d.k === 'U-JUDGE') {
        for (let k = 0; k < 6; k++) { const t = Math.PI / 6 + k * Math.PI / 3; const fx = px + Math.cos(t) * r * 1.35, fy = py + Math.sin(t) * r * 1.35; k ? ctx.lineTo(fx, fy) : ctx.moveTo(fx, fy); }
      } else {
        ctx.moveTo(px, py - r * 1.5); ctx.lineTo(px + r * 1.5, py); ctx.lineTo(px, py + r * 1.5); ctx.lineTo(px - r * 1.5, py);
      }
      ctx.closePath();
      ctx.fillStyle = hexa(it.col, a * 0.92); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(20,24,32,' + a.toFixed(2) + ')'; ctx.stroke();
    } else if (it.t === 'h') {
      // ★계층 허브 — 뿌리·대주제·중주제. 개념(동그라미)과 확실히 다른 모양이어야
      //   "이건 항목이 아니라 서랍이다"가 읽힌다 → 둥근 사각형.
      //   ⚠축소해도 서랍은 사라지면 안 된다 — 화면 좌표 기준 최소 크기를 준다.
      const rr = glob ? r : Math.max(r, it.lv === 0 ? 9 : (it.lv === 1 ? 7 : 4.5));
      const w2 = rr * (it.lv === 2 ? 1.5 : 1.7), h2 = rr * 1.05, rad = Math.min(w2, h2) * 0.45;
      ctx.beginPath();
      ctx.moveTo(px - w2 + rad, py - h2);
      ctx.arcTo(px + w2, py - h2, px + w2, py + h2, rad);
      ctx.arcTo(px + w2, py + h2, px - w2, py + h2, rad);
      ctx.arcTo(px - w2, py + h2, px - w2, py - h2, rad);
      ctx.arcTo(px - w2, py - h2, px + w2, py - h2, rad);
      ctx.closePath();
      ctx.fillStyle = hexa(it.col, a * (it.lv === 2 ? 0.55 : 0.9)); ctx.fill();
      ctx.lineWidth = it.lv === 0 ? 2.4 : 1.6;
      ctx.strokeStyle = 'rgba(14,16,20,' + (a * 0.9).toFixed(2) + ')'; ctx.stroke();
    } else if (it.t === 'g') {
      // ★미등재 개념 — 사전에 없는 이름. 회색 + 점선 테두리, 속은 거의 비운다.
      //   조용히 딴 노드에 붙이지 않고 '여기 구멍이 있다'를 그대로 보여주는 게 목적이다.
      ctx.beginPath(); ctx.arc(px, py, r, 0, 6.2832);
      ctx.fillStyle = hexa(it.col, a * 0.16); ctx.fill();
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1.8;
      ctx.strokeStyle = hexa(it.col, a * 0.95); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = 'bold ' + Math.max(8, r * 1.1) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = hexa(it.col, a); ctx.fillText('?', px, py + 0.5);
    } else {
      ctx.beginPath(); ctx.arc(px, py, r, 0, 6.2832);
      ctx.fillStyle = hexa(it.col, a * 0.88); ctx.fill();
      if (r > 4) { ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(14,16,20,' + (a * 0.85).toFixed(2) + ')'; ctx.stroke(); }
    }
    if (i === S.sel) { ctx.beginPath(); ctx.arc(px, py, r + 5, 0, 6.2832); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); }
  }

  // ── 이름표
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const thr = [1e9, 12, 7.5, 0][S.label];
  for (const i of order) {
    const it = IT[i];
    const px = PJ[i * 3], py = PJ[i * 3 + 1], dep = PJ[i * 3 + 2];
    if (px < 0 || px > W || py < 0 || py > H) continue;
    // 미등재 개념(t==='g')은 항상 이름을 띄운다 — 이게 보이라고 만든 노드다
    // ★계층 허브는 화면 고정 크기로 항상 띄운다. 트리를 축소해도 뼈대 이름은 읽혀야 하므로.
    const isHub = it.t === 'h';
    const force = (i === S.sel) || (i === S.hover) || (qOn && matchQ(i))
                  || it.t === 'g' || (isHub && it.lv < 2)
                  || (isHub && it.lv === 2 && S.cam.k >= 0.45)
                  || (foc && foc.has(i) && it.t === 'u');
    if (!force) {
      if (isHub) continue;                      // 중주제는 확대해야 뜬다(겹침 방지)
      if (S.label === 0) continue;
      // ★트리 모드: 세로 칸 간격이 화면에서 13px 미만이면 이름표를 아예 안 띄운다.
      //   안 그러면 축소했을 때 글자가 서로 겹쳐 검은 띠가 된다(=아무것도 못 읽는다).
      if (tree && TREE_ROW * S.cam.k < 13) continue;
      if (it.r < thr && it.t !== 'u') continue;
      if (glob && dep < 0.5) continue;
      if (foc && !foc.has(i)) continue;
    }
    let a = force ? 1 : (glob ? 0.25 + dep * 0.75 : 0.9);
    if (qOn && !matchQ(i)) a *= 0.15;
    if (isHub && glob) a *= 0.25 + dep * 0.75;
    const r = Math.max(2, it.r * S.cam.k * (glob ? (0.55 + dep * 0.7) : 1));
    const fs = isHub ? (it.lv === 0 ? 16 : it.lv === 1 ? 13 : 11)
                     : Math.max(10, Math.min(16, 9 + it.r * 0.42));
    ctx.font = ((force || isHub) ? '700 ' : '') + fs + 'px -apple-system,BlinkMacSystemFont,"Malgun Gothic",sans-serif';
    const label = it.name;
    // ★트리 모드에서 개념 이름표는 점 '오른쪽'에 붙인다.
    //   위아래로 쌓인 세로 칸이라 이름을 아래에 달면 바로 밑 개념과 겹쳐 아무것도 못 읽는다.
    let lx = px, ly;
    if (isHub) { ctx.textAlign = 'center'; ly = py - Math.max(r, 6) - fs * 0.55; }
    else if (tree) { ctx.textAlign = 'left'; lx = px + Math.max(r, 3) + 5; ly = py; }
    else { ctx.textAlign = 'center'; ly = py + r + fs * 0.72; }
    ctx.lineWidth = isHub ? 4.4 : 3.4; ctx.strokeStyle = 'rgba(10,12,16,' + (a * 0.95).toFixed(2) + ')';
    ctx.strokeText(label, lx, ly);
    ctx.fillStyle = isHub
      ? hexa(it.lv === 0 ? '#ffffff' : it.col, Math.min(1, a * 1.05))
      : 'rgba(232,236,244,' + a.toFixed(2) + ')';
    ctx.fillText(label, lx, ly);
  }
  ctx.textAlign = 'center';

}

/* ══════════════════════════════════════════════════════════════════
   6. 루프
   ══════════════════════════════════════════════════════════════════ */
let fps = 60, lastT = performance.now(), frames = 0, acc = 0;
function loop(t) {
  const dt = t - lastT; lastT = t; acc += dt; frames++;
  if (acc > 500) { fps = frames * 1000 / acc; frames = 0; acc = 0; hint(); }
  if ((S.mode === 'globe' || S.mode === 'cyl') && S.spin && S.drag < 0) S.yaw += 0.0022;
  physics();
  if (S.autofit && S.drag < 0) fitView();
  draw();
  requestAnimationFrame(loop);
}

/* ══════════════════════════════════════════════════════════════════
   7. 조작
   ══════════════════════════════════════════════════════════════════ */
function pick(mx, my) {
  let best = -1, bd = 1e9;
  for (let i = 0; i < NT; i++) {
    if (!VIS[i]) continue;
    const dx = PJ[i * 3] - mx, dy = PJ[i * 3 + 1] - my, d = dx * dx + dy * dy;
    const r = Math.max(6, IT[i].r * S.cam.k * (S.mode === 'globe' ? (0.55 + PJ[i * 3 + 2] * 0.7) : (S.mode === 'cyl' ? (0.72 + PJ[i * 3 + 2] * 0.5) : 1)) + 4);
    if (d < r * r && d < bd) { bd = d; best = i; }
  }
  return best;
}
let down = null;
cv.addEventListener('mousedown', function (e) {
  const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  const h = pick(mx, my);
  down = { mx: mx, my: my, cx: S.cam.x, cy: S.cam.y, yaw: S.yaw, pitch: S.pitch, moved: false, node: h };
  if (h >= 0 && S.mode === 'neuron') { S.drag = h; PIN[h] = 1; }
  cv.classList.add('grab');
});
window.addEventListener('mousemove', function (e) {
  const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  if (down) {
    const dx = mx - down.mx, dy = my - down.my;
    if (Math.abs(dx) + Math.abs(dy) > 3) down.moved = true;
    if (S.drag >= 0) {
      X[S.drag] = (mx - W / 2 - S.cam.x) / S.cam.k; Y[S.drag] = (my - H / 2 - S.cam.y) / S.cam.k;
      S.alpha = Math.max(S.alpha, 0.35);
    } else if ((S.mode === 'globe' || S.mode === 'cyl') && down.node < 0) {
      S.yaw = down.yaw + dx * 0.006; S.pitch = Math.max(-1.4, Math.min(1.4, down.pitch - dy * 0.006));
    } else { S.cam.x = down.cx + dx; S.cam.y = down.cy + dy; S.autofit = false; }
    return;
  }
  if (mx < 0 || my < 0 || mx > W || my > H) { S.hover = -1; tipHide(); return; }
  const h = pick(mx, my);
  if (h !== S.hover) { S.hover = h; h >= 0 ? tipShow(h, e.clientX, e.clientY) : tipHide(); }
  else if (h >= 0) tipMove(e.clientX, e.clientY);
});
window.addEventListener('mouseup', function () {
  if (down) {
    if (!down.moved && down.node >= 0) select(down.node);
    else if (!down.moved && down.node < 0) select(-1);
    if (S.drag >= 0) { PIN[S.drag] = 0; S.drag = -1; }
  }
  down = null; cv.classList.remove('grab');
});
cv.addEventListener('wheel', function (e) {
  e.preventDefault();
  S.autofit = false;
  const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  const k0 = S.cam.k, k = Math.max(0.12, Math.min(6, k0 * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  if (S.mode !== 'globe') {
    S.cam.x = mx - W / 2 - (mx - W / 2 - S.cam.x) * (k / k0);
    S.cam.y = my - H / 2 - (my - H / 2 - S.cam.y) * (k / k0);
  }
  S.cam.k = k;
}, { passive: false });
cv.addEventListener('dblclick', function () { S.autofit = true; fitView(); });

const tip = document.getElementById('tip');
function tipShow(i, cx, cy) {
  const it = IT[i];
  if (it.t === 'u') {
    tip.innerHTML = '<b>' + esc(it.name) + '</b> · ' + esc(it.d.k)
      + ' <span style="color:#8b94a4">확신 ' + esc(it.d.h || '?') + '</span>';
  } else if (it.t === 'h') {
    tip.innerHTML = '<b>' + esc(it.full) + '</b> <span style="color:#8b94a4">'
      + ['뿌리', '대주제', '중주제'][it.lv] + ' · 아래 ' + KIDS[i].length + '개</span>';
  } else {
    tip.innerHTML = '<b>' + esc(it.name) + '</b> <span style="color:#8b94a4">문단 '
      + it.d.p.toLocaleString() + ' · 다리 ' + it.d.g + '</span>';
  }
  tip.style.display = 'block'; tipMove(cx, cy);
}
function tipMove(cx, cy) { tip.style.left = (cx + 14) + 'px'; tip.style.top = (cy + 14) + 'px'; }
function tipHide() { tip.style.display = 'none'; }

/* ══════════════════════════════════════════════════════════════════
   8. 사이드 패널
   ══════════════════════════════════════════════════════════════════ */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
const infoEl = document.getElementById('info');
function select(i) {
  S.sel = i;
  if (i < 0) { infoEl.innerHTML = emptyInfo(); return; }
  const it = IT[i];
  infoEl.innerHTML = it.t === 'u' ? unitInfo(it) : (it.t === 'h' ? hubInfo(it, i) : conceptInfo(it, i));
  infoEl.querySelectorAll('[data-go]').forEach(function (el) {
    el.onclick = function () { const j = findByName(el.getAttribute('data-go')); if (j >= 0) { select(j); center(j); } };
  });
}
function findByName(nm) {
  for (let i = 0; i < NT; i++) if (IT[i].name === nm) return i;
  for (let i = 0; i < NT; i++) if (IT[i].full === nm) return i;
  return -1;
}
function center(i) {
  if (S.mode === 'globe') return;
  S.autofit = false;
  S.cam.x = -X[i] * S.cam.k; S.cam.y = -Y[i] * S.cam.k;
}
function emptyInfo() {
  return '<div class="mini" style="line-height:1.75">노드를 <b>클릭</b>하면 여기에 그 개념의 상세가 나온다.<br>'
    + '· 마우스를 올리면 <b>연결된 것만</b> 밝아진다<br>· 휠 = 확대/축소, 빈 곳 끌기 = 이동, 더블클릭 = 원위치<br>'
    + '· 뉴런 모드에서 노드를 끌면 잡아둘 수 있다<br>'
    + '· <b>네모</b>는 서랍(대주제·중주제), <b>동그라미</b>가 개념이다</div>';
}

/* ★계층 허브 정보판 — 이 서랍 밑에 무엇이 들었나 */
function hubInfo(it, idx) {
  const lvn = ['뿌리', '대주제', '중주제'][it.lv];
  let h = '<div class="ttl">' + esc(it.name) + '</div>'
    + '<div class="sub">' + (it.big >= 0 ? '<span style="color:' + it.col + '">■</span> ' : '')
    + esc(lvn) + (it.lv === 2 ? ' &nbsp;·&nbsp; ' + esc(it.full.split(' › ')[0]) : '') + '</div>';
  const kids = KIDS[idx];
  const par = PARENT[idx];
  if (par >= 0) h += '<div class="mini" style="margin-bottom:8px">위: <b data-go="' + esc(IT[par].full || IT[par].name)
    + '" style="cursor:pointer;color:' + IT[par].col + '">' + esc(IT[par].name) + '</b></div>';
  h += '<div class="kv"><div class="stat"><div class="k">바로 아래</div><div class="v">' + kids.length + '</div></div>';
  let leaf = 0; (function cnt(i) { if (!KIDS[i].length) { leaf++; return; } for (const c of KIDS[i]) cnt(c); })(idx);
  h += '<div class="stat"><div class="k">밑에 달린 개념</div><div class="v">' + leaf + '</div></div></div>';
  if (kids.length) {
    h += '<h3>' + (it.lv === 2 ? '이 중주제의 개념' : '아래 항목') + '</h3>';
    for (const c of kids) h += '<span class="chip" data-go="' + esc(IT[c].full || IT[c].name) + '">'
      + esc(IT[c].name) + '</span>';
  }
  h += '<div class="q" style="margin-top:12px;line-height:1.7">이 네모는 <b>개념이 아니라 서랍</b>이다. '
    + '대주제 ' + DB.bigs.length + ' → 중주제 ' + (NH - DB.bigs.length - 1) + ' → 개념 ' + DB.nconcept
    + ' 의 트리 뼈대이며, 여기서 뻗은 굵은 선이 <b>1층 계층</b>이다.</div>';
  return h;
}
function conceptInfo(it, idx) {
  const n = it.d;
  if (n.miss) {          // ★미등재 개념 — 사전 공백 자체를 설명한다
    let g = '<div class="ttl">' + esc(n.c) + ' <span style="font-size:11px;color:#8b94a4">?</span></div>'
      + '<div class="sub">사전 미등재 — 개념 노드 ' + DB.nconcept + '개 안에 없는 이름</div>'
      + '<div class="q" style="border-color:#3a3020;background:#221d10;line-height:1.75">'
      + '<b style="color:#ffcc4d">이건 오류가 아니라 발견이다.</b><br>'
      + '판단 유닛이 이 개념을 가리켰는데 개념 사전에 항목이 없다. '
      + '비슷한 이름에 억지로 붙이면 조용히 틀린 연결이 되므로, 붙이지 않고 그대로 띄웠다.<br>'
      + '<b>→ 개념 사전 신설 후보.</b></div>';
    const from = [];
    for (const e of E_UX) if (e.b === idx) from.push([DB.units[IT[e.a].i], e]);
    for (const e of E_UH) if (e.b === idx) from.push([DB.units[IT[e.a].i], null]);
    if (from.length) {
      g += '<h3>이 이름을 가리킨 유닛</h3>';
      for (const [u, e] of from) {
        g += '<div class="q"><b data-go="' + esc(u.id) + '" style="color:#ffcc4d;cursor:pointer">' + esc(u.id) + '</b> '
          + (e ? '<span class="mini">' + esc(e.rel) + ' · 강도 ' + e.wt.toFixed(1) + '</span>' : '<span class="mini">계층</span>')
          + '<br>' + esc(u.t) + '</div>';
      }
    }
    return g;
  }
  const big = DB.bigs[n.b];
  const par = PARENT[idx];
  let h = '<div class="ttl">' + esc(n.c) + (n.hj ? ' <span style="font-size:13px;color:#8b94a4">' + esc(n.hj) + '</span>' : '') + '</div>'
    + '<div class="sub"><span style="color:' + big.c + '">■</span> '
    + '<b data-go="' + esc(big.n) + '" style="cursor:pointer">' + esc(big.n) + '</b> &nbsp;›&nbsp; '
    + (par >= 0 ? '<b data-go="' + esc(IT[par].full || IT[par].name) + '" style="cursor:pointer">' + esc(n.m) + '</b>'
                : esc(n.m)) + '</div>';
  // 결정론 속성(천간·지지) — 있으면 보여준다
  const at = [];
  if (n.oh) at.push('오행 ' + n.oh);
  if (n.ym) at.push('음양 ' + n.ym);
  if (n.ymc) at.push('음양 體 ' + n.ymc + ' / 用 ' + n.ymy);
  if (n.cls) at.push(n.cls);
  if (at.length) h += '<div class="mini" style="margin:-4px 0 8px;color:#9aa3b2">' + esc(at.join(' · ')) + '</div>';
  h += '<div class="kv"><div class="stat"><div class="k">문단 수</div><div class="v">' + n.p.toLocaleString() + '</div></div>'
    + '<div class="stat"><div class="k">다리 수</div><div class="v">' + n.g + '</div></div></div>';

  /* ★2층 — 이 개념에 붙은 결정론 관계. 보드 1-19④ "관계된 것과 일치해서 옆으로 새어 나감"의 창구다. */
  const rl = [];
  for (const e of E_RE) { if (e.a === idx) rl.push([e, e.b, '→']); else if (e.b === idx) rl.push([e, e.a, e.dir === 'a→b' ? '←' : '↔']); }
  if (rl.length) {
    h += '<h3>결정론 관계 <span class="mini">(2층 · ' + rl.length + '개)</span></h3>';
    rl.sort(function (x, y) { return (y[0].wt - x[0].wt) || x[0].kind.localeCompare(y[0].kind); });
    for (const [e, other, ar] of rl) {
      const col = relColor(e), px = wtWidth(e.wt);
      h += '<div style="margin:5px 0;font-size:12px;line-height:1.5">'
        + '<span style="display:inline-block;width:24px;border-top:' + px.toFixed(1) + 'px '
        + (e.stance ? 'dashed ' : 'solid ') + col + ';vertical-align:middle;margin-right:6px"></span>'
        + '<b style="color:' + col + '">' + esc(e.kind) + '</b> ' + ar + ' '
        + '<b data-go="' + esc(IT[other].full || IT[other].name) + '" style="cursor:pointer">' + esc(IT[other].name) + '</b>'
        + ' <span class="mini mono">' + e.wt.toFixed(2) + '</span>'
        + (e.note ? '<div class="mini" style="margin-left:30px;color:#9aa3b2">' + esc(e.note) + '</div>' : '')
        + (e.stance ? '<div class="mini" style="margin-left:30px;color:#c9a04d">판본차: ' + esc(e.stance) + '</div>' : '')
        + '</div>';
    }
  }
  const au = Object.entries(n.au);
  if (au.length) {
    const tot = au.reduce(function (s, x) { return s + x[1]; }, 0);
    h += '<h3>저자 분포</h3>';
    for (const [k, v] of au) h += '<div class="brow">' + esc(k) + '<b>' + v.toLocaleString() + '</b>'
      + '<div class="bar"><i style="width:' + (v / tot * 100).toFixed(1) + '%;background:' + big.c + '"></i></div></div>';
  }
  const fl = Object.entries(n.fl);
  if (fl.length) { h += '<h3>깃발</h3>'; for (const [k, v] of fl) h += '<span class="chip">' + esc(k) + '<b>' + v.toLocaleString() + '</b></span>'; }
  if (n.tl && n.tl.length) {
    h += '<h3>가장 자주 같이 나오는 개념</h3>';
    for (const [t, w] of n.tl) h += '<span class="chip" data-go="' + esc(t) + '">' + esc(t) + '<b>' + w.toLocaleString() + '</b></span>';
  }
  const rel = [];
  for (const e of E_UX) { if (e.b === idx) rel.push([DB.units[IT[e.a].i], e]); }
  for (const e of E_UH) { if (e.b === idx) rel.push([DB.units[IT[e.a].i], null]); }
  if (rel.length) {
    h += '<h3>이 개념에 매달린 판단 유닛</h3>';
    const seen = {};
    for (const [u, e] of rel) {
      const key = u.id + (e ? e.rel + e.pol : 'H');
      if (seen[key]) continue; seen[key] = 1;
      const col = e ? (e.pol === '-' ? DB.negc : (DB.relc[e.grp] || '#8a94a6')) : '#ffcc4d';
      h += '<div class="q"><b data-go="' + esc(u.id) + '" style="color:' + col + ';cursor:pointer">' + esc(u.id) + '</b> '
        + (e ? '<span class="mini">' + esc(e.rel) + ' ' + esc(e.pol) + ' · 강도 <b class="mono">' + e.wt.toFixed(1)
               + '</b>' + (e.ev ? ' (' + esc(e.ev) + ')' : '') + '</span>'
             : '<span class="mini">계층</span>')
        + (e && e.al === 1 ? ' <span class="mini" style="color:#9fb4d8">※별칭 추정</span>' : '')
        + '<br>' + esc(u.t) + '</div>';
    }
  }
  return h;
}
function unitInfo(it) {
  const u = it.d;
  let h = '<div class="ttl">' + esc(u.id) + ' <span style="font-size:11px;color:#8b94a4">' + esc(u.k) + '</span></div>'
    + '<div class="sub">' + esc(u.bl || '') + (u.m ? ' &nbsp;›&nbsp; ' + esc(u.m) : '') + ' · ' + esc(u.au) + '</div>'
    + '<div class="q" style="color:#e6e8ec;font-weight:600">' + esc(u.t) + '</div>'
    + '<div class="kv"><div class="stat"><div class="k">확신도(헤지)</div><div class="v">' + esc(u.h || '-') + '</div></div>'
    + '<div class="stat"><div class="k">단계</div><div class="v">' + u.nc + '</div></div>'
    + '<div class="stat"><div class="k">근거</div><div class="v">' + u.ne + '</div></div></div>';
  if (u.mt && u.mt.length) { h += '<h3>방법론</h3>'; for (const m of u.mt) h += '<span class="chip">' + esc(m) + '</span>'; }
  if (u.cc) h += '<h3>결론</h3><div class="q">' + esc(u.cc) + '</div>';
  const outs = E_UX.filter(function (e) { return IT[e.a].t === 'u' && DB.units[IT[e.a].i].id === u.id; });
  if (outs.length) {
    h += '<h3>이 유닛이 뻗은 링크 <span class="mini">(굵기 = 근거 강도)</span></h3>';
    const srt = outs.slice().sort(function (x, y) { return y.wt - x.wt; });
    for (const e of srt) {
      const col = e.pol === '-' ? DB.negc : (DB.relc[e.grp] || '#8a94a6');
      const px = 0.6 + Math.pow(e.wt, 1.35) * 5.4;
      h += '<div style="margin:5px 0;font-size:12px;line-height:1.5">'
        + '<span style="display:inline-block;width:26px;border-top:' + px.toFixed(1) + 'px '
        + (e.al ? 'dashed ' : 'solid ') + col + ';vertical-align:middle;margin-right:6px"></span>'
        + '<b data-go="' + esc(IT[e.b].name) + '" style="cursor:pointer">' + esc(IT[e.b].name) + '</b>'
        + (IT[e.b].t === 'g' ? ' <span class="mini" style="color:#8b94a4">?미등재</span>' : '')
        + '<br><span class="mini" style="margin-left:32px">' + esc(e.rel) + ' ' + esc(e.dir) + ' ' + esc(e.pol)
        + ' · 강도 <b class="mono">' + e.wt.toFixed(1) + '</b>' + (e.ev ? ' · ' + esc(e.ev) : '') + '</span>'
        + (e.note ? '<div class="mini" style="margin-left:32px;color:#c9a04d;line-height:1.5">' + esc(e.note) + '</div>' : '')
        + '</div>';
    }
  }
  const hs = E_UH.filter(function (e) { return IT[e.a].t === 'u' && DB.units[IT[e.a].i].id === u.id; });
  if (hs.length) {
    h += '<h3>매달린 개념(계층)</h3>';
    for (const e of hs) h += '<span class="chip" data-go="' + esc(IT[e.b].name) + '">' + esc(IT[e.b].name) + '</span>';
  }
  return h;
}

/* ══════════════════════════════════════════════════════════════════
   9. 범례 · 컨트롤
   ══════════════════════════════════════════════════════════════════ */
function buildLegend() {
  /* ★범례는 운영자(비전문가)가 화면 안에서 읽는 설명서다.
     색·굵기의 뜻이 여기 없으면 이 화면은 예쁜 털뭉치일 뿐이다. */
  let h = '<h3>이 화면은 3층이다</h3>';
  h += '<div class="mini" style="line-height:1.75;margin-bottom:10px">'
     + '같은 그림 위에 성격이 다른 연결 <b>세 종류</b>를 겹쳐 그렸다. 왼쪽에서 층별로 켜고 끌 수 있다.</div>';
  h += '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px">'
     + '<tr><td style="padding:4px 0;width:44px"><span style="display:inline-block;width:36px;border-top:3px solid '
     + DB.hierc + ';vertical-align:middle"></span></td>'
     + '<td style="padding:4px 2px;line-height:1.5"><b>1층 계층 — 뼈대</b><br>'
     + '<span style="color:#7c8494">대주제 → 중주제 → 개념. 이 개념이 <b>어느 서랍에 들었나</b>. '
     + '굵고 차분한 색, 아래로 내려간다.</span></td></tr>'
     + '<tr><td style="padding:4px 0"><span style="display:inline-block;width:36px;border-top:3px solid #ffb02e;vertical-align:middle"></span></td>'
     + '<td style="padding:4px 2px;line-height:1.5"><b>2층 관계 — 뉴런</b><br>'
     + '<span style="color:#7c8494">생·극·합·충 같은 <b>명리학 규칙</b>. 계산으로 정해지는 것이라 흔들리지 않는다. '
     + '색 = 관계 종류, 화살표 = 방향.</span></td></tr>'
     + '<tr><td style="padding:4px 0"><span style="display:inline-block;width:36px;border-top:1px solid ' + DB.coc + ';vertical-align:middle"></span></td>'
     + '<td style="padding:4px 2px;line-height:1.5"><b>3층 동시출현 — 공기</b><br>'
     + '<span style="color:#7c8494">그냥 <b>같은 문단에 같이 나왔다</b>는 뜻. ' + E_CO.length.toLocaleString() + '개. '
     + '<b style="color:#c9a04d">판단 경로가 아니다.</b> 기본은 꺼져 있다.</span></td></tr>'
     + '</table>';

  h += '<h3>점의 모양</h3>';
  h += '<div class="mini" style="line-height:1.75;margin-bottom:8px">'
     + '<b>■ 네모</b> = 서랍(대주제·중주제) — 개념이 아니다.<br>'
     + '<b>● 동그라미</b> = 개념. <b>크기</b> = 그 개념이 나온 문단 수(로그), <b>색</b> = 대주제.<br>'
     + '<b>◆ 마름모·⬢ 육각형</b> = 판단 유닛(개념이 아니라 판단 절차).</div>';

  /* ── 2층 색표 */
  h += '<h3>2층 색 — 무슨 관계인가</h3>';
  h += '<div class="mini" style="line-height:1.6;margin-bottom:6px">'
     + '<b style="color:' + DB.negc + '">붉은 계열 = 부호가 −</b>인 것(극·충·형·파·해·원진·귀문). 한눈에 갈리게 했다.</div>';
  for (const g of DB.kgroups) {
    h += '<div class="mini" style="font-weight:700;color:#9aa3b2;margin:8px 0 3px">' + esc(g.d) + '</div>';
    for (const k in DB.kindg) {
      if (DB.kindg[k] !== g.g) continue;
      const n = DB.kindn[k] || 0;
      h += '<div class="lg"><span class="lgline" style="border-top-width:3px;border-color:' + DB.kindc[k] + '"></span>'
         + '<span class="mini" style="flex:1">' + esc(DB.kindd[k]) + '</span>'
         + '<span class="mini mono" style="color:#6f7787">' + n + '</span></div>';
    }
  }
  h += '<div class="mini" style="margin:8px 0 2px;line-height:1.6">'
     + '<b>화살표</b> = 방향이 있는 관계(갑목→목: 갑목이 목에 속한다). 화살표가 없으면 서로 대등한 관계.<br>'
     + '<b>점선</b> = <b style="color:#c9a04d">판본이 갈리는 것</b>(귀문관살 등). 지우지 않고 가늘게 그린다.</div>';

  h += '<h3 style="margin-top:14px">3층(공기)의 굵기</h3>';
  h += '<div class="lg"><span class="lgline" style="border-top-width:1px;border-color:#8b94a4"></span><span class="mini">가늘다 = 가끔 같이 나옴</span></div>';
  h += '<div class="lg"><span class="lgline" style="border-top-width:4px;border-color:#c3cbd8"></span><span class="mini">굵다 = 아주 자주 같이 나옴</span></div>';
  h += '<div class="mini" style="margin:4px 0 10px">↑ 회색 선의 <b>굵기 = 같은 문단에 몇 번 같이 나왔나</b>(로그). 뜻이 아니라 <b>빈도</b>다. '
     + '2층 색선의 굵기와는 <b>다른 자</b>로 잰 것이니 서로 비교하지 마라.</div>';

  h += '<h3 style="margin-top:14px">판단 유닛이 건 관계</h3>';
  for (const g in DB.relc) h += '<div class="lg"><span class="lgline" style="border-top-width:3px;border-color:' + DB.relc[g] + '"></span><span class="mini">' + esc(DB.reld[g]) + '</span></div>';
  h += '<div class="lg"><span class="lgline" style="border-top-width:3px;border-color:' + DB.negc + '"></span><span class="mini"><b>부정(−)</b> — 관계가 무엇이든 <b>뒤집는 것</b>은 붉은색</span></div>';
  h += '<div class="lg"><span class="lgline" style="border-top:2px dashed #ffcc4d"></span><span class="mini">유닛이 어느 개념에 매달렸나(계층)</span></div>';

  /* ★굵기 = 근거의 강도(weight). 운영자 지시의 핵심이라 범례에서 제일 크게 다룬다. */
  h += '<h3 style="margin-top:14px">색선의 굵기 = 근거의 강도</h3>';
  h += '<div class="mini" style="line-height:1.7;margin-bottom:7px">얼마나 <b>강하게 붙어 있는</b> 연결인가. '
     + '굵을수록 근거가 단단하다. 아래가 그 사다리다 — <b>가는 선은 "이런 의견도 있었다" 수준</b>이라는 뜻이다.<br>'
     + '2층 결정론 관계는 대부분 맨 위 칸(1.0)이다 — <b>계산으로 정해지는 것</b>이라서. '
     + '지장간만 <b>굵기가 곧 비율</b>(정기 굵고 여기 가늘다)이고, 판본이 갈리는 귀문은 0.5로 낮췄다.</div>';
  h += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
  for (const L of DB.ladder) {
    const px = (0.6 + Math.pow(L.w, 1.35) * 5.4);
    h += '<tr>'
       + '<td style="padding:3px 0;width:46px"><span style="display:inline-block;width:40px;border-top:'
       + px.toFixed(1) + 'px solid #9fb4d8;vertical-align:middle"></span></td>'
       + '<td style="padding:3px 4px;white-space:nowrap"><b>' + esc(L.k) + '</b></td>'
       + '<td style="padding:3px 0;text-align:right;color:#7c8494" class="mono">' + L.w.toFixed(1) + '</td>'
       + '</tr><tr><td></td><td colspan="2" style="padding:0 4px 5px;color:#7c8494;line-height:1.4">' + esc(L.d) + '</td></tr>';
  }
  h += '</table>';
  h += '<div class="mini" style="margin-top:8px;line-height:1.7"><b>색의 진하기 = 확신도</b>(헤지등급 L2~L7) — '
     + '저자가 얼마나 세게 말했나. <b>적중률이 아니라 저자 확신도</b>다.<br>'
     + '즉 <b>굵기와 진하기는 다른 것을 잰다</b>: 굵기는 근거가 단단한 정도, 진하기는 저자의 말투 세기.<br>'
     + '화살촉은 관계의 방향.</div>';

  h += '<h3 style="margin-top:14px">주의 표시</h3>';
  h += '<div class="lg"><span class="sw" style="border:2px dashed #8b94a4;background:transparent;border-radius:50%;width:14px;height:14px"></span>'
     + '<span class="mini"><b>미등재 개념</b> — 유닛이 가리켰는데 <b>개념 사전에 없는</b> 이름. '
     + '억지로 비슷한 개념에 붙이지 않고 그대로 띄웠다. <b>신설 후보</b>다.</span></div>';
  h += '<div class="lg"><span class="lgline" style="border-top:2px dashed #9fb4d8"></span>'
     + '<span class="mini"><b>긴 점선</b> = 이름이 정확히 안 맞아 <b>별칭으로 추정해 붙인</b> 링크. 사람이 확인해야 한다.</span></div>';
  h += '<div class="lg"><span class="lgline" style="border-top:2px dotted #8b94a4"></span>'
     + '<span class="mini"><b>촘촘한 점선</b> = 미등재 개념으로 이어진 링크.</span></div>';
  document.getElementById('legend').innerHTML = h;
}
function buildBigBox() {
  let h = '';
  for (let b = 0; b < DB.bigs.length; b++) {
    const cnt = DB.nodes.filter(function (n) { return n.b === b; }).length;
    h += '<label class="ck"><input type="checkbox" data-b="' + b + '" checked>'
       + '<span class="sw" style="background:' + DB.bigs[b].c + '"></span>'
       + '<span style="flex:1">' + esc(DB.bigs[b].n) + '</span><span class="mini mono">' + cnt + '</span></label>';
  }
  document.getElementById('bigbox').innerHTML = h;
  document.querySelectorAll('#bigbox input').forEach(function (el) {
    el.onchange = function () { S.bigOn[+el.dataset.b] = el.checked; relayout(); recomputeVis(); S.alpha = 0.6; };
  });
}
/* 2층 관계 종류(그룹) 켜고 끄기 — 21종을 다 늘어놓으면 아무도 못 읽으므로 6그룹으로 접는다 */
function buildKindBox() {
  let h = '';
  for (const g of DB.kgroups) {
    let n = 0, cols = [];
    for (const k in DB.kindg) if (DB.kindg[k] === g.g) { n += (DB.kindn[k] || 0); cols.push(DB.kindc[k]); }
    const grad = cols.length > 1 ? 'linear-gradient(90deg,' + cols.join(',') + ')' : cols[0];
    h += '<label class="ck"><input type="checkbox" data-g="' + esc(g.g) + '" checked>'
       + '<span class="sw" style="background:' + grad + '"></span>'
       + '<span style="flex:1">' + esc(g.d) + '</span><span class="mini mono">' + n + '</span></label>';
  }
  document.getElementById('kindbox').innerHTML = h;
  document.querySelectorAll('#kindbox input').forEach(function (el) {
    el.onchange = function () { S.kindOn[el.dataset.g] = el.checked; recomputeVis(); S.alpha = 0.5; };
  });
}
function relayout() { if (S.mode === 'tree') layoutTree(); else if (S.mode === 'hier') layoutHier(); }
buildLegend(); buildBigBox(); buildKindBox(); select(-1);

/* 최소 강도 슬라이더: w 를 로그 눈금으로 */
const wEl = document.getElementById('w');
function sliderToW(v) { return Math.round(Math.exp(Math.log(DB.maxw) * v / 100)) || 1; }
function wToSlider(w) { return Math.round(100 * Math.log(Math.max(1, w)) / Math.log(DB.maxw)); }
wEl.value = wToSlider(DB.defw);
function syncW() {
  S.minW = sliderToW(+wEl.value);
  /* ★슬라이더를 움직이면 자동으로 '전역 임계' 모드로 넘어간다.
     기본은 백본(노드별 top-k)이고, 슬라이더는 옛 방식을 일부러 보고 싶을 때만 쓴다. */
  S.coMode = 'globalw';
  document.getElementById('wlab').textContent =
    '전역 임계 — ' + S.minW.toLocaleString() + '회 이상만 (백본 모드 해제됨)';
  recomputeVis();
  document.getElementById('wcnt').innerHTML = coStatus();
}
/* ★공기층 표시 현황 — 조용한 truncation 금지.
   "몇 개 그렸나"만 적으면 부족하다. **다리가 통째로 사라진 개념이 몇 개인지**를 같이 적어야
   "굵은 것만 남기고 가는 개념을 지운" 상태가 눈에 보인다(평의회 4차 O2 실측:
   전역 임계 w>=219 는 개념 142개(57%)의 다리를 0개로 만들면서 아무 말도 안 했다). */
function coStatus() {
  const mode = (S.coMode === 'topk')
    ? '<b>백본</b>(개념마다 상위 ' + S.topK + '개)'
    : '<b>전역 임계</b>(' + S.minW.toLocaleString() + '회 이상)';
  let s = mode + ' &nbsp;·&nbsp; 표시 <b>' + coShown.length.toLocaleString()
        + '</b> / 전체 ' + E_CO.length.toLocaleString() + '개';
  if (!S.showCo) return s + ' <span style="color:#c9a04d">(층이 꺼져 있어 0개 표시 중)</span>';
  s += '<br>' + (coLost > 0
    ? '<span style="color:#e08a3c">⚠공기 다리가 <b>통째로 사라진 개념 ' + coLost + '개</b> — '
      + '이만큼은 화면에서 이어진 데가 하나도 없다.</span>'
    : '<span style="color:#5ea86f">✅다리가 0개가 된 개념 없음 — 아무도 화면에서 지워지지 않았다.</span>');
  return s;
}
wEl.oninput = function () { syncW(); S.alpha = 0.5; };

/* ★백본 슬라이더 + 빛 번짐 토글 */
const tkEl = document.getElementById('tk');
function syncTK() {
  S.topK = +tkEl.value;
  S.coMode = 'topk';
  document.getElementById('tklab').textContent = S.topK;
  recomputeVis();
  document.getElementById('wcnt').innerHTML = coStatus();
}
tkEl.oninput = function () { syncTK(); S.alpha = 0.5; };
document.getElementById('glow').onchange = function () { S.glow = this.checked; };

/* ★현재 모드를 **유지한 채** 공기층만 다시 계산한다.
   ⚠초기화와 층 토글에서 syncW() 를 부르면 그때마다 백본 모드가 전역 임계로 뒤집힌다
     (실측 사고: 첫 화면이 coMode='globalw' 로 떠 있었다).
     모드를 바꾸는 것은 **사용자가 슬라이더를 만졌을 때뿐**이어야 한다. */
function syncCo() {
  if (S.coMode === 'topk') {
    document.getElementById('tklab').textContent = S.topK;
  } else {
    document.getElementById('wlab').textContent =
      '전역 임계 — ' + S.minW.toLocaleString() + '회 이상만 (백본 모드 해제됨)';
  }
  recomputeVis();
  document.getElementById('wcnt').innerHTML = coStatus();
}
syncTK();
function syncCoBox() { document.getElementById('cobox').style.display = S.showCo ? '' : 'none'; }

document.getElementById('q').oninput = function (e) { S.q = e.target.value; };
document.getElementById('cl').oninput = function (e) { S.cluster = +e.target.value / 100; S.alpha = Math.max(S.alpha, 0.4); };
const lbEl = document.getElementById('lb');
lbEl.oninput = function () { S.label = +lbEl.value; document.getElementById('lblab').textContent = ['없음', '허브만', '많이', '전부'][S.label]; };
document.getElementById('e_hi').onchange = function (e) { S.showHi = e.target.checked; recomputeVis(); S.alpha = 0.6; };
document.getElementById('e_re').onchange = function (e) { S.showRe = e.target.checked; recomputeVis(); S.alpha = 0.6; };
document.getElementById('e_co').onchange = function (e) { S.showCo = e.target.checked; syncCoBox(); syncCo(); S.alpha = 0.5; };
document.getElementById('e_ux').onchange = function (e) { S.showUX = e.target.checked; recomputeVis(); };
document.getElementById('e_uh').onchange = function (e) { S.showUH = e.target.checked; recomputeVis(); };
document.getElementById('showu').onchange = function (e) { S.showU = e.target.checked; recomputeVis(); };
document.getElementById('showmiss').onchange = function (e) { S.showMiss = e.target.checked; recomputeVis(); };
document.getElementById('spin').onchange = function (e) { S.spin = e.target.checked; };
document.getElementById('allon').onclick = function () { document.querySelectorAll('#bigbox input').forEach(function (el) { el.checked = true; S.bigOn[+el.dataset.b] = true; }); relayout(); recomputeVis(); };
document.getElementById('alloff').onclick = function () { document.querySelectorAll('#bigbox input').forEach(function (el) { el.checked = false; S.bigOn[+el.dataset.b] = false; }); relayout(); recomputeVis(); };
document.getElementById('fit').onclick = function () { S.autofit = true; fitView(); };
document.getElementById('reheat').onclick = function () { seedPositions(); S.alpha = 1; S.autofit = true; };

const MDESC = {
  tree: '★대주제 → 중주제 → 개념을 위에서 아래로 세운 트리. 대주제를 하나만 켜면 그 가지가 크게 펴진다.',
  neuron: '자유 배치. 계층 스프링이 붙어 있어 대주제 덩어리가 저절로 갈라진다.',
  hier: '같은 계층을 원형으로 편 것. 전체 구도를 한눈에 볼 때.',
  globe: '구면 배치. 끌면 돌아간다. 대주제별로 지구 한 구역씩 차지한다.'
};
document.querySelectorAll('#modes button').forEach(function (b) {
  b.onclick = function () {
    document.querySelectorAll('#modes button').forEach(function (z) { z.classList.remove('on'); });
    b.classList.add('on'); S.mode = b.dataset.m;
    document.getElementById('modedesc').textContent = MDESC[S.mode];
    S.cam = { x: 0, y: 0, k: 1 }; S.alpha = 0.8; S.autofit = true;
    relayout();
  };
});
document.getElementById('modedesc').textContent = MDESC[S.mode];
document.getElementById('lblab').textContent = '허브만';
document.getElementById('bigcnt').textContent = '(' + DB.bigs.length + ')';
const NMISS = DB.nodes.length - DB.nconcept;
document.getElementById('misscnt').textContent = NMISS ? '(' + NMISS + ')' : '(0)';
if (!NMISS) document.getElementById('showmiss').parentElement.style.opacity = '.45';

/* ★화면 아래 상태줄 — 층별 '표시 / 전체'를 항상 적는다.
   그리다 만 것이 있으면 숫자로 말해야 한다(조용한 truncation 금지). */
function hint() {
  const el = document.getElementById('hint'); if (!el) return;
  function cell(name, shown, total, col) {
    const cut = shown < total;
    return '<span style="color:' + col + '">' + name + '</span> <b>' + shown.toLocaleString() + '</b>'
      + '<span style="color:' + (cut ? '#c9a04d' : '#5c6472') + '">/' + total.toLocaleString() + '</span>';
  }
  el.innerHTML =
    '노드 <b>' + visN.toLocaleString() + '</b><span style="color:#5c6472">/' + NT.toLocaleString() + '</span>'
    + ' &nbsp;·&nbsp; ' + cell('1층 계층', hiShown.length, E_HI.length, DB.hierc)
    + ' &nbsp;·&nbsp; ' + cell('2층 관계', reShown.length, E_RE.length, '#ffb02e')
    + ' &nbsp;·&nbsp; ' + cell('3층 공기', coShown.length, E_CO.length, '#8b94a4')
    + ' &nbsp;·&nbsp; ' + fps.toFixed(0) + ' fps'
    + '<br><span style="color:#5c6472">'
    + (S.mode === 'tree' && TREE_ROW * S.cam.k < 13
        ? '개념 이름표는 <b>휠로 확대</b>하거나 왼쪽에서 <b>대주제를 하나만 켜면</b> 나온다 — 249개를 한 화면에 다 적으면 글자가 겹쳐 아무것도 못 읽는다. '
        : '')
    + '노란 숫자 = 지금 화면에 <b>안 그려진 것이 있다</b>는 표시. '
    + '왼쪽에서 층·대주제·관계 종류를 켜면 다시 나온다.</span>';
}

(function () {   // 공기층 경고문의 숫자는 데이터에서 뽑는다(하드코딩하면 다음 확장 때 거짓말이 된다)
  let lo = 0; for (const e of E_CO) if (e[2] < 10) lo++;
  document.getElementById('conote').innerHTML = E_CO.length.toLocaleString() + '개 중 '
    + (lo * 100 / Math.max(1, E_CO.length)).toFixed(0) + '%(' + lo.toLocaleString()
    + '개)가 10회 미만이라 다 켜면 털뭉치가 된다.';
})();
resize(); syncCoBox(); syncCo(); recomputeVis(); requestAnimationFrame(loop);
</script></body></html>
"""


def main():
    nodes, edges, units, rel, layers = load_all()
    db, audit = build_db(nodes, edges, units, rel, layers)

    blob = json.dumps(db, ensure_ascii=False, separators=(",", ":"))
    n_ghost_n = len(db["nodes"]) - db["nconcept"]
    doc = (TEMPLATE
           .replace("%%DATA%%", blob)
           .replace("%%STAMP%%", db["stamp"])
           .replace("%%NNODE%%", f'{db["nconcept"]:,}')
           .replace("%%NMISS%%", f' <b style="color:#c9a04d">+미등재 {n_ghost_n}</b>' if n_ghost_n else '')
           .replace("%%NUNIT%%", f'{len(db["units"]):,}')
           .replace("%%NHIER%%", f'{audit["n_hier"]:,}')
           .replace("%%NREL%%", f'{audit["n_rel"]:,}')
           .replace("%%NCO%%", f'{len(db["edges"]):,}')
           .replace("%%NEDGE%%", f'{len(db["edges"]) + len(db["ulinks"]) + len(db["hlinks"]):,}'))
    out = HERE / "지식망.html"
    out.write_text(doc, encoding="utf-8")

    kb = out.stat().st_size / 1024
    n_x = sum(1 for _ in db["ulinks"] if _[1] == 0)
    print(f"[지식망] 개념 {len(db['nodes'])} · 판단유닛 {len(db['units'])} · 계층 허브 {audit['n_hub']}")
    print("  ── 3층 구조 ──")
    print(f"  1층 계층(뼈대)     {audit['n_hier']:>6,}개  대주제 {len(db['bigs'])} → 중주제 "
          f"{audit['n_hub'] - len(db['bigs']) - 1} → 개념 {db['nconcept']}   [기본 ON · 전량 표시]")
    print(f"      = 파일의 계층 간선 {audit['n_hier'] - len(db['bigs'])} + 화면이 얹은 뿌리→대주제 {len(db['bigs'])}"
          f"  (뿌리 노드는 파일에 없다 — 트리 꼭대기를 만들려고 화면에서 붙인다)")
    print(f"  2층 관계(뉴런)     {audit['n_rel']:>6,}개  결정론 규칙                       [기본 ON · 전량 표시]")
    for k, v in audit["rel_kind_cnt"].most_common():
        col = REL_KIND.get(k, ("?", "?", "※REL_KIND 미등록 — 회색으로 그려짐"))
        print(f"        {k:<6} {v:>4}  {col[2]}")
    print(f"      부호 분포: {dict(audit['rel_pol_cnt'])}")
    print(f"  3층 동시출현(공기) {len(db['edges']):>6,}개  [★기본 OFF — 켜면 w≥{db['defw']} 부터]")
    for t in (1, 10, 100, db["defw"]):
        print(f"        w≥{t:<5}: {sum(1 for e in db['edges'] if e[2] >= t):>6,}개")
    if audit["unknown_kind"]:
        print(f"  ⚠REL_KIND 색표에 없는 kind {len(audit['unknown_kind'])}종 → 회색으로 그려진다: "
              f"{audit['unknown_kind']}")
    else:
        print("  REL_KIND 미등록 kind 0종")
    print("  ── (기존) 판단 유닛 층 ──")
    print(f"  유닛 횡단 링크 {len(db['ulinks'])} (개념행 {n_x} · 유닛행 {len(db['ulinks']) - n_x}) · 유닛 계층 링크 {len(db['hlinks'])}")
    n_ghost = len(db["nodes"]) - db["nconcept"]
    print("  ── 링크 대상 대조 ──")
    print(f"  횡단 '개념:XXX' 정확 일치 {audit['exact_x']}건 · 별칭 해소 {len(audit['alias_x'])}건 · 미등재 {len(audit['miss_x'])}건")
    for a in audit["alias_x"]:
        print(f"     ↪ 별칭 {a[0]} '{a[1]}' → '{a[2]}'  ※사람 검토 필요(화면에도 긴 점선으로 표시됨)")
    for m in audit["miss_x"]:
        print(f"     ? 미등재 {m[0]} '{m[1]}'  → 회색 점선 노드로 띄움(사전 신설 후보)")
    n_alias_h = len(audit["alias_h"])
    print(f"  계층 개념 정확 일치 {len(db['hlinks']) - n_alias_h - len(audit['miss_h'])}건 "
          f"· 별칭 해소 {n_alias_h}건 · 미등재 {len(audit['miss_h'])}건")
    for a in audit["alias_h"]:
        print(f"     ↪ 별칭 {a[0]} '{a[1]}' → '{a[2]}'")
    for m in audit["miss_h"]:
        print(f"     ? 미등재 {m[0]} '{m[1]}'")

    print("  ── 강도(weight) ──")
    wts = sorted(Counter(l[8] for l in db["ulinks"]).items())
    print(f"  weight 분포: {wts}")
    print(f"  굵기 매핑 실측: " + " · ".join(
        f"{w}→{0.6 + w ** 1.35 * 5.4:.2f}px" for w in [0.1, 0.2, 0.5, 0.7, 0.9, 1.0]))
    if audit["evid_mismatch"]:
        print(f"  ⚠근거유형↔weight 사다리 불일치 {len(audit['evid_mismatch'])}건 "
              f"(굵기는 weight 를 그대로 씀 — 사다리로 되계산하지 않는다):")
        for u, to, ev, exp, got in audit["evid_mismatch"]:
            print(f"     {u} → {to} : 근거유형 '{ev}' 사다리값 {exp} 인데 weight={got}")
    if audit["unknown_rel"]:
        print(f"  ⚠REL_GROUP 에 없는 rel {len(audit['unknown_rel'])}종 → '정밀화'로 기본 배정됨: {audit['unknown_rel']}")
    else:
        print("  REL_GROUP 미등록 rel 0종")
    if n_ghost:
        print(f"  ── 미등재 개념 노드 {n_ghost}개: {audit['ghosts']} (점선 테두리·회색으로 렌더)")
    print(f"  파일 {kb:,.0f} KB")
    print(f"  → {out}")


if __name__ == "__main__":
    main()
