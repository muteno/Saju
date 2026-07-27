# -*- coding: utf-8 -*-
"""
마커 린트 — «한 군데만 고친 것»과 «아직 안 걸린 일상어 별칭»을 잡는다.

═══ 왜 이걸 만드나 (260726, 같은 병 두 번) ═══
  ① 오전: `para_text()`의 gist 오염을 **정의 증류에서** 고치고, **색인에는 안 갔다.**
     → 밀착 통계의 6.9%가 우리가 붙인 이름표였다.
  ② 저녁: 일상어 게이트(`여기·본기·정기`)를 **뉴런맵에 달고, 개념지도에는 안 갔다.**
     → 「여기서 조심해야 될 게」가 餘氣로 세어졌다. 오탐률 90.7%, 13,639건.

  둘 다 «고쳤다»고 기록돼 있었다. 고친 자리는 맞는데 **같은 병이 다른 방에 그대로** 있었다.
  운영자 지적: "그걸 해결할 수 있는 방법을 구현해놨어?" — 안 해놨었다. 이게 그 답이다.

═══ 두 가지를 검사한다 ═══
  [A] **게이트 배선 검사(정적)** — TAXONOMY 별칭으로 본문을 뒤지는 모듈이
      `AMBIG_RE`를 참조하는가. 안 하면 게이트를 우회하고 있는 것이다.
      → 개념지도 사고를 **정확히 이 검사가 잡는다.** 실패하면 exit 1.

  [B] **일상어 별칭 발굴(실측)** — 모든 별칭에 대해 «국소 문맥에 명리 어휘가 있는가»를 잰다.
      진짜 명리 용어는 명리 어휘 사이에 앉아 있고, 일상어와 철자가 겹치는 별칭은
      일상 문장에 앉아 있다. `여기`가 9.3%로 잡힌 그 성질을 **전 별칭에 일반화**한다.
      → 낮은 것은 «게이트 후보»로 보고만 한다. **자동으로 안 막는다** —
        막는 건 사람이 표본을 보고 정할 일이다(`설하` 삭제·`쇠` 복구가 그 선례).

═══ 왜 [B]를 자동 차단하지 않는가 ═══
  낮은 점수가 곧 오탐은 아니다. `상생`은 «상생하는 관계»처럼 일상에도 쓰이지만
  그 문단이 명리 글이면 진짜다. 자동으로 막으면 `쇠`를 삭제했다가 십이운성 한 단계를
  통째로 날린 260725 사고가 재발한다. **되돌릴 수 없는 조치는 사람이 한다.**

출력: data/마커린트.md · exit 1 (게이트 배선 불일치 시)
"""
import json, re, sys, importlib.util, random
from pathlib import Path
from collections import Counter

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
sys.path.insert(0, str(HERE))
_sp = importlib.util.spec_from_file_location("bnm", HERE / "build_neuron_map.py")
bnm = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(bnm)
bnm.SNAP_DIRS = bnm._snapshot_dirs()

ALIAS2C = bnm.alias2concept
# 🔴260727 — **게이트가 두 종류가 됐는데 검사기는 한 종류만 알고 있었다.**
#   (국소 창 게이트)을 새로 만들고 여기에 안 알렸더니, 게이트를 달았는데도
#   [C] 부채가 그대로였다. **내가 만든 장치가 막으려던 그 병을 만들면서 저질렀다**(G10).
#   → 두 게이트를 합쳐서 «게이트가 있다»를 판정한다.
AMBIG = {**bnm.AMBIG_RE, **getattr(bnm, "AMBIG_LOCAL", {})}

