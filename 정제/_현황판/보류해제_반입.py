# -*- coding: utf-8 -*-
"""보류군 3파일 P0 반입 — 매화역수·운세력사용설명서·택일기타사용설명 (운영자 승인 260728)

═══ 왜 이 셋만 해제하나 ═══
보류군 19파일은 「키셋이 다른 술수」라 뺐고 그 판단은 여전히 맞다 —
19파일 2,355청크 표본에서 명리 코어어 보유율이 당사주 0.0%·타로 1.9%·관상 3.9%였다.
그런데 셋이 예외로 실측됐다(B2 위원 260728 · 감독관 재검):
    운세력사용설명서   94.7%   ← 만세력 표시 규격(원국·대운·격국·용신·신살)
    매화역수자료실     57.6%   ← 이름만 매화역수, 내용은 명리 합충 이론
                                (「지지의 육합: 자축합토, 인해합목…」 · 모자멸자·토다금매)
    택일기타사용설명   54.5%   ← 생기복덕 택일 = S11 택일 노드의 재료

실증: 이 셋을 뺀 탓에 `명암합`·`모자멸자`·`토다금매` 개념 후보의 근거가 얇게 잡혔다 —
     **자료가 없는 게 아니라 우리가 안 읽고 있었다**(「부성입묘」 사고와 같은 형태).

═══ 방법 ═══
_카탈로그_보류.jsonl 에 글 좌표(제목·줄범위)가 이미 전량 보존돼 있다(260722 3대).
그 좌표대로 본문을 문단화한다 — P0 스펙 v1 그대로:
  · 문단 경계 = 빈 줄 · 문단 = 원문 축자(수정 0) · gist = 요지 한 줄(우리가 붙이는 이름표)
  · ⚠이 반입기는 gist를 «비움»으로 둔다 — 기계가 요지를 지어내면 그게 창작이다.
    gist 없는 문단은 코퍼스.본문()이 그대로 본문만 주므로 안전하다.
접두 = XT-MEHWA / XT-UNSE / XT-TAEK (카탈로그 post_id 계승 — 충돌 없음 확인).

⚠나머지 16파일은 그대로 보류다. 이 파일이 그 결정을 바꾸지 않는다.
"""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import 경로

INV = Path(경로.P0_인벤토리)
SNAP = INV / "webtxt_v1"
CAT = INV / "_카탈로그_보류.jsonl"

대상 = {
    "mehwa-매화역수자료실 게시판 글모음.txt": ("XT-MEHWA", "매화역수자료실(명리 합충 이론)"),
    "운세력사용설명서 게시판 글모음.txt": ("XT-UNSE", "운세력 사용설명(만세력 표시 규격)"),
    "택일기타사용설명 게시판 글모음.txt": ("XT-TAEK", "택일 기타 사용설명"),
}

cat = [json.loads(l) for l in CAT.open(encoding="utf-8") if l.strip()]
rows = [r for r in cat if r.get("file") in 대상]
assert rows, "카탈로그에서 대상 글을 못 찾았다"

posts_out, paras_out = [], []
for f, (pref, label) in 대상.items():
    lines = (SNAP / f).read_text(encoding="utf-8-sig").splitlines()
    글들 = sorted((r for r in rows if r["file"] == f), key=lambda r: r["lines"][0])
    print(f"── {f}: 글 {len(글들)}편 · {len(lines):,}줄")
    for r in 글들:
        s, e = r["lines"]                      # 1-기반 · 양끝 포함 (P0 규약)
        body = lines[s - 1:e]
        pid = r["post_id"]
        posts_out.append({
            "post_id": pid, "file": f, "title": r.get("title"), "date": r.get("date"),
            "url": r.get("url"), "author": "플러스명리학", "sub_author": r.get("writer"),
            "membership": False, "lines": [s, e], "license": "none",
            "비고": f"보류 해제 반입 260728 — {label}",
        })
        # 문단 경계 — ⚠이 게시판 원문엔 **빈 줄이 0개**다(실측 794줄 중 0).
        #   빈 줄로 자르면 글 전체가 한 문단이 된다(1차 실행에서 글 36 = 문단 36으로 실증).
        #   → 소제목 줄(「1.」·「1).」·「■」류)에서 자르고, 소제목이 없는 긴 글은
        #     8줄 묶음으로 접는다(웹 문단 중앙값 ~500자에 맞춘 값).
        수제목 = re.compile(r"^\s*(?:\d+\s*[.)]|\d+\)\.|[■□◆●○▶])")
        cur, cs = [], s
        blocks = []
        for i, ln in enumerate(body, start=s):
            if 수제목.match(ln) and cur:
                blocks.append((cs, i - 1, cur)); cur = [ln]; cs = i
            else:
                if not cur:
                    cs = i
                cur.append(ln)
            if len(cur) >= 8 and not 수제목.match(ln):
                blocks.append((cs, i, cur)); cur = []
        if cur:
            blocks.append((cs, s + len(body) - 1, cur))
        for n, (bs, be, blk) in enumerate(blocks, 1):
            text = "\n".join(blk).strip()
            if len(text) < 15:                 # 제목 줄·구분선 조각
                continue
            paras_out.append({
                "para_id": f"{pid}-{n:02d}", "post_id": pid, "lines": [bs, be],
                "kind": "이론", "gist": "", "flags": [],
            })
    # posts n_paras 채움
    for p in posts_out:
        p["n_paras"] = sum(1 for q in paras_out if q["post_id"] == p["post_id"])

with (INV / "XT_posts.jsonl").open("w", encoding="utf-8") as fo:
    for p in posts_out:
        fo.write(json.dumps(p, ensure_ascii=False) + "\n")
with (INV / "XT_paras.jsonl").open("w", encoding="utf-8") as fo:
    for q in paras_out:
        fo.write(json.dumps(q, ensure_ascii=False) + "\n")

print(f"\n반입: 글 {len(posts_out)} · 문단 {len(paras_out)}")
print(f"→ {INV/'XT_posts.jsonl'}\n→ {INV/'XT_paras.jsonl'}")
print("\n⚠다음 실행 필수: 코퍼스.py HOLD에서 이 3파일 예외 처리 확인 후 파이프라인 ①부터 재실행")
