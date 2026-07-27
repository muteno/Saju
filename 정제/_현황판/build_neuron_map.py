# -*- coding: utf-8 -*-
"""
사주 정제 프로젝트 — 뉴런망 (개념 링크 네트워크)

운영자 지시(260724, 보드 1-18): "유의미하게 해야돼. 하나의 키워드에 100개의 다리가
연결되서 뉴런처럼 왓다갓다."
  → 평면 역색인(개념→문단 일방향)은 '다리 1개짜리'라 불합격.
  → 이 스크립트가 만드는 것: 개념↔문단 양방향 + 개념↔개념 동시출현 링크 + 다리 수 측정.

입력:  data/paras_all.jsonl  (build_dashboard.py 가 만든 통합본)
출력:  data/neuron_edges.jsonl   개념쌍 간선 (a, b, w, 근거 para_id 샘플)
       data/neuron_nodes.jsonl   개념 노드 (다리 수·문단 수·저자 분포·과목)
       뉴런망.html                브라우저에서 보는 지도

사용:  python build_neuron_map.py
※ 개념 사전은 build_concept_map.py 의 TAXONOMY 를 그대로 재사용한다(정본 1개 유지).
"""
import json, html, re, sys, itertools, unicodedata
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import Counter, defaultdict

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
KST = timezone(timedelta(hours=9))

# ── 개념 사전 재사용 (정본 = build_concept_map.py)
_src = (HERE / "build_concept_map.py").read_text(encoding="utf-8")
_i = _src.index("TAXONOMY = ")
_j = _src.index("\n}\n", _i) + 3
_ns = {}
exec(_src[_i:_j], _ns)
TAXONOMY = _ns["TAXONOMY"]

# ⚠1글자 별칭은 오탐 지뢰다. '해'는 해석/이해/정해졌다에, '파'는 파악에 걸린다.
# 실측: 그대로 두면 '해'가 다리 190개로 1위 허브가 되는데 대부분 가짜였다(260725).
#
# ★단, 그렇다고 통째로 버리면 진짜 지식이 함께 사라진다 — 평의회 실측(260725):
#   '쇠'를 1글자라는 이유로 자동 삭제했더니 **십이운성 12단계의 하나**가 통째로 날아갔다
#   (257회 중 81회가 명백한 십이운성 문맥: "생욕대·록왕쇠·병사묘·절태양").
#   교훈: **되돌릴 수 없는 조치(삭제)는 정밀도가 확실할 때만.** 애매하면 게이트(가역)다.
# → 1글자는 '삭제'가 아니라 '동반어 게이트'로 강등한다. 동반어가 없으면 그 건만 버린다.
DROP_1CHAR = False

# 별칭 → 개념 역방향 사전 (긴 별칭 우선 매칭)
alias2concept = {}
concept_meta = {}
dropped = []
for big, mids in TAXONOMY.items():
    for mid, concepts in mids.items():
        for concept, aliases in concepts.items():
            concept_meta[concept] = {"big": big, "mid": mid}
            for a in list(aliases) + [concept]:
                a = a.strip()
                if not a:
                    continue
                if DROP_1CHAR and len(a) <= 1:
                    dropped.append((concept, a))
                    continue
                alias2concept.setdefault(a, set()).add(concept)
ALIASES = sorted(alias2concept, key=len, reverse=True)
ALIAS_RE = re.compile("|".join(re.escape(a) for a in ALIASES))

