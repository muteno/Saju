// 구조 판정 (L1.5) — 원국 전반의 짜임새: 신강신약·득령득지득세·조후·오행 편중·십신 체인.
// 자리 배점 근거: 방법론 보드 raw의 자리 좌표(연10·월30·일15·시15, 천간 각10·일간 포함).
// docs/knowledge-model/FOUNDATION_STRENGTH_CORRECTION.md에서 근거와 기존 정책을 구분한다.
// 비겁·인성/지지 마지막 본기만의 도움, 득세 조건, 5등급 전체 경계는 기존 앱의 잠정 기준이다.
// 보드의 30/45/60 표식만으로 이 분류 전체를 인증하지 않는다. 학습값·확률이 아니다.

import { STEM_ELEMENT, HIDDEN_STEMS, TEN_GODS, tenGod, sexStem, sexBranch, ELEMENTS } from './tables.js';

const POS = ['year', 'month', 'day', 'hour'];
export const STRENGTH_BRANCH_WEIGHTS = Object.freeze({ year: 10, month: 30, day: 15, hour: 15 });
export const STRENGTH_STEM_WEIGHT = 10;

/** 십신 인덱스 → 오분류 (0비겁 1식상 2재성 3관성 4인성) */
const groupOf = (tg) => Math.floor(tg / 2);
const GROUP_NAMES = ['비겁', '식상', '재성', '관성', '인성'];

function branchMainStem(b) {
  const hs = HIDDEN_STEMS[b];
  return hs[hs.length - 1];
}

/** 신강신약: 보드 자리 배점 + 기존 앱의 잠정 도움/분류 정책 */
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
    if (stemHelp) score += STRENGTH_STEM_WEIGHT;
    if (branchHelp) score += STRENGTH_BRANCH_WEIGHTS[q];
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
