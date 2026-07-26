# 60갑자 지신 스티커 생성 레일 (Q.40 · 운영자 260726 지시)
#
# 운영자 원문: "지피티로 15개씩 4번 짜내서 15개로 15칸 나눠서 최대한 고화질로 … 귀여운 캐릭터로
# … 4분할해서 얼굴 정중앙 위치 모두 일치하게"
#
# ◆ 왜 15 × 4인가 — 60갑자 = 12동물 × 5오행이다. 한 장(시트)에 **3동물 × 5오행 = 15칸**을 담고
#   4장이면 12동물이 정확히 덮인다. 열 = 오행(색), 행 = 동물 → **한 열은 색이 하나**라 시트 안에서
#   색이 흔들릴 여지가 줄고, 같은 시트 안 15마리는 같은 붓질로 나와 화풍이 붙는다.
#
# ◆ 자르기 = 사람 눈이 아니라 기하로. 시트를 5×3 균등 격자로 자른 뒤 각 칸을 **알파 바운딩박스로
#   트림 → 정사각 캔버스 중앙에 같은 비율로 재배치**한다. 그래서 60장 전부 피사체 중심이 캔버스
#   정중앙에 오고 크기도 같다(운영자 "정중앙 위치 모두 일치").
#
# ◆ 프롬프트 정본 = `app/public/playground/gapja-generator.html`의 buildPrompt() 문구를 계승한다
#   (거기가 이 축의 플레이그라운드 = B3 산출물). 새 아트 지시를 창작하지 않는다.
# ◆ 색 정본 = `app/src/theme.ts`의 tokens.ohaeng (목 #8FBBA1 · 화 #E98D8D · 토 #F1CE8C ·
#   금 #DBDCE0 · 수 #8FB0CC). 이 파일에 하드코딩된 hex가 정본과 어긋나면 즉시 중단한다.
# ◆ 멱등: 이미 있는 PNG는 건너뛴다(재실행 비용 0). 시트 원본도 남겨 재자르기가 가능하다.
#
# 시크릿은 러너 안에서만 산다 — 로그·파일에 절대 찍지 않는다(260712 보안 철칙).
import base64
import io
import os
import pathlib
import re
import sys
import time

import requests
from PIL import Image

KEY = "".join(os.environ["OPENAI_API_KEY"].split())
AUTH = {"Authorization": f"Bearer {KEY}"}
API = "https://api.openai.com/v1/images/generations"

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "app/public/assets/gapja"
SHEETS = ROOT / "app/public/reports/gapja-sheets"
OUT.mkdir(parents=True, exist_ok=True)
SHEETS.mkdir(parents=True, exist_ok=True)

# 시트 = 가로 5칸(오행) × 세로 3칸(동물). 1536x1024 = 지원 사이즈 중 5:3에 가장 가까운 가로형.
COLS, ROWS = 5, 3
SIZE = "1536x1024"
QUALITY = "high"
CELL = 512  # 최종 스티커 한 장(정사각). 앱은 46~96px로 쓰므로 5배 이상 = 고DPI 여유
FILL = 0.82  # 캔버스 대비 피사체 높이 비율 — 60장 공통(크기 일치)

ELEMENTS = [
    ("목", "wood", "#8FBBA1", "sage green"),
    ("화", "fire", "#E98D8D", "coral red"),
    ("토", "earth", "#F1CE8C", "golden yellow"),
    ("금", "metal", "#DBDCE0", "silver gray"),
    ("수", "water", "#8FB0CC", "slate blue"),
]
ANIMALS = [
    ("쥐", "rat", "a glowing seed"),
    ("소", "ox", "a small brass bell"),
    ("범", "tiger", "a bamboo stalk"),
    ("토끼", "rabbit", "a four-leaf clover"),
    ("용", "dragon", "a glowing wish orb"),
    ("뱀", "snake", "soft sparkles"),
    ("말", "horse", "a flowing ribbon"),
    ("양", "goat", "a paintbrush"),
    ("원숭이", "monkey", "a peach"),
    ("닭", "rooster", "a pocket watch"),
    ("개", "dog", "a glowing lantern"),
    ("돼지", "pig", "a lucky pouch"),
]


def assert_palette_matches_theme() -> None:
    """색 정본(theme.ts)과 이 파일의 hex가 어긋나면 생성 자체를 막는다 — 60장 다시 뽑는 건 비싸다."""
    src = (ROOT / "app/src/theme.ts").read_text(encoding="utf-8")
    for ko, _en, hexv, _name in ELEMENTS:
        m = re.search(rf"{ko}:\s*\{{[^}}]*bg:\s*'(#[0-9A-Fa-f]{{6}})'", src)
        if not m:
            sys.exit(f"::error::theme.ts에서 오행 '{ko}' bg를 못 찾음 — 정본 구조가 바뀌었다")
        if m.group(1).upper() != hexv.upper():
            sys.exit(f"::error::팔레트 이탈 — {ko}: 정본 {m.group(1)} vs 스크립트 {hexv}")