# ⚠일상어와 철자가 겹치는 별칭 — 같은 문단에 '동반어'가 있을 때만 인정한다.
# 실측 오탐률(260725, 문단 33,815 기준):
#   여기 59%(여기서·여기에·여기는)  ·  본기(기본기 안에 들어앉음)  ·  정기 9%(정기적)
# 이 셋은 전부 '여기·중기·정기' 한 개념의 별칭이라, 지장간 문맥을 요구해도 잃는 게 거의 없다.
AMBIGUOUS = {
    "여기": r"지장간|중기|정기|본기|초기|餘氣|여기·",
    "본기": r"지장간|중기|정기|여기|초기|本氣",
    "정기": r"지장간|중기|여기|본기|초기|正氣",
    # 1글자 별칭 — 삭제 대신 게이트(위 주석 참조)
    "쇠": r"십이운성|장생|목욕|관대|건록|제왕|병사묘|절태양|록왕쇠|포태|왕자충|쇠자|衰",
    # ★260725 4차 — '삼형' 토큰 제거. 게이트는 '이 문단이 그 개념을 논하는가'를 물어야 하는데
    #   삼형은 破와 다른 개념이라 바로 옆 일상어를 통과시켰다. 단독통과 28건 표본 8/8 오탐:
    #   파이팅 · 영화 파묘 · 파악해야 · 파고 일어날 · 삼형의 파도 · 세파 · 프로파일러.
    #   (남은 토큰 `파해`도 돌파해/설파해를 태운다 — 아래 마커가 그 오염을 숫자로 계속 노출한다.)
    "파": r"형충파해|파해|육파|충파|破",
    # ★★260725 4차 최대 수리 — 방향이 반대로 박혀 있던 게이트(평의회 3차 §4 2단계 / R1).
    #   전(前): r"해수|해묘미|인신사해|사해|해월|해일주|해시|亥"
    #     이건 害를 '거르는' 게이트가 아니라 亥를 '통과시키는' 게이트였다. 그래서 이 노드는
    #     害 노드인데 亥 문단으로 채워졌다 — 의장 전수 실측 2,740문단 중
    #     亥만 2,630 · 둘다 94 · 害만 16 → **害 근거 적중 4.0%**. 에러는 한 번도 안 났다.
    #   후(後): 害 계열만 통과. 亥 문맥은 `해수(亥)` 노드가 받는다(별칭 9개 보강).
    #   ⚠평의회 문구에 있던 `원진`·`파해`는 실측으로 뺐다 — 오탐 생성기였다:
    #     원진 단독통과 263건 → 걸린 '해'는 올해·해볼게요·위해·관찰해야(표본 10/10 오탐)
    #     파해 단독통과  38건 → 걸린 '해'는 설파해·돌파해·아파해·개입해(표본 10/10 오탐)
    #     둘을 넣으면 '해' 노드는 390문단이 되고 그중 3/4가 다시 가짜다. 같은 사고의 재발이다.
    "해": r"害|형충파해|육해(?!살)|육파",
    # ★260726 추가 — 별칭 판정기가 «위험»으로 찍어 둔 것 중 **글자 침입이 확실한 3건**.
    #   판정은 260725부터 파일에 있었는데 **아무도 그 파일을 안 읽었다**(배선 부재).
    #   실측 근거를 각 줄에 남긴다 — 다음 사람이 «왜 걸었나»를 되물을 수 있게.
    #
    # 「직**장생**활」이 십이운성 長生을 먹었다. 실측: 1,206회 중 앞'직' 쏠림 33.4%.
    "장생": r"십이운성|포태|목욕|관대|건록|제왕|절태양|병사묘|長生|장생지|생왕묘",
    # 「**이사**주」 = 전사에서 「이 사주」를 붙여 쓴 것. 실측: 802회 중 뒤'주' 쏠림 **51%**.
    #   그 밖에 「대표**이사**」·「사**이사**이」도 먹는다. 이동 문맥을 요구한다.
    "이사": r"이사(?:를|하|가|간|갈|온|올|짐|비용|운)|이주|전근|해외|역마|이동수|주거\s*이동",
    # 「시**절입**니다」가 절입(節入)을 먹었다. 실측: 166회 중 뒤'니' 쏠림 **66.9%**.
    "절입": r"절입일|節入|절기|입절|월건|사령|만세력|경계\s*시각",
    # ★260726 — 강약 5단계를 노드로 세우면서 별칭이 늘었다. 래칫이 부채 211→218로
    #   즉시 울었고, **기준선을 올려 통과시키는 것은 금지**(G: 게이트 통과하려고 판정 기준
    #   낮추기)이므로 게이트를 단다. 아래 셋은 «일상어 침입»이 실측으로 확인된 것이다.
    #
    # 🔴「**득시**」 — 페이블 실측: 코퍼스 48,131문단에서 매치 32건 **32/32 전부 오탐**
    #   (설**득시**키·이해**득시**·성명학 「득시운」). 저자들이 쓰는 말은 «득령·득지·득세»
    #   3단이고 «득시»는 엔진/방법론 보드에만 있다. 지우지 않고 문맥을 요구한다 —
    #   엔진이 그 값을 내놓으므로 노드는 있어야 하고, 다만 코퍼스에서 잘못 긁히면 안 된다.
    "득시": r"득령|득지|득세|실령|실지|시지|신강|신약|비겁|인성",
    # 「**실지**로」·「**실지**」(실제) 가 失地를 먹는다. 실측 214회 — 대부분 일상어로 보인다.
    "실지": r"득령|득지|득세|실령|실세|일지|월지|신강|신약|失地",
    # 「**실세**」(권력 실세) 가 失勢를 먹는다.
    "실세": r"득령|득지|득세|실령|실지|신강|신약|비겁|인성|失勢",
    # 극신강·극신약·태강·태약 — 명리 전용어라 침입 위험은 낮지만, 판정기가 «게이트필요»로
    #   찍었고 근거 없이 반박하지 않는다(측정 방식의 인공물일 수 있다는 것은 별개 과제).
    #   강약 문맥을 요구해도 진짜 용례는 다 통과한다 — 잃는 게 없으므로 단다.
    "극신강": r"신강|신약|중화|점수|억부|용신|강약|태강",
    "극신약": r"신강|신약|중화|점수|억부|용신|강약|태약",
    "태강": r"신강|신약|중화|점수|억부|용신|강약|극강|태약",
    "태약": r"신강|신약|중화|점수|억부|용신|강약|극약|태강",
    # ★260726 — 보드에서 새로 세운 신살 2종. 둘 다 일상어와 겹칠 자리가 있다.
    #   「천문성」은 천문학 문맥에, 「현침」은 침(鍼)·현침체(서예) 문맥에 걸린다.
    #   보드에서 이 둘은 **성립요건이 붙은 신살**이다(천문성=일+월지 必 · 현침=2개 이상必).
    "천문성": r"신살|일지|월지|귀문|천라지망|일주|천간|지지|사주",
    "현침살": r"신살|갑목|신금|묘목|오화|미토|신월|일주|천간|지지|사주",
    # 「일간」 6,171회 — 이건 오탐이 아니라 **측정 방식의 잔여 인공물**로 보인다.
    #   (문단 첫머리 화제어라 그 자리 ±40자에 «다른» 개념이 없는 경우가 많다.)
    #   그래도 근거 없이 판정을 반박하지 않는다 — 대신 **잃는 것이 없는 게이트**를 단다.
    #   사주 글에서 「일간」이 아래 어느 것도 없이 나오는 일은 없다. 진짜 용례는 다 통과한다.
    "일간": r"사주|천간|지지|오행|십성|십신|월지|일지|원국|명식|대운|용신|비겁|인성|음양",
    # ★260726 — 한난조습·통변순서 노드를 세우며 별칭이 늘었다. 래칫이 즉시 울었다.
    #   「조열」·「한습」은 일상어에도 있고(조열한 날씨), 「보는 순서」는 아예 일상 어구다.
    #   조후 문맥을 요구한다 — 진짜 용례는 다 통과하고 잡담만 걸린다.
    "한난": r"조습|조후|한습|조열|寒|煖|계절|월지|용신|지지",
    "조습": r"한난|조후|한습|조열|燥|濕|계절|월지|용신|지지",
    "한습": r"한난|조습|조후|조열|계절|월지|용신|일간|지지",
    "조열": r"한난|조습|조후|한습|계절|월지|용신|일간|지지",
    "보는 순서": r"일간|일지|월지|통변|풀이|원국|사주|십성|용신",
    # 「목의 기운」 330회 — 래칫이 실행마다 이 근처에서 흔들린다(고빈도 일반어구).
    #   잃는 것 없는 게이트를 단다.
    "목의 기운": r"오행|목생화|수생목|금극목|갑목|을목|인목|묘목|목국|일간|사주",
    # ★260727 밤 — 원본 반입으로 코퍼스가 커지자(문단 48,729→50,264) 래칫이 172로 울었다.
    #   「금의 기운」 370회·동반어율 34.3% = 바로 위 「목의 기운」(371회·32.6%)과 **동형**이다.
    #   같은 «N의 기운» 꼴이고 실측 표본도 같은 자리("금의 기운을 우리가 뭐라고 하죠? 숙살").
    #   선례를 그대로 계승한다 — 오행 이름만 갈아 끼운다. 진짜 용례는 다 통과한다.
    "금의 기운": r"오행|금생수|토생금|화극금|경금|신금|신유금|금국|일간|사주",
    # ★260727 밤 — 「고립」 545회·동반어율 34.9%·과목일치율 49.2%.
    #   이건 위 둘과 달리 **일상어에도 그대로 있다**("고립되다"). 그래서 반박이 아니라 게이트다.
    #   실측 표본은 전부 오행 문맥("토가 과다하거나 고립되어 있으면") — 그 문맥을 요구한다.
    "고립": r"오행|과다|불급|병존|고립무원|일간|월지|일지|지지|천간|십성|사주|원국",
    # ★260727 밤(2) — 원본 라이브러리 전사본 2,168편이 합류하며 코퍼스가 50,264→68,975문단이
    #   됐다. 래칫이 169→180으로 울었고 새로 넘어온 15개 중 **일상어에도 있는 8개**를 여기 단다.
    #   (나머지 7개는 일상어에 없는 전문 술어라 게이트가 아니라 반박으로 처리 — 반박 파일 참조.)
    #   판정 자는 과목일치율이다: 낮으면 그 말이 사주 밖에서도 산다는 뜻이라 문맥을 요구한다.
    "부모": r"육친|십성|인성|편인|정인|비겁|식상|재성|관성|일간|월지|년주|사주|원국|대운",
    "자영업": r"식상|재성|편재|정재|관성|일간|대운|십성|사주|원국|용신",   # 과목일치율 0.0% — 발현어라 사주 문맥이 곁에 있을 때만
    "제왕": r"십이운성|포태|장생|목욕|관대|건록|쇠지|병지|사지|묘지|절태|양지|제왕지|일지",  # 「제왕절개·제왕적」이 일상어다
    "병존": r"오행|십성|천간|지지|일간|월지|일지|사주|원국|고립|과다|간여지동",
    "태과": r"오행|불급|과다|중화|억부|용신|일간|월지|사주|원국",
    "서머타임": r"만세력|시간\s*보정|진태양시|표준시|경도|출생\s*시|자시|야자시|절입|보정",
    "협잡": r"역술|사주|철학관|점집|무속|상담|명리",                        # 뒤'꾼' 쏠림 58.3% = 「협잡꾼」
    "몸에 좋은": r"오행|개운|체질|건강운|일간|사주|원국|용신",
}
AMBIG_RE = {a: re.compile(p) for a, p in AMBIGUOUS.items()}

