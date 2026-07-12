// 009-pattern.knowledge.js — 십신 조합 패턴 판정 (지식모듈 SSOT)
// 근거: 관인상생·살인상생·식상생재·재다신약·군겁쟁재·상관견관·관살혼잡·간여지동 = 명리 공통 패턴명.
//       '트리거 조건'만 기계 판정용으로 인코딩. gloss = 본 프로젝트가 쓴 한 줄 중립 요약(블로그 원문 아님).
// 입력: sipsinCounts(십신명→개수), flags(신강약 등). 반환: 성립 패턴 배열(참고용).

export const PATTERNS = Object.freeze([
  { key: '관인상생', need: (c) => (c.정관 || 0) >= 1 && (c.정인 || 0) >= 1, gloss: '관→인 유통: 명예·학문 지향' },
  { key: '살인상생', need: (c) => (c.편관 || 0) >= 1 && (c.편인 + c.정인 || 0) >= 1, gloss: '편관→인 화살위권: 압박을 배움으로 전환' },
  { key: '식상생재', need: (c) => (c.식신 + c.상관 || 0) >= 1 && (c.편재 + c.정재 || 0) >= 1, gloss: '재주→결실 유통: 생산·수익 구조' },
  { key: '재다신약', need: (c, f) => (c.편재 + c.정재 || 0) >= 3 && f.strength === '신약', gloss: '재성 과다·일간 약: 감당 못 하는 재물' },
  { key: '군겁쟁재', need: (c) => (c.비견 + c.겁재 || 0) >= 3 && (c.편재 + c.정재 || 0) >= 1, gloss: '비겁 무리가 재를 다툼: 분산·경쟁' },
  { key: '상관견관', need: (c) => (c.상관 || 0) >= 1 && (c.정관 || 0) >= 1, gloss: '상관+정관 공존: 규범과 마찰' },
  { key: '관살혼잡', need: (c) => (c.정관 || 0) >= 1 && (c.편관 || 0) >= 1, gloss: '정·편관 혼재: 관성 과중' },
]);

export function detectPatterns(sipsinCounts, flags = {}) {
  return PATTERNS.filter((p) => p.need(sipsinCounts, flags)).map((p) => ({ key: p.key, gloss: p.gloss }));
}

// 간여지동(干與支同): 일간 오행 == 일지(본기) 오행 — 별도 입력 필요
export const isGanyeojidong = (dayStemEl, dayBranchMainEl) => dayStemEl === dayBranchMainEl;

export const PATTERN_SOURCE_NOTE =
  '패턴명·트리거는 명리 공통. gloss는 본 프로젝트 중립 요약(FigJam 내 외부 블로그 인용 문장은 미수록). ' +
  '임계치(재다=재성3+ 등)는 계산용 휴리스틱 — 참고용 라벨과 함께 노출.';
