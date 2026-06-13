# ⎋ EXIT : MARU — 「탈예울 脫例蔚」

> **전국의 퇴사자를 위로하기 위해, 내가 먼저 퇴사한다.**
> 탈출하라, 무너져 가는 예울마루에서. — *그것은 더 이상 권고가 아니다.*

가상의 영화 **「탈예울」**의 프로모션용 **반응형 피드 웹앱(목업)**.
직장의 한 컷이 **원문**이 되고, 그 옆에 **시(궁서체)**가 선다. 각 장면은 상세에서 **복사**할 수 있습니다.
빌드 스텝 없는 정적 SPA → **Cloudflare Pages** 그대로 배포.

![brand](https://img.shields.io/badge/brand-cobalt%20blue-2f6bff)
![font](https://img.shields.io/badge/본문-Pretendard-1b3fb0)
![poem](https://img.shields.io/badge/시-궁서체-ffcf8a)
![build](https://img.shields.io/badge/build-none%20needed-5ce18a)

## ✨ 구성

- 🎬 **시네마틱 히어로** — 타이틀/로그라인/태그라인 + 포스터 자리
- 📜 **시놉시스 · 태그라인**(궁서체 인용)
- 👥 **이런 당신에게** — 번아웃/사직서 만지작/이미 퇴사 3카드
- 🎞 **장면(SCENE) 피드** — 막(Act) 필터, 카드마다 원문 발췌 + 시 한 줄
- 🪟 **장면 상세 모달** — 원문 + 시 나란히, **각각 복사** + 전체 복사, 이전/다음(←/→·키보드)
- ❓ FAQ · 🎭 엔딩 크레딧 패러디
- 🌗 다크/라이트 · ⬆️ 우하단 스크롤탑 · 토스트

UI/UX 는 **minimum-code.com** 을 계승: 알약 내비/CTA, 큰 라운드 "아일랜드" 밴드, 아이브로우 라벨, 라운드 아이콘 스퀘어, 헤비 디스플레이 타이포 — 코발트 블루 + 시네마틱 다크로 변주.

## 🏗 아키텍처 — 단일 라우터 + 유닛 + 공통 지식

```
js/
  core/                          # 뼈대
    000-convention.core.js       #   파일명/정리 규칙(라우터에 고정)
    001-router.core.js           #   단일 라우터 (view + overlay 2레이어)
  knowledge/                     # 공통 지식 — 모든 유닛이 참조하는 단일 출처
    001-formatters.knowledge.js  #   포맷터 · 헬퍼
    002-brand.knowledge.js       #   브랜드/카피/크레딧/FAQ/이미지 프롬프트
    003-scenes.knowledge.js      #   장면 데이터(원문+시) 스키마+본문
    004-clipboard.knowledge.js   #   복사 + 토스트
    005-ui-kit.knowledge.js      #   아이콘 · 장면 카드 · 섹션 조각
    006-poem-image.knowledge.js  #   시 → 1080×1350 PNG 렌더/다운로드
  units/                         # 기능 — 라우터에 매달림
    001-landing.unit.js          #   원페이지(히어로~크레딧) · view
    002-scene-detail.unit.js     #   장면 상세 모달(원문/시/복사) · overlay
  app.js                         # 부트스트랩: 유닛 등록 + 전역 UI
```

**새 기능 추가**: `units/NNN-xxx.unit.js` 를 규칙대로 만들고 `app.js` 의 `register()` 에 한 줄.

### 파일명 / 코드 규칙 (라우터에 고정)
`000-convention.core.js` 에 상수로 고정 — 인터넷 표준(연구데이터 네이밍·ISO 8601) 근거:
- 형식 `NNN-<kebab-name>.<kind>.js` · `kind ∈ {core, knowledge, unit}`
- **3자리 제로패딩**(`001`) · **ISO 8601**(`YYYY-MM-DD`) · **kebab-case** · 공백 금지
- 단어/하이픈 표기 일관(`scene`, `ui-kit`, `scene-detail` …)

## 🖼 이미지

이미지는 사용자가 직접 생성합니다. 시네마틱 프롬프트 4종을 `002-brand.knowledge.js`의 `IMAGE_PROMPTS` 에 정리해 뒀습니다(메인 포스터 / 스크롤 배경 / 사직서 / 탈출의 순간). 생성 후 히어로의 `.poster` 자리에 끼우면 됩니다.

## ✍️ 콘텐츠/시 파이프라인

시는 추후 **Python 으로 생성**(궁서체 렌더링) 예정 — 현재는 `003-scenes` 의 데이터로 시연합니다. 동일 스키마(`id·date·act·category·title·source·poem·hashtags`)로 채우면 그대로 동작합니다.

## 🚀 로컬 실행

```bash
python3 -m http.server 8080   # 또는: npx serve .
```
→ http://localhost:8080 (ES 모듈이라 정적 서버 필요)

## ☁️ 배포 (Cloudflare Pages)

| 항목 | 값 |
|---|---|
| Framework preset | `None` |
| Build command | *(비움)* |
| Build output directory | `/` |

`_redirects` 가 모든 경로를 `index.html` 로 보내 클라이언트 라우팅을 처리합니다.

---
<sub>EXIT : MARU © 2026 전국퇴사자연합 · 「탈예울(脫例蔚)」 · 그것은 더 이상 권고가 아니다.</sub>
