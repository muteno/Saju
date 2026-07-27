# -*- coding: utf-8 -*-
"""
실전 쓰임 빌더 — 전사(유튜브)를 다시 정제해 «개념이 실제로 어떻게 쓰이는가»를 뽑는다.

운영자 지시(260726):
  "정의 자체는 기본에 이미 많을텐데, 전사된 내용을 정제한거랑 전사한거
   이제 다시 정제한다음에 볼까?"

★왜 이게 필요한가 (실측):
  문단 38,072 = 웹 19,253 + 전사 18,819 로 거의 반반인데 **성격이 완전히 다르다.**
    웹  : 이론 7,424 · 결정론 3,625 · 화법 1,280      → 정의와 논리의 뼈대
    전사: 이론 8,627 · 결정론 7,465 · 화법 1,943      → 판단과 화법의 살
                       프로브 425 · 역추론 130
  그런데 전사는 문장부호가 없어서 «정의»를 못 준다(정의 공급 저자에서 도화도레 17개뿐).
  → 전사에서 뽑을 것은 정의가 아니라 **조건→결론 판단 규칙과 실전 화법**이다.

★재료 = P0 gist.
  운영자가 "인용하거나 원본글에 대한 소스를 담아줄 필요없음"이라고 정한 뒤로
  gist(우리가 P0에서 붙인 압축 요약)를 그대로 쓸 수 있게 됐다.
  전에는 gist를 «저자 축자»로 위장하는 게 문제였는데, 이제 축자를 표방하지 않으므로
  gist는 **이미 정제된 지식 38,072줄**이다. 실물:
    "남=재성, 여=관성 위치—연·월주면 연상, 시주면 연하"
    "장성살=입신양명 장군, 자오묘유 왕지—과강시 독선·외로움"

출력: data/실전쓰임.jsonl   {concept, 판단:[...], 화법:[...], 프로브:[...]}
"""
import json, re, sys, importlib.util, unicodedata
from pathlib import Path
from collections import defaultdict, Counter

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location("bnm", HERE / "build_neuron_map.py")
bnm = importlib.util.module_from_spec(spec); spec.loader.exec_module(bnm)
MARK = bnm.CONCEPT_MARKER_RE
AMBIG = bnm.AMBIG_RE


def jl(n):
    return [json.loads(l) for l in (DATA / n).read_text(encoding="utf-8").splitlines() if l.strip()]


paras = jl("paras_all.jsonl")
posts = {p["post_id"]: p for p in jl("posts_all.jsonl")}
CONCEPTS = [r["concept"] for r in jl("node_layers.jsonl")]
CSET = set(CONCEPTS)

WEB = {"현묘", "안녕,사주명리(현묘)", "초코서당", "사공", "명리학탐구", "플러스명리학", "도화로운"}

# ── 판단 규칙 문형 (조건 → 결론). 전사 gist는 `—`·`,`로 조건과 결론을 나눠 적는 습관이 있다.
COND = re.compile(r"(?:면|하면|있으면|없으면|올\s*때|인\s*경우|일\s*때|되면|많으면|강하면|약하면"
                  r"|시\s|때\s|→|⇒|=>)")
NOISE = re.compile(r"(?:인트로|아웃트로|공지|구독|좋아요|멤버십|광고|인사|잡담|BGM|무발화"
                   r"|메타데이터|헤더|자동전사|목차|채널\s*소개|다음\s*영상|예고)")
# 우리가 붙인 잡동 라벨은 지식이 아니다
DROP_KIND = {"잡동", "공지"}


def clean(g):
    g = unicodedata.normalize("NFC", g or "").strip()
    g = re.sub(r"\s+", " ", g)
    return g


def score(g, kind, flags):
    if not (12 <= len(g) <= 120) or NOISE.search(g):
        return 0.0
    s = 0.0
    if COND.search(g):
        s += 3.0                      # 조건→결론이 있으면 판단 규칙이다
    if "—" in g or "·" in g:
        s += 0.6                      # 압축 표기 = 정보 밀도 높음
    if "결정론" in flags:
        s += 1.6
    if "수치" in flags:
        s += 0.8
    if kind == "이론":
        s += 0.8
    elif kind == "사례":
        s += 0.5
    if "별점" in flags:
        s += 0.3
    return s


usage = defaultdict(lambda: {"판단": [], "화법": [], "프로브": []})
n_tr = 0
for q in paras:
    post = posts.get(q["post_id"], {})
    if post.get("author") in WEB:            # 전사만 — 웹은 이미 정의로 뽑았다
        continue
    kind = q.get("kind", "")
    if kind in DROP_KIND:
        continue
    n_tr += 1
    g = clean(q.get("gist"))
    if not g:
        continue
    flags = q.get("flags", [])
    hits = {c for c in CONCEPTS if (m := MARK.get(c)) and m.search(g)
            and not (m.search(g).group() in AMBIG and not AMBIG[m.search(g).group()].search(g))}
    if not hits:
        continue
    sc = score(g, kind, flags)
    for c in hits:
        if "프로브" in flags:
            usage[c]["프로브"].append((sc + 1.0, g))
        elif kind == "화법" or "게이트" in flags:
            usage[c]["화법"].append((sc + 0.5, g))
        elif sc >= 3.0:
            usage[c]["판단"].append((sc, g))

out = []
stat = Counter()
for c in CONCEPTS:
    row = {"concept": c}
    for k in ("판단", "화법", "프로브"):
        lst = sorted(usage[c][k], key=lambda t: -t[0])
        seen, pick = set(), []
        for s, g in lst:
            key = re.sub(r"[^가-힣]", "", g)[:14]
            if key in seen:
                continue
            seen.add(key); pick.append(g)
            if len(pick) >= (10 if k == "판단" else 5):
                break
        row[k] = pick
        stat[k] += len(pick)
    row["총량"] = sum(len(usage[c][k]) for k in ("판단", "화법", "프로브"))
    out.append(row)

p = DATA / "실전쓰임.jsonl"
p.write_text("\n".join(json.dumps(o, ensure_ascii=False) for o in out) + "\n", encoding="utf-8")
have = sum(1 for o in out if o["판단"] or o["화법"] or o["프로브"])
print(f"전사 문단 {n_tr:,} 훑음")
print(f"실전 쓰임 보유 개념 {have}/{len(CONCEPTS)} · 채택 판단 {stat['판단']} · 화법 {stat['화법']} · 프로브 {stat['프로브']}")
print("→", p)
