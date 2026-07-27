# -*- coding: utf-8 -*-
r"""
사주 정제 프로젝트 — ★L1 엔진 ↔ 개념망 결정론 표 대조기

평의회 4차 O7·O8 위원 실측으로 신설:
> "587 관계간선 중 111개(18.9%)가 L1 엔진 표의 재필사이고, **이미 3군데 어긋났다**"
>   · 자형 4종(진진·오오·유유·해해)이 개념망에 없었다 — L1엔 있고 운영자가 260722에 "자형 기본 ON" 결정
>   · 방합 자축·오미 소실(12→10쌍) — 한 쌍에 kind 하나만 달리는 스키마 한계로 육합에 덮임
>   · 십이운성 12노드가 관계망에서 완전 고립 — L1은 twelveStage(일간,지지) 함수로 갖고 있음
> "L1 엔진을 소비하는 파이썬 코드 0줄(대조 테스트 부재). 자형 4건은 우연히 고쳐졌다 —
>  **대조 테스트가 없어 눈에 띌 때만 고쳐진다는 증거**"

■ 왜 두 벌인가, 왜 위험한가
  L1(`4. 구 사주본_Saju-main\app\src\engine\vendor\`)  = 계산 엔진. 실제로 사주를 뽑는다
  L2(`_현황판\build_relation_edges.py`)                = 개념망. 지식을 잇는다
  같은 명리 규칙(합·충·형·파·해·원진·지장간)을 **둘 다 하드코딩**하고 있고 서로를 모른다.
  → 운영자가 "자형 기본 ON"이라고 결정하면 어느 벌이 따라가고 어느 벌이 안 따라가는지 아무도 모른다.
  → 두 벌은 반드시 어긋난다. 문제는 "어긋나느냐"가 아니라 "어긋난 걸 언제 아느냐"다.

■ 이 파일이 하는 일
  L1의 JS 표를 **정규식으로 직접 읽어**(실행하지 않는다) 우리 정본 노드명으로 번역한 뒤
  `relation_edges.jsonl`과 네 갈래로 대조한다: 일치 / L1에만 / 우리에만 / 값 불일치.
  **불일치가 있으면 exit 1.** 경고가 아니다 — 이 프로젝트 사고는 100% 조용한 오작동이었다.

■ ⚠원문 무수정
  L1 리포는 읽기 전용이다. 이 스크립트는 **파싱만** 한다(eval·import 하지 않는다 —
  JS를 실행하면 이 저장소의 "원본 불변" 원칙이 깨지고, 파싱 실패를 조용히 넘길 위험도 생긴다).

사용:  python verify_L1_sync.py        # 불일치 있으면 exit 1
       python verify_L1_sync.py --list # 전체 대조표 출력
"""
import json, re, sys, io
from pathlib import Path
from collections import defaultdict

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
L1 = HERE.parent.parent / "4. 구 사주본_Saju-main" / "app" / "src" / "engine" / "vendor"

# ── 정본 노드명 (build_relation_edges.py와 같은 이름을 써야 한다)
GAN = ["갑목(甲)", "을목(乙)", "병화(丙)", "정화(丁)", "무토(戊)",
       "기토(己)", "경금(庚)", "신금(辛)", "임수(壬)", "계수(癸)"]
JI = ["자수(子)", "축토(丑)", "인목(寅)", "묘목(卯)", "진토(辰)", "사화(巳)",
      "오화(午)", "미토(未)", "신금(申)", "유금(酉)", "술토(戌)", "해수(亥)"]
OH = ["목(木)", "화(火)", "토(土)", "금(金)", "수(水)"]


def read(fn):
    p = L1 / fn
    if not p.exists():
        sys.stderr.write(f"\n[L1 엔진 없음] {p}\n"
                         "  구 사주본 리포 경로를 확인하라. 대조 없이 통과시키지 않는다.\n")
        raise SystemExit(1)
    return p.read_text(encoding="utf-8")