# ── ★국소 게이트 (260727) — «문단 어딘가»가 아니라 «그 낱말 바로 옆»을 본다.
#
#   왜 따로 두나: 위 `AMBIGUOUS`는 문단 전체를 본다. 문단 평균이 632자라 그 창은
#   사실상 «이 글이 사주 글인가»를 묻는 것에 가깝고, 그래서 **일상어와 철자가 같은
#   «발현어»**에는 못 쓴다. 발현어는 사주 글 안에서도 일상 뜻으로 쓰이기 때문이다.
#
#   실물: 「공부」는 이 코퍼스에서 대개 **「사주 공부」·「명리 공부」**다.
#     · 「공부」 용례 19,365회 · 무작위 표본 14개 전수 검수에서 **학업 발현 0개**
#     · 문단 전체 게이트 통과 21.5% vs **±40자 국소 9.1%** (국소가 2.4배 엄격)
#     · 국소 통과분 표본 12개는 수능·대학·진학·학교 공부로 대체로 진짜였다
#   → 「공부」를 **맨 별칭으로 넣으면 848건이 «공짜»가 아니라 «오탐»**이 된다.
#     이 프로젝트가 「여기」(15,076문단 중 지장간 문맥 9.3%)로 이미 한 번 당한 형태다.
#
#   ⚠형식: {별칭: (동반어 정규식, 창 폭)}. 창 폭은 **한쪽 방향 글자 수**다.
#   ⛔이 표를 «오탐이 크니 아예 빼자»로 쓰지 마라. 처분은 강등이지 삭제가 아니다(`쇠` 사고).
#   ⚠발현어의 동반어로 **같은 갈래의 일상어**를 쓰면 안 된다(위원 실측: S15 중주제 단위 7~10%로
#     최악 — 「일상어가 일상어를 증명하는」 회로가 된다). **구조 어휘(S01~S14)**만 판별력이
#     있다(40~63%). 그래서 아래 동반어는 전부 «명리 구조어»다.
#   🔴🔴260727 수리 — **여기 1글자 토큰 「합·충·형」이 들어 있었다.**
#     그래서 「말씀드려볼까 **합**니다」·「잘 해결**합**니다」·「불균**형**」이 구조어로 세어졌다.
#     실측: 게이트를 통과한 것 중 **1글자만으로 통과 = 출산 34.1%(45/132) · 갈등 30.9%(159/514)**.
#     ⚠**하루 종일 잡던 그 병을 게이트를 만들면서 내가 저질렀다** —
#       홑글자 「해」가 발현 관계어에서 10건을 헛통과시킨 것과 완전히 같은 형태다.
#     → **2글자 이상만 둔다.** 합·충·형은 「천간합」·「지지충」·「삼형」처럼 붙은 꼴로만 잡는다.
_구조어 = (r"일간|일지|월지|시지|연지|원국|명식|사주|대운|세운|십성|오행|천간|지지|"
          r"비겁|식상|재성|관성|인성|정관|편관|정재|편재|정인|편인|식신|상관|비견|겁재|"
          r"용신|신강|신약|공망|지장간|일주|월주|시주|연주|"
          r"천간합|육합|삼합|방합|반합|합화|지지충|천간충|삼형|자형|형살|원진|귀문")
