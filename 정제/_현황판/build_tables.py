# -*- coding: utf-8 -*-
"""
조견표 이식 — 방법론 보드(피그잼) + 웹 교재에서 건진 표를 «산출» 간선으로.

═══ 왜 ═══
  운영자 260726: *"신살은 **내가 준 피그잼에도 있어. 너가 정제를 제대로 안한거야.**
  내 피그잼이 진짜 거의 **인덱싱 표에 가까울정도로 기초**거든?"*
  실측이 맞았다 — 보드 69,364자가 코퍼스 적재 0건, 웹 조견표도 겨냥해 훑은 적이 없었다.
  경계선(페이블 260726): **조견표(입력→글자)까지는 «적기», 글자→삶의 부호부터는 창작.**
  이 파일은 **앞쪽만** 다룬다. 길흉·성격은 한 줄도 안 담는다.

═══ ⚠축자를 다시 잰다 ═══
  두 수확 파일은 각각 담당이 «전량 대조 통과»라고 보고했다. **그래도 다시 잰다** —
  이 프로젝트 규칙이다(「에이전트 수치는 메인이 다시 잰다」, 260726에 실제로 두 번 구제됐다).
  · 웹 표  → 코퍼스의 그 `para_id` 문단에 축자가 실재하는가
  · 보드 표 → 보드 문단(`보드_문단.jsonl`) 어딘가에 축자가 실재하는가
  없으면 **그 표를 버리고 화면에 띄운다.** 조용히 통과하는 길이 없다.

═══ ⚠이름을 정본 노드로 바로세운다 ═══
  세 곳이 표기가 다 다르다: 보드 `갑(甲)목(+)` · 웹 `갑목` · 지도 `갑목(甲)`.
  한자가 있으면 한자로, 없으면 두 글자로 맞춘다. **못 맞추면 버린다**(게이트).
  ⛔여기서 «비슷하니까 이거겠지»로 붙이면 그 순간 조용히 틀린 지도가 된다.

출력: data/조견표_간선.jsonl  (build_relation_edges 가 읽어 «산출» 간선으로 올린다)
"""
import json, re, sys, unicodedata, importlib.util
from pathlib import Path
from collections import Counter, defaultdict

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
sys.path.insert(0, str(HERE))
_sp = importlib.util.spec_from_file_location("bnm", HERE / "build_neuron_map.py")
bnm = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(bnm)
bnm.SNAP_DIRS = bnm._snapshot_dirs()
from 작업내역 import 단계          # noqa: E402
import 코퍼스 as CP                # noqa: E402

CONCEPTS = set(bnm.CONCEPT_MARKER_RE)

# ── 정본 노드명 색인: 한자 → 노드 · 두글자 → 노드
_BY_HANJA, _BY_KO = {}, {}
for c in CONCEPTS:
    m = re.match(r"^([가-힣]{2})\(([一-鿿])\)$", c)
    if m:
        _BY_KO[m.group(1)] = c
        _BY_HANJA[m.group(2)] = c

# 십이운성·기타 표 라벨 → 정본 노드 (지도 노드가 12개가 아니라 9개로 묶여 있다)
_STAGE = {"장생": "장생", "목욕": "목욕", "관대": "관대", "건록": "건록", "제왕": "제왕",
          "쇠": "쇠", "병": "병·사", "사": "병·사", "묘": "묘(입묘)",
          "절": "절·태·양", "태": "절·태·양", "양": "절·태·양"}


def norm(t):
    # U+2028/2029 도 공백으로 뭉갠다 — 축자 대조가 그 문자 하나로 어긋나면 안 된다
    t = (t or "").replace(" ", " ").replace(" ", " ")
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", t))


# 표기 흔들림 → 정본 노드. ⚠«비슷해 보여서»가 아니라 **같은 것을 다르게 쓴 것**만 넣는다.
#   「백호대살」과 「백호」는 같은 신살의 긴 이름/짧은 이름이다. 이건 별칭이다.
#   반대로 「년살」과 「도화」처럼 «같다고들 하는» 것은 여기 넣지 않는다 — 그건 판단이다.
#   ★260727 추가 — 잔량표가 「안 붙음 11」로 짚어준 것들의 정체는 **전부 표기 흔들림**이었다.
#     보드·웹은 짧은 이름을, 지도는 «총칭/한자 병기» 형태를 쓴다. 같은 것을 다르게 쓴 것이다.
#     ⚠«비슷해 보이는 것»은 여기 넣지 않는다 — 아래는 전부 지도 노드명을 실측해 확인한 것.
_ALIAS = {"홍염살": "홍염", "십성": "십성(총칭)", "용신": "용신(총칭)",
          "세운": "세운(연운)", "격국": "격국 일반", "투출": "투간·투출",
          "조후": "한난조습", "편관": "편관(칠살)",
          "괴강살": "괴강", "백호대살": "백호", "고란": "고란살",
          "현침": "현침살", "급각": "급각살", "금여록": "금여",
          "학당귀인": "학당", "천을": "천을귀인",
          # 지도는 둘을 한 노드로 쥐고 있다(문창·문곡). 표는 따로 준다.
          "문창": "문창·문곡", "문곡": "문창·문곡",
          "년살": "년살·월살", "월살": "년살·월살", "고초살": "년살·월살",
          "천살": "천살·지살", "지살": "천살·지살",
          "겁살": "겁살·재살", "재살": "겁살·재살", "수옥살": "겁살·재살",
          "역마살": "역마", "화개살": "화개", "도화살": "도화",
          "고신살": "고신·과숙", "과숙살": "고신·과숙"}


# 오행 한 글자 → 정본 노드. 표가 「지지 | 오행 | 분류」 꼴로 오행을 한 글자로 쓴다.
_BY_OH = {}
for _c in CONCEPTS:
    _mo = re.match(r"^([목화토금수])\([一-鿿]\)$", _c)
    if _mo:
        _BY_OH[_mo.group(1)] = _c


