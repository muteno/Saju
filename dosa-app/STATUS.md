# STATUS — 세션 인수인계 문서 (어느 세션이든 이것부터)

> 갱신: 2026-07-17. **새 세션 부팅 절차는 맨 아래.** 설계 원칙은 `dosa-app/README.md`(절대 원칙 4개 + L4 서술 표준).
> 이 문서는 작업이 진행될 때마다 갱신할 것 — 다음 세션의 유일한 기억이다.

## 완성된 것 (전부 검증 통과 상태)

| 층 | 상태 | 검증 |
|---|---|---|
| L1 만세력 엔진 (`engine/src/`) | ✅ 원국·십신·지장간·십이운성·신살·합충·공망·대운 | 테스트 19건 (`node dosa-app/engine/test/test_manseryeok.mjs`) — 포스텔러 픽스처 완전 일치 |
| L1.5 구조 판정 (`judge.js`) | ✅ 신강신약 110점제(보드 기준)·득령득지득세·조후·오행 편중·십신 체인 | 포스텔러 '신강' 70점 재현 |
| 운 대입 (`unse.js`) | ✅ 임의 날짜 일진 vs 원국(합충·공망 발동), 지지 도래연도 환산 — **일진 다이어리 심장** | 정유일→일지 묘유충 검증 |
| L2 색인 | ✅ unit_index(598키/946유닛) + interaction_index(103키/13,641문단) + impression_index(46키/2,969문단) | 스모크: 키 37개 전부 근거, 문헌없음 0 |
| L2 증류 | ✅ **일주 60/60** + **image 13/19** (`kb/distilled/`) — 인용 205건 축자 검증 / 🔄 천간 이미지 6키(무·기·경·신·임·계) 남음 | `python3 dosa-app/kb-tools/validate_distilled.py` |
| L3 리포트 (`report.js` + `cli/saju_report.mjs`) | ✅ 구조판정→일주(증류 렌더)→십신→합충→신살→대운→세운, 출처 병기 | 데모 리포트 2건 사용자 승인 |
| L4 서술 표준 | ✅ 확정(README) — 일상어→생활장면→시기구체화→대처→▸근거줄. **구현(API 연결)은 미착수** | 사용자 "많이 맞는데?" 피드백 |
| /feed 스킬 | ✅ 유튜브 링크 검수→주입→색인 갱신→보완 보고 (`check_new_video.py`) | 운명전쟁49 영상으로 시연 |

## 진행 중 / 미커밋 위험

- **image/* 증류 19키** — 에이전트 2개가 `kb/distilled/image/` 생성 중이었음. 다음 세션에서:
  `ls dosa-app/kb/distilled/image/ 2>/dev/null` → 있으면 `validate_distilled.py` 통과 확인 후 커밋.
  없으면 재투입: 번들은 `kb/distill_src/ix_image_*.md`(재생성: `prepare_interaction_bundles.py --index impression_index.json image/...`),
  지침은 `DISTILL_GUIDE.md`의 image 섹션.
- PR **#40** (draft) — 증류·엔진 확장 쌓는 중. Cloudflare Pages 체크는 **웹 빌드가 없어 늘 실패(기존 인프라 건, 무시)**.

## 다음 작업 큐 (우선순위 순)

1. image 증류 마무리·커밋 (위)
2. **상호작용 상위 30키 증류** (`prepare_interaction_bundles.py --top 30` → 에이전트 배치) + **통변방법론 28편**(yt_saju.json에서 topics=통변방법론) 증류 → frame/·chain/ 키가 근거 유닛을 갖게 됨
3. **직업→십신 역매핑 사전** (금융=편재, 학문=인성…) — 운명전쟁49 분석에서 도출된 필요. 후속 질문 인텐트 처리용
4. L3 리포트 섹션을 보드 통변 순서로 재정렬(①구조 ②관계 동선 ③일주·요소 ④운) + 상호작용 근거 렌더
5. 귀문 인상론 보강 — 유일한 커버리지 공백. 사용자가 /feed로 영상 주입 예정
6. 일진 다이어리 UI — 엔진은 완성(`diaryDayInfo`), **UI/UX는 사용자가 제공 예정** (main에 유아이볼 영상 2개 올라와 있음)
7. 웹 배포(Cloudflare Pages 연결 살리기) — **증류본만 공개**(원문 장문 발췌는 저작권 부담, 증류+짧은 인용+출처링크 형태) 방침, 최종은 사용자 결정
8. 대운수 반올림 유파 옵션 — 표본 1건(포스텔러 ceil)뿐, 표본 더 모아 보정

## 결정 로그 (왜 이렇게 했나 — 뒤집으려면 사용자 승인)

- 신강신약 = 보드 110점제(천간 각10, 지지 년15·**월30**·일15·시10; 30/45/60 기준) — 유료강의 요약이 1순위 근거
- 12신살 = 월일시지는 년지 삼합 기준, 년지는 일지 기준 (포스텔러 역산 확정)
- 도화·역마·화개 기본 규칙 = broad(왕지/생지/고지 글자) — 포스텔러 방식, classic 옵션 병존
- 일진 = (JDN+49) mod 60, 시주 경계 = 진태양시(경도×4분) 기준, 자시 기본 = 정자시(23시 익일)
- 검색(RAG) 금지 — 키 결정론 조회만. 증류 인용은 축자, 이견은 관점차이 병기 (절대 원칙)
- 운명전쟁49 "병진일" 발언 = 녹화일(04-12) 기준으로 정합 (업로드일 04-26과 혼동 금지)

## 새 세션 부팅 절차 (다른 계정/모델이어도 동일)

```bash
# 1) 파생물 재생성 (gitignore라 새 클론엔 없음 — 필수!)
pip install skyfield  # 절기표 재생성시에만. solar_terms.json은 커밋돼 있어 보통 불필요
python3 dosa-app/kb-tools/extract_bodies.py      # kb/unit_bodies.json (13.5MB) — 조회·검증에 필수
# 2) 건강 확인
node dosa-app/engine/test/test_manseryeok.mjs     # 19건 통과해야 정상
python3 dosa-app/kb-tools/validate_distilled.py   # 증류본 전량 축자 검증
# 3) 리포트 즉시 사용 (또는 /saju 스킬)
node dosa-app/cli/saju_report.mjs 1993-11-30 08:00 M --lon 127.4872 --out report.md
```

- 지식 주입: `/feed <유튜브URL>` (스킬 — 검수→주입→색인 갱신→보완 보고)
- 색인 재생성(주입 후): `yt_filter.py` → `scan_interactions.py` → `scan_impressions.py` (전부 `dosa-app/kb-tools/`)
- 기계산출물(색인 json·유닛 등)은 손편집 금지 — 생성 스크립트를 고쳐 재실행 (저장소 규범)