#   ── 🔴인접 글자 차단(NEG) — «동반어로는 못 막는 것»이 있다 ─────────────
#     「바탕**화**면」의 «탕화» · 「**사령**부」의 «사령»은 **명리 글 안에서** 나온다.
#     그래서 동반어 게이트(주변에 구조어가 있나)로는 **절대 안 걸린다** — 주변이 사주 이야기니까.
#     막을 수 있는 유일한 신호는 **붙어 있는 글자**다.
#     실측 260727: 「사령」 198문단 중 **28(14.1%)이 「사령부」** · 「탕화」 33 중 **5(15.2%)가 「바탕화」**.
#     ⚠개념지도(`build_concept_map.py`)엔 «-접두 제외어» 문법이 있는데
#       `concepts_in()`엔 없었다 — **또 한쪽만**이라 여기서 짝을 맞춘다.
NEG_ADJACENT = {
    # 별칭: (매치 앞뒤로 이 정규식이 걸리면 버린다, 좌우 창)
    "사령": (r"사령부|사령관|사령탑", 3),
    "탕화": (r"바탕화|배경화", 3),
    # ★260728 — 「유리한 **운명**이 아니다」의 «운명»이 «유리한 운»으로 잘렸다.
    #   전수 검수 44건 중 이것 **1건만** 오탐이라 게이트(문맥 요구)는 과잉이다 —
    #   나머지 43건이 다 진짜라 문맥을 요구하면 진짜를 죽인다(«쇠» 사고 형태).
    #   막을 수 있는 신호는 붙어 있는 글자 하나뿐이다. 반박은 `게이트부채_반박.jsonl`에.
    "유리한 운": (r"유리한 운명", 4),
}
NEG_RE = {a: (re.compile(p), w) for a, (p, w) in NEG_ADJACENT.items()}

AMBIGUOUS_LOCAL = {
    # ★260727 — 「출산」 176회 중 뒤'율' 쏠림 **15.9%**(「출산**율**」 = 사회 통계어).
    #   동반어율도 21%로 낮다. 자르지 않고 **구조어가 곁에 있을 때만** 인정한다.
    "출산": (_구조어, 40),
    # 「갈등」 618회 · 동반어율 32%. 뜻 자체는 맞지만(구조 미착지) 발현 간선 재료로 쓰려면
    #   구조가 곁에 있어야 한다. ⚠집계에서 절반이 줄지만 그건 «언급»이지 «간선»이 아니다.
    "갈등": (_구조어, 40),
    # ★260728 — 중복 전사 1,915편을 걷어내며 코퍼스가 바뀌자 래칫이 165→168로 울었다.
    #   기준선을 올리는 것은 금지(G: 게이트 통과하려고 판정 기준 낮추기)라 표본을 봤다.
    #   둘 다 노드가 `장부·증상`(S15 발현)이고 **과목일치율 0.0%** — 「자영업」과 같은 형태다.
    #
    # 「우울증」 570회 · ±40자 구조어 동반 **21.1%**. 표본은 「조울증 우울증 공황장애 치매」처럼
    #   증상을 나열만 하고 원인(글자)이 안 적힌 자리가 대부분이다. 그건 «언급»이지 «간선»이 아니다.
    "우울증": (_구조어, 40),
    # 「수면장애」 39회 · ±40자 구조어 동반 **33.3%**. 표본에 「서머타임 제도 → 생체리듬 →
    #   수면장애」처럼 **사주 밖 인과**로 쓰인 자리가 섞여 있다.
    "수면장애": (_구조어, 40),
}
AMBIG_LOCAL = {a: (re.compile(p), w) for a, (p, w) in AMBIGUOUS_LOCAL.items()}

# ── ★개념마커 적중률 검사 (평의회 3차 §4 2단계 · R1) ─────────────────────────
# 무엇을 재나: "이 노드에 걸린 문단이 **정말로 그 개념의 표기**를 갖고 있나."
#
# ⚠설계에서 가장 중요한 한 줄: **마커는 게이트를 근거로 삼지 않는다.**
#   게이트를 마커로 재사용하면 게이트가 틀릴 때 검사도 똑같이 틀린다 — 그게 정확히
#   `해` 4.0% 사고의 정체다(亥 게이트가 亥 문단을 "적중"이라고 자기 승인했다).
#   그래서 게이트(무엇을 받아들일까)와 마커(그게 정말 이 개념인가)를 **따로 손으로 적는다.**
#   둘이 어긋나는 순간 적중률이 무너지고 빌더가 exit 1 로 죽는다. 그게 이 장치의 전부다.
#
# 손으로 적는 건 아래 3개뿐이다 — 1글자 별칭을 가진 노드. 나머지 246개는 별칭 자체가
# 2글자 이상이라 마커를 자동으로 만든다(_auto_marker). 자동이면 대개 100%가 나오는데,
# 그건 "확증 표기로만 걸렸다"는 뜻이라 정직한 100%다. 검사가 무는 곳은 1글자·수동 노드다.
CONCEPT_MARKERS = {
    # 害 계열 — 亥(해수)와 한글 철자가 겹치는 유일한 노드. 이 표기가 없으면 害가 아니다.
    "해": r"害|육해|형충파해|육파",
    # 破 계열 — 게이트의 `파해`(돌파해·설파해를 태운다)를 일부러 뺐다. 남은 오염이 숫자로 보인다.
    # ★260727 — **쌍 표기를 마커에 더한다.** 파 별칭에 「묘오파」류 12종을 넣자
    #   문단이 236 → 390으로 늘었는데 마커가 옛 표기만 알아서 적중률이 67.3% → **46.7%**로
    #   떨어져 **게이트가 빌더를 죽였다(옳게 죽었다).**
    #   ⚠이건 «게이트 통과하려고 기준을 낮추는 것»이 아니다 — 「묘오파」는 破의 **정식 표기**이고,
    #     쌍 표기가 든 문단 12개를 눈으로 확인해 전부 진짜임을 봤다(「오묘파 현상」·「[인해파]」).
    #     마커가 낡아서 진짜를 가짜로 세고 있던 것이다.
    #   ⛔반대로 게이트(`AMBIGUOUS["파"]`)는 **건드리지 않는다** — 마커는 게이트를 근거로 삼지
    #     않는다는 규칙(둘이 같아지면 게이트가 틀릴 때 검사도 똑같이 틀린다).
    "파": (r"破|형충파해|육파|충파|"
           r"자유파|유자파|축진파|진축파|인해파|해인파|묘오파|오묘파|사신파|신사파|술미파|미술파"),
    # 衰 = 십이운성 12단계의 하나. 과거에 "1글자는 오탐"이라며 삭제됐다가 복구된 노드다.
    "쇠": r"衰|쇠지|쇠자|록왕쇠|생욕대|병사묘|절태양|십이운성|포태",
}
MARKER_FLOOR = 0.60      # 이 아래면 '그 개념보다 다른 개념일 가능성이 크다' → 빌더 사망
                         # 실측 기준점(260725): 옛 亥 게이트를 되살리면 `해`가 1.7%로 무너져 죽는다.
                         #                      현행은 `해` 100% · `파` 67.3% · `쇠` 87.6%.


