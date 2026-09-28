// 구조 판정 (L1.5) — 원국 전반의 짜임새: 신강신약·득령득지득세·조후·오행 편중·십신 체인.
// 판정 기준의 1순위 근거는 방법론 보드(유료 입문강의 6개월 요약, methodology/figjam_board_full.md):
//   - 점수제: 총 110점 = 천간 4자리 각 10 + 지지 년15·월30·일15·시10.
//     일간을 돕는(비겁·인성) 글자의 자리 점수 합산. 기준점: 30(신약)·45(중화)·60(신강).
//     검산: 포스텔러 샘플(병인일주, 신강)이 70점으로 재현됨.
//   - 득령: "월령이 비/인" = 득령, "월령이 식/재/관" = 실령 (보드 원문).
// 극신강/극신약 경계(85/15)는 표본 부족으로 잠정치 — 실전 사주풀이 표본 확보 시 보정.

import { STEM_ELEMENT, HIDDEN_STEMS, TEN_GODS, tenGod, sexStem, sexBranch, ELEMENTS } from './tables.js';

const POS = ['year', 'month', 'day', 'hour'];
const BRANCH_W = { year: 15, month: 30, day: 15, hour: 10 };
const STEM_W = 10;

/** 십신 인덱스 → 오분류 (0비겁 1식상 2재성 3관성 4인성) */
const groupOf = (tg) => Math.floor(tg / 2);
const GROUP_NAMES = ['비겁', '식상', '재성', '관성', '인성'];

function branchMainStem(b) {
  const hs = HIDDEN_STEMS[b];
  return hs[hs.length - 1];
}

/** 신강신약 판정 (보드 110점제) */
export function strengthJudge(chart) {
  const p = chart.pillarsIdx;
  const day = sexStem(p.day);
  const helps = (stem) => {
    const g = groupOf(tenGod(day, stem));
    return g === 0 || g === 4; // 비겁·인성
  };
  let score = 0;
  const detail = {};
  for (const q of POS) {
    const s = sexStem(p[q]), b = sexBranch(p[q]);
    const stemHelp = q === 'day' ? true : helps(s); // 일간 자신 = 아신 10점 (보드 '비견(아신) x10')
    const branchHelp = helps(branchMainStem(b));
    if (stemHelp) score += STEM_W;
    if (branchHelp) score += BRANCH_W[q];
    detail[q] = { stemHelp, branchHelp };
  }
  // 득령·득지·득시·득세 (득세: 월지·일지·시지 외 조력 — 년주·월간·시간 중 2곳 이상)
  const deukryeong = detail.month.branchHelp;
  const deukji = detail.day.branchHelp;
  const deuksi = detail.hour.branchHelp;
  const seCount = [detail.year.stemHelp, detail.year.branchHelp, detail.month.stemHelp, detail.hour.stemHelp].filter(Boolean).length;
  const deukse = seCount >= 2;

  let label;
  if (score >= 85) label = '극신강';
  else if (score >= 60) label = '신강';
  else if (score > 30) label = '중화';
  else if (score > 15) label = '신약';
  else label = '극신약';

  return { score, max: 110, label, deukryeong, deukji, deuksi, deukse, detail };
}

/** 오행 분포(8자 본기)·부재·과다 + 무X성 */
export function elementProfile(chart) {
  const p = chart.pillarsIdx;
  const day = sexStem(p.day);
  const elemCount = [0, 0, 0, 0, 0];
  const groupCount = [0, 0, 0, 0, 0];
  for (const q of POS) {
    const s = sexStem(p[q]), bm = branchMainStem(sexBranch(p[q]));
    elemCount[STEM_ELEMENT[s]]++;
    elemCount[STEM_ELEMENT[bm]]++;
    if (q !== 'day') groupCount[groupOf(tenGod(day, s))]++;
    groupCount[groupOf(tenGod(day, bm))]++;
  }
  const missing = ELEMENTS.filter((_, i) => elemCount[i] === 0);
  const excess = ELEMENTS.filter((_, i) => elemCount[i] >= 4);
  const missingGroups = GROUP_NAMES.filter((_, i) => groupCount[i] === 0);
  return {
    elements: Object.fromEntries(ELEMENTS.map((e, i) => [e, elemCount[i]])),
    groups: Object.fromEntries(GROUP_NAMES.map((g, i) => [g, groupCount[i]])),
    missing, excess, missingGroups,
  };
}

/** 조후(계절 균형) — v1: 겨울생(해자축) 화 필요 / 여름생(사오미) 수 필요 + 보유 여부 */
export function johuJudge(chart) {
  const mb = sexBranch(chart.pillarsIdx.month);
  const prof = elementProfile(chart);
  const season = [0, 1].includes(mb) || mb === 11 ? '겨울'
    : [5, 6, 7].includes(mb) ? '여름'
    : [2, 3, 4].includes(mb) ? '봄' : '가을';
  let need = null;
  if (season === '겨울') need = '화';
  if (season === '여름') need = '수';
  const satisfied = need ? prof.elements[need] > 0 : true;
  return { season, monthBranch: mb, need, satisfied };
}

/** 십신 체인 구조 후보 (본기 기준 존재 패턴 — 세부 성립 조건은 문헌 근거로 서술) */
export function chainCandidates(chart) {
  const g = elementProfile(chart).groups;
  const chains = [];
  if (g['식상'] > 0 && g['재성'] > 0) chains.push('식상생재');
  if (g['재성'] > 0 && g['관성'] > 0) chains.push('재생관');
  if (g['관성'] > 0 && g['인성'] > 0) chains.push('관인상생');
  if (g['비겁'] >= 3 && g['재성'] > 0 && g['재성'] <= 1) chains.push('군겁쟁재');
  if (g['재성'] >= 3) chains.push('재다신약');
  if (g['재성'] >= 2 && g['인성'] >= 1 && g['재성'] > g['인성']) chains.push('탐재괴인');
  return chains;
}

/** 상관견관: 상관과 정관이 함께 드러난 경우 (개별 십신 단위 검사) */
function sanggwanGyeongwan(chart) {
  const p = chart.pillarsIdx;
  const day = sexStem(p.day);
  const tgs = new Set();
  for (const q of POS) {
    if (q !== 'day') tgs.add(tenGod(day, sexStem(p[q])));
    tgs.add(tenGod(day, branchMainStem(sexBranch(p[q]))));
  }
  const out = [];
  if (tgs.has(3) && tgs.has(7)) out.push('상관견관'); // 상관=3, 정관=7
  if (tgs.has(6) && tgs.has(7)) out.push('관살혼잡'); // 편관+정관
  return out;
}

/** 종합 구조 판정 + frame/chain 조회 키 방출 */
export function judgeStructure(chart) {
  const strength = strengthJudge(chart);
  const johu = johuJudge(chart);
  const profile = elementProfile(chart);
  const chains = [...chainCandidates(chart), ...sanggwanGyeongwan(chart)];

  const keys = [`frame/${strength.label === '극신강' ? '극신강' : strength.label === '극신약' ? '극신약' : strength.label}`];
  if (strength.deukryeong) keys.push('frame/득령');
  if (johu.need) keys.push('frame/조후');
  for (const gname of profile.missingGroups) {
    const k = { '관성': '무관성', '식상': '무식상', '재성': '무재성', '인성': '무인성', '비겁': '무비겁' }[gname];
    if (k) keys.push(`frame/${k}`);
  }
  for (const c of chains) keys.push(`chain/${c}`);

  return { strength, johu, profile, chains, keys };
}
