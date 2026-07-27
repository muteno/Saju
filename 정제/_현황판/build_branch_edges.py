# -*- coding: utf-8 -*-
"""
분기 간선 추출기 (F6) — 「A면 B, C면 D」에서 «조건 붙은 관계»를 캔다.

═══ 왜 F6인가 ═══
  웹 위원 실측(260726): 교재부 536만자에서 F6 «대칭 분기» 1,003건 · **고유율 99.5%**.
  격자 복붙이 없어서 접을 필요조차 없고, **조건이 문장에 명시돼 있다.**
  L1 결정론 간선이 849개뿐인데 여기서만 조건부 간선 수천 후보가 나온다.

═══ 무엇을 담고 무엇을 버리는가 (운영자 260726) ═══
  ⭕담는다 : {주체 개념} ─[조건]→ {결과 개념}  · 그리고 그 짝이 되는 반대 분기
  ⛔버린다 : 조건 없는 문장 · 결과가 개념 노드가 아닌 것(자유 서술) · 순수 결정론(이미 안다)

  「임수2 = 유학」이 왜 안 되고 이건 왜 되는가 —
    전자는 조건 없이 «글자 → 인생 사건»을 못 박는다.
    후자는 «토(土) ─[과다]→ 건강·질병» 처럼 **조건이 슬롯에 들어가고 짝 분기가 함께 온다**
    (`수(水) ─[고립]→ 건강·질병`). 조건이 바뀌면 결과가 바뀐다는 것 자체가 저장 내용이다.

═══ 세 겹 함정 (앞선 실패에서) ═══
  ① gist를 쓰지 않는다 — 본문만. gist는 결론만 남긴 압축이다.
  ② 보류군 파일(수상학·관상·타로·풍수·당사주·구성학·매화역수·토정비결·작명)을 제외한다.
     우리 엔진의 절대원칙이 «계산된 원국 키셋의 조회»인데 이들은 키셋 자체가 다르다.
  ③ 순수 결정론(시두법·월두법·60갑자 배열)은 «검증 세트»로 빼고 관계지도에 안 넣는다.
     이미 100% 아는 것을 캐면 오전사·유파차로 오염된다.

출력: data/분기간선.jsonl · data/분기간선_검증세트.jsonl · data/분기간선_리포트.md
"""
import json, re, sys, math, unicodedata, importlib.util, hashlib
from pathlib import Path
from collections import Counter, defaultdict

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location("bnm", HERE / "build_neuron_map.py")
bnm = importlib.util.module_from_spec(spec); spec.loader.exec_module(bnm)
bnm.SNAP_DIRS = bnm._snapshot_dirs()
MARK, AMBIG = bnm.CONCEPT_MARKER_RE, bnm.AMBIG_RE


def jl(n):
    return [json.loads(l) for l in (DATA / n).read_text(encoding="utf-8").splitlines() if l.strip()]


paras = jl("paras_all.jsonl")
posts = {p["post_id"]: p for p in jl("posts_all.jsonl")}
layers = jl("node_layers.jsonl")
CONCEPTS = [r["concept"] for r in layers]
BIG = {r["concept"]: r["big"] for r in layers}
CODE = {c: BIG[c].split()[0] for c in CONCEPTS}

# ── 제외 ①: 보류군 = 명리가 아닌 술수 (키셋이 다르다)
HOLD = re.compile(r"^(?:hand|face|taro|pungsu|dang|gusung|mehwa|tojung|name)-|"
                  r"토정비결|타로|관상|수상|풍수|당사주|구성학|매화역수|작명|플러스작명|지문학")
# ── 제외 ②: 격자(운세) = 보일러플레이트 복제원
GRID = re.compile(r"운세|이달의|경자년|신축년|임인년|계묘년|갑진년|을사년|병오년")

