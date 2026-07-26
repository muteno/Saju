# 셰프 표정·장면·배경 시트 — 레퍼런스 첨부 생성 레일 (Q.40/Q.41)
#
# ══ 260726 1차 런 사고와 그 교훈 ══════════════════════════════════════════════
# 1차 런(28요청 ≈ $7.00)의 결과물이 **원본과 다른 그림**으로 나왔다. 원인 두 가지:
#
#  ⓐ 프롬프트에 아트 스타일 문장("또렷한 라인아트 + 평평한 셀 채색", "수채·유화 질감 금지")을
#     적어 넣었다. gpt-image-1은 첨부 이미지보다 **글로 쓴 지시**를 따른다 —
#     원본의 부드러운 회화 채색이 굵은 아웃라인 셀화로 전부 갈아엎혔다.
#     실측(원본 얼굴 vs 생성 칸): 선 강도 +117~177% · 굵은 선 비율 +6~12%p ·
#     상위 8톤 점유 +21~46%p(그라데이션 → 계단식 평면) · 색 수 최대 −44%.
#     → **이 파일 어디에도 아트 스타일을 지정하는 낱말을 쓰지 마라.**
#        화풍의 유일한 출처는 첨부 이미지다. 스타일 축('선 굵기'·'채색 방식'·'붓질')을
#        "바꾸지 마라"고 열거하는 것도 금지 — 모델에게 그 축을 의식시키는 순간 손을 댄다.
#
#  ⓑ `input_fidelity`를 안 걸었다. gpt-image-1의 /v1/images/edits는 마스크가 없으면
#     사실상 **전체 재생성**이라, 이 파라미터 없이는 얼굴이 그대로 남을 이유가 없다.
#     (v4/v5 남신 레일이 fidelity를 뺀 건 '스타일을 바꾸려는' 정반대 목적이었다.)
#     → 이 레일은 무조건 high로 건다.
#
#  ⓒ 격자 칸 수를 모델이 안 지켰다. 1차 런 실측 = **칸이 정사각에 가까울수록 지킨다**:
#       요청 5×3(칸 307×341 = 0.90) → 16시트 중 4시트만 준수(25%)
#       요청 4×4(칸 256×384 = 0.67) →  4시트 중 0시트 준수(0%)
#       요청 2×3(칸 512×512 = 1.00) →  8시트 중 6시트 준수(75%)
#     안 지킨 시트를 5×3으로 잘랐으니 잘린 컷 대부분이 어긋난 조각이었다.
#     → 격자는 **정사각 512×512 6칸(2열×3행 / 1024×1536)** 하나로 통일하고,
#       자르기 전에 실제 이음매를 검출해 **격자가 어긋나면 안 자른다**(_check/로 격리).
# ═════════════════════════════════════════════════════════════════════════════
#
# ◆ 구조 = 시트 1장 = 2열 × 3행 = **6칸**(칸 512×512 네이티브 · 리샘플 없음).
#   표정 60 = 10시트 · 장면 12 = 2시트 · 배경 12 = 2시트.
# ◆ 레퍼런스는 **얼굴 위주로 크롭해서** 첨부한다(README 권장 "인물이 60% 이상인 상반신").
#   원본이 세로로 긴 전신 컷이면 얼굴 화소가 적어 표정 계승이 약해진다.
# ◆ 멱등: 이미 있는 시트·컷은 건너뛴다(재실행 과금 0).
#
# ⚠ 선행 조건 = `app/public/reports/chef-refs/{id}.*`(png/jpg/jfif/webp) 1장.
#   채팅 첨부 이미지는 세션 디스크에 안 남아서, 레포에 올려야 이 레일이 돈다.
#
# 시크릿은 러너 안에서만 산다 — 로그·파일에 절대 찍지 않는다(260712 보안 철칙).
import base64
import io
import os
import pathlib
import sys
import time

import requests
from PIL import Image, ImageChops

KEY = "".join(os.environ["OPENAI_API_KEY"].split())
AUTH = {"Authorization": f"Bearer {KEY}"}
API = "https://api.openai.com/v1/images/edits"

ROOT = pathlib.Path(__file__).resolve().parents[2]
REFS = ROOT / "app/public/reports/chef-refs"

