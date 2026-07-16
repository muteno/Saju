# 초코서당(chocosd.com) → 워드 파이프라인

검증 완료 (2026-07-12). 전체 84개 글 · 13개 카테고리(빈 카테고리 4개 제외) 전량 수집·문서화 완료.
**워드프레스 사이트 — REST API(/wp-json/wp/v2/)가 완전 공개**라 로그인/브라우저 크롤 불필요.
목록 페이지 파싱도 필요 없음: API가 글 본문(content.rendered)까지 통째로 준다.

## 실행

```
python scrape.py        # REST API로 카테고리+글 84개 전체 수집 → posts.json (HTTP 몇 회, 수 초)
python build_docx.py    # posts.json → "..\초코서당-<카테고리> 글모음.docx" 13개 일괄 생성
```

## 사이트 구조 핵심

- 워드프레스 7.x. `/wp-json/wp/v2/categories?per_page=100` → 카테고리 17개(글 있는 건 13개)
- `/wp-json/wp/v2/posts?per_page=100&page=N` + 헤더 `X-WP-TotalPages`로 페이징 (84개면 1페이지)
- `_fields=id,date,link,title,content,categories`로 필요한 필드만
- 글마다 카테고리 정확히 1개씩 (할당 합 84 = 글 84 = count 합 84 정합 확인됨)
- 고정 페이지(wp/v2/pages)는 1개뿐이고 홈 랜딩(빌더 레이아웃)이라 아카이브 제외
- 본문 전부 공개 (protected 없음, 본문 없는 글 0)

## 본문 파싱 (tistory-tools BodyParser 기반, 워드프레스용 수정)

- **핵심 차이: 워드프레스는 표를 `<figure class="wp-block-table">`로 감싼다.**
  figure를 통째로 스킵하면 표가 사라짐 → figure별 스택으로 wp-block-table만 통과,
  이미지/임베드 figure는 스킵 (figcaption도 스킵)
- 목차 플러그인 버튼 라벨 `'Toggle'` 블록은 UI 잔여물이라 필터링 (69회 출현했었음)
- '박승혜 20,000' 류 반복 블록은 후원 내역 글의 실제 내용 — 잔여물 아님, 보존
- 나머지는 tistory와 동일: blockquote→인용, li→글머리표, tr→"셀1 | 셀2", br→줄분리

## 워드 생성

tistory-tools와 동일 — 기존 `..\자평명리학 게시판 글모음.docx`를 zip 템플릿으로 재사용,
`word/document.xml`만 새로 생성. 파일명은 기존 파일들과의 충돌 방지를 위해
`초코서당-<카테고리> 글모음.docx` 접두어 방식 (신살·일주론이 티스토리 글모음과 이름 겹침).
검증(minidom 파싱 + Heading1 수 == 글 수 assert) 내장.

## 데이터

- `posts.json` — 84개 글 원본 (id/url/제목/날짜/카테고리/블록 리스트). 재수집 없이 재생성 가능.