def _auto_marker(concept, aliases):
    """수동 마커가 없는 노드의 자동 마커 = 2글자 이상 별칭 + 개념명 괄호 안 이표기.
       1글자 별칭은 마커가 될 수 없다(원리상 일상어에 박힌다 — 해/파/쇠가 그 셋이다).
       `-`로 시작하는 제외 별칭(-신금(申))은 마커가 아니다 — 그건 '아닌 것'의 표시다."""
    cand = [a.strip() for a in list(aliases) + [concept]]
    parts = {a for a in cand if len(a) > 1 and not a.startswith("-")}
    m = re.search(r"\((.+?)\)", concept)          # 해수(亥)→亥 · 편관(칠살)→칠살
    if m:
        parts.add(m.group(1))
    return "|".join(re.escape(p) for p in sorted(parts, key=len, reverse=True)) or None


CONCEPT_MARKER_RE = {}
for _big, _mids in TAXONOMY.items():
    for _mid, _cs in _mids.items():
        for _c, _al in _cs.items():
            _p = CONCEPT_MARKERS.get(_c) or _auto_marker(_c, _al)
            if _p:
                CONCEPT_MARKER_RE[_c] = re.compile(_p)


def concepts_in(text):
    """한 문단의 텍스트에서 등장하는 개념 집합. 긴 별칭이 짧은 것을 덮도록 겹침 제거."""
    if not text:
        return set()
    text = unicodedata.normalize("NFC", text)
    found, taken = set(), []
    for m in ALIAS_RE.finditer(text):
        s, e = m.span()
        if any(s < te and ts < e for ts, te in taken):
            continue          # 이미 더 긴 별칭이 먹은 구간
        a = m.group()
        if a in AMBIG_RE and not AMBIG_RE[a].search(text):
            continue          # 동반어 없음 → 일상어로 보고 버린다
        # ★260727 — **국소 게이트.** 위 검사는 «문단 어딘가에» 동반어가 있으면 통과시킨다.
        #   문단 평균 632자라 그 창은 사실상 «이 글이 사주 글인가»를 묻는 것에 가깝다.
        #   260726에 `lint_aliases.py`(검증기)는 ±40자 국소 창으로 고쳤는데
        #   **빌더인 여기는 안 고쳤다 — 또 한쪽만.** 그 차이를 실측하면:
        #     「공부」 든 문단 9,091 중 문단전체 게이트 통과 21.5% vs ±40 국소 9.1%
        #     (문단 전체로 하면 1,133건이 더 통과한다 = 「사주 공부」가 그만큼 샌다)
        #   ⚠기존 게이트(여기·쇠·파·해·장생…)의 판정은 **건드리지 않는다.**
        #     국소를 요구하는 별칭만 `AMBIG_LOCAL`에 따로 적는다 — 한꺼번에 조이면
        #     지금 잘 도는 게이트들이 같이 흔들리고, 무엇이 바뀌었는지 못 가린다.
        if a in AMBIG_LOCAL:
            _rx, _w = AMBIG_LOCAL[a]
            if not _rx.search(text[max(0, s - _w): e + _w]):
                continue
        # ⛔인접 글자 차단 — 「바탕화면」·「사령부」처럼 **붙어 있는 글자로만** 갈리는 것
        if a in NEG_RE:
            _nrx, _nw = NEG_RE[a]
            if _nrx.search(text[max(0, s - _nw): e + _nw]):
                continue
        taken.append((s, e))
        found |= alias2concept[a]
    return found


# ★관측창 확장 (260725, 평의회 2차 만장일치 1순위)
#   그동안 매칭 대상이 `gist + quote`(문단당 평균 74자)뿐이었다. 실제 문단은 평균 632자.
#   실측: 관측 2,806,835자 / 원문 24,054,493자 = **11.67%**. 나머지 88%는 한 번도 안 읽혔다.
#   그래서 개념 221·간선 1만·트리 1,973가지가 전부 11.67% 표본 위에서 계산됐고,
#   "무엇이 공백인가"라는 진단들도 같은 표본 위에 서 있었다.
#   → P0가 남긴 포인터(post.file + para.lines)를 따라가 **원문 전문**을 읽는다.
#   ⚠NFC 정규화 필수 — 빠뜨리면 파일명이 안 맞아 전량 미해결된다(맥 NFD 실측).
READ_FULL_TEXT = True
SNAP_DIRS = None      # main()에서 채움
_file_cache = {}


def _snapshot_dirs():
    import sys as _s
    _s.path.insert(0, str(HERE))
    import 경로 as _p
    base = _p.P0_인벤토리
    return [d for d in sorted(base.glob("*_v1")) if d.is_dir()] or []


def _lines_of(fname):
    """스냅샷에서 파일 원문 줄 목록. 파일명은 NFC/NFD 양쪽으로 찾는다."""
    key = unicodedata.normalize("NFC", fname)
    if key in _file_cache:
        return _file_cache[key]
    for d in SNAP_DIRS:
        for cand in (key, unicodedata.normalize("NFD", key)):
            p = d / cand
            # ⚠NFD는 한글 1자가 자모 2~3개로 풀려 바이트가 2배가 된다 — 긴 제목이면
            #   리눅스 파일명 상한(255바이트)을 넘어 stat이 ENAMETOOLONG을 던진다.
            #   Path.exists()는 ENOENT·ELOOP만 삼키고 이건 그대로 올린다(파이썬 3.11 실측).
            #   윈도우(UTF-16 NTFS)에선 안 터지던 것이 클라우드 이전으로 드러났다.
            try:
                있음 = p.exists()
            except OSError:
                continue
            if 있음:
                raw = p.read_text(encoding="utf-8-sig").splitlines()
                _file_cache[key] = raw
                return raw
    _file_cache[key] = None
    return None


def para_text(q, posts):
    """문단의 매칭 대상 텍스트. 원문 전문 우선, 실패 시 gist+quote로 폴백."""
    fallback = (q.get("gist") or "") + " " + (q.get("quote") or "")
    if not READ_FULL_TEXT:
        return fallback
    post = posts.get(q.get("post_id"))
    if not post or not post.get("file") or not q.get("lines"):
        return fallback
    raw = _lines_of(post["file"])
    if raw is None:
        return fallback
    a, b = q["lines"]
    body = "\n".join(raw[max(0, a - 1): b])
    # gist는 우리가 붙인 이름표라 표준 용어가 들어 있다 — 원문과 함께 본다
    return (q.get("gist") or "") + "\n" + body


