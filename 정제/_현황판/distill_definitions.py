# -*- coding: utf-8 -*-
"""
정의 증류기 (U-DEF v1) — 개념 249개의 «한 줄 정의»를 코퍼스 축자로 채운다.

원칙(프로젝트 절대원칙 계승):
  · 정의는 **저자의 문장 그대로** 쓴다. 우리 말로 다시 쓰면 근거가 사라진다.
  · 못 찾으면 없다고 말한다. 지어내지 않는다.
  · 개념 사전·마커는 build_concept_map.py 정본을 재사용(적중률 검증된 것).

출력: data/정의카드.jsonl   {concept, defs:[{quote, author, title, para_id, score, kind}], 상태}
"""
import json, re, sys, unicodedata, importlib.util
from pathlib import Path
from collections import defaultdict, Counter

HERE = Path(r"C:\Users\Hwang\OneDrive - GS칼텍스 예울마루\황세웅\6.  Nomute\3. 사주\2. 정제작업\_현황판")
DATA = HERE / "data"

# ── 기존 빌더를 모듈로 로드해 마커·원문읽기 재사용
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location("bnm", HERE / "build_neuron_map.py")
bnm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bnm)
bnm.SNAP_DIRS = bnm._snapshot_dirs()
MARK = bnm.CONCEPT_MARKER_RE
AMBIG = bnm.AMBIG_RE

