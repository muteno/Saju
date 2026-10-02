# -*- coding: utf-8 -*-
"""
명식 → 망 위의 신호(활성 개념).

원국 8글자(또는 6글자 — 시주 미상)를 받아, 관계망의 정본 노드 이름으로
"이 명식에서 켜지는 개념"과 그 자리를 돌려준다. 해석은 하지 않는다.
여기서 하는 것은 100% 결정론 계산뿐이다(계산은 캐지 않고 적어 넣는다).

· 합·충·형·파·해·원진·귀문 쌍은 data/relation_edges.jsonl(7월 결정론 관계 표)에서 읽는다.
  표를 두 벌로 두지 않기 위해서다.
· 신살 조견표는 표준 표를 적어 넣었다. 판본이 갈리는 것(양인의 음간, 도화의 기준지 등)은
  '판본' 표시를 달고 기본값 하나만 쓴다.

사용:
    from 명식 import 명식_신호
    sig = 명식_신호(["갑자", "병인", "무진", "경신"])   # 연·월·일·시
"""
import json, re
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"

STEMS = "갑을병정무기경신임계"
BRANCHES = "자축인묘진사오미신유술해"
STEM_HANJA = "甲乙丙丁戊己庚辛壬癸"
BRANCH_HANJA = "子丑寅卯辰巳午未申酉戌亥"
STEM_NODE = ["갑목(甲)", "을목(乙)", "병화(丙)", "정화(丁)", "무토(戊)", "기토(己)", "경금(庚)", "신금(辛)", "임수(壬)", "계수(癸)"]
BRANCH_NODE = ["자수(子)", "축토(丑)", "인목(寅)", "묘목(卯)", "진토(辰)", "사화(巳)", "오화(午)", "미토(未)", "신금(申)", "유금(酉)", "술토(戌)", "해수(亥)"]
ELEM = ["목", "화", "토", "금", "수"]
ELEM_NODE = {"목": "목(木)", "화": "화(火)", "토": "토(土)", "금": "금(金)", "수": "수(水)"}
STEM_ELEM = ["목", "목", "화", "화", "토", "토", "금", "금", "수", "수"]
STEM_YANG = [True, False] * 5
BRANCH_ELEM = ["수", "토", "목", "목", "토", "화", "화", "토", "금", "금", "토", "수"]
# 지지 본기(십성 산출은 用 기준 — 사해오자 체용: 사·해=양, 오·자=음; 운영자 260722 결정)
BRANCH_MAIN = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8]  # 자→계 축→기 인→갑 묘→을 진→무 사→병 오→정 미→기 신→경 유→신 술→무 해→임
# 지장간 (여기·중기·정기 순, 초코 수치표 채택분과 같은 글자)
HIDDEN = {0: [8, 9], 1: [9, 7, 5], 2: [4, 2, 0], 3: [0, 1], 4: [1, 9, 4], 5: [4, 6, 2],
          6: [2, 5, 3], 7: [3, 1, 5], 8: [4, 8, 6], 9: [6, 7], 10: [7, 3, 4], 11: [4, 0, 8]}
POS = ["연", "월", "일", "시"]
STEM_POS_NODE = {"연": "연간", "월": "월간", "일": "일간", "시": "시간(時干)"}
BRANCH_POS_NODE = {"연": "연지", "월": "월지", "일": "일지", "시": "시지"}
PILLAR_NODE = {"연": "연주", "월": "월주", "일": "일주", "시": "시주"}
_POS_CTX = set(STEM_POS_NODE.values()) | set(BRANCH_POS_NODE.values())
# 성별 맥락 — 육친은 성별에 따라 뜻이 갈린다. 성별을 알면 십성 신호의 육친 의미를 그 성별 관점 문단에서 센다.
#   "육친" = 육친 의미(풀이.육친)만 성별 맥락, 나머지는 자리 맥락 그대로 · "추가" = 자리 맥락에 성별을 더함
#   "대체" = 십성은 성별 맥락만 · "없음" = 쓰지 않음
#   «육친»을 쓰는 이유(실측): 성별 관점 문단은 대개 육친 얘기라, 성별 맥락만 쓰면 남녀 모두 편재·정재→재물 배수가
#   1.97→0.87(남)·1.46(여)로 함께 꺼진다(성별 효과가 아니라 문단 고르기 편향). 이론도 성별은 육친만 가른다.
성별맥락 = "육친"
_성노드 = {"M": "성:남", "남": "성:남", "F": "성:여", "여": "성:여"}