def _prev_counts():
    """직전 빌드 산출물의 노드·간선 수. 회귀 방어(R7)용 — 덮어쓰기 **전**에 읽어야 한다."""
    nf, ef = DATA / "neuron_nodes.jsonl", DATA / "neuron_edges.jsonl"
    if not (nf.exists() and ef.exists()):
        return None
    nodes = [json.loads(l) for l in nf.read_text(encoding="utf-8").splitlines() if l.strip()]
    n_edge = sum(1 for l in ef.read_text(encoding="utf-8").splitlines() if l.strip())
    return {"nodes": sum(1 for n in nodes if n.get("paras", 0) > 0), "edges": n_edge}


def main():
    global SNAP_DIRS
    SNAP_DIRS = _snapshot_dirs()
    prev = _prev_counts()
    paras = [json.loads(l) for l in (DATA / "paras_all.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    posts = {p["post_id"]: p for p in
             (json.loads(l) for l in (DATA / "posts_all.jsonl").read_text(encoding="utf-8").splitlines() if l.strip())}

    node_paras = defaultdict(list)      # 개념 → [para_id]  (개념→문단 다리)
    node_authors = defaultdict(Counter)
    node_flags = defaultdict(Counter)
    node_subj = defaultdict(Counter)
    edge_w = Counter()                  # (a,b) → 동시출현 횟수  (개념↔개념 다리)
    edge_ev = defaultdict(list)         # (a,b) → 근거 para_id 샘플
    marker_hit = Counter()              # ★개념 → 마커까지 확인된 문단 수
    marker_miss = defaultdict(list)      # ★개념 → 마커가 없는 문단 표본(사람이 5초에 확인)
    n_hit = 0

    # ★260726 — 코퍼스를 **공용 리더**로 갈아탔다.
    #   그 전에는 웹 paras_all 38,072을 필터 없이(운세 격자 포함) + gist를 본문에 섞어서 봤다.
    #   이제 링크망·개념지도와 **같은 47,088**(웹 21,026 + 전사 26,062)을 본다.
    #   같은 코퍼스를 봐야 «뉴런맵이 센 문단»과 «링크망이 센 문단»을 나란히 놓을 수 있다.
    #   ⚠지연 import — 코퍼스.py가 이 모듈을 importlib로 올리므로 모듈 최상단에서 부르면 꼬인다.
    import 코퍼스 as _CP
    _units = list(_CP.문단들())
    print(f"  코퍼스 {len(_units):,} 문단 (공용 리더)")
    for _r in _units:
        q, text = _r["q"], _r["text"]
        if _r["출처종"] == "전사":
            posts.setdefault(_r["post_id"], _r["post"])     # 저자 조회가 전사도 되게
        cs = concepts_in(text)
        if not cs:
            continue
        # ★개념마커 적중률 — concepts_in() 바로 뒤에서 잰다.
        #   배정한 그 자리에서 "정말 이 개념인가"를 되묻는다. 나중에 따로 재면 벽에 붙은 종이가 된다.
        #   ⚠NFC 필수. concepts_in()은 안에서 정규화하는데 여기서 안 하면 검사만 원본을 본다.
        #     실측(260725): 안 했더니 금(金)이 93.2%로 찍혔다 — 원문의 호환한자 金(U+F90A)이
        #     마커의 金(U+91D1)과 안 맞아서다(코퍼스 46파일·3,765회). 조용히 틀리는 바로 그 종류.
        ntext = unicodedata.normalize("NFC", text)
        for c in cs:
            mre = CONCEPT_MARKER_RE.get(c)
            if mre is None:
                continue
            if mre.search(ntext):
                marker_hit[c] += 1
            elif len(marker_miss[c]) < 3:
                marker_miss[c].append(q.get("para_id"))
        n_hit += 1
        _pp = posts.get(q.get("post_id"), {})
        author = _pp.get("author") or _pp.get("채널") or "?"
        pid = q.get("para_id")
        for c in cs:
            node_paras[c].append(pid)
            node_authors[c][author] += 1
            for f in q.get("flags", []):
                node_flags[c][f] += 1
            for s in q.get("subj", []):
                node_subj[c][s] += 1
        # 한 문단 안에서 같이 나온 개념끼리 다리를 놓는다 (무향)
        for a, b in itertools.combinations(sorted(cs), 2):
            edge_w[(a, b)] += 1
            if len(edge_ev[(a, b)]) < 3:
                edge_ev[(a, b)].append(pid)

    # ── 노드 저장
    deg = Counter()
    for (a, b), w in edge_w.items():
        deg[a] += 1
        deg[b] += 1
    nodes = []
    for c in sorted(concept_meta, key=lambda x: -len(node_paras.get(x, []))):
        nodes.append({
            "concept": c,
            "big": concept_meta[c]["big"],
            "mid": concept_meta[c]["mid"],
            "paras": len(node_paras.get(c, [])),
            "bridges": deg.get(c, 0),                       # ★다리 수 = 이 개념이 손잡은 다른 개념의 수
            "authors": dict(node_authors[c].most_common()),
            "flags": dict(node_flags[c].most_common(8)),
            "subj": dict(node_subj[c].most_common(4)),
            "top_links": [{"to": (b if a == c else a), "w": w}
                          for (a, b), w in edge_w.most_common() if c in (a, b)][:20],
        })
    with (DATA / "neuron_nodes.jsonl").open("w", encoding="utf-8") as fh:
        for n in nodes:
            fh.write(json.dumps(n, ensure_ascii=False) + "\n")

    with (DATA / "neuron_edges.jsonl").open("w", encoding="utf-8") as fh:
        for (a, b), w in edge_w.most_common():
            fh.write(json.dumps({"a": a, "b": b, "w": w, "ev": edge_ev[(a, b)]}, ensure_ascii=False) + "\n")

    # ── 진단 수치
    total_bridges = sum(deg.values()) // 2
    have = [n for n in nodes if n["paras"] > 0]
    isolated = [n["concept"] for n in nodes if n["bridges"] == 0]
    thin = [n["concept"] for n in nodes if 0 < n["bridges"] < 5]
    avg_bridge = (sum(n["bridges"] for n in have) / len(have)) if have else 0
    hub = sorted(nodes, key=lambda n: -n["bridges"])[:30]

    stamp = datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")
    rows = []
    for n in sorted(nodes, key=lambda n: -n["bridges"]):
        if n["paras"] == 0 and n["bridges"] == 0:
            cls = "dead"
        elif n["bridges"] < 5:
            cls = "thin"
        else:
            cls = ""
        links = " · ".join(f'<span class="lk">{html.escape(l["to"])}<b>{l["w"]}</b></span>'
                           for l in n["top_links"][:12])
        auth = " ".join(f'{html.escape(a)}<b>{c}</b>' for a, c in list(n["authors"].items())[:4])
        rows.append(
            f'<tr class="{cls}" id="n-{html.escape(n["concept"])}">'
            f'<td class="c">{html.escape(n["concept"])}<div class="sub">{html.escape(n["mid"])}</div></td>'
            f'<td class="num big">{n["bridges"]}</td><td class="num">{n["paras"]}</td>'
            f'<td class="au">{auth}</td><td class="lks">{links}</td></tr>')

    doc = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>뉴런망 — 개념 링크 지도</title>
<style>
:root{{color-scheme:light dark}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
margin:0;padding:24px;background:#f6f7f9;color:#16181d}}
@media(prefers-color-scheme:dark){{body{{background:#14161a;color:#e6e8ec}}}}
h1{{font-size:22px;margin:0 0 4px}} .stamp{{color:#8a8f98;font-size:13px;margin-bottom:18px}}
.cards{{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px}}
.card{{background:#fff;border:1px solid #e3e6ea;border-radius:12px;padding:14px 18px;min-width:150px}}
@media(prefers-color-scheme:dark){{.card{{background:#1c1f25;border-color:#2b2f37}}}}
.card .k{{font-size:12px;color:#8a8f98}} .card .v{{font-size:26px;font-weight:700;margin-top:2px}}
.note{{background:#fff8e6;border:1px solid #f0dfa8;border-radius:10px;padding:12px 16px;font-size:14px;line-height:1.7;margin-bottom:18px}}
@media(prefers-color-scheme:dark){{.note{{background:#2a2515;border-color:#4a4020}}}}
input{{width:100%;max-width:420px;padding:10px 12px;border:1px solid #d5d9e0;border-radius:9px;font-size:15px;margin-bottom:14px;background:inherit;color:inherit}}
table{{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;font-size:13px}}
@media(prefers-color-scheme:dark){{table{{background:#1c1f25}}}}
th{{text-align:left;padding:10px;background:#eef1f5;font-size:12px;color:#5b6270;position:sticky;top:0}}
@media(prefers-color-scheme:dark){{th{{background:#22262e;color:#9aa1ad}}}}
td{{padding:9px 10px;border-top:1px solid #eceff3;vertical-align:top}}
@media(prefers-color-scheme:dark){{td{{border-color:#282c34}}}}
td.c{{font-weight:600;white-space:nowrap}} .sub{{font-size:11px;color:#8a8f98;font-weight:400}}
td.num{{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}}
td.num.big{{font-size:16px;font-weight:700}}
tr.thin td.num.big{{color:#c9701a}} tr.dead{{opacity:.45}} tr.dead td.num.big{{color:#c0392b}}
.lk{{display:inline-block;background:#eef2f8;border-radius:6px;padding:1px 6px;margin:1px 0;font-size:12px}}
@media(prefers-color-scheme:dark){{.lk{{background:#262b34}}}}
.lk b{{color:#5b7fd4;margin-left:3px;font-size:11px}}
td.au{{font-size:12px;color:#6b7280;white-space:nowrap}} td.au b{{color:#16181d;margin-left:1px}}
@media(prefers-color-scheme:dark){{td.au b{{color:#e6e8ec}}}}
td.lks{{line-height:1.9}}
</style></head><body>
<h1>뉴런망 — 개념 링크 지도</h1>
<div class="stamp">{stamp} · 문단 {len(paras):,}개 중 {n_hit:,}개가 개념을 물었고, 그 안에서 다리가 놓였다</div>

<div class="cards">
<div class="card"><div class="k">개념(노드)</div><div class="v">{len(have)}<span style="font-size:14px;color:#8a8f98"> / {len(nodes)}</span></div></div>
<div class="card"><div class="k">다리(간선)</div><div class="v">{total_bridges:,}</div></div>
<div class="card"><div class="k">개념당 평균 다리</div><div class="v">{avg_bridge:.0f}</div></div>
<div class="card"><div class="k">다리 100개 이상</div><div class="v">{sum(1 for n in nodes if n["bridges"]>=100)}</div></div>
<div class="card"><div class="k">외딴 개념(다리 0)</div><div class="v">{len(isolated)}</div></div>
</div>

<div class="note">
<b>읽는 법.</b> <b>다리 수</b> = 이 개념이 같은 문단 안에서 손잡은 <i>다른 개념</i>의 종류 수.
운영자 기준(보드 1-18) = <b>"하나의 키워드에 100개의 다리"</b> — 그 선을 넘은 개념이 위 카드의 숫자다.<br>
<b style="color:#c9701a">주황</b> = 다리 5개 미만(고립 위험) · <b style="color:#c0392b">빨강/흐림</b> = 자료도 다리도 없는 진짜 공백.
옆의 링크 칩은 <i>가장 자주 같이 나온 개념</i>이고 붙은 숫자가 동시출현 횟수다 — 이게 나중에 판단 유닛의 <b>간선 가중치</b>가 된다.
</div>

<input id="q" placeholder="개념 검색 (예: 갑목, 용신, 신강)" oninput="f()">
<table><thead><tr><th>개념</th><th style="text-align:right">다리</th><th style="text-align:right">문단</th><th>저자</th><th>가장 자주 같이 나오는 개념 →</th></tr></thead>
<tbody id="tb">{''.join(rows)}</tbody></table>
<script>
function f(){{var v=document.getElementById('q').value.trim();
document.querySelectorAll('#tb tr').forEach(function(r){{r.style.display=(!v||r.textContent.includes(v))?'':'none'}})}}
</script></body></html>"""
    out = HERE / "뉴런망.html"
    out.write_text(doc, encoding="utf-8")

    print(f"[뉴런망] 개념 {len(have)}/{len(nodes)} · 다리 {total_bridges:,} · 개념당 평균 {avg_bridge:.0f}")
    print(f"  다리 100+ : {sum(1 for n in nodes if n['bridges']>=100)}개")
    print(f"  외딴(0)   : {len(isolated)}개 {isolated[:12]}")
    print(f"  빈약(<5)  : {len(thin)}개 {thin[:12]}")
    print("  허브 top15:", ", ".join(f"{n['concept']}({n['bridges']})" for n in hub[:15]))
    if dropped:
        print(f"  ※1글자 별칭 {len(dropped)}개 제외(오탐 방지): {dropped}")
    print(f"  → {out}")

    # ── ★개념마커 적중률 리포트 (249노드 전수) + 회귀 방어 ──────────────────
    rows_m, fail, unmeasured = [], [], []
    for n in nodes:
        c = n["concept"]
        tot = n["paras"]
        if c not in CONCEPT_MARKER_RE:
            unmeasured.append(c)
            continue
        hitn = marker_hit.get(c, 0)
        rate = (hitn / tot) if tot else None
        src = "수동" if c in CONCEPT_MARKERS else "자동"
        gated = "게이트" if any(a in AMBIG_RE for a, cs in alias2concept.items() if c in cs) else ""
        # 🔴260726 정직화 — 마커가 «별칭 재사용»이면 적중률은 구조상 100%가 나온다.
        #   concepts_in()이 매칭에 쓰는 바로 그 문자열로 검사하니 안 맞을 수가 없다.
        #   실측: 손으로 적은 독립 마커는 3개(해·파·쇠)뿐이고 나머지 246개가 자동이다.
        #   그중 손으로 적은 3개 중 2개가 실제로 문제였다(파 67.3% · 쇠 87.6%).
        #   → 246개를 «적합»으로 찍는 것은 거짓말이다. «미측정»으로 분리한다.
        #   (7대가 `안전` 라벨을 `미측정` 200개로 분리한 것과 정확히 같은 처분)
        independent = c in CONCEPT_MARKERS
        if not tot:
            verdict = "표본없음"
        elif not independent:
            verdict = "미측정"          # 마커=별칭 → 자기검사. 값은 참고용
        else:
            verdict = "적합" if rate >= MARKER_FLOOR else "미달"
        if verdict == "미달":
            fail.append((rate, c, tot, hitn))
        rows_m.append({"c": c, "big": n["big"], "paras": tot, "hit": hitn,
                       "rate": rate, "src": src, "gate": gated, "verdict": verdict,
                       "miss": marker_miss.get(c, [])})

    rows_m.sort(key=lambda r: (r["rate"] if r["rate"] is not None else 2, -r["paras"]))
    rep = [f"# 개념마커 적중률 — {len(rows_m)}노드 전수  ({stamp})", "",
           f"측정 = 그 노드에 걸린 문단 중 **그 개념의 마커**를 실제로 가진 비율.",
           f"마커는 게이트와 **따로** 적는다 — 게이트를 마커로 재사용하면 게이트가 틀릴 때 검사도 같이 틀린다.",
           f"임계 {MARKER_FLOOR:.0%} 미만이면 빌더가 exit 1 로 죽는다(경고 아님).", "",
           f"- 문단 있는 노드 {sum(1 for r in rows_m if r['paras'])} · 수동마커 {sum(1 for r in rows_m if r['src']=='수동')}"
           f" · 게이트 보유 {sum(1 for r in rows_m if r['gate'])} · **미달 {len(fail)}**",
           f" · ⚠**미측정 {sum(1 for r in rows_m if r['verdict']=='미측정')}** "
           f"(마커가 별칭 재사용이라 적중률이 구조상 100%다 — 잰 적이 없다는 뜻)",
           f" · ✅독립 마커로 실제 측정한 것 **{sum(1 for r in rows_m if r['verdict'] in ('적합','미달'))}개**", "",
           "| 개념 | 과목 | 문단 | 마커적중 | 적중률 | 마커 | 게이트 | 판정 | 마커없는 문단 표본 |",
           "|---|---|---:|---:|---:|---|---|---|---|"]
    for r in rows_m:
        rt = "—" if r["rate"] is None else f"{r['rate']:.1%}"
        rep.append(f"| {r['c']} | {r['big']} | {r['paras']} | {r['hit']} | {rt} | "
                   f"{r['src']} | {r['gate']} | {r['verdict']} | {' '.join(r['miss'])} |")
    (DATA / "개념마커_적중률.md").write_text("\n".join(rep) + "\n", encoding="utf-8")

    print(f"\n[개념마커 적중률] {len(rows_m)}노드 전수 · 임계 {MARKER_FLOOR:.0%}")
    for r in rows_m[:8]:
        rt = "—" if r["rate"] is None else f"{r['rate']:6.1%}"
        print(f"   {r['c']:<14}{rt}  문단 {r['paras']:>6} · 마커 {r['hit']:>6} ({r['src']})")
    print(f"   … 나머지 {max(0, len(rows_m)-8)}노드 100% · 전문 → {DATA / '개념마커_적중률.md'}")
    if unmeasured:
        print(f"   ⚠마커를 만들 수 없는 노드 {len(unmeasured)}개: {unmeasured[:10]}")

    # 회귀 방어 — 수리가 사고로 바뀌지 않았는지 직전 산출물과 강제 대조(R7)
    dead = False
    if prev:
        dn = len(have) - prev["nodes"]
        de = (len(edge_w) - prev["edges"]) / prev["edges"] if prev["edges"] else 0
        print(f"\n[회귀 방어] 노드 {prev['nodes']} → {len(have)} ({dn:+}) · "
              f"간선 {prev['edges']:,} → {len(edge_w):,} ({de:+.2%})")
        if dn < 0:
            print(f"   ❌ 문단 있는 노드가 {-dn}개 죽었다 — 수리가 아니라 사고다."); dead = True
        if de < -0.05:
            print(f"   ❌ 간선이 {de:.2%} 줄었다(허용 -5%) — 수리가 아니라 사고다."); dead = True

    if fail:
        print(f"\n❌ 개념마커 적중률 미달 {len(fail)}노드 — 이 노드들은 '그 개념'이 아닐 가능성이 더 크다:")
        for rate, c, tot, hitn in sorted(fail):
            print(f"     {c:<16}{rate:6.1%}  ({hitn}/{tot})")
        dead = True
    if dead:
        sys.exit(1)


if __name__ == "__main__":
    main()