# ── 조건 표지 (관측 가능한 것만. «환경»처럼 못 재는 것은 안 넣는다)
COND_KINDS = [
    ("자리", re.compile(r"연주|월주|일주|시주|연간|월간|일간|시간|연지|월지|일지|시지|천간에|지지에|지장간")),
    ("강약", re.compile(r"신강|신약|과다|지나치|많으면|없으면|약하면|강하면|태과|불급|고립")),
    ("음양", re.compile(r"양간|음간|양지|음지|양월|음월|양남|음녀")),
    ("합충", re.compile(r"합이?\s*되|충이?\s*되|충하|형이?\s*되|극하|합으로|충으로")),
    ("운",   re.compile(r"대운|세운|연운|월운|운에서|운이\s*오|들어오면")),
    ("오행", re.compile(r"목오행|화오행|토오행|금오행|수오행|목이|화가|토가|금이|수가")),
    ("통근", re.compile(r"통근|투출|투간|뿌리")),
    ("시기", re.compile(r"\d+\s*대|초년|중년|노년|말년|어릴|나이")),
]
# ── 분기 접속 (두 조건절을 잇는 자리)
SPLIT = re.compile(r"(?:,\s*|\s(?:반면|반대로|한편|그러나|하지만)\s)")
IF = re.compile(r"(?:으?면|일\s*때|인\s*경우|이라면|라면|하면)")

# ── 순수 결정론 표지 (캐면 안 되는 것 — 이미 100% 안다)
PURE = re.compile(
    # 계산 절차 (만세력 층)
    r"시천간|월두법|시두법|둔월|둔시|60갑자\s*순서|순서대로\s*배열|갑자순|"
    # ★십성 산출표 — 「일간이 X면 Y가 비견/식신…」은 규칙이지 관계 발견이 아니다
    r"일간이\s*\S{1,4}(?:이?면|일\s*때).{0,40}(?:비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인)|"
    r"(?:비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인)(?:입니다|이 된다|이 됩니다)$|"
    # ★십이운성 배정표 — 「일간 X, 지지 Y면 절/장생…」
    r"(?:장생|목욕|관대|건록|제왕|쇠|병|사|묘|절|태|양)(?:\s*\(|의\s*에너지|에\s*해당)|"
    # 공망·순중·지장간 비율 같은 표 낭독
    r"공망은\s*술해|천간\s*10개.*지지\s*12개|지장간.{0,20}\d+\s*%|여기.{0,10}중기.{0,10}정기")
NOISE = re.compile(r"구독|좋아요|카페|수강|후원|계좌|클릭|댓글|안녕하세|감사합니")

SENT = re.compile(r"(?<=[.!?])[\s  ]+|\n+")


def concepts_in_text(t):
    out = set()
    for c in CONCEPTS:
        m = MARK.get(c)
        if not m:
            continue
        mm = m.search(t)
        if not mm:
            continue
        if mm.group() in AMBIG and not AMBIG[mm.group()].search(t):
            continue
        out.add(c)
    return out


HAVE = re.compile(r"(?:있|없|오|들어오|만나|위치하|자리하)(?:으?면|다면|을\s*때|는\s*경우)")

# ⛔담화표지 — 「~을 보면」「예를 들면」「따지면」은 **조건이 아니라 화제 제시**다.
#   페이블 감사(260726): "「-면」은 조건 전용이 아니다. 담화표지·화제제시가 가짜 트리거로 선다."
#   실측: 간선으로 올라간 카드 498개 중 **48개(10%)**가 이 꼴이었다.
#     「십신을 보면」 · 「예를 들면 식상 세운일 때」 · 「암록과 직업을 살펴보면」
#   ⚠`HAVE`에서 `보`를 뺀 이유도 이것 — 「보면」이 «개념존재» 조건으로 세어지고 있었다.
DISCOURSE = re.compile(r"보면|보시면|보자면|예를?\s*들|말하자면|따지면|치면|생각하면|"
                       r"살펴보|따라가면|설명하자면|정리하면|요약하면")

