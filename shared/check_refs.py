#!/usr/bin/env python3
"""check_refs — CLAUDE.md 경로 참조 실존 + SYNC 마커 번호 드리프트 검사.

평의회 260717 보강(위원4 게이트 공격·위원5 SYNC 감시 반영):
- 커버리지: 후행 슬래시 디렉터리(`sajuplus-tools/` 등)·명령줄 속 경로(`python x/y.py`) 포함 (FN-C)
- 타 레포 면제 = 명시 화이트리스트(muteno/nomute-editor)로 한정, 전(全) 문맥이 면제일 때만 (FN-A/B)
- 오탐 선방: 코드펜스 제거·브랜치(origin/…)·도메인·Windows 백슬래시 표기 스킵 (FP)
- 마커 앵커: 골격 [N] 번호 드리프트를 키워드로 검출 — 바인딩의 [N] 참조가 헛도는 사고 방지 (F-1)
"""
import re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent

# 골격 [N] 줄에 반드시 있어야 할 키워드 — 전파로 번호가 밀리면 여기서 울린다
MARKER_ANCHORS = {'[4]': '디자인', '[5]': '플레이그라운드', '[6]': '보고', '[9]': '병렬', '[11]': '미리보기'}  # [6] '한 수'→'보고': 260717 #51 개정(6단 골격) 동조
EXTERNAL_REPOS = ('muteno/', 'nomute-editor')  # 타 레포 참조 면제 화이트리스트


def path_tokens(s):
    """백틱 안 문자열 → 검사할 경로 토큰들 (명령줄이면 슬래시 포함 토큰만)."""
    if ' ' not in s:
        return [s]
    return [t for t in s.split() if '/' in t and not t.startswith('-')]


def main():
    txt = (ROOT / "CLAUDE.md").read_text(encoding="utf-8")
    errs = []

    # 1) 마커 앵커 (SYNC 구간 번호 드리프트)
    if '<!-- SYNC-COMMON-START -->' in txt:
        common = txt.split('<!-- SYNC-COMMON-START -->')[-1].split('<!-- SYNC-COMMON-END -->')[0]
        for num, kw in MARKER_ANCHORS.items():
            m = re.search(r'^' + re.escape(num) + r'[^\n]*', common, re.M)
            if not (m and kw in m.group(0)):
                errs.append(f"마커 번호 드리프트 의심: {num} 절에 '{kw}' 없음 — 【레포 바인딩】의 [N] 참조 전수 재점검 필요")

    # 2) 경로 실존 (코드펜스 제외본에서 수집, 경로별 전 문맥 보존)
    body = re.sub(r"```.*?```", "", txt, flags=re.S)
    pats = {}
    for m in re.finditer(r"`([^`\n]*/[^`\n]*)`", body):
        pats.setdefault(m.group(1), []).append(body[max(0, m.start() - 60):m.start()])
    bad = []
    for raw, ctxs in sorted(pats.items()):
        if all(any(ext in c for ext in EXTERNAL_REPOS) for c in ctxs):
            continue  # 모든 등장 문맥이 타 레포 소속일 때만 면제
        for p in path_tokens(raw):
            if any(ch in p for ch in "{}*<>"):
                continue
            if p.startswith("/") or "\\" in p:
                continue  # URL·절대경로·Windows 표기
            if re.match(r"(origin|refs|feature|HEAD|[\w.-]+\.(com|net|dev|kr|io))([/:]|$)", p):
                continue  # 브랜치·도메인
            if not re.fullmatch(r"[\w./가-힣_-]+", p):
                continue  # 경로 문자 집합 밖(산문·수식) — 검사 불가 표기
            if not (ROOT / p.rstrip("/")).exists():
                bad.append(p)

    if errs or bad:
        if errs:
            print("❌ 마커 앵커 실패:")
            [print(" -", e) for e in errs]
        if bad:
            print("❌ CLAUDE.md가 가리키는 경로 미실존:")
            [print(" -", b) for b in sorted(set(bad))]
        return 1
    print("✅ check_refs 통과 — 경로 참조 실존 + 마커 앵커 정상.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