# ══════════════════════════════════════════════════════════════
# [A] 게이트 배선 검사 — 별칭으로 본문을 뒤지면서 게이트를 안 보는 모듈 찾기
# ══════════════════════════════════════════════════════════════
SKIP = ("_폐기", "_작업내역", "__pycache__", "_백업", "평의회", "scratchpad")
# 「TAXONOMY 별칭을 꺼내 본문과 대조한다」의 흔적
USES_ALIAS = re.compile(r"TAXONOMY|alias2concept|ALIAS_RE|for\s+\w*alias|aliases")
# 「게이트를 통과시킨다」의 흔적
USES_GATE = re.compile(r"AMBIG_RE|AMBIGUOUS|concepts_in|코퍼스")
# 별칭을 직접 본문에 대는 짓 (게이트 없이)
RAW_MATCH = re.compile(r"\b\w*alias\w*\s+in\s+\w+|any\(\s*a\s+in\s+|\.search\(\s*t\w*\s*\)")


def wiring_check():
    bad, ok = [], []
    for py in sorted(HERE.glob("*.py")):
        if any(s in str(py) for s in SKIP) or py.name in ("lint_markers.py",):
            continue
        raw = py.read_text(encoding="utf-8", errors="ignore")
        # ★주석·독스트링을 걷어낸다. 안 그러면 「# TAXONOMY 참조」 같은 **설명 한 줄**이
        #   «별칭을 쓴다»로 잡힌다(260726 1차 실행에서 build_neuralnet3d.py가 그렇게 걸렸다).
        #   린트가 오탐을 내면 사람이 린트를 안 믿게 되고, 그러면 진짜를 놓친다.
        src = re.sub(r'"""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\'', "", raw)
        src = "\n".join(re.sub(r"#.*$", "", ln) for ln in src.splitlines())
        if not USES_ALIAS.search(src):
            continue                       # 별칭을 안 쓰는 모듈 — 상관없다
        if py.name == "build_neuron_map.py":
            ok.append((py.name, "게이트 정의처"))
            continue
        if USES_GATE.search(src):
            ok.append((py.name, "게이트 참조함"))
        else:
            # 별칭을 실제로 본문과 대조하는가 (선언만 하고 안 쓰면 무관)
            bad.append((py.name, "★별칭을 쓰는데 AMBIG_RE/concepts_in/코퍼스 를 안 부른다"))
    return ok, bad


# ══════════════════════════════════════════════════════════════
# [B] 일상어 별칭 발굴 — 국소 문맥에 명리 어휘가 앉아 있는가
# ══════════════════════════════════════════════════════════════
WIN = 34            # 매치 좌우 이 글자 안을 본다
SAMPLE = 1200       # 별칭당 최대 표본(전수는 느리고 필요도 없다)
MIN_N = 40          # 이보다 적게 나오는 별칭은 판정 보류(표본 부족)
FLOOR = 0.45        # 이 아래면 «게이트 후보»로 보고한다

# 명리 어휘 = 2글자 이상 별칭 전체. 자기 자신은 뺀다(자기가 자기를 증명하면 안 된다).
VOCAB = sorted({a for a in ALIAS2C if len(a) >= 2 and not a.startswith("-")},
               key=len, reverse=True)


def build_ctx_re(exclude):
    v = [a for a in VOCAB if a != exclude]
    return re.compile("|".join(re.escape(x) for x in v))


def context_rates():
    import 코퍼스 as CP
    targets = [a for a in ALIAS2C if not a.startswith("-")]
    hit = {a: [0, 0, []] for a in targets}     # [총, 문맥있음, 표본]
    pats = {a: re.compile(re.escape(a)) for a in targets}
    ctxs = {a: build_ctx_re(a) for a in targets}
    rnd = random.Random(7)
    for r in CP.문단들():
        t = r["text"]
        for a in targets:
            h = hit[a]
            if h[0] >= SAMPLE:
                continue
            m = pats[a].search(t)
            if not m:
                continue
            h[0] += 1
            # 🔴🔴260727 — **창이 매치 구간 자체를 포함하고 있었다.**
            #   그래서 별칭 안에 동반어가 부분 문자열로 들어 있으면 **자기가 자기를 증명**한다.
            #   실측: 「소화기」의 동반율이 **100.0% → 12.5%**(208회 중 208 → 26)로 뒤집혔다.
            #   즉 이 검사가 «근처에 명리 어휘가 있나»가 아니라 «네 이름에 그 글자가 있나»를
            #   묻고 있었다. 그런 별칭은 무조건 안전으로 찍히므로 **가장 위험한 것이 가장 안전해 보인다.**
            #   → **span을 도려낸 좌우 창**만 본다.
            w = t[max(0, m.start() - WIN): m.start()] + t[m.end(): m.end() + WIN]
            if ctxs[a].search(w):
                h[1] += 1
            elif len(h[2]) < 3:
                h[2].append(re.sub(r"\s+", " ", w))
    return hit


