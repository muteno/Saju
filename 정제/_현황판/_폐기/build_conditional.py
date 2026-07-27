# -*- coding: utf-8 -*-
"""
조건부 작용 빌더 — 전사에서 «관계»를 뽑는다. 의미를 못 박지 않는다.

═══ 왜 앞선 build_usage.py를 폐기했는가 (260726, 운영자 지적) ═══

  운영자: "무토2, 경금2, 임수2 이런거는 진짜 귀엽게 해석한거야. 그럼 임수2인 사람은
          뭐 다 유학가겠네. 그게 투출이 어떻게 했고, 대운이 어떻게 왔고, 주변의
          사주팔자 기운을 어떻게 받아서 글자가 힘을 얻고 이런게 다 영향이 있어야되고,
          거기에 합과 충의 상태는 어떻고, 본인이 그걸 발현할 수 있는 환경은 되었고
          그런 복합적인게 다 고려되어야되는데, 임수2 < 어 해외갔네. 이거는 거의 뭐
          지금 정제한 이유가 없지"
  운영자: "저렇게 '정의'를 해버리면 **관계를 정의해야지 의미를 정의해버리면 절대안돼.**"

  ★진단: gist는 «결론만 남긴 압축»이다. 그걸 판단 규칙으로 쓰면 조건이 통째로 날아간다.
    실제 원문(ST-P0078-04)에는 조건이 다 있었다 —
      양간은 기본적으로 이동이 크다 → 무토=넓은 땅 → 나란히 둘이면 기운 증폭
      → 해외 가능성  ⟨단, 화개살이 중중하면 스님으로 갈린다 = 분기⟩
      → 하나만 있어도 운에서 다시 들어오면 멀리 이동
      → 원국 둘 + 대운 겹침(10년 중 5년) → 그 시기에 유학
    gist에는 마지막 결론만 남았다. **그래서 gist로 판단을 만들면 안 된다.**

  → 이 빌더는 **본문에서** 조건이 붙은 문장만 뽑고, **조건이 없으면 버린다.**
    조건이 없는 문장은 «의미 정의»가 되기 때문이다(보드 1-13·1-15·1-23 금지 대상).

═══ 담는 것 ═══
  조건부 작용 = {주체 개념} + {조건들} → {작용/결과}   · 분기가 있으면 함께
  · 조건 2개 이상 = 복합 조건 (이게 진짜 판단이다)
  · 조건 1개      = 단서 (약한 신호. 규칙이라 부르지 않는다)
  · 조건 0개      = **버린다**

출력: data/조건부작용.jsonl
"""
import json, re, sys, importlib.util, unicodedata
from pathlib import Path
from collections import defaultdict, Counter

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location("bnm", HERE / "build_neuron_map.py")
bnm = importlib.util.module_from_spec(spec); spec.loader.exec_module(bnm)
bnm.SNAP_DIRS = bnm._snapshot_dirs()
MARK = bnm.CONCEPT_MARKER_RE
AMBIG = bnm.AMBIG_RE


def jl(n):
    return [json.loads(l) for l in (DATA / n).read_text(encoding="utf-8").splitlines() if l.strip()]


paras = jl("paras_all.jsonl")
posts = {p["post_id"]: p for p in jl("posts_all.jsonl")}
CONCEPTS = [r["concept"] for r in jl("node_layers.jsonl")]
WEB = {"현묘", "안녕,사주명리(현묘)", "초코서당", "사공", "명리학탐구", "플러스명리학", "도화로운"}

# ── 조건 표지 (이게 있어야 «관계»다)
CONDS = [
    ("구조", re.compile(r"나란히|병존|두\s*개가|옆에|붙어\s*있|투출|투간|통근|뿌리")),
    ("합충", re.compile(r"합이?\s*되|충이?\s*되|충하|형이?\s*되|극하|극을\s*받|합충")),
    ("운",   re.compile(r"대운|세운|연운|월운|운에서|운이\s*오|운이\s*들어|들어오면|들어오게")),
    ("자리", re.compile(r"월지|일지|연지|시지|월주|일주|연주|시주|일간|월간|자리에")),
    ("강약", re.compile(r"신강|신약|강하면|약하면|많으면|적으면|중중|과다|왕하")),
    ("계절", re.compile(r"월생|계절|겨울|여름|봄|가을|조후|한난")),
]
# ── 조건절 어미 (문장이 «조건→결과» 꼴인가)
IF = re.compile(r"(?:으?면|을\s*때|인\s*경우|하다면|이라면|있다면|되면|온다면|겹치면|한다면)")
# ── 결과 표지
THEN = re.compile(r"(?:가능성|확률|경향|보시면|봅니다|판단|해석|나타나|드러나|생깁|됩니다|합니다|많습|크|위험|주의)")
# ── 분기·예외 표지 (★이게 있으면 «결론이 갈린다»는 뜻 — 가장 값진 신호)
BRANCH = re.compile(r"(?:그런데|다만|단\s|하지만|반면|예외|따로\s*있|아닌\s*경우|경우는\s*또|"
                    r"오히려|반대로|갈리|달라집|달라져)")