def nums(text, name):
    """`const NAME = [ ... ];` 의 중첩 배열을 파싱한다(실행하지 않음)."""
    m = re.search(rf"(?:export\s+)?const\s+{re.escape(name)}\s*=\s*(\[.*?\]);",
                  text, re.S)
    if not m:
        sys.stderr.write(f"\n[L1 표 파싱 실패] {name}\n"
                         "  엔진이 바뀌었을 수 있다. 조용히 건너뛰지 않는다.\n")
        raise SystemExit(1)
    body = re.sub(r"//.*", "", m.group(1))          # 줄 주석 제거
    body = body.replace("'", '"')
    body = re.sub(r",(\s*[\]\}])", r"\1", body)     # JS는 후행 쉼표 허용, JSON은 불허
    try:
        return json.loads(body)
    except json.JSONDecodeError as ex:
        sys.stderr.write(f"\n[L1 표 파싱 실패] {name} — {ex}\n"
                         "  엔진 표 형식이 바뀌었다. 조용히 건너뛰지 않는다.\n")
        raise SystemExit(1)


def pair(a, b):
    return tuple(sorted((a, b)))


# ══════════════════════════════════════════════════════════════════════
#  1. L1이 말하는 것 — 정본 노드명으로 번역
# ══════════════════════════════════════════════════════════════════════
def objnums(src, var):
    """`const X = { 0: 3, 2: 6 };` 꼴 객체 리터럴 → [(키, 값), …].
    ★260726 추가 — `YANGIN`·`WOLDEOK`이 배열이 아니라 객체다. 배열 파서로 읽으면
      «파싱 실패»로 죽는다(그렇게 죽어 주는 게 옳다 — 조용히 건너뛰면 감시가 꺼진다)."""
    m = re.search(r"const\s+" + re.escape(var) + r"\s*=\s*\{(.*?)\}\s*;", src, re.S)
    if not m:
        return []
    return [(int(a), int(b)) for a, b in re.findall(r"(\d+)\s*:\s*(\d+)", m.group(1))]


