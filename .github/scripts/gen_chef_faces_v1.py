# 셰프 표정 시트 — 캐릭터당 60표정 (Q.40 · 운영자 260726 "한 화면에 15개 … 60개 표정이면될듯")
#
# ◆ 구조 = 시트 1장 = **5열 × 3행 = 15표정**, 캐릭터당 4장 → **60표정**. 2인이면 시트 8장.
# ◆ 운영자 "각각임 각각을 첨부해서" = 각 캐릭터의 **레퍼런스 이미지를 실제로 첨부**해 생성한다
#   → `/v1/images/edits`(gpt-image-1)로 원본 캐릭터를 물려주고 표정만 갈아 끼운다.
#   레퍼런스 없이 텍스트만 쓰면 시트마다 다른 사람이 나온다(v4 남신에서 겪은 드리프트).
# ◆ 자르기 = 기하 격자(5×3 균등) → 알파/여백 트림 없이 **정사각 중앙 크롭**. 표정 컷은 얼굴 위치가
#   흔들리면 대사창 위에서 캐릭터가 덜컹거린다 — 그래서 프롬프트로 "모든 칸의 눈높이·머리 크기 동일"을
#   못 박고, 자를 때도 트림을 하지 않는다(트림하면 칸마다 스케일이 달라진다).
# ◆ 멱등: 이미 있는 시트·컷은 건너뛴다(재실행 과금 0).
#
# ⚠ 선행 조건 = 레퍼런스 PNG 2장이 `app/public/reports/chef-refs/{id}.png`에 있어야 한다.
#   운영자가 채팅에 첨부한 이미지는 세션 디스크에 안 남아서, 레포에 올려야 이 레일이 돈다.
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
REFS = ROOT / "app/public/reports/chef-refs"

COLS, ROWS = 5, 3
SIZE = "1536x1024"
QUALITY = "high"
CELL = 512

CHEFS = {
    # 남성 사용자 상대 — 은백발 기센 언니
    "noona": "은백색 땋은 머리에 호박색 눈, 붉은 눈꼬리 화장과 진한 레드 립, 검정 민소매 하이넥을 입은 여성 도사",
    # 여성 사용자 상대 — 갓 쓴 흑발 도령(운영자 "메인이 1번")
    "doryeong": "챙 넓은 검정 갓을 쓰고 흑발에 형광 호박색 눈, 창백한 피부에 옅은 보랏빛 실금 문양이 있는 검정 도포 차림의 남성 도사",
    # 3인째 — 백발 동자승(운영자 260726 첨부)
    "dongja": "새하얀 단발머리에 큰 눈, 흰 도복과 회색 하카마를 입고 흰 뱀을 곁에 둔 어린 동자승",
}

# 상황 시트(전신·배경 포함) — 운영자 260726: "배경이나 관련된 전신 모습도 하나뽑을때 16개 또는 20개
# 뽑아서 잘라서 쓰는거로". 표정 시트가 얼굴이라면 이쪽은 **장면 카드**다(대사창 위에 깔리는 그림).
POSE_COLS, POSE_ROWS = 4, 4  # 16칸(=SHEET_20=1이면 5×4=20칸)
POSES = [
    "상담석에 앉아 손님을 맞이함", "만세력을 펼쳐 짚어 봄", "붓으로 무언가를 적음", "찻잔을 내밂",
    "일어서서 창밖을 봄", "팔짱을 끼고 내려다봄", "손끝으로 허공에 괘를 그림", "고개를 숙여 인사",
    "등을 보이고 돌아섬", "문 앞에서 손짓해 부름", "촛불 곁에서 밤늦게 혼자", "벚꽃잎이 흩날리는 마당",
    "비 오는 처마 밑", "눈 내리는 밤의 툇마루", "손님을 배웅하는 뒷모습", "책장 앞에서 책을 꺼냄",
    "마루에 걸터앉아 쉼", "차를 우리는 중", "먼 산을 바라봄", "등불을 들고 걸음",
]