# ★부정 조건 — 「~이 없으면」과 「~이 있으면」은 **반대 방향**이다.
#   페이블 감사: "부정조건을 개념→귀결로 저장하면 극성이 반대로 박힌다."
#   실측: 부정 조건절 35건 중 **34건이 부호 «중립»**으로 저장돼 있었다.
#     「사주원국 8글자에 재성을 의미하는 오행이 없으면 → 고립·불급」이 «중립»
#   → 트리거가 «있음»인지 «없음»인지를 칸으로 뺀다. 이걸 안 하면 지도를 읽는 사람이
#     「재성 → 고립」으로 읽는다. 사실은 「재성**이 없어야** 고립」이다. 정반대다.
NEGCOND = re.compile(r"없(?:으면|다면|을\s*때|는\s*경우)|않(?:으면|다면)|"
                     r"못(?:하면|한다면)|아니(?:면|라면)|안\s*\S{1,4}(?:으?면|다면)")


def conds_in(t, ns=None):
    """조건 종류를 센다.

    ★260726 보정 — «어떤 글자가 있으면» 자체가 조건이다.
      「유금이 있으면 비겁 지향, 사화가 있으면 권력 추구」에서 오른쪽 분기는
      자리·강약 같은 범주 표지가 없지만 **조건이 없는 게 아니라 조건이 개념 그 자체**다.
      그리고 그건 원국 8글자에서 100% 관측된다 — 우리가 받는 가장 단단한 조건이다.
      이걸 안 세면 대칭 분기의 «오른쪽»만 통째로 잘려 나간다.
    """
    out = [k for k, r in COND_KINDS if r.search(t)]
    if ns and HAVE.search(t):
        out.append("개념존재")
    return out


# ── 전사 코퍼스 합류 (260726) ─────────────────────────────────────────
#   전사는 웹의 4.2배(22.6M자)인데 그동안 관계지도가 3건만 먹고 있었다.
#   구어라서 문장부호가 없다 — 종결어미로 끊어야 문장이 나온다.
tspec = importlib.util.spec_from_file_location("ing", HERE / "ingest_transcripts.py")
EOS_SPLIT = re.compile(
    r"(?<=[가-힣])(?:습니다|ㅂ니다|입니다|됩니다|합니다|겠습니다|"
    r"거든요|는데요|네요|군요|잖아요|더라고요|에요|예요|어요|아요|해요|이요|"
    r"죠|지요|구요|고요|까요|을까|나요|는가|는다|한다|된다|이다|"
    r"세요|십시오|보죠|보세요)(?=\s|$)")


def speech_sentences(t):
    out, pos = [], 0
    for m in EOS_SPLIT.finditer(t):
        out.append(t[pos:m.end()].strip()); pos = m.end()
    if pos < len(t):
        out.append(t[pos:].strip())
    return [x for x in out if x]


TP = DATA / "전사_문단.jsonl"
tparas = jl("전사_문단.jsonl") if TP.exists() else []
tposts = {p["post_id"]: p for p in (jl("전사_글.jsonl") if TP.exists() else [])}
# ★구체 출처(저자/채널) — L2와 같은 «출처수 관문»을 L1½에도 걸려면 필요하다.
#   웹/전사 2값만으로는 «몇 개의 입»을 셀 수 없다.
def _who(pid, src):
    if src == "전사":
        return "전사:" + tposts.get(pid.rsplit("-", 1)[0], {}).get("채널", "?")
    q = _WEBPOST.get(pid)
    a = (posts.get(q, {}).get("author") if q else None)
    return "웹:" + (a or str(posts.get(q, {}).get("file", "?"))[:24])


_WEBPOST = {q["para_id"]: q["post_id"] for q in paras}
print(f"코퍼스: 웹 문단 {len(paras):,} · 전사 문단 {len(tparas):,}")

rows, verify, stat = [], [], Counter()
seen = set()