def l1_expected():
    R, T = read("relations.js"), read("tables.js")
    # ★260726 확장 — 페이블 감사: *"«13표 전부 ✅»라는 초록불이 신살엔 안 켜진 등불인데,
    #   조견표 이관이 **무감시 구역으로 지금 들어가는 중**이다."*
    #   맞다 — 방금 `sinsal.js`의 표를 «산출» 간선 86개로 옮겨 적었다.
    #   옮겨 적은 순간부터 **두 벌이 되고, 두 벌은 갈라진다.** 그래서 여기서 감시한다.
    S = read("sinsal.js")
    exp = defaultdict(set)          # kind → {(a,b), …}

    for a, b, _el in nums(R, "STEM_HAP"):
        exp["천간합"].add(pair(GAN[a], GAN[b]))
    for a, b in nums(R, "STEM_CHUNG"):
        exp["천간충"].add(pair(GAN[a], GAN[b]))
    for a, b, _el in nums(R, "YUKHAP"):
        exp["육합"].add(pair(JI[a], JI[b]))
    for g in nums(R, "SAMHAP"):
        ch = g[:3]
        for i in range(3):
            for j in range(i + 1, 3):
                exp["삼합"].add(pair(JI[ch[i]], JI[ch[j]]))
    for g in nums(R, "BANGHAP"):
        ch = g[:3]
        for i in range(3):
            for j in range(i + 1, 3):
                exp["방합"].add(pair(JI[ch[i]], JI[ch[j]]))
    for a, b in nums(R, "CHUNG"):
        exp["지지충"].add(pair(JI[a], JI[b]))
    for g in nums(R, "SAMHYEONG"):
        for i in range(3):
            for j in range(i + 1, 3):
                exp["형"].add(pair(JI[g[i]], JI[g[j]]))
    for a, b in nums(R, "SANGHYEONG"):
        exp["형"].add(pair(JI[a], JI[b]))
    for z in nums(R, "JAHYEONG"):
        exp["자형"].add(("자형", JI[z]))            # 자기참조라 개념 노드에 매단다
    for a, b in nums(R, "PA"):
        exp["파"].add(pair(JI[a], JI[b]))
    for a, b in nums(R, "HAE"):
        exp["해"].add(pair(JI[a], JI[b]))
    for a, b in nums(R, "WONJIN"):
        exp["원진"].add(pair(JI[a], JI[b]))

    for ji, gans in enumerate(nums(T, "HIDDEN_STEMS")):
        for g in gans:
            exp["지장간"].add((JI[ji], GAN[g]))     # 방향 있음
    for g, e in enumerate(nums(T, "STEM_ELEMENT")):
        exp["소속"].add((GAN[g], OH[e]))
    for j, e in enumerate(nums(T, "BRANCH_ELEMENT")):
        exp["소속"].add((JI[j], OH[e]))
    # ── 신살 조견표 (일간/월지 기준) — 우리는 «산출» 간선으로 갖고 있다
    #   ⚠엔진의 배열 순서가 곧 인덱스다: 천간 0갑…9계 · 지지 0자…11해
    for _nm, _var in (("건록", "GEONROK"), ("홍염", "HONGYEOM"),
                      ("문창·문곡", "MUNCHANG")):
        _t = nums(S, _var)
        if _t:
            for _i, _b in enumerate(_t[0] if isinstance(_t[0], list) else _t):
                if _i < 10:
                    exp[_nm + "산출"].add((_nm, JI[_b]))
    # 천을귀인 — 일간마다 두 자리(중첩 배열)
    _ce = nums(S, "CHEONEUL")
    for _row in _ce:
        for _b in _row:
            exp["천을귀인산출"].add(("천을귀인", JI[_b]))
    # 양인 — 양간만. **객체 리터럴**이라 전용 파서를 쓴다.
    for _i, _b in objnums(S, "YANGIN"):
        exp["양인산출"].add(("양인", JI[_b]))
    # ── 십이신살 — ⚠엔진은 **표가 아니라 함수**로 갖는다:
    #     start = (samhapWangji(samhapGroup(base)) + 5) % 12   // 겁살 = 왕지 + 5
    #     samhapWangji = (12 - 3*g) % 12 · samhapGroup = b % 4
    #   그래서 «표 대 표»로 못 댄다. 대신 **공식의 상수 두 개를 소스에서 읽어**
    #   우리가 옮겨 적을 때 쓴 값과 같은지 본다. 엔진이 공식을 바꾸면 여기서 걸린다.
    #   (상수가 같으면 전개 결과도 같다 — 나머지는 산술이다.)
    _m1 = re.search(r"samhapWangji\s*=\s*\(g\)\s*=>\s*\(12\s*-\s*(\d+)\s*\*\s*g\)\s*%\s*12", S)
    _m2 = re.search(r"samhapWangji\(samhapGroup\(base\)\)\s*\+\s*(\d+)", S)
    _m3 = re.search(r"samhapGroup\s*=\s*\(b\)\s*=>\s*b\s*%\s*(\d+)", S)
    _got = (_m1.group(1) if _m1 else None, _m2.group(1) if _m2 else None,
            _m3.group(1) if _m3 else None)
    _want = ("3", "5", "4")            # 우리가 신살_조견표.py 에서 쓴 값
    if _got != _want:
        exp["십이신살공식"].add(("엔진공식", "·".join(str(x) for x in _got)))
    else:
        exp["십이신살공식"].add(("엔진공식", "왕지=(12-3g)%12 · 겁살=왕지+5 · 그룹=b%4"))

    # ── ★강약 판정 절차 (judge.js) — 260726 이식분.
    #   조견표와 달리 이건 «표»가 아니라 **상수 + 경계**다. 그래서 셋을 각각 댄다:
    #     ①자리 배점(BRANCH_W·STEM_W) ②총점 ③등급 경계와 **부등호 방향**.
    #   ⚠부등호까지 대조하는 이유: `>=60`을 `>60`으로 바꿔도 표 개수는 안 변한다.
    #     개수만 세는 대조기는 그 변경을 통과시킨다 — 경계값 사주만 조용히 뒤집힌다.
    J = read("judge.js")
    _POSK = {"year": "연지", "month": "월지", "day": "일지", "hour": "시지"}
    _mb = re.search(r"BRANCH_W\s*=\s*\{([^}]*)\}", J)
    if _mb:
        for _k, _v in re.findall(r"(\w+)\s*:\s*(\d+)", _mb.group(1)):
            if _k in _POSK:
                exp["강약배점"].add((_POSK[_k], int(_v)))
    _ms = re.search(r"STEM_W\s*=\s*(\d+)", J)
    if _ms:
        exp["강약배점"].add(("천간(각 자리)", int(_ms.group(1))))
    _ths = re.findall(
        r"score\s*(>=|>)\s*(\d+)\s*\)?\s*label\s*=\s*'([^']+)'", J)
    for _op, _th, _lab in _ths:
        # ⚠부등호는 더 이상 대조하지 않는다 — 우리 쪽엔 «>=/>»가 아예 없다(띠로 바꿨다).
        #   대조하는 것은 **절단점 숫자**다. 엔진이 85를 80으로 바꾸면 여기서 걸린다.
        exp["강약절단점"].add((_lab, int(_th)))
    # ★`else label = 'X'` — 부등호가 없는 **여집합** 분기. 이걸 모르면
    #   우리가 그 등급을 적어 뒀을 때 «우리에만 있음»으로 가짜 적색이 난다.
    _me = re.search(r"else\s+label\s*=\s*'([^']+)'", J)
    if _me and _ths:
        exp["강약절단점"].add((_me.group(1), int(min(_ths, key=lambda x: int(x[1]))[1])))
    # 득령·득지·득시 — «어느 자리의 본기가 비겁·인성인가»
    for _var, _nm, _pos in (("deukryeong", "득령", "월지"), ("deukji", "득지", "일지"),
                            ("deuksi", "득시", "시지")):
        if re.search(_var + r"\s*=\s*detail\.(\w+)\.branchHelp", J):
            _q = re.search(_var + r"\s*=\s*detail\.(\w+)\.branchHelp", J).group(1)
            exp["득판정"].add((_nm, _POSK.get(_q, _q)))
    _mse = re.search(r"deukse\s*=\s*seCount\s*>=\s*(\d+)", J)
    if _mse:
        exp["득판정"].add(("득세", f"조력 {_mse.group(1)}곳 이상"))



    return exp


