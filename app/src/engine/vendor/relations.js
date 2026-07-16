// 원국 내 간지 관계 검출 — 천간합·충, 지지 육합·삼합(반합)·방합·충·형·파·해·원진, 공망 대조.
// 표준 교과서 조합표 사용. 어느 자리(년월일시) 사이인지 함께 반환해 L2 지식 조회 키로 쓴다.

import { STEMS, BRANCHES, ELEMENTS, sexStem, sexBranch } from './tables.js';
import { gongmang } from './sinsal.js';

const POS = ['year', 'month', 'day', 'hour'];
const POS_KR = { year: '년', month: '월', day: '일', hour: '시' };

// 천간합: 갑기(토) 을경(금) 병신(수) 정임(목) 무계(화)
const STEM_HAP = [[0, 5, 2], [1, 6, 3], [2, 7, 4], [3, 8, 0], [4, 9, 1]]; // [간a, 간b, 화(化)오행]
// 천간충: 갑경 을신 병임 정계
const STEM_CHUNG = [[0, 6], [1, 7], [2, 8], [3, 9]];
// 지지육합: 자축(토) 인해(목) 묘술(화) 진유(금) 사신(수) 오미(화)
const YUKHAP = [[0, 1, 2], [2, 11, 0], [3, 10, 1], [4, 9, 3], [5, 8, 4], [6, 7, 1]];
// 삼합: [장생, 왕지, 고지, 오행] — 신자진(수) 사유축(금) 인오술(화) 해묘미(목)
const SAMHAP = [[8, 0, 4, 4], [5, 9, 1, 3], [2, 6, 10, 1], [11, 3, 7, 0]];
// 방합: 인묘진(목) 사오미(화) 신유술(금) 해자축(수)
const BANGHAP = [[2, 3, 4, 0], [5, 6, 7, 1], [8, 9, 10, 3], [11, 0, 1, 4]];
// 지지충: 자오 축미 인신 묘유 진술 사해
const CHUNG = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
// 형: 인사신·축술미 삼형, 자묘 상형, 진오유해 자형
const SAMHYEONG = [[2, 5, 8], [1, 10, 7]];
const SANGHYEONG = [[0, 3]];
const JAHYEONG = [4, 6, 9, 11];
// 파: 자유 축진 인해 묘오 사신 술미
const PA = [[0, 9], [1, 4], [2, 11], [3, 6], [5, 8], [10, 7]];
// 해: 자미 축오 인사 묘진 신해 유술
const HAE = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
// 원진: 자미 축오 인유 묘신 진해 사술
const WONJIN = [[0, 7], [1, 6], [2, 9], [3, 8], [4, 11], [5, 10]];

const pairKey = (a, b) => (a < b ? [a, b] : [b, a]).join(',');

/**
 * 원국 관계 검출.
 * @param {{year:number,month:number,day:number,hour:number}} pillarsIdx 60갑자 인덱스
 * @returns {{stemHap:[], stemChung:[], yukhap:[], samhap:[], banghap:[], chung:[], hyeong:[], pa:[], hae:[], wonjin:[], gongmangHit:[]}}
 *   각 항목: { name, positions: ['월','시'], ... }
 */
