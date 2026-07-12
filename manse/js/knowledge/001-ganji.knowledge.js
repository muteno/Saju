// 001-ganji.knowledge.js — 천간·지지·오행·음양 원표 (만세력 지식모듈 SSOT)
// 근거: 명리학 공통 원전 통설(연해자평·자평진전 계열). manse.sajuplus.net 표기와 대조 검증(2026-07-12).
// 이 모듈은 "데이터 원표"만 담는다. 계산은 core, 표현은 unit이 맡는다.

export const STEMS = Object.freeze([
  // idx 짝수 = 양간, 홀수 = 음간
  { han: '甲', kor: '갑', el: '목', yang: true },
  { han: '乙', kor: '을', el: '목', yang: false },
  { han: '丙', kor: '병', el: '화', yang: true },
  { han: '丁', kor: '정', el: '화', yang: false },
  { han: '戊', kor: '무', el: '토', yang: true },
  { han: '己', kor: '기', el: '토', yang: false },
  { han: '庚', kor: '경', el: '금', yang: true },
  { han: '辛', kor: '신', el: '금', yang: false },
  { han: '壬', kor: '임', el: '수', yang: true },
  { han: '癸', kor: '계', el: '수', yang: false },
]);

export const BRANCHES = Object.freeze([
  { han: '子', kor: '자', el: '수', yang: true,  hourLabel: '23–01시' },
  { han: '丑', kor: '축', el: '토', yang: false, hourLabel: '01–03시' },
  { han: '寅', kor: '인', el: '목', yang: true,  hourLabel: '03–05시' },
  { han: '卯', kor: '묘', el: '목', yang: false, hourLabel: '05–07시' },
  { han: '辰', kor: '진', el: '토', yang: true,  hourLabel: '07–09시' },
  { han: '巳', kor: '사', el: '화', yang: false, hourLabel: '09–11시' },
  { han: '午', kor: '오', el: '화', yang: true,  hourLabel: '11–13시' },
  { han: '未', kor: '미', el: '토', yang: false, hourLabel: '13–15시' },
  { han: '申', kor: '신', el: '금', yang: true,  hourLabel: '15–17시' },
  { han: '酉', kor: '유', el: '금', yang: false, hourLabel: '17–19시' },
  { han: '戌', kor: '술', el: '토', yang: true,  hourLabel: '19–21시' },
  { han: '亥', kor: '해', el: '수', yang: false, hourLabel: '21–23시' },
]);

// 오행 상생·상극 순환 (목→화→토→금→수→목)
export const ELEMENTS = Object.freeze(['목', '화', '토', '금', '수']);
export const elIdx = (el) => ELEMENTS.indexOf(el);
export const generates = (a, b) => (elIdx(a) + 1) % 5 === elIdx(b); // a가 b를 생
export const controls  = (a, b) => (elIdx(a) + 2) % 5 === elIdx(b); // a가 b를 극

// 60갑자: idx 0=甲子 … 59=癸亥
export const ganjiOf = (idx60) => {
  const i = ((idx60 % 60) + 60) % 60;
  return { stem: i % 10, branch: i % 12, idx: i };
};

// 월지 절기 매핑 순서(입춘=寅월 기점) — 절입 기준 월 경계(절기력)의 정본 순서
export const MONTH_BRANCH_FROM_IPCHUN = Object.freeze([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1]);

// 연간→월간 기두법(오호둔): 甲己→丙寅, 乙庚→戊寅, 丙辛→庚寅, 丁壬→壬寅, 戊癸→甲寅
export const MONTH_STEM_START = Object.freeze({ 0: 2, 1: 4, 2: 6, 3: 8, 4: 0 }); // key = 연간 idx % 5

// 일간→시간 기두법(오서둔): 甲己→甲子시, 乙庚→丙子시, 丙辛→戊子시, 丁壬→庚子시, 戊癸→壬子시
export const HOUR_STEM_START = Object.freeze({ 0: 0, 1: 2, 2: 4, 3: 6, 4: 8 }); // key = 일간 idx % 5

export const GANJI_SOURCE_NOTE =
  '간지·오행·기두법은 연해자평 이래 통용되는 공통 원표로, 유파 간 이견이 없는 확정 지식이다.';
