# 프로젝트 메모

**[제1법칙] 새로운 지식·정보(유튜브 링크, 외부 문헌, 사용자 제공 텍스트 등)가 들어오면 반드시 `/feed` 스킬(블라인드 시험 루프)을 발현해 검증·주입한다.** 임의 요약·직접 반영 금지 — 영상/문헌을 답안지 삼아 질문을 역추출하고, 지식 없는 블라인드 학생이 KB만으로 같은 답을 내는지 시험 → 격차 원인 유추 → 정제 반영 → 새 블라인드 학생 재시험(통과까지, 3라운드 후 사용자 승격). 절차 정본: `.claude/skills/feed/SKILL.md` (2026-07-17 사용자 확정).

이 폴더는 사주명리 사이트 글을 워드 파일로 아카이빙하는 작업 공간이다.
`정제본\`에는 광고·후원·구독 유도·인사말·링크 잔재·이모지를 제거한 정제 docx(원본과 1:1, 글 수 동일)가 있고, 정제 규칙·재실행은 `refine-tools/refine.py`(제거 내역은 `정제본\정제 리포트.md`). 원본을 다시 만들거나 추가 수집하면 `python refine-tools/refine.py`로 정제본 일괄 갱신.
`사주명리 아카이브 통합본 (정제).docx` = 정제본 76편을 6부(사이트별)로 묶은 단일 문서(2,504글, 8MB) — `refine-tools/merge.py`로 재생성(PARTS 목록에 새 문서 추가 후 실행; 목록·파일 불일치 시 assert로 중단해 누락 방지).
`사주명리 대전 — 주제별 통합본 (정제).docx` = 같은 2,504글을 **주제별 17장**(음양오행→간지→합충→…→재미로 읽는 사주→기타역학→부록)으로 재분류하고 이론 장은 입문→심화 레벨 순 배열한 책 형태 문서. 분류 자산은 전부 `refine-tools/`에: `units.json`(글 단위 추출), `labels/seg_*.json`(Opus 분류+Fable 검수), `labels_overrides.json`(수동 재판정·가십 이동 — **분류를 고치려면 이 파일에 key→C01~C17 추가**), `levels/CH_*.json`(장별 레벨·진행방향), 재조립은 `python refine-tools/assemble_book.py`(라벨 커버리지·글 수 assert 내장). 글 추가 시: 정제본 갱신 → `extract_units.py` → 새 글만 분류(세그먼트 추가) → `assemble_book.py`.
소스별 파이프라인: 플러스명리학(saju.sajuplus.net) → `sajuplus-tools/`, 안녕·사주명리 티스토리(yavares.tistory.com) → `tistory-tools/`, 초코서당(chocosd.com) → `chocosd-tools/`, 다시 배우는 사주명리(www.sajustudy.com) → `sajustudy-tools/`, 도화로운(dohwaroun.com, 아임웹) → `dohwaroun-tools/`.
디자인 참고자료: 포스텔러 만세력(pro.forceteller.com) 구조·디자인 스크랩 → `forceteller-ref/` (README.md에 라우트맵·디자인 토큰·API·자동화 함정 정리; React+MUI+emotion이라 스냅샷은 CSSOM 직렬화 내장본).
사주풀이 웹앱('명리학 도사' 미연시풍) — **새 세션은 무조건 `dosa-app/STATUS.md`부터 읽을 것**(진행 상태·다음 작업 큐·결정 로그·부팅 절차 = 세션 간 인수인계 문서, 작업 후 갱신 필수). 설계·절대 원칙·L4 서술 표준은 `dosa-app/README.md`. 스킬: **/saju**(생년월일시→근거 리포트+풀이), **/feed**(v2 블라인드 시험 루프 — 질문 역추출→블라인드 시험→격차 원인별 정제 주입→재시험; 제1법칙의 실행 절차). 파생물(unit_bodies.json 등)은 gitignore — 부팅 시 `python3 dosa-app/kb-tools/extract_bodies.py`로 재생성. **절대 원칙**: 근거는 코퍼스 출처 필수, 자료 선택은 검색(RAG)이 아니라 만세력 계산 결과가 키가 되는 결정론 조회, LLM은 서술층일 뿐(없어도 조립식 리포트로 완결 동작), 지식은 요소별 정제 유닛으로 증류(문헌 이견은 관점차이로 병기).

## 파이프라인 (시행착오 없이 바로 실행)

**`sajuplus-tools/README.md`를 먼저 읽을 것.** 검증 완료된 전체 플레이북(결정 트리, 함정 7가지, 게시판 코드표, 수집 현황)이 거기 있다. 요약:

1. 익명 크롤: `python sajuplus-tools/crawl_board.py <boards.json>` — 완전 수집되면 그걸로 끝
2. 부족하면(로그인 게이트) 브라우저 크롤: `sajuplus-tools/browser_crawl.js`를 claude-in-chrome javascript_tool로 실행 (반드시 백그라운드 + 폴링, 동기 await 금지 — 45초 타임아웃)
3. 반출: localStorage → 같은 origin 두 번째 탭에서 Blob 다운로드 → 파일은 `C:\Users\Hwang\Google Drive 스트리밍\내 드라이브\Shared\`에 떨어짐 (Downloads 아님)
4. 워드 생성: `node sajuplus-tools/build_from_json.js <data.json> <meta.json>` (최초 1회 `npm install docx`)
5. 검증: docx 내부 XML 파싱 체크. Word COM 쓰기 전 잔여 WINWORD 프로세스 kill

## 주의

- 대용량 데이터를 javascript_tool 반환값으로 꺼내지 말 것 (10KB 잘림 + 쿠키/쿼리스트링 차단)
- 페이지 JS에서 127.0.0.1 fetch 불가 (PNA 차단) — 로컬 수신 서버 방식 시도하지 말 것
- 사이트 광고차단 팝업(#moa_area)이 클릭을 가로챔 — JS로 제거
- 수집한 원본 데이터(JSON)는 sajuplus-tools/에 보관되어 있음 (boards_full.json = 명리학탐구 10개 게시판, boards_manual.json = 사용설명서 2개)
- 완성된 워드 파일들은 이 폴더에 "<게시판명> 게시판 글모음.docx" 형태로 저장됨

## 티스토리(안녕, 사주명리) 파이프라인

- `tistory-tools/README.md` 참조. 로그인 게이트 없음 — 일괄 수집은 `python scrape_all.py`.
- **전 카테고리 완료** (2026-07-12): 21개 문서, 블로그 글 1,225 + 일간별 운세 페이지 60 = 1,285건 (원본 cat_*.json 보관).
- 본문 div는 `contents_style`로 찾을 것 (`tt_article_useless_p_margin`은 일부 글에 없음).
- 2026년 2월부터 월운은 /pages/ 문서 10개 + 링크 허브 글 구조 — 페이지는 카테고리 목록에 안 잡히므로 `fix_pages.py`로 수집.
- 워드는 기존 docx를 zip 템플릿으로 재사용해 생성 → 서식 자동 일치.

## 사주스터디(www.sajustudy.com, 다시 배우는 사주명리) 파이프라인

- `sajustudy-tools/README.md` 참조. 티스토리 커스텀 도메인, 로그인 게이트 없음 — `python scrape.py` → `python build_docx.py`.
- 8개 상위 카테고리 152글 + 블로그 공지(/notice) 2글 = 154글 전량 수집 완료 (2026-07-12, posts.json 보관).
- yavares와 스킨이 다름: 제목 `og:title`·날짜 `article:published_time` 메타로 파싱, 목록엔 `item_category` 없음(JSON-LD 사용). 본문은 동일하게 `contents_style`.
- 파일명 `사주공부-<카테고리> 글모음.docx` 접두어 방식. 하위 카테고리는 문서 내 그룹 정렬.

## 초코서당(chocosd.com) 파이프라인

- `chocosd-tools/README.md` 참조. 워드프레스 — REST API(`/wp-json/wp/v2/`) 완전 공개, 브라우저 불필요.
- `python scrape.py` → `python build_docx.py` 두 단계. 84글·13카테고리 전량 수집 완료 (2026-07-12, posts.json 보관).
- 함정: 워드프레스는 표를 `<figure class="wp-block-table">`로 감싼다 — figure 일괄 스킵하면 표 소실.
- 파일명은 티스토리 글모음과 충돌 방지 위해 `초코서당-<카테고리> 글모음.docx` 접두어 방식.

## 도화로운(dohwaroun.com, 아임웹) 파이프라인

- `dohwaroun-tools/README.md` 참조. 아임웹 게시판 — 무료 게시판만 익명 수집 가능.
- `python scrape.py monthlylucky` / `saju_column` → `python build_docx.py <board>.json`.
- 월간운세 35글 + 사주 칼럼(약 90글) 수집. 유료 강의(도화록/도화첩)는 **영상 + 접근 만료**라 문서화 불가, Premium 칼럼도 별도 권한이라 접근 불가.
- 본문 div는 **작은따옴표** `<div class='board_txt_area fr-view'>` (CSS에도 같은 클래스 다수 등장 → 실제 여는 div 태그를 depth 추적). 제목 `og:title`(접미어 제거)·날짜 JSON-LD `datePublished`.
- 목록 idx는 카드 onclick 전용 패턴으로 추출(판매버튼 `/lecture/?idx=` 등 stray 배제).
