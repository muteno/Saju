// 010-gunghap.knowledge.js — 일주 궁합 판정 규칙 (지식모듈 SSOT)
// 근거: FigJam(운영자 정리본 260712) 궁합 규칙 계승 — 규칙만, 해석 문장 미수록.
//   R1 두 일주의 천간충 AND 지지충 = 나쁜 궁합. R2 일지 육합 = 끌림(좋음). R3 상대 일주가 내 기신 오행 = 불리.
// 008(합충)·001(간지) 표를 소비한다. 반환은 점수+근거 라벨(참고용).

import { branchRelations, CHEONGAN_CHUNG } from './008-hapchung.knowledge.js';

const stemChung = (a, b) => CHEONGAN_CHUNG.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export function gunghapOf(dayA, dayB, myGisinEl = null, otherDayStemEl = null) {
  // dayA/dayB: {stem, branch} (일주). 반환: {score(-2..+2), tags[]}
  const tags = [];
  let score = 0;
  const branchRel = branchRelations(dayA.branch, dayB.branch);
  const hasChung = branchRel.some((r) => r.type === '충');
  const hasYukhap = branchRel.some((r) => r.type === '육합');
  const hasWonjin = branchRel.some((r) => r.type === '원진');

  if (stemChung(dayA.stem, dayB.stem) && hasChung) { score -= 2; tags.push('천간충+지지충(불리)'); }
  else if (hasChung) { score -= 1; tags.push('지지충'); }
  if (hasYukhap) { score += 2; tags.push('일지 육합(끌림)'); }
  if (hasWonjin) { score -= 1; tags.push('원진(예민)'); }
  if (myGisinEl && otherDayStemEl && myGisinEl === otherDayStemEl) { score -= 1; tags.push('상대 일간=내 기신'); }

  const label = score >= 2 ? '좋은 궁합' : score <= -2 ? '주의 궁합' : '보통';
  return { score, label, tags, branchRel };
}

export const GUNGHAP_SOURCE_NOTE =
  'FigJam 궁합 규칙(일주 천간충+지지충=불리, 육합=끌림, 기신 일주=불리) 계승. 규칙 판정만 — 해석 문장·개인 명부는 미수록.';
