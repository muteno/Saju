# 셰프단 — 할머니 도사 v1 (Q.40 · 운영자 260726 구술 지시)
#
# 운영자 원문: "수채화 풍 말고, 제대로 미연시풍으로 사주볼것같은 도사 할머니 모습도 하나 뽑아주셈,
# 뭔가 세련된 도시이미지 이지만, 도사는 도사인 느낌으로다가 기쎈 언니 느낌으로"
#
# ◆ 기존 남신(v3~v5)과 무엇이 다른가 — v5는 "lineless painterly · 저채도 모노크롬 · 느와르"였다.
#   이번은 그 축을 **명시적으로 버린다**: 수채·회화 질감 금지, **비주얼노벨 스탠딩 CG 문법**
#   (선명한 셀 채색 + 또렷한 라인 + 정면 바스트업 + 배경 보케)으로 간다.
# ◆ 3축을 동시에 잡아야 한다 — ①할머니(나이를 지우지 않는다) ②세련된 도시(촌스러운 무속 소품 금지)
#   ③기센 언니(카리스마 = 눈매·자세로. 인자한 할머니로 흘러내리는 게 이 캐릭터의 실패 모드다).
# ◆ 셰프단 규약(chefs.ts) = 플레이트 `chef-<id>.jpg`. 여기선 정본 원본만 reports/에 뽑고,
#   앱 배선(ACTIVE_CHEF_ID·플레이트 사본)은 **운영자가 컷을 보고 고른 뒤** 별도 커밋으로 한다.
# 시크릿은 러너 안에서만 산다 — 로그·파일에 절대 찍지 않는다(260712 보안 철칙).
import base64
import os
import pathlib
import sys
import time

import requests

KEY = "".join(os.environ["OPENAI_API_KEY"].split())
AUTH = {"Authorization": f"Bearer {KEY}"}
API = "https://api.openai.com/v1/images/generations"

OUT = pathlib.Path(__file__).resolve().parents[2] / "app/public/reports/chef-halmeoni-v1"
OUT.mkdir(parents=True, exist_ok=True)

SIZE = "1024x1536"  # 세로 = 미연시 스탠딩(남신 v3~v5와 같은 규격 계승)
QUALITY = "high"

STYLE = (
    "아트 스타일: 일본 비주얼노벨(미연시)의 캐릭터 스탠딩 CG. 또렷한 라인아트 + 선명한 셀 채색 + "
    "부드러운 그라데이션 그림자. 수채화·페인터리·유화 질감 금지, 거친 붓자국 금지, 실사 금지. "
    "인물은 화면 중앙에 무릎 위 바스트업으로 크게, 정면을 똑바로 응시. 배경은 얕은 피사계 심도로 "
    "흐린 도시 야경(통유리 너머 빌딩 불빛)이며 인물보다 확실히 뒤로 물러나 있다. 조명은 창밖 도시의 "
    "차가운 푸른 빛과 실내의 따뜻한 조명이 얼굴에서 만나는 투톤. 고해상도, 깔끔한 마감."
)

CHARACTER = (
    "인물: 사주를 봐 주는 여성 도사, 나이는 70대 할머니. 나이를 지우지 말 것 — 은백색 머리, "
    "눈가와 입가의 주름, 검버섯 없는 정갈한 피부. 하지만 늙수그레하거나 인자한 시골 할머니가 "
    "절대 아니다: 등을 곧게 세우고 턱을 살짝 든 자세, 날카롭고 자신감 넘치는 눈매, 입꼬리 한쪽만 "
    "올린 서늘한 미소 — '기센 큰언니'의 카리스마. 은발은 헝클어짐 없이 단정하게 틀어 올렸고 "
    "비취 비녀 하나로 고정. 붉은 립, 짙은 눈매 화장."
)

WARDROBE = (
    "의상: 세련된 도시 감각의 모던 개량 한복 — 먹빛(차콜) 실크 재킷에 짙은 남색 안감, 절제된 금사 "
    "자수 한 줄, 어깨선이 딱 떨어지는 테일러드 실루엣. 장신구는 비취 가락지와 얇은 금테 안경 하나. "
    "촌스러운 무속 소품(부적 더미, 방울, 오방색 천, 굿상, 촛불 다발) 금지. 배경 소품은 "
    "원목 상담 테이블 위의 만세력 책 한 권과 백자 찻잔 정도로 절제."
)

NEG = "화면에 글자·한자·로고·워터마크·말풍선·프레임 테두리를 넣지 말 것. 손가락 개수 정확히."

CUTS = [
    ("cut1_greet", "포즈·표정: 상담석에 앉아 팔짱을 끼고 정면을 바라보며 '왔어? 앉아.' 하는 첫 대면. 서늘한 미소, 눈은 웃지 않는다."),
    ("cut2_read", "포즈·표정: 만세력 책을 한 손으로 짚고 고개를 살짝 기울여 상대를 꿰뚫어 보는 순간. 눈매가 날카롭게 좁혀져 있다."),
    ("cut3_smirk", "포즈·표정: 찻잔을 들어 올리며 한쪽 입꼬리를 올린 도발적인 미소. '그럴 줄 알았지'라는 표정."),
]


def gen(name: str, pose: str) -> None:
    dst = OUT / f"{name}.png"
    if dst.exists():
        print(f"  ↷ {name} 이미 있음 — 건너뜀")
        return
    prompt = f"{STYLE} {CHARACTER} {WARDROBE} {pose} {NEG}"
    body = {"model": "gpt-image-1", "prompt": prompt, "size": SIZE, "quality": QUALITY, "n": 1}
    for attempt in range(3):
        r = requests.post(API, headers=AUTH, json=body, timeout=900)
        if r.status_code == 200:
            dst.write_bytes(base64.b64decode(r.json()["data"][0]["b64_json"]))
            print(f"  ✅ {name} ({dst.stat().st_size // 1024}KB)")
            return
        print(f"  ⚠ {name} 실패 {r.status_code} (시도 {attempt + 1}/3)")
        time.sleep(8 * (attempt + 1))
    sys.exit(f"::error::{name} 생성 3회 실패")


def main() -> None:
    # 운영자 지시는 "하나 뽑아주셈" — 다만 표정 1컷만으론 캐릭터가 서는지 판단이 안 된다.
    # 기본은 대표 1컷(cut1)이고, 더 보고 싶으면 CUTS_ALL=1로 3컷까지 연다(과금은 컷당 발생).
    cuts = CUTS if os.environ.get("CUTS_ALL") == "1" else CUTS[:1]
    for name, pose in cuts:
        gen(name, pose)
    print(f"완료 — {OUT} 에 {len(list(OUT.glob('*.png')))}컷")


if __name__ == "__main__":
    main()
