# P0/P1 검수 도구 — 사용법과 주의

> 3대 세션(2026-07-22)이 만들어 승격한 사본. **스크래치패드는 세션과 함께 사라지므로 여기가 정본이다.**

## ⚠ 먼저 알 것 — 경로 가정
대부분의 스크립트는 **에이전트 산출물이 `<스크립트와 같은 폴더>\p0_out\`에 있다**고 가정한다(`Path(__file__).parent / "p0_out"`). 새 세션에서 쓸 때는 둘 중 하나:
1. 스크립트를 그 세션의 스크래치패드로 복사해 쓰거나,
2. 스크립트 안의 `OUT = ...` 한 줄을 실제 산출 폴더로 고쳐 쓴다.
예외: `p0_global.py`는 자기 위치 기준으로 `P0_인벤토리`를 찾으므로 **여기서 그대로 실행 가능**하다.

## 도구 목록

| 파일 | 용도 | 실행 |
|---|---|---|
| `p0_verify.py` | **배치 6게이트 검수**(ID중복 / 파일 커버리지 / 문단 타일링 / quote 전수 축자 / **quote 범위내** / 값·분포) | `python p0_verify.py <배치ID>` |
| `p0_global.py` | **전역 무결성**(배치 간 ID 충돌·줄범위 겹침·파일별 커버 완결성·미착수 목록) | `python p0_global.py` |
| `p0_import.py` | parts 병합 → 정렬·중복제거 → `P0_인벤토리`로 반입 | `python p0_import.py <배치ID>` |
| `p0_credit.py` | 공동 집필 크레딧 **4문형** 추출·교차검증 (`--apply`로 sub_author 채움) | `python p0_credit.py <배치ID> [--apply]` |
| `check_infer.py` | sub_author가 **축자인지 계열추론인지** 판정 → `sub_author_src` 기록 | `python check_infer.py <배치ID> [--apply]` |
| `check_align.py` | 배치의 줄번호가 **어느 좌표계**인지 판정(splitlines vs `\n`) | `python check_align.py <배치ID>` |
| `diag_quote.py` | quote 불일치 건의 **원문 대비 차이** 진단 | `python diag_quote.py <배치ID>` |
| `p0_pick.py` | 인벤토리에서 **깃발별 축자 후보** 질의(보드 코멘트·프라이머 재료) | `python p0_pick.py <flag> [개수] [최소길이]` |
| `p0_status.py` | 누적 집계 + **미착수 파일 목록**(다음 라운드 대상 산출) | `python p0_status.py` |
| `p0_catalog.py` | 보류군(타 술수·매뉴얼) **글 좌표 카탈로그** 생성 | `python p0_catalog.py` |
| `scan_sep.py` | **줄 구분자 좌표계 불일치 스캔**(U+2028 등) — 새 파일 반입 전 필수 | `python scan_sep.py` |

## 반드시 지킬 실행 규칙
- 콘솔에 한글이 깨지면 `$env:PYTHONIOENCODING='utf-8'` 먼저.
- **검수 결과에 G1~G6가 전부 찍히는지 눈으로 확인**하라. 에이전트가 옛 사본으로 `p0_verify.py`를 덮어써 G6가 사라진 채 돌았던 사고가 실제로 있었다.
- 합격 기준(3대 운용): **미커버 0 · quote 축자 불일치 0 · quote 범위이탈 0 · 타일링 불량 0 · ID중복 0**. gist 60자 초과는 조건부 합격(P1 정규화 대상).
