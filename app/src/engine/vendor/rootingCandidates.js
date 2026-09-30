// Stem–branch rooting comparison for charts whose wealth (재성) or authority (관성) shows in the
// natal stems on one side only. The stem–stem comparison (workCandidates.js) cannot apply there, and
// the reference reads a stem and a branch by rooting (통근), not by 재생관 (2059~2067, 1017~1018).
// References/assumptions: docs/knowledge-model/CONDITIONAL_WORK_READING.md (한쪽만 천간).
// Rooting existence only: no strength, distance weight, 12-stage, day-master capacity or probability.
import { BRANCHES_HANJA, HIDDEN_STEMS, STEM_ELEMENT, ELEMENTS, sexBranch } from './tables.js';
import { detectRelations } from './relations.js';
import { evaluateCondition } from './workCandidates.js';

const POSITIONS = ['year', 'month', 'day', 'hour'];
const BRANCH_PLACE = { year: '연지', month: '월지', day: '일지', hour: '시지' };
const STEM_PLACE = { year: '연간', month: '월간', hour: '시간' };
const POS_KR = { year: '년', month: '월', day: '일', hour: '시' };
// 사공's 인원용사 table for the year/day/hour branches differs from the month table (the engine's)
// in five branches (FOUNDATION_MONTH_PERIODS.md). Recorded per root; the decision uses the engine table,
// which equals the rooting table of the reference (2080~2085).
const PERSONNEL_TABLE = { 0: [9], 3: [1], 6: [5, 3], 9: [7], 11: [0, 8] };
// Particles follow the reading of the last hanja: 갑을병정경신임 / 축인진신술 end in a consonant.
const FINAL = '甲乙丙丁庚辛壬丑寅辰申戌';
const josa = (character, withFinal, without) => (FINAL.includes(character) ? withFinal : without);

export const ROOTING_THEMES = Object.freeze({
  wealth: { stem: '재성', env: '관성', work: '성과·자원을 다루는 일', envTheme: '기준·책임', grounded: '그 환경을 근거로 나오는 활동으로' },
  authority: { stem: '관성', env: '재성', work: '기준·책임을 맡는 일', envTheme: '성과·자원', grounded: '그 환경을 근거로 맡는 역할로' },
});
/** One app-owned question per side: did the other group's environment help the visible side? */
export const ROOTING_QUESTIONS = Object.freeze({
  wealth: '기준·책임이 정해진 환경(조직의 규칙, 맡은 자리 등)이 성과·자원을 다루는 일에 도움이 된 경험이 있나요?',
  authority: '성과·자원을 다루는 환경(수입·예산·실적을 관리하는 자리 등)이 기준·책임을 맡는 일에 도움이 된 경험이 있나요?',
});
export const ROOTING_LIMIT = '천간과 지지 사이를 뿌리(통근)로만 비교한 해석 가설이에요. 천간끼리의 재생관, 지지 안의 복합 작용(체용), 강약과 운의 시기는 넣지 않았고, 직업 적성·성공·개인 사건을 정하지 않아요.';

const feature = name => ({ feature: name });
const not = expression => ({ not: expression });
const all = (...expressions) => ({ all: expressions.map(e => (typeof e === 'string' ? feature(e) : e)) });
const RULES = scope => [
  { id: 'grounded-link', condition: all(scope, 'otherPrincipal', 'rootedInOther'), counter: not(feature('linkUsable')),
    label: '천간에 드러난 계열이 다른 계열의 지지 환경에 뿌리를 둔 연결' },
  { id: 'shaken-link', condition: all(scope, 'otherPrincipal', 'rootedInOther', not(feature('linkUsable'))),
    label: '뿌리로 이어졌지만 그 지지가 충·사신형을 받은 연결' },
  { id: 'separate-roots', condition: all(scope, 'otherPrincipal', 'stemRooted', not(feature('rootedInOther'))),
    label: '서로 다른 자리에 뿌리를 둔 두 계열' },
  { id: 'surface-only', condition: all(scope, 'otherPrincipal', not(feature('stemRooted'))),
    label: '뿌리 없이 천간에만 드러난 계열' },
];

export function compareRootingCandidates(features, scope) {
  return RULES(scope).map(rule => {
    const condition = evaluateCondition(rule.condition, features);
    const counter = rule.counter ? evaluateCondition(rule.counter, features) : null;
    const status = condition.value === 0 ? 'inapplicable' : condition.value === null ? 'withheld'
      : counter?.value === 1 ? 'weakened' : counter?.value === null ? 'withheld' : 'selected';
    return { id: rule.id, label: rule.label, status, condition, counter };
  });
}

