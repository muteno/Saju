# -*- coding: utf-8 -*-
"""백과사전 원고 → data/백과.jsonl — «원고를 쌓기만 하면 아무도 안 읽는다»의 방지벽

═══ 왜 이 파일이 있나 (260728) ═══

운영자 확정: 기초 = 백과사전식 정의집(~10만자, 차등 밴드), 그 위에 확률적 살.
집필 위원 E1~E5가 `정의원고/백과_*.md`를 쓴다. 그런데 이 프로젝트는
**「생산자만 있고 소비자가 없는 산출물」로 열세 번 데였다** — 원고가 md로만 남으면
볼트도 앱도 그걸 모르고, 기존 53자 정의가 계속 정본 행세를 한다.

이 파서가 원고를 기계가 먹는 형태로 바꾸고, 볼트 빌더(⑮)가 소비한다.
파이프라인 ⑩-B로 등재 — 대차대조표가 생산·소비를 둘 다 본다.

═══ 규칙 ═══
- 항목 이름은 **정본 노드명이어야 한다**(node_layers.jsonl 대조). 아니면 exit 1 —
  「정본 노드명이 아니면 죽인다. 게이트가 없으면 조용히 틀린다.」
- «근거» 줄은 검수용 메타로 따로 담는다(본문 아님).
- 원고가 없거나 비어 있으면 **조용히 넘어가지 않고** 그 사실을 찍는다.
"""
import json, re, sys, glob
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
원고들 = sorted(glob.glob(str(HERE / "정의원고" / "백과_*.md")))

정본 = {json.loads(l)["concept"] for l in (DATA / "node_layers.jsonl").open(encoding="utf-8")}

# 칸 이름 — E5는 S15에서 «무엇이 여기 착지하나»를 쓸 수 있다(발현은 산출이 아니라 착지).
칸패턴 = re.compile(r"\*\*(무엇|어디서 나오나|어떻게 산출되나|무엇이 여기 착지하나|무엇을 낳나|갈리는 것)\*\*\s*[:：]\s*")

rows, 이름오류 = [], []
for f in 원고들:
    text = Path(f).read_text(encoding="utf-8")
    # 항목 경계 = "\n## " (차례·머리말 절은 이름 검증에서 걸러진다)
    for chunk in re.split(r"\n(?=## )", text):
        m = re.match(r"## (.+)", chunk)
        if not m:
            continue
        name = m.group(1).strip()
        if name in ("차례",) or name.startswith(("S0", "S1")):
            continue                            # 부(部) 머리
        if name not in 정본:
            이름오류.append((Path(f).name, name))
            continue
        칸들 = {}
        parts = 칸패턴.split(chunk)
        # parts = [머리, 칸명, 내용, 칸명, 내용, ...]
        for i in range(1, len(parts) - 1, 2):
            body = parts[i + 1]
            # 다음 구조물(근거 줄·다음 항목) 전까지
            body = re.split(r"\n근거\s*[:：]", body)[0].strip()
            칸들[parts[i]] = body
        근거m = re.search(r"\n근거\s*[:：]\s*(.+?)(?:\n\n|\n#|$)", chunk, re.S)
        rows.append({
            "concept": name, "원고": Path(f).name,
            "무엇": 칸들.get("무엇", ""),
            "어디서": 칸들.get("어디서 나오나", ""),
            "산출": 칸들.get("어떻게 산출되나") or 칸들.get("무엇이 여기 착지하나", ""),
            "낳나": 칸들.get("무엇을 낳나", ""),
            "갈림": 칸들.get("갈리는 것", ""),
            "근거": (근거m.group(1).strip().replace("\n", " ") if 근거m else ""),
            "자수": sum(len(v) for v in 칸들.values()),
        })

if 이름오류:
    print("⛔ 정본 노드명이 아닌 항목 — 원고를 고치든 노드를 세우든 사람이 정한다:")
    for f, n in 이름오류:
        print(f"   {f}: 「{n}」")
    sys.exit(1)

if not rows:
    print("⚠ 백과 원고가 아직 없다(정의원고/백과_*.md) — 산출물을 만들지 않고 끝낸다.")
    sys.exit(0)

# 중복 이름 = 두 원고가 같은 개념을 썼다 — 조용히 덮지 않고 죽는다
from collections import Counter
dup = [k for k, v in Counter(r["concept"] for r in rows).items() if v > 1]
if dup:
    print(f"⛔ 같은 개념이 두 원고에 있다: {dup}")
    sys.exit(1)

out = DATA / "백과.jsonl"
with out.open("w", encoding="utf-8") as fo:
    for r in sorted(rows, key=lambda x: x["concept"]):
        fo.write(json.dumps(r, ensure_ascii=False) + "\n")

빈무엇 = sum(1 for r in rows if not r["무엇"])
print(f"백과 항목 {len(rows)} / 정본 {len(정본)}  ·  원고 {len(원고들)}권  ·  총 {sum(r['자수'] for r in rows):,}자")
print(f"  «무엇» 빈 항목 {빈무엇} · 근거 줄 없는 항목 {sum(1 for r in rows if not r['근거'])}")
print(f"→ {out}")
