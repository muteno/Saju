// 014-special-sinsal.knowledge.js — 특수 신살: 괴강·백호·양인·귀문 (지식모듈 SSOT · 통설/참고용)
// 근거: 60갑자·지지쌍 기반 특수 신살은 명리 공통 통설(공개 사실). 엔진(002)의 십이신살(004) 범위 밖 보충.
// 계층 계약: 데이터 원표 + 순수 판정 함수만. 해석 문장·표현은 두지 않는다(표현층 몫).
// idx 규약 = 001-ganji: STEMS 甲0…癸9 / BRANCHES 子0…亥11.
// ⚠ 흉살 계열(백호·귀문)은 소비층에서 반드시 '우발 발동·활용형'으로 순화 — 사고·질병 단정 금지(상담엔진 설계 §5).

// ── 괴강(魁罡): 戊·庚·壬 천간 × 辰·戌 지지 = 60갑자 중 6개 ──
// 통설: 강한 주체성·결단·통솔(양면: 독선). 일주에서 가장 강하게 발현.
export const GOEGANG_STEMS = Object.freeze([4, 6, 8]);    // 戊 庚 壬
export const GOEGANG_BRANCHES = Object.freeze([4, 10]);   // 辰 戌
export const isGoegang = (stem, branch) =>
  GOEGANG_STEMS.includes(stem) && GOEGANG_BRANCHES.includes(branch);

// ── 백호(白虎大殺): 甲辰 乙未 丙戌 丁丑 戊辰 壬戌 癸丑 = 7개 ──
// 통설: 강렬·돌발의 기운(전통상 흉살) — 단 강·길하면 군·경·사법·의 등 전문성으로 대성.
const BAEKHO_SET = new Set(['0-4', '1-7', '2-10', '3-1', '4-4', '8-10', '9-1']);
export const isBaekho = (stem, branch) => BAEKHO_SET.has(`${stem}-${branch}`);

// ── 양인(羊刃): 양간이 겁재 왕지를 봄 — 甲→卯 丙→午 戊→午 庚→酉 壬→子 ──
// 통설: 강한 의지·생존력·전문직(칼 쓰는 직업) 발현. 戊→午는 화토동법 통설(일부 유파 未 — 본표는 午 고정).
export const YANGIN_BRANCH = Object.freeze({ 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 });
export const yanginBranchOf = (dayStem) => (dayStem in YANGIN_BRANCH ? YANGIN_BRANCH[dayStem] : null);

// ── 귀문(鬼門關殺): 지지 쌍 — 子酉 丑午 寅未 卯申 辰亥 巳戌 ──
// 통설: 극도의 예민·몰입·직관(양면: 집착). 병리 단정 금지 — 몰입·직관 자원으로만 서술.
export const GWIMUN_PAIRS = Object.freeze([[0, 9], [1, 6], [2, 7], [3, 8], [4, 11], [5, 10]]);
const isGwimunPair = (a, b) =>
  GWIMUN_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

// 지지 목록(원국 등)에서 성립하는 귀문 쌍 전부 — 008 pillarBranchRelations와 같은 {i,j,a,b} 계약
export function gwimunPairsIn(branchIdxList) {
  const out = [];
  for (let i = 0; i < branchIdxList.length; i++)
    for (let j = i + 1; j < branchIdxList.length; j++)
      if (isGwimunPair(branchIdxList[i], branchIdxList[j]))
        out.push({ i, j, a: branchIdxList[i], b: branchIdxList[j] });
  return out;
}

// 발현 강도 서열(통설): 일주 > 시주 > 월주 > 년주 — 가중은 소비층(선별기)이 적용
export const SPECIAL_PILLAR_ORDER = Object.freeze(['일주', '시주', '월주', '년주']);

export const SPECIAL_SINSAL_SOURCE_NOTE =
  '괴강 6종(戊庚壬×辰戌)·백호 7종·양인(양간→겁재 왕지)·귀문 6쌍은 명리 공통 통설의 확정 목록(공개 사실). ' +
  '戊 양인=午는 화토동법 통설 채택(유파차 각주). 전부 참고용 — 발현은 우발적·조건부이며 단정 서술 금지.';
