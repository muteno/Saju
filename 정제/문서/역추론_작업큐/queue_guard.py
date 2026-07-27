# -*- coding: utf-8 -*-
"""역추론 작업 큐 게이트 — 문단 단위 (운영자 보드 1-21)

v1(post 단위 전량 차단)은 폐기됐다. 이유: 인사이트와 정답은 분리 가능하다.
  · 금지되는 것 = **정답·적중이 축자로 노출된 문단 18개**의 quote를 유닛 근거로 인용하는 것
  · 허용되는 것 = 같은 post의 절차·방법론·교훈 문단 전부 (인사이트 추출 대상)

왜 모듈인가: 이 프로젝트 사고는 100% "조용한 오작동"이었고 별칭 검증기는
"검사는 했는데 아무것도 안 막는" 상태였다. 그래서 경고가 아니라 exit 1로 죽는다.

사용법:
    from queue_guard import assert_citable, exam_mask, Q_INSIGHT, Q_EXAM
    assert_citable("DT-P235-08")        # → SystemExit (정답 공개 문단)
    assert_citable("DT-P235-04")        # → 통과 (루트 질문 1비트 = 인사이트)
    mask = exam_mask("DT-P235")         # 문항 제작 시 가릴 문단 좌표

    # 인용 자격(260725 3차 평의회) — 유닛 게이트 루프에서
    fail += assert_quotable(u, context=u["unit_id"])
    quotable_report()                   # 전량 출력 후 불합격 있으면 exit 1
"""
import json
import os
import re
import sys
import unicodedata

_HERE = os.path.dirname(os.path.abspath(__file__))
_Q = json.load(open(os.path.join(_HERE, "queue_역추론.json"), encoding="utf-8"))

BANNED_PARAS = frozenset(_Q["정답_적중공개_문단_전량"])
Q_INSIGHT = {i["post_id"]: i for i in _Q["Q_인사이트"]["items"]}
Q_EXAM = {i["post_id"]: i for i in _Q["Q_기출문제"]["items"]}
AS_OF = _Q["as_of"]


def is_citable(para_id):
    """이 문단의 축자를 유닛 근거로 쓸 수 있는가."""
    return para_id not in BANNED_PARAS


def assert_citable(para_id, context=""):
    if para_id in BANNED_PARAS:
        pid = para_id.rsplit("-", 1)[0]
        sys.stderr.write(
            f"\n[정답 유출] {para_id} 는 역추론 정답·적중이 축자로 드러난 문단이다.\n"
            f"  이 문단의 quote를 유닛 근거로 쓰면 P4 채점이 무의미해진다.\n"
            f"  대신 같은 post({pid})의 절차·방법론 문단에서 뽑아라 — 인사이트는 정답 없이 성립한다.\n"
            f"  뽑을 인사이트: {Q_INSIGHT.get(pid, {}).get('뽑을_인사이트', '(미지정)')}\n"
            f"  위치: {context or '(미기재)'}\n"
        )
        raise SystemExit(1)