# 60표정 = 15 × 4시트. 대사 상황에서 실제로 쓰일 것만 — 중복 뉘앙스는 뺐다.
EXPRESSIONS = [
    # 시트 1 — 기본 응대
    "무표정하게 정면을 응시", "옅게 미소", "환하게 웃음", "한쪽 입꼬리만 올린 서늘한 미소", "눈을 감고 조용히 웃음",
    "고개를 살짝 끄덕이며 수긍", "눈썹을 들며 흥미로워함", "고개를 갸웃하며 의아해함", "눈을 크게 뜨고 놀람", "입을 살짝 벌리고 감탄",
    "윙크", "혀를 살짝 내밀며 장난", "능청스럽게 시치미", "어깨를 으쓱", "눈을 반쯤 감고 나른함",
    # 시트 2 — 상담 진행
    "진지하게 집중", "눈을 좁히며 꿰뚫어 봄", "턱을 짚고 골똘히 생각", "확신에 차서 단호함", "가르치듯 차분히 설명",
    "걱정스럽게 바라봄", "연민 어린 눈빛", "안도하며 숨을 내쉼", "다행이라는 듯 미소", "격려하듯 따뜻하게",
    "경고하듯 눈매를 굳힘", "안 된다는 듯 고개를 저음", "실망해서 한숨", "어이없다는 표정", "냉소",
    # 시트 3 — 감정 진폭
    "조용히 화남", "정면으로 화를 냄", "째려봄", "삐친 듯 입을 삐죽", "토라져 고개를 돌림",
    "당황해서 굳음", "쑥스러워 시선을 피함", "얼굴을 붉히며 부끄러워함", "울컥해 눈가가 붉어짐", "슬픔을 참는 표정",
    "지루해서 하품", "졸린 눈", "피곤해 눈을 비빔", "짜증스럽게 미간을 찌푸림", "질렸다는 표정",
    # 시트 4 — 연출용
    "크게 소리 내어 웃음", "손으로 입을 가리고 웃음", "의미심장하게 웃음", "도발적으로 눈을 맞춤", "유혹하듯 눈을 내리깔음",
    "자신만만하게 턱을 듦", "겸손하게 눈을 내림", "생각에 잠겨 먼 곳을 봄", "회상하듯 아련한 표정", "결심한 듯 눈을 뜸",
    "축하하듯 밝게", "위로하듯 부드럽게", "놀리듯 눈웃음", "못 말린다는 듯 쓴웃음", "작별 인사하듯 담담하게",
]
assert len(EXPRESSIONS) == COLS * ROWS * 4, f"표정 수 {len(EXPRESSIONS)} ≠ 60"


def sheet_prompt(who: str, exprs: list[str]) -> str:
    cells = " ".join(f"{i}번 칸: {e}." for i, e in enumerate(exprs, start=1))
    return (
        f"첨부한 이미지의 캐릭터({who})와 **완전히 같은 인물·같은 머리·같은 의상·같은 화풍**으로, "
        f"표정만 다른 얼굴 컷 {COLS * ROWS}개를 한 장에 담은 표정 시트를 그려라. "
        f"배치는 가로 {COLS}칸 × 세로 {ROWS}칸의 **정확히 균등한 격자**다. 모든 칸에서 얼굴 크기와 눈높이가 "
        "완전히 같고, 머리는 각 칸의 정중앙에 온다. 칸은 어깨 위 얼굴 클로즈업이며 서로 겹치거나 칸 경계를 "
        "넘지 않는다. 배경은 원본과 같은 단색으로 칸마다 동일하게. "
        "화풍은 원본 그대로 — 또렷한 라인아트 + 평평한 셀 채색, 수채·유화 질감 금지, 실사 금지. "
        f"칸은 왼쪽 위에서 오른쪽으로 세는 순서다. {cells} "
        "화면에 글자·번호·격자선·프레임·워터마크를 그리지 말 것."
    )


def gen_sheet(chef: str, idx: int, out: pathlib.Path, prompt: str, stem: str) -> Image.Image:
    dst = out / f"{stem}.png"
    if dst.exists():
        print(f"  ↷ {chef} 시트 {idx} 이미 있음")
        return Image.open(dst).convert("RGBA")
    ref = REFS / f"{chef}.png"
    if not ref.exists():
        sys.exit(f"::error::레퍼런스 없음 — {ref.relative_to(ROOT)} 를 먼저 올려라(운영자 첨부본)")
    data = {"model": "gpt-image-1", "prompt": prompt, "size": SIZE, "quality": QUALITY, "n": "1"}
    for attempt in range(3):
        with ref.open("rb") as fh:
            r = requests.post(API, headers=AUTH, data=data, files={"image": (ref.name, fh, "image/png")}, timeout=900)
        if r.status_code == 200:
            raw = base64.b64decode(r.json()["data"][0]["b64_json"])
            dst.write_bytes(raw)
            print(f"  ✅ {chef} 시트 {idx} ({len(raw) // 1024}KB)")
            return Image.open(io.BytesIO(raw)).convert("RGBA")
        print(f"  ⚠ {chef} 시트 {idx} 실패 {r.status_code} (시도 {attempt + 1}/3)")
        time.sleep(8 * (attempt + 1))
    sys.exit(f"::error::{chef} 시트 {idx} 생성 3회 실패")