# ══════════════════════════════════════════════════════════════
# [C] 판정↔게이트 배선 — 「게이트필요」라고 판정해 놓고 게이트를 안 단 것
# ══════════════════════════════════════════════════════════════
#   ★260726 발견 — 이게 오늘 세 번째 같은 병이다.
#     `lint_aliases.py`는 별칭마다 «안전/게이트필요/위험»을 판정해 파일로 남긴다.
#     그 docstring에는 **"★빌더 규약: build_neuron_map.py 는 이 판정 파일을 읽어"** 라고
#     적혀 있다. 그런데 `build_neuron_map.py`를 grep하면 **그 파일을 안 읽는다.**
#     측정도 있고 판정도 있는데 **배선이 없었다.** 그래서 「게이트필요」 판정을 받은
#     별칭 다수가 게이트 없이 그대로 세어지고 있었다.
#
#   ⚠래칫(ratchet)으로 건다 — 지금 있는 부채로 파이프라인을 막으면 아무도 안 돌린다.
#     **부채가 늘면 죽고, 줄면 기준선을 낮춘다.** 조용히 나빠지는 것만 막는다.
BASE = DATA / "게이트부채_기준선.json"


# ★260727 신설 — «반박»의 자리. 래칫이 «게이트를 달거나 판정을 반박할 근거를 남겨라»라고
#   말하면서 **반박할 곳이 코드에 없었다.** 그러면 사람은 결국 기준선만 올린다(G13).
#   ⚠엔진갈림_선언과 **같은 안전장치**를 건다: 사유·실측·결정이 다 있어야 인정하고,
#     하나라도 비면 «선언 무시»로 찍고 부채로 그대로 센다. 그리고 반박된 것도
#     리포트에는 남긴다 — **면제가 아니라 반박**이다.
REBUT = HERE / "게이트부채_반박.jsonl"


def load_rebuttals():
    out, bad = {}, []
    if not REBUT.exists():
        return out, bad
    for ln in REBUT.read_text(encoding="utf-8").splitlines():
        ln = ln.strip()
        if not ln:
            continue
        r = json.loads(ln)
        al = r.get("별칭")
        if not al:
            continue
        if not all((r.get(k) or "").strip() for k in ("사유", "실측", "결정")):
            bad.append(al)
            continue
        out[al] = r
    return out, bad


def gate_debt():
    p = DATA / "별칭_판정.json"
    if not p.exists():
        return None, [], []
    a = json.loads(p.read_text(encoding="utf-8"))["aliases"]
    rows = list(a.values()) if isinstance(a, dict) else a
    rebut, bad_rebut = load_rebuttals()
    for al in bad_rebut:
        print(f"  ⚠반박 무시 — [{al}] 사유/실측/결정 중 빈 칸이 있다. 반박으로 인정하지 않는다.")
    need, have = [], []
    for r in rows:
        al = r.get("alias")
        if r.get("verdict") in ("게이트필요", "위험"):
            if al in rebut:
                have.append((al, r.get("verdict") + "(반박됨)", r.get("hits", 0),
                             sorted(r.get("concepts", []))))
                continue
            (have if al in AMBIG else need).append((al, r.get("verdict"), r.get("hits", 0),
                                                    sorted(r.get("concepts", []))))
    need.sort(key=lambda t: -t[2])
    return len(rows), need, have