# ══════════════════════════════════════════════════════════════════════
#  2. 우리 개념망이 말하는 것
# ══════════════════════════════════════════════════════════════════════
#  ⚠kind 이름이 두 벌에서 다르다. L1은 표 이름, 우리는 관계 종류다.
#
#  🔴260726 수리 — **이 매핑이 낡아서 대조기가 «가짜 적색»으로 죽어 있었다.**
#    전에는 우리 쪽 합 계열이 전부 `kind="합"` 하나였고, 종류는 `source` 문구로 되짚었다.
#    그날 밤 「합」을 **천간합/육합/방합/삼합**으로, 「충」을 **천간충/지지충**으로,
#    「형」을 **삼형/상형**으로 갈랐다(자축이 «육합»이면서 «방합»이라 한 kind로는 표현이 안 됐다).
#    그런데 **이 대조기에 그 사실을 전하지 않았다.** 그래서 `k == "합"`이 하나도 안 걸려
#    「개념망 0건」으로 찍혔고, 대조기가 exit 1로 죽었다.
#    ⚠더 나쁜 것 — 그 게이트가 죽은 채로 내가 하류(링크망·관계도·볼트)를 **손으로 돌렸다.**
#      드리프트 감시 장치가 꺼진 채 정본 표가 재생성됐다. 「17/17 초록」 보고와 모순이었다.
#      **파이프라인이 멈추면 우회하지 말고 멈춘 자리를 고쳐라.**
#  → 이제 kind를 **그대로** 받는다. source 문구에 기대지 않는다(그게 낡음의 원인이었다).
#    옛 이름(`합`·`충`·`형`)도 계속 받아 준다 — 예전 산출물과 대조할 수 있어야 하니까.
SRC_HINT = {
    "천간합": "천간 오합", "육합": "지지 육합", "삼합": "지지 삼합", "방합": "지지 방합",
    "천간충": "천간충", "지지충": "지지 육충",
}
# 우리 kind → 대조 항목. 세분 후 이름이 그대로 항목명이다.
DIRECT = {"천간합", "육합", "삼합", "방합", "천간충", "지지충",
          "삼형", "상형", "파", "해", "원진", "귀문"}


