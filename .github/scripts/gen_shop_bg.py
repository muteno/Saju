# 연식당 무대 배경 (Q.42 · 운영자 260726 "연식당 저 배경부터 새로 만들어서 하나 깔아줘")
#
# ◆ 무드 정본(운영자 구술) — "너무 모던하게보다는 적당히 모던한데 글래스모피즘 … 일본식 벚꽃
#   휘날리는 풍경 … 사쿠라 느낌 지방 목재 건물에 앉아서 점을 보러 사주방에 왔지만 고풍과 품위".
# ◆ **인물 없음 · 글자 없음**이 이 배경의 핵심 계약이다. 위에 글래스 카드와 캐릭터가 얹히므로
#   배경이 주인공이면 안 된다 — 중앙~우측은 비워 두고(캐릭터 자리), 대비는 낮게 간다.
# ◆ 260726 사고 교훈 이식 — **아트 스타일을 글로 지정하지 않는다.**
#   여기엔 일관시킬 얼굴은 없지만 **일관시킬 화풍은 있다**(캐릭터 스탠딩이 이 위에 선다).
#   글로 스타일을 적으면 캐릭터 그림과 붕 뜬 배경이 나온다 — 그래서 `chef-refs/`의 캐릭터 그림을
#   **색·질감 견본으로 첨부**해 /v1/images/edits로 간다. 1차 런의 배경 시트(chef-*-bg-v1)가
#   같은 방식으로 성공했다(격자·화풍 준수).
# ◆ 멱등: 이미 있으면 건너뛴다(재실행 과금 0).
#
# 시크릿은 러너 안에서만 산다 — 로그·파일에 절대 찍지 않는다(260712 보안 철칙).
import base64
import io
import os
import pathlib
import sys
import time

import requests
from PIL import Image

KEY = "".join(os.environ["OPENAI_API_KEY"].split())
AUTH = {"Authorization": f"Bearer {KEY}"}
API = "https://api.openai.com/v1/images/edits"

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "app/public/assets"
OUT.mkdir(parents=True, exist_ok=True)
REFS = ROOT / "app/public/reports/chef-refs"

# 화풍 견본으로 쓸 캐릭터 그림(기본 = 메인 캐릭터). REF 환경변수로 바꿀 수 있다.
REF_ID = os.environ.get("REF", "doryeong")
MODEL = os.environ.get("MODEL", "gpt-image-1")

PROMPT = (
    "오래된 목조 가옥의 안마당을 그린 배경. 사람은 한 명도 없다. "
    "벚나무가 만개해 연분홍 꽃잎이 흩날리고, 마당 한쪽에는 돌로 두른 오래된 우물이 있다. "
    "격자 미닫이문과 툇마루가 있는 목조 가옥이 왼쪽에 서 있고, 낮은 돌담과 이끼 낀 디딤돌이 이어진다. "
    "식당·간판·상점 요소는 넣지 마라 — 가게가 아니라 오래된 집이다. "
    "전체를 관통하는 정서는 음양의 조화다: 밝음과 그늘, 흰빛과 먹빛, 물과 돌이 한 화면에서 짝을 이룬다. "
    "첨부한 그림은 색과 질감의 견본이다 — 그 그림을 그린 사람이 이 배경도 그린 것처럼 보이게 하고, "
    "첨부 그림 속 인물이나 소품은 옮겨 오지 마라. "
    "화면의 중앙과 오른쪽은 의도적으로 비워 둔다(그 자리에 인물과 카드가 얹힌다). "
    "채도와 대비는 낮게 가라앉혀 위에 얹힐 흰 유리 카드와 글자가 잘 읽히게 한다. "
    "고풍스럽고 품위 있는 분위기. 화면에 글자·간판·로고·워터마크·테두리를 넣지 말 것."
)


def ref_bytes() -> bytes:
    cands = sorted(
        q for q in REFS.glob(f"{REF_ID}.*") if q.suffix.lower() in (".png", ".jpg", ".jpeg", ".jfif", ".webp")
    )
    if not cands:
        sys.exit(f"::error::화풍 견본 없음 — app/public/reports/chef-refs/{REF_ID}.* 를 먼저 올려라")
    buf = io.BytesIO()
    Image.open(cands[0]).convert("RGB").save(buf, format="PNG")
    return buf.getvalue()


def main() -> None:
    dst = OUT / "shop-bg.jpg"
    if dst.exists():
        print(f"↷ {dst.name} 이미 있음 — 건너뜀")
        return
    payload = ref_bytes()
    data = {
        "model": MODEL,
        "prompt": PROMPT,
        "size": "1024x1536",  # 세로 = 모바일 무대 비율
        "quality": "high",
        "n": "1",
    }
    for attempt in range(3):
        files = {"image": (f"{REF_ID}.png", io.BytesIO(payload), "image/png")}
        r = requests.post(API, headers=AUTH, data=data, files=files, timeout=900)
        if r.status_code == 200:
            raw = base64.b64decode(r.json()["data"][0]["b64_json"])
            Image.open(io.BytesIO(raw)).convert("RGB").save(dst, quality=90)
            print(f"✅ {dst.name} ({dst.stat().st_size // 1024}KB · 화풍 견본={REF_ID})")
            return
        print(f"⚠ 실패 {r.status_code} (시도 {attempt + 1}/3)")
        time.sleep(8 * (attempt + 1))
    sys.exit("::error::연식당 배경 생성 3회 실패")


if __name__ == "__main__":
    main()
