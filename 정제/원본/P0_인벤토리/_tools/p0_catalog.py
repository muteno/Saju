# 보류 파일 카탈로그: 글 단위 좌표만 추출(본문 문단화는 하지 않음)
# 산출 = P0_인벤토리\_카탈로그_보류.jsonl + _카탈로그_보류_요약.md
import json, re
from pathlib import Path
INV = Path(r"C:\Users\Hwang\OneDrive - GS칼텍스 예울마루\황세웅\6.  Nomute\3. 사주\2. 정제작업\P0_인벤토리")
SNAP = INV / "webtxt_v1"
# 글머리 형식 4종: ①작성일 …·원문 ②작성일 …·댓글·조회 ③작성일 …·분류…·원문 ④작성 <저자> ·작성일…
HEAD = re.compile(r"^작성(?:일|\s+\S+\s*·)")
DATE = re.compile(r"작성일\s*(\d{4}-\d{2}-\d{2})")
URL = re.compile(r"원문\s*(\S+)")
WRITER = re.compile(r"^작성\s+(\S+?)\s*·")

HOLD = {  # 파일 → (분류, prefix)
    "tojung-토정비결 게시판 게시판 글모음.txt": ("토정비결", "XT-TOJUNG"),
    "name-이름게시판 게시판 글모음.txt": ("작명", "XT-NAME"),
    "플러스작명설명서 게시판 글모음.txt": ("작명", "XT-NAME2"),
    "미혼모 후원 프로젝트 글모음.txt": ("후원보고", "XT-DONATE"),
    "dang-당사주자료실 게시판 글모음.txt": ("당사주", "XT-DANG"),
    "gusung-구성학자료실 게시판 글모음.txt": ("구성학", "XT-GUSUNG"),
    "face-관상학자료실 게시판 글모음.txt": ("관상", "XT-FACE"),
    "hand-수상학강좌 게시판 글모음.txt": ("수상", "XT-HAND1"),
    "hand-지문학 게시판 글모음.txt": ("수상", "XT-HAND2"),
    "hand-용어사전 게시판 글모음.txt": ("수상", "XT-HAND3"),
    "pungsu-인테리어풍수 게시판 글모음.txt": ("풍수", "XT-PS1"),
    "pungsu-형기풍수 게시판 글모음.txt": ("풍수", "XT-PS2"),
    "pungsu-기타자료 게시판 글모음.txt": ("풍수", "XT-PS3"),
    "pungsu-이기풍수 게시판 글모음.txt": ("풍수", "XT-PS4"),
    "pungsu-풍수택일 게시판 글모음.txt": ("풍수", "XT-PS5"),
    "taro-타로카드 게시판 글모음.txt": ("타로", "XT-TARO"),
    "mehwa-매화역수자료실 게시판 글모음.txt": ("매화역수", "XT-MEHWA"),
    "운세력사용설명서 게시판 글모음.txt": ("매뉴얼", "XT-MAN1"),
    "택일기타사용설명 게시판 글모음.txt": ("매뉴얼", "XT-MAN2"),
}

rows, summary = [], []
for fn, (cat, pre) in HOLD.items():
    raw = (SNAP / fn).read_text(encoding="utf-8").splitlines()
    src = raw[2] if len(raw) > 2 else ""
    idx = [i for i in range(1, len(raw)) if HEAD.match(raw[i])]
    n = 0
    for j, i in enumerate(idx):
        L = raw[i]
        d, u, w = DATE.search(L), URL.search(L), WRITER.match(L)
        end = (idx[j+1] - 1) if j + 1 < len(idx) else len(raw)
        n += 1
        rows.append({"post_id": f"{pre}-P{n:03d}", "file": fn, "title": raw[i-1].strip(),
                     "date": d.group(1) if d else None, "url": u.group(1) if u else None,
                     "writer": w.group(1) if w else None, "category": cat,
                     "lines": [i, end], "status": "보류_본문미처리"})
    summary.append((cat, fn, len(raw), n, src))

out = INV / "_카탈로그_보류.jsonl"
out.write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n", encoding="utf-8")

md = ["# P0 보류 카탈로그 — 타 술수·매뉴얼 (본문 문단화 안 함, 좌표만 보존)", "",
      "- 작성: 2026-07-22 · 3대 · **운영자 재가 대기 항목**(CLAUDE.md 260722 02:20 로그 참조)",
      "- 이유: 우리 엔진의 절대원칙은 '계산된 원국 키셋의 결정론 조회'인데 이 자료들은 키셋 자체가 다르다(괘상수·구성·상학·풍수). 섞이면 조회 노이즈가 된다.",
      "- 되돌리기: 이 카탈로그의 lines 좌표가 그대로 배치 분담표가 된다. '넣자' 한마디면 웨이브3로 처리 가능.", "",
      "| 분류 | 파일 | 총 줄 | 글 수 | 출처 |", "|---|---|---:|---:|---|"]
for cat, fn, ln, n, src in sorted(summary):
    md.append(f"| {cat} | {fn} | {ln:,} | {n} | {src.replace('출처: ','')} |")
md += ["", f"**합계: {len(HOLD)}파일 · {sum(s[2] for s in summary):,}줄 · 글 {len(rows)}편**"]
(INV / "_카탈로그_보류_요약.md").write_text("\n".join(md) + "\n", encoding="utf-8")
print(f"카탈로그 {len(rows)}글 / {len(HOLD)}파일 / {sum(s[2] for s in summary):,}줄")
for cat, fn, ln, n, _ in sorted(summary): print(f"  {cat:6s} {n:4d}글  {ln:6,}줄  {fn}")
