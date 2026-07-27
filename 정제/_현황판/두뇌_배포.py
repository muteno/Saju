# -*- coding: utf-8 -*-
"""
두뇌 배포 — `data/앱두뇌.json` → `app/public/brain.json`.

⑱(앱 두뇌 팩)의 «복사는 아직 수동» 단계를 파이프라인에 배선(260727) —
지도는 새것인데 앱이 옛 뇌를 먹는 사고를 끊는다. 같으면 안 건드린다(불필요한 mtime 변동 방지).
"""
import shutil, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from 경로 import DATA, 뿌리

src = DATA / "앱두뇌.json"
dst = 뿌리 / "app" / "public" / "brain.json"

if not src.exists():
    raise SystemExit(f"[없음] {src} — ⑱ 앱 두뇌 팩을 먼저 돌려라")
if dst.exists() and dst.read_bytes() == src.read_bytes():
    print(f"= 이미 최신 ({dst.stat().st_size:,}B) — 복사 생략")
else:
    shutil.copyfile(src, dst)
    print(f"→ 배포 {src.stat().st_size:,}B → {dst}")
