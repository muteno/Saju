# 도화로운(dohwaroun.com, 아임웹) → 워드 파이프라인

검증 완료 (2026-07-12). 무료 텍스트 게시판 2개 수집 대상. 아임웹(imweb) 기반.

## 스크립트

```
python scrape.py monthlylucky      # 월간운세 → monthlylucky.json
python scrape.py saju_column       # 사주 칼럼 → saju_column.json
python build_docx.py monthlylucky.json   # → ..\도화로운 월간운세 글모음.docx
python build_docx.py saju_column.json    # → ..\도화로운 사주 칼럼 글모음.docx
```

두 게시판 모두 **비로그인 공개**라 익명 curl로 수집 가능. build_docx는 tistory-tools/build_docx.py의
문단 빌더를 import해 기존 글모음과 동일 서식으로 생성.

## 사이트 구조 (아임웹 게시판)

- 목록: `/<board>?page=N` — 카드 onclick=`location.href='/<board>/?...&bmode=view&idx=<idx>&t=board'`.
  idx가 카드마다 여러 번 반복되므로 순서 유지 dedupe. 페이지 없으면(첫 페이지 idx만 반복) 종료.
- 글 상세: `/<board>/?bmode=view&idx=<idx>&t=board`
  - 제목: `og:title`에서 접미어 `" : 사주운세 : 오늘의 운세보다 정확한 무료운세"` 제거
  - 날짜: JSON-LD `"datePublished"` (화면 표시 날짜보다 정확)
  - **본문: `<div class='board_txt_area fr-view'>`** — 작은따옴표 주의(정규식 `['\"]`),
    본문이 페이지에 CSS(`<style>`)로도 여러 번 등장하므로 실제 여는 div 태그를 찾아 div 깊이 추적으로 잘라냄.
    froala 에디터 콘텐츠라 p/h/li/blockquote/table 파서로 블록화. 이미지·프로모션 배너 이미지는 제외(텍스트만).
- robots.txt: 게시판 허용 (login/shop_cart/admin/?mode* 만 금지).

## 접근 권한 구조 (2026-07-12 로그인 확인, 계정: 황세웅)

| 메뉴 | 경로 | 상태 |
|---|---|---|
| 월간운세 | /monthlylucky | ✅ 공개 (약 40글) |
| 사주 칼럼 | /saju_column | ✅ 공개 (9페이지 약 90글) |
| Premium 칼럼 | /premium_saju | ❌ "접근 권한이 없는 회원입니다" (별도 권한) |
| 강의시청: 도화록(1차) | /43 | ❌ 접근 권한 없음 + **영상 강의** |
| 강의시청: 도화첩(2차) | /vod | ❌ 접근 권한 없음 + 영상 강의 |

- 사용자는 "1차 도화록 : 셀프 사주 리딩 클래스 클래스메이트 123일"을 2025-07-12 결제(주문 202507122877775).
  **123일 수강권이라 만료**된 것으로 보이며, 현재 /43 접근 시 권한 없음. 게다가 강의는 아임웹+Vimeo **영상**이라
  Word 문서로 담을 수 없음(전사 불가·다운로드 차단·ToS). → 문서화 대상은 무료 텍스트 게시판 2개뿐.
- Premium 칼럼(/premium_saju)은 도화록 수강권과 별개 권한이라 결제와 무관하게 막혀 있음.

## 산출물

- `monthlylucky.json`, `saju_column.json` — 원본 (idx/url/제목/날짜/블록). 재수집 없이 docx 재생성 가능.
- `..\도화로운 월간운세 글모음.docx`, `..\도화로운 사주 칼럼 글모음.docx`
