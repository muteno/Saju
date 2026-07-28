# -*- coding: utf-8 -*-
"""
발현 채굴 — 「구조 → **왜** → 결과」 3단을 코퍼스에서 캔다.

═══ 왜 여기를 파는가 ═══
  근거사슬 실측(260726): 해석 간선 954건 중 **인과닫힘 12건(1%)**.
  공리(생·극·소속·지장간·조견표)는 461개로 두꺼운데
  **「그래서 사람에게 어떻게 나타나나」를 잇는 고리가 73개뿐**이다(발현 34·적용 22·귀결 17).
  → 낭설후보 542의 대부분이 여기서 막힌다. **인과 고리가 지도 전체를 여는 열쇠다.**

═══ 경계선 — 여기가 「임수2 = 유학」이 태어나는 자리다 ═══
  페이블 감사(260726): **"조견표(입력→글자)까지는 «적기», 글자→삶의 부호(+/−)부터는 창작이다."**
  운영자: *"관계를 정의해야지 **의미를 정의해버리면 절대안돼**."*
  그래서 이 도구는 **결론을 캐지 않는다. «이유가 붙은 결론»만 캔다.**
    ⛔「편관이 많으면 사업이 맞다」          — 이유 없음. 버린다.
    ⭕「순리(아내가 어머니를 극하는 것)에 어긋나기 **때문에** 결혼이 순탄치 않다」
       — 이유절에 «재성 극 인성»이라는 **L1 관계**가 명시돼 있다. 캔다.

═══ 세 칸을 다 채워야 한다 ═══
  [구조] 원인 쪽 개념 (원국에서 관측되는 것)
  [기전] **왜 그렇게 되는가** — 이유절. L1 관계어가 들어 있어야 한다.
  [발현] S15 결과 노드
  하나라도 비면 버린다. 특히 **[기전]이 비면 그게 낭설**이다.

═══ 캐지 않는 것 ═══
  · 이유 표지가 없는 문장(「그래서·니까」는 구어 추임새라 안 친다 — F6에서 검증된 교훈)
  · 이유절에 명리 개념이 없는 것 (「좋으니까」는 이유가 아니다)
  · 부정문·잡담·지시어 과다·오전사 의심 (F6 등급기 재사용)

출력: data/발현카드.jsonl · data/발현_리포트.md
"""
import json, re, sys, unicodedata, importlib.util, hashlib
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


def jl(n):
    p = DATA / n
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()] \
        if p.exists() else []


lay = {r["concept"]: r for r in jl("node_layers.jsonl")}
BIG = {c: v.get("big", "") for c, v in lay.items()}
S15 = {c for c, b in BIG.items() if b.startswith("S15")}
# ★260727 — **육친 4종을 «착지점»으로도 연다.**
#   실측: 발현 채굴 탈락 33,915건 중 **31,177건(91.9%)이 «발현없음»**이었다. 착지할 자리가
#   없어서다. 그런데 후보를 캐 보니 상위가 형제·동료 500 · 자식 494 · 부모 468 · 배우자 379로
#   **전부 이미 S05 육친에 있는 노드**였다.
#   ⛔그래서 S15에 같은 이름을 새로 세우지 않았다 — 그건 노드 고유성 위반이다
#     (「수옥살」이 별칭이면서 별도 노드로도 있는, 260726에 미해결로 등재된 그 형태).
#   → **노드는 그대로 두고, 여기서만 «발현으로도 읽는다».** 한 개념이 두 얼굴을 갖는 게
#     아니라, «구조 쪽에서 보면 육친, 결과 쪽에서 보면 겪는 일»이라 축이 다를 뿐이다.
#   ⚠위험: 「인성 = 어머니」식 **매핑 정의**가 발현으로 위장해 들어온다(위원 실측 오탐 46%).
#     그건 이 파일의 «기전 필수» 규칙이 막는다 — 매핑 문장엔 생·극이 없다.
#     그리고 배선 단계(`build_relation_edges.py`)가 기전에 관계어가 있는지 한 번 더 묻는다.
_YUKCHIN = {"배우자", "부모", "자녀", "형제·동료"}
S15 |= {c for c in _YUKCHIN if c in lay}
# 인명·화법은 원인이 아니다 (역추론 색인과 같은 기준)
NOT_CAUSE = {c for c, b in BIG.items() if b.startswith(("S11", "S12"))}

