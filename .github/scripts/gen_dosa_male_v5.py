# 남신 도사 v5 (Q.22 파일럿 → Q.25 5세트 마감) — 운영자 진단: v4 실패 원인 = "클린 라인아트" 지시.
# 레퍼런스(첨부2) 아트 형식 실측 분석 결과를 스타일 명세로 투입. 파일럿 2컷(거만·진지) 검증 후
# 운영자 GO("ㄱ하고 적용해줘")로 나머지 3컷(허당·상담·윙크) 확장 = lineless painterly 5세트 완성.
# 멱등: 이미 있는 컷은 건너뛴다(파일럿 2컷 보존 + 재실행 비용 0).
#
# ◆ 레퍼런스 아트 형식 박제(첨부2 분석 · 260721):
#   세미리얼 웹툰 디지털 페인팅 — ①하드 아웃라인 없음(윤곽 = 명암 경계, lineless painterly)
#   ②로우키 시네마틱 조명 + 글로시 하이라이트(피부·유리) ③셀 계단 없는 소프트 그라데이션
#   ④저채도 모노크롬 베이스 + 선택적 액센트 색(selective color) ⑤배경 피사계 흐림 ⑥느와르·럭셔리 무드
#   재현 키: "lineless painterly semi-realistic manhwa digital painting, cinematic low-key
#   lighting, desaturated monochrome with selective accents"
# 캐릭터 참조 = 공식 픽 face_c_night(edits 입력) · input_fidelity 미사용(v4 실측: cut2 계열이
# 락 없이도 유지 — 문제는 스타일 문구였음) · 형님상 드리프트 방지 = 연령·인상 문구 명시.
import base64
import os
import pathlib
import sys
import time

import requests

KEY = "".join(os.environ["OPENAI_API_KEY"].split())
AUTH = {"Authorization": f"Bearer {KEY}"}
API = "https://api.openai.com/v1/images"

SRC = pathlib.Path("app/public/reports/dosa-male-v2/face_c_night.png")
OUT = pathlib.Path("app/public/reports/dosa-male-v5")
OUT.mkdir(parents=True, exist_ok=True)

SIZE = "1024x1536"
QUALITY = "high"

STYLE = ("아트 스타일: 세미리얼 웹툰풍 디지털 페인팅. 하드 아웃라인·라인아트를 쓰지 말 것 — 윤곽은 명암의 경계로만 "
         "형성되는 회화적(lineless painterly) 렌더링. 로우키 시네마틱 조명, 피부와 머리칼에 글로시한 하이라이트, "
         "셀 셰이딩 계단 없이 부드러운 그라데이션 명암. 전체 색은 저채도 모노크롬(딥 네이비·차콜)으로 가라앉히고, "
         "달과 별 몇 점의 은은한 금빛만 선택적 액센트로 남긴다(selective color). 배경 밤하늘은 피사계 심도로 살짝 "
         "흐리게. 느와르처럼 시크하고 고급스러운 무드. 실사 아님, 웹소설 표지 같은 완성도.")

FACE = ("인물은 이 이미지의 캐릭터와 같은 사람: 20대 초반의 앳되고 새끈한 K-pop 아이돌급 미남(각진 중년상 금지). "
        "살짝 웨이브 진 흑발 미디엄 헤어, 앞머리가 눈가에 흘러내림, 가늘고 나른한 눈매, 귀 피어싱 여러 개, "
        "먹색 로브. ")

CUTS = [
    ("cut1_arrogant", FACE + "팔짱을 끼고 접힌 쥘부채로 어깨를 톡톡, 턱을 살짝 들고 한쪽 입꼬리만 올린 자신만만한 미소로 내려다보는 거만하지만 밉지 않은 표정. " + STYLE),
    ("cut2_serious", FACE + "접은 쥘부채 끝을 입가에 대고 시선을 내리깐 채 깊게 생각에 잠긴 진지한 표정, 미소 없음, 눈빛 깊고 차분. " + STYLE),
    ("cut3_clumsy", FACE + "쥘부채를 놓칠 뻔 허둥대며 눈을 동그랗게 뜨고 어색하게 웃는, 방금 헛소리한 걸 들킨 듯 살짝 무너진 허당 갭 표정. " + STYLE),
    ("cut4_consult", FACE + "펼친 별자리 두루마리를 한 손으로 짚고 상대를 마주 보며 다정하고 진중하게 설명하는, 상담에 몰입한 옅은 미소의 표정. " + STYLE),
    ("cut5_wink", FACE + "펼친 쥘부채를 입가에 살짝 대고 한쪽 눈을 찡긋 윙크하며 장난스럽게 웃는, 배너용 경쾌하고 매력적인 표정. " + STYLE),
]


def save(name: str, b64: str) -> None:
    path = OUT / f"{name}.png"
    path.write_bytes(base64.b64decode(b64))
    print(f"saved {path} ({path.stat().st_size} bytes)", flush=True)


def gen(prompt: str) -> str:
    with open(SRC, "rb") as f:
        r = requests.post(
            f"{API}/edits", headers=AUTH, timeout=300,
            data={"model": "gpt-image-1", "prompt": prompt, "size": SIZE, "quality": QUALITY},
            files={"image": (SRC.name, f, "image/png")},
        )
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
    return r.json()["data"][0]["b64_json"]


def with_retry(fn, label: str) -> str:
    for attempt in range(4):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001
            print(f"retry {label} ({attempt + 1}/4): {type(e).__name__}: {e}", flush=True)
            time.sleep(20)
    print(f"::error::{label} 4회 실패", flush=True)
    sys.exit(1)


assert SRC.exists(), f"기준 이미지 없음: {SRC}"
for name, prompt in CUTS:
    if (OUT / f"{name}.png").exists():
        print(f"skip {name} (이미 있음)", flush=True)
        continue
    save(name, with_retry(lambda p=prompt: gen(p), name))

print("v5 5-set done", flush=True)