def sheet_prompt(trio: list) -> str:
    """시트 1장 프롬프트 — 칸 규격을 먼저 못 박고, 그다음 15마리를 좌표로 지시한다."""
    rows = []
    for r, (ko, en, item) in enumerate(trio, start=1):
        cells = ", ".join(
            f"column {c} = a baby {en} colored in soft {name} {hexv} ({een} element), holding {item}"
            for c, (_k, een, hexv, name) in enumerate(ELEMENTS, start=1)
        )
        rows.append(f"Row {r} (all five are the same {en}): {cells}.")
    grid = " ".join(rows)
    return (
        f"A single flat sheet containing exactly {COLS * ROWS} separate die-cut kawaii mascot stickers "
        f"arranged in a strict, perfectly even {COLS}-column by {ROWS}-row grid on a fully transparent background. "
        "Treat the image as a rigid grid: every cell is the same size, the gutters between cells are equal, "
        "and each mascot is drawn fully inside its own cell, front-facing, standing upright, with its HEAD "
        "CENTERED horizontally in the cell and the same head size and same eye-line height in every single cell. "
        "Mascots must never touch, overlap or cross a cell boundary. "
        "Art style: cute Korean die-cut sticker illustration, thin dark-charcoal outline, soft flat pastel colors, "
        "chibi big-head proportions, huge glossy sparkly eyes with two white highlights, tiny happy smile, "
        "uniform frontal lighting, no drop shadows on the background, high resolution, crisp clean edges. "
        f"{grid} "
        "The five columns must keep their assigned colors consistent down the whole column. "
        "No text, no letters, no numbers, no labels, no watermark, no background scenery, no frames or borders "
        "around the grid, no color swatches."
    )


def generate_sheet(idx: int, trio: list) -> Image.Image:
    dst = SHEETS / f"sheet{idx}.png"
    if dst.exists():
        print(f"  ↷ 시트 {idx} 이미 있음 — 생성 건너뜀")
        return Image.open(dst).convert("RGBA")
    body = {
        "model": "gpt-image-1",
        "prompt": sheet_prompt(trio),
        "size": SIZE,
        "quality": QUALITY,
        "background": "transparent",
        "output_format": "png",
        "n": 1,
    }
    for attempt in range(3):
        r = requests.post(API, headers=AUTH, json=body, timeout=900)
        if r.status_code == 200:
            raw = base64.b64decode(r.json()["data"][0]["b64_json"])
            dst.write_bytes(raw)
            print(f"  ✅ 시트 {idx} 생성 ({len(raw) // 1024}KB)")
            return Image.open(io.BytesIO(raw)).convert("RGBA")
        print(f"  ⚠ 시트 {idx} 실패 {r.status_code} (시도 {attempt + 1}/3)")
        time.sleep(8 * (attempt + 1))
    sys.exit(f"::error::시트 {idx} 생성 3회 실패")


def cut(cell_img: Image.Image) -> Image.Image:
    """알파 트림 → 정사각 캔버스 중앙 배치. 60장의 피사체 중심·크기를 한 값으로 맞춘다."""
    bbox = cell_img.getbbox()
    if not bbox:
        return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    sub = cell_img.crop(bbox)
    scale = (CELL * FILL) / max(sub.width, sub.height)
    sub = sub.resize((max(1, round(sub.width * scale)), max(1, round(sub.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    canvas.paste(sub, ((CELL - sub.width) // 2, (CELL - sub.height) // 2), sub)
    return canvas


def main() -> None:
    assert_palette_matches_theme()
    made, skipped = 0, 0
    for idx in range(4):
        trio = ANIMALS[idx * ROWS : (idx + 1) * ROWS]
        wanted = [(a, e) for a in trio for e in ELEMENTS]
        if all((OUT / f"{a[1]}-{e[1]}.png").exists() for a, e in wanted):
            print(f"시트 {idx + 1}: 15장 전부 존재 — 통째로 건너뜀")
            skipped += 15
            continue
        print(f"시트 {idx + 1}/4 — {', '.join(a[0] for a in trio)}")
        sheet = generate_sheet(idx + 1, trio)
        cw, ch = sheet.width / COLS, sheet.height / ROWS
        for r, (ko, en, _item) in enumerate(trio):
            for c, (_k, een, _hex, _name) in enumerate(ELEMENTS):
                box = (round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch))
                dst = OUT / f"{en}-{een}.png"
                if dst.exists():
                    skipped += 1
                    continue
                cut(sheet.crop(box)).save(dst)
                made += 1
                print(f"    · {dst.name}")
    print(f"완료 — 신규 {made}장 · 기존 {skipped}장 · 총 {len(list(OUT.glob('*.png')))}/60")


if __name__ == "__main__":
    main()