# ── 이유 표지 — **강한 것만.** 「그래서·니까」는 구어 추임새다(F6에서 실측).
WHY = re.compile(r"때문(?:에|이)|하므로|으므로|까닭|이유는|이유가|왜냐하?면|"
                 r"(?:라서|이라서)\s|해서\s그|덕분(?:에|이)|탓(?:에|이)")
# ── 기전어 — 이유절에 **L1 관계**가 있어야 «왜»가 성립한다
# ★260728 V1 위원 적발 수리 — 옛 어휘의 구조적 오탐 4종을 경계로 막는다:
#   「발생하기」←생하 · 「궁합이」←합이 · 「우왕좌왕」←왕 · 「생극제화」←화(하|해).
#   V1 실측: 이 오탐들 때문에 기계 채택 34건 중 17건(50%)이 눈검수에서 기각됐다.
#   ⚠「왕」 단독·「과다·고립」은 **상태어**지 관계어가 아니다 — 왕은 신왕/왕지/왕하 형태만.
MECH = re.compile(r"(?<![발파])생하|생해|극하|극해|설기|설하|합하|(?<![궁])합이|충하|충이|형하|파하|"
                  r"뿌리|통근|투출|투간|신왕|왕지|왕하|약해|강해|과다|태과|고립|불급|"
                  r"제어|제복|눌러|막아|끌어|빼|더해|보태|중화|균형|조후|"
                  r"상생|상극|비화|제화|(?<![제])화(?:하|해)")
NOISE = re.compile(r"구독|좋아요|카페|수강|후원|계좌|클릭|댓글|안녕하세|감사합니|다음\s*시간")
DENY = re.compile(r"보지\s*않|안\s*봅?니|않습니다|아닙니다|틀렸|아니라고")
DEIX = re.compile(r"이거|저거|그거|여기|저기|이렇게|저렇게|얘가|쟤가")
MISH = re.compile(r"청간|감목|심금|금료|기부값|천수다란|거심리|목국토|초코맥류")
EOS = re.compile(r"(?<=[.!?])[\s ]+|(?<=니다)\s+|(?<=에요)\s+|(?<=예요)\s+|(?<=거든요)\s+")


def concepts(t):
    out = set()
    for c, m in bnm.CONCEPT_MARKER_RE.items():
        mm = m.search(t)
        if not mm:
            continue
        if mm.group() in bnm.AMBIG_RE and not bnm.AMBIG_RE[mm.group()].search(t):
            continue
        out.add(c)
    return out


rows, stat, seen = [], Counter(), set()
for r in CP.문단들():
    for s in EOS.split(r["text"]):
        s = re.sub(r"\s+", " ", unicodedata.normalize("NFC", s)).strip()
        if not (40 <= len(s) <= 240) or NOISE.search(s):
            continue
        m = WHY.search(s)
        if not m:
            continue
        pre, post = s[:m.start()], s[m.end():]
        # ★기전절을 **절 단위로 좁힌다.** 그냥 「WHY 표지 앞 110자」로 자르면
        #   문장 경계를 넘어 「합이 좋다 안 좋다 이런 걸 논하기는 어렵고요 …기」 처럼
        #   앞 문장 꼬리가 딸려 온다. 그러면 «기전»이 아니라 «잡음»을 근거로 삼게 된다.
        #   → 마지막 절 경계(쉼표·연결어미) 뒤부터만 취한다.
        _cut = max(pre.rfind(x) for x in (", ", "요 ", "죠 ", "고 ", "며 ", "면 ", "데 "))
        mech_clause = pre[_cut + 1:] if _cut > 20 else pre
        # [기전] — **좁힌 절 안에** L1 관계어가 있어야 «왜»다
        if not MECH.search(mech_clause):
            stat["버림:기전없음"] += 1
            continue
        cs = concepts(s)
        res = cs & S15
        if not res:
            stat["버림:발현없음"] += 1
            continue
        cause = {c for c in concepts(mech_clause) if c not in S15 and c not in NOT_CAUSE}
        if not cause:
            stat["버림:구조없음"] += 1
            continue
        why = []
        if DENY.search(s):
            why.append("부정문")
        if MISH.search(s):
            why.append("오전사의심")
        if len(DEIX.findall(s)) >= 3:
            why.append("지시어과다")
        if why:
            stat["버림:" + why[0]] += 1
            continue
        k = hashlib.md5(re.sub(r"[^가-힣]", "", s)[:60].encode()).hexdigest()[:10]
        if k in seen:
            stat["버림:중복"] += 1
            continue
        seen.add(k)
        rows.append({"구조": sorted(cause), "기전": mech_clause.strip()[-110:],
                     "발현": sorted(res), "결과절": post.strip()[:110],
                     "문장": s[:200], "출처": r["출처"], "출처종": r["출처종"],
                     "para_id": r["para_id"]})
        stat["채택"] += 1