# 모델 — 기본은 gpt-image-1(검증된 경로). `MODEL=gpt-image-2`로 파일럿 전환 가능:
# gpt-image-2는 입력을 항상 고충실도로 처리하므로 input_fidelity를 **보내면 요청이 실패한다**
# → 아래에서 자동으로 뺀다. (출처: developers.openai.com/api/docs/guides/image-generation)
MODEL = os.environ.get("MODEL", "gpt-image-1")
QUALITY = "high"

# 시트 기하 = 전 모드 공통 단일 규격. 정사각 칸이라 모델이 격자를 지키고, 자를 때 리샘플이 없다.
SHEET_SIZE = "1024x1536"
COLS, ROWS = 2, 3
PER = COLS * ROWS  # 6

# 칸 위치를 말로 지목한다 — "1번 칸"처럼 숫자를 쓰면 "글자를 그리지 마라"와 충돌해서
# 모델이 실제로 숫자를 그려 넣는다(1차 런 baekui 시트에 격자선이 찍힌 것과 같은 축).
SLOTS = ["왼쪽 위", "오른쪽 위", "왼쪽 가운데", "오른쪽 가운데", "왼쪽 아래", "오른쪽 아래"]

# 캐릭터 4인(운영자 260726 확정 — 첨부 레퍼런스 7컷 실측)
# ⚠ 이 문자열은 **누가 그 사람인지**만 적는다. 그림에 대한 형용(화풍·질감·톤)은 넣지 마라.
CHEFS = {
    "noona": "은백색 긴 땋은 머리에 호박색 눈, 붉은 눈꼬리 화장과 진한 레드 립, 검정 매니큐어, "
             "검정 민소매 하이넥에 금 체인 펜던트를 한 창백한 여성",
    "baekui": "은백색 머리를 높이 틀어 올리고 잔머리가 흘러내리는, 흰 기모노풍 도복에 검은 오비를 두른 성인 여성",
    "doryeong": "챙 넓은 검정 갓을 쓰고 흑발에 호박색 눈, 창백한 피부에 옅은 보랏빛 실금 문양이 번진 "
                "검정 도포 차림의 남성. 옷깃은 가슴이 드러나지 않게 여며 입는다",
    "dongja": "머리 절반은 새하얗고 절반은 새까만 음양 대비의 어린 동자승. 왼쪽은 흰 도복 오른쪽은 검은 도복인 "
              "흑백 반반 한복을 입었다",
}

# 레퍼런스 얼굴 크롭 박스(원본 비율 좌표 · 세션이 실물 4장을 열어 잰 값).
# 표정 시트는 얼굴이 전부라 전신 컷을 통째로 넘기면 얼굴 화소가 1/6로 줄어든다.
# 크롭 후 정사각으로 펴서 1024로 올려 첨부한다(정사각 = input_fidelity 토큰 가산도 최소).
# ⚠ noona·doryeong은 원본에서 손(과 담배)이 얼굴 옆에 있다 — 그대로 첨부하면 60컷 전부에
#   그 손이 따라 붙는다. 그래서 크롭을 얼굴 쪽으로 밀어 손을 잘라 낸다.
#   (담배는 운영자 260726 "스토어 심사·연령 축" 판단으로 뺀 것 — 되살리려면 noona 박스를 왼쪽으로 넓힌다.)
FACE_CROP = {
    "noona": (0.30, 0.02, 0.98, 0.40),
    "baekui": (0.18, 0.14, 0.84, 0.50),
    "doryeong": (0.20, 0.02, 0.94, 0.42),
    "dongja": (0.22, 0.15, 0.78, 0.58),
}

# 장면(전신) 12컷 = 6칸 × 2시트. 1차 런은 16칸(4×4)을 요청했다가 모델이 3×4로 그려 전량 어긋났다.
POSES = [
    "상담석에 앉아 손님을 맞이함", "만세력을 펼쳐 짚어 봄", "붓으로 무언가를 적음",
    "찻잔을 내밂", "일어서서 창밖을 봄", "팔짱을 끼고 내려다봄",
    "손끝으로 허공에 괘를 그림", "고개를 숙여 인사", "문 앞에서 손짓해 부름",
    "촛불 곁에서 밤늦게 혼자", "마루에 걸터앉아 쉼", "등불을 들고 걸음",
]

