# 셰프단 — 상담 상대 성별로 갈리는 도사 2인 v1 (Q.40 · 운영자 260726 구술 + 레퍼런스 4컷 첨부)
#
# ⚠⚠ **아직 실행하지 마라** — 운영자 260726 지시 "안뽑았으면 일단 뽑지말구". 이 파일은 **레퍼런스
#     박제 + 프롬프트 초안**까지다. 생성은 별도 GO 뒤 Actions `gen-gapja-stickers`의 입력으로만.
#
# ◆ 체제 변경(260721 셰프단 결정 로그의 확장) — **사용자 성별로 상담 도사가 갈린다**.
#     · 남성 사용자 상대 = `noona` 백발 기센 언니 도사
#     · 여성 사용자 상대 = `doryeong` 갓 쓴 흑발 도령 도사  ← 운영자 "메인이 1번"
#   기존 v3~v5 남신(밤 수채)과는 **다른 그림 축**이다. 운영자: "수채화 풍 말고, 제대로 미연시풍으로".
#
# ◆ 미해결 1건 — 운영자가 먼저 말한 "도사 **할머니**"와 첨부 레퍼런스(20~30대 백발)가 어긋난다.
#   백발이 공통 축이라 같은 캐릭터의 다른 연출일 수도 있다. **연령 확정 전 생성 금지.**
#
# ◆ 레퍼런스에서 계승하지 않는 것(명시) — 담배(첨부 1쌍) · 노출된 상반신/맨가슴(첨부 2쌍).
#   앱 스토어 심사·연령 이용층 축이라 의상은 여미고, 손엔 담배 대신 옥가락지·찻잔·부채를 준다.
#   운영자가 그대로 가자고 하면 그때 되살린다(임의 판단으로 뺀 게 아니라 사유를 적어 남긴다).
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
SIZE = "1024x1536"  # 세로 = 미연시 스탠딩(남신 v3~v5 규격 계승)
QUALITY = "high"

# 두 페르소나가 공유하는 그림 문법 — 첨부 4컷 실측의 교집합.
COMMON = (
    "아트 스타일: 일본 비주얼노벨(미연시)의 캐릭터 스탠딩 CG / 웹툰 채색. 또렷하고 깔끔한 라인아트에 "
    "평평한 셀 채색, 하이라이트는 피부와 머리칼에만 절제해서 넣는다. 수채화·유화·페인터리 질감 금지, "
    "거친 붓자국 금지, 실사 금지. 인물은 화면 중앙에 상반신(바스트업)으로 크게, 정면에 가깝게. "
    "표정은 한쪽 입꼬리를 올린 서늘하고 여유로운 미소, 눈은 반쯤 감아 나른하면서 상대를 꿰뚫어 본다. "
    "고해상도, 깔끔한 마감. 화면에 글자·한자·로고·워터마크·프레임 테두리를 넣지 말 것. 손가락 개수 정확히."
)