# ══════════════════════════════════════════════════════════════
# [D] 반례 고정(must-fail fixture) — **검사의 «의미»를 문장으로 못박는다**
# ══════════════════════════════════════════════════════════════
#   🔴260726 심야 — 이 블록이 없어서 압축담당자에게 적발됐다.
#     `검사_반례.jsonl`을 만들어 놓고 **읽는 코드를 안 붙였다.**
#     「판정 파일 만들고 아무도 안 읽음」의 **6회째 재발** —
#     그것도 «그 병을 막는 장치»를 만들면서 같은 병을 저질렀다.
#
#   페이블 처방(260726): "상수 추적은 구현을 지키지만 **반례는 검사의 «의미»를 고정**하므로,
#     무엇이 무력화했는지 몰라도 잡힌다."
#   260725에 관측창을 74자→632자로 넓힌 «옳은 결정»이 동반어 검사를 조용히 무력화했을 때,
#   이 검사가 있었다면 그 커밋이 즉사했다.
#
#   ⚠차단/통과를 **짝으로** 둔다. 차단만 보면 게이트를 조이다 진짜 용례를 죽인다(«쇠» 사고).
FIXTURE = DATA.parent / "검사_반례.jsonl"


def fixture_check():
    if not FIXTURE.exists():
        return None, [], 0
    rows = []
    for ln in FIXTURE.read_text(encoding="utf-8").splitlines():
        ln = ln.strip()
        if not ln:
            continue
        r = json.loads(ln)
        if r.get("_"):
            continue                      # 머리말 주석 줄
        # ⚠«엔진대조»는 문장이 아니라 «쌍 개수»로 판정한다 — 문장 없다고 버리면
        #   그 픽스처가 통째로 사라져 또 «공허»가 된다(같은 병 세 번째 변종의 교훈).
        if r.get("검사") != "엔진대조" and not r.get("문장"):
            continue
        rows.append(r)
    # 🔴260726 2차 — 페이블 후속 점검 적발. 전에는 **전부 `concepts_in`으로만** 판정했다.
    #   그런데 「gist배제」·「격자배제」는 **실존 노드명이 아니라서** `hit`이 구조상 항상 False —
    #   즉 **그 검사가 죽어도 픽스처는 영원히 통과**했다.
    #   「판정 파일 만들고 아무도 안 읽음」을 막으려고 만든 장치 안에
    #   «읽는 척만 하는 픽스처»가 2개 있었던 것이다. 같은 병의 세 번째 변종이다.
    #   → 검사 종류마다 **그 검사가 실제로 쓰는 함수**를 직접 부른다.
    import 코퍼스 as _CP

    def _judge(r):
        """(걸렸나, 무엇이 잡혔나) — 검사 종류별로 진짜 경로를 탄다."""
        검사 = r.get("검사", "게이트")
        if 검사 == "게이트":
            found = bnm.concepts_in(r["문장"])
            return (r["개념"] in found), sorted(found)[:5]
        if 검사 == "본문":
            # gist가 본문으로 새는가 — `코퍼스.본문()`을 실제로 부른다
            q = {"gist": r["gist"], "quote": r["문장"], "para_id": "FIX", "post_id": "FIX"}
            got = _CP.본문(q, {})
            leaked = r["gist"] in got
            return leaked, [f"본문()='{got[:40]}'"]
        if 검사 == "엔진대조":
            # ★260726 — 대조기(`verify_L1_sync.py`)가 그 표를 **실제로 찾아내는가**.
            #   페이블 지적: 「몇 시간 죽어 있던 그 게이트가 돌연변이 시험 밖이라,
            #   또 죽어도 픽스처는 안 운다.」 kind를 다듬어 대조기가 못 찾게 되면
            #   여기서 먼저 운다 — 파이프라인 ⑦-B가 죽기 전에.
            import importlib.util as _il
            _sp = _il.spec_from_file_location("vfy", HERE / "verify_L1_sync.py")
            _v = _il.module_from_spec(_sp)
            try:
                _sp.loader.exec_module(_v)
                _got = _v.ours()
                n = len(_got.get(r["개념"], ()))
            except Exception as _e:
                return None, [f"대조기 실행 실패: {_e}"]
            want = r.get("쌍수")
            return (n == want), [f"{r['개념']} {n}쌍 (기대 {want})"]
        if 검사 == "코퍼스":
            # 격자·보류군이 걸러지는가 — 실제 정규식을 부른다
            hit = bool(_CP.GRID.search(r["문장"]) or _CP.HOLD.search(r["문장"])
                       or r.get("kind") in _CP.GRID_KIND)
            return (not hit), [f"필터걸림={hit}"]   # «걸러짐»이면 hit=False로 돌려준다
        return None, ["알 수 없는 검사 종류"]

    fails = []
    for r in rows:
        hit, got = _judge(r)
        if hit is None:
            fails.append((r, "**검사 종류를 모른다** — 판정기가 없다", got))
            continue
        want_block = (r["기대"] == "차단")
        if want_block and hit:
            fails.append((r, "걸러야 하는데 **걸렸다**", got))
        elif (not want_block) and (not hit):
            fails.append((r, "잡아야 하는데 **놓쳤다**", got))
    return len(rows), fails, len(rows) - len(fails)