export function detectRelations(pillarsIdx) {
  const stems = POS.map((p) => sexStem(pillarsIdx[p]));
  const branches = POS.map((p) => sexBranch(pillarsIdx[p]));
  const R = { stemHap: [], stemChung: [], yukhap: [], samhap: [], banghap: [], chung: [], hyeong: [], pa: [], hae: [], wonjin: [], gongmangHit: [] };

  // 쌍(pair) 관계 — 자리 조합 전수(4C2=6) 검사
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const posPair = [POS_KR[POS[i]], POS_KR[POS[j]]];
      const sk = pairKey(stems[i], stems[j]);
      for (const [a, b, el] of STEM_HAP) {
        if (pairKey(a, b) === sk) R.stemHap.push({ name: `${STEMS[a]}${STEMS[b]}합(${ELEMENTS[el]})`, positions: posPair });
      }
      for (const [a, b] of STEM_CHUNG) {
        if (pairKey(a, b) === sk) R.stemChung.push({ name: `${STEMS[a]}${STEMS[b]}충`, positions: posPair });
      }
      const bk = pairKey(branches[i], branches[j]);
      for (const [a, b, el] of YUKHAP) if (pairKey(a, b) === bk) R.yukhap.push({ name: `${BRANCHES[a]}${BRANCHES[b]}합(${ELEMENTS[el]})`, positions: posPair });
      for (const [a, b] of CHUNG) if (pairKey(a, b) === bk) R.chung.push({ name: `${BRANCHES[a]}${BRANCHES[b]}충`, positions: posPair });
      for (const [a, b] of PA) if (pairKey(a, b) === bk) R.pa.push({ name: `${BRANCHES[a]}${BRANCHES[b]}파`, positions: posPair });
      for (const [a, b] of HAE) if (pairKey(a, b) === bk) R.hae.push({ name: `${BRANCHES[a]}${BRANCHES[b]}해`, positions: posPair });
      for (const [a, b] of WONJIN) if (pairKey(a, b) === bk) R.wonjin.push({ name: `${BRANCHES[a]}${BRANCHES[b]}원진`, positions: posPair });
      for (const [a, b] of SANGHYEONG) if (pairKey(a, b) === bk) R.hyeong.push({ name: `${BRANCHES[a]}${BRANCHES[b]}형`, positions: posPair });
      if (branches[i] === branches[j] && JAHYEONG.includes(branches[i])) {
        R.hyeong.push({ name: `${BRANCHES[branches[i]]}${BRANCHES[branches[i]]}자형`, positions: posPair });
      }
    }
  }

  // 삼합·방합 — 3자 완합 / 2자 부분합(삼합은 왕지 포함 시만 반합 인정)
  const have = branches.map((b, i) => ({ b, pos: POS_KR[POS[i]] }));
  for (const [saeng, wang, go, el] of SAMHAP) {
    const found = [saeng, wang, go].map((x) => have.filter((h) => h.b === x));
    const names = (xs) => xs.map((h) => h.pos);
    if (found[0].length && found[1].length && found[2].length) {
      R.samhap.push({ name: `${BRANCHES[saeng]}${BRANCHES[wang]}${BRANCHES[go]}삼합(${ELEMENTS[el]})`, positions: [...names(found[0]), ...names(found[1]), ...names(found[2])] });
    } else if (found[1].length) {
      for (const other of [found[0], found[2]]) {
        if (other.length) {
          const pair = [other[0].b, wang].sort((x, y) => x - y);
          R.samhap.push({ name: `${BRANCHES[pair[0]]}${BRANCHES[pair[1]]}반합(${ELEMENTS[el]})`, positions: [...names(found[1]), ...names(other)], half: true });
        }
      }
    }
  }
  for (const [a, b, c, el] of BANGHAP) {
    const fa = have.filter((h) => h.b === a), fb = have.filter((h) => h.b === b), fc = have.filter((h) => h.b === c);
    if (fa.length && fb.length && fc.length) {
      R.banghap.push({ name: `${BRANCHES[a]}${BRANCHES[b]}${BRANCHES[c]}방합(${ELEMENTS[el]})`, positions: [...fa, ...fb, ...fc].map((h) => h.pos) });
    }
  }

  // 삼형 (3자 완형 / 2자 부분형)
  for (const tri of SAMHYEONG) {
    const found = tri.map((x) => have.filter((h) => h.b === x));
    const present = found.filter((f) => f.length);
    if (present.length === 3) {
      R.hyeong.push({ name: `${tri.map((x) => BRANCHES[x]).join('')}삼형`, positions: found.flat().map((h) => h.pos) });
    } else if (present.length === 2) {
      const pair = present.map((f) => f[0].b);
      R.hyeong.push({ name: `${BRANCHES[pair[0]]}${BRANCHES[pair[1]]}형`, positions: present.flat().map((h) => h.pos), partial: true });
    }
  }

  // 공망 대조 — 일주 순중공망 지지가 원국에 있는지
  const [g1, g2] = gongmang(pillarsIdx.day);
  for (const h of have) {
    if (h.b === g1 || h.b === g2) R.gongmangHit.push({ name: `${BRANCHES[h.b]} 공망`, positions: [h.pos] });
  }
  R.gongmangBranches = [BRANCHES[g1], BRANCHES[g2]];

  return R;
}
