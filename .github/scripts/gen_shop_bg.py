# 연식당 무대 배경 (Q.42 · 운영자 260726 "연식당 저 배경부터 새로 만들어서 하나 깔아줘")
#
# ◆ 무드 정본(운영자 구술) — "너무 모던하게보다는 적당히 모던한데 글래스모피즘 … 일본식 벚꽃
#   휘날리는 풍경 … 사쿠라 느낌 지방 목재 건물에 앉아서 점을 보러 사주방에 왔지만 고풍과 품위".
# ◆ **인물 없음 · 글자 없음**이 이 배경의 핵심 계약이다. 위에 글래스 카드와 캐릭터가 얹히므로
#   배경이 주인공이면 안 된다 — 중앙~우측은 비워 두고(캐릭터 자리), 대비는 낮게 간다.
# ◆ 캐릭터 배경(chef-refs)과 달리 **레퍼런스 첨부가 필요 없다** — 일관시킬 얼굴이 없다.
# ◆ 멱등: 이미 있으면 건너뛴다(재실행 과금 0).
#
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

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "app/public/assets"
OUT.mkdir(parents=True, exist_ok=True)

PROMPT = (
    "한국·일본 전통 목조 가옥의 안마당을 그린 배경 일러스트. 인물은 한 명도 없다. "
    "벚나무가 만개해 연분홍 꽃잎이 흩날리고, 마당 한쪽에는 돌로 두른 오래된 우물이 있다. "
    "격자 미닫이문과 툇마루가 있는 목조 가옥이 왼쪽에 서 있고, 낮은 돌담과 이끼 낀 디딤돌이 이어진다. "
    "식당·간판·상점 요소는 넣지 마라 — 이곳은 가게가 아니라 **오래된 집**이다. "
    "전체를 관통하는 정서는 **음양의 조화**다: 밝음과 그늘, 흰빛과 먹빛, 물과 돌이 한 화면에서 짝을 이룬다. "
    "화면의 **중앙과 오른쪽은 의도적으로 비워 둔다**(그 자리에 인물과 카드가 얹힌다). "
    "아트 스타일: 비주얼노벨 배경 일러스트 — 또렷한 원근, 부드러운 셀 채색, 수묵의 여백감. "
    "채도와 대비는 낮게 가라앉혀 위에 얹힐 흰 유리 카드와 글자가 잘 읽히게 한다. "
    "고풍스럽고 품위 있는 분위기. 화면에 글자·간판·로고·워터마크·프레임을 넣지 말 것."
)


def main() -> None:
    dst = OUT / "shop-bg.jpg"
    if dst.exists():
        print(f"↷ {dst.name} 이미 있음 — 건너뜀")
        return
    body = {
        "model": "gpt-image-1",
        "prompt": PROMPT,
        "size": "1024x1536",  # 세로 = 모바일 무대 비율
        "quality": "high",
        "output_format": "jpeg",
        "n": 1,
    }
    for attempt in range(3):
        r = requests.post(API, headers=AUTH, json=body, timeout=900)
        if r.status_code == 200:
            dst.write_bytes(base64.b64decode(r.json()["data"][0]["b64_json"]))
            print(f"✅ {dst.name} ({dst.stat().st_size // 1024}KB)")
            return
        print(f"⚠ 실패 {r.status_code} (시도 {attempt + 1}/3)")
        time.sleep(8 * (attempt + 1))
    sys.exit("::error::연식당 배경 생성 3회 실패")


if __name__ == "__main__":
    main()