_fixn, _fixfail, _fixpass = fixture_check()


# ══════════════════════════════════════════════════════════════
# [E] kind ↔ source 정합 — «정규식 패치가 조용히 데이터를 부수는 것»을 잡는다
# ══════════════════════════════════════════════════════════════
#   🔴260726 실사고 — 「합」을 육합/방합/삼합으로 가르려고 정규식 치환을 돌렸는데,
#     `re.S` + 비탐욕 `.*?` 가 **add() 호출 경계를 넘어** 매칭돼
#     **천간 오합 5쌍이 «육합»으로 라벨**됐다. 에러는 하나도 안 났다.
#     내가 grep으로 두 줄을 고쳤는데 세 번째 줄은 검색어가 달라 못 찾았다.
#   → 파생 관계는 **kind와 source가 1:1**이어야 한다. 어긋나면 누가 뭘 부순 것이다.
# ⚠«source가 하나여야 한다»는 너무 뻣뻣했다 — `삼형`은 무은지형(인사신)·지세지형(축술미)
#   둘 다 정당한 삼형이다. → **«미리 선언한 목록 안에 있어야 한다»**로 바꾼다.
#   그러면 정당한 하위 종류는 통과하고, 정규식 사고(천간 오합이 «육합»으로 라벨된 것)는
#   여전히 걸린다 — 「천간 오합」이 육합의 허용 목록에 없기 때문이다.
#   ★개수는 명리 정론상 고정이므로 그대로 못박는다. 여기가 진짜 자물쇠다.
DERIV_SPEC = {
    "천간합": (5,  {"천간 오합"}),
    "육합":   (6,  {"지지 육합"}),
    "방합":   (12, {"지지 방합"}),
    "삼합":   (12, {"지지 삼합"}),
    "천간충": (4,  {"천간충(칠충)"}),
    "지지충": (6,  {"지지 육충"}),
    "삼형":   (6,  {"삼형(무은지형)", "삼형(지세지형)"}),
    "상형":   (1,  {"상형(무례지형)"}),
    "파":     (6,  {"지지 육파"}),
    "해":     (6,  {"지지 육해(六害)"}),
    "원진":   (6,  {"원진"}),
    "귀문":   (6,  {"귀문관살"}),
}


