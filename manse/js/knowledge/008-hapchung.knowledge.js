// 008-hapchung.knowledge.js — 천간·지지 합충형파해·원진 관계 규칙 (지식모듈 SSOT)
// 근거: 지지 삼합·방합·육합·충·형·파·해·원진, 천간 합·충은 명리학 공통 확정표(유파 무관).
//       강도 서열/궁합 작용 규칙은 FigJam(운영자 정리본, 260712)에서 계승 — 출처 라벨만, 원문 문장 미수록.
// idx 규약: STEMS/BRANCHES 인덱스(001-ganji). 지지 0=子 … 11=亥.

// ── 천간 ──
export const CHEONGAN_HAP = Object.freeze([ // [a,b,합화오행]
  [0, 5, '토'], [1, 6, '금'], [2, 7, '수'], [3, 8, '목'], [4, 9, '화'],
]);
export const CHEONGAN_CHUNG = Object.freeze([[0, 6], [1, 7], [2, 8], [3, 9]]); // 戊己(4,5)는 충 없음(중앙토)

// ── 지지 육합(六合) [a,b,합화오행] ── 午未 합화는 유파차(화/토) → note 참조, 표는 '화'
export const YUKHAP = Object.freeze([
  [0, 1, '토'], [2, 11, '목'], [3, 10, '화'], [4, 9, '금'], [5, 8, '수'], [6, 7, '화'],
]);
// 삼합국(三合) — 생지·왕지·고지 3지 → 국(局)
export const SAMHAP = Object.freeze([
  { branches: [8, 0, 4], el: '수' }, { branches: [2, 6, 10], el: '화' },
  { branches: [5, 9, 1], el: '금' }, { branches: [11, 3, 7], el: '목' },
]);
// 방합(方合) — 계절 3지
export const BANGHAP = Object.freeze([
  { branches: [2, 3, 4], el: '목' }, { branches: [5, 6, 7], el: '화' },
  { branches: [8, 9, 10], el: '금' }, { branches: [11, 0, 1], el: '수' },
]);
export const YUKCHUNG = Object.freeze([[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]]); // 지지 충(+6 대충)
export const HYEONG = Object.freeze({
  삼형: [[2, 5, 8], [1, 10, 7]], 상형: [[0, 3]], 자형: [4, 6, 9, 11],
});
export const PA = Object.freeze([[0, 9], [1, 4], [2, 11], [3, 6], [5, 8], [7, 10]]);
export const HAE = Object.freeze([[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]]);
export const WONJIN = Object.freeze([[0, 7], [1, 6], [2, 9], [3, 8], [4, 11], [5, 10]]);

const hasPair = (list, a, b) => list.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

// 두 지지의 모든 관계를 배열로 반환(복수 가능: 예 巳申 = 육합+형+파)
export function branchRelations(a, b) {
  const rel = [];
  const yh = YUKHAP.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  if (yh) rel.push({ type: '육합', el: yh[2] });
  for (const s of SAMHAP) {
    if (a !== b && s.branches.includes(a) && s.branches.includes(b))
      rel.push({ type: isWangji(a) || isWangji(b) ? '반합' : '반합(약)', el: s.el });
  }
  for (const bh of BANGHAP) if (bh.branches.includes(a) && bh.branches.includes(b) && a !== b) rel.push({ type: '방합', el: bh.el });
  if (hasPair(YUKCHUNG, a, b)) rel.push({ type: '충' });
  if (HYEONG.삼형.some((t) => t.includes(a) && t.includes(b) && a !== b)) rel.push({ type: '형(삼형)' });
  if (hasPair(HYEONG.상형, a, b)) rel.push({ type: '형(상형)' });
  if (a === b && HYEONG.자형.includes(a)) rel.push({ type: '자형' });
  if (hasPair(PA, a, b)) rel.push({ type: '파' });
  if (hasPair(HAE, a, b)) rel.push({ type: '해' });
  if (hasPair(WONJIN, a, b)) rel.push({ type: '원진' });
  return rel;
}
const isWangji = (i) => [0, 3, 6, 9].includes(i); // 子卯午酉 = 왕지

// 원국 4지지 내에서 성립하는 관계 목록(쌍 단위)
export function pillarBranchRelations(branchIdxList) {
  const out = [];
  for (let i = 0; i < branchIdxList.length; i++)
    for (let j = i + 1; j < branchIdxList.length; j++) {
      const r = branchRelations(branchIdxList[i], branchIdxList[j]);
      if (r.length) out.push({ i, j, a: branchIdxList[i], b: branchIdxList[j], rel: r });
    }
  return out;
}

// 강도 서열(FigJam 계승): 일반 방합>삼합>육합, 1:1(궁합)에서는 육합 최강
export const HAP_STRENGTH = Object.freeze({ 일반: ['방합', '삼합', '육합'], 궁합_1대1: ['육합', '삼합', '방합'] });

export const HAPCHUNG_SOURCE_NOTE =
  '지지 삼합·방합·육합·충·형·파·해·원진, 천간 합·충은 명리 공통 확정표(유파 무관). ' +
  '午未 육합 합화(화/토)는 유파차 존재 — 본표는 화로 고정하고 각주로 남김. ' +
  '강도 서열·궁합 우선 규칙은 FigJam(운영자 정리본 260712) 계승 — 규칙만 취하고 해석 문장(외부 블로그 인용 포함)은 미수록.';
