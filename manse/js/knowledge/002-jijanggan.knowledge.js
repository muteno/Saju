// 002-jijanggan.knowledge.js — 지장간(支藏干) 원표 (만세력 지식모듈 SSOT)
// 근거: 월률분야 통설표(연해자평·명리정종 계열). 유파별 미세 이견(申의 여기 戊/己 등)은 주류 표기를 채택.
// role: 여기(餘氣)·중기(中氣)·본기(本氣). 본기 = 배열 마지막 원소로 고정(계산 계약).

export const JIJANGGAN = Object.freeze({
  子: [{ stem: '壬', role: '여기' }, { stem: '癸', role: '본기' }],
  丑: [{ stem: '癸', role: '여기' }, { stem: '辛', role: '중기' }, { stem: '己', role: '본기' }],
  寅: [{ stem: '戊', role: '여기' }, { stem: '丙', role: '중기' }, { stem: '甲', role: '본기' }],
  卯: [{ stem: '甲', role: '여기' }, { stem: '乙', role: '본기' }],
  辰: [{ stem: '乙', role: '여기' }, { stem: '癸', role: '중기' }, { stem: '戊', role: '본기' }],
  巳: [{ stem: '戊', role: '여기' }, { stem: '庚', role: '중기' }, { stem: '丙', role: '본기' }],
  午: [{ stem: '丙', role: '여기' }, { stem: '己', role: '중기' }, { stem: '丁', role: '본기' }],
  未: [{ stem: '丁', role: '여기' }, { stem: '乙', role: '중기' }, { stem: '己', role: '본기' }],
  申: [{ stem: '戊', role: '여기' }, { stem: '壬', role: '중기' }, { stem: '庚', role: '본기' }],
  酉: [{ stem: '庚', role: '여기' }, { stem: '辛', role: '본기' }],
  戌: [{ stem: '辛', role: '여기' }, { stem: '丁', role: '중기' }, { stem: '戊', role: '본기' }],
  亥: [{ stem: '戊', role: '여기' }, { stem: '甲', role: '중기' }, { stem: '壬', role: '본기' }],
});

// 본기 천간만 뽑는 헬퍼(십신·신강약 판정의 기본 입력)
export const mainStemOf = (branchHan) => {
  const list = JIJANGGAN[branchHan];
  return list ? list[list.length - 1].stem : null;
};

export const JIJANGGAN_SOURCE_NOTE =
  '지장간은 월률분야 주류 표기를 따랐다. 申 여기를 己로 쓰는 소수설 등 유파 이견은 각주로만 남기고 본표는 통설로 고정.';