NOISE = re.compile(r"(?:구독|좋아요|멤버십|채널|다음\s*영상|인사|광고|링크|댓글|기절)")

SENT_END = re.compile(r"(?:다|요|죠|까)[.?!]|[.?!]\s")


def sentences(body):
    """캡션은 줄바꿈이 잦아 한 문장이 여러 줄에 걸린다 — 종결어미까지 이어 붙인다."""
    buf, out = [], []
    for ln in body.split("\n"):
        ln = ln.strip()
        if not ln:
            continue
        buf.append(ln)
        if re.search(r"(?:다|요|죠|까)[.?!]?$", ln) and sum(len(x) for x in buf) >= 18:
            out.append(" ".join(buf)); buf = []
    if buf:
        out.append(" ".join(buf))
    return [unicodedata.normalize("NFC", re.sub(r"\s+", " ", s)).strip() for s in out]


cards = defaultdict(list)
n_para = n_sent = n_drop_nocond = 0
for q in paras:
    post = posts.get(q["post_id"], {})
    if post.get("author") in WEB or q.get("kind") in ("잡동", "공지"):
        continue
    full = bnm.para_text(q, posts)
    if not full:
        continue
    g = (q.get("gist") or "").strip()
    body = full[len(g):] if g and full.startswith(g) else full   # ★gist 제외 — 본문만
    if not body.strip():
        continue
    n_para += 1
    for s in sentences(body):
        if not (30 <= len(s) <= 260) or NOISE.search(s):
            continue
        n_sent += 1
        if not (IF.search(s) and THEN.search(s)):
            n_drop_nocond += 1
            continue
        kinds = [k for k, r in CONDS if r.search(s)]
        if not kinds:
            n_drop_nocond += 1
            continue
        hits = set()
        for c in CONCEPTS:
            m = MARK.get(c)
            if not m:
                continue
            mm = m.search(s)
            if not mm:
                continue
            if mm.group() in AMBIG and not AMBIG[mm.group()].search(s):
                continue
            hits.add(c)
        if not hits:
            continue
        rec = {"문장": s, "조건": kinds, "분기": bool(BRANCH.search(s)),
               "para_id": q["para_id"]}
        for c in hits:
            cards[c].append(rec)

out, stat = [], Counter()
for c in CONCEPTS:
    lst = cards.get(c, [])
    # 조건 많은 것 → 분기 있는 것 → 긴 것 순
    lst.sort(key=lambda r: (-len(r["조건"]), -r["분기"], -len(r["문장"])))
    seen, pick = set(), []
    for r in lst:
        k = re.sub(r"[^가-힣]", "", r["문장"])[:18]
        if k in seen:
            continue
        seen.add(k); pick.append(r)
        if len(pick) >= 12:
            break
    복합 = [r for r in pick if len(r["조건"]) >= 2]
    단서 = [r for r in pick if len(r["조건"]) == 1]
    stat["복합"] += len(복합); stat["단서"] += len(단서)
    stat["분기"] += sum(1 for r in pick if r["분기"])
    out.append({"concept": c, "복합조건": 복합, "단서": 단서, "총후보": len(lst)})

p = DATA / "조건부작용.jsonl"
p.write_text("\n".join(json.dumps(o, ensure_ascii=False) for o in out) + "\n", encoding="utf-8")
have = sum(1 for o in out if o["복합조건"] or o["단서"])
print(f"전사 문단 {n_para:,} · 문장 {n_sent:,}")
print(f"조건 없어 버린 문장 {n_drop_nocond:,} ({n_drop_nocond/max(1,n_sent)*100:.1f}%)  ← 이것들이 «의미 정의»가 될 뻔한 것")
print(f"보유 개념 {have}/{len(CONCEPTS)} · 복합조건 {stat['복합']} · 단서 {stat['단서']} · 분기 포함 {stat['분기']}")
print("→", p)
