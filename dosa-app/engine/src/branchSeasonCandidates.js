// Branch readings for charts whose wealth (재성) and authority (관성) cannot be compared in the stems or by
// the stem–branch rooting comparison: both groups only in the branches, or one side in the stems with the
// other only in hidden stems. The reference reads a branch by its season body first (계절=체, 지지=용;
// 1681·1686·2492), branch-to-branch 재생관 by season and 삼합 direction (1052~1059, 2605~2607), and a
// storage branch (辰戌丑未) by its season as well as its principal (2624·2629·2632).
// References/assumptions: docs/knowledge-model/CONDITIONAL_WORK_READING.md (지지 계절 본체·방향).
// Existence and direction only: no strength, 12-stage, luck timing, day-master capacity or probability.
import { BRANCHES_HANJA, STEMS_HANJA, HIDDEN_STEMS, STEM_ELEMENT, ELEMENTS, TEN_GODS, tenGod, sexStem, sexBranch } from './tables.js';
import { detectRelations } from './relations.js';
import { evaluateCondition } from './workCandidates.js';
import { rootState, ROOTING_THEMES, ROOTING_QUESTIONS } from './rootingCandidates.js';

const POSITIONS = ['year', 'month', 'day', 'hour'];
const BRANCH_PLACE = { year: '연지', month: '월지', day: '일지', hour: '시지' };
const STEM_PLACE = { year: '연간', month: '월간', hour: '시간' };
const POS_KR = { year: '년', month: '월', day: '일', hour: '시' };
const GROUPS = ['비겁', '식상', '재성', '관성', '인성'];
// Seasons (1689~1695): 寅卯辰 봄(木), 巳午未 여름(火), 申酉戌 가을(金), 亥子丑 겨울(水).
const SEASON = [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3];
const SEASON_NAME = ['봄', '여름', '가을', '겨울'];
const SEASON_ELEMENT = [0, 1, 3, 4];
// 丑辰未戌: an earth principal whose body is its season (1681 戌=가을, 2624 丑=겨울); the middle hidden
// stem is the element it stores (금의 묘지, 2624; 입묘, 1059).
const STORAGE = [1, 4, 7, 10];
// 삼합 [생지, 왕지, 고지, 오행]. Two members, with or without the 왕지 (1055 '신진반합'), read by its element.
const TRIADS = [[8, 0, 4, 4], [5, 9, 1, 3], [2, 6, 10, 1], [11, 3, 7, 0]];
// Particles follow the reading of the last hanja: 갑을병정경신임 / 축인진신술 end in a consonant.
const FINAL = '甲乙丙丁庚辛壬丑寅辰申戌';
const josa = (character, withFinal, without) => (FINAL.includes(character) ? withFinal : without);
const ELEMENT_FINAL = [true, false, false, true, false]; // 목화토금수: 목·금 end in a consonant
const elJosa = (el, withFinal, without) => (ELEMENT_FINAL[el] ? withFinal : without);
const groupOf = (dayStem, element) => GROUPS[(element - STEM_ELEMENT[dayStem] + 5) % 5];

export const BRANCH_QUESTION = ROOTING_QUESTIONS.authority;
export const BRANCH_SEASON_LIMIT = '지지를 계절 본체와 삼합의 방향으로만 비교한 해석 가설이에요. 참고 자료는 지지끼리의 재생관을 판단하기 어렵다고 적어, 같은 계절·삼합처럼 기준이 적힌 경우만 골랐어요. 강약과 운의 시기는 넣지 않았고, 직업 적성·성공·개인 사건을 정하지 않아요.';
export const SEASON_ROOTING_LIMIT = '천간과 지지 사이를 뿌리(통근)로 비교하되, 다른 계열은 지지의 계절 본체로 읽은 해석 가설이에요. 계절로 품은 환경은 지지 본기와 구별했고, 강약과 운의 시기는 넣지 않았으며, 직업 적성·성공·개인 사건을 정하지 않아요.';
const SEASON_THEMES = Object.freeze({
  wealth: { ...ROOTING_THEMES.wealth, within: '기준·책임의 흐름 안에서 나오는 성과·자원 활동으로' },
  authority: { ...ROOTING_THEMES.authority, within: '성과·자원의 흐름 안에서 맡는 역할로' },
});