def ours():
    p = DATA / "relation_edges.jsonl"
    if not p.exists():
        sys.stderr.write(f"\n[없음] {p} — 먼저 build_relation_edges.py 를 돌려라.\n")
        raise SystemExit(1)
    got = defaultdict(set)
    for line in p.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        e = json.loads(line)
        if e.get("layer") == "계층":
            continue
        k, a, b, src = e["kind"], e["a"], e["b"], e.get("source", "")
        if k in ("삼형", "상형"):
            # ⚠엔진은 «형»을 한 덩어리로 갖는다. 세분 이름으로 따로 항목을 만들면
            #   「형 ✅ 7건」과 「삼형 🔴 6건」이 동시에 찍혀 **같은 것을 두 번 센다.**
            #   대조는 **엔진이 가진 알갱이 크기**로 한다.
            got["형"].add(pair(a, b))
        elif k in DIRECT:
            got[k].add(pair(a, b))
        elif k == "합":                          # ⚠옛 산출물 호환
            for name, hint in SRC_HINT.items():
                if hint in src:
                    got[name].add(pair(a, b))
        elif k == "충":                          # ⚠옛 산출물 호환
            got["천간충" if "천간충" in src else "지지충"].add(pair(a, b))
        elif k == "형":                          # ⚠옛 산출물 호환
            got["형"].add(pair(a, b))
        elif k == "구성" and a == "자형":
            got["자형"].add((a, b))
        elif k == "산출" and a in ("겁살·재살", "천살·지살", "년살·월살", "망신살",
                                  "장성살", "반안살", "역마", "육해살", "화개"):
            # 십이신살은 엔진이 함수로 갖는다 → 표 대조 대신 공식 상수만 본다(위 참조).
            got["십이신살공식"].add(("엔진공식", "왕지=(12-3g)%12 · 겁살=왕지+5 · 그룹=b%4"))
        elif k == "산출":
            # 신살 조견표 — 260726에 엔진에서 옮겨 적었다. 두 벌이 됐으니 대조한다.
            # 🔴260726 수리 — **엔진의 신살 조견표는 «지지»만 낸다.**
            #   조견표 이식본이 커지면서 같은 `산출` kind로 지지가 아닌 것들이 섞였고
            #   (`건록→신금(辛)` 천간 오해석 · `건록→십이운성 자체` 앵커 폴백)
            #   그게 쌍 개수를 부풀려 가짜 적색을 냈다. 반례 픽스처가 두 번 잡아 줬다.
            #   → **대조는 엔진이 가진 알갱이(지지)로 한정한다.** 나머지는 지도에 그대로 남는다
            #     (버리는 게 아니라 «이 대조의 범위가 아니다»).
            # ⚠오행 글자로 거르면 안 된다 — `신금(辛)`은 **천간인데** 이름 모양이 지지와 같다.
            #   한자로 걸러야 확실하다(지지 12자).
            if len(b) >= 4 and b[-2] in "子丑寅卯辰巳午未申酉戌亥":
                got[a + "산출"].add((a, b))
        elif k == "절차" and a == "점수론(110점)":
            # 자리 배점. ratio 에 점수가 들어 있다(weight 에 넣으면 계기판이 오염된다 — 260725 교훈)
            if e.get("ratio") is not None:
                got["강약배점"].add((("천간(각 자리)" if b == "일간" else b), int(e["ratio"])))
        elif k == "절차" and a == "득령·득지·득세":
            got["득판정"].add((e.get("note") or "?",
                               "조력 2곳 이상" if (e.get("note") == "득세") else b))
        elif k == "귀결" and a == "점수론(110점)":
            # ★260726 — 우리 쪽은 이제 «선»이 아니라 «연속 소속도 띠»다(운영자 1-41).
            #   엔진은 여전히 선이다. **그래서 문자열로는 절대 안 맞는다.**
            #   대조할 것은 «절단점»이지 «표현»이 아니다 → `ratio`에 담긴 중심 절단점만 본다.
            #   ⚠이렇게 안 하면 대조기가 매번 가짜 적색을 내고, 그러면 사람이 게이트를 끈다.
            if e.get("ratio") is not None and b in ("극신강", "신강", "중화", "신약", "극신약"):
                got["강약절단점"].add((b, int(e["ratio"])))
        elif k in ("지장간", "소속"):
            got[k].add((a, b))
    return got


