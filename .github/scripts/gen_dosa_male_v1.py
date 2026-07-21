# 남신 도사 시안 컷 5종 생성 (Q.17) — 프롬프트 정본 = docs/20260721_141213_남신도사_페르소나_GPT이미지프롬프트_v1.md
# 컷1 = generations(기준 얼굴) → 컷2~5 = edits(컷1 참조 = 캐릭터 일관성). GH Actions 러너 전용.
import base64
import pathlib
import sys
import time

from openai import OpenAI

client = OpenAI()
OUT = pathlib.Path("app/public/reports/dosa-male-v1")
OUT.mkdir(parents=True, exist_ok=True)

SIZE = "1024x1536"  # gpt-image-1 세로 최대(2:3) — 9:16은 상하 크롭으로 사용(정본 문서 함정 노트)
QUALITY = "high"

CUT1 = """부드러운 수채화 질감의 애니메이션 일러스트로, 사주 봐주는 앱의 남자 캐릭터 프로필 사진을 그려줘. 실사 아님, 수채 애니 일러스트 스타일.

[인물]
20대 중반의 굉장히 잘생긴 동아시아 남성 '도사' 캐릭터. 은회색이 도는 잿빛 장발을 뒤로 느슨하게 반묶음했고, 앞머리 몇 가닥이 이마에 흘러내려 있다. 가늘고 날카로운 눈매, 옅은 갈색 눈동자, 날렵한 턱선, 맑고 밝은 피부. 한쪽 귀에 작은 은색 귀걸이. 흰 셔츠 위에 연한 하늘색과 먹색이 은은하게 섞인 모던 개량한복 두루마기를 가볍게 걸쳤다. 한 손에는 접힌 쥘부채를 들고 있다.

[표정·포즈]
팔짱을 끼고 턱을 살짝 치켜든 채, 한쪽 입꼬리만 올라간 자신만만한 미소. "내 사주풀이는 틀린 적이 없거든" 하는, 거만하지만 밉지 않은 여유.

[구도·배경]
정면 상반신(가슴 위) 프로필 사진 구도. 인물은 화면 정중앙, 머리 위와 아래에 하늘 여백을 넉넉하게. 배경은 연한 하늘색 수채 하늘에 옅은 구름, 저 아래로 아주 흐릿한 수채 기와지붕 실루엣. 전체적으로 채도 낮은 파스텔 톤, 얇고 섬세한 선, 은은한 수채 번짐."""

KEEP = "이 이미지의 캐릭터를 그대로 유지해줘(같은 얼굴·머리·의상·수채 애니 스타일·연하늘 수채 배경·정면 상반신 구도). 표정과 포즈만 바꾼다: "

EDITS = [
    ("cut2_serious", KEEP + "접은 쥘부채 끝을 턱에 살짝 댄 채 시선을 아래로 내리깔고 깊게 생각에 잠긴 진지한 표정. 미소는 없애고, 차분하고 깊은 눈빛. 배경 구름 사이로 은은한 빛이 내려와 공기가 한층 가라앉은 분위기. \"갑자기 멋있어지는 순간\"의 느낌."),
    ("cut3_clumsy", KEEP + "눈을 동그랗게 뜨고 살짝 당황해서 어색하게 헛웃음 짓는 표정. 한 손으로 뒤통수를 긁적이고, 이마 옆에 작은 땀방울 하나. 쥘부채는 반쯤 펼쳐진 채 삐뚜름하게 들려 있다. 방금 아주 진지한 얼굴로 헛소리를 해버린 직후의 민망하고 귀여운 분위기."),
    ("cut4_consult", KEEP + "활짝 편 쥘부채를 입가에 살짝 대고, 상대를 지그시 바라보며 확신에 찬 부드러운 미소. 다른 손에는 오래된 만세력 두루마리를 들고 있다. \"자, 그대 사주 한번 볼까\" 하는 능숙한 상담가의 분위기. 부채에는 은은한 먹색 구름 무늬."),
    ("cut5_wink", KEEP + "활짝 편 쥘부채로 얼굴 아래쪽 절반을 가리고, 눈으로만 장난스럽게 웃으며 한쪽 눈을 살짝 윙크. 능청스럽고 여유로운 분위기. 홈 화면 인사 배너용 컷."),
]


def save(name: str, b64: str) -> None:
    path = OUT / f"{name}.png"
    path.write_bytes(base64.b64decode(b64))
    print(f"saved {path} ({path.stat().st_size} bytes)", flush=True)


def with_retry(fn, label: str):
    for attempt in range(3):
        try:
            return fn()
        except Exception as e:  # noqa: BLE001 — 러너 1회성 스크립트, 원인 불문 재시도 후 중단
            print(f"retry {label} ({attempt + 1}/3): {type(e).__name__}: {e}", flush=True)
            time.sleep(20)
    print(f"::error::{label} 3회 실패", flush=True)
    sys.exit(1)


def edit_cut1(prompt: str):
    with open(OUT / "cut1_arrogant.png", "rb") as f:
        try:
            return client.images.edit(
                model="gpt-image-1", image=f, prompt=prompt,
                size=SIZE, quality=QUALITY, input_fidelity="high",
            )
        except TypeError:  # 구버전 SDK = input_fidelity 미지원
            f.seek(0)
            return client.images.edit(
                model="gpt-image-1", image=f, prompt=prompt, size=SIZE, quality=QUALITY,
            )


r = with_retry(
    lambda: client.images.generate(model="gpt-image-1", prompt=CUT1, size=SIZE, quality=QUALITY),
    "cut1_arrogant",
)
save("cut1_arrogant", r.data[0].b64_json)

for name, prompt in EDITS:
    r = with_retry(lambda p=prompt: edit_cut1(p), name)
    save(name, r.data[0].b64_json)

print("all 5 cuts done", flush=True)