const feature = name => ({ feature: name });
const not = expression => ({ not: expression });
const all = (...expressions) => ({ all: expressions.map(e => (typeof e === 'string' ? feature(e) : e)) });
const BRANCH_RULES = [
  { id: 'branch-link', condition: all('bothBranches', 'linkDirection', not(feature('resourceDirection')), not(feature('wealthDirection'))),
    counter: not(feature('directionClear')), label: '같은 계절이나 관성 삼합으로 이어진 재성·관성의 지지 환경' },
  { id: 'branch-diverted', condition: all('bothBranches', 'resourceDirection', not(feature('linkDirection')), not(feature('wealthDirection'))),
    counter: not(feature('directionClear')), label: '인성 삼합으로 묶여 곧바로 이어지지 않는 재성·관성의 지지 환경' },
];
const SEASON_RULES = scope => [
  { id: 'season-grounded', condition: all(scope, 'otherSeason', 'rootedInOther'), counter: not(feature('linkUsable')),
    label: '천간에 드러난 계열이 다른 계열의 계절 본체인 지지에 뿌리를 둔 연결' },
  { id: 'season-shaken', condition: all(scope, 'otherSeason', 'rootedInOther', not(feature('linkUsable'))),
    label: '계절 본체인 지지에 뿌리로 이어졌지만 그 지지가 충·사신형을 받은 연결' },
  { id: 'season-separate', condition: all(scope, 'otherSeason', 'stemRooted', not(feature('rootedInOther'))),
    label: '계절 본체인 지지와 다른 자리에 뿌리를 둔 두 계열' },
  { id: 'season-surface', condition: all(scope, 'otherSeason', not(feature('stemRooted'))),
    label: '뿌리 없이 천간에만 드러나고 다른 계열은 계절 본체로 있는 구성' },
];

function compare(rules, features) {
  return rules.map(rule => {
    const condition = evaluateCondition(rule.condition, features);
    const counter = rule.counter ? evaluateCondition(rule.counter, features) : null;
    const status = condition.value === 0 ? 'inapplicable' : condition.value === null ? 'withheld'
      : counter?.value === 1 ? 'weakened' : counter?.value === null ? 'withheld' : 'selected';
    return { id: rule.id, label: rule.label, status, condition, counter };
  });
}
export const compareBranchCandidates = features => compare(BRANCH_RULES, features);
export const compareSeasonCandidates = (features, scope) => compare(SEASON_RULES(scope), features);

/** Branches that carry a group's environment: its principal (본기), or a storage branch whose season is
 * the group's element (non-earth groups only; the principal of a storage branch is earth). */
export function branchEnvironments(pillarsIdx, group) {
  const dayStem = sexStem(pillarsIdx.day);
  return POSITIONS.flatMap(position => {
    const branch = sexBranch(pillarsIdx[position]), main = HIDDEN_STEMS[branch].at(-1);
    const principal = { character: STEMS_HANJA[main], tenGod: TEN_GODS[tenGod(dayStem, main)], group: groupOf(dayStem, STEM_ELEMENT[main]) };
    const base = { position, branch, branchCharacter: BRANCHES_HANJA[branch], season: SEASON[branch], principal };
    if (principal.group === group) return [{ ...base, via: 'principal' }];
    if (STORAGE.includes(branch) && groupOf(dayStem, SEASON_ELEMENT[SEASON[branch]]) === group) return [{ ...base, via: 'season' }];
    return [];
  });
}

/** Where a group sits when it has no environment branch: the stored element of a storage branch (tomb) or another hidden stem. */
function hiddenPlaces(pillarsIdx, group) {
  const dayStem = sexStem(pillarsIdx.day);
  return POSITIONS.flatMap(position => {
    const branch = sexBranch(pillarsIdx[position]);
    return HIDDEN_STEMS[branch].slice(0, -1).filter(s => groupOf(dayStem, STEM_ELEMENT[s]) === group).map(s => ({
      position, branch, branchCharacter: BRANCHES_HANJA[branch], character: STEMS_HANJA[s], tenGod: TEN_GODS[tenGod(dayStem, s)],
      tomb: STORAGE.includes(branch) && HIDDEN_STEMS[branch][1] === s }));
  });
}