def kind_source_check():
    p = DATA / "relation_edges.jsonl"
    if not p.exists():
        return [], []
    rel = [json.loads(l) for l in p.read_text(encoding="utf-8").splitlines() if l.strip()]
    rel = [e for e in rel if e.get("layer") == "관계"]
    got_src, cnt = {}, Counter()
    for e in rel:
        k = e.get("kind")
        if k in DERIV_SPEC:
            got_src.setdefault(k, set()).add((e.get("source") or "").strip())
            cnt[k] += 1
    mixed = []
    for k, (n, allowed) in DERIV_SPEC.items():
        stray = got_src.get(k, set()) - allowed
        if stray:
            mixed.append((k, sorted(stray)))     # ★허용 목록 밖 = 누가 부순 것
    wrongn = [(k, n, cnt.get(k, 0)) for k, (n, _a) in DERIV_SPEC.items() if cnt.get(k, 0) != n]
    return mixed, wrongn


_mixed, _wrongn = kind_source_check()

_ntot, debt, gated = gate_debt()
# 🔴260726 설계 결함 수리 — 기준선에 **숫자만** 저장했더니 래칫이 울렸을 때
#   «무엇이 늘었는지»를 알 수 없었다(208→212로 울렸는데 그 4개를 못 찾았다).
#   경보가 «뭔가 나빠졌다»만 말하고 «무엇이»를 못 말하면 사람은 결국 기준선만 올린다.
#   → **목록을 저장한다.** 그래야 diff가 나오고, 그래야 고칠 수 있다.
_prevj = json.loads(BASE.read_text(encoding="utf-8")) if BASE.exists() else {}
prev = _prevj.get("부채")
_prev_list = set(_prevj.get("목록") or [])
_cur_list = {d[0] for d in debt}
_added = sorted(_cur_list - _prev_list) if _prev_list else []
_removed = sorted(_prev_list - _cur_list) if _prev_list else []
debt_grew = prev is not None and len(debt) > prev

ok, bad = wiring_check()
rates = context_rates()

rows = []
for a, (tot, ctx, ex) in rates.items():
    if tot < MIN_N:
        continue
    rate = ctx / tot
    rows.append((rate, a, tot, ctx, sorted(ALIAS2C[a]), a in AMBIG, ex))
rows.sort()

low = [r for r in rows if r[0] < FLOOR and not r[5]]        # 낮은데 게이트 없음
gated_ok = [r for r in rows if r[5]]

L = ["# 마커 린트", "",
     "> 같은 병을 두 번 겪고 만든 검사다(260726). ①gist 오염을 정의증류에서만 고침",
     "> ②일상어 게이트를 뉴런맵에만 닮. **둘 다 «고쳤다»고 기록돼 있었다.**", "",
     "## [A] 게이트 배선 검사", ""]
if bad:
    L.append("### 🔴 게이트를 우회하는 모듈")
    L.append("")
    for n, w in bad:
        L.append(f"- **{n}** — {w}")
    L.append("")
    L.append("> 별칭으로 본문을 뒤지면서 게이트를 안 보면 `여기`가 餘氣로 세어진다.")
    L.append("> `bnm.AMBIG_RE`를 통과시키거나 `코퍼스.문단들()`+`bnm.concepts_in()`을 쓸 것.")
else:
    L.append("✅ 별칭을 쓰는 모듈 전부가 게이트를 참조한다.")
L += ["", "| 모듈 | 상태 |", "|---|---|"]
for n, w in ok:
    L.append(f"| {n} | ✅ {w} |")
for n, w in bad:
    L.append(f"| {n} | 🔴 {w} |")

L += ["", f"## [B] 일상어 별칭 후보 — 국소 문맥({WIN}자) 명리 어휘 동반율", "",
      f"- 판정 대상 {len(rows)}개(출현 {MIN_N}회 이상) · 임계 {FLOOR:.0%}",
      f"- **게이트 없는데 임계 미달: {len(low)}개** ← 사람이 표본을 보고 정할 것",
      "",
      "> ⚠자동으로 막지 않는다. 낮은 점수가 곧 오탐은 아니다 — `상생`은 일상에도 쓰이지만",
      "> 그 문단이 명리 글이면 진짜다. 자동 차단하면 `쇠`를 삭제해 십이운성 한 단계를",
      "> 통째로 날린 260725 사고가 재발한다. **되돌릴 수 없는 조치는 사람이 한다.**", "",
      "| 별칭 | 동반율 | 출현 | 노드 | 문맥 표본 |", "|---|---:|---:|---|---|"]