def _성별맥락_붙이기(sig, 성별):
    node = _성노드.get(성별)
    if not node or 성별맥락 == "없음":
        return
    for A, v in sig.items():
        if A in _TEN_ALL:
            if 성별맥락 == "육친":
                v["성맥락"] = (node,)
            else:
                v["맥락"] = (tuple(v.get("맥락", ())) + (node,)) if 성별맥락 == "추가" else (node,)

TEN = {  # (관계, 같은 음양?) → 십성
    ("같", True): "비견", ("같", False): "겁재",
    ("생출", True): "식신", ("생출", False): "상관",
    ("극출", True): "편재", ("극출", False): "정재",
    ("극입", True): "편관(칠살)", ("극입", False): "정관",
    ("생입", True): "편인", ("생입", False): "정인",
}
GROUP = {"비견": "비겁 일반", "겁재": "비겁 일반", "식신": "식상 일반", "상관": "식상 일반",
         "편재": "재성 일반", "정재": "재성 일반", "편관(칠살)": "관성 일반", "정관": "관성 일반",
         "편인": "인성 일반", "정인": "인성 일반"}
_TEN_ALL = set(TEN.values()) | set(GROUP.values())
GEN = {"목": "화", "화": "토", "토": "금", "금": "수", "수": "목"}
CTRL = {"목": "토", "토": "수", "수": "화", "화": "금", "금": "목"}


def 관계(me, other):
    if me == other:
        return "같"
    if GEN[me] == other:
        return "생출"
    if CTRL[me] == other:
        return "극출"
    if CTRL[other] == me:
        return "극입"
    return "생입"


def 십성(day_stem, stem):
    return TEN[(관계(STEM_ELEM[day_stem], STEM_ELEM[stem]), STEM_YANG[day_stem] == STEM_YANG[stem])]


_GANJI_RE = re.compile("[" + STEMS + STEM_HANJA + "][" + BRANCHES + BRANCH_HANJA + "]")


def 간지(s):
    """'갑자' 또는 '甲子' → (천간idx, 지지idx). 60갑자에 없는 짝이면 ValueError."""
    s = s.strip()
    a, b = s[0], s[1]
    si = STEMS.index(a) if a in STEMS else STEM_HANJA.index(a)
    bi = BRANCHES.index(b) if b in BRANCHES else BRANCH_HANJA.index(b)
    if si % 2 != bi % 2:
        raise ValueError(f"60갑자에 없는 짝: {s}")
    return si, bi


# ── 결정론 관계 표: 7월 관계 표에서 읽는다(한 벌만 둔다)
def _pairs():
    out = {}
    p = DATA / "relation_edges.jsonl"
    for l in p.read_text(encoding="utf-8").splitlines():
        if not l.strip():
            continue
        e = json.loads(l)
        k = e["kind"]
        if k in ("천간합", "천간충", "육합", "지지충", "삼형", "상형", "파", "해", "원진", "귀문"):
            out.setdefault(k, set()).add(frozenset((e["a"], e["b"])))
    return out


PAIRS = _pairs()
SAMHAP = [({8, 0, 4}, "수"), ({11, 3, 7}, "목"), ({2, 6, 10}, "화"), ({5, 9, 1}, "금")]  # 신자진·해묘미·인오술·사유축
BANGHAP = [({2, 3, 4}, "목"), ({5, 6, 7}, "화"), ({8, 9, 10}, "금"), ({11, 0, 1}, "수")]
WANGJI = {0, 3, 6, 9}
SAENGJI = {2, 5, 8, 11}
GOJI = {1, 4, 7, 10}