/** Whether a root branch can be used (0), is under 충/사신형 (1) or has no rule in the reference (null).
 * 2114~2118: a root under 충 is hard to use, and a 합 from luck makes it usable; 2235: 사신형 example;
 * 2188: a natal 합 keeps the root. Other 형, and 충 together with a natal 합, stay unknown. */
export function rootState(pillarsIdx, position, relations = detectRelations(pillarsIdx)) {
  const at = r => r.positions.includes(POS_KR[position]);
  const branches = POSITIONS.map(p => sexBranch(pillarsIdx[p])), branch = sexBranch(pillarsIdx[position]);
  const chung = relations.chung.filter(at).map(r => r.name);
  const hap = [...relations.yukhap, ...relations.samhap, ...relations.banghap].filter(at).map(r => r.name);
  const hyeong = relations.hyeong.filter(at).map(r => r.name);
  if ((branch === 5 && branches.includes(8)) || (branch === 8 && branches.includes(5)))
    return { value: 1, basis: 'sasin-hyeong', names: ['사신형'] };
  if (chung.length && hap.length) return { value: null, basis: 'chung-with-hap', names: [...chung, ...hap] };
  if (chung.length) return { value: 1, basis: 'chung', names: chung };
  if (hyeong.length) return { value: null, basis: 'other-hyeong', names: hyeong };
  return { value: 0, basis: 'none', names: [] };
}

const uniqueBy = (xs, key) => xs.filter((x, i) => xs.findIndex(y => key(y) === key(x)) === i);