# 배경 12장 = 6칸 × 2시트. 1차 런에서 **격자·화풍은 성공**했고 결함은 하나 — 6칸이 서로 거의
# 같은 그림이었다(시간·계절 지시가 묻혔다). 그래서 칸끼리 확연히 다르라는 못이 아래 프롬프트에 있다.
BG_THEMES = [
    "이른 아침, 마당에 옅은 안개와 이슬", "한낮의 볕이 마루에 길게 드는 시간",
    "벚꽃이 만개해 꽃잎이 흩날리는 마당", "비 내리는 처마 밑, 물방울이 떨어지는 툇마루",
    "노을이 격자문을 붉게 물들이는 저녁", "달빛과 등불이 켜진 깊은 밤 마당",
    "첫눈이 소복이 앉은 우물가", "바람에 대나무가 흔들리는 뒷마당",
    "연못에 연꽃이 핀 한여름 마루", "낙엽이 두껍게 쌓인 가을 툇마루",
    "새벽 미명, 아직 불이 꺼지지 않은 방", "장맛비 갠 뒤 무지개가 걸린 하늘",
]

# 60표정 = 6 × 10시트. 대사 상황에서 실제로 쓰일 것만.
EXPRESSIONS = [
    "무표정하게 정면을 응시", "옅게 미소", "환하게 웃음", "한쪽 입꼬리만 올린 미소", "눈을 감고 조용히 웃음", "고개를 살짝 끄덕이며 수긍",
    "눈썹을 들며 흥미로워함", "고개를 갸웃하며 의아해함", "눈을 크게 뜨고 놀람", "입을 살짝 벌리고 감탄", "윙크", "혀를 살짝 내밀며 장난",
    "능청스럽게 시치미", "어깨를 으쓱", "눈을 반쯤 감고 나른함", "진지하게 집중", "눈을 좁히며 꿰뚫어 봄", "턱을 짚고 골똘히 생각",
    "확신에 차서 단호함", "가르치듯 차분히 설명", "걱정스럽게 바라봄", "연민 어린 눈빛", "안도하며 숨을 내쉼", "다행이라는 듯 미소",
    "격려하듯 따뜻하게", "경고하듯 눈매를 굳힘", "안 된다는 듯 고개를 저음", "실망해서 한숨", "어이없다는 표정", "냉소",
    "조용히 화남", "정면으로 화를 냄", "째려봄", "삐친 듯 입을 삐죽", "토라져 고개를 돌림", "당황해서 굳음",
    "쑥스러워 시선을 피함", "얼굴을 붉히며 부끄러워함", "울컥해 눈가가 붉어짐", "슬픔을 참는 표정", "지루해서 하품", "졸린 눈",
    "피곤해 눈을 비빔", "짜증스럽게 미간을 찌푸림", "질렸다는 표정", "크게 소리 내어 웃음", "손으로 입을 가리고 웃음", "의미심장하게 웃음",
    "도발적으로 눈을 맞춤", "유혹하듯 눈을 내리깔음", "자신만만하게 턱을 듦", "겸손하게 눈을 내림", "생각에 잠겨 먼 곳을 봄", "회상하듯 아련한 표정",
    "결심한 듯 눈을 뜸", "축하하듯 밝게", "위로하듯 부드럽게", "놀리듯 눈웃음", "못 말린다는 듯 쓴웃음", "작별 인사하듯 담담하게",
]
assert len(EXPRESSIONS) == 60 and len(EXPRESSIONS) % PER == 0
assert len(POSES) % PER == 0 and len(BG_THEMES) % PER == 0


# ── 프롬프트 ──────────────────────────────────────────────────────────────────
# 공통 규칙: ① 아트 스타일 낱말 0개 ② 스타일 축을 열거해 "지키라"고도 하지 않는다
# ③ 마크다운 강조(**)를 쓰지 않는다 — 이미지 모델에겐 그냥 글자라 화면에 새어 나온다
# ④ 짧게. 지시가 길수록 개별 지시의 무게가 내려간다(OpenAI 프롬프트 가이드: "긴 프롬프트로
#    과적하지 말고 작은 단일 변경으로 반복하라").

def _slots(items: list[str]) -> str:
    return " ".join(f"{s} 칸 = {t}." for s, t in zip(SLOTS, items))


