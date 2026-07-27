# -*- coding: utf-8 -*-
"""
원본 반입기 — 원문 재료를 리포 `정제/원본/`으로 옮긴다. **이게 마지막 로컬 작업이다.**

운영자 260727: *"아예 로컬에서의 작업은 없앨거야"* · *"비공개 할 필요는 없음. 정제본, 원본으로만 구분하면 됨"*
→ 재료가 있는 기계에서 이걸 한 번 돌리고 커밋하면, 이후 어느 세션(클라우드 포함)이든
  `파이프라인.py --all`을 완주할 수 있다. 원천은 읽기만 한다(무수정).

무엇을 하나:
  ① P0_인벤토리 → 정제/원본/P0_인벤토리   (색인 jsonl + *_v1 스냅샷 원문 전문)
  ② 전사 내용   → 정제/원본/전사           (*.md만 · 폴더명 평탄화 — `_자막` 접미사 제거)
     ⚠평탄화 이유: .gitignore의 `*_자막/`(블라인드 격리)이 그 이름의 폴더를 **조용히** 깃에서 뺀다.
       조용한 미반입 = 이 프로젝트 사고 패턴 1번이라, 이름을 바꿔 규칙을 피하지 않고 **안 밟는다**.
  ③ P2_유닛     → 정제/P2_유닛             (지식망 화면 ⑬의 입력 — 원래 리포 상대 자리)
  ④ 개인정보 가리기 — 제3자 이메일·휴대전화를 복사 시점에 마스킹(공개 리포 절대선 —
     운영자도 이건 예외로 안 두었다). ⚠줄 수 보존(P0 포인터 = file+lines 줄 번호).
     ⚠주민번호류 6~13자리 숫자는 **안 건드린다** — 절기 epoch·FigJam 좌표 오탐 실증(★지금이어받기 §3).

사용(재료가 있는 기계에서):
    python 원본_반입.py "C:\\Users\\Hwang\\OneDrive - GS칼텍스 예울마루\\황세웅\\6.  Nomute\\3. 사주"
    python 원본_반입.py            # 인자 생략 = 레거시 리포 상대 위치에서 탐색

끝나면:  git add "정제/원본" "정제/P2_유닛" && git commit && push (브랜치+PR).
되돌리기 = 새로 생긴 폴더 삭제뿐(원천 무수정 · 커밋 전이면 git 밖).
"""
import re, sys, shutil, unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import 경로

# 텍스트로 취급해 마스킹까지 하는 확장자 — 그 외는 원바이트 복사
TEXT_EXT = {".txt", ".md", ".jsonl", ".json", ".csv", ".tsv", ".log"}
GIT_한도 = 95 * 1024 * 1024          # GitHub 파일 상한 100MB 아래 안전선

EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# 휴대전화만(01X-…) · 앞뒤가 숫자면 매치 금지 — epoch·좌표 같은 긴 숫자열 오탐 차단
PHONE = re.compile(r"(?<!\d)01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)")

계수 = {"파일": 0, "메일": 0, "전화": 0, "생략_대용량": 0, "이진복사": 0}


def 가리기(text: str) -> str:
    text, n1 = EMAIL.subn("[가림-메일]", text)
    text, n2 = PHONE.subn("[가림-전화]", text)
    계수["메일"] += n1
    계수["전화"] += n2
    return text


def 복사(src: Path, dst: Path):
    if src.stat().st_size > GIT_한도:
        계수["생략_대용량"] += 1
        print(f"  ⚠생략(>{GIT_한도 // 1024 // 1024}MB): {src}")
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.suffix.lower() in TEXT_EXT:
        try:
            dst.write_text(가리기(src.read_text(encoding="utf-8-sig")), encoding="utf-8")
        except UnicodeDecodeError:
            shutil.copyfile(src, dst)
            계수["이진복사"] += 1
    else:
        shutil.copyfile(src, dst)
        계수["이진복사"] += 1
    계수["파일"] += 1


def 트리복사(src_dir: Path, dst_dir: Path, 패턴="*", 평탄화_자막=False):
    if not src_dir.exists():
        print(f"  — 없음(건너뜀): {src_dir}")
        return
    for p in sorted(src_dir.rglob(패턴)):
        if not p.is_file():
            continue
        rel = p.relative_to(src_dir)
        if 평탄화_자막:
            rel = Path(*[unicodedata.normalize("NFC", part).removesuffix("_자막")
                         for part in rel.parts])
        복사(p, dst_dir / rel)


def main():
    if len(sys.argv) > 1:
        원천 = Path(sys.argv[1])
        p0_src = 원천 / "2. 정제작업" / "P0_인벤토리"
        전사_src = 원천 / "0. 전사프로그램" / "전사 내용"
        p2_src = 원천 / "2. 정제작업" / "P2_유닛"
    else:                                   # 레거시 리포 상대 위치
        p0_src = 경로.정제 / "P0_인벤토리"
        전사_src = 경로.뿌리 / "0. 전사프로그램" / "전사 내용"
        p2_src = 경로.정제 / "P2_유닛"

    print(f"① P0_인벤토리: {p0_src} → {경로.원본 / 'P0_인벤토리'}")
    트리복사(p0_src, 경로.원본 / "P0_인벤토리")
    print(f"② 전사(*.md·평탄화): {전사_src} → {경로.원본 / '전사'}")
    트리복사(전사_src, 경로.원본 / "전사", 패턴="*.md", 평탄화_자막=True)
    if p2_src != 경로.정제 / "P2_유닛":     # 원천이 따로 있을 때만(자기 자신 복사 방지)
        print(f"③ P2_유닛: {p2_src} → {경로.정제 / 'P2_유닛'}")
        트리복사(p2_src, 경로.정제 / "P2_유닛")

    print(f"\n완료 — 파일 {계수['파일']:,} · 가림 메일 {계수['메일']:,}·전화 {계수['전화']:,}"
          f" · 이진 {계수['이진복사']} · 대용량 생략 {계수['생략_대용량']}")
    print('다음: git add "정제/원본" "정제/P2_유닛" → 커밋 → 브랜치 푸시 + PR')
    print("검증: python 파이프라인.py --check  (①②단계가 '입력없음'에서 벗어나야 정상)")


if __name__ == "__main__":
    main()