/** How one wealth branch and one authority branch relate: the same branch (principal and season body),
 * the same season (1058), two members of one 삼합 read by its element (1053~1055, 2605~2607), or none. */
export function branchPairKind(pillarsIdx, w, a) {
  const dayStem = sexStem(pillarsIdx.day);
  if (w.position === a.position) return { kind: 'season', basis: 'same-branch' };
  if (w.season === a.season) return { kind: 'season', basis: 'same-season' };
  const triad = TRIADS.find(t => t.slice(0, 3).includes(w.branch) && t.slice(0, 3).includes(a.branch));
  if (triad && w.branch !== a.branch) {
    const group = groupOf(dayStem, triad[3]);
    return { kind: group === '관성' ? 'triad-authority' : group === '인성' ? 'triad-resource' : 'triad-wealth',
      basis: 'triad', triad: triad.slice(0, 3).map(b => BRANCHES_HANJA[b]).join(''), element: triad[3], group, withWang: [w.branch, a.branch].includes(triad[1]) };
  }
  return { kind: 'none', basis: 'none' };
}

const uniqueBy = (xs, key) => xs.filter((x, i) => xs.findIndex(y => key(y) === key(x)) === i);
const place = x => `${BRANCH_PLACE[x.position]} ${x.branchCharacter}`;
const seasonText = x => `${ELEMENTS[SEASON_ELEMENT[x.season]]}의 계절인 ${SEASON_NAME[x.season]}`;
const envText = (x, group) => (x.via === 'principal' ? `${place(x)}(본기 ${x.principal.character} ${x.principal.tenGod})`
  : `${place(x)}(본기는 ${x.principal.character} ${x.principal.tenGod}이지만 계절로는 ${seasonText(x)}이라 ${group}의 환경)`);
const joinPlaces = xs => uniqueBy(xs, place).map(place).join('·');
const lastChar = xs => uniqueBy(xs, place).at(-1).branchCharacter;
const hiddenText = xs => xs.map(h => `${place(h)}의 지장간 ${h.character}(${h.tenGod})`).join(', ');
function tombNote(pillarsIdx, group) {
  const tombs = uniqueBy(hiddenPlaces(pillarsIdx, group).filter(h => h.tomb), place);
  if (!tombs.length) return '';
  const el = STEM_ELEMENT[STEMS_HANJA.indexOf(tombs[0].character)];
  return ` ${joinPlaces(tombs)}${josa(tombs.at(-1).branchCharacter, '은', '는')} ${ELEMENTS[el]}${elJosa(el, '을', '를')} 거두는 고지(묘지)라, 운에 따라 그 글자가 드러나거나 묶일 수 있어 원국만으로 정하지 않아요.`;
}

