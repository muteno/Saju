// L1 → L2 브리지: 차트에서 지식 베이스 조회 키셋을 결정론적으로 방출.
// 이 목록이 곧 "사주 데이터가 찾은 자료 목록"이다 (검색 아님 — 절대 원칙 2).

import { sexStem, sexBranch, sexName, STEMS, BRANCHES } from './tables.js';
import { twelveSinsal, auspicious } from './sinsal.js';
import { detectRelations } from './relations.js';
import { judgeStructure } from './judge.js';

/**
 * @param {object} chart computeChart() 결과
 * @param {object} opts { unseYearName?: '병오' — 올해 사주 년간지(세운 조회용) }
 * @returns {{keys: string[], byTopic: object, relations: object}} keys는 중복 제거·순서 보존
 */
export function chartToKeys(chart, opts = {}) {
  const p = chart.pillarsIdx;
  const pos = ['year', 'month', 'day', 'hour'];
  const seen = new Set();
  const keys = [];
  const put = (k) => { if (!seen.has(k)) { seen.add(k); keys.push(k); } };
  const byTopic = { frame: [], ilju: [], ganji: [], sipsin: [], sibiunseong: [], sinsal: [], hapchung: [], unse: [] };

  // 0) 구조 판정 (통변 순서상 최우선 — 신강신약·조후·부재·체인)
  const judge = judgeStructure(chart);
  for (const k of judge.keys) { put(k); byTopic.frame.push(k); }

  // 일주 (해석의 중심)
  const ilju = `ilju/${sexName(p.day)}`;
  put(ilju); byTopic.ilju.push(ilju);

  // 천간·지지 개별
  for (const q of pos) {
    const k1 = `cheongan/${STEMS[sexStem(p[q])]}`;
    const k2 = `jiji/${BRANCHES[sexBranch(p[q])]}`;
    put(k1); put(k2); byTopic.ganji.push(k1, k2);
  }

  // 십신 (천간 + 지지 본기, 일간 제외)
  for (const q of pos) {
    const d = chart.saju[q];
    if (d.stemTenGod && d.stemTenGod !== '일간') { const k = `sipsin/${d.stemTenGod}`; put(k); byTopic.sipsin.push(k); }
    if (d.branchTenGod) { const k = `sipsin/${d.branchTenGod}`; put(k); byTopic.sipsin.push(k); }
  }

  // 십이운성
  for (const q of pos) { const k = `sibiunseong/${chart.saju[q].twelveStage}`; put(k); byTopic.sibiunseong.push(k); }

  // 신살: 12신살 + 길성·흉살
  const ts = twelveSinsal(p);
  for (const q of pos) { const k = `sinsal/${ts[q]}`; put(k); byTopic.sinsal.push(k); }
  const au = auspicious(p);
  for (const q of pos) {
    for (const name of [...au[q].stem, ...au[q].branch]) { const k = `sinsal/${name}`; put(k); byTopic.sinsal.push(k); }
  }

  // 합충 (종류 키 + 상세명은 relations로 전달)
  const rel = detectRelations(p);
  const relKinds = [
    ['stemHap', '합'], ['stemChung', '충'], ['yukhap', '육합'], ['samhap', '삼합'], ['banghap', '방합'],
    ['chung', '충'], ['hyeong', '형'], ['pa', '파'], ['hae', '해'], ['wonjin', '원진'],
  ];
  for (const [field, kind] of relKinds) {
    if (rel[field].length) { const k = `hapchung/${kind}`; put(k); byTopic.hapchung.push(k); }
  }
  if (rel.gongmangHit.length) { const k = 'sinsal/공망'; put(k); byTopic.sinsal.push(k); }

  // 세운 (올해 운세 문서)
  if (opts.unseYearName) {
    const k1 = `unse/${opts.unseYearName}/ilju/${sexName(p.day)}`;
    const k2 = `unse/${opts.unseYearName}/general`;
    put(k1); put(k2); byTopic.unse.push(k1, k2);
  }

  return { keys, byTopic, relations: rel, judge };
}
