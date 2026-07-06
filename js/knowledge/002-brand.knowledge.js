// =========================================================
// knowledge/002-brand.knowledge.js
// 공통 지식 — EXIT : MARU 브랜드/카피의 단일 출처.
//   영화 「탈예울(脫例蔚)」 프로모션 톤. 모든 unit 이 참조.
// =========================================================

export const BRAND = Object.freeze({
  titleKo: "탈예울",
  titleHanja: "脫例蔚",
  titleRoman: "TAL-YEUL",
  appName: "EXIT : MARU",
  subtitle: "탈출하라, 무너져 가는 예울마루에서",
  logline: "전국의 퇴사자를 위로하기 위해, 내가 먼저 퇴사한다.",
  taglines: [
    "그것은 더 이상 권고가 아니다.",
    "사직(辭職)이 아니라 탈출(脫出)이다.",
    "무너져 가는 예울마루에서, 가장 먼저 문을 연 사람.",
    "오늘, 당신의 자리는 비어 있어도 괜찮다.",
  ],
  synopsis:
    "모두가 버티는 것을 미덕이라 부르던 시절, 한 사람이 조용히 사직서를 꺼냈다. " +
    "무너져 가는 예울마루 빌딩, 그 18층 사무실에서 시작된 작은 균열은 곧 전국으로 번진다. " +
    "그는 영웅이 되려던 것이 아니었다 — 다만 가장 먼저 문을 열었을 뿐. " +
    "「탈예울」, 그것은 더 이상 권고가 아니라 선언이다.",
  release: {
    main: "전국 동시 퇴사 — COMING SOON",
    sub: "예매 불가. 좌석은 당신이 비우는 그 자리뿐.",
    rating: "12세 관람가 · 러닝타임: 당신의 남은 근속연수",
  },
});

export const CTA = Object.freeze({
  primary: "지금 탈출하기",
  trailer: "예고편 보기",
  resign: "사직서 미리보기",
});

export const AUDIENCE = Object.freeze([
  {
    icon: "battery",
    title: "번아웃 직장인",
    desc: "월요일이 일요일 밤부터 시작되는 당신. 열정은 진작 소진됐지만 관성으로 출근 도장을 찍고 있다면, 이 영화의 1막은 당신의 이야기입니다.",
  },
  {
    icon: "draft",
    title: "사직서를 만지작거리는 사람",
    desc: "쓰지도, 버리지도 못한 사직서가 서랍 어딘가에 있나요. 당신은 이미 2막을 살고 있습니다. 필요한 건 용기가 아니라, 첫 문장뿐입니다.",
  },
  {
    icon: "exit",
    title: "이미 퇴사한 사람",
    desc: "당신은 엔딩 크레딧을 본 사람입니다. 잘했습니다, 정말로. 이 영화는 당신을 위한 헌사이자, 다음 사람을 위한 등불입니다.",
  },
]);

export const FAQ = Object.freeze([
  { q: "이 영화, 실화인가요?", a: "전국 어딘가에서 매일 상영 중인 다큐멘터리입니다. 주연만 매번 바뀔 뿐입니다." },
  { q: "예매는 어떻게 하나요?", a: "예매는 불가능합니다. 좌석은 오직 당신이 책상을 비우는 그 자리 하나뿐입니다." },
  { q: "해피엔딩인가요?", a: "엔딩은 당신이 직접 씁니다. 다만 한 가지는 약속드립니다 — 문은, 언제나 안에서 열립니다." },
  { q: "앱으로도 볼 수 있나요?", a: "네. 탈출구는 가까이 둘수록 좋으니까요. 컴퓨터·안드로이드 크롬(엣지)에서는 상단의 다운로드 버튼이나 주소창 오른쪽 설치 아이콘을 누르면 바탕화면·홈 화면에 바로가기가 생깁니다. 아이폰 사파리는 공유 버튼 → '홈 화면에 추가'를 누르면 됩니다." },
]);

export const FOOTER =
  "EXIT : MARU © 2026 전국퇴사자연합 · 「탈예울(脫例蔚)」 · 그것은 더 이상 권고가 아니다.";

// 사용자가 직접 생성할 이미지용 프롬프트 (영어, 시네마틱)
export const IMAGE_PROMPTS = Object.freeze([
  {
    use: "히어로 메인 포스터",
    prompt:
      "Cinematic movie poster, a lone office worker in a wrinkled suit standing at the threshold of a glowing emergency exit, backlit by warm golden light pouring in, while a vast dark cobalt-blue office of empty desks stretches behind in shadow. Dramatic chiaroscuro lighting, 35mm film grain, anamorphic lens flare, epic and solemn yet hopeful mood, teal-and-orange contrast, volumetric god rays, vertical poster composition with empty space at top for title typography. Highly detailed, photorealistic, dystopian corporate aesthetic.",
  },
  {
    use: "스크롤 배경 텍스처",
    prompt:
      "Atmospheric wide shot of a crumbling modern office tower at night, half the windows dark and one single window glowing cold blue on the 18th floor, deep cobalt-blue and midnight tones, faint fog and rain, distant city lights bokeh, melancholic cinematic stillness, 35mm film texture, muted desaturated palette, moody noir lighting, ultra-wide aspect ratio.",
  },
  {
    use: "장면 카드 — 사직서",
    prompt:
      "Extreme close-up of a hand placing a single white resignation letter on an empty dark wooden desk, a brass employee ID badge lying beside it, dramatic single-source light from a window casting long shadows, dust particles floating in the beam, deep cobalt-blue shadows and warm highlight, 35mm macro film photography, solemn and liberating mood, shallow depth of field, cinematic color grading.",
  },
  {
    use: "엔딩 / CTA — 탈출의 순간",
    prompt:
      "An office worker walking out of a glass lobby into blinding morning sunlight, seen from behind as a silhouette, briefcase abandoned on the floor behind them, the dark cold office contrasting with the warm bright outside world, lens flare and golden hour glow, sense of release and freedom and rebirth, 35mm cinematic film still, epic and emotional, cobalt-blue interior fading into warm exterior light, vertical composition, photorealistic.",
  },
]);

// 막(Act) 필터에 사용
export const ACTS = Object.freeze(["전체", "1막", "2막", "3막"]);
