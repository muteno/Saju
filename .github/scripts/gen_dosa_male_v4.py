# 남신 도사 v4 — 수채 질감 제거(Q.21): v3 표정 5컷의 구도·표정·의상은 유지, 렌더링만
# 세련된 다크 디지털 셀 일러스트로 교체. 입력 = dosa-male-v3/cut*.png (edits 참조).
# input_fidelity는 걸지 않는다 — high는 스타일까지 잠가 수채 질감이 안 빠짐(스타일 변환 목적).
import base64
import os
import pathlib
import sys
import time

import requests

KEY = "".join(os.environ["OPENAI_API_KEY"].split())  # 시크릿 복붙 개행·공백 방어(2호 런 실측)
AUTH = {"Authorization": f"Bearer {KEY}"}
API = "https://api.openai.com/v1/images"

SRC = pathlib.Path("app/public/reports/dosa-male-v3")
OUT = pathlib.Path("app/public/reports/dosa-male-v4")
OUT.mkdir(parents=True, exist_ok=True)

SIZE = "1024x1536"
QUALITY = "high"

RESTYLE = ("이 이미지의 캐릭터와 장면을 그대로 유지해라 — 같은 얼굴(흑발 웨이브 미디엄 헤어·앞머리 눈가에 걸림·"
           "날카롭고 나른한 눈매·귀 피어싱), 같은 표정, 같은 포즈, 같은 구도, 같은 먹색 로브와 소품(쥘부채·두루마리). "
           "바꾸는 것은 렌더링 스타일 하나뿐: 수채화·종이 질감을 완전히 제거하고, 세련된 다크 톤 디지털 애니메이션 "
           "일러스트로 다시 그려라. 클린하고 날카로운 라인아트, 매끈한 셀 셰이딩, 시네마틱한 무드 조명과 깊은 명암 대비, "
           "배경은 매끈한 다크 네이비 밤하늘 그라데이션(별과 초승달은 은은하게 발광). 고급 웹툰 표지 같은 완성도, "
           "시크하고 세련된 분위기. 실사 아님.")

CUTS = ["cut1_arrogant", "cut2_serious", "cut3_clumsy", "cut4_consult", "cut5_wink"]


def save(name: str, b64: str) -> None:
    path = OUT / f"{name}.png"
    path.write_bytes(base64.b64decode(b64))
    print(f"saved {path} ({path.stat().st_size} bytes)", flush=True)


def restyle(src: pathlib.Path) -> str:
    with open(src, "rb") as f:
        r = requests.post(
            f"{API}/edits", headers=AUTH, timeout=300,
            data={"model": "gpt-image-1", "prompt": RESTYLE, "size": SIZE, "quality": QUALITY},
            files={"image": (src.name, f, "image/png")},
        )
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
    return r.json()["data"][0]["b64_json"]


def with_retry(fn, label: str) -> str:
    for attempt in range(4):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 — 러너 1회성 스크립트, 원인 불문 재시도 후 중단
            print(f"retry {label} ({attempt + 1}/4): {type(e).__name__}: {e}", flush=True)
            time.sleep(20)
    print(f"::error::{label} 4회 실패", flush=True)
    sys.exit(1)


for name in CUTS:
    src = SRC / f"{name}.png"
    assert src.exists(), f"기준 이미지 없음: {src}"
    save(name, with_retry(lambda s=src: restyle(s), name))

print("all v4 cuts done", flush=True)