PERSONAS = {
    # 남성 사용자 상담용 — 첨부 1쌍(백발·검정 민소매·딥그린 단색 배경)
    "noona": {
        "dir": "app/public/reports/chef-noona-v1",
        "who": (
            "인물: 사주를 봐 주는 여성 도사, '기센 큰언니' 카리스마. 백발(은백색) 머리를 옆으로 길게 "
            "땋아 내렸고 앞머리는 자연스럽게 흐트러져 있다. 눈은 호박(앰버)색, 눈꼬리에 붉은 아이섀도, "
            "진한 레드 립, 검정 매니큐어. 등을 곧게 세우고 턱을 살짝 든 자세."
        ),
        "wear": (
            "의상: 목까지 올라오는 검정 민소매 하이넥 니트, 가는 금 체인에 옥빛 보석 펜던트, 굵은 가죽 벨트. "
            "가슴·배 노출 없이 단정하게 여민다. 배경: 소품도 원근도 없는 **단색 딥 그린 평면**."
        ),
        "cuts": [
            ("cut1_main", "포즈: 한 손을 얼굴 옆으로 들어 옥가락지를 매만지며 정면을 응시하는 대표 컷(담배 없음)."),
            ("cut2_read", "포즈: 만세력 책을 한 손으로 짚고 고개를 살짝 기울여 상대를 꿰뚫어 보는 순간. 눈매가 좁혀져 있다."),
            ("cut3_smirk", "포즈: 찻잔을 들어 올리며 '그럴 줄 알았지'라는 도발적인 미소."),
        ],
    },
    # 여성 사용자 상담용 — 첨부 2쌍. 운영자 "메인이 1번" = 앉은 자세·푸른 조명 컷이 대표.
    "doryeong": {
        "dir": "app/public/reports/chef-doryeong-v1",
        "who": (
            "인물: 사주를 봐 주는 남성 도사, 20대 후반의 서늘한 미남. 검은 흑발에 챙이 넓은 **검정 갓**을 "
            "썼고 갓끈 구슬 장식이 뺨 옆으로 늘어진다. 눈은 형광 호박(앰버)색으로 은은히 빛나고, 창백한 "
            "피부에는 옅은 보랏빛 문양이 실금처럼 번져 있다(이 세상 사람 같지 않은 기운). 검정 매니큐어."
        ),
        "wear": (
            "의상: 검정 도포·개량 한복, 소매와 옷깃에 금빛 자수 한 줄, 허리끈에 금속 노리개와 술 장식. "
            "옷깃은 **가슴이 드러나지 않게 여며 입는다**(맨몸 노출 없음). "
            "배경: 밤빛 푸른 실내를 얕은 피사계 심도로 흐리게 — 인물보다 확실히 뒤로 물러난다."
        ),
        "cuts": [
            ("cut1_main", "포즈: 상담 의자에 비스듬히 기대앉아 한 손을 얼굴 옆으로 들고 정면을 보며 웃는 대표 컷."),
            ("cut2_read", "포즈: 만세력을 무릎에 펼쳐 두고 고개를 들어 상대를 응시하는 순간."),
            ("cut3_smirk", "포즈: 손끝으로 갓끈을 튕기며 한쪽 입꼬리를 올린 장난기 어린 미소."),
        ],
    },
}


def gen(out: pathlib.Path, name: str, prompt: str) -> None:
    dst = out / f"{name}.png"
    if dst.exists():
        print(f"  ↷ {dst.name} 이미 있음 — 건너뜀")
        return
    body = {"model": "gpt-image-1", "prompt": prompt, "size": SIZE, "quality": QUALITY, "n": 1}
    for attempt in range(3):
        r = requests.post(API, headers=AUTH, json=body, timeout=900)
        if r.status_code == 200:
            dst.write_bytes(base64.b64decode(r.json()["data"][0]["b64_json"]))
            print(f"  ✅ {dst.name} ({dst.stat().st_size // 1024}KB)")
            return
        print(f"  ⚠ {dst.name} 실패 {r.status_code} (시도 {attempt + 1}/3)")
        time.sleep(8 * (attempt + 1))
    sys.exit(f"::error::{dst.name} 생성 3회 실패")


def main() -> None:
    # CHEFS = noona|doryeong|both (기본 both) · CUTS_ALL=1이면 3컷, 아니면 대표 1컷만(컷당 과금)
    want = os.environ.get("CHEFS", "both")
    keys = list(PERSONAS) if want == "both" else [want]
    for k in keys:
        p = PERSONAS[k]
        out = ROOT / p["dir"]
        out.mkdir(parents=True, exist_ok=True)
        cuts = p["cuts"] if os.environ.get("CUTS_ALL") == "1" else p["cuts"][:1]
        print(f"▶ {k} — {len(cuts)}컷")
        for name, pose in cuts:
            gen(out, name, f"{COMMON} {p['who']} {p['wear']} {pose}")
        print(f"  → {out} 에 {len(list(out.glob('*.png')))}컷")


if __name__ == "__main__":
    main()
