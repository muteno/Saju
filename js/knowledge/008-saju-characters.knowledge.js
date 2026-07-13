// =========================================================
// knowledge/008-saju-characters.knowledge.js
// 공통 지식 — 십이지(十二支) 캐릭터 SSOT + '직장운' 콘텐츠.
//   12지 × 계절 오방색(봄靑·여름赤·가을白·겨울黑) 마스코트.
//   이미지 = assets/images/characters/NNN-<animal>.webp (투명, Gemini 생성→컷아웃).
//   톤 = 직장운 한 꼭지(재미용) — 드라이 위트 + 위로. 사주 전체 주제 아님.
// =========================================================

/**
 * 각 항목:
 *  id        3자리 파일 넘버(계절 순) · en 파일 슬러그
 *  branch    지지 한자 · branchIndex 0=子…11=亥 (생년 계산용)
 *  season/dir/element  계절·방위·본기 오행 · color 계절 오방색 HEX
 *  traits    성격 키워드 · line 직장운 한 줄
 *  work      직장운 본문(드라이 위트 + 위로)
 */
export const ZODIAC = Object.freeze([
  { id: "001", branch: "寅", branchIndex: 2, animal: "호랑이", en: "tiger",
    season: "봄", seasonHanja: "春", dir: "동(東)", element: "목(木)", color: "#3fb27f",
    traits: ["용맹", "자존심", "추진력"], line: "먼저 움직여야 풀리는 격",
    work: "회의실에서 제일 먼저 손드는 그 기질, 사주에선 리더의 격이라 적는다. 눈치 보며 묵히면 오히려 꼬여 — 올해 직장운은 먼저 치고 나갈 때 열린다. 단, 서류는 두 번 읽고." },
  { id: "002", branch: "卯", branchIndex: 3, animal: "토끼", en: "rabbit",
    season: "봄", seasonHanja: "春", dir: "동(東)", element: "목(木)", color: "#8fe0b0",
    traits: ["다정", "감수성", "직관"], line: "촉이 재산인 직장운",
    work: "분위기 싸해지는 걸 제일 먼저 아는 사람. 그 촉은 겁이 아니라 선견(先見)이야. 팀의 리스크를 먼저 읽는 눈 — 직장운의 핵심 자산이니 무시당해도 기록해 둬. 나중에 다 네 말대로 된다." },
  { id: "003", branch: "辰", branchIndex: 4, animal: "용", en: "dragon",
    season: "봄", seasonHanja: "春", dir: "동남", element: "토(土)", color: "#2fa06a",
    traits: ["이상", "카리스마", "독자성"], line: "판이 커져야 사는 승천수",
    work: "지금 책상이 좁게 느껴진다면 정상이야 — 원래 그릇이 커서 그래. 작은 일에 갇히면 운도 갇힌다. 직장운은 큰 판(신사업·새 프로젝트)에 붙을 때 승천수로 바뀐다." },
  { id: "004", branch: "巳", branchIndex: 5, animal: "뱀", en: "snake",
    season: "여름", seasonHanja: "夏", dir: "남(南)", element: "화(火)", color: "#f0596b",
    traits: ["지혜", "통찰", "냉정"], line: "조용히 이기는 통찰형",
    work: "말수 적다고 존재감 없는 게 아니야. 남들이 소리 지를 때 판을 읽고 있었잖아. 직장운은 문서·데이터·근거로 이기는 흐름 — 회의에서 마지막에 한 문장만 얹어. 그게 결정타가 된다." },
  { id: "005", branch: "午", branchIndex: 6, animal: "말", en: "horse",
    season: "여름", seasonHanja: "夏", dir: "남(南)", element: "화(火)", color: "#ee4d3d",
    traits: ["열정", "자유", "활동"], line: "역마 — 움직여야 도는 운",
    work: "책상에 하루 종일 묶이면 운도 같이 묶이는 역마(驛馬) 기질. 외근·출장·새 채널처럼 움직이는 일에 붙어야 성과가 돈다. 제자리걸음이 길어지면 몸이 근질거리는 게 당연한 거야." },
  { id: "006", branch: "未", branchIndex: 7, animal: "양", en: "sheep",
    season: "여름", seasonHanja: "夏", dir: "남서", element: "토(土)", color: "#f5897f",
    traits: ["온화", "예술", "배려"], line: "이제 네 몫 챙길 차례",
    work: "남 일 받아주다 정작 네 성과 정리는 뒷전이지. 착한 게 죄가 되는 판이면 판이 이상한 거다. 올해 직장운의 숙제는 하나 — 한 일을 '보이게' 만들기. 성과 정리도 업무다." },
  { id: "007", branch: "申", branchIndex: 8, animal: "원숭이", en: "monkey",
    season: "가을", seasonHanja: "秋", dir: "서(西)", element: "금(金)", color: "#e9edf3",
    traits: ["재치", "영리", "손재주"], line: "재주가 자리를 앞서는 형",
    work: "잔머리라 구박받던 그 재주, 옆 부서에선 '기획력'이라 부른다. 손이 빠르고 요령이 좋으니 일이 몰리는 건 숙명 — 대신 '아무거나 다 하는 사람'이 되지 말고 대표 기술 하나에 이름을 붙여. 그게 직장운의 승부수다." },
  { id: "008", branch: "酉", branchIndex: 9, animal: "닭", en: "rooster",
    season: "가을", seasonHanja: "秋", dir: "서(西)", element: "금(金)", color: "#efe7d3",
    traits: ["정확", "자부심", "부지런"], line: "디테일이 무기, 소모는 금물",
    work: "남들 놓친 오탈자까지 보이는 눈 — 직장운의 무기는 정확함이야. 근데 그 부지런을 남의 아침 깨우는 데만 쓰지 마. 체크리스트의 반은 네 커리어 항목으로 채워. 새벽은 네 것부터." },
  { id: "009", branch: "戌", branchIndex: 10, animal: "개", en: "dog",
    season: "가을", seasonHanja: "秋", dir: "서북", element: "토(土)", color: "#dcd5c6",
    traits: ["의리", "정직", "헌신"], line: "신뢰 자본이 쌓이는 운",
    work: "한 번 맡으면 끝까지 지키는 사람. 그 의리는 회사에서 가장 늦게 발견되고 가장 오래 가는 자본이다. 다만 등불을 남의 대문에만 걸지 말 것 — 네 앞길에도 하나 걸어둬. 승진운은 신뢰가 쌓인 뒤 몰아서 온다." },
  { id: "010", branch: "亥", branchIndex: 11, animal: "돼지", en: "pig",
    season: "겨울", seasonHanja: "冬", dir: "북(北)", element: "수(水)", color: "#5a5aa8",
    traits: ["넉넉", "진솔", "복(福)"], line: "식록 — 사람이 곧 재물운",
    work: "밥 잘 사고 정 잘 주는 그 씀씀이, 낭비가 아니라 식록(食祿)이야. 네 직장운은 사람을 타고 들어온다 — 소개·추천·평판. 다만 복주머니 끈은 네가 쥐고 있어. 퍼주기만 하고 굶지 말기." },
  { id: "011", branch: "子", branchIndex: 0, animal: "쥐", en: "rat",
    season: "겨울", seasonHanja: "冬", dir: "북(北)", element: "수(水)", color: "#4a5bd6",
    traits: ["기민", "눈치", "저축"], line: "눈치 = 생존지(生存智)",
    work: "조직 개편 냄새를 제일 먼저 맡는 코. '약다' 소리 듣던 그 눈치가 사주에선 생존지(生存智)다. 정보가 모이는 자리(회의록·공유방)를 놓치지 마 — 네 직장운은 반 발 먼저 아는 데서 나온다." },
  { id: "012", branch: "丑", branchIndex: 1, animal: "소", en: "ox",
    season: "겨울", seasonHanja: "冬", dir: "북동", element: "토(土)", color: "#3f4a7a",
    traits: ["우직", "성실", "인내"], line: "밭을 고르는 축적운",
    work: "티 안 나는 일을 제일 오래 하는 사람 — 근데 사주는 그걸 축적운이라 부른다. 남들 단타 칠 때 너는 밭을 갈고 있는 거야. 대신 '버티는 게 미덕'이라는 남의 계산법에 네 어깨를 다 내주진 말 것. 멍에는 벗을 줄도 알아야 소다." },
]);

/** 파일 경로(투명 webp) */
export const zodiacImg = (z) => `/assets/images/characters/${z.id}-${z.en}.webp`;

/** 생년(양력) → 띠. 절기(입춘) 미반영 — 재미용 콘텐츠. */
export function zodiacOfYear(year) {
  const y = Number(year);
  if (!Number.isFinite(y) || y < 1000) return null;
  const idx = ((y - 4) % 12 + 12) % 12; // 0=子…11=亥
  return ZODIAC.find((z) => z.branchIndex === idx) || null;
}