for rate, a, tot, ctx, cs, g, ex in low[:40]:
    s = (ex[0][:70] + "…") if ex else ""
    L.append(f"| `{a}` | **{rate:.0%}** | {tot:,} | {', '.join(cs)} | {s} |")

L += ["", "## [E] kind ↔ source 정합 · 파생 쌍 개수", ""]
if _mixed or _wrongn:
    L.append("### 🔴 어긋남 — 누가 데이터를 부쉈다")
    for k, v in _mixed:
        L.append(f"- `{k}` 에 **허용 목록 밖 source**: {v} ← 누가 부쉈다")
    for k, want, got in _wrongn:
        L.append(f"- `{k}` 쌍 개수 {got} ≠ 기대 {want}")
else:
    L.append("✅ 파생 관계 kind↔source 1:1 · 쌍 개수 전부 기대치와 일치")
    L.append("")
    L.append("| 관계 | 쌍 | 허용 source |")
    L.append("|---|---:|---|")
    for k, (n, a) in sorted(DERIV_SPEC.items()):
        L.append(f"| {k} | {n} | {' · '.join(sorted(a))} |")
L += ["", "## [D] 반례 고정 — 검사의 «의미»를 문장으로 못박는다", ""]
if _fixn is None:
    L.append("⚠`검사_반례.jsonl` 없음 — 반례 검사를 못 돌렸다.")
elif _fixfail:
    L.append(f"### 🔴 반례 {len(_fixfail)}건 실패 / {_fixn}건 중")
    L.append("")
    L.append("| 개념 | 기대 | 무슨 일이 났나 | 문장 | 근거 |")
    L.append("|---|---|---|---|---|")
    for r, why, got in _fixfail:
        # ⚠`문장`은 게이트 픽스처에만 있다. 엔진대조·코퍼스 픽스처엔 없어서
        #   여기서 KeyError로 죽었다 — **실패를 보고하려던 코드가 실패 때문에 죽는** 꼴이었다.
        #   보고기가 죽으면 「무엇이 실패했나」가 통째로 안 보인다. get 으로 받는다.
        L.append(f"| {r.get('개념') or r.get('검사', '?')} | {r['기대']} "
                 f"| {why} (잡힌 것: {', '.join(got) or '없음'}) "
                 f"| {(r.get('문장') or '(문장 없는 검사)')[:60]}… | {r.get('근거','')[:50]} |")
else:
    L.append(f"✅ 반례 **{_fixn}건 전부 통과** — 차단할 것은 차단하고, 통과할 것은 통과한다.")
L += ["", "## [C] 판정↔게이트 배선 — 「게이트필요」인데 게이트가 없는 것", "",
      "> `lint_aliases.py`가 별칭마다 «안전/게이트필요/위험»을 판정해 파일로 남긴다.",
      "> 그 docstring에는 **\"★빌더 규약: build_neuron_map.py 는 이 판정 파일을 읽어\"** 라고",
      "> 적혀 있는데, 실제로 grep하면 **안 읽는다.** 측정도 판정도 있는데 배선이 없었다.",
      "> **래칫으로 건다 — 부채가 늘면 죽고, 줄면 기준선을 낮춘다.**", "",
      f"- 판정 대상 {_ntot} · **게이트 필요 판정 {len(debt)+len(gated)}건** "
      f"· 게이트 있음 {len(gated)} · ⚠**없음(부채) {len(debt)}**",
      f"- 기준선 {prev if prev is not None else '(최초 기록)'} → 현재 {len(debt)}"
      + ("\n- ▲새로 늘어난 것: " + ", ".join(_added) if _added else "")
      + ("\n- ▼해소된 것: " + ", ".join(_removed) if _removed else "")
      + ("  🔴**늘었다**" if debt_grew else ("  ✅줄었다" if prev and len(debt) < prev else "  (동일)")),
      "", "| 별칭 | 판정 | 출현 | 노드 |", "|---|---|---:|---|"]