# ── 간선 후보: 구조 × 발현 (기전이 붙은 것만)
edges = defaultdict(list)
for x in rows:
    for a in x["구조"]:
        for b in x["발현"]:
            edges[(a, b)].append(x)

cards = []
for (a, b), xs in sorted(edges.items(), key=lambda t: -len(t[1])):
    srcs = sorted({x["출처"] for x in xs})
    cards.append({"a": a, "b": b, "표본": len(xs), "출처수": len(srcs),
                  "출처": srcs[:5], "교차확인": len(srcs) >= 2,
                  "기전": [x["기전"] for x in xs[:3]],
                  "문장": [x["문장"] for x in xs[:2]],
                  "para_id": [x["para_id"] for x in xs[:3]]})

(DATA / "발현카드.jsonl").write_text(
    "\n".join(json.dumps(x, ensure_ascii=False) for x in cards) + "\n", encoding="utf-8")

byres = Counter(b for _a, b in edges)
bysrc = Counter(x["출처종"] for x in rows)
cross = [c for c in cards if c["교차확인"]]

L = ["# 발현 채굴 — 「구조 → **왜** → 결과」", "",
     "> 근거사슬 실측: 해석 간선 954건 중 **인과닫힘 12건(1%)**. 인과 고리가 **73개뿐**이라",
     "> 낭설후보 542의 대부분이 여기서 막힌다. 그 고리를 코퍼스에서 캔다.", "",
     "**결론을 캐지 않는다. «이유가 붙은 결론»만 캔다.**",
     "이유절에 L1 관계어(생·극·합·충·통근·과다…)가 없으면 버린다 — 그게 낭설이다.", "",
     f"- 채택 **{stat['채택']}문장** → 간선 후보 **{len(cards)}쌍** · "
     f"교차확인(2곳 이상) **{len(cross)}**",
     f"- 출처: " + " · ".join(f"{k} {v}" for k, v in bysrc.most_common()),
     f"- 버림: " + " · ".join(f"{k[3:]} {v}" for k, v in stat.items() if k.startswith("버림")),
     "", "## 발현별 후보 수", "", "| 발현 | 쌍 |", "|---|---:|"]
for b, n in byres.most_common():
    L.append(f"| {b} | {n} |")

L += ["", "## ★교차확인된 것 (2곳 이상에서 같은 구조→발현)", ""]
if cross:
    L += ["| 구조 | 발현 | 표본 | 출처 | 기전(왜) |", "|---|---|---:|---:|---|"]
    for c in sorted(cross, key=lambda x: -x["표본"])[:40]:
        L.append(f"| {c['a']} | {c['b']} | {c['표본']} | {c['출처수']} | {c['기전'][0][-60:]} |")
else:
    L.append("*없음*")

L += ["", "## 표본 — 기전이 살아 있는 문장 20", ""]
for x in sorted(rows, key=lambda r: -len(r["기전"]))[:20]:
    L += [f"**{' · '.join(x['구조'][:3])} → {' · '.join(x['발현'])}** <sub>{x['출처']}</sub>", "",
          f"> {x['문장']}", ""]
(DATA / "발현_리포트.md").write_text("\n".join(L) + "\n", encoding="utf-8")

with 단계("발현 채굴", "인과 고리 73개가 최대 병목 — 「이유가 붙은 결론」만 코퍼스에서 캔다",
        ["data/발현카드.jsonl", "data/발현_리포트.md"]) as st:
    st.기록(f"채택 {stat['채택']}문장 → 간선후보 {len(cards)}쌍 · 교차확인 {len(cross)}")
    st.기록(f"출처 {dict(bysrc)}")
    st.기록("버림: " + str({k[3:]: v for k, v in stat.items() if k.startswith('버림')}))

print(f"발현 채굴 — 채택 {stat['채택']}문장 · 간선후보 {len(cards)}쌍 · 교차확인 {len(cross)}")
print("  출처:", dict(bysrc))
print("  버림:", {k[3:]: v for k, v in stat.items() if k.startswith("버림")})
print("  발현별:", dict(byres.most_common()))