# ── 신살 조견표(표준)
CHEONEUL = {0: {1, 7}, 4: {1, 7}, 6: {1, 7}, 1: {0, 8}, 5: {0, 8}, 2: {11, 9}, 3: {11, 9}, 7: {2, 6}, 8: {5, 3}, 9: {5, 3}}
MUNCHANG = {0: 5, 1: 6, 2: 8, 3: 9, 4: 8, 5: 9, 6: 11, 7: 0, 8: 2, 9: 3}
GEONROK = {0: 2, 1: 3, 2: 5, 3: 6, 4: 5, 5: 6, 6: 8, 7: 9, 8: 11, 9: 0}
YANGIN = {0: 3, 2: 6, 4: 6, 6: 9, 8: 0}  # 양간만(판본: 사공은 음간에도 배정)
HONGYEOM = {0: 6, 1: 6, 2: 2, 3: 7, 4: 4, 5: 4, 6: 10, 7: 9, 8: 0, 9: 8}
GEUMYEO = {0: 4, 1: 5, 2: 7, 3: 8, 4: 7, 5: 8, 6: 10, 7: 11, 8: 1, 9: 2}
BAEKHO = {(0, 4), (1, 7), (2, 10), (3, 1), (4, 4), (8, 10), (9, 1)}
GOEGANG = {(6, 4), (6, 10), (8, 4), (8, 10), (4, 10)}
SAMHAP_OF = {b: (g, e) for g, e in SAMHAP for b in g}
DOHWA = {"수": 9, "목": 0, "화": 3, "금": 6}     # 삼합국 → 도화(년살) 지지
YEOKMA = {"수": 2, "목": 5, "화": 8, "금": 11}
HWAGAE = {"수": 4, "목": 7, "화": 10, "금": 1}
HYEONCHIM_STEM = {0, 7}       # 甲 辛
HYEONCHIM_BRANCH = {3, 6, 8}  # 卯 午 申

# 십이운성 장생지(고전 포태법, 화토동법) — 양간 순행, 음간 역행
JANGSAENG = {0: 11, 2: 2, 4: 2, 6: 5, 8: 8, 1: 6, 3: 9, 5: 9, 7: 0, 9: 3}
STAGES = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병·사", "병·사", "묘(입묘)", "절·태·양", "절·태·양", "절·태·양"]
STAGE_RAW = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"]


def 운성(day_stem, branch):
    start = JANGSAENG[day_stem]
    k = (branch - start) % 12 if STEM_YANG[day_stem] else (start - branch) % 12
    return STAGES[k], STAGE_RAW[k]


