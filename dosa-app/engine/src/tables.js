// 명리 기초 상수 테이블 — 포스텔러 픽스처(1990-01-01 12:00 여, 서울)로 검증됨.
// 인덱스 규약: 천간 0=갑 … 9=계, 지지 0=자 … 11=해, 60갑자 0=갑자 … 59=계해.

export const STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
export const STEMS_HANJA = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
export const BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
export const BRANCHES_HANJA = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 오행: 0목 1화 2토 3금 4수
export const ELEMENTS = ['목', '화', '토', '금', '수'];
export const STEM_ELEMENT = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]; // 갑을목 병정화 무기토 경신금 임계수
export const BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4]; // 자수 축토 인묘목 진토 사오화 미토 신유금 술토 해수
// 음양: 천간/지지 짝수 인덱스=양. (지지는 체용 구분 유파가 있으나 십성 판정은 지장간 본기 기준이라 영향 없음)
export const stemYang = (s) => s % 2 === 0;

// 지장간 (여기→본기 순, 마지막 원소가 본기)
export const HIDDEN_STEMS = [
  [8, 9],       // 자: 임 계
  [9, 7, 5],    // 축: 계 신 기
  [4, 2, 0],    // 인: 무 병 갑
  [0, 1],       // 묘: 갑 을
  [1, 9, 4],    // 진: 을 계 무
  [4, 6, 2],    // 사: 무 경 병
  [2, 5, 3],    // 오: 병 기 정
  [3, 1, 5],    // 미: 정 을 기
  [4, 8, 6],    // 신: 무 임 경
  [6, 7],       // 유: 경 신
  [7, 3, 4],    // 술: 신 정 무
  [4, 0, 8],    // 해: 무 갑 임
];

export const TEN_GODS = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];

/** 일간(me) 기준 상대 천간(other)의 십신. 반환: TEN_GODS 인덱스 */
export function tenGod(me, other) {
  const em = STEM_ELEMENT[me], eo = STEM_ELEMENT[other];
  const samePol = stemYang(me) === stemYang(other);
  const rel = (eo - em + 5) % 5; // 0 동오행, 1 내가 생, 2 내가 극, 3 나를 극, 4 나를 생
  const base = [0, 2, 4, 6, 8][rel];
  // 비견/식신/편재/편관/편인 = 같은 극성, 겁재/상관/정재/정관/정인 = 다른 극성
  return base + (samePol ? 0 : 1);
}

export const TWELVE_STAGES = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'];
// 일간별 장생 지지: 갑→해, 을→오, 병→인, 정→유, 무→인, 기→유, 경→사, 신→자, 임→신, 계→묘
const STAGE_BIRTH = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];

/** 일간 stem 기준 지지 branch의 십이운성. 양간 순행, 음간 역행. */
export function twelveStage(stem, branch) {
  const start = STAGE_BIRTH[stem];
  const diff = stemYang(stem) ? (branch - start + 12) % 12 : (start - branch + 12) % 12;
  return diff; // TWELVE_STAGES 인덱스
}

/** 60갑자 인덱스 → {stem, branch} */
export const sexStem = (i) => i % 10;
export const sexBranch = (i) => i % 12;
export const sexName = (i) => STEMS[i % 10] + BRANCHES[i % 12];
/** stem, branch → 60갑자 인덱스 (존재하지 않는 조합이면 -1) */
export function sexIndex(stem, branch) {
  for (let i = stem; i < 60; i += 10) if (i % 12 === branch) return i;
  return -1;
}

// 절기: k = 태양황경/15 (0=춘분 … 23=경칩). 홀수 k = 절(節, 월 경계).
export const TERM_NAMES = ['춘분', '청명', '곡우', '입하', '소만', '망종', '하지', '소서', '대서', '입추', '처서', '백로', '추분', '한로', '상강', '입동', '소설', '대설', '동지', '소한', '대한', '입춘', '우수', '경칩'];
export const K_IPCHUN = 21;
/** 절(홀수 k) → 월지 인덱스: 입춘→인(2), 경칩→묘(3), …, 소한→축(1) */
export const monthBranchOfTerm = (k) => ((k - K_IPCHUN) / 2 + 2 + 12 * 3) % 12;
