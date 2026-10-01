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
elif "--배포" in sys.argv:
    shutil.copyfile(src, dst)
    print(f"→ 배포 {src.stat().st_size:,}B → {dst}")
else:
    # ★261001 — 앱 두뇌는 앱 고정 감사(scripts/test_app.mjs → docs/knowledge-model/frozen_*)가 해시로 묶는다.
    #   코퍼스가 늘어 지도가 바뀌었다고 파이프라인이 몰래 덮으면 감사 17개가 깨진다(실측: 문단 56,202 재생성분).
    #   앱 쪽 후속 스냅샷 검토 없이 배포하지 않는다 — 배포는 운영자 결정(`python 두뇌_배포.py --배포`).
    print(f"⚠ 앱 두뇌가 지도와 다름 — 자동 배포 안 함(앱 고정 감사 보호). 배포하려면 --배포 + 앱 후속 스냅샷 검토")