def face_prompt(who: str, exprs: list[str]) -> str:
    return (
        f"첨부한 그림을 그대로 복제하되 표정만 다른 얼굴 {PER}컷을 한 장에 담아라. "
        f"배치는 가로 {COLS}칸 세로 {ROWS}칸의 균등한 격자다. "
        f"여섯 칸 모두 첨부 그림과 같은 사람({who})이고, 머리 모양·옷·장신구·배경·조명이 첨부 그림과 같다. "
        "칸마다 얼굴 크기와 눈높이가 같고 머리가 칸 한가운데 온다. 어깨 위 얼굴 클로즈업이다. "
        "여섯 칸 전부 첨부 그림과 같은 파일에서 잘라낸 것처럼 보여야 한다. "
        "첨부 그림에서 달라지는 것은 눈매·눈썹·입 모양뿐이다. 나머지는 첨부 그림을 그대로 옮긴다. "
        "표정은 첨부 그림 속 인물이 실제로 지을 만한 정도로만 움직인다. 놀람이나 화남도 크게 벌리거나 찡그리지 않는다. "
        "첨부 그림에 없던 표시는 넣지 않는다 — 땀방울, 뺨의 빗금, 효과선, 이모지 같은 기호를 그리지 마라. "
        f"{_slots(exprs)} "
        "글자·숫자·격자선·테두리·워터마크는 그리지 않는다."
    )


def pose_prompt(who: str, poses: list[str]) -> str:
    return (
        f"첨부한 그림의 사람을 그대로 옮겨서, 자세와 배경만 다른 장면 {PER}컷을 한 장에 담아라. "
        f"배치는 가로 {COLS}칸 세로 {ROWS}칸의 균등한 격자다. "
        f"여섯 칸 모두 첨부 그림과 같은 사람({who})이고, 얼굴·머리 모양·옷이 첨부 그림과 같다. "
        "각 칸은 무릎 위 또는 전신이며 인물이 칸 한가운데 오고 칸마다 인물 크기가 비슷하다. "
        "여섯 칸 전부 첨부 그림과 같은 파일에서 잘라낸 것처럼 보여야 한다. "
        "달라지는 것은 인물의 자세와 그 뒤 공간뿐이다. "
        "뒤 공간은 목조 가옥의 실내와 마당이고, 인물보다 뒤로 물러나 흐리게 둔다. "
        f"{_slots(poses)} "
        "글자·숫자·격자선·테두리·워터마크는 그리지 않는다."
    )


def bg_prompt(themes: list[str]) -> str:
    """캐릭터 테마 배경 — 인물은 그리지 않는다(위에 스탠딩이 얹힌다).

    무드 정본(운영자 260726): "사쿠라 피는 곳에 마당에 우물 있을 법한 목재 가옥,
    전통과 음양 조화 물씬". 그래서 간판·식당 소품이 아니라 가옥과 마당이다.
    첨부 그림은 인물 견본이 아니라 **색·질감 견본**으로만 쓴다.
    """
    return (
        f"오래된 목조 가옥과 그 마당을 그린 배경 {PER}장을, "
        f"가로 {COLS}칸 세로 {ROWS}칸의 균등한 격자로 한 장에 담아라. "
        "모든 칸에 사람이 한 명도 없다. 각 칸은 독립된 배경화다. "
        "첨부한 그림은 색과 질감의 견본이다 — 그 그림을 그린 사람이 이 배경도 그린 것처럼 보이게 하고, "
        "첨부 그림 속 인물이나 소품은 옮겨 오지 마라. "
        "공통 무대: 벚나무가 선 안마당, 돌로 두른 오래된 우물, 격자 미닫이문과 툇마루가 있는 목조 가옥, "
        "낮은 돌담과 이끼. 식당·간판·상점 요소는 넣지 마라 — 가게가 아니라 오래된 집이다. "
        "여섯 칸은 서로 확연히 달라야 한다. 시간대·계절·날씨·빛 색이 칸마다 뚜렷이 갈리고, "
        "같은 장면을 여섯 번 반복하면 실패다. "
        f"{_slots(themes)} "
        "화면 가운데는 비교적 비워 두고, 대비는 낮게 가라앉힌다(위에 흰 유리 카드와 글자가 얹힌다). "
        "글자·간판·로고·워터마크·격자선·테두리는 그리지 않는다."
    )