def iter_units():
    """(문장리스트, para_id, 출처) 를 뱉는다. 웹·전사 공통 입구."""
    for q in paras:
        post = posts.get(q["post_id"], {})
        f = post.get("file", "")
        if HOLD.search(f) or GRID.search(f):
            stat["제외:보류군·격자"] += 1
            continue
        if q.get("kind") in ("잡동", "공지", "운세"):
            continue
        full = bnm.para_text(q, posts)
        if not full:
            continue
        g = (q.get("gist") or "").strip()
        body = full[len(g):] if g and full.startswith(g) else full   # ★gist 배제
        yield SENT.split(body), q["para_id"], "웹"
    for q in tparas:
        if tposts.get(q["post_id"], {}).get("보류군"):
            stat["제외:보류군·격자"] += 1
            continue
        yield speech_sentences(q.get("text", "")), q["para_id"], "전사"


for sents, _pid, _src in iter_units():
    for s in sents:
        s = re.sub(r"\s+", " ", unicodedata.normalize("NFC", s)).strip()
        if not (30 <= len(s) <= 240) or NOISE.search(s):
            continue
        # 분기 문장인가 — 조건 어미가 2회 이상
        if len(IF.findall(s)) < 2:
            continue
        parts = [p for p in SPLIT.split(s) if p.strip()]
        if len(parts) < 2:
            continue
        # 앞뒤 두 덩어리로 접는다(3개 이상이면 첫/끝)
        A, B = parts[0], parts[-1]
        nA, nB = concepts_in_text(A), concepts_in_text(B)   # ★개념 먼저 — 조건 판정이 개념에 기댄다
        if not nA or not nB:
            stat["버림:개념없음"] += 1
            continue
        cA, cB = conds_in(A, nA), conds_in(B, nB)
        if not cA or not cB:
            stat["버림:조건없음"] += 1
            continue
        if cA == cB and A.strip() == B.strip():
            continue
        key = hashlib.md5(re.sub(r"[^가-힣]", "", s)[:60].encode()).hexdigest()[:10]
        if key in seen:
            stat["버림:중복"] += 1
            continue
        seen.add(key)
        rec = {"문장": s, "para_id": _pid, "출처": _src, "출처처": _who(_pid, _src),
               "분기A": {"조건": cA, "개념": sorted(nA), "절": A.strip()[:120]},
               "분기B": {"조건": cB, "개념": sorted(nB), "절": B.strip()[:120]},
               "공통개념": sorted(nA & nB), "전체개념": sorted(nA | nB)}
        if PURE.search(s):
            rec["종류"] = "순수결정론"
            verify.append(rec); stat["검증세트"] += 1
        else:
            rec["종류"] = "조건분기"
            rows.append(rec); stat["채택"] += 1

# ── ★출력 = «조건부 변조 카드». 간선 쌍이 아니다.
#    같은 분기에 나온 개념끼리 전부 쌍으로 묶으면 그건 «같은 문장에 나왔다»(표본 1개짜리 L2)에
#    불과하다. F6이 주는 진짜 정보는 «조건이 바뀌면 결과가 바뀐다»는 것이고,
#    그래서 담을 것은 {주체 · 조건 · 부호 · 결과} 네 칸이다.
POS = re.compile(r"대길|길하|좋|유리|순용|발복|성공|안정|덕으로|이롭|반긴|살아나|강해지|올라가")
NEG = re.compile(r"나락|흉|나쁘|불리|역용|실패|불안|갈등|불화|해롭|막히|무너지|약해지|떨어지|주의")


def polarity(t):
    p, n = bool(POS.search(t)), bool(NEG.search(t))
    return "+" if p and not n else ("-" if n and not p else "중립")


