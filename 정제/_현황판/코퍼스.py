# -*- coding: utf-8 -*-
"""
공용 코퍼스 리더 — 모든 도구가 **같은 문단 집합**을 보게 한다.

═══ 왜 이게 필요한가 (260726) ═══
  도구마다 코퍼스를 따로 읽고 있었고, 그래서 도구마다 다른 세상을 보고 있었다.
    · 링크망       : 웹 38,072 (필터 없음, gist 포함)   ← 오염됐던 것
    · 분기 간선     : 웹+전사, 격자·보류군 제외, gist 제외  ← 제대로 하던 것
    · 개념지도·뉴런맵·정의증류 : 웹만, gist 포함
  같은 코퍼스를 봐야 «개념지도가 센 빈도»와 «링크망이 센 빈도»가 맞는다.
  안 맞으면 두 리포트를 나란히 놓고 판단할 수가 없다.

═══ 세 가지 규칙 (여기 한 곳에만 적는다) ═══
  ① **gist를 본문으로 치지 않는다.**
     `bnm.para_text()`는 gist(우리가 붙인 이름표)를 본문 앞에 붙여 돌려준다.
     그걸 세면 «우리가 붙인 이름이 우리 통계의 근거»가 되는 자기충족 회로가 된다.
     실측(260726): 개념-문단 출현의 **6.9%**가 gist에서 왔다.
  ② **격자(운세)를 뺀다.** 「이달의 운세(일간별)」류는 복붙 보일러플레이트다.
     같은 문장이 수백 번 반복되면 공기 통계가 통째로 거짓이 된다.
  ③ **보류군을 뺀다.** 수상·관상·타로·풍수·당사주·구성학·매화역수·토정비결·작명.
     우리 엔진의 절대원칙이 «계산된 원국 키셋의 조회»인데 이들은 키셋 자체가 다르다.
     지우는 게 아니라 **이 통계에서 빼는** 것이다(운영자 260726 어휘 규칙).

  ⚠**끄는 스위치를 남겨 뒀다.** 기존 수치와 대조해야 할 때가 있어서다.
    다만 기본값이 «빼는 쪽»이고, 넣으려면 명시적으로 켜야 한다.

═══ 전사가 웹과 다른 점 ═══
  · 본문이 `text`에 직접 들어 있다(포인터가 아니다 — 이유는 ingest_transcripts.py 참조).
  · `kind`는 항상 `"전사"`. 웹의 이론/사례/운세 같은 분류가 아직 없다.
  · 출처는 채널명. 웹은 저자명.
"""
import json, re, sys, importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
sys.path.insert(0, str(HERE))
_spec = importlib.util.spec_from_file_location("bnm", HERE / "build_neuron_map.py")
_bnm = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_bnm)
_bnm.SNAP_DIRS = _bnm._snapshot_dirs()

HOLD = re.compile(r"^(?:hand|face|taro|pungsu|dang|gusung|mehwa|tojung|name)-|"
                  r"토정비결|타로|관상|수상|풍수|당사주|구성학|매화역수|작명|플러스작명|지문학")
# ★260728 보류 해제 3파일 (운영자 승인) — HOLD보다 먼저 본다.
#   19파일 2,355청크 표본에서 이 셋만 명리 코어어 94.7% / 57.6% / 54.5%로 예외였다.
#   mehwa는 이름만 매화역수고 내용이 명리 합충 이론이다(「지지의 육합: 자축합토…」).
#   실증: 이 셋을 뺀 탓에 명암합·모자멸자·토다금매 후보 근거가 얇게 잡혔다.
#   ⚠나머지 16파일은 그대로 보류 — 이 예외가 그 결정을 바꾸지 않는다.
HOLD_EXEMPT = re.compile(r"^mehwa-매화역수자료실|^운세력사용설명서|^택일기타사용설명")
GRID = re.compile(r"운세|이달의|경자년|신축년|임인년|계묘년|갑진년|을사년|병오년")
GRID_KIND = {"잡동", "공지", "운세"}


def _jl(name):
    p = DATA / name
    if not p.exists():
        return []
    return [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]


def 웹_글():
    return {p["post_id"]: p for p in _jl("posts_all.jsonl")}


def 전사_글():
    return {p["post_id"]: p for p in _jl("전사_글.jsonl")}


def 본문(q, posts):
    """gist를 뗀 본문. 이 함수 밖에서 `para_text`를 직접 부르지 말 것."""
    full = _bnm.para_text(q, posts)
    if not full:
        return ""
    g = (q.get("gist") or "").strip()
    return full[len(g):].lstrip() if g and full.startswith(g) else full