# ── 레퍼런스 준비 ─────────────────────────────────────────────────────────────
EXTS = (".png", ".jpg", ".jpeg", ".jfif", ".webp")


def ref_path(chef: str) -> pathlib.Path:
    cands = sorted(q for q in REFS.glob(f"{chef}.*") if q.suffix.lower() in EXTS)
    if not cands:
        sys.exit(f"::error::레퍼런스 없음 — app/public/reports/chef-refs/{chef}.* 를 먼저 올려라")
    return cands[0]


def ref_bytes(chef: str, face: bool) -> bytes:
    """첨부용 PNG 바이트. face=True면 얼굴 박스만 떼어 긴 변 1024로 올린다(얼굴 화소를 벌어 준다)."""
    im = Image.open(ref_path(chef)).convert("RGB")
    if face and chef in FACE_CROP and os.environ.get("REF_CROP", "1") != "0":
        w, h = im.size
        x0, y0, x1, y1 = FACE_CROP[chef]
        im = im.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h)))
    if max(im.size) < 1024:
        k = 1024 / max(im.size)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


# ── 격자 검증 ─────────────────────────────────────────────────────────────────
def _profile(img: Image.Image, vertical: bool) -> list[float]:
    """열(또는 행)마다 인접 화소 차이의 평균 — 격자 이음매에서 값이 튄다. numpy 없이."""
    g = img.convert("L")
    if not vertical:
        g = g.transpose(Image.ROTATE_90)
    w, h = g.size
    d = ImageChops.difference(g.crop((1, 0, w, h)), g.crop((0, 0, w - 1, h)))
    return list(d.resize((w - 1, 1), Image.BOX).getdata())


def grid_ok(sheet: Image.Image) -> bool:
    """요청한 COLS×ROWS 격자가 실제로 그려졌나. 1차 런에서 이걸 안 봐서 어긋난 조각을 60개씩 저장했다.

    두 가지를 같이 본다 — 이음매가 **있어야 할 자리에 있고**(격자 준수),
    **칸 한가운데엔 없어야 한다**(모델이 더 잘게 쪼개지 않았나). 뒤엣것을 안 보면
    4열 시트가 2열 검사를 그냥 통과한다(4열 이음매가 2열 이음매를 포함하니까).
    """
    for vertical, n, total in ((True, COLS, sheet.width), (False, ROWS, sheet.height)):
        p = _profile(sheet, vertical)
        if not p:
            return False
        mean = sum(p) / len(p)
        thr = mean + 2.0 * ((sum((v - mean) ** 2 for v in p) / len(p)) ** 0.5)

        def peak(pos: int) -> float:
            lo, hi = max(0, pos - 8), min(len(p), pos + 9)
            return max(p[lo:hi], default=0.0)

        if any(peak(round(total * k / n)) < thr for k in range(1, n)):
            return False  # 있어야 할 이음매가 없다
        if any(peak(round(total * (2 * k + 1) / (2 * n))) >= thr for k in range(n)):
            return False  # 칸 한가운데에 이음매가 있다 = 더 잘게 쪼갰다
    return True


# ── 생성 ──────────────────────────────────────────────────────────────────────
def gen_sheet(chef: str, label: str, out: pathlib.Path, prompt: str, stem: str, face: bool) -> Image.Image:
    dst = out / f"{stem}.png"
    if dst.exists():
        print(f"  ↷ {chef} {label} 이미 있음")
        return Image.open(dst).convert("RGB")
    payload = ref_bytes(chef, face)
    data = {"model": MODEL, "prompt": prompt, "size": SHEET_SIZE, "quality": QUALITY, "n": "1"}
    # gpt-image-1 계열에서 원본 얼굴을 지키는 유일한 손잡이. gpt-image-2는 항상 고충실도라
    # 이 값을 보내면 요청이 거부된다 → 모델명으로 분기한다.
    fidelity = not MODEL.startswith("gpt-image-2")
    if fidelity:
        data["input_fidelity"] = "high"
    for attempt in range(3):
        files = {"image": (f"{chef}.png", io.BytesIO(payload), "image/png")}
        r = requests.post(API, headers=AUTH, data=data, files=files, timeout=900)
        if r.status_code == 200:
            raw = base64.b64decode(r.json()["data"][0]["b64_json"])
            dst.write_bytes(raw)
            print(f"  ✅ {chef} {label} ({len(raw) // 1024}KB · fidelity={'high' if fidelity else '모델기본'})")
            return Image.open(io.BytesIO(raw)).convert("RGB")
        if fidelity and r.status_code == 400 and "input_fidelity" in r.text:
            print("  ⚠ input_fidelity 미지원 응답 — 빼고 재시도(원본 충실도가 떨어진다)")
            data.pop("input_fidelity", None)
            fidelity = False
            continue
        print(f"  ⚠ {chef} {label} 실패 {r.status_code} (시도 {attempt + 1}/3)")
        time.sleep(8 * (attempt + 1))
    sys.exit(f"::error::{chef} {label} 생성 3회 실패")