# ═══ 등급 — 조용히 버리지 않고 «표시»한다 (260726 어휘 규칙) ═══
#   전사를 합류시키니 정밀도가 웹보다 눈에 띄게 낮았다. 실물에서 확인한 오염 셋:
#     ⓐ 오전사  — 청간(천간) 감목(갑목) 심금(신금) 금료화실(근묘화실) CG에(시지에)
#     ⓑ 부정문  — 「저는 신강, 신약 보지 않습니다」가 형식만 분기다
#     ⓒ 지시어  — 강의는 화면을 보며 말해서 「이거/여기」로 지시한다. 텍스트만으론 착지 불가
#   등급을 나눠야 하는 이유: L1 결정론은 «틀리면 안 되는» 층이다.
#   여기 저신뢰가 섞이면 849개 단단한 간선의 신뢰도까지 같이 내려간다.
DENY = re.compile(r"보지\s*않|안\s*봅?니|않습니다|아닙니다|없습니다|말\s*안|"
                  r"틀렸|아니라고|안\s*씁|쓰지\s*않")
CHAT = re.compile(r"잠시만|글씨|못\s*쓰|죄송|아이고|웃음|하하|여러분|구독|다음\s*시간")
DEIX = re.compile(r"이거|저거|그거|여기|저기|이렇게|저렇게|이쪽|요거|얘가|쟤가")
MISH = re.compile(r"청간|감목|심금|금료|기부값|천수다란|거심리|목국토|초코맥류|음향\s*오행")
# 구어 군더더기 — 「득지했다 그냥 그렇게 말해 그러니까 그냥 그건 그렇게 알고 있으면 돼」
#   같은 절이 조건절로 올라오는 걸 막는다. 조건 어미는 붙어 있지만 조건이 아니다.
FILL = re.compile(r"그냥|그러니까|그렇게|그러면|그런데|이제|말이야|말해|뭐냐|아무튼|"
                  r"그죠|그렇죠|알고\s*있|하여튼|어쨌든|막\s")


def grade(sent, card):
    """상 / 중 / 하 — 그리고 왜 그 등급인지."""
    why = []
    if DENY.search(sent):
        why.append("부정문")
    if CHAT.search(sent):
        why.append("잡담")
    if MISH.search(sent):
        why.append("오전사의심")
    if len(DEIX.findall(sent)) >= 3:
        why.append("지시어과다")
    if not card["트리거"] or not card["귀결"]:
        why.append("트리거·귀결한쪽없음")
    if len(card["조건절"]) < 12:
        why.append("조건절잘림")
    if len(FILL.findall(card["조건절"])) >= 3:      # 조건절이 군더더기로 채워졌다
        why.append("군더더기조건절")
    if DISCOURSE.search(card["조건절"]):            # 「~을 보면」 = 화제 제시지 조건이 아니다
        why.append("담화표지")
    if why:
        hard = {"부정문", "오전사의심", "군더더기조건절", "담화표지"}
        return ("하" if len(why) >= 2 or (hard & set(why)) else "중"), why
    # 상 = 트리거·귀결이 다 서고, 조건이 두 종류 이상 붙고, 조건절이 온전한 것
    return ("상" if len(card["조건"]) >= 2 else "중"), []


# ★방향 — 분기를 IF 어미에서 자른다. 앞=트리거(조건), 뒤=귀결(결과).
#   이 한 칼이 «동시출현»과 «조건부 간선»을 가른다. 자르지 않으면 한 절 안의 개념을
#   전부 무향으로 묶게 되고, 그건 표본 1개짜리 L2 밀착과 다를 게 없다.
IF_CUT = re.compile(r"(?:으?면|일\s*때|인\s*경우|이라면|다면)\s*")


def split_if(clause):
    ms = list(IF_CUT.finditer(clause))
    if not ms:
        return clause, ""
    m = ms[-1]                      # 마지막 조건 어미에서 자른다(중첩 조건은 통째로 트리거)
    return clause[:m.end()], clause[m.end():]


