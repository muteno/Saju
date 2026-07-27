# -*- coding: utf-8 -*-
"""
수기 조건부 간선 — 사람이 건진 「조건 → 관계」를 **축자 검증을 통과한 것만** 지도에 올린다.

═══ 왜 이 파일이 필요한가 ═══
  운영자 260726: *"웹페이지 스크랩한것만 잘 녹여도 충분해. 근데 **기본이 안 놓여있으면**
  전사한걸 가져와도 **어디에 붙일지 놀아버리는** 상황이 생기는거지."*

  실측: 개념 251개 중 **131개가 조건부 다리 0개**다. 정의만 있고 «언제 켜지는지»를
  모르는 사전 상태다. 자동 채굴기(`build_branch_edges.py`)는 **한 문장 안에서
  대칭 분기**를 이루는 것만 잡는다 — 조건과 귀결이 문장을 걸쳐 있거나
  표로 적힌 것은 구조적으로 못 잡는다. 그 몫을 사람이 채운다.

═══ ⚠이 파일의 진짜 위험 — 요약이 데이터로 둔갑하는 것 ═══
  손으로 옮겨 적는 순간 **«저자가 한 말»과 «내가 이해한 말»의 경계가 사라진다.**
  이 프로젝트가 이미 두 번 당한 사고다(gist를 축자로 위장 1.0% · 「임수2 = 유학」).
  → 그래서 **`검증구`가 그 `para_id` 문단에 실제로 있는지 대조**한다.
    없으면 그 줄은 **버려지고 화면에 뜬다.** 조용히 통과하는 길이 없다.
  ⚠검증구는 «조건 전체»가 아니라 «그 문단이 맞다»를 확인하는 닻이다 —
    조건 문구까지 축자로 요구하면 사람이 문장을 자를 수 없어 원고를 못 쓴다.
    대신 조건 서술은 **관계와 조건만** 담고 결론(직업·길흉)은 금지한다(아래 게이트).

═══ 담지 않는 것 ═══
  · 삶의 부호로 건너뛴 문장(「~면 사업이 맞다」) — 경계선: 조견표까지는 적기,
    글자→삶의 부호부터는 창작이다.
  · 정본 노드명이 아닌 이름 — 게이트가 죽인다.

출력: data/조건부간선_수기.jsonl  (스키마는 `조건부간선.jsonl`과 같다 — 링크망이 둘 다 먹는다)
"""
import json, re, sys, unicodedata, importlib.util, hashlib
from pathlib import Path
from collections import Counter

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
sys.path.insert(0, str(HERE))
_sp = importlib.util.spec_from_file_location("bnm", HERE / "build_neuron_map.py")
bnm = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(bnm)
bnm.SNAP_DIRS = bnm._snapshot_dirs()
from 작업내역 import 단계          # noqa: E402
import 코퍼스 as CP                # noqa: E402

CONCEPTS = set(bnm.CONCEPT_MARKER_RE)

# ⛔결론 어휘 — 이게 조건·관계 서술에 들어오면 그 줄은 «의미 정의»다. 죽인다.
결론어 = re.compile(
    r"사업|직업|이직|승진|결혼|이혼|합격|취업|유학|이민|부자|가난|성공|실패|"
    r"좋다|나쁘다|길하|흉하|대박|망한|돈을\s*번|돈을\s*잃")


# 조건극성 — 「~없으면」은 「~있으면」의 반대다. 섞으면 지도가 거꾸로 말한다.
_NEG = re.compile(r"없(?:으면|을\s*때|다면|는)|않(?:으면|을\s*때|다면|는)|못\s*")


def norm(t):
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", t or ""))