# ══════════════════════════════════════════════════════════════════════════
#  인용 자격 게이트 — 판정 정의 D5 (260725 3차 평의회 확정 · 코드 상수로 박음)
# ══════════════════════════════════════════════════════════════════════════
# 무엇을 막는가:
#   유닛이 개념에 붙인 횡단 링크는 "저자가 이렇게 말했다"는 이름표다. 그런데
#   파일럿 12유닛의 횡단 링크 68건 중 26건(38.2%)은 그 개념어가 저자 축자
#   (`근거[].quote`)에 아예 없었다. 우리 요약문에만 있는 말을 저자 이름으로
#   붙인 것이다. 이 게이트가 그것을 막는다.
#
# ⚠정의를 고정하지 않으면 같은 68링크가 20·26·29·32·40·46·52로 갈린다(실측).
#   그래서 판정을 상수로 박는다. 이 상수를 손대는 것은 판정을 바꾸는 것이고,
#   판정을 바꾸면 26이라는 숫자가 무의미해진다. 고칠 때는 왜 고쳤는지 남길 것.
#
# D5 = 개념 c 의 다음 셋 중 하나가, 유닛의 `오전사` 사전으로 치환한 뒤의
#      `근거[].quote` 합본에 **부분문자열로 존재**하면 합격
#        ① 정본명 그대로
#        ② 괄호·구분자 분해형 + 한자 토막
#        ③ 판정이 '안전'인 TAXONOMY 별칭 (_현황판\data\별칭_판정.json)
#
# ⛔대조 텍스트에 `chain`을 넣지 마라. 넣으면 불합격이 26→20으로 줄지만 chain은
#   **우리가 쓴 요약문이지 저자의 말이 아니다** — 우리 이름표로 우리 이름표를
#   검증하는 자기참조가 된다.
# ⚠오전사 치환은 필수다. 축자가 `일관`(→일간)·`가녀지동`(→간여지동)·`감목`(→갑목)
#   이라 표면형이 안 맞았던 링크가 6건 있다(D3 32건 → D5 26건, 실측 차이).
D5_ID = "D5(안전별칭+오전사 · 대조=quote 합본)"
D5_대조텍스트 = "근거[].quote 합본"          # ⛔chain 금지
D5_별칭판정 = "안전"                          # 별칭_판정.json 의 verdict
D5_분해구분자 = re.compile(r"[()·\[\]/,、]")
D5_한자런 = re.compile("[一-鿿]+")   # CJK 통합한자
D5_최소토막 = 2                               # 분해 토막은 2글자 이상만 인정

_ALIAS_JSON = os.path.normpath(
    os.path.join(_HERE, os.pardir, "_현황판", "data", "별칭_판정.json"))

# 롤업 노드 면제 — 저자가 입에 담을 리 없는 **우리 분류 라벨**이다.
#   ("인성 일반"이라고 말하는 저자는 없다. "인성"이라고 말한다.)
#   유닛 68링크가 닿는 롤업성 노드는 아래 6종 7링크이고, D5 불합격은 `궁위·자리론`
#   1건뿐이다. 면제분도 **목록에는 남긴다**(숨기지 않는다).
ROLLUP_면제 = frozenset({
    "비겁 일반", "식상 일반", "재성 일반", "관성 일반", "인성 일반", "궁위·자리론",
})

QUOTABLE_MISSES = []   # [{"unit_id","concept","면제","사유"}] — 전량 기록(면제 포함)
_C2A = None            # 개념 → 안전 별칭 집합 (지연 로딩)


def _nfc(s):
    return unicodedata.normalize("NFC", s or "")


def _safe_alias_map():
    """개념 → '안전' 판정 별칭 집합.

    ⚠별칭_판정.json 하나만 읽는다. build_neuron_map/build_concept_map 은
      import 하지 않는다(개념망 담당이 동시에 고치는 파일이라 결합하면 안 된다).
      실측 대조: json 의 alias→concepts 매핑은 build_neuron_map.alias2concept
      658건과 **완전 일치**(누락 0·불일치 0)이므로 대체 가능하다.
    """
    global _C2A
    if _C2A is not None:
        return _C2A
    with open(_ALIAS_JSON, encoding="utf-8") as f:
        rows = json.load(f)["aliases"]
    if isinstance(rows, dict):                       # 구 스키마 방어
        rows = [dict(v, alias=k) for k, v in rows.items()]
    m = {}
    for x in rows:
        if x.get("verdict") != D5_별칭판정:
            continue
        for c in x.get("concepts", []):
            m.setdefault(c, set()).add(_nfc(x.get("alias", "")))
    if not m:
        sys.stderr.write(f"\n[인용자격] 안전 별칭이 0개다 — {_ALIAS_JSON} 확인.\n"
                         f"  사전을 못 읽고 통과시키면 게이트가 있으나 마나다.\n")
        raise SystemExit(1)
    _C2A = m
    return m