cards = []
for r in rows:
    pa, pb = polarity(r["분기A"]["절"]), polarity(r["분기B"]["절"])
    # 부호가 갈리는 분기 = 가장 값진 것(조건이 결과를 뒤집는다)
    flip = (pa == "+" and pb == "-") or (pa == "-" and pb == "+")
    for br, pol in (("분기A", pa), ("분기B", pb)):
        d = r[br]
        head, tail = split_if(d["절"])
        trig, cons = concepts_in_text(head), concepts_in_text(tail)
        cons -= trig                # 트리거에 이미 선 글자는 귀결로 치지 않는다
        neg = bool(NEGCOND.search(head))
        cd = {"조건": d["조건"], "조건절": head.strip()[:110], "귀결절": tail.strip()[:110],
              # ★«있으면»인가 «없으면»인가 — 이걸 빼면 지도가 방향을 거꾸로 말한다
              "조건극성": ("부재" if neg else "존재"),
              "부호": pol, "트리거": sorted(trig), "귀결": sorted(cons),
              "개념": d["개념"], "짝부호반전": flip,
              "종류": "조건분기", "문장": r["문장"][:170],
              "para_id": r["para_id"], "출처": r.get("출처", "웹"),
              "출처처": r.get("출처처", "?")}
        cd["등급"], cd["감점"] = grade(r["문장"], cd)
        cards.append(cd)

# ── 조건부 간선: 트리거 × 귀결 (방향 있음)
# ★트리거 품질 — 「총칭은 조건이 아니라 맥락이다」
#   실물에서 잡힌 결함: 한 문장 「지장간에 뿌리가 없으면 …」에서
#   천간(총칭)·지지(총칭)·지장간·원국·명식·관성 일반 이 **다섯이 전부 트리거로** 갈라져
#   같은 무게의 간선 5개가 됐다. 그중 진짜 조건은 하나거나 없다.
#   총칭 노드는 사주 이야기라면 어디든 서 있다 — 서 있다는 사실이 정보가 아니다.
#   지우지는 않는다(가끔 진짜 주어다). **무게로 누른다.**
VAGUE = {"오행(총칭)", "천간(총칭)", "지지(총칭)", "원국·명식", "일간", "지장간",
         "사주(용어)", "명리(총칭)"}


def trig_quality(a, n_trig):
    q = 0.45 if a in VAGUE else 1.0          # 총칭이면 절반 아래
    return q / math.sqrt(max(1, n_trig))      # 한 절에서 여럿 갈라지면 각자 몫이 준다


cedges = []
for c in cards:
    if c["등급"] == "하":
        continue                      # 파일(분기변조카드)엔 남는다. 간선으로만 안 올린다.
    nt = len(c["트리거"])
    for a in c["트리거"]:
        for b in c["귀결"]:
            if a == b:
                continue
            cedges.append({"a": a, "b": b, "kind": "조건부", "dir": "→",
                           "polarity": c["부호"], "조건": c["조건"],
                           "조건절": c["조건절"], "para_id": c["para_id"],
                           "출처": c.get("출처", "웹"), "출처처": c.get("출처처", "?"),
                           "등급": c["등급"],
                           "조건극성": c["조건극성"],
                           "트리거품질": round(trig_quality(a, nt), 3),
                           "트리거총칭": a in VAGUE,
                           "간선id": "F-" + hashlib.md5(
                               f"{a}|{b}|{c['para_id']}".encode()).hexdigest()[:8]})
cpair = Counter((e["a"], e["b"]) for e in cedges)
(DATA / "조건부간선.jsonl").write_text(
    "\n".join(json.dumps(x, ensure_ascii=False) for x in cedges) + "\n", encoding="utf-8")

flip_n = sum(1 for c in cards if c["짝부호반전"]) // 2
sign_n = Counter(c["부호"] for c in cards)

(DATA / "분기변조카드.jsonl").write_text(
    "\n".join(json.dumps(x, ensure_ascii=False) for x in cards) + "\n", encoding="utf-8")
