# STATUS — 세션 인수인계 (어느 세션·어느 모델이든 이 파일부터)

> 갱신: 2026-07-17. 설계 원칙은 `dosa-app/README.md`(절대 원칙 4 + L4 서술 표준).
> **이 문서는 세션의 유일한 기억이다 — 작업할 때마다 갱신할 것.**

## 🔒 세션 수칙 (누락·드리프트 0 — 최우선)

퀄리티는 세션 실력이 아니라 **통과해야 하는 검사기**가 보장한다. 그래서:

1. **시작**: 이 STATUS 읽기 → `git fetch` → `origin/main`이 앞섰으면 **즉시 병합**(장수 분기 금지 — 2026-07-17 앱#39와 지식#40이 갈라진 사고가 그 증거). 그다음 `npm run verify`로 파생물 재생성 + 상태 확인.
2. **단일 진실 = main.** 작업 브랜치는 짧게 쓰고 빨리 머지. 다른 세션이 main을 전진시켰으면 내 브랜치에 먼저 병합하고 이어간다.
3. **기계산출물 손편집 금지**: 색인(`kb/*_index.json`)·`kb.json`·`unit_bodies.json`·`app/src/engine/vendor/*`는 전부 생성물. 값 바꾸려면 **생성 스크립트를 고쳐 재실행**한다.
   - 엔진 정본 = `dosa-app/engine/src/`. 앱 사본은 `npm run sync:engine`으로만 갱신.
4. **커밋 전 `npm run verify` 통과 필수** (5게이트: 파생물→vendor드리프트→엔진테스트→증류검증→앱빌드). 하나라도 빨강이면 커밋 금지.
5. **작업 후 이 STATUS 갱신** (진행표·작업큐). 다음 세션에게 남기는 쪽지다.

## 명령어 (전부 저장소 루트에서)

```bash
npm run verify        # 만능 품질 게이트 (커밋 전 필수)
npm run build         # prebuild(파생물+sync+kb번들) → app tsc+vite → dist/  (Cloudflare가 이걸 씀)
npm run sync:engine   # dosa-app/engine/src → app/src/engine/vendor 재생성
npm run build:kb      # kb 번들(app/public/kb-<hash>.json + vendor/kb_ref.json) 재생성
# 스킬: /saju <생년월일시> (근거 리포트+풀이) · /feed <유튜브URL> (지식 주입)
```

## 완성 상태 (전부 verify 통과)

| 층 | 상태 |
|---|---|
| L1 만세력 엔진 (`dosa-app/engine/src`) | ✅ 원국·십신·지장간·십이운성·신살·합충·공망·대운·**구조판정(judge)**·**운대입(unse)** — 테스트 19건, 포스텔러 픽스처 일치 |
| L2 색인 | ✅ unit_index(598키) + interaction_index(103키/13,641문단) + impression_index(46키/2,969문단) |
| L2 증류 | ✅ **일주 60/60** + **image 19/19**(2026-07-17 천간 6키 완성, 이미지층 종결) — 인용 223건 축자 검증 |
| L3 리포트 (`report.js`) | ✅ 구조판정→일주(증류)→십신→합충→신살→대운→세운, 출처 병기 |
| **앱 (`app/`, React+Vite)** | ✅ 엔진 실연결 + **L3 근거 리딩 연결 완료**(`Result.tsx`가 `toReading`→출처 표기). KB는 `app/public/kb.json` 런타임 fetch(Q05 경량화 — JS 번들 0.57MB·kb 독립 캐시, `loadKb()` 게이트). 빌드→`dist/`, `wrangler.toml`로 Cloudflare 배포 |
| L4 도사 대화(LLM) | ⬜ 서술 표준만 확정 — API 연결 미착수 |
| 트레이닝/승계 | ✅ `/saju`·`/feed v2`(블라인드 시험 루프 — 루트 CLAUDE.md **제1법칙**) 스킬 + `probe_coverage.py` + STATUS + `npm run verify` 게이트 |

## 다음 작업 큐 (우선순위)

1. ~~앱 KB 번들 경량화~~ **완료(← Q.05, 260717)** — kb.json을 JS 인라인에서 `app/public/kb.json` 런타임 fetch로 분리. JS 번들 2.07MB→0.57MB(gzip 190KB), kb 독립 캐시(gzip 332KB). main.tsx loadKb() 게이트 + saju.ts 지연 평가(모듈 시점 호출 제거). 브라우저 스모크(홈+/result 딥링크) 통과.
2. **배치 전 레일 3종**(평의회 260717 제안): ⓐ`replay_exams.py` **완료(← Q.04)** — verify 4단계 편입, 1호 시드 = 배관 박제 시트(`dosa-app/kb/exams/JMCgXyFr2hg.json` — 주입 고아 결함 재현→수선 PASS) ⓑL3 리포트 골든 스냅샷 3건(조립 이음새 계약 테스트) ⓒ증류 단일출처 플래그 린트(validate_distilled 확장).
3. **도화도르 채널 배치 트레이닝** — 신규 128편(목록 준비됨: 공개 188 중 60 기보유) `/feed v2` 파도 20편 단위, 파도마다 회색지대 질문·표본 시트 사용자 제출. **사용자 GO 대기**(GO 시 원장 Q 채번, GO 1회 = 파도 1개).
4. **상호작용 상위 30키 + 통변방법론 28편 증류** → frame/·chain/ 키가 근거 유닛을 갖게 됨.
5. **직업→십신 역매핑 사전** (금융=편재, 학문=인성 …) — 운명전쟁49 분석에서 도출. 후속 질문 처리용.
6. **앱 출생지→경도 전달** (`buildReading`/`computeChartUI`에 longitude). 현재 서울 고정 → 순천 등 오차.
7. **일진 다이어리 UI** — 엔진 `diaryDayInfo` 완성, UI는 사용자 제공 예정.
8. **L4 도사 대화(API)** — Pages Function 프록시, L4 서술 표준.
9. 귀문 인상론 보강(유일 커버리지 공백) · 대운수 반올림 유파 옵션.

## 사용자 액션 아이템 (세션이 대신 못 하는 것 — 잊지 말 것)

- [ ] **기존 Cloudflare "saju" 프로젝트 삭제/연결해제.** 웹 빌드 없던 시절 대시보드 설정 잔재라 커밋마다 빨간 X를 냄. 정상 배포처는 **"saju02"**(2026-07-17 배포 성공: claude-organize-extracted-fi.saju02-7n8.pages.dev). saju 지우면 노이즈 사라짐.
- [ ] (선택) 도사 캐릭터 컨셉·일러스트, 일진 다이어리 UI/UX 제공 → L5 연결.

## 결정 로그 (왜 — 뒤집으려면 사용자 승인)

- 신강신약 = 보드 110점제(천간각10, 지지 년15·월30·일15·시10; 30/45/60). 12신살=월일시지는 년지 삼합·년지는 일지 기준. 도화/역마/화개 기본=broad(왕지/생지/고지 글자).
- 일진 = (JDN+49)%60. 시주경계=진태양시(경도×4분). 자시 기본=정자시(23시 익일).
- 검색(RAG) 금지 — 키 결정론 조회만. 증류 인용=축자, 이견=관점차이 병기.
- 지식 주입 품질 게이트 = **블라인드 시험 루프**(/feed v2, 루트 CLAUDE.md 제1법칙): 영상=답안지, 질문 역추출→주입 전 1차 시험→격차 원인(부재/미발견/관점차이) 유추→정제 반영→새 블라인드 학생 재시험, 3라운드 실패 시 사용자 승격. 키 스캐너 판정은 전처리로 강등, **0단계 수집기는 판단 금지**(`fetch_transcripts.py` — 음성 전량 수집, NO_SUBS/INCOMPLETE/THROTTLED 구분·페이싱 내장) — 2026-07-17 사용자 설계.
- 유튜브 주입 정본 경로 = `ingest_transcript.py`(stage→fulltext+yt_units 멱등 등록) — `check_new_video --save` 주입 금지(score<2 무음 거부+색인 고아, 평의회 260717 발견①·박제 시트 실증) — 2026-07-17.
- 앱 엔진은 **벤더링**(정본 복사) — 손편집 금지, sync 스크립트로만. kb.json은 build:kb 생성물(gitignore).

## 새 세션 부팅 (다른 계정/모델 동일)

```bash
npm run verify   # 이 한 줄이 파생물 재생성 + 5게이트 전부 (통과하면 정상)
# 사주: /saju 1993-11-30 08:00 M 순천   |   지식주입: /feed <유튜브URL>
```
