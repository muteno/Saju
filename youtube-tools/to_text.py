# -*- coding: utf-8 -*-
"""json3 자막 → 읽기용 텍스트. 시간 간격 기준으로 문단 나눔."""
import json, sys
from pathlib import Path

PARA_GAP_MS = 3500   # 이 이상 침묵이면 새 문단
MAX_PARA_CHARS = 700  # 문단이 너무 길면 강제 분할


def json3_to_paragraphs(path):
    d = json.load(open(path, encoding="utf-8"))
    lines = []  # (tStartMs, text)
    for ev in d.get("events", []):
        segs = ev.get("segs")
        if not segs:
            continue
        txt = "".join(s.get("utf8", "") for s in segs).replace("\n", " ").strip()
        if txt:
            lines.append((ev.get("tStartMs", 0), txt))
    paras, cur, last_t = [], [], None
    for t, txt in lines:
        if cur and (t - last_t > PARA_GAP_MS or sum(len(c) for c in cur) > MAX_PARA_CHARS):
            paras.append(" ".join(cur))
            cur = []
        cur.append(txt)
        last_t = t
    if cur:
        paras.append(" ".join(cur))
    return paras


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    for vid in sys.argv[1:]:
        info_p = Path(f"raw/{vid}.info.json")
        sub_p = Path(f"raw/{vid}.ko.json3")
        meta = {}
        if info_p.exists():
            i = json.load(open(info_p, encoding="utf-8"))
            meta = {k: i.get(k) for k in ("title", "channel", "upload_date", "duration_string", "view_count")}
        print("=" * 70)
        print(f"[{vid}] {meta.get('channel')} | {meta.get('upload_date')} | {meta.get('duration_string')}")
        print(f"제목: {meta.get('title')}")
        if sub_p.exists():
            paras = json3_to_paragraphs(sub_p)
            total = sum(len(p) for p in paras)
            print(f"자막: 문단 {len(paras)}개, {total:,}자")
            print("--- 앞부분 미리보기 ---")
            preview = "\n\n".join(paras[:3])
            print(preview[:600])
        else:
            print("자막 파일 없음")