def slice_sheet(sheet: Image.Image, out: pathlib.Path, names: list[str], ext: str) -> None:
    """정사각 칸을 그대로 떼어 낸다 — 크롭·리사이즈 없음(1차 런의 307→512 업스케일 손실 제거)."""
    ok = grid_ok(sheet)
    dest = out if ok else out / "_check"
    if not ok:
        dest.mkdir(parents=True, exist_ok=True)
        print(f"  ::warning::격자가 요청({COLS}×{ROWS})과 다르다 — 자른 컷을 {dest.name}/ 로 격리했다. "
              f"시트를 눈으로 보고 판단할 것(시트는 남아 있어 재생성 과금 없음)")
    cw, ch = sheet.width / COLS, sheet.height / ROWS
    for i, name in enumerate(names):
        r, c = divmod(i, COLS)
        dst = dest / f"{name}.{ext}"
        if dst.exists():
            continue
        cell = sheet.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
        (cell.convert("RGB") if ext == "jpg" else cell).save(dst, **({"quality": 90} if ext == "jpg" else {}))


def run(chef: str, mode: str) -> None:
    spec = {
        "faces": ("faces", EXPRESSIONS, face_prompt, "png", "표정", True),
        "poses": ("poses", POSES, pose_prompt, "png", "장면", False),
        "bgs": ("bg", BG_THEMES, bg_prompt, "jpg", "배경", False),
    }[mode]
    tag, items, mk, ext, human, face = spec
    out = ROOT / f"app/public/reports/chef-{chef}-{tag}-v1"
    out.mkdir(parents=True, exist_ok=True)
    limit = int(os.environ.get("SHEETS", "0")) or len(items) // PER
    print(f"▶ {chef} {human} — 시트 {limit}장 × {PER}칸 = {limit * PER}컷")
    for s in range(limit):
        batch = items[s * PER : (s + 1) * PER]
        names = [f"{s * PER + i + 1:02d}" for i in range(PER)]
        if all((out / f"{n}.{ext}").exists() for n in names):
            print(f"  ↷ 시트 {s + 1} {PER}컷 전부 존재 — 건너뜀")
            continue
        prompt = mk(batch) if mode == "bgs" else mk(CHEFS[chef], batch)
        sheet = gen_sheet(chef, f"{human} 시트 {s + 1}", out, prompt, f"{tag}-sheet{s + 1}", face)
        slice_sheet(sheet, out, names, ext)
        print(f"    · {names[0]}~{names[-1]}.{ext}")
    (out / "INDEX.md").write_text(
        f"# {human} 인덱스\n\n" + "\n".join(f"- `{i + 1:02d}.{ext}` — {t}" for i, t in enumerate(items[: limit * PER])) + "\n",
        encoding="utf-8",
    )
    print(f"  → {out} 에 {len(list(out.glob(f'*.{ext}')))}컷")


def main() -> None:
    want = os.environ.get("CHEFS", "all")
    keys = list(CHEFS) if want in ("all", "both") else [want]
    mode = os.environ.get("MODE", "faces")
    if mode not in ("faces", "poses", "bgs"):
        sys.exit(f"::error::MODE는 faces|poses|bgs 중 하나여야 한다 (받은 값: {mode})")
    print(f"모델={MODEL} · 시트={SHEET_SIZE} {COLS}×{ROWS}(칸 512×512) · 모드={mode}")
    for chef in keys:
        run(chef, mode)


if __name__ == "__main__":
    main()