def 문단들(전사=True, 격자=False, 보류군=False, 제목포함=False, 보드=False):
    """(rec) 를 흘려보낸다. rec = dict(para_id, post_id, text, title, 출처, kind, 출처종)

    전사 문단 파일은 60 MB라 통째로 안 올리고 **줄 단위로 흘린다.**

    ⚠기본으로 빠지는 것 셋 — 여기 한 곳에만 적는다(도구마다 다른 세상을 보면 안 된다):
      ①운세 격자(복붙 보일러플레이트) ②보류군(수상·관상·타로… 키셋이 다른 술수)
      ③**방법론 보드**(운영자 정리본 — §3 「슬롯1은 근거로 쓰지 않는다」).
      셋 다 «지운» 게 아니라 «부를 때만 준다». `격자=True`·`보류군=True`·`보드=True`.
    """
    posts = 웹_글()
    for q in _jl("paras_all.jsonl"):
        p = posts.get(q.get("post_id"), {})
        f = p.get("file", "")
        if not 보류군 and HOLD.search(f) and not HOLD_EXEMPT.search(f):
            continue
        if not 격자 and (GRID.search(f) or q.get("kind") in GRID_KIND):
            continue
        t = 본문(q, posts)
        if not t:
            continue
        if 제목포함 and p.get("title"):
            t = t + " " + p["title"]
        yield {"para_id": q["para_id"], "post_id": q.get("post_id"), "text": t,
               "title": p.get("title", ""), "출처": "웹:" + (p.get("author") or f[:24] or "?"),
               "kind": q.get("kind", ""), "출처종": "웹", "q": q, "post": p}

    if not 전사:
        return
    tp = DATA / "전사_문단.jsonl"
    if not tp.exists():
        return
    tposts = 전사_글()
    with tp.open(encoding="utf-8") as fh:
        for line in fh:
            if not line.strip():
                continue
            q = json.loads(line)
            p = tposts.get(q.get("post_id"), {})
            if not 보류군 and p.get("보류군"):
                continue
            t = q.get("text", "")
            if not t:
                continue
            if 제목포함 and p.get("title"):
                t = t + " " + p["title"]
            yield {"para_id": q["para_id"], "post_id": q.get("post_id"), "text": t,
                   "title": p.get("title", ""), "출처": "전사:" + (p.get("채널") or "?"),
                   "kind": "전사", "출처종": "전사", "q": q, "post": p}

    # ── ★260726 방법론 보드(FigJam). **기본으로는 안 나온다.**
    #   운영자 지적으로 발견: 55,406자짜리 보드가 코퍼스 적재 0건이었다.
    #   엔진 judge.js가 «1순위 근거»라 부르는 그 보드를 지도가 본 적이 없었다.
    #   ⚠그런데 기본 집합에 넣으면 **§3 「슬롯1은 근거로 쓰지 않는다」를 어긴다** —
    #     운영자가 정리한 것이라 개념이 조밀하게 붙어 있어 L2 리프트가 부풀고,
    #     그 부푼 값이 «저자들이 그렇게 말한다»로 읽힌다. 그게 이중계상이다.
    #   → 격자·보류군과 같은 처분: **담되 기본에서 빼고, 부를 때만 준다.**
    #     조견표 이식·검색·대조에는 쓰고, 통계에는 안 쓴다.
    if not 보드:
        return
    bp = DATA / "보드_문단.jsonl"
    if not bp.exists():
        return
    for q in _jl("보드_문단.jsonl"):
        t = q.get("text", "")
        if not t:
            continue
        yield {"para_id": q["para_id"], "post_id": None, "text": t,
               "title": q.get("절", ""), "출처": q.get("출처", "방법론 보드(FigJam)"),
               "kind": ("표" if q.get("표") else "보드"), "출처종": "보드",
               "q": q, "post": {}}


# ══════════════════════════════════════════════════════════════════
# 개인정보 가림 — 공개 리포 전제 (운영자 260727 "시크릿 안할거야")
# ══════════════════════════════════════════════════════════════════
#   ⚠**왜 삭제가 아니라 이 자리인가.** 260727에 산출물에서 이메일 311건을 손으로
#     가렸는데, 그건 «지금 있는 것»만 없앤 것이다. 파이프라인을 한 번 돌리면
#     코퍼스에서 그대로 다시 나온다. 사고를 막는 자리는 산출물이 아니라 **생성 지점**이다.
#     (같은 병 = «추출기를 고치고 적재기를 안 고침» G10 계열. 12회째라 여기 박는다.)
#
#   ⚠**원문은 고치지 않는다.** 스냅샷·라이브러리는 불변 정본이다.
#     여기서 가리는 것은 **산출물로 나가는 사본**뿐이다.
#
#   ⚠**가리는 것만 가린다.** 전화·주민번호 정규식은 오탐이 압도적이라 안 쓴다
#     (260727 실측: 「주민번호」 3,143건이 전부 절기 epoch·FigJam 좌표였다.
#      그걸 지웠으면 절기표가 깨진다 — 「쇠」 오삭제와 같은 형태의 사고다).
#     실측으로 확인된 것 = **이메일**. 그것만 가린다.
_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_안가림 = ("noreply", "example.com", "@github", "@anthropic", "sentry.io",
           "@w3.org", "@schema.org", "your-email", "user@")

가림수 = 0


def 가리기(s: str) -> str:
    """산출물에 나갈 문자열에서 이메일을 가린다. 원문 무수정."""
    global 가림수

    def _f(m):
        global 가림수
        if any(x in m.group().lower() for x in _안가림):
            return m.group()
        가림수 += 1
        return "[이메일 가림]"

    return _EMAIL.sub(_f, s or "")


if __name__ == "__main__":
    from collections import Counter
    c = Counter(); ch = 0
    for r in 문단들():
        c[r["출처종"]] += 1; ch += len(r["text"])
    print(f"문단 {sum(c.values()):,} = " + " + ".join(f"{k} {v:,}" for k, v in c.items()))
    print(f"총 글자 {ch:,}")