for al, vd, h, cs in debt[:40]:
    L.append(f"| `{al}` | {vd} | {h:,} | {', '.join(cs)} |")

L += ["", "### 이미 게이트가 걸린 별칭 (검사 통과 확인용)", "",
      "| 별칭 | 동반율 | 출현 |", "|---|---:|---:|"]
for rate, a, tot, ctx, cs, g, ex in gated_ok:
    L.append(f"| `{a}` | {rate:.0%} | {tot:,} |")

(DATA / "마커린트.md").write_text("\n".join(L) + "\n", encoding="utf-8")

if not debt_grew:
    BASE.write_text(json.dumps({"부채": len(debt), "잰날": "260726",
                                "목록": sorted(_cur_list)},
                               ensure_ascii=False, indent=1), encoding="utf-8")
print("[E] kind↔source 정합 — " +
      ("✅ 이상 없음" if not (_mixed or _wrongn)
       else f"🔴 혼재 {len(_mixed)} · 개수불일치 {len(_wrongn)}: {_mixed} {_wrongn}"))
print(f"[D] 반례 고정 — {_fixpass}/{_fixn} 통과" +
      (f" · 🔴실패 {len(_fixfail)}" if _fixfail else " ✅"))
for r, why, got in _fixfail[:6]:
    print(f"     🔴 [{r.get('개념') or r.get('검사', '?')}] {why}  "
          f"«{(r.get('문장') or r.get('근거') or '')[:60]}…»")
print(f"[A] 게이트 배선 — 정상 {len(ok)} · 🔴우회 {len(bad)}")
for n, w in bad:
    print(f"     🔴 {n}: {w}")
print(f"[B] 일상어 후보 — 판정 {len(rows)}개 중 임계({FLOOR:.0%}) 미달·게이트없음 {len(low)}개")
for rate, a, tot, *_ in low[:8]:
    print(f"     {a:10s} {rate:5.0%}  ({tot:,}회)")
print(f"[C] 판정↔게이트 배선 — 게이트필요 판정 {len(debt)+len(gated)} · 있음 {len(gated)} · "
      f"⚠부채 {len(debt)}" + (f" (기준선 {prev} → 🔴증가)" if debt_grew else
                             (f" (기준선 {prev} → ✅감소, 기준선 갱신)" if prev and len(debt)<prev else "")))
for al, vd, h, cs in debt[:6]:
    print(f"     {al:10s} {vd:6s} {h:6,}회  {', '.join(cs)}")
print(f"→ {DATA / '마커린트.md'}")

if _mixed or _wrongn:
    sys.exit("🔴 파생 관계의 kind↔source가 어긋났다. **정규식 패치가 데이터를 부순 신호다.**\n"
             f"  혼재: {_mixed}\n  개수불일치: {_wrongn}")
if _fixfail:
    sys.exit(f"🔴 반례 {len(_fixfail)}건 실패. **검사가 걸러야 할 것을 못 거르고 있다.**\n"
             "  검사_반례.jsonl 은 «이 검사가 무엇을 위해 있는가»의 정의다 — 여기가 깨지면 그 검사는 죽은 것이다.")
if debt_grew:
    _d = {a: h for a, v, h, cs in debt}
    _msg = [f"🔴 게이트 부채가 {prev} → {len(debt)}로 늘었다.",
            "  ▲새로 늘어난 것: " +
            (", ".join(f"{a}({_d.get(a, 0):,}회)" for a in _added) or "(목록 없음 — 첫 기록)")]
    if _removed:
        _msg.append("  ▼사라진 것: " + ", ".join(_removed))
    _msg.append("  → 게이트를 달거나, 판정을 반박할 근거를 남겨라.")
    sys.exit("\n".join(_msg))
if bad:
    sys.exit("🔴 게이트를 우회하는 모듈이 있다. 위 목록을 고치기 전엔 통과시키지 않는다.")