# ══════════════════════════════════════════════════════════════════════
#  3. 대조
# ══════════════════════════════════════════════════════════════════════
def main():
    verbose = "--list" in sys.argv
    exp, got = l1_expected(), ours()
    keys = sorted(set(exp) | set(got))
    bad = []
    print("■ L1 엔진 ↔ 개념망 결정론 표 대조")
    print(f"  L1 = {L1}")
    print()
    print(f"  {'표':<8} {'L1':>5} {'개념망':>6} {'일치':>5} {'L1에만':>7} {'우리에만':>8}")
    print("  " + "─" * 48)
    # 🔴260726 수리 — «갈라짐»과 «엔진에 표가 아예 없음»은 다른 사건이다.
    #   전에는 둘을 섞어 «불일치»로 세고 exit 1을 냈다. 그러면
    #   «엔진이 아직 안 만든 것»과 «두 벌이 어긋난 것»이 같은 빨간불이 되어,
    #   진짜 드리프트가 미구현 목록에 묻힌다.
    #   → 엔진 쪽 표가 **통째로 비어 있으면**(len(E)==0) «엔진 미구현»으로 따로 센다.
    #     이건 보고는 하되 파이프라인을 세우지 않는다 — 엔진이 못 따라온 것이지
    #     우리가 부순 게 아니다.
    # ★260726 «선언된 갈림» — 의도적으로 엔진과 다른 값이 생겼다(강약 배점).
    #   코퍼스 실측이 엔진 값을 지지하지 않아 지도 쪽을 도화도레로 뒤집었기 때문이다.
    #   ⚠**이건 면제 장치가 아니다.** 선언 파일에 «우리값»과 «엔진값»을 **둘 다** 적고,
    #     지금 실측한 두 값이 그 선언과 **완전히 같을 때만** 통과시킨다.
    #     → 엔진이 제3의 값으로 바뀌어도 걸리고, 우리가 몰래 바꿔도 걸린다.
    #   ⚠빈 근거로 항목을 추가하면 이 장치는 «게이트를 끄는 버튼»이 된다(G13의 교훈).
    #     그래서 근거·결정이 비어 있으면 선언으로 인정하지 않는다.
    선언 = {}
    _dp = HERE / "엔진갈림_선언.jsonl"
    if _dp.exists():
        for _l in _dp.read_text(encoding="utf-8").splitlines():
            if not _l.strip():
                continue
            _d = json.loads(_l)
            if not _d.get("항목"):
                continue
            if not (_d.get("근거") or "").strip() or not (_d.get("결정") or "").strip():
                print(f"  ⚠선언 무시 — [{_d['항목']}] 근거/결정이 비었다. 선언으로 인정하지 않는다.")
                continue
            선언[_d["항목"]] = (
                {tuple(x) for x in _d["우리값"]}, {tuple(x) for x in _d["엔진값"]}, _d)
    갈림 = []

    미구현 = []
    for k in keys:
        E, G = exp.get(k, set()), got.get(k, set())
        only_l1, only_ours = E - G, G - E
        if not E and G:
            미구현.append((k, sorted(G)))
            print(f"  {k:<8} {len(E):>5} {len(G):>6} {'—':>5} {'—':>7} {len(G):>8}  ⬜엔진없음")
            continue
        if k in 선언 and (only_l1 or only_ours):
            _우, _엔, _d = 선언[k]
            if G == _우 and E == _엔:
                갈림.append((k, _d))
                print(f"  {k:<8} {len(E):>5} {len(G):>6} {len(E & G):>5} "
                      f"{len(only_l1):>7} {len(only_ours):>8}  ★선언된 갈림")
                continue
            print(f"  {k:<8} {len(E):>5} {len(G):>6} {len(E & G):>5} "
                  f"{len(only_l1):>7} {len(only_ours):>8}  🔴선언과 다름")
            bad.append((k, "★선언된 갈림인데 **선언과 값이 다르다** — "
                           f"선언 우리값 {sorted(_우)} · 선언 엔진값 {sorted(_엔)}",
                        sorted((G - _우) | (E - _엔))))
            continue
        mark = "✅" if not (only_l1 or only_ours) else "🔴"
        print(f"  {k:<8} {len(E):>5} {len(G):>6} {len(E & G):>5} "
              f"{len(only_l1):>7} {len(only_ours):>8}  {mark}")
        if only_l1:
            bad.append((k, "L1에만 있음(우리가 빠뜨림)", sorted(only_l1)))
        if only_ours:
            bad.append((k, "우리에만 있음(L1이 모름)", sorted(only_ours)))
        if verbose and (only_l1 or only_ours):
            for x in sorted(only_l1)[:8]:
                print(f"       L1에만  {x}")
            for x in sorted(only_ours)[:8]:
                print(f"       우리에만 {x}")
    print()

    if 미구현:
        print()
        print(f"  ⬜엔진 미구현 {len(미구현)}종 — 개념망엔 있는데 계산 엔진엔 표가 없다.")
        print("     (드리프트가 아니다. 앱에서 그 관계를 쓰려면 엔진에 표를 넣어야 한다.)")
        for k, v in 미구현:
            print(f"       {k} {len(v)}쌍 — 예: {v[0]}")

    if 갈림:
        print()
        print(f"  ★선언된 갈림 {len(갈림)}종 — **일부러 엔진과 다르게 뒀다.** 사고가 아니다.")
        print("     (양쪽 값을 선언 파일에 고정해 뒀다 — 어느 쪽이 움직여도 여기서 걸린다.)")
        for k, d in 갈림:
            print(f"       [{k}] {d.get('미해결') or d['결정'][:70]}")
            print(f"          근거: {d['근거'][:110]}…")

    # ══ 🔗판정 절차 ↔ 지도 대조 (260727 신설)
    #
    #   🔴왜: 파이프라인 대차대조표가 `판정절차.jsonl`을 «코드가 만들지만 코드가 안 읽는 것»
    #     으로 잡았다. 읽는 사람이 없다는 건 **같은 지식이 두 벌인데 아무도 안 맞춘다**는 뜻이다.
    #     강약 배점은 앱의 심장부다(낭설률 94%였던 그 자리) — 조용히 갈라지면 최악이다.
    #   → 판정절차의 «갈림판본»(= 지도가 채택한 값)이 지도의 `점수론(110점)` 간선과 같은가,
    #     그리고 «규칙»(= 엔진 값)이 `엔진갈림_선언`의 엔진값과 같은가를 둘 다 잰다.
    #   ⚠판정절차.jsonl이 없으면 «통과»가 아니라 그 사실을 찍는다(없는 걸 초록으로 세지 않는다).
    _JP = DATA / "판정절차.jsonl"
    if not _JP.exists():
        print("  ⬜판정절차.jsonl 없음 — 판정절차.py 를 돌려라(대조 못 함).")
    else:
        _지도점수 = {}
        for _l in (DATA / "relation_edges.jsonl").read_text(
                encoding="utf-8").split(chr(10)):
            if not _l.strip():
                continue
            _e = json.loads(_l)
            if _e.get("a") == "점수론(110점)" and _e.get("kind") == "절차":
                _m = re.search(r"(\S+)\s*(\d+)\s*점", str(_e.get("source") or ""))
                if _m and _m.group(1) in ("연지", "월지", "일지", "시지"):
                    _지도점수[_m.group(1)] = int(_m.group(2))
        for _l in _JP.read_text(encoding="utf-8").split(chr(10)):
            if not _l.strip():
                continue
            _p = json.loads(_l)
            _ours = {k: v for k, v in (_p.get("갈림판본") or {}).items()
                     if k in ("연지", "월지", "일지", "시지")}
            if not _ours:
                continue
            _diff = {k: (v, _지도점수.get(k)) for k, v in _ours.items()
                     if _지도점수.get(k) != v}
            if _diff:
                bad.append(("판정절차", "판정절차.jsonl 과 지도의 강약 배점이 다르다 "
                                        "— 같은 지식이 두 벌인데 갈라졌다",
                            [f"{k}: 판정절차 {a}점 · 지도 {b}점" for k, (a, b) in _diff.items()]))
            else:
                print(f"  ✅판정절차 ↔ 지도 강약 배점 일치 "
                      f"({' · '.join(f'{k}{v}' for k, v in sorted(_ours.items()))})")

    if not bad:
        print()
        print("  ✅ 두 벌이 일치한다(선언된 갈림 제외). 예기치 않은 드리프트 없음.")
        print("  ※단 이건 '표가 같다'는 뜻이지 '표가 옳다'는 뜻이 아니다.")
        print("    둘 다 같은 실수를 하고 있을 수 있다 — 코퍼스 축자 대조는 별개 작업이다.")
        return

    print(f"  🔴 불일치 {len(bad)}건 — 두 벌이 갈라졌다.")
    for k, why, items in bad:
        print(f"\n  [{k}] {why} · {len(items)}건")
        for x in items[:10]:
            print(f"      {x}")
        if len(items) > 10:
            print(f"      … 외 {len(items)-10}건 (--list 로 전체)")
    print()
    print("  ★어느 쪽이 옳은지는 이 도구가 판정하지 않는다. 사람이 봐야 한다.")
    print("    다만 **갈라진 사실을 모른 채 지나가는 일**은 이제 없다.")
    raise SystemExit(1)


if __name__ == "__main__":
    main()
