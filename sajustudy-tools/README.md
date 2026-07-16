# 다시 배우는 사주명리(www.sajustudy.com) → 워드 파이프라인

검증 완료 (2026-07-12). 전체 8개 상위 카테고리 152개 글 + 블로그 공지 2개 = **154개 전량 수집·문서화 완료**.
티스토리 커스텀 도메인 블로그(작성자: 사공/사주공부) — **로그인 게이트 없음**, 익명 파이썬 크롤로 끝.

## 실행

```
python scrape.py        # 전 카테고리 목록+글+공지 수집 → posts.json (약 2분, 요청간 0.35초)
python build_docx.py    # posts.json → "..\사주공부-<카테고리> 글모음.docx" 8개
```

## 사이트 구조 (yavares와 스킨이 다름 — 선택자 주의)

- 카테고리 8개(사이드바 순): 공지(5)·명리 초급(77)·명리 중급(29)·신살론(16)·추명가 강의(5)·사주상식(3)·사공 저서(14)·사공 역학 서비스(3) = 152
- **사공 저서만 직속 글 7개** 보유(하위: 책 오류 및 교정 3 + 저서 안내 4). 나머지 상위는 하위 합계와 일치
- 블로그 공지 2개(/notice/135, /notice/128)는 카테고리 목록에 안 잡힘 → `/notice`에서 별도 수집, '공지' 문서에 편입
- 목록: `/category/<인코딩 경로>?page=N`, JSON-LD BreadcrumbList에서 id/제목 (fallback: `div.post-item`). `li.item_category` 없음
- 글: 제목 `og:title` 메타, 날짜 `article:published_time` 메타, 분류 `span.category`(공지 페이지엔 없음), 본문 `div.contents_style` (yavares와 동일 — tistory-tools 파서 재사용)
- robots.txt: guestbook/manage/search만 금지 — 카테고리·글·notice 허용

## 워드 생성

tistory-tools/build_docx.py 문단 빌더 + '자평명리학 게시판 글모음.docx' zip 템플릿 재사용 (importlib로 로드).
- 상위 카테고리당 1개 문서, 파일명 `사주공부-<카테고리> 글모음.docx`
- 하위 카테고리 있는 문서: 하위(사이드바 순) → 날짜순 배열, 목차에 하위 구분 제목, 직속 글은 맨 앞
- 글 메타줄에 `분류 상위 > 하위` 표기
- 검증 내장: minidom 파싱 + Heading1 수 == 글 수 assert

## 데이터

- `posts.json` — 154개 글 원본 (id/url/제목/날짜/분류(top·sub)/블록). 재수집 없이 재생성 가능.