def quotable_forms(concept):
    """개념 c 가 저자 축자에 나타날 수 있는 **허용 표면형 전체**(D5 ①②③)."""
    out = {_nfc(concept)}
    for p in D5_분해구분자.split(concept):            # ② 괄호·구분자 분해형
        p = p.strip()
        if len(p) >= D5_최소토막:
            out.add(_nfc(p))
    for m in D5_한자런.finditer(concept):             # ② 한자 토막
        out.add(_nfc(m.group()))
    out |= _safe_alias_map().get(concept, set())      # ③ 안전 별칭
    return {x for x in out if x}


def quote_base(unit):
    """대조 텍스트 = `근거[].quote` 합본을 유닛 `오전사` 사전으로 치환한 것."""
    base = " \n ".join(_nfc(e.get("quote", "")) for e in unit.get("근거", []))
    for wrong, right in (unit.get("오전사") or {}).items():
        base = base.replace(_nfc(wrong), _nfc(right))
    return base


def is_quotable(concept, unit):
    """개념 c 를 이 유닛의 저자 축자로 뒷받침할 수 있는가(D5)."""
    base = quote_base(unit)
    return any(f in base for f in quotable_forms(concept))


def assert_quotable(unit, context=""):
    """유닛의 **횡단 링크 전량**에 인용 자격(D5)을 건다.

    반환 = 차단 대상 실패 메시지 리스트(롤업 면제분은 제외).
      빌더의 `fail` 에 더하면 기존 `if fail: sys.exit(1)` 이 죽인다.
    ⚠일부러 즉시 죽이지 않는다 — 즉시 죽이면 26건 중 1건만 보이고,
      고치고 다시 돌리기를 26번 반복해야 한다. 대신 `quotable_report()` 가
      전량을 출력한 뒤 죽인다(호출을 빼먹어도 거기서 죽는다).
    """
    uid = context or unit.get("unit_id", "?")
    blocking = []
    base = quote_base(unit)
    for lk in unit.get("links", {}).get("횡단", []):
        to = lk.get("to", "")
        if not to.startswith("개념:"):
            continue                                  # 유닛↔유닛 링크는 대상 아님
        c = to.split("개념:", 1)[1]
        forms = quotable_forms(c)
        if any(f in base for f in forms):
            continue
        면제 = c in ROLLUP_면제
        QUOTABLE_MISSES.append({
            "unit_id": uid, "concept": c, "면제": 면제,
            "사유": "롤업 노드(우리 분류 라벨)" if 면제 else "저자 축자에 없음",
            "표면형수": len(forms),
        })
        if not 면제:
            blocking.append(
                f"{uid}: 인용 자격 미달 — 개념 '{c}'가 저자 축자에 없다 "
                f"[{D5_ID}] · 시도한 표면형 {len(forms)}종: "
                f"{' / '.join(sorted(forms)[:6])}")
    return blocking