def cut(cell: Image.Image) -> Image.Image:
    """정사각 중앙 크롭 후 CELL로 리사이즈 — 트림 없음(칸마다 스케일이 달라지면 대사창에서 덜컹거린다)."""
    side = min(cell.width, cell.height)
    left, top = (cell.width - side) // 2, (cell.height - side) // 2
    return cell.crop((left, top, left + side, top + side)).resize((CELL, CELL), Image.LANCZOS)


def pose_prompt(who: str, poses: list[str], cols: int, rows: int) -> str:
    cells = " ".join(f"{i}번 칸: {p}." for i, p in enumerate(poses, start=1))
    return (
        f"첨부한 이미지의 캐릭터({who})와 **완전히 같은 인물·같은 의상·같은 화풍**으로, 서로 다른 장면 "
        f"{cols * rows}개를 한 장에 담은 장면 시트를 그려라. 배치는 가로 {cols}칸 × 세로 {rows}칸의 "
        "**정확히 균등한 격자**이고, 각 칸은 배경이 있는 전신 또는 무릎 위 장면이다. "
        "칸마다 인물 크기가 비슷하고 인물은 칸 중앙에 온다. 칸끼리 겹치거나 경계를 넘지 않는다. "
        "화풍은 원본 그대로 — 또렷한 라인아트 + 평평한 셀 채색. 배경은 한국·일본풍 목조 실내와 마당, "
        f"계절감(벚꽃·비·눈)을 살리되 인물보다 뒤로 물러난다. 칸은 왼쪽 위부터 오른쪽으로 센다. {cells} "
        "화면에 글자·번호·격자선·프레임·워터마크를 그리지 말 것."
    )


def main() -> None:
    want = os.environ.get("CHEFS", "all")
    keys = list(CHEFS) if want in ("all", "both") else [want]
    mode = os.environ.get("MODE", "faces")  # faces = 표정 15×N · poses = 장면 16 또는 20
    if mode == "poses":
        cols, rows = (5, 4) if os.environ.get("SHEET_20") == "1" else (POSE_COLS, POSE_ROWS)
        for chef in keys:
            out = ROOT / f"app/public/reports/chef-{chef}-poses-v1"
            out.mkdir(parents=True, exist_ok=True)
            n = cols * rows
            poses = POSES[:n]
            print(f"▶ {chef} 장면 시트 — {n}칸({cols}×{rows})")
            sheet = gen_sheet(chef, 1, out, pose_prompt(CHEFS[chef], poses, cols, rows), "pose-sheet1")
            cw, ch = sheet.width / cols, sheet.height / rows
            for i in range(n):
                r, c = divmod(i, cols)
                dst = out / f"{i + 1:02d}.png"
                if dst.exists():
                    continue
                sheet.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch))).save(dst)
            (out / "INDEX.md").write_text(
                "# 장면 인덱스\n\n" + "\n".join(f"- `{i + 1:02d}.png` — {p}" for i, p in enumerate(poses)) + "\n", encoding="utf-8"
            )
            print(f"  → {out} 에 {len(list(out.glob('*.png')))}컷")
        return

    sheets = int(os.environ.get("SHEETS", "4"))  # 1~4 (표정 15 × N)
    for chef in keys:
        out = ROOT / f"app/public/reports/chef-{chef}-faces-v1"
        out.mkdir(parents=True, exist_ok=True)
        print(f"▶ {chef} 표정 시트 — {sheets}장({sheets * 15}표정)")
        for s in range(sheets):
            exprs = EXPRESSIONS[s * 15 : (s + 1) * 15]
            if all((out / f"{s * 15 + i + 1:02d}.png").exists() for i in range(15)):
                print(f"  ↷ 시트 {s + 1} 15컷 전부 존재 — 건너뜀")
                continue
            sheet = gen_sheet(chef, s + 1, out, sheet_prompt(CHEFS[chef], exprs), f"sheet{s + 1}")
            cw, ch = sheet.width / COLS, sheet.height / ROWS
            for i in range(15):
                r, c = divmod(i, COLS)
                dst = out / f"{s * 15 + i + 1:02d}.png"
                if dst.exists():
                    continue
                cut(sheet.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))).save(dst)
            print(f"    · {s * 15 + 1:02d}~{s * 15 + 15:02d}.png 저장")
        (out / "INDEX.md").write_text(
            "# 표정 인덱스\n\n" + "\n".join(f"- `{i + 1:02d}.png` — {e}" for i, e in enumerate(EXPRESSIONS[: sheets * 15])) + "\n",
            encoding="utf-8",
        )
        print(f"  → {out} 에 {len(list(out.glob('*.png')))}컷")


if __name__ == "__main__":
    main()