/** Both groups only in the branches (no 재성·관성 stem). */
function bothBranchDecision(chart) {
  const p = chart.pillarsIdx, W = branchEnvironments(p, '재성'), A = branchEnvironments(p, '관성');
  const relations = detectRelations(p);
  const pairs = W.flatMap(w => A.map(a => ({ w, a, ...branchPairKind(p, w, a) })));
  const directional = pairs.filter(x => x.kind !== 'none'), has = kind => directional.some(x => x.kind === kind);
  const clashAt = q => [...relations.chung, ...relations.hyeong].filter(r => r.positions.includes(POS_KR[q])).map(r => r.name);
  const involved = uniqueBy(directional.flatMap(x => [x.w, x.a]), x => x.position);
  const clashes = [...new Set(involved.flatMap(x => clashAt(x.position)))];
  const features = { bothBranches: 1, linkDirection: +(has('season') || has('triad-authority')), resourceDirection: +has('triad-resource'),
    wealthDirection: +has('triad-wealth'), directionClear: clashes.length ? null : 1 };
  const envEmpty = !W.length || !A.length;
  const candidates = envEmpty ? [] : compareBranchCandidates(features);
  const selectedIds = candidates.filter(c => c.status === 'selected').map(c => c.id);
  const active = selectedIds.length === 1;
  const mode = envEmpty ? 'hidden-only' : active ? selectedIds[0]
    : candidates.some(c => c.condition.value === 1 && c.status === 'withheld') ? 'direction-clash'
      : !directional.length ? 'no-direction' : features.wealthDirection && !features.linkDirection && !features.resourceDirection ? 'direction-unset' : 'mixed-direction';

  const missing = [!W.length && '재성', !A.length && '관성'].filter(Boolean);
  const facts = envEmpty
    ? `재성과 관성은 천간에 없어요. ${missing.map(g => `${g}은 지지 본기나 계절 본체로도 없고 ${hiddenText(hiddenPlaces(p, g))}에만 있어요.`).join(' ')}`
    : `재성과 관성은 천간에 없고 지지에만 있어요. 재성은 ${W.map(x => envText(x, '재성')).join(', ')}, 관성은 ${A.map(x => envText(x, '관성')).join(', ')}에 있어요.`;
  const shownPairs = mode === 'branch-link' ? directional.filter(x => ['season', 'triad-authority'].includes(x.kind))
    : mode === 'branch-diverted' ? directional.filter(x => x.kind === 'triad-resource') : directional;
  const seasonPairs = shownPairs.filter(x => x.kind === 'season'), triadPairs = shownPairs.filter(x => x.basis === 'triad');
  const pairText = x => (x.basis === 'same-branch' ? `${place(x.w)} 한 자리` : `${place(x.w)}(재성)${josa(x.w.branchCharacter, '과', '와')} ${place(x.a)}(관성)`);
  let interpretation, reason, alternative;
  if (mode === 'branch-link') {
    const grounds = [];
    if (seasonPairs.length) {
      const seasons = [...new Set(seasonPairs.map(x => SEASON_NAME[x.w.season]))].join('·');
      grounds.push(`${seasonPairs.map(pairText).join(', ')}에서 재성과 관성의 환경이 같은 ${seasons} 계절에 속해요. 지지끼리의 재생관은 판단하기 어렵지만, 같은 계절의 지지는 다른 계절일 때보다 재생관이 수월하다고 보는 기준을 따랐어요.`);
    }
    if (triadPairs.length) {
      const frames = [...new Set(triadPairs.map(x => `${x.triad} ${ELEMENTS[x.element]}(${x.group})`))].join('·');
      grounds.push(`${triadPairs.map(pairText).join(', ')}${josa(triadPairs.at(-1).a.branchCharacter, '은', '는')} ${frames} 삼합의 두 글자라, 두 지지의 관계가 관성 쪽 흐름을 가져요. 지지는 계절과 합의 방향으로 읽는다는 기준을 따랐어요.`);
    }
    interpretation = triadPairs.length && !seasonPairs.length
      ? '결과·자원을 다루는 환경이 기준·책임의 흐름으로 묶여 있어, 결과를 꾸준히 내면 맡는 역할이나 평가로 이어지는 구성으로 먼저 읽어요.'
      : '결과·자원을 다루는 환경과 기준·책임을 맡는 환경이 같은 흐름에 있어, 결과·자원 관리가 기준·책임으로 이어지기 비교적 수월한 구성으로 먼저 읽어요.';
    reason = grounds.join(' ');
    alternative = '천간에 드러난 것이 아니라 놓인 환경끼리의 연결이라, 스스로 내세우는 목표로 정하지 않아요. 이어지기 수월하다고 실제로 도움이 됐다는 뜻은 아니어서, 따로 움직였거나 부딪힌 경험이면 이 후보를 낮춰야 해요.';
  } else if (mode === 'branch-diverted') {
    const frames = [...new Set(triadPairs.map(x => `${x.triad} ${ELEMENTS[x.element]}`))].join('·');
    interpretation = '결과·자원 환경과 기준·책임 환경이 서로 곧바로 이어지기보다 함께 배움·준비(인성) 쪽 흐름으로 묶여 있어, 결과·자원 관리가 바로 기준·책임으로 이어진다고 읽지 않아요.';
    reason = `${triadPairs.map(pairText).join(', ')}${josa(triadPairs.at(-1).a.branchCharacter, '은', '는')} ${frames} 삼합의 두 글자이고, 그 오행은 일간에게 인성이에요. 지장간 본기만 보면 재생관처럼 보여도 두 지지의 관계는 삼합의 방향을 따른다는 기준을 따랐어요.`;
    alternative = '인성 쪽으로 묶인다고 결과와 책임이 서로 관계없다는 뜻은 아니에요. 결과·자원 환경이 기준·책임에 바로 도움이 된 경험이 있으면 이 후보를 낮춰야 해요.';
  } else if (mode === 'direction-clash') {
    // Kept in the record only: the existing reading stays on screen.
    interpretation = '지지의 재성·관성에 방향은 보이지만, 그 지지에 걸린 충·형이 이 방향에 주는 영향을 정할 기준이 없어 보류해요.';
    reason = `${joinPlaces(involved)}에는 ${clashes.join('·')} 관계가 함께 있어요. 참고 기준은 계절과 방향을 먼저 본 뒤 형충을 보라고만 하고, 이 경우의 결과는 적지 않아요.`;
    alternative = '원래의 월·시 풀이는 그대로 둬요.';
  } else if (mode === 'no-direction') {
    interpretation = '재성과 관성이 지지에 서로 다른 계절로 있고 삼합으로도 묶이지 않아, 지지끼리의 재생관을 판단할 기준이 없어 보류해요.';
    reason = `지지의 재생관은 체용론을 배우기 전에는 판단하기 어렵다는 기준을 따랐어요. 기준이 적힌 것은 같은 계절과 삼합의 방향뿐이에요.${tombNote(p, '재성')}${tombNote(p, '관성')}`;
    alternative = '원래의 월·시 풀이는 그대로 둬요.';
  } else if (mode === 'direction-unset') {
    interpretation = '재성과 관성의 지지가 재성 쪽 삼합으로 묶이지만, 이 방향을 읽는 예시가 없어 보류해요.';
    reason = `${directional.filter(x => x.kind === 'triad-wealth').map(pairText).join(', ')}은 재성 오행의 삼합으로 묶여요. 참고 기준의 예시는 관성 쪽(신자 반합)과 인성 쪽(신진) 방향뿐이에요.`;
    alternative = '원래의 월·시 풀이는 그대로 둬요.';
  } else if (mode === 'mixed-direction') {
    interpretation = '재성과 관성의 지지가 여러 방향으로 묶여 있어 한 방향으로 정하지 않고 보류해요.';
    reason = '자리마다 계절과 삼합의 방향이 다르면 인생 시기별로 방향이 달라질 수 있어 재생관을 판단하기 어렵다는 기준을 따랐어요.';
    alternative = '원래의 월·시 풀이는 그대로 둬요.';
  } else {
    interpretation = `${missing.join('·')}이 지지 본기나 계절 본체로 없고 지장간에만 있어, 지지끼리 비교하는 후보는 보류해요.`;
    reason = `지지의 재성·관성은 본기와 계절 본체로 읽고, 그 밖의 지장간은 지지 안의 복합 작용이라 원국만으로 판단하지 않아요.${missing.map(g => tombNote(p, g)).join('')}`;
    alternative = '원래의 월·시 풀이는 그대로 둬요.';
  }
  const question = active ? { id: `work-branch-${mode}`, prompt: BRANCH_QUESTION,
    clarifies: '지지의 재성 환경과 관성 환경이 경험에서 이어졌는지; 자기보고는 독립 적중률이 아님' } : null;
  return { policy: 'branch-season-v1', scope: 'both-natal-branches', side: null,
    assumption: 'branches read by season body and 삼합 direction: the same season (1058) or an authority frame (2605~2607) links wealth to authority, a resource frame without its 왕지 diverts it (1053~1055); storage branches also carry their season; 충·형 on those branches, a wealth frame, mixed or no direction stay unknown; not verified personal effects',
    sourceParagraphs: ['SG-MID-P010', 'SG-MID-P011', 'SG-MID-P014', 'SG-MID-P015', 'SG-MID-P016'],
    features, candidates, selectedIds, active, mode, environments: { wealth: W, authority: A },
    pairs: pairs.map(({ w, a, ...rest }) => ({ wealth: w.position, authority: a.position, ...rest })), clashes,
    roots: null, facts, interpretation, reason, alternative,
    lines: active ? [interpretation, facts, reason, alternative, BRANCH_SEASON_LIMIT] : [], question,
    beforeFeedback: true, probability: null, trainingEligible: false };
}