def to_node(raw):
    """표의 셀 문자열 → 정본 노드명. 못 맞추면 None (게이트가 잡는다)."""
    if not raw:
        return None
    s = unicodedata.normalize("NFC", str(raw)).strip()
    # 보드 표에는 지지에 이모지가 붙어 있다(자🐭·축🐮). 떼지 않으면 노드로 안 풀린다.
    s = re.sub(r"[🌀-🫿☀-➿]", "", s).strip()
    s = _ALIAS.get(s, s)
    s = _ALIAS.get(re.sub(r"\(.*", "", s).strip(), s)
    if s in CONCEPTS:
        return s
    # ★260727 — 표가 괄호로 «부연»을 달아 노드를 못 찾던 것.
    #   실측 사례: `천을귀인(일귀격)` · `반안살(금여)` · `홍염살(+)` — 괄호만 떼면 정본 노드다.
    #   ⚠괄호를 뗀 결과가 «정본 노드일 때만» 인정한다. 비슷한 이름으로 미는 게 아니다.
    _bare = re.sub(r"\([^)]*\)", "", s).strip()
    if _bare and _bare in CONCEPTS:
        return _bare
    if _bare in _ALIAS and _ALIAS[_bare] in CONCEPTS:
        return _ALIAS[_bare]
    # 오행 한 글자(목·화·토·금·수) → `목(木)` 꼴. **표 자체가 오행 칸일 때만 이 자리에 온다.**
    if s in _BY_OH:
        return _BY_OH[s]
    h = re.search(r"[一-鿿]", s)          # 한자 한 글자가 가장 확실한 열쇠
    if h and h.group() in _BY_HANJA:
        return _BY_HANJA[h.group()]
    k = re.search(r"([가-힣]{2})", re.sub(r"\([^)]*\)", "", s))
    if k and k.group(1) in _BY_KO:
        return _BY_KO[k.group(1)]
    for lab, node in _STAGE.items():              # 십이운성 단계 라벨
        if s.startswith(lab):
            return node
    return None


# ── 지지 한 글자 → 정본 노드. **지지인 것이 문맥으로 확실한 자리에서만** 쓴다.
#   ⚠일반 `to_node()`에 넣으면 안 된다 — 「신」이 지지 申인지 천간 辛인지 알 수 없고,
#     「해」는 지지 亥이자 관계 害다. 게이트가 그래서 막은 것이고, 그 판단이 옳았다.
#   여기서 푸는 것은 「원진 6쌍」·「한난조습 12지」처럼 **표 자체가 지지 표인 경우**뿐이다.
# 🔴🔴260727 수리 — **이 표에 천간이 9개 섞여 있었다.**
#   조건이 `_c[1] in "수토목화금"`이라 `갑목(甲)`·`병화(丙)`·`경금(庚)`…이 전부 통과했다.
#   「지지 한 글자 → 노드」 표인데 **천간 10개 중 9개가 들어앉아 있었던 것.**
#   ⚠최악은 「신」이다 — `신금(辛)`(천간)과 `신금(申)`(지지)이 **둘 다 조건을 만족**해서
#     **집합 순회 순서에 따라 어느 쪽이 이길지 갈린다.** 실행마다 달라질 수 있는 상태라
#     «틀린 것»보다 나쁘다(재현이 안 되니 추적도 안 된다).
#   실제 피해(요체 승격 위원 적발): `신금(辛)` 노드의 조견 28칸 중 **20칸이 지지 申의 것**
#     (묘신 원진·사신 육합·인신충·申 지장간·십이운성 6종)이었다.
#   → **지지 12글자만** 받는다. 한자로 못박아 «비슷한 이름»이 새로 끼어들 여지를 없앤다.
_JIJI_HANJA = "子丑寅卯辰巳午未申酉戌亥"
_JI1 = {}
for _c in CONCEPTS:
    _m1 = re.match(r"^([가-힣])[가-힣]\(([一-鿿])\)$", _c)
    if _m1 and _m1.group(2) in _JIJI_HANJA:      # 자수(子)·축토(丑)… — 한자로 판정한다
        _JI1[_m1.group(1)] = _c


def ji1(c):
    """지지 한 글자 → 노드. 못 풀면 원래 값을 돌려 게이트가 잡게 둔다."""
    c = str(c or "").strip()
    return _JI1.get(c, c)


def gan1(c):
    """천간 한 글자 → 노드. **표가 천간 표인 것이 확실한 자리에서만** 쓴다.

    ⚠`ji1`과 반드시 갈라 쓴다 — 「신」은 천간 辛이자 지지 申이다.
      260727까지는 `_JI1`에 천간이 섞여 있어 이 구분이 없었고, 그래서 「신」이
      **실행마다 갈릴 수 있는 상태**였다.
    """
    c = str(c or "").strip()
    return _GAN1.get(c, c)


# ── 천간 한 글자 → 정본 노드. **표가 천간 표인 것이 확실한 자리에서만** 쓴다.
#   「삼기귀인 = 갑무경(甲戊庚)」처럼 조합이 한 글자씩 붙어 있는 표가 있다.
#   ⚠`신`은 천간 辛이자 지지 申이므로 여기서 풀린 값을 지지 자리에 쓰면 안 된다.
_GAN1 = {}
for _c in CONCEPTS:
    _mg = re.match(r"^([가-힣])[가-힣]\([甲乙丙丁戊己庚辛壬癸]\)$", _c)
    if _mg:
        _GAN1[_mg.group(1)] = _c


# 🔴260726 — 「신금」이 **천간 辛과 지지 申 둘 다**라 조견표가 오염됐다.
#   실측: 천을귀인·건록·홍염·문창문곡 표의 출력에 `신금(辛)`이 들어가 엔진 대조가 깨졌고
#   반례 픽스처가 잡았다. **신살 조견표의 출력은 언제나 지지다** — 그 문맥에서만 지지로 민다.
#   ⚠일반 `to_node()`는 건드리지 않는다. 문맥 없이 밀면 천간 辛 용례가 통째로 죽는다.
_JI_FORCE = {"신금": "신금(申)", "신": "신금(申)"}


def to_ji(x):
    """지지가 확실한 자리(신살 조견표의 출력)에서 쓰는 해석기."""
    _s = str(x or "").strip()
    return _JI_FORCE.get(_s.split("(")[0].strip(), None) or to_node(_s) or ji1(_s)


def _load(p):
    """jsonl 읽기. ⚠`splitlines()`를 쓰면 안 된다 — **U+2028/U+2029에서도 자른다.**

    JSON은 그 둘을 이스케이프하지 않으므로 한 줄이 두 줄로 쪼개져 파싱이 죽는다.
    이 프로젝트가 260722에 좌표계 어긋남으로 한 번, 오늘 보드 적재에서 또 한 번,
    여기서 세 번째로 당했다. **jsonl은 개행 문자로만 자른다.**
    """
    if not p.exists():
        return []
    return [json.loads(l) for l in p.read_text(encoding="utf-8").split(chr(10))
            if l.strip() and not l.lstrip().startswith('{"_')]