def 명식_신호(기둥, 성별=None, 강약배점=None):
    """기둥: [연, 월, 일, 시] 간지 문자열(시 미상이면 3개 또는 None). 반환 dict.

    반환:
      글자: [(자리, 천간/지지, 글자idx)]
      신호: {노드: {"자리": [...], "근거": [...], "무게": float}}
    """
    pillars = []
    for i, g in enumerate(기둥):
        if g is None:
            continue
        si, bi = 간지(g)
        pillars.append((POS[i], si, bi))
    if not any(p[0] == "일" for p in pillars):
        raise ValueError("일주가 없다")
    day_stem = next(p[1] for p in pillars if p[0] == "일")
    sig = {}

    def on(node, where, why, w=1.0, 맥락=None):
        """맥락 = 이 신호의 확률을 셀 때 함께 있어야 할 개념(상대 개념). 기본은 자리(월지·일지…)."""
        s = sig.setdefault(node, {"자리": [], "근거": [], "무게": 0.0, "맥락": (), "횟수": 0})
        if where and where not in s["자리"]:
            s["자리"].append(where)
            s["횟수"] += 1          # 다른 자리에서 또 켜졌다 — 고수가 「관이 셋」처럼 세는 몫
        if why not in s["근거"]:
            s["근거"].append(why)
        if w > s["무게"]:
            s["무게"] = w
            s["맥락"] = tuple(맥락) if 맥락 is not None else ((where,) if where in _POS_CTX else ())

    on("일간", "일", f"일간 {STEMS[day_stem]}")
    _d = next(p for p in pillars if p[0] == "일")
    on("간지:" + STEMS[_d[1]] + BRANCHES[_d[2]], "일주", "일주 자체(다른 고수들이 이 일주를 말한 문장)", 1.0)
    on(STEM_NODE[day_stem], "일간", "일간 글자", 1.0)
    elem_cnt = {e: 0.0 for e in ELEM}
    ten_by_pos = {}
    for pos, si, bi in pillars:
        on(PILLAR_NODE[pos], pos, f"{pos}주 {STEMS[si]}{BRANCHES[bi]}", 0.3)
        if pos != "일":
            on(STEM_NODE[si], STEM_POS_NODE[pos], f"{STEM_POS_NODE[pos]} 글자", 0.8)
            t = 십성(day_stem, si)
            ten_by_pos[STEM_POS_NODE[pos]] = t
            on(t, STEM_POS_NODE[pos], f"{STEM_POS_NODE[pos]} {STEMS[si]} = {t}", 0.8)
            on(GROUP[t], STEM_POS_NODE[pos], f"{STEM_POS_NODE[pos]} {t}", 0.6)
        on(BRANCH_NODE[bi], BRANCH_POS_NODE[pos], f"{BRANCH_POS_NODE[pos]} 글자", 1.0 if pos in "월일" else 0.8)
        t = 십성(day_stem, BRANCH_MAIN[bi])
        ten_by_pos[BRANCH_POS_NODE[pos]] = t
        on(t, BRANCH_POS_NODE[pos], f"{BRANCH_POS_NODE[pos]} {BRANCHES[bi]} 본기 = {t}", 1.0 if pos in "월일" else 0.8)
        on(GROUP[t], BRANCH_POS_NODE[pos], f"{BRANCH_POS_NODE[pos]} {t}", 0.6)
        elem_cnt[STEM_ELEM[si]] += 1
        elem_cnt[BRANCH_ELEM[bi]] += 1
        # 간여지동
        if STEM_ELEM[si] == BRANCH_ELEM[bi]:
            on("간여지동", PILLAR_NODE[pos], f"{pos}주 {STEMS[si]}{BRANCHES[bi]} 천간·지지 같은 오행", 0.7)
        # 십이운성(일간 기준)
        st, raw = 운성(day_stem, bi)
        on(st, BRANCH_POS_NODE[pos], f"{BRANCH_POS_NODE[pos]} {BRANCHES[bi]} = {raw}", 0.5 if pos != "일" else 0.7)
        # 지장간 십성(숨은 글자)
        for h in HIDDEN[bi][:-1]:
            th = 십성(day_stem, h)
            on(GROUP[th], BRANCH_POS_NODE[pos], f"{BRANCH_POS_NODE[pos]} 지장간 {STEMS[h]} = {th}", 0.25)
    full = len(pillars) >= 3   # 강약·과다·결핍은 명식 대부분이 있어야 뜻이 있다(일주만으로는 계산하지 않는다)
    # 오행
    for e, c in elem_cnt.items():
        if c > 0:
            on(ELEM_NODE[e], None, f"{e} {int(c)}개", min(1.0, 0.3 + 0.15 * c))
    n_chars = 2 * len(pillars)
    for e, c in elem_cnt.items():
        if not full:
            break
        if c >= 4 or (n_chars <= 6 and c >= 3):
            on("과다·태과", None, f"{e} {int(c)}개", 0.9, (ELEM_NODE[e],))
        if c == 0:
            on("고립·불급", None, f"{e} 없음", 0.8, (ELEM_NODE[e],))
    # 십성 그룹 개수 (천간 + 지지 본기, 일간 제외)
    grp_cnt = {}
    for p, t in ten_by_pos.items():
        grp_cnt[GROUP[t]] = grp_cnt.get(GROUP[t], 0) + 1
    for g, c in grp_cnt.items():
        if c >= 3 and full:
            on("과다·태과", None, f"{g} {c}개", 0.8, (g,))
    # 통근·투간
    day_e = STEM_ELEM[day_stem]
    roots = [BRANCH_POS_NODE[pos] for pos, si, bi in pillars if any(STEM_ELEM[h] == day_e for h in HIDDEN[bi])]
    if roots:
        on("통근", None, "일간 뿌리: " + "·".join(roots), 0.7)
    stems_present = {si for pos, si, bi in pillars}
    for pos, si, bi in pillars:
        for h in HIDDEN[bi]:
            if h in stems_present and not (pos == "일" and h == day_stem and False):
                on("투간·투출", BRANCH_POS_NODE[pos], f"{BRANCH_POS_NODE[pos]} 지장간 {STEMS[h]} 천간에 드러남", 0.5)
    # 강약(110점제 — 판정절차.jsonl 갈림판본: 연지10·월지30·일지15·시지15, 천간 각 10)
    wt = 강약배점 or {"연지": 10, "월지": 30, "일지": 15, "시지": 15}
    score, maxs = 10, 10   # 일간 자신
    for pos, si, bi in pillars:
        if pos != "일":
            maxs += 10
            if GROUP[십성(day_stem, si)] in ("비겁 일반", "인성 일반"):
                score += 10
        key = BRANCH_POS_NODE[pos]
        maxs += wt[key]
        if GROUP[십성(day_stem, BRANCH_MAIN[bi])] in ("비겁 일반", "인성 일반"):
            score += wt[key]
    ratio = score / maxs
    label = "극신강" if ratio >= 85 / 110 else "신강" if ratio >= 60 / 110 else "중화" if ratio >= 30 / 110 else "신약" if ratio >= 15 / 110 else "극신약"
    if not full:
        label = "미상"
    else:
        on("점수론(110점)", None, f"{score}/{maxs}점", 0.4)
    if label == "미상":
        pass
    elif label in ("극신강", "신강"):
        on("신강", None, f"{label} {score}/{maxs}", 0.9)
        if label == "극신강":
            on("극신강", None, f"{score}/{maxs}", 0.9)
    elif label in ("극신약", "신약"):
        on("신약", None, f"{label} {score}/{maxs}", 0.9)
        if label == "극신약":
            on("극신약", None, f"{score}/{maxs}", 0.9)
    else:
        on("중화", None, f"{score}/{maxs}", 0.7)
    month = next((p for p in pillars if p[0] == "월"), None)
    helpg = ("비겁 일반", "인성 일반")
    if month and full and GROUP[십성(day_stem, BRANCH_MAIN[month[2]])] in helpg:
        on("득령·득지·득세", "월지", "월지 본기가 비겁·인성(득령)", 0.6)
    # 합충형파해·원진·귀문
    bpos = [(BRANCH_POS_NODE[pos], bi) for pos, si, bi in pillars]
    spos = [(STEM_POS_NODE[pos], si) for pos, si, bi in pillars]
    rel_node = {"천간합": "천간합", "천간충": "천간충", "육합": "육합", "지지충": "지지충", "삼형": "삼형",
                "상형": "삼형", "파": "파", "해": "해", "원진": "원진", "귀문": "귀문"}
    for i in range(len(spos)):
        for j in range(i + 1, len(spos)):
            pr = frozenset((STEM_NODE[spos[i][1]], STEM_NODE[spos[j][1]]))
            for k in ("천간합", "천간충"):
                if pr in PAIRS.get(k, ()):
                    w = 0.9 if abs(i - j) == 1 else 0.6
                    on(rel_node[k], f"{spos[i][0]}·{spos[j][0]}", f"{spos[i][0]}{STEMS[spos[i][1]]}–{spos[j][0]}{STEMS[spos[j][1]]} {k}", w,
                       (STEM_NODE[spos[i][1]], STEM_NODE[spos[j][1]]))
    for i in range(len(bpos)):
        for j in range(i + 1, len(bpos)):
            a, b = bpos[i][1], bpos[j][1]
            pr = frozenset((BRANCH_NODE[a], BRANCH_NODE[b]))
            adj = abs(i - j) == 1
            for k in ("육합", "지지충", "삼형", "상형", "파", "해", "원진", "귀문"):
                if pr in PAIRS.get(k, ()):
                    w = (0.9 if adj else 0.6) if k in ("육합", "지지충") else (0.7 if adj else 0.5)
                    if k == "삼형":
                        w = 0.35   # 두 글자뿐인 반쪽 삼형 — 세 글자가 다 있으면 아래에서 올린다
                    on(rel_node[k], f"{bpos[i][0]}·{bpos[j][0]}", f"{bpos[i][0]}{BRANCHES[a]}–{bpos[j][0]}{BRANCHES[b]} {k}", w,
                       (BRANCH_NODE[a], BRANCH_NODE[b]))
            if a == b and a in (4, 6, 9, 11):
                on("자형", f"{bpos[i][0]}·{bpos[j][0]}", f"{BRANCHES[a]}{BRANCHES[b]} 자형", 0.6)
            if a == b:
                on("병존", f"{bpos[i][0]}·{bpos[j][0]}", f"{BRANCHES[a]} 두 번", 0.5)
    for i in range(len(spos)):
        for j in range(i + 1, len(spos)):
            if spos[i][1] == spos[j][1]:
                on("병존", f"{spos[i][0]}·{spos[j][0]}", f"{STEMS[spos[i][1]]} 두 번", 0.5)
    bset = {bi for _, bi in bpos}
    for trio in ({2, 5, 8}, {1, 10, 7}):   # 인사신·축술미
        if trio <= bset:
            on("삼형", None, f"{''.join(BRANCHES[x] for x in sorted(trio))} 삼형 완성", 0.9)
    for g, e in SAMHAP:
        inter = g & bset
        if len(inter) == 3:
            on("삼합", None, f"{''.join(BRANCHES[x] for x in sorted(g))} 삼합 {e}국", 1.0)
        elif len(inter) == 2 and inter & WANGJI:
            on("반합", None, f"{''.join(BRANCHES[x] for x in sorted(inter))} 반합({e})", 0.6)
    for g, e in BANGHAP:
        if g <= bset:
            on("방합", None, f"{''.join(BRANCHES[x] for x in sorted(g))} 방합 {e}", 0.9)
    # 지지 성질(생지·왕지·고지)
    for name, s in (("생지(역마)", SAENGJI), ("왕지(도화)", WANGJI), ("고지(화개)", GOJI)):
        n = len([1 for _, bi in bpos if bi in s])
        if n >= 2:
            on(name, None, f"{name} {n}개", 0.4)
    # 일지 자체의 성질 — 일주론은 일지를 생지=역마·왕지=도화·고지=화개로 부른다
    #   (예: 남석 「병오일주, 겁재도화」·「병신일주, 편재역마」·「병술일주, 식신화개」). 판본: 다른 지지와의 삼합 기준과 별개.
    _dbi = next(bi for pos, si, bi in pillars if pos == "일")
    for name, s, star in (("생지(역마)", SAENGJI, "역마"), ("왕지(도화)", WANGJI, "도화"), ("고지(화개)", GOJI, "화개")):
        if _dbi in s:
            on(name, "일지", f"일지 {BRANCHES[_dbi]} = {name}", 0.7)
            on(star, "일지", f"일지 {BRANCHES[_dbi]} 자체가 {star} 자리(일주론 관례)", 0.5)
    # 신살(일간 기준)
    for p, bi in bpos:
        if bi in CHEONEUL[day_stem]:
            on("천을귀인", p, f"{p} {BRANCHES[bi]} (일간 {STEMS[day_stem]})", 0.7)
        if bi == MUNCHANG[day_stem]:
            on("문창·문곡", p, f"{p} {BRANCHES[bi]}", 0.5)
        if bi == GEONROK[day_stem]:
            on("건록", p, f"{p} {BRANCHES[bi]} 건록", 0.6)
        if YANGIN.get(day_stem) == bi:
            on("양인", p, f"{p} {BRANCHES[bi]} 양인", 0.7)
        if bi == HONGYEOM[day_stem]:
            on("홍염", p, f"{p} {BRANCHES[bi]} 홍염", 0.6)
        if bi == GEUMYEO[day_stem]:
            on("금여", p, f"{p} {BRANCHES[bi]}", 0.4)
    # 신살(연지·일지 삼합 기준 — 판본: 고전 연지 / 현대 일지, 둘 다 본다)
    bases = [(BRANCH_POS_NODE[pos], bi) for pos, si, bi in pillars if pos in ("연", "일")]
    for basep, bb in bases:
        e = SAMHAP_OF[bb][1]
        for p, bi in bpos:
            if p == basep:
                continue
            if bi == DOHWA[e]:
                on("도화", p, f"{basep} 기준 {p} {BRANCHES[bi]} 도화", 0.6)
            if bi == YEOKMA[e]:
                on("역마", p, f"{basep} 기준 {p} {BRANCHES[bi]} 역마", 0.6)
            if bi == HWAGAE[e]:
                on("화개", p, f"{basep} 기준 {p} {BRANCHES[bi]} 화개", 0.5)
    for pos, si, bi in pillars:
        if (si, bi) in BAEKHO:
            on("백호", PILLAR_NODE[pos], f"{pos}주 {STEMS[si]}{BRANCHES[bi]} 백호", 0.8 if pos == "일" else 0.6)
        if (si, bi) in GOEGANG and pos == "일":
            on("괴강", "일주", f"일주 {STEMS[si]}{BRANCHES[bi]} 괴강", 0.8)
    hc = sum(1 for pos, si, bi in pillars if si in HYEONCHIM_STEM) + sum(1 for pos, si, bi in pillars if bi in HYEONCHIM_BRANCH)
    if hc >= 2:
        on("현침살", None, f"현침 글자 {hc}개", 0.4)
    # 공망(일주 기준 — 운영자 결정: 기본 OFF, 무게를 낮게)
    dsi, dbi = next((si, bi) for pos, si, bi in pillars if pos == "일")
    xun_start = (dbi - dsi) % 12
    gm = {(xun_start + 10) % 12, (xun_start + 11) % 12}
    for p, bi in bpos:
        if bi in gm and p != "일지":
            on("공망", p, f"{p} {BRANCHES[bi]} 공망(일주 기준)", 0.3)
    # 십성 조합 공식 — 공존 규칙(구현 가정: 두 십성 무리가 함께 있으면 후보로만 켠다)
    g = set(grp_cnt)
    combos = [("식상생재", {"식상 일반", "재성 일반"}), ("관인상생", {"관성 일반", "인성 일반"}),
              ("살인상생", None), ("상관견관", None), ("탐재괴인", {"재성 일반", "인성 일반"}),
              ("군겁쟁재", None), ("재다신약", None), ("제살·합살", None)]
    tens = set(ten_by_pos.values())
    for name, need in combos:
        ok = False
        if need:
            ok = need <= g
        elif name == "살인상생":
            ok = "편관(칠살)" in tens and "인성 일반" in g
        elif name == "상관견관":
            ok = "상관" in tens and "정관" in tens
        elif name == "군겁쟁재":
            ok = grp_cnt.get("비겁 일반", 0) >= 2 and "재성 일반" in g
        elif name == "재다신약":
            ok = grp_cnt.get("재성 일반", 0) >= 3 and label in ("신약", "극신약")
        elif name == "제살·합살":
            ok = "편관(칠살)" in tens and "식상 일반" in g
        if ok:
            on(name, None, "공존(구현 가정)", 0.35)
    # 육친(입력 성별 — 여명 관성=배우자, 남명 재성=배우자)
    if 성별 in ("F", "여"):
        if "관성 일반" in g:
            on("배우자", None, "여명 관성", 0.3)
    elif 성별 in ("M", "남"):
        if "재성 일반" in g:
            on("배우자", None, "남명 재성", 0.3)
    _성별맥락_붙이기(sig, 성별)
    return {"일간": STEMS[day_stem], "강약": label, "점수": f"{score}/{maxs}",
            "글자": [(pos, STEMS[si] + BRANCHES[bi]) for pos, si, bi in pillars], "신호": sig}