paras = [json.loads(l) for l in (DATA / "paras_all.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
posts = {p["post_id"]: p for p in
         (json.loads(l) for l in (DATA / "posts_all.jsonl").read_text(encoding="utf-8").splitlines() if l.strip())}
layers = [json.loads(l) for l in (DATA / "node_layers.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
CONCEPTS = [r["concept"] for r in layers]

# 웹 저자 = 문장부호가 있는 글. 전사(유튜브)는 문장부호가 없어 정의 추출이 원리상 약하다.
WEB_AUTHORS = {"현묘", "안녕,사주명리(현묘)", "초코서당", "사공", "명리학탐구",
               "플러스명리학", "도화로운"}

# ── 정의 문형 (한국어)
DEF_PAT = [
    (re.compile(r"(?:이란|란)\s"), 3.2),
    (re.compile(r"라(?:고|)\s*(?:합니다|한다|부릅니다|부른다|말합니다|말한다|하죠|해요)"), 3.0),
    (re.compile(r"(?:을|를)\s*(?:뜻|의미|가리킵|말합|말한)"), 2.8),
    (re.compile(r"(?:이라는|라는)\s*(?:뜻|의미|말)"), 2.6),
    # ★260726 추가 — 전사(구어)에서 정의는 이 꼴로 나온다. 이걸 빼서 점수론(110점)을 놓쳤다:
    #   "이 세밀하게 보는 방법이 바로 점수론이라는 거에요"(도화도레 DT-P041-02)
    (re.compile(r"(?:이라는|라는)\s*(?:거예요|거에요|겁니다|것입니다|것이다|거죠)"), 2.7),
    (re.compile(r"(?:을|를)\s*(?:말하는|뜻하는|의미하는)\s*(?:거예요|거에요|겁니다|것입니다)"), 2.7),
    (re.compile(r"(?:은|는|이|가)\s*[^.]{3,70}?(?:입니다|이다|이에요|예요|됩니다|된다)"), 1.8),
    (re.compile(r"(?:라 하여|라 해서|라 하고)"), 1.5),
    (re.compile(r"(?:정의|개념|의미)(?:는|은|를|가)"), 1.0),
]
BAD = re.compile(r"(?:구독|좋아요|영상|링크|카페|블로그|강의 문의|수강|후원|계좌|"
                 r"클릭|댓글|안녕하세요|감사합니다|다음 시간|오늘은|지난 시간)")

SENT_SPLIT = re.compile(r"(?<=[.!?])[\s\u00a0\u2028]+|\n+")


def sentences(text):
    for s in SENT_SPLIT.split(text):
        s = unicodedata.normalize("NFC", s).strip()
        s = re.sub(r"\s+", " ", s)
        if 18 <= len(s) <= 180:
            yield s


TITLE_DEF = re.compile(r"(?:이란|란\?|란$|무엇|개념|정의|기초|입문|이해|알아보|다루|살펴)")
FORMULA = re.compile(r"[+=※①②③]|\d\)")


HEDGE = re.compile(r"(?:기도\s*(?:합니다|한다|해요|하고)|또한|반면|비단|뿐만\s*아니라"
                   r"|가장\s*큰\s*단점|단점은|장점은|오늘의|다음과\s*같은)")
GENUS = re.compile(r"(?:기운|힘|것|상태|현상|관계|방법|이론|글자|오행|십성|신살|단계"
                   r"|자리|기둥|개념|의미|뜻|말|사이|시기|지지|천간|용신|합|살)")
COND = re.compile(r"(?:있으면|많으면|없으면|온다면|들어오면|만나면|하게 된다|하게 됩니다|"
                  r"패가망신|알려집니다|한다고 합니다)")


def score_sentence(s, c, mre, kind, author, title, pidx, sidx):
    m = mre.search(s)
    if not m:
        return 0.0
    if BAD.search(s) or FORMULA.search(s):
        return 0.0
    tok = m.group()
    if tok in AMBIG and not AMBIG[tok].search(s):
        return 0.0

    tail = s[m.end():]
    sc, pw, pend = 0.0, 0.0, None
    for pat, w in DEF_PAT:
        mm = pat.search(tail)
        if mm:
            pw, pend = w, mm.end()
            # 정의 문형은 개념 **바로 뒤**에 와야 그 개념의 정의다.
            gap = mm.start()
            if gap > 30:
                pw *= 0.45
            elif gap > 12:
                pw *= 0.8
            sc += pw * 1.4
            break
    if sc == 0:
        return 0.0

    # 순환 정의: 서술부에서 개념이 또 나오면("근묘화실 이론이라 부르고") 정의가 아니다
    if pend is not None and mre.search(tail[pend:]):
        sc -= 2.0

    pos = m.start() / max(1, len(s))
    if pos <= 0.10:   sc += 2.2
    elif pos <= 0.25: sc += 1.2
    elif pos <= 0.45: sc += 0.4
    else:             sc -= 0.6

    # ★제목 신호 — 코퍼스는 교육 커리큘럼이라 «갑목이란?» 같은 정의 전용 글이 있다
    if title:
        tm = mre.search(title)
        if tm:
            sc += 3.0 if TITLE_DEF.search(title) else 1.4

    if kind == "이론":  sc += 1.0
    elif kind in ("운세", "사례", "잡동", "공지", "화법"): sc -= 1.2
    if author in WEB_AUTHORS: sc += 0.8
    if 30 <= len(s) <= 110:   sc += 0.5
    if s.startswith(("그래서", "그러니까", "근데", "그런데", "그리고", "그러면",
                     "이렇게", "이런", "이를", "이것", "이는", "여기서", "따라서")):
        sc -= 1.2
    # 약한 계사(은/는~입니다)만으로는 정의로 안 친다 — 제목 신호가 받쳐줄 때만
    if pw < 2.5 and not (title and mre.search(title)):
        sc -= 2.5
    # 조건→결과 문장은 «적용 규칙»이지 정의가 아니다
    if COND.search(s):
        sc -= 2.2
    # ★글 안에서의 위치 — 정의는 앞에 온다(교육 글의 구조)
    if   pidx <= 3:  sc += 1.6
    elif pidx <= 6:  sc += 0.8
    elif pidx >= 13: sc -= 0.8
    # ★핵심 정의 vs 부차 서술 — "~기도 합니다"는 곁가지다
    if HEDGE.search(s):
        sc -= 3.0
    # 유(類)+종차(種差) 꼴: 서술 끝이 범주어로 닫히면 정의문일 확률이 높다
    if GENUS.search(s[-28:]):
        sc += 1.2
    # 문단의 첫 문장이 정의를 여는 자리
    if sidx == 0:   sc += 1.0
    elif sidx == 1: sc += 0.4
    return sc


# ══════════════════════════════════════════════════════════════
# ★입장(stance) 카드 — 260726 신설
#   실측: 「용신 회의론」·「폐기론(현묘)」·「음간 십이운성」은 정의문이 없는데, 그게 결함이 아니다.
#         이것들은 «이론»이 아니라 «입장»이라 저자가 정의하지 않고 **선언**한다.
#     "저는 용신을 주요 관법으로 사용하지 않습니다."            — 사공 SG-NOTICE-P002-06
#     "그러니 용신은 없다 라고 생각하시고요"                    — 산책처럼 ST-P0294-18
#     "고서에서도 양간 십이운성은 맞지만 음간 십이운성은 맞지 않는다는 의견도 있고" — 사공
#   → 정의를 못 찾으면 «공백»으로 넘기기 전에 선언문을 한 번 더 찾는다.
#     찾으면 상태 = "입장". 정의가 없다는 사실 자체가 그 개념의 성격이다.
STANCE_PAT = [
    (re.compile(r"저(?:는|희는)\s*[^.]{0,40}?(?:하지\s*않|안\s*씁|사용하지\s*않|보지\s*않|인정하지\s*않)"), 3.4),
    (re.compile(r"(?:은|는)\s*없다|없다고\s*(?:생각|봅|보시)"), 3.0),
    (re.compile(r"인정하지\s*않|채택하지\s*않|쓰지\s*않|폐기|배격"), 2.8),
    (re.compile(r"(?:의견도\s*있|논쟁|비판|반대하는|맞지\s*않는다는)"), 2.4),
    (re.compile(r"(?:라고|이라고)\s*생각(?:합니다|해요|하시고)"), 2.0),
]


def score_stance(s, c, mre, author, title):
    m = mre.search(s)
    if not m or BAD.search(s):
        return 0.0
    tok = m.group()
    if tok in AMBIG and not AMBIG[tok].search(s):
        return 0.0
    sc = 0.0
    for pat, w in STANCE_PAT:
        if pat.search(s):
            sc += w
            break
    if sc == 0:
        return 0.0
    if author in WEB_AUTHORS:
        sc += 0.5
    if 25 <= len(s) <= 130:
        sc += 0.5
    return sc


def main():
    cand = defaultdict(list)
    stance_cand = defaultdict(list)
    n_read = 0
    # ★260726 — 공용 리더로 갈아탔다. gist 제거는 이제 리더 안에서 한다
    #   (아래 260726 수리 주석의 조치가 `코퍼스.본문()`으로 옮겨간 것 — 원칙은 그대로다).
    #   🔴그때 수리 내용 보존: `para_text`는 **gist(우리가 붙인 이름표)** 를 본문 앞에 붙여
    #     돌려준다. 그대로 문장 분할하면 **우리 요약이 «저자 축자»로 둔갑한다.** 실제로
    #     "나가며: 무분별 전파한 나 같은 사람 탓…"(gist)이 현묘의 말인 것처럼 실렸다.
    #   ⚠전사 합류 주의 — 전사는 **미검수 ASR**이다. 여기서 나온 후보 인용문은
    #     «축자»가 아니라 «기계가 들은 것»이다. 그래서 카드에 `출처종`을 박아
    #     사람이 원고를 쓸 때 구분할 수 있게 한다. 웹 후보와 섞어 놓고 잊으면 안 된다.
    import 코퍼스 as _CP
    for _r in _CP.문단들():
        q, txt, post = _r["q"], _r["text"], _r["post"]
        author = post.get("author") or post.get("채널") or "?"
        kind = _r["kind"]
        _srckind = _r["출처종"]
        if not txt.strip():
            continue
        n_read += 1
        hit = bnm.concepts_in(txt)
        if not hit:
            continue
        try:
            pidx = int(q["para_id"].rsplit("-", 1)[1])
        except (ValueError, IndexError):
            pidx = 99
        sents = list(sentences(txt))
        if not sents:
            continue
        for c in hit:
            mre = MARK.get(c)
            if not mre:
                continue
            best, bs = None, 0.0
            for si, s in enumerate(sents):
                v = score_sentence(s, c, mre, kind, author, post.get("title", ""), pidx, si)
                if v > bs:
                    bs, best = v, s
            if best and bs >= 4.0:
                cand[c].append({"quote": best, "score": round(bs, 2), "author": author,
                                "title": post.get("title", ""), "para_id": q["para_id"],
                                "kind": kind, "출처종": _srckind})
            # 입장 후보는 정의와 별도로 모은다(정의가 있으면 안 쓴다)
            sb, sbs = None, 0.0
            for s2 in sents:
                v2 = score_stance(s2, c, mre, author, post.get("title", ""))
                if v2 > sbs:
                    sbs, sb = v2, s2
            if sb and sbs >= 3.0:
                stance_cand[c].append({"quote": sb, "score": round(sbs, 2), "author": author,
                                       "title": post.get("title", ""), "para_id": q["para_id"],
                                       "kind": kind})

    out = []
    stat = Counter()
    for c in CONCEPTS:
        lst = sorted(cand.get(c, []), key=lambda d: -d["score"])
        # 같은 문장 중복 제거 + 저자 다양화(저자당 최대 2)
        seen, byau, picked = set(), Counter(), []
        for d in lst:
            k = d["quote"][:40]
            if k in seen or byau[d["author"]] >= 2:
                continue
            seen.add(k); byau[d["author"]] += 1; picked.append(d)
            if len(picked) >= 4:
                break
        if picked:
            state = "충분" if len(picked) >= 2 else "빈약"
            종류 = "정의"
        else:
            # 정의가 없다 → 입장 선언을 찾아본다
            sl = sorted(stance_cand.get(c, []), key=lambda d: -d["score"])
            sseen, sby = set(), Counter()
            for d in sl:
                k = d["quote"][:40]
                if k in sseen or sby[d["author"]] >= 2:
                    continue
                sseen.add(k); sby[d["author"]] += 1; picked.append(d)
                if len(picked) >= 4:
                    break
            state = "입장" if picked else "공백"
            종류 = "입장" if picked else "정의"
        stat[state] += 1
        out.append({"concept": c, "상태": state, "종류": 종류,
                    "후보수": len(lst), "defs": picked})

    p = DATA / "정의카드.jsonl"
    p.write_text("\n".join(json.dumps(o, ensure_ascii=False) for o in out) + "\n", encoding="utf-8")
    print(f"문단 읽음 {n_read:,}")
    print("상태:", dict(stat))
    print("→", p)


if __name__ == "__main__":
    main()