/** One side in the stems, the other only in hidden stems (the rooting decision's 'hidden-only'):
 * the other group's environment is a storage branch whose season is that group (2624·2629). */
function seasonRootingDecision(chart, { stems }, side) {
  const p = chart.pillarsIdx, t = SEASON_THEMES[side], scope = `${side}StemOnly`;
  const sideStems = stems.filter(m => m.group === t.stem), envs = branchEnvironments(p, t.env);
  const relations = detectRelations(p);
  // Same rooting as rootingCandidates.js: a stem roots in a branch holding a hidden stem of its element.
  const roots = sideStems.map(stem => ({ position: stem.position, stem: stem.stem, character: stem.character, tenGod: stem.tenGod,
    places: POSITIONS.filter(q => HIDDEN_STEMS[sexBranch(p[q])].some(h => STEM_ELEMENT[h] === STEM_ELEMENT[stem.stem])).map(q => {
      const env = envs.find(x => x.position === q);
      return { position: q, branch: sexBranch(p[q]), branchCharacter: BRANCHES_HANJA[sexBranch(p[q])],
        sameStem: HIDDEN_STEMS[sexBranch(p[q])].includes(stem.stem), link: !!env, season: env ? env.season : null, state: rootState(p, q, relations) };
    }) }));
  const links = roots.flatMap(r => r.places.filter(x => x.link).map(x => ({ ...x, root: r })));
  const linkUsable = links.some(x => x.state.value === 0) ? 1 : links.some(x => x.state.value === null) ? null : 0;
  const features = { [scope]: 1, otherSeason: +!!envs.length, stemRooted: +roots.some(r => r.places.length),
    rootedInOther: +!!links.length, linkUsable };
  const candidates = envs.length ? compareSeasonCandidates(features, scope) : [];
  const selectedIds = candidates.filter(c => c.status === 'selected').map(c => c.id);
  const active = selectedIds.length === 1;
  const mode = active ? selectedIds[0] : envs.length ? 'season-link-withheld' : 'hidden-only';

  const stemText = m => `${STEM_PLACE[m.position]} ${m.character}`;
  const last = xs => xs.at(-1);
  const facts = [
    `천간에 드러난 ${t.stem}은 ${sideStems.map(m => `${stemText(m)}(${m.tenGod})`).join(', ')}${josa(last(sideStems).character, '이에요', '예요')}.`,
    // One storage branch per season: every season-body branch of a group is the same character.
    envs.length ? `${t.env}은 천간과 지지 본기에 없고, ${joinPlaces(envs)}의 지장간에 있어요. ${joinPlaces(envs)}${josa(lastChar(envs), '은', '는')} 본기가 ${envs[0].principal.character}(${envs[0].principal.tenGod})이지만 계절로는 ${seasonText(envs[0])}에 속해 ${t.env}의 환경을 품어요.`
      : `${t.env}은 천간과 지지 본기에 없고, 계절 본체로도 없이 ${hiddenText(hiddenPlaces(p, t.env))}에만 있어요.`,
    ...roots.map(r => (r.places.length
      ? `${stemText(r)}${josa(r.character, '은', '는')} ${r.places.map(place).join('·')}에 같은 ${ELEMENTS[STEM_ELEMENT[r.stem]]} 기운의 지장간이 있어 뿌리를 둬요.`
      : `${stemText(r)}${josa(r.character, '은', '는')} 네 지지의 지장간에 같은 오행이 없어 뿌리가 없어요.`)),
  ].join(' ');
  const shown = mode === 'season-grounded' ? links.filter(x => x.state.value === 0) : links;
  const shownPlaces = uniqueBy(shown, place), shownStems = uniqueBy(shown.map(x => x.root), stemText);
  const linkPlaces = shownPlaces.map(place).join('·'), linkStems = shownStems.map(stemText).join(', ');
  const linkSubject = shown.length ? `${linkStems}${josa(last(shownStems).character, '이', '가')}` : '';
  const envPlaces = joinPlaces(envs);
  const envSeasons = [...new Set(envs.map(x => SEASON_NAME[x.season]))].join('·');
  const relNames = [...new Set(shown.flatMap(x => x.state.names))].join('·');
  let interpretation, reason, alternative;
  if (mode === 'season-grounded') {
    interpretation = `겉으로 드러난 ${t.work}이 ${linkPlaces}에 뿌리를 두고, 그 지지는 계절로 ${t.envTheme}의 환경을 품어요. 그래서 ${t.within} 먼저 읽어요.`;
    reason = `${linkSubject} ${linkPlaces}에 뿌리를 두고, ${linkPlaces}${josa(lastChar(shown), '은', '는')} 계절 본체가 ${t.env}이에요. 지지는 계절을 본체로 먼저 본다는 기준과, 천간이 뿌리를 둔 지지가 그 천간의 근거가 된다는 기준을 함께 따랐어요.`;
    alternative = `${t.envTheme}은 지지 본기가 아니라 계절로 품은 환경이라, 본기로 있는 경우와 구별해 둬요. 뿌리로 이어졌다고 그 환경이 늘 도움이 됐다는 뜻은 아니어서, 따로 움직였거나 부딪힌 경험이면 이 후보를 낮춰야 해요.`;
  } else if (mode === 'season-shaken') {
    const bases = shown.map(x => x.state.basis);
    interpretation = `겉으로 드러난 ${t.work}이 계절로 ${t.envTheme}의 환경을 품은 ${linkPlaces}에 뿌리를 두지만, 그 지지가 ${relNames}에 걸려 있어 그 근거를 꾸준히 쓰기보다 흔들리거나 방식이 바뀌는 경우를 함께 읽어요.`;
    const grounds = [
      bases.includes('chung') && '뿌리를 둔 지지가 충을 받으면 그 뿌리를 제대로 쓰기 어렵고, 충을 풀어 주는 합이나 뿌리가 되는 운이 올 때 쓰인다는 기준',
      bases.includes('sasin-hyeong') && '사신형에 걸린 지지의 뿌리는 제대로 쓰지 못한다는 예시',
    ].filter(Boolean);
    reason = `${linkSubject} 뿌리를 둔 ${linkPlaces}${josa(lastChar(shown), '은', '는')} 계절 본체가 ${t.env}이에요. ${grounds.join('과 ')}${grounds.at(-1).endsWith('예시') ? '를' : '을'} 따라 이 연결 후보를 낮췄어요.`;
    alternative = '충·형이 있다고 연결이 끊겼거나 실패한다는 뜻은 아니에요. 그 환경이 도움이 된 때와 흔들린 때가 함께 있었는지 경험으로 나눠 봐야 해요.';
  } else if (mode === 'season-separate') {
    const rootPlaces = uniqueBy(roots.flatMap(r => r.places), place).map(place).join('·');
    interpretation = `겉으로 드러난 ${t.work}은 ${t.envTheme}의 환경을 계절로 품은 ${envPlaces}${josa(lastChar(envs), '과', '와')} 다른 자리에 뿌리를 두고 있어, 두 주제를 따로 읽어요. ${t.envTheme}은 스스로 내세우는 목표라기보다 놓인 환경에 가까운 주제로 둬요.`;
    reason = `${t.stem}의 뿌리는 ${rootPlaces}에 있고, ${t.env}은 ${envPlaces}${josa(lastChar(envs), '이', '가')} 계절(${envSeasons})로 품은 환경으로만 있어요. 천간의 ${t.stem}과 그 계절 환경이 뿌리로 이어지지 않아요.`;
    alternative = `뿌리로 이어지지 않았다고 두 주제가 부딪히거나 관계없다는 뜻은 아니에요. ${t.envTheme} 환경이 도움이 된 경험이 있으면 이 후보를 낮춰야 해요.`;
  } else if (mode === 'season-surface') {
    interpretation = `${t.work}은 겉으로 드러나 있지만 지지에 뿌리가 없어, 늘 이어지는 기반보다 때에 따라 나타나는 준비 상태로 읽어요. ${t.envTheme}은 ${envPlaces}${josa(lastChar(envs), '이', '가')} 계절로 품은 환경으로 따로 있어요.`;
    reason = `천간 ${t.stem}의 오행이 네 지지의 지장간 어디에도 없어 뿌리를 두지 못했어요. 뿌리가 없는 천간은 운에서 뿌리를 만날 때 드러난다고 보는 기준을 따랐어요.`;
    alternative = `뿌리가 없다고 능력이 없거나 나쁘다는 뜻은 아니에요. ${t.envTheme} 환경이 ${t.work}에 도움이 된 경험이 있으면 이 후보를 낮춰야 해요.`;
  } else if (mode === 'season-link-withheld') {
    interpretation = `${t.stem}이 ${t.env}의 계절 환경을 품은 지지에 뿌리를 두지만, 그 지지의 관계가 뿌리를 쓰는 데 주는 영향을 정하는 기준이 없어 이 비교는 보류해요.`;
    reason = `${linkPlaces}에는 ${relNames} 관계가 함께 있어요. 참고 기준은 충(합의 운이 오면 풀림)과 사신형만 다뤄요.`;
    alternative = '원래의 월·시 풀이는 그대로 둬요.';
  } else {
    interpretation = `${t.env}이 지지 본기나 계절 본체로 없고 지장간에만 있어, 천간과 지지를 뿌리로 비교하는 후보는 보류해요.`;
    reason = `지지의 십성은 본기와 계절 본체로 읽고, 그 밖의 지장간은 지지 안의 복합 작용이라 원국만으로 판단하지 않아요.${tombNote(p, t.env)}`;
    alternative = '원래의 월·시 풀이는 그대로 둬요.';
  }
  const question = active ? { id: `work-branch-${side}-${mode}`, prompt: ROOTING_QUESTIONS[side],
    clarifies: '천간에 드러난 계열과 다른 계열의 계절 환경이 경험에서 이어졌는지; 자기보고는 독립 적중률이 아님' } : null;
  return { policy: 'branch-season-v1', scope: 'one-side-stem-season-body', side,
    assumption: 'stem–branch rooting (same element in any natal hidden stem) where the other group is carried by the season body of a storage branch (2624·2629), read apart from a principal; 충 and 사신형 weaken the link, other 형 and 충 with a natal 합 are unknown; not verified personal effects',
    sourceParagraphs: ['SG-MID-P011', 'SG-MID-P013-02', 'SG-MID-P013-05', 'SG-MID-P013-07', 'SG-MID-P015'],
    features, candidates, selectedIds, active, mode, environments: side === 'wealth' ? { wealth: null, authority: envs } : { wealth: envs, authority: null },
    pairs: null, clashes: null, roots, facts, interpretation, reason, alternative,
    lines: active ? [interpretation, facts, reason, alternative, SEASON_ROOTING_LIMIT] : [], question,
    beforeFeedback: true, probability: null, trainingEligible: false };
}

/** Charts the stem and rooting comparisons leave to the branches; null elsewhere (their decisions are unchanged). */
export function buildBranchSeasonDecision(chart, { stems, groups, decision, rootingDecision }) {
  if (groups['재성'].status === 'absent' || groups['관성'].status === 'absent' || decision?.active || rootingDecision?.active) return null;
  if (!stems.some(m => m.group === '재성' || m.group === '관성')) return bothBranchDecision(chart);
  if (rootingDecision?.mode === 'hidden-only') return seasonRootingDecision(chart, { stems }, rootingDecision.side);
  return null;
}