def main():
    # ── 축자 대조용 본문 (웹/전사는 para_id 로, 보드는 통짜로)
    idx = {}
    board_all = []
    for r in CP.문단들(격자=True, 보드=True):
        idx[r["para_id"]] = r["text"]
        if r["출처종"] == "보드":
            board_all.append(r["text"])
    board_blob = norm("\n".join(board_all))

    edges, stat, 탈락, 미매핑 = [], Counter(), [], Counter()

    def emit(a, b, 이름, 조건, 출처, 판본, 요건, src, kind="산출"):
        na, nb = to_node(a) if a not in CONCEPTS else a, to_node(b)
        if a in CONCEPTS:
            na = a
        if not na or not nb:
            # ⚠어느 «표»에서 못 맞췄는지까지 센다 — 표를 모르면 고칠 자리를 못 찾는다.
            #   그리고 전량을 파일로 뽑는다(화면 상위 12개만 보면 나머지가 조용히 묻힌다).
            미매핑[(이름, str(a), str(b), "a" if not na else "b")] += 1
            stat["탈락:이름"] += 1
            return
        cond = 조건
        if 요건:
            cond += f" · 성립요건 {요건}"
        if 판본:
            cond += f" · 판본 {판본}"
        edges.append({"a": na, "b": nb, "kind": kind, "dir": "a→b",
                      "조건": cond, "표": 이름, "출처": 출처, "판본": 판본,
                      "source": src})
        stat["채택"] += 1

    # ══ ①-A 표 이름이 노드가 아닌 표들 — **표마다 «무엇이 a인가»가 다르다.**
    #   1차 실행에서 817칸을 버렸는데, 원인은 내가 «표이름 = 노드»로 뭉뚱그린 것이었다.
    #   「일간 × 십이운성 격자에 걸리는 신살」은 표 이름이 노드일 리가 없다 —
    #   그 표의 노드는 **행 안의 `신살` 값**이다. 표마다 처리기를 따로 쓴다.
    #   ⚠못 다루는 표는 **버렸다고 화면에 찍는다.** 조용한 누락이 이 프로젝트 주적이다.
    def 표별(nm, rows, 판본, src0):
        n = 0
        for row in rows:
            if "신살" in row and "지지" in row:              # 격자 신살 · 십이신살 완전표
                cond = []
                if row.get("일간"):
                    cond.append(f"일간이 {row['일간']}")
                if row.get("자리"):
                    cond.append(f"자리는 {row['자리']}")
                if row.get("기준 계절(국)"):
                    cond.append(f"기준지가 {row['기준 계절(국)']}")
                emit(row["신살"], row["지지"], nm, " · ".join(cond) or "조건 없음",
                     src0, 판본, row.get("성립요건"),
                     f"{src0} 「{nm}」 — {row['신살']} → {row['지지']}")
                n += 1
            elif "지지" in row and "지장간" in row:           # 지장간 (일수까지)
                for z in row["지장간"]:
                    emit(row["지지"], z.get("천간"), nm,
                         f"{z.get('자리')} · {z.get('일수')}일/30",
                         src0, 판본, None,
                         f"{src0} 「{nm}」 — {row['지지']} 안의 {z.get('천간')} "
                         f"({z.get('자리')} {z.get('일수')}일)")
                    n += 1
            elif "쌍" in row:                                # 원진·귀문·천간합·천간충 (강도·중첩까지)
                import re as _re
                gs = _re.findall(r"[가-힣]", _re.sub(r"\([^)]*\)", "", str(row["쌍"])))
                if len(gs) >= 2:
                    강 = row.get("강도")
                    중 = ("귀문관 중첩" in row and row.get("귀문관 중첩")) or row.get("원진 중첩")
                    # 🔴260727 — **표 이름을 보고 천간/지지를 가른다.**
                    #   전에는 `_JI1`에 천간이 9개 섞여 있어서(버그) 천간합·천간충이
                    #   «우연히» 풀리고 있었다. 그 버그를 고치자 이 표들이 드러났다 —
                    #   **버그가 다른 결함을 가려주고 있었던 것**(오늘 두 번째다).
                    _one = gan1 if "천간" in nm else ji1
                    emit(_one(gs[0]), _one(gs[1]), nm,
                         f"강도 {강}" + (f" · 중첩 {중}" if 중 else ""),
                         src0, 판본, None, f"{src0} 「{nm}」 — {row['쌍']} 강도 {강}")
                    n += 1
            elif "공망" in row and "순(旬)" in row:           # 공망 (순 → 지지 2개)
                import re as _re
                # ★260727 — `ji1()`을 안 씌워서 「공망 → 술」의 «술»이 안 풀리고 9칸이 버려졌다.
                #   공망표의 출력은 **언제나 지지**다 — 그 문맥에서만 한 글자를 지지로 민다.
                for g in (ji1(x) for x in _re.findall(r"([가-힣])\(", str(row["공망"]))):
                    emit("공망", g, nm, f"일주가 {row['순(旬)']}", src0, 판본, None,
                         f"{src0} 「{nm}」 — {row['순(旬)']} → 공망 {row['공망']}")
                    n += 1
            elif "지지" in row and "오행" in row:             # 지지 ↔ 오행 ↔ 생왕고
                emit(ji1(re.sub(r"[^가-힣]", "", str(row["지지"]))), row["오행"], nm,
                     f"분류 {row.get('분류')}" + (f" · {row.get('월')}" if row.get("월") else ""),
                     src0, 판본, None,
                     f"{src0} 「{nm}」 — {row['지지']} = {row['오행']} {row.get('분류')}")
                n += 1
            elif "지지" in row and ("충" in row or "귀문관살" in row):   # 지지 관계 카드
                # ★260727 — 카드의 «지지» 칸이 한 글자(`인`·`술`)라 `ji1()` 없이는 안 풀린다.
                #   27칸(충 9 · 귀문 9 · 원진 9)이 이 한 줄 때문에 버려지고 있었다.
                #   상대 칸은 `신(申)`처럼 한자가 붙어 있어 `to_node`가 이미 풀었다 —
                #   **한쪽만 풀려서 «절반만 맞는 표»가 조용히 통째로 탈락한 것.**
                for k, kk in (("충", "충"), ("귀문관살", "귀문"), ("원진살", "원진")):
                    if row.get(k):
                        emit(ji1(str(row["지지"]).strip()), row[k], f"{nm}·{kk}",
                             f"{kk}" + ("  ※귀문·원진 동시발현"
                                        if row.get("귀문원진 동시발현") else ""),
                             src0, 판본, None,
                             f"{src0} 「{nm}」 — {row['지지']}의 {kk} = {row[k]}")
                        n += 1
            # ★260726 2차 — 운영자 지적: *"한난조습이 피그잼에 월별 표식에 기본은 있을거야.
            #   십이신살 조건도 있을걸? 형 삼합 조견표 봐봐 피그잼에 일단 기본있음"*
            #   맞았다. 표는 다 있었고 **내가 처리기를 안 만들어서 버리고 있었다.**
            elif "신살" in row and "조건" in row:            # 십이신살 산출 조건(위치 규칙)
                # 「이전 삼합국의 생지」 → 생지/왕지/고지 노드로 착지한다.
                #   ⚠지지 12개로 전개하지 않는다 — 전개는 기준지가 정해져야 가능하고,
                #     기준지 자체가 판본이 갈린다(보드: 기존명리=연지 / 현대명리=일지).
                #     **규칙을 규칙대로 저장한다**(십이신살 공식을 상수로 둔 것과 같은 처분).
                _자 = ("생지(역마)" if "생지" in row["조건"] else
                       "왕지(도화)" if "왕지" in row["조건"] else
                       "고지(화개)" if "고지" in row["조건"] else None)
                if _자:
                    emit(row["신살"], _자, nm,
                         f"{row['조건']} · 기준지는 연지(기존 명리) 또는 일지(현대 명리) — 판본 갈림",
                         src0, 판본, None,
                         f"{src0} 「{nm}」 — {row['신살']} = {row['조건']}")
                    n += 1
            elif "종류" in row and "조합" in row:            # 형(刑) 조견표
                import re as _re2
                _gs = _re2.findall(r"[가-힣](?=\()", str(row["조합"])) or \
                      _re2.findall(r"[가-힣]", _re2.sub(r"\([^)]*\)", "", str(row["조합"])))
                # ★260727 — 「상형(相刑)」 행의 조합이 **서술문**이다:
                #   `조합: "삼형 중 두 글자만 있을 경우"` → 아래 폴백 정규식이 그 문장을
                #   낱글자로 훑어 «삼→형·삼→중·삼→글·삼→만» 같은 쓰레기 52칸을 만들었다.
                #   → **지지로 풀리는 글자만 남긴다.** 하나도 없으면 서술행으로 센다.
                _gs = [g for g in _gs if ji1(g) != g]
                for _i in range(len(_gs)):
                    for _j in range(_i + 1, len(_gs)):
                        emit(ji1(_gs[_i]), ji1(_gs[_j]), f"{nm}·{row['종류']}",
                             f"{row['종류']}" + (f" · 별칭 {row['별칭']}" if row.get("별칭") else ""),
                             src0, 판본, None,
                             f"{src0} 「{nm}」 — {row['종류']} {row['조합']}"
                             + (f" ({row['별칭']})" if row.get("별칭") else ""))
                        n += 1
                if not _gs:
                    n += 1        # 「삼형 중 두 글자만」 같은 서술행 — 버리지 않되 간선은 없다
            elif "계절" in row and "지지" in row:            # 삼합국·방합국
                import re as _re2
                _a = "삼합" if "삼합" in nm else ("방합" if "방합" in nm else None)
                if _a:
                    for _g in _re2.findall(r"[가-힣](?=\()", str(row["지지"])):
                        emit(_a, ji1(_g), nm,
                             f"{row.get('계절')} {row.get('국')}"
                             + (f" · {row['억제']}" if row.get("억제") else ""),
                             src0, 판본, None,
                             f"{src0} 「{nm}」 — {row.get('계절')} {row.get('국')} = {row['지지']}")
                        n += 1
            elif "지지" in row and "설명" in row and "묘지" in str(row.get("설명")):
                import re as _re2                            # 고지 ↔ 묘지 오행
                _m = _re2.search(r"([목화토금수])\(", str(row["설명"]))
                if _m:
                    emit(ji1(row["지지"]), _m.group(1), nm,
                         str(row["설명"]), src0, 판본, None,
                         f"{src0} 「{nm}」 — {row['설명']}")
                    n += 1
            elif "지지" in row and "한난" in row:             # 한난조습(조후)
                emit(ji1(row["지지"]), "한난조습", nm,
                     f"한난 {row.get('한난')} · 조습 {row.get('조습')}"
                     " ⚠조습 축은 보드 추출 담당이 «검산 근거 없어 확신 낮음»이라 표시",
                     src0, 판본, None,
                     f"{src0} 「{nm}」 — {row['지지']}: {row.get('한난')}/{row.get('조습')}")
                n += 1
            elif "지지" in row and "범위" in row:             # 12시진 ↔ 시각
                # ★운영자 1-41의 실물 — 보드가 시진마다 «중심 ±1»을 준다. 경계가 선이 아니다.
                emit(ji1(str(row["지지"]).replace("시", "")), "만세력·시간보정", nm,
                     f"시각 {row.get('범위')} · 중심 {row.get('중심')} "
                     "— **±1시간의 폭이 원문에 명시돼 있다(경계는 선이 아니다)**",
                     src0, 판본, None,
                     f"{src0} 「{nm}」 — {row['지지']} {row.get('범위')} (중심 {row.get('중심')})")
                n += 1
            elif "십성" in row and ("to" in row or "from" in row):   # 십성 생극제화
                # to[0]=내가 생하는 것 · to[1]=내가 극하는 것 · from[0]=나를 생 · from[1]=나를 극
                #   ⚠순서 해석은 **우리 판독**이다. 다만 이미 지도에 있는 십성 생극 간선과
                #     대조하면 검산이 된다(같으면 보드가 근거를 하나 더 얹는 것뿐).
                for _i, _o in enumerate(row.get("to") or []):
                    emit(row["십성"], _o, nm, ("내가 생한다" if _i == 0 else "내가 극한다"),
                         src0, 판본, None, f"{src0} 「{nm}」 — {row['십성']} to {_o}")
                    n += 1
                for _i, _o in enumerate(row.get("from") or []):
                    emit(_o, row["십성"], nm, ("나를 생한다" if _i == 0 else "나를 극한다"),
                         src0, 판본, None, f"{src0} 「{nm}」 — {_o} from→ {row['십성']}")
                    n += 1
            elif "단계" in row and "항목" in row:             # 사주풀이 6단계 절차
                import re as _re2
                _KEY = ["일간", "일주", "일지", "월지", "지장간", "격국", "투출", "통근",
                        "조후", "신강", "신약", "용신", "대운", "세운", "십성", "궁합"]
                _txt = str(row["단계"]) + " " + " ".join(row.get("항목") or [])
                for _k in _KEY:
                    if _k in _txt:
                        emit("통변 순서", _k, nm, f"{row['단계']}에서 본다",
                             src0, 판본, None,
                             f"{src0} 「{nm}」 — {row['단계']} → {_k}")
                        n += 1
            elif "절기" in row or "황경" in row or "양력" in row:   # 24절기 표
                emit("절기", "만세력·시간보정", nm,
                     " · ".join(f"{k} {v}" for k, v in row.items() if v),
                     src0, 판본, None, f"{src0} 「{nm}」 — {row}")
                n += 1
            elif "단계" in row and "강도" in row:              # 십이운성 강도
                _s3 = to_node(row.get("단계"))
                if _s3:
                    emit(_s3, "십이운성 자체", nm, f"강도 {row.get('강도')}",
                         src0, 판본, None, f"{src0} 「{nm}」 — {row.get('단계')} {row.get('강도')}")
                    n += 1
            elif "서열" in row or "단서" in row:              # 합·충 세기 서열
                # ★260727 — 전엔 «간선으로 억지로 펴지 않는다»며 세기만 했다. 그 판단이 반만 맞았다.
                #   쌍으로 펴는 것(방합→인목…)은 틀리지만, **서열 자체가 관계**다:
                #     `방합 > 삼합 > 천간의 유인력 > 충 = 육합 > 반합`
                #   → 이웃한 두 항을 `비교` 간선으로 잇는다. 종류가 다른 «비교»이므로
                #     kind="비교"로 두고 근거사슬의 **비인과 목록**에 이미 들어가 있다
                #     (즉 이걸 «이유»로 세지 않는다 — 목차·참조로만 쓴다). 그게 맞다.
                #   ⚠운영자 1-41 — 서열도 값만 적으면 거짓이다. **원문 축자를 조건에 그대로 남긴다**
                #     (「충 = 육합」처럼 동급인 자리가 있고, 그 «=»가 정밀도 정보다).
                import re as _re5
                _S = {"방합": "방합", "삼합": "삼합", "천간의 유인력": "천간합",
                      "천간합": "천간합", "충": "지지충", "육합": "육합", "반합": "반합"}
                _raw = str(row.get("서열") or row.get("단서") or "")
                _seq = [t.strip() for t in _re5.split(r"[>=]", _raw) if t.strip()]
                _ops = _re5.findall(r"[>=]", _raw)
                _nodes = [_S.get(_re5.sub(r"\([^)]*\)", "", t).strip()) for t in _seq]
                _done = 0
                for _i, _op in enumerate(_ops):
                    if _i + 1 < len(_nodes) and _nodes[_i] and _nodes[_i + 1]:
                        emit(_nodes[_i], _nodes[_i + 1], nm,
                             ("세기가 더 크다" if _op == ">" else "세기가 같다")
                             + f" · 원문 서열 「{_raw}」", src0, 판본, None,
                             f"{src0} 「{nm}」 — {_seq[_i]} {_op} {_seq[_i+1]}",
                             kind="비교")
                        _done += 1
                n += max(_done, 1)
            else:
                return 0                       # 이 표는 못 다룬다 → 호출부가 기록한다
        return n

    미처리 = []

    # ══ ① 방법론 보드 ═══════════════════════════════════════════
    for r in _load(HERE / "_피그잼정제" / "조견표.jsonl"):
        nm, q = r.get("표이름", "?"), r.get("축자") or ""
        if not q or norm(q) not in board_blob:
            탈락.append(("보드", nm, f"축자 미실존 — 「{q[:40]}」"))
            stat["탈락:축자"] += 1
            continue
        rows_ = r.get("표") or []
        if rows_ and "입력" not in rows_[0]:
            got_n = 표별(nm, rows_, r.get("판본"), "방법론 보드")
            if not got_n:
                # 보드 쪽 폴백 — 웹과 같은 앵커표를 쓴다(둘이 다른 규칙을 쓰면 또 한쪽만 고친 꼴).
                _BA = {"신강약 점수": "점수론(110점)", "합·충 세기": "합화",
                       "12지지 ↔ 오행": "지지(총칭)", "고지 ↔ 묘지": "고지(화개)",
                       "오행 배속": "오행(총칭)", "근묘화실": "근묘화실",
                       "24절기": "절기", "십이운성 강도": "십이운성 자체",
                       "12시진": "만세력·시간보정", "사주풀이 절차": "통변 순서"}
                _a2 = next((v for k, v in _BA.items() if k in nm), None)
                if _a2 and _a2 in CONCEPTS:
                    for row in rows_:
                        emit(_a2, "원국·명식", nm,
                             " · ".join(f"{k} {v}" for k, v in row.items() if v)[:300],
                             "방법론 보드", r.get("판본"), None,
                             f"보드 「{nm}」 — {row}"[:300], kind="적용")
                else:
                    미처리.append(("보드", nm, len(rows_)))
            continue
        # ★260727 — 보드에도 «표 이름이 노드가 아닌» 입력/출력 표가 있다.
        #   「십이운성 강도」는 출력이 왕(旺)/중(中)/약(弱) — 등급이지 노드가 아니다.
        #   웹 쪽엔 이 처리기가 이미 있었는데 보드 쪽엔 없어 12칸이 버려졌다(또 한쪽만).
        if "십이운성 강도" in nm:
            for row in rows_:
                _st4 = to_node(row.get("입력"))
                if _st4:
                    emit(_st4, "십이운성 자체", nm,
                         f"강도 {row.get('출력')}", "방법론 보드", r.get("판본"), None,
                         f"보드 「{nm}」 — {row.get('입력')} = {row.get('출력')}")
            continue
        for row in rows_:
            inp, outp = row.get("입력"), row.get("출력")
            if isinstance(outp, list):
                outs = outp
            else:
                outs = [outp]
            _stg = row.get("단계")
            for o in outs:
                # 십이운성 배정표는 «단계 → 지지»가 관계다(일간은 조건이 된다)
                if _stg:
                    emit(_STAGE.get(re.sub(r"\(.*", "", _stg), _stg), o, nm,
                         f"일간이 {inp}", "방법론 보드", r.get("판본"),
                         r.get("성립요건"), f"보드 조견표 「{nm}」 — {inp} → {o} ({_stg})")
                else:
                    emit(nm.split("(")[0].strip(), o, nm,
                         f"{r.get('기준') or '기준'}이 {inp}", "방법론 보드",
                         r.get("판본"), r.get("성립요건"),
                         f"보드 조견표 「{nm}」 — {inp} → {o}")

    # ══ ② 웹 교재 ═══════════════════════════════════════════════
    for r in _load(HERE / "_웹기틀" / "조견표_웹.jsonl"):
        nm, q, pid = r.get("이름", "?"), r.get("축자") or "", r.get("para_id")
        body = idx.get(pid)
        if body is None:
            탈락.append(("웹", nm, f"문단 없음 — {pid}"))
            stat["탈락:문단"] += 1
            continue
        if not q or norm(q) not in norm(body):
            탈락.append(("웹", nm, f"축자 미실존 — {pid} 「{q[:40]}」"))
            stat["탈락:축자"] += 1
            continue
        # ★260726 3차 — 웹 표에도 «표 이름이 노드가 아닌» 것들이 있다.
        #   보드 쪽에 처리기를 달면서 웹 쪽은 안 달아 697칸을 버리고 있었다.
        #   (같은 병을 같은 날 두 번 — 한쪽만 고치는 것.)
        _rows = r.get("표") or []
        _src = f"웹:{r.get('출처') or '?'}"
        if "원진" in nm and "귀문" in nm:
            # ★★이게 「자미원진이 왜 애증이냐」의 기전이다.
            #   `자미 → [원진, 해, 지장간 정임합]` — 원진이면서 해(害)이고, 그 두 글자의
            #   지장간이 서로 합한다. **극하면서 동시에 합한다**는 구조가 여기 적혀 있다.
            #   운영자 축자: *"미토로 인해 자수가 동요되는 이유는 무엇이고 그것이 왜
            #   애증관계를 만들어내냐 이걸 다 알아내야 하는거임"* — 그 재료가 이 한 줄이다.
            #   ⛔단 「애증」이라는 결론은 담지 않는다. **관계만** 담는다.
            for row in _rows:
                _gs = list(str(row.get("입력") or ""))[:2]
                if len(_gs) < 2:
                    continue
                _tags = [str(x) for x in (row.get("출력") or [])]
                _kind = ("원진" if "원진" in _tags else "귀문" if "귀문" in _tags else "관계")
                _extra = [x for x in _tags if x not in ("원진", "귀문")]
                emit(ji1(_gs[0]), ji1(_gs[1]), f"{nm}·{_kind}",
                     f"{_kind}" + (f" · 함께 성립: {', '.join(_extra)}" if _extra else ""),
                     _src, r.get("판본"), None,
                     f"웹 「{nm}」 {pid} — {row.get('입력')} = {', '.join(_tags)}")
            continue
        if "지장간 비율" in nm:
            import re as _re3
            for row in _rows:
                for _o in (row.get("출력") or []):
                    _m = _re3.match(r"(여기|중기|정기)\s*([一-鿿])\s*(\d+)", str(_o))
                    if _m:
                        # ★260727 — 입력이 지지 한 글자(`자`·`축`)라 `ji1()` 없이는 안 풀린다.
                        #   25칸이 이 한 줄로 버려졌다. 지장간 표의 입력은 언제나 지지다.
                        emit(ji1(str(row.get("입력") or "").strip()), _m.group(2), nm,
                             f"{_m.group(1)} · {_m.group(3)}일/30", _src, r.get("판본"), None,
                             f"웹 「{nm}」 {pid} — {row.get('입력')} 안의 {_o}")
            continue
        if "대운 순역" in nm:
            for row in _rows:
                for _o in (row.get("출력") or []):
                    emit("대운", "순행·역행", nm, f"{row.get('입력')} → {_o}",
                         _src, r.get("판본"), None,
                         f"웹 「{nm}」 {pid} — {row.get('입력')} → {_o}")
            continue
        if "신강" in nm and "판정" in nm:
            for row in _rows:
                for _o in (row.get("출력") or []):
                    emit("득령·득지·득세", _o, nm, f"{row.get('입력')}",
                         _src, r.get("판본"), None,
                         f"웹 「{nm}」 {pid} — {row.get('입력')} → {_o}")
            continue
        if nm.startswith("형 ="):
            # 「형 = 방합국 × 삼합국의 겹침」 — 형의 **생성 원리**다(서락오 계보).
            #   쌍으로 펴지 않는다. 원리를 원리대로 적는다.
            for row in _rows:
                for _b in ("방합", "삼합"):
                    emit("삼형", _b, nm, f"형은 방합국과 삼합국이 겹쳐 생긴다 — {row.get('입력')}",
                         _src, r.get("판본"), None,
                         f"웹 「{nm}」 {pid} — {row.get('입력')}")
            continue
        # ★260726 4차 — 운영자: *"거기있는거 **다 옮기라니까 파일 필요없을때까지**"*.
        #   내가 표를 골라 붙이고 있어서 운영자가 하나씩 짚어야 했다. 남은 것 일괄 처리.
        import re as _re4
        # 「십이운성 장생지」 같은 단계별 표 — 표 이름 안에 단계가 들어 있다
        _m4 = _re4.match(r"십이운성\s*(장생|목욕|관대|건록|제왕|쇠|병|사|묘|절|태|양)지?$", nm)
        if _m4:
            _node = _STAGE.get(_m4.group(1))
            for row in _rows:
                for _o in (row.get("출력") or []):
                    emit(_node, _o, nm, f"일간이 {row.get('입력')}", _src, r.get("판본"), None,
                         f"웹 「{nm}」 {pid} — {row.get('입력')} → {_o}")
            continue
        if _re4.match(r"십이운성\s*(강도|시기|강약)", nm):
            # 강도(왕/중/약)·시기·강약서열은 노드가 아니다 → 단계 노드에 «조건»으로 매단다.
            # ★260727 — 「십이운성 강약 서열」은 **방향이 반대**다:
            #     강도 표  : 입력=단계(장생)      · 출력=등급(왕)
            #     강약 서열 : 입력=등급(왕지(강함)) · 출력=단계 여럿(장생·관대·건록·제왕)
            #   전엔 `startswith("강도")`만 봐서 서열 표가 통째로 탈락(12칸)했고,
            #   입력을 단계로 읽으려 해도 «왕지(강함)»은 단계가 아니라 안 풀렸다.
            for row in _rows:
                _st2 = to_node(row.get("입력"))
                _outs2 = [x for x in (row.get("출력") or [])]
                if _st2:                                     # 입력이 단계인 판본
                    emit(_st2, "십이운성 자체", nm,
                         f"{nm.split()[-1]}: {', '.join(map(str, _outs2))}",
                         _src, r.get("판본"), None,
                         f"웹 「{nm}」 {pid} — {row.get('입력')} = {row.get('출력')}")
                else:                                        # 출력이 단계인 판본
                    for _o in _outs2:
                        _st3 = to_node(_o)
                        if _st3:
                            emit(_st3, "십이운성 자체", nm,
                                 f"강약 서열: {row.get('입력')}",
                                 _src, r.get("판본"), None,
                                 f"웹 「{nm}」 {pid} — {row.get('입력')} → {_o}")
            continue
        if nm.startswith("월운 경계"):
            # ★운영자 1-41의 실물 — 「달이 바뀌어도 절기 전이면 월주는 안 바뀐다」.
            #   경계가 «날짜»가 아니라 «절기»라는 것이 이 표의 내용이다. 조건을 조건대로 적는다.
            for row in _rows:
                emit("월운", "절기", nm,
                     f"{row.get('입력')} → {', '.join(map(str, row.get('출력') or []))}"
                     " — 경계는 달力의 날짜가 아니라 절입 시각이다",
                     _src, r.get("판본"), None,
                     f"웹 「{nm}」 {pid} — {row.get('입력')} → {row.get('출력')}")
            continue
        if nm.startswith("삼기귀인"):
            # 입력이 «세 천간 한 묶음»이고 출력은 「삼기 성립」이라는 라벨뿐이다.
            #   → 라벨을 노드로 삼지 않고, **삼기귀인 → 그 세 천간** 으로 편다.
            #     성립은 세 글자가 «다 있어야» 하므로 조건에 원문 조합을 그대로 남긴다.
            for row in _rows:
                _combo = str(row.get("입력") or "")
                for _g in _re4.findall(r"[가-힣]", _re4.sub(r"\([^)]*\)", "", _combo)):
                    _n3 = _GAN1.get(_g)
                    if _n3:
                        emit("삼기귀인", _n3, nm,
                             f"조합 {_combo} — **세 글자가 다 있어야 성립**",
                             _src, r.get("판본"), None,
                             f"웹 「{nm}」 {pid} — {_combo} 중 {_g}")
            continue
        if nm.startswith("십성 산출"):
            for row in _rows:
                for _o in (row.get("출력") or []):
                    emit("십성(총칭)", _o, nm, f"일간 대비 {row.get('입력')}",
                         _src, r.get("판본"), None,
                         f"웹 「{nm}」 {pid} — {row.get('입력')} → {_o}")
            continue
        if "절기" in nm or "시간 경계" in nm or "시진" in nm:
            # 24절기·시각 경계 — 개별 절기·시각은 노드가 아니다. **버리지 않고**
            #   골격 노드(절기 / 만세력·시간보정)에 조건으로 전량 매단다.
            #   ⚠운영자 1-41 — 시각·절기 경계도 «선»이 아니다. 원문의 폭 표기를 조건에 남긴다.
            _b4 = "절기" if "절기" in nm else "만세력·시간보정"
            for row in _rows:
                emit(_b4, "만세력·시간보정" if _b4 == "절기" else "절기", nm,
                     f"{row.get('입력')} → {', '.join(map(str, row.get('출력') or []))}",
                     _src, r.get("판본"), None,
                     f"웹 「{nm}」 {pid} — {row.get('입력')} {row.get('출력')}")
            continue
        # ★260726 5차 — 남은 표 일괄. **«남은 게 0»이 목표다**(운영자 지시).
        #   ⚠여기서도 «비슷하니까»로 붙이지 않는다. 표마다 «무엇이 a인가»를 정하고,
        #     정할 수 없으면 붙이지 않고 잔량표에 남긴다. 억지로 0을 만들면 그게 더 나쁘다.
        _ANCHOR = [
            ("강약 점수제", "점수론(110점)"), ("신강약 점수", "점수론(110점)"),
            ("대운수", "대운수"), ("대운 순역", "대운"),
            ("육합", "육합"), ("방합", "방합"), ("삼합", "삼합"),
            ("충 = 7번째", "지지충"), ("형(刑)", "삼형"),
            ("월지 강도", "월지"), ("통근 강약", "통근"), ("왕상휴수사", "월지"),
            ("공망 해소", "공망"), ("공망 운 적용", "공망"),
            ("천을귀인 효력", "천을귀인"), ("천덕·월덕 효력", "천덕·월덕"),
            ("록류", "건록"), ("십이신살 기준지", "십이운성 자체"),
            ("천덕귀인 성립", "천덕·월덕"), ("월덕귀인 성립", "천덕·월덕"),
            ("십이운성 산출 규칙", "십이운성 자체"), ("십이운성 신개념", "음간 십이운성"),
            ("지살·역마", "역마"), ("도화", "도화"), ("함지살", "함지살"),
            ("월공", "월공"), ("협록", "협록"), ("학당", "학당"),
            ("지지 체용", "체용론"), ("한난조습", "한난조습"),
            ("득령·득지·득세", "득령·득지·득세"), ("신왕 vs 신강", "신왕"),
            ("투출 판정", "투간·투출"), ("지장간", "지장간"),
            ("근묘화실", "근묘화실"), ("고지 ↔ 묘지", "고지(화개)"),
            ("오행 배속", "오행(총칭)"), ("합·충 세기", "합화"),
            ("12지지 ↔ 오행", "지지(총칭)"), ("사주풀이 절차", "통변 순서"),
            ("십성 생극제화", "십성(총칭)"),
        ]
        _anc = next((v for k, v in _ANCHOR if k in nm), None)
        if _anc and _anc in CONCEPTS:
            # 출력이 노드면 간선으로, 아니면 **조건에 통째로 실어** 정보를 잃지 않는다.
            for row in _rows:
                _ins = row.get("입력") or row.get("자리") or row.get("기준") or ""
                _outs = row.get("출력") if isinstance(row.get("출력"), list) else \
                        ([row.get("출력")] if row.get("출력") else
                         [v for k, v in row.items() if k not in ("입력", "자리", "기준") and v])
                _hit = False
                for _o in _outs:
                    _n2 = to_node(_o) or (ji1(_o) if isinstance(_o, str) and len(_o) == 1 else None)
                    if _n2 and _n2 in CONCEPTS:
                        emit(_anc, _n2, nm, f"{_ins}" or "조건 없음",
                             _src, r.get("판본"), None,
                             f"웹 「{nm}」 {pid} — {_ins} → {_o}")
                        _hit = True
                if not _hit:
                    # 노드로 못 펴는 값(서열·서술·수치)은 **앵커에 자기참조로 매달지 않는다** —
                    #   대신 앵커 ↔ 그 표가 속한 골격 노드로 잇고 내용을 조건에 남긴다.
                    # 🔴260726 수리 — 이 폴백을 «산출»로 찍었더니 **엔진 대조가 오염**됐다.
                    #   `천을귀인 → 원국·명식`이 조견표 쌍으로 세어져 「10칸이어야 하는데 11」이 됐고
                    #   반례 픽스처가 그걸 잡았다(픽스처가 제 일을 했다).
                    #   이건 조견표가 아니라 **내용 운반용**이다. kind 를 «적용»으로 가른다.
                    emit(_anc, "원국·명식", nm,
                         f"{_ins} → {', '.join(str(x) for x in _outs if x)}"[:300],
                         _src, r.get("판본"), None, f"웹 「{nm}」 {pid} — {row}"[:300],
                         kind="적용")
            continue
        # ★체용 음양 — 출력이 「체 양」·「용 음」이라 지지·천간이 아니다.
        #   운영자 §3 결정(260722): 「사해오자 체용 구분 채택 — 십성 산출은 用 기준」.
        #   그 결정이 기대는 표가 이것인데 지도엔 12지 전량이 없었다.
        if "체용" in nm:
            for row in (r.get("표") or []):
                for o in (row.get("출력") or []):
                    _cy = "체" if str(o).startswith("체") else "용"
                    _ym = "양" if "양" in str(o) else "음"
                    emit(ji1(row.get("입력")), "음양", nm,
                         f"{_cy}(體/用)로는 {_ym} — 십성 산출은 用 기준(§3 260722 확정)",
                         f"웹:{r.get('출처') or '?'}", r.get("판본"), None,
                         f"웹 조견표 「{nm}」 {pid} — {row.get('입력')} {_cy}={_ym}")
            continue
        for row in (r.get("표") or []):
            inp, outp = row.get("입력"), row.get("출력")
            outs = outp if isinstance(outp, list) else [outp]
            for o in outs:
                # 산출이 지지라고 표가 스스로 밝히면 지지로 민다(신금 애매성 해소)
                _o2 = to_ji(o) if "지지" in str(r.get("산출") or "") + str(nm) or                       any(k in nm for k in ("귀인", "건록", "홍염", "문창", "문곡", "학당",
                                            "암록", "금여", "양인", "협록", "월공",
                                            "함지", "도화", "역마", "화개")) else o
                emit(nm.split("(")[0].strip(), _o2 or o, nm,
                     f"{r.get('기준') or '기준'}이 {inp}",
                     f"웹:{r.get('출처') or '?'}", r.get("판본"), None,
                     f"웹 조견표 「{nm}」 {pid} — {inp} → {o}")

    # ── 같은 (a,b)면 조건을 누적한다. 덮어쓰면 「천을귀인→축토」가 갑·무·경 중 하나만 남는다
    #   (260726에 실제로 났던 사고). 판본이 갈리면 둘 다 남긴다.
    fold = {}
    for e in edges:
        k = (e["a"], e["b"])
        if k in fold:
            f = fold[k]
            if e["조건"] not in f["조건목록"]:
                f["조건목록"].append(e["조건"])
            if e["출처"] not in f["출처목록"]:
                f["출처목록"].append(e["출처"])
            # 🔴260726 수리 — **표 이름을 첫 것만 남기고 있었다.**
            #   그래서 잔량표가 「건록 웹 판본 = 안 붙음」으로 과소보고했다(실제로는 붙어서
            #   보드 간선에 합쳐진 것). «무엇이 남았나»를 세는 자가 틀리면
            #   운영자가 다시 하나씩 짚어야 한다 — 그게 이번에 지적받은 그 상황이다.
            if e["표"] not in f["표목록"]:
                f["표목록"].append(e["표"])
            f["source"] += " / " + e["source"]
        else:
            e["조건목록"] = [e["조건"]]
            e["출처목록"] = [e["출처"]]
            e["표목록"] = [e["표"]]
            fold[k] = e
    out = list(fold.values())
    for e in out:
        e.pop("조건", None)

    (DATA / "조견표_간선.jsonl").write_text(
        "\n".join(json.dumps(x, ensure_ascii=False) for x in out) + "\n", encoding="utf-8")

    교차 = [e for e in out if len({s.split(":")[0] for s in e["출처목록"]}) >= 2]
    print(f"조견표 이식 — 칸 {stat['채택']:,} → 간선 {len(out):,} "
          f"(보드·웹 **양쪽**에 다 있는 것 {len(교차)})")
    print(f"  탈락: {dict({k: v for k, v in stat.items() if k.startswith('탈락')})}")
    for src, nm, why in 탈락[:12]:
        print(f"   🔴[{src}] {nm} — {why}")
    # ── 미매핑 전량을 파일로 (화면은 상위 12개만 보여준다)
    _ML = ["# 조견표 미매핑 — 정본 노드로 못 맞춰 «버린» 셀 전량", "",
           "> 비슷하다고 붙이면 조용히 틀린 지도가 된다. 그래서 버린다.",
           "> 다만 **버린 것을 다 적는다** — 여기 남은 줄이 곧 «아직 못 붙인 기틀»이다.",
           "> 고치는 자리는 대개 `build_tables.py` 의 `_ALIAS`·`to_node()`·표별 처리기다.", "",
           f"- 못 맞춘 셀 **{sum(미매핑.values()):,}종 {len(미매핑)}가지**", "",
           "| 표 | a | b | 못 맞춘 쪽 | 횟수 |", "|---|---|---|---|---:|"]
    for (nm_, a_, b_, side), v in 미매핑.most_common():
        _ML.append(f"| {nm_} | {a_} | {b_} | {side} | {v} |")
    (DATA / "조견표_미매핑.md").write_text("\n".join(_ML) + "\n", encoding="utf-8")
    if 미매핑:
        print(f"  ⚠정본 노드로 못 맞춘 셀 {sum(미매핑.values()):,}종 {len(미매핑)}가지 "
              f"— **버렸다.** 비슷하다고 붙이면 조용히 틀린 지도가 된다")
        for (nm_, a_, b_, side), v in 미매핑.most_common(12):
            print(f"       [{nm_[:22]}] {a_} → {b_}  (못맞춘 {side})  ×{v}")
        print(f"     전량: {DATA / '조견표_미매핑.md'}")
    if 미처리:
        print(f"  ⛔처리기 없어 통째로 못 붙인 표 {len(미처리)}종 "
              f"(칸 {sum(x[2] for x in 미처리):,}) — **버렸다. 사람이 봐야 한다**")
        for src, nm, k in 미처리:
            print(f"       [{src}] {nm}  {k}칸")
    byt = Counter(e["표"] for e in out)
    print("  표별:", dict(byt.most_common(10)))

    with 단계("조견표 이식(보드+웹)",
            "운영자 지적 — 피그잼(69,364자)이 코퍼스 0건이었고 웹 조견표도 겨냥해 훑은 적이 없다. "
            "「기틀이 없으면 전사를 가져와도 붙일 자리가 없다」",
            ["data/조견표_간선.jsonl"]) as st:
        st.기록(f"칸 {stat['채택']} → 간선 {len(out)} · 교차 {len(교차)}")
        st.기록(f"탈락 {dict(stat)} · 미매핑 {len(미매핑)}가지 {sum(미매핑.values())}종")


if __name__ == "__main__":
    main()