def main():
    rows = []
    for line in (HERE / "조건부_원고.jsonl").read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        d = json.loads(line)
        if d.get("_주석") or d.get("_규칙") or not d.get("a"):
            continue
        rows.append(d)

    # ── 문단 색인 (para_id → 본문). 코퍼스 규칙 3종은 리더가 이미 적용한다.
    #   ⚠격자(운세)는 리더가 뺀다 — 원고가 격자 문단을 가리키면 «문단 없음»으로 걸린다.
    #     그건 결함이 아니라 «그 문단은 지도의 근거로 안 쓴다»는 기존 결정의 작동이다.
    idx = {}
    for r in CP.문단들():
        idx[r["para_id"]] = r
    for r in CP.문단들(격자=True):          # 격자도 «확인용»으로는 본다(채택은 아래서 표시)
        idx.setdefault(r["para_id"], r)

    out, stat, 탈락 = [], Counter(), []
    for d in rows:
        a, b = d["a"], d["b"]
        if a not in CONCEPTS or b not in CONCEPTS:
            탈락.append((d, f"정본 노드명 아님 — {[x for x in (a, b) if x not in CONCEPTS]}"))
            stat["탈락:노드명"] += 1
            continue
        p = idx.get(d["para_id"])
        if p is None:
            탈락.append((d, f"문단 없음 — {d['para_id']} (오타이거나 격자·보류군이라 코퍼스 밖)"))
            stat["탈락:문단없음"] += 1
            continue
        if norm(d["검증구"]) not in norm(p["text"]):
            탈락.append((d, f"★검증구가 그 문단에 없다 — 「{d['검증구']}」. "
                            f"요약을 축자로 착각했을 수 있다"))
            stat["탈락:축자불일치"] += 1
            continue
        if 결론어.search(d.get("조건", "")):
            탈락.append((d, f"⛔조건 서술에 결론 어휘 — 「{결론어.search(d['조건']).group()}」"))
            stat["탈락:결론"] += 1
            continue
        # ⚠**스키마는 자동 채굴본(`조건부간선.jsonl`)과 한 글자도 다르면 안 된다.**
        #   링크망이 `e["출처"]`를 문자열로 읽는데 여기서 리스트를 주면 조용히 깨진다.
        #   (「만들어 놓고 배선 안 함」의 사촌 — 배선은 했는데 «모양»이 다른 것.)
        #   자동본 의미: 조건=조건 «종류» 목록 · 조건절=원문 조각 · 출처=웹/전사 · 출처처=저자
        out.append({
            "a": a, "b": b, "kind": "조건부", "dir": "→",
            "polarity": d.get("부호") or "중립",
            "조건": ["수기"], "조건절": d["조건"],
            "para_id": d["para_id"], "출처": p["출처종"], "출처처": p["출처"],
            "등급": "상", "조건극성": ("부재" if _NEG.search(d["조건"]) else "존재"),
            "트리거품질": 1.0, "트리거총칭": False,
            # 수기 전용 — 자동본엔 없다. 소비처는 있으면 쓰고 없으면 무시한다.
            "수기": True, "수기관계": d.get("kind", "관계"), "검증구": d["검증구"],
            "간선id": "M-" + hashlib.md5(
                f"{a}|{b}|{d['para_id']}".encode()).hexdigest()[:8],
        })
        stat["채택"] += 1

    (DATA / "조건부간선_수기.jsonl").write_text(
        "\n".join(json.dumps(x, ensure_ascii=False) for x in out) + "\n", encoding="utf-8")

    print(f"수기 조건부 — 원고 {len(rows)}줄 → 채택 {stat['채택']} · 탈락 {len(탈락)}")
    for d, why in 탈락:
        print(f"   🔴 {d['a']} → {d['b']}  ·  {why}")
    if stat["채택"]:
        cov = sorted({x["a"] for x in out} | {x["b"] for x in out})
        print(f"   조건부 다리가 새로 붙은 개념 {len(cov)}개: {', '.join(cov[:14])}…")

    with 단계("수기 조건부 간선",
            "개념 131개가 조건부 다리 0 — 「붙일 자리」가 없으면 전사를 가져와도 떠돈다. "
            "자동 채굴이 못 잡는 것을 사람이 적되 **축자 검증을 통과한 것만** 올린다",
            ["data/조건부간선_수기.jsonl"]) as st:
        st.기록(f"원고 {len(rows)} → 채택 {stat['채택']} · 탈락 {dict(stat)}")
        for d, why in 탈락:
            st.기록(f"탈락 {d['a']}→{d['b']}: {why}")


if __name__ == "__main__":
    main()