edges = cards
pair = Counter()
for c in cards:
    ns = c["개념"]
    for i in range(len(ns)):
        for j in range(i + 1, len(ns)):
            if CODE[ns[i]] != CODE[ns[j]]:
                pair[(ns[i], ns[j])] += 1

(DATA / "분기간선.jsonl").write_text(
    "\n".join(json.dumps(x, ensure_ascii=False) for x in rows) + "\n", encoding="utf-8")
(DATA / "분기간선_검증세트.jsonl").write_text(
    "\n".join(json.dumps(x, ensure_ascii=False) for x in verify) + "\n", encoding="utf-8")

condc = Counter(k for r in rows for br in ("분기A", "분기B") for k in r[br]["조건"])
rep = ["# 분기 간선(F6) 추출 리포트", "",
       f"- 채택 분기 문장 **{len(rows)}** · 순수결정론(검증세트로 분리) {len(verify)}",
       f"- 출처: " + " · ".join(f"{k} {v}" for k, v in
                                Counter(r.get('출처','웹') for r in rows).most_common()),
       f"- 조건부 변조 카드 **{len(cards)}**",
       f"- ★**조건부 간선 {len(cedges)}** (트리거→귀결, 방향 있음) · 고유쌍 **{len(cpair)}**",
       f"- 카드 등급: " + " · ".join(f"{k} {v}" for k, v in
                                   Counter(c['등급'] for c in cards).most_common()),
       f"- 조건극성: " + " · ".join(f"{k} {v}" for k, v in
                                  Counter(c['조건극성'] for c in cards).most_common())
       + "  ← «없으면»을 «있으면»과 같이 저장하면 지도가 방향을 거꾸로 말한다",
       f"- 등급«하» 감점 사유: " + " · ".join(f"{k} {v}" for k, v in
                                   Counter(w for c in cards for w in c['감점']).most_common()),
       f"- 부호: + {sign_n['+']} · − {sign_n['-']} · 중립 {sign_n['중립']}",
       f"- ★**부호가 뒤집히는 분기 {flip_n}쌍** — 조건이 결과를 반전시키는 실물",
       f"- 버림: " + " · ".join(f"{k} {v}" for k, v in stat.items() if k.startswith("버림")),
       "", "## 조건 종류 분포", "", "| 조건 | 건수 |", "|---|---:|"]
for k, v in condc.most_common():
    rep.append(f"| {k} | {v} |")
rep += ["", "## 최다 조건부 간선 20 (트리거 → 귀결)", "", "| 트리거 | 귀결 | 건수 |", "|---|---|---:|"]
for (a, b), n in cpair.most_common(20):
    rep.append(f"| {a} | {b} | {n} |")
(DATA / "분기간선_리포트.md").write_text("\n".join(rep) + "\n", encoding="utf-8")

print(f"채택 분기 문장 {len(rows)} · 검증세트 {len(verify)}")
print("출처:", dict(Counter(r.get('출처','웹') for r in rows).most_common()))
print(f"조건부 변조 카드 {len(cards)}")
print("카드 등급:", dict(Counter(c['등급'] for c in cards).most_common()))
print("감점 사유:", dict(Counter(w for c in cards for w in c['감점']).most_common()))
print(f"★조건부 간선 {len(cedges)} (등급 하 제외) · 고유쌍 {len(cpair)}")
print("  간선 출처×등급:", dict(Counter(f"{e['출처']}/{e['등급']}" for e in cedges).most_common()))
print(f"부호: + {sign_n[chr(43)]} · − {sign_n[chr(45)]} · 중립 {sign_n['중립']} · ★부호반전 분기 {flip_n}쌍")
print("버림:", {k: v for k, v in stat.items() if k.startswith("버림")})
print("조건 분포:", dict(condc.most_common()))
print("→", DATA / "분기간선.jsonl")
