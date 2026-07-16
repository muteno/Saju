// 신살(神煞) 판정 — 포스텔러 픽스처(1990-01-01 12:00 여, 서울)로 검증된 규칙.
// 12신살: 월·일·시지는 "년지 삼합" 기준, 년지 자신은 "일지 삼합" 기준 (픽스처 역산으로 확정).
// 도화/역마/화개(길성 목록): 포스텔러는 광의 규칙(왕지/생지/고지 글자 자체)을 쓴다 — 기본값 'broad'.
//   고전 규칙(년지·일지 삼합 기준)은 rule:'classic' 옵션으로 제공.

import { HIDDEN_STEMS, twelveStage, sexStem, sexBranch } from './tables.js';

export const TWELVE_SINSAL = ['겁살', '재살', '천살', '지살', '년살', '월살', '망신살', '장성살', '반안살', '역마살', '육해살', '화개살'];

/** 지지 → 삼합 그룹(0신자진 1사유축 2인오술 3해묘미) */
export const samhapGroup = (b) => b % 4;
/** 삼합 그룹 → 왕지 */
export const samhapWangji = (g) => (12 - 3 * g) % 12;

/** 기준지(base) 삼합으로 본 대상지(target)의 12신살 인덱스 */
export function twelveSinsalOf(base, target) {
  const start = (samhapWangji(samhapGroup(base)) + 5) % 12; // 겁살 = 왕지+5
  return (target - start + 12) % 12;
}

const STAGE_BIRTH_IDX = 0; // twelveStage 반환 0 = 장생

/**
 * 사주 4지지의 12신살. 월일시 → 년지 기준, 년지 → 일지 기준 (포스텔러 방식).
 * @param {{year:number,month:number,day:number,hour:number}} pillarsIdx 60갑자 인덱스
 */
export function twelveSinsal(pillarsIdx) {
  const b = {
    year: sexBranch(pillarsIdx.year), month: sexBranch(pillarsIdx.month),
    day: sexBranch(pillarsIdx.day), hour: sexBranch(pillarsIdx.hour),
  };
  return {
    year: TWELVE_SINSAL[twelveSinsalOf(b.day, b.year)],
    month: TWELVE_SINSAL[twelveSinsalOf(b.year, b.month)],
    day: TWELVE_SINSAL[twelveSinsalOf(b.year, b.day)],
    hour: TWELVE_SINSAL[twelveSinsalOf(b.year, b.hour)],
  };
}

// ── 길성·흉살 테이블 (일간/월지 기준) ─────────────────────────
// 인덱스: 천간 0갑…9계, 지지 0자…11해

// 건록지(정록): 갑인 을묘 병사 정오 무사 기오 경신 신유 임해 계자
const GEONROK = [2, 3, 5, 6, 5, 6, 8, 9, 11, 0];
// 양인: 양간만 (갑묘 병오 무오 경유 임자)
const YANGIN = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 };
// 홍염: 갑오 을오 병인 정미 무진 기진 경술 신유 임자 계신 (병→인은 픽스처 검증)
const HONGYEOM = [6, 6, 2, 7, 4, 4, 10, 9, 0, 8];
// 문곡귀인: 갑해 을자 병인 정묘 무인 기묘 경사 신오 임신 계유 (병→인 픽스처 검증)
const MUNGOK = [11, 0, 2, 3, 2, 3, 5, 6, 8, 9];
// 문창귀인: 갑사 을오 병신 정유 무신 기유 경해 신자 임인 계묘
const MUNCHANG = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3];
// 천을귀인: 갑무경→축미, 을기→자신, 병정→해유, 임계→사묘, 신→오인
const CHEONEUL = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [6, 2], [5, 3], [5, 3]];
// 천덕귀인 (월지 기준 → 간 또는 지). 값: {stem} 또는 {branch}
const CHEONDEOK = {
  2: { stem: 3 }, 3: { branch: 8 }, 4: { stem: 8 }, 5: { stem: 7 }, 6: { branch: 11 }, 7: { stem: 0 },
  8: { stem: 9 }, 9: { branch: 2 }, 10: { stem: 2 }, 11: { stem: 1 }, 0: { branch: 5 }, 1: { stem: 6 },
};
// 월덕귀인 (월지 삼합 기준 천간): 인오술→병, 신자진→임, 사유축→경, 해묘미→갑
const WOLDEOK = { 0: 8, 1: 6, 2: 2, 3: 0 };
// 현침살: 천간 갑·신(辛), 지지 묘·오·미·신(申)
const HYEONCHIM_STEM = new Set([0, 7]);
const HYEONCHIM_BRANCH = new Set([3, 6, 7, 8]);