/** Charts with 재성 or 관성 in the stems on one side only (the other group in the branches). */
export function buildRootingDecision(chart, { stems, hidden, groups }) {
  const wealth = stems.filter(m => m.group === '재성'), authority = stems.filter(m => m.group === '관성');
  if (groups['재성'].status === 'absent' || groups['관성'].status === 'absent' || !wealth.length === !authority.length) return null;
  const side = wealth.length ? 'wealth' : 'authority', t = ROOTING_THEMES[side], scope = `${side}StemOnly`;
  const p = chart.pillarsIdx, sideStems = side === 'wealth' ? wealth : authority;
  const branchChar = q => BRANCHES_HANJA[sexBranch(p[q])], relations = detectRelations(p);
  const principals = hidden.filter(m => m.principal);
  // The other group is only in the branches: as a branch principal (its environment) or only as another hidden stem.
  const envs = principals.filter(m => m.group === t.env);
  const hiddenOnly = hidden.filter(m => !m.principal && m.group === t.env);
  // A stem roots in a branch holding a hidden stem of its element, at any distance (1902~1930, 2080~2085).
  const roots = sideStems.map(stem => ({ position: stem.position, stem: stem.stem, character: stem.character, tenGod: stem.tenGod,
    places: POSITIONS.filter(q => HIDDEN_STEMS[sexBranch(p[q])].some(h => STEM_ELEMENT[h] === STEM_ELEMENT[stem.stem])).map(q => {
      const branch = sexBranch(p[q]), main = principals.find(m => m.position === q);
      const personnel = q !== 'month' && PERSONNEL_TABLE[branch];
      return { position: q, branch, branchCharacter: BRANCHES_HANJA[branch],
        principal: { character: main.character, tenGod: main.tenGod, group: main.group },
        sameStem: HIDDEN_STEMS[branch].includes(stem.stem), link: main.group === t.env,
        otherTable: personnel && !personnel.some(h => STEM_ELEMENT[h] === STEM_ELEMENT[stem.stem]) ? 'lost' : 'kept',
        state: rootState(p, q, relations) };
    }) }));
  const links = roots.flatMap(r => r.places.filter(x => x.link).map(x => ({ ...x, root: r })));
  const linkUsable = links.some(x => x.state.value === 0) ? 1 : links.some(x => x.state.value === null) ? null : 0;
  const features = { [scope]: 1, otherPrincipal: +!!envs.length, stemRooted: +roots.some(r => r.places.length),
    rootedInOther: +!!links.length, linkUsable };
  const candidates = compareRootingCandidates(features, scope);
  const selectedIds = candidates.filter(c => c.status === 'selected').map(c => c.id);
  const active = selectedIds.length === 1;
  const mode = active ? selectedIds[0] : features.otherPrincipal ? 'link-withheld' : 'hidden-only';

  const stemText = m => `${STEM_PLACE[m.position]} ${m.character}`;
  const place = x => `${BRANCH_PLACE[x.position]} ${x.branchCharacter}`;
  const envText = m => `${BRANCH_PLACE[m.position]} ${branchChar(m.position)}의 ${m.character}(${m.tenGod})`;
  const last = xs => xs.at(-1);
  const facts = [
    `천간에 드러난 ${t.stem}은 ${sideStems.map(m => `${stemText(m)}(${m.tenGod})`).join(', ')}${josa(last(sideStems).character, '이에요', '예요')}.`,
    envs.length ? `${t.env}은 천간에 없고, 지지 본기로 ${envs.map(envText).join(', ')}${josa(last(envs).character, '이', '가')} 있어요.`
      : `${t.env}은 천간과 지지 본기에 없고, ${hiddenOnly.map(m => `${BRANCH_PLACE[m.position]} ${branchChar(m.position)}의 지장간 ${m.character}(${m.tenGod})`).join(', ')}에만 있어요.`,
    ...roots.map(r => (r.places.length
      ? `${stemText(r)}${josa(r.character, '은', '는')} ${r.places.map(place).join('·')}에 같은 ${ELEMENTS[STEM_ELEMENT[r.stem]]} 기운의 지장간이 있어 뿌리를 둬요.`
      : `${stemText(r)}${josa(r.character, '은', '는')} 네 지지의 지장간에 같은 오행이 없어 뿌리가 없어요.`)),
  ].join(' ');
  const shown = mode === 'grounded-link' ? links.filter(x => x.state.value === 0) : links;
  const shownPlaces = uniqueBy(shown, place), shownStems = uniqueBy(shown.map(x => x.root), stemText);
  const linkPlaces = shownPlaces.map(place).join('·'), linkStems = shownStems.map(stemText).join(', ');
  const linkSubject = shown.length ? `${linkStems}${josa(last(shownStems).character, '이', '가')}` : '';
  const linkPlaceTopic = shown.length ? josa(last(shownPlaces).branchCharacter, '은', '는') : '';
  const envPlaces = uniqueBy(envs, m => m.position).map(m => `${BRANCH_PLACE[m.position]} ${branchChar(m.position)}`).join('·');
  const relNames = [...new Set(shown.flatMap(x => x.state.names))].join('·');
  let interpretation, reason, alternative;
  if (mode === 'grounded-link') {
    interpretation = `겉으로 드러난 ${t.work}이 ${linkPlaces}의 ${t.envTheme} 환경에 뿌리를 두고 있어, ${t.grounded} 먼저 읽어요.`;
    reason = `${linkSubject} 뿌리를 둔 ${linkPlaces}${linkPlaceTopic} 본기가 ${t.env}이라, 천간의 ${t.stem}과 지지의 ${t.env}이 뿌리로 이어져요. 천간끼리의 재생관과는 다른 관계라서, 한쪽이 다른 쪽을 키운다고 읽지는 않아요.`;
    alternative = `${t.envTheme}은 천간에 드러나지 않아, 스스로 내세우는 목표보다 놓인 환경에 가까운 주제로 둬요. 뿌리로 이어졌다고 그 환경이 늘 도움이 됐다는 뜻은 아니어서, 따로 움직였거나 부딪힌 경험이면 이 후보를 낮춰야 해요.`;
  } else if (mode === 'shaken-link') {
    const bases = shown.map(x => x.state.basis);
    interpretation = `겉으로 드러난 ${t.work}이 ${linkPlaces}의 ${t.envTheme} 환경에 뿌리를 두지만, 그 지지가 ${relNames}에 걸려 있어 그 근거를 꾸준히 쓰기보다 흔들리거나 방식이 바뀌는 경우를 함께 읽어요.`;
    const grounds = [
      bases.includes('chung') && '뿌리를 둔 지지가 충을 받으면 그 뿌리를 제대로 쓰기 어렵고, 충을 풀어 주는 합이나 뿌리가 되는 운이 올 때 쓰인다는 기준',
      bases.includes('sasin-hyeong') && '사신형에 걸린 지지의 뿌리는 제대로 쓰지 못한다는 예시',
    ].filter(Boolean);
    reason = `${linkSubject} 뿌리를 둔 ${linkPlaces}${linkPlaceTopic} 본기가 ${t.env}이에요. ${grounds.join('과 ')}${grounds.at(-1).endsWith('예시') ? '를' : '을'} 따라 뿌리로 이어진 연결 후보를 낮췄어요.`;
    alternative = '충·형이 있다고 연결이 끊겼거나 실패한다는 뜻은 아니에요. 그 환경이 도움이 된 때와 흔들린 때가 함께 있었는지 경험으로 나눠 봐야 해요.';
  } else if (mode === 'separate-roots') {
    const rootPlaces = uniqueBy(roots.flatMap(r => r.places), place).map(x => `${place(x)}(본기 ${x.principal.tenGod})`).join(', ');
    interpretation = `겉으로 드러난 ${t.work}은 ${t.envTheme} 환경과는 다른 자리에 뿌리를 두고 있어, 두 주제를 따로 읽어요. ${t.envTheme}은 스스로 내세우는 목표라기보다 놓인 환경에 가까운 주제로 둬요.`;
    reason = `${t.stem}의 뿌리는 ${rootPlaces}에 있고, ${t.env}은 ${envPlaces}의 본기로만 있어요. 천간의 ${t.stem}과 지지의 ${t.env}이 뿌리로 이어지지 않아요.`;
    alternative = `뿌리로 이어지지 않았다고 두 주제가 부딪히거나 관계없다는 뜻은 아니에요. 운의 시기나 다른 관계로 이어질 수 있어서, ${t.envTheme} 환경이 도움이 된 경험이 있으면 이 후보를 낮춰야 해요.`;
  } else if (mode === 'surface-only') {
    interpretation = `${t.work}은 겉으로 드러나 있지만 지지에 뿌리가 없어, 늘 이어지는 기반보다 때에 따라 나타나는 준비 상태로 읽어요. ${t.envTheme}은 ${envPlaces}의 환경으로 따로 있어요.`;
    reason = `천간 ${t.stem}의 오행이 네 지지의 지장간 어디에도 없어 뿌리를 두지 못했어요. 뿌리가 없는 천간은 운에서 뿌리를 만날 때 드러난다고 보는 기준을 따랐어요.`;
    alternative = `뿌리가 없다고 능력이 없거나 나쁘다는 뜻은 아니에요. ${t.envTheme} 환경이 ${t.work}에 도움이 된 경험이 있으면 이 후보를 낮춰야 해요.`;
  } else if (mode === 'link-withheld') {
    // Kept in the record only: the existing reading stays on screen.
    interpretation = `${t.stem}이 ${t.env}의 지지 환경에 뿌리를 두지만, 그 지지의 관계가 뿌리를 쓰는 데 주는 영향을 정하는 기준이 없어 이 비교는 보류해요.`;
    reason = `${linkPlaces}에는 ${relNames} 관계가 함께 있어요. 참고 기준은 충(합의 운이 오면 풀림)과 사신형만 다루고, 다른 형이나 충과 합이 원국에 함께 있는 경우는 다루지 않아요.`;
    alternative = '원래의 월·시 풀이는 그대로 둬요.';
  } else {
    interpretation = `${t.env}이 지지 본기에 없고 지장간에만 있어, 천간과 지지를 뿌리로 비교하는 후보는 보류해요.`;
    reason = `지지의 십성은 본기로 읽는데 ${t.env}은 본기가 아닌 지장간에만 있어요. 지지 안의 복합 작용은 체용론 없이 판단하기 어렵다는 기준을 따랐어요.`;
    alternative = '원래의 월·시 풀이는 그대로 둬요.';
  }
  const question = active ? { id: `work-rooting-${side}-${mode}`, prompt: ROOTING_QUESTIONS[side],
    clarifies: '천간에 드러난 계열과 다른 계열의 지지 환경이 경험에서 이어졌는지; 자기보고는 독립 적중률이 아님' } : null;
  return { policy: 'stem-branch-rooting-v1', scope: 'one-side-natal-stem-and-branches', side,
    assumption: 'rooting (same element in any natal hidden stem, engine table = the reference rooting table) read as the grounding of a visible stem in a branch environment named by its principal; 충 and 사신형 weaken the link, other 형 and 충 with a natal 합 are unknown; not verified personal effects',
    sourceParagraphs: ['SG-MID-P012-02', 'SG-MID-P013-01', 'SG-MID-P013-02', 'SG-MID-P013-03', 'SG-MID-P013-05', 'SG-MID-P013-07', 'SG-MID-P013-08', 'SG-MID-P013-09'],
    features, candidates, selectedIds, active, mode, roots, facts, interpretation, reason, alternative,
    lines: active ? [interpretation, facts, reason, alternative, ROOTING_LIMIT] : [], question,
    beforeFeedback: true, probability: null, trainingEligible: false };
}