def quotable_report(die=True):
    """수집된 인용 자격 불합격 **전량**을 출력한다(면제분 포함).

    ①실패는 실패라고 보고한다 ②면제는 면제라고 표시하고 숨기지 않는다
    ③차단 대상이 1건이라도 있으면 exit 1.
    """
    n_all = len(QUOTABLE_MISSES)
    n_block = sum(1 for m in QUOTABLE_MISSES if not m["면제"])
    print(f"\n[인용 자격 {D5_ID}] 대조={D5_대조텍스트} · "
          f"불합격 {n_all}건 (차단 {n_block} · 롤업면제 {n_all - n_block})")
    for i, m in enumerate(QUOTABLE_MISSES, 1):
        mark = "면제" if m["면제"] else " ✗ "
        print(f"  {i:2d}. [{mark}] {m['unit_id']:<9} 개념:{m['concept']}   ({m['사유']})")
    if die and n_block:
        # ⚠stdout으로 낸다. 빌더는 stdout만 utf-8로 감싸므로 stderr에 한글을 쓰면
        #   윈도우 콘솔에서 mojibake가 되어 **정작 실패 사유를 못 읽는다**(실측).
        print(f"\n[인용 자격] 차단 {n_block}건 — 저자가 한 적 없는 말에 저자 이름표를 붙였다.\n"
              f"  고치는 방향은 둘 중 하나다:\n"
              f"   ① 그 개념을 실제로 말한 문단을 찾아 `근거`에 축자로 추가한다\n"
              f"   ② 근거가 없으면 그 횡단 링크를 **뺀다**\n"
              f"  ⛔판정(D5)을 낮춰서 통과시키지 마라. 통과하려고 기준을 낮추는 것과\n"
              f"    더 정확히 재려고 바꾸는 것은 다르다.")
        raise SystemExit(1)
    return n_all


def exam_mask(post_id):
    """P4 문항 제작 시 가릴 문단 = 도사 추론 발화 + 정답 공개부 (보드 1-17).
    ⚠현재는 정답 공개부만 좌표가 확정돼 있다. 도사 추론 발화 분리는
      화자 분리 태깅(Q_기출문제의 미착수 항목)이 끝나야 정확해진다."""
    it = Q_EXAM.get(post_id)
    if not it:
        return None
    return {"정답공개": it["정답_적중공개_문단"],
            "역추론문단_전량": it["역추론문단"],
            "문항적격": it["문항적격"],
            "부적격사유": it["부적격사유"],
            "주의": "도사 추론 발화 마스킹은 화자 분리 태깅 후에만 정확하다"}


if __name__ == "__main__":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    print(f"as_of {AS_OF}")
    print(f"Q_인사이트 {len(Q_INSIGHT)}편 · Q_기출문제 {len(Q_EXAM)}편"
          f"(적격 {sum(1 for v in Q_EXAM.values() if v['문항적격'])})")
    print(f"인용 금지 문단 {len(BANNED_PARAS)}개")
    assert is_citable("DT-P235-04"), "절차 문단은 인용 가능해야 한다"
    assert not is_citable("DT-P235-08"), "정답 문단은 차단돼야 한다"
    print("자체점검 통과 — 절차 문단 통과 / 정답 문단 차단")

    # ── 인용 자격 자체점검 (D5) ──────────────────────────────────────────
    _am = _safe_alias_map()
    print(f"\n안전 별칭 {sum(len(v) for v in _am.values())}개 / 개념 {len(_am)}종 "
          f"— {os.path.basename(_ALIAS_JSON)}")
    _u = {"unit_id": "SELFTEST",
          "오전사": {"일관": "일간"},
          "근거": [{"quote": "일관이 신강하면"}],
          "links": {"횡단": [{"to": "개념:일간"},          # 오전사 치환으로 합격
                            {"to": "개념:탐재괴인"},        # 축자에 없음 → 차단
                            {"to": "개념:궁위·자리론"},     # 롤업 → 면제
                            {"to": "UI-0001"}]}}           # 유닛 링크 → 대상 아님
    _b = assert_quotable(_u)
    assert len(_b) == 1 and "탐재괴인" in _b[0], f"차단 1건이어야 한다: {_b}"
    assert len(QUOTABLE_MISSES) == 2, f"기록은 면제 포함 2건: {QUOTABLE_MISSES}"
    assert is_quotable("일간", _u), "오전사 치환(일관→일간)이 작동해야 한다"
    assert not is_quotable("탐재괴인", _u), "축자에 없는 개념은 불합격이어야 한다"
    QUOTABLE_MISSES.clear()
    print("자체점검 통과 — 오전사 치환 O / 미인용 개념 차단 O / 롤업 면제 O")