/**
 * 길성·흉살 판정. 반환: { year: [...], month: [...], day: [...], hour: [...] } 각 자리 신살명 배열
 * (천간 유래는 '(간)' 미표기 — 포스텔러처럼 자리 단위로 합침. 필요 시 세분화)
 * @param {object} pillarsIdx 60갑자 인덱스 4주
 * @param {'broad'|'classic'} rule 도화·역마·화개 판정 방식 (기본 broad = 포스텔러)
 */
export function auspicious(pillarsIdx, rule = 'broad') {
  const pos = ['year', 'month', 'day', 'hour'];
  const stems = Object.fromEntries(pos.map((p) => [p, sexStem(pillarsIdx[p])]));
  const branches = Object.fromEntries(pos.map((p) => [p, sexBranch(pillarsIdx[p])]));
  const dayStem = stems.day;
  const out = Object.fromEntries(pos.map((p) => [p, { stem: [], branch: [] }]));

  const classicBase = [branches.year, branches.day];
  // classic 도화 = 삼합 목욕지: 신자진→유, 사유축→오, 인오술→묘, 해묘미→자
  const DOHWA_CLASSIC = { 0: 9, 1: 6, 2: 3, 3: 0 };
  const YEOKMA_CLASSIC = { 0: 2, 1: 11, 2: 8, 3: 5 }; // 삼합 장생지 충: 신자진→인, 사유축→해, 인오술→신, 해묘미→사
  const HWAGAE_CLASSIC = { 0: 4, 1: 1, 2: 10, 3: 7 }; // 고지

  for (const p of pos) {
    const s = stems[p], b = branches[p];
    const S = out[p];
    // 일간 기준 (일주 자신 포함 — 포스텔러도 일지에 표기)
    if (GEONROK[dayStem] === b) S.branch.push('정록');
    if (YANGIN[dayStem] === b) S.branch.push('양인살');
    if (HONGYEOM[dayStem] === b) S.branch.push('홍염살');
    if (MUNGOK[dayStem] === b) S.branch.push('문곡귀인');
    if (MUNCHANG[dayStem] === b) S.branch.push('문창귀인');
    if (CHEONEUL[dayStem].includes(b)) S.branch.push('천을귀인');
    if (twelveStage(dayStem, b) === STAGE_BIRTH_IDX) S.branch.push('학당귀인');
    // 월지 기준
    const cd = CHEONDEOK[branches.month];
    if (cd.stem !== undefined && cd.stem === s) S.stem.push('천덕귀인');
    if (cd.branch !== undefined && cd.branch === b) S.branch.push('천덕귀인');
    if (WOLDEOK[samhapGroup(branches.month)] === s) S.stem.push('월덕귀인');
    // 글자 자체
    if (HYEONCHIM_STEM.has(s)) S.stem.push('현침살');
    if (HYEONCHIM_BRANCH.has(b)) S.branch.push('현침살');
    // 도화·역마·화개
    if (rule === 'broad') {
      if ([0, 3, 6, 9].includes(b)) S.branch.push('도화살'); // 자오묘유(왕지)
      if ([2, 5, 8, 11].includes(b)) S.branch.push('역마살'); // 인신사해(생지)
      if ([1, 4, 7, 10].includes(b)) S.branch.push('화개살'); // 진술축미(고지)
    } else {
      for (const base of classicBase) {
        const g = samhapGroup(base);
        if (DOHWA_CLASSIC[g] === b && !S.branch.includes('도화살')) S.branch.push('도화살');
        if (YEOKMA_CLASSIC[g] === b && !S.branch.includes('역마살')) S.branch.push('역마살');
        if (HWAGAE_CLASSIC[g] === b && !S.branch.includes('화개살')) S.branch.push('화개살');
      }
    }
  }
  return out;
}

/** 공망 — 일주 순중공망. 반환: 지지 인덱스 2개 [b1, b2] */
export function gongmang(dayIdx) {
  const decade = Math.floor(dayIdx / 10); // 0갑자순 … 5갑인순
  const first = (10 - decade * 2 + 12) % 12;
  return [first, (first + 1) % 12];
}