def 운_신호(기둥, 운간지, 종류="대운", 성별=None):
    """원국 기둥 + 운의 간지(대운·세운) → 운이 켜는 개념. 원국 신호와 같은 노드 이름을 쓴다.

    운의 글자는 원국에 «들어오는» 글자다. 그래서
      · 운 천간·지지의 십성(일간 기준) · 십이운성(일간이 운 지지에서)
      · 운 지지 ↔ 원국 지지 / 운 천간 ↔ 원국 천간의 합·충·형·파·해·원진·귀문, 원국 두 글자와 삼합 완성
      · 운 지지가 원국 기준으로 도화·역마·화개·천을귀인·양인인가
    를 켠다. 무게는 일지·월지와 얽힐수록 크게 둔다(구현 가정).
    """
    pillars = []
    for i, g in enumerate(기둥):
        if g is None:
            continue
        si, bi = 간지(g)
        pillars.append((POS[i], si, bi))
    day_stem = next(p[1] for p in pillars if p[0] == "일")
    us, ub = 간지(운간지)
    sig = {}

    def on(node, where, why, w, 맥락=()):
        s = sig.setdefault(node, {"자리": [], "근거": [], "무게": 0.0, "맥락": ()})
        if where and where not in s["자리"]:
            s["자리"].append(where)
        if why not in s["근거"]:
            s["근거"].append(why)
        if w > s["무게"]:
            s["무게"] = w
            s["맥락"] = tuple(맥락)

    tag = f"{종류} {STEMS[us]}{BRANCHES[ub]}"
    t = 십성(day_stem, us)
    on(t, 종류, f"{tag}: 천간 {STEMS[us]} = {t}", 0.9)
    on(GROUP[t], 종류, f"{tag}: 천간 {t}", 0.6)
    t2 = 십성(day_stem, BRANCH_MAIN[ub])
    on(t2, 종류, f"{tag}: 지지 {BRANCHES[ub]} 본기 = {t2}", 0.9)
    on(GROUP[t2], 종류, f"{tag}: 지지 {t2}", 0.6)
    on(STEM_NODE[us], 종류, f"{tag}: 천간 글자", 0.5)
    on(BRANCH_NODE[ub], 종류, f"{tag}: 지지 글자", 0.6)
    st, raw = 운성(day_stem, ub)
    on(st, 종류, f"{tag}: 일간이 {BRANCHES[ub]}에서 {raw}", 0.6)
    for pos, si, bi in pillars:
        sp, bp = STEM_POS_NODE[pos], BRANCH_POS_NODE[pos]
        core = pos in ("일", "월")
        pr = frozenset((STEM_NODE[us], STEM_NODE[si]))
        for k in ("천간합", "천간충"):
            if pr in PAIRS.get(k, ()):
                on(k, sp, f"{tag}: 천간 {STEMS[us]}–{sp} {STEMS[si]} {k}", 0.9 if pos == "일" else 0.6, (STEM_NODE[us], STEM_NODE[si]))
        pr = frozenset((BRANCH_NODE[ub], BRANCH_NODE[bi]))
        for k in ("육합", "지지충", "삼형", "상형", "파", "해", "원진", "귀문"):
            if pr in PAIRS.get(k, ()):
                node = "삼형" if k == "상형" else k
                w = (0.9 if core else 0.6) if k in ("육합", "지지충") else (0.6 if core else 0.4)
                on(node, bp, f"{tag}: 지지 {BRANCHES[ub]}–{bp} {BRANCHES[bi]} {k}", w, (BRANCH_NODE[ub], BRANCH_NODE[bi]))
        if ub == bi and ub in (4, 6, 9, 11):
            on("자형", bp, f"{tag}: {BRANCHES[ub]}{BRANCHES[bi]} 자형", 0.5)
    bset = {bi for _, _, bi in pillars}
    for trio in ({2, 5, 8}, {1, 10, 7}):   # 인사신·축술미 — 운 글자가 원국 두 글자와 삼형을 완성
        if ub in trio and (trio - {ub}) <= bset:
            on("삼형", 종류, f"{tag}: 원국과 {''.join(BRANCHES[x] for x in sorted(trio))} 삼형 완성", 0.9)
    for g, e in SAMHAP:
        if ub in g and len((bset - {ub}) & g) == 2:
            on("삼합", 종류, f"{tag}: 원국과 {''.join(BRANCHES[x] for x in sorted(g))} 삼합 {e}국", 0.8)
        elif ub in g and len((bset - {ub}) & g) == 1 and ({ub} | (bset & g)) & WANGJI:
            on("반합", 종류, f"{tag}: 원국과 반합({e})", 0.4)
    if ub in CHEONEUL[day_stem]:
        on("천을귀인", 종류, f"{tag}: {BRANCHES[ub]} 천을귀인", 0.6)
    if YANGIN.get(day_stem) == ub:
        on("양인", 종류, f"{tag}: {BRANCHES[ub]} 양인", 0.6)
    if ub == GEONROK[day_stem]:
        on("건록", 종류, f"{tag}: {BRANCHES[ub]} 건록", 0.5)
    for pos, si, bi in pillars:
        if pos not in ("연", "일"):
            continue
        e = SAMHAP_OF[bi][1]
        for name, tbl in (("도화", DOHWA), ("역마", YEOKMA), ("화개", HWAGAE)):
            if ub == tbl[e]:
                on(name, 종류, f"{tag}: {BRANCH_POS_NODE[pos]} 기준 {BRANCHES[ub]} {name}", 0.6)
    if (us, ub) in BAEKHO:
        on("백호", 종류, f"{tag}: 백호 간지", 0.5)
    _성별맥락_붙이기(sig, 성별)
    return sig


if __name__ == "__main__":
    import sys
    args = sys.argv[1:] or ["경신", "무인", "갑인", "병인"]
    args = [None if a in ("-", "?") else a for a in args]
    r = 명식_신호(args)
    print(r["일간"], r["강약"], r["점수"], r["글자"])
    for k, v in sorted(r["신호"].items(), key=lambda x: -x[1]["무게"]):
        print(f"  {v['무게']:.2f} {k:10s} {'·'.join(v['자리'])}  {' / '.join(v['근거'][:3])}")
