// Ten-year luck (대운) periods for the natal work readings that the reference itself leaves to luck.
// The natal decisions are not changed: the chart and the luck are read apart (사주와 대운을 따로 본다, 2479),
// and this layer only names periods. A rootless visible stem is used whenever luck brings it a root, above
// all a 대운 (2122~2125, 2166, 2172, 2180); a root under 충 is used again when a luck branch relieves the 충
// by a 합 or brings a new root (2114~2118). The luck root's principal names the environment it comes through
// (2174~2176). References/assumptions: docs/knowledge-model/CONDITIONAL_WORK_READING.md (대운의 뿌리·합).
// Period candidates only: no event, success, exact timing, 세운/월운, strength or probability.
import { STEMS_HANJA, BRANCHES_HANJA, HIDDEN_STEMS, STEM_ELEMENT, ELEMENTS, TEN_GODS, tenGod, sexStem, sexBranch, sexName } from './tables.js';
import { ROOTING_THEMES } from './rootingCandidates.js';

const POSITIONS = ['year', 'month', 'day', 'hour'];
const BRANCH_PLACE = { year: '연지', month: '월지', day: '일지', hour: '시지' };
const STEM_PLACE = { year: '연간', month: '월간', hour: '시간' };
const GROUPS = ['비겁', '식상', '재성', '관성', '인성'];
// Same themes as contextReading.js ROLES (not imported: contextReading imports this module).
const ROLES = ['자기 기준과 동료', '표현과 실행', '결과와 자원 관리', '규칙과 책임', '배움과 준비'];
const SEASON = [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3];
const SEASON_ELEMENT = [0, 1, 3, 4];
const STORAGE = [1, 4, 7, 10];
// Particles follow the reading of the last hanja: 갑을병정경신임 / 축인진신술 end in a consonant.
const FINAL = '甲乙丙丁庚辛壬丑寅辰申戌';
const josa = (character, withFinal, without) => (FINAL.includes(character) ? withFinal : without);
const ELEMENT_FINAL = [true, false, false, true, false];
const elJosa = (el, withFinal, without) => (ELEMENT_FINAL[el] ? withFinal : without);
const groupOf = (dayStem, element) => GROUPS[(element - STEM_ELEMENT[dayStem] + 5) % 5];
const pairIs = ([a, b], x, y) => (a === x && b === y) || (a === y && b === x);
// The natal relation tables of relations.js (not exported there; that file is pinned by a historical audit).
const YUKHAP = [[0, 1, 2], [2, 11, 0], [3, 10, 1], [4, 9, 3], [5, 8, 4], [6, 7, 1]];
const SAMHAP = [[8, 0, 4, 4], [5, 9, 1, 3], [2, 6, 10, 1], [11, 3, 7, 0]];
const CHUNG = [[0, 6], [1, 7], [2, 8], [3, 9], [4, 10], [5, 11]];
const SAMHYEONG = [[2, 5, 8], [1, 10, 7]];
const SANGHYEONG = [[0, 3]];
const JAHYEONG = [4, 6, 9, 11];

// Only the displayed natal readings whose reason is a luck condition in the reference.
const RULE_OF_MODE = { 'surface-only': 'rootless', 'season-surface': 'rootless', 'shaken-link': 'clashed', 'season-shaken': 'clashed' };
export const DAEUN_LIMIT = '사주와 대운을 따로 놓고 본 시기 후보예요. 대운이 시작하는 나이는 앱의 기존 대운 계산을 그대로 썼고, 세운·월운은 넣지 않았어요. 그 시기에 어떤 일이 생기거나 잘된다는 예측이 아니며, 앞의 원국 풀이는 바꾸지 않아요.';

/** The ten 대운 pillars of the existing calculation (manseryeok.js), or null when the chart has none or its
 * list does not follow the month pillar (nothing is guessed). */
export function daeunPillars(chart) {
  const d = chart?.daeun, month = chart?.pillarsIdx?.month;
  if (!d || !Array.isArray(d.list) || !d.list.length || !Number.isInteger(month)) return null;
  const birthYear = Number.isInteger(chart?.input?.year) ? chart.input.year : null;
  const periods = d.list.map((item, i) => {
    const idx = ((month + (d.forward ? i + 1 : -(i + 1))) % 60 + 60) % 60;
    return { order: i + 1, age: item.age, startYear: birthYear === null ? null : birthYear + item.age, idx, name: item.name,
      stem: sexStem(idx), branch: sexBranch(idx), ganji: STEMS_HANJA[sexStem(idx)] + BRANCHES_HANJA[sexBranch(idx)] };
  });
  return periods.every(x => x.name === sexName(x.idx) && Number.isFinite(x.age)) ? periods : null;
}

/** How one incoming branch meets the four natal branches, with the natal relation tables (relations.js).
 * 합 is a 육합 pair or two members of one 삼합 (any two, as unse.js reads an incoming branch). */
export function luckBranchRelations(pillarsIdx, branch) {
  const out = { chung: [], hap: [], sasin: [], hyeong: [] };
  for (const position of POSITIONS) {
    const b = sexBranch(pillarsIdx[position]), with_ = { position, branch: b, branchCharacter: BRANCHES_HANJA[b] };
    const name = suffix => `${BRANCHES_HANJA[Math.min(branch, b)]}${BRANCHES_HANJA[Math.max(branch, b)]}${suffix}`;
    if (CHUNG.some(p => pairIs(p, branch, b))) out.chung.push({ ...with_, name: name('충') });
    const yuk = YUKHAP.find(([x, y]) => pairIs([x, y], branch, b));
    if (yuk) out.hap.push({ ...with_, name: name('합'), kind: 'yukhap', element: yuk[2] });
    const sam = SAMHAP.find(t => t.slice(0, 3).includes(branch) && t.slice(0, 3).includes(b));
    if (sam && b !== branch) out.hap.push({ ...with_, name: name('반합'), kind: 'samhap', element: sam[3] });
    if (pairIs([5, 8], branch, b)) out.sasin.push({ ...with_, name: '사신형' });
    else if (SAMHYEONG.some(t => t.includes(branch) && t.includes(b) && b !== branch) && !CHUNG.some(p => pairIs(p, branch, b))
      || SANGHYEONG.some(p => pairIs(p, branch, b)) || (branch === b && JAHYEONG.includes(b))) out.hyeong.push({ ...with_, name: name('형') });
  }
  return out;
}

/** A luck branch as a root of an element: 'root' (usable), 'root-shaken' (충·사신형 with a natal branch, as
 * 2114~2118·2235 read a natal root), 'root-tilted' (a 합 toward another element: luck that moves a 합 weakens
 * rooting, 2188~2190), 'root-unknown' (충 with 합, other 형) or 'none'. The natal-root rules applied to a luck
 * branch are an implementation assumption. */
export function luckRootStatus(pillarsIdx, branch, element) {
  if (!HIDDEN_STEMS[branch].some(h => STEM_ELEMENT[h] === element)) return { status: 'none', relations: [] };
  const r = luckBranchRelations(pillarsIdx, branch);
  if (r.sasin.length) return { status: 'root-shaken', basis: 'sasin-hyeong', relations: r.sasin };
  if (r.chung.length && r.hap.length) return { status: 'root-unknown', basis: 'chung-with-hap', relations: [...r.chung, ...r.hap] };
  if (r.chung.length) return { status: 'root-shaken', basis: 'chung', relations: r.chung };
  if (r.hyeong.length) return { status: 'root-unknown', basis: 'other-hyeong', relations: r.hyeong };
  const away = r.hap.filter(h => h.element !== element);
  if (away.length) return { status: 'root-tilted', basis: 'hap', relations: away };
  return { status: 'root', basis: r.hap.length ? 'hap-same-element' : 'none', relations: r.hap };
}

const uniqueBy = (xs, key) => xs.filter((x, i) => xs.findIndex(y => key(y) === key(x)) === i);
const place = x => `${BRANCH_PLACE[x.position]} ${x.branchCharacter}`;
const label = x => `${x.age}세${x.startYear === null ? '' : `(${x.startYear}년)`} ${x.ganji}`;
const listPeriods = xs => `${xs.map(label).join('·')} 대운`;

export function buildDaeunTiming(chart, work) {
  const rule = work?.active ? RULE_OF_MODE[work.mode] : null;
  if (!rule || !work.roots?.length) return null;
  const periods = daeunPillars(chart);
  if (!periods) return null;
  const p = chart.pillarsIdx, dayStem = sexStem(p.day), t = ROOTING_THEMES[work.side];
  const element = STEM_ELEMENT[work.roots[0].stem];
  const stemText = uniqueBy(work.roots, r => r.position).map(r => `${STEM_PLACE[r.position]} ${r.character}`).join(', ');
  const stemLast = work.roots.at(-1).character;
  // The environment follows the decision's own definition: a principal, and for the season decision also a
  // storage branch whose season is the other group (branchSeasonCandidates.js).
  const envOf = branch => {
    const main = HIDDEN_STEMS[branch].at(-1);
    return groupOf(dayStem, STEM_ELEMENT[main]) === t.env
      || (work.policy === 'branch-season-v1' && STORAGE.includes(branch) && groupOf(dayStem, SEASON_ELEMENT[SEASON[branch]]) === t.env);
  };
  // Roots under natal 충 (2114~2118); a root weakened only by 사신형 has no luck rule in the reference.
  const clashed = rule === 'clashed' ? uniqueBy(work.roots.flatMap(r => r.places.filter(x => x.link && x.state.basis === 'chung')), x => x.position) : [];
  const applicable = rule === 'rootless' || clashed.length > 0;
  const read = periods.map(period => {
    const main = HIDDEN_STEMS[period.branch].at(-1);
    const principal = { character: STEMS_HANJA[main], tenGod: TEN_GODS[tenGod(dayStem, main)], group: groupOf(dayStem, STEM_ELEMENT[main]) };
    const root = luckRootStatus(p, period.branch, element);
    const rel = luckBranchRelations(p, period.branch);
    const relieves = clashed.filter(x => rel.hap.some(h => h.position === x.position));
    const relief = relieves.length
      ? { status: rel.chung.length || rel.sasin.length || rel.hyeong.length ? 'relieve-unknown' : 'relieve', relieves: relieves.map(x => x.position),
        haps: rel.hap.filter(h => relieves.some(x => x.position === h.position)), relations: [...rel.chung, ...rel.sasin, ...rel.hyeong] }
      : null;
    const envLink = envOf(period.branch);
    // Under 충 the displayed reading is the link to the other group's environment, so only a new root that is
    // itself that environment re-grounds it; a root elsewhere is kept in the record only.
    const status = !applicable ? 'no-rule' : relief ? relief.status
      : rule === 'clashed' && root.status !== 'none' && !envLink ? 'root-elsewhere' : root.status;
    return { ...period, status, root, relief, principal, envLink };
  });
  const usable = read.filter(x => x.status === 'root' || x.status === 'relieve');
  const active = applicable;
  const is = (...statuses) => read.filter(x => statuses.includes(x.status));
  const lines = [];
  if (active) {
    const rooted = is('root');
    const role = x => `‘${ROLES[GROUPS.indexOf(x.principal.group)]}’`;
    const rootFact = x => `${label(x)} 대운은 ${BRANCHES_HANJA[x.branch]}의 지장간에 같은 ${ELEMENTS[element]} 기운이 있고 본기가 ${x.principal.character}(${x.principal.tenGod})${josa(x.principal.character, '이라', '라')}`;
    if (rule === 'rootless') {
      lines.push(usable.length
        ? `원국 비교와 따로 대운만 겹쳐 보면, 뿌리가 없던 ${stemText}${josa(stemLast, '이', '가')} 대운 지지에서 뿌리를 얻는 때를 ${t.work}이 준비 상태에서 실제 활동으로 드러나기 쉬운 시기 후보로 읽어요.`
        : `원국 비교와 따로 대운만 겹쳐 보면, 열 개 대운의 지지 어디에서도 ${stemText}${josa(stemLast, '이', '가')} 쓸 수 있는 뿌리를 얻지 못해 대운으로 드러나기 쉬운 시기 후보를 정하지 않아요.`);
      if (rooted.length) lines.push(rooted.map(x => (x.envLink
        ? `${rootFact(x)}, ${t.env}의 환경인 ${t.envTheme} 환경을 근거로 드러나는 쪽이에요.`
        : `${rootFact(x)}, 그 본기의 ${role(x)} 쪽 환경에서 드러나는 쪽이에요.`)).join(' '));
    } else {
      const clashPlaces = clashed.map(place).join('·');
      lines.push(usable.length
        ? `원국 비교와 따로 대운만 겹쳐 보면, 충을 받은 ${clashPlaces}의 뿌리로 흔들리던 ${stemText}의 근거를 다시 쓰기 쉬운 대운을 시기 후보로 읽어요.`
        : `원국 비교와 따로 대운만 겹쳐 보면, 열 개 대운 가운데 충을 받은 ${clashPlaces}의 충을 풀어 주거나 ${t.env}의 환경으로 새 뿌리가 되는 대운이 없어 시기 후보를 정하지 않아요.`);
      if (usable.length) lines.push(usable.map(x => (x.status === 'relieve'
        ? `${label(x)} 대운은 ${x.relief.haps.map(h => h.name).join('·')}으로 충을 풀어 줘서, ${t.envTheme} 환경에 둔 원래 뿌리를 쓰기 쉬운 때예요.`
        : `${rootFact(x)}, ${t.env}의 환경으로 새 뿌리가 돼 ${t.envTheme} 환경을 근거로 다시 드러나는 때예요.`)).join(' '));
    }
    // Relations of one luck branch grouped by name: '일지·시지 丑과 丑未충'.
    const relText = rels => [...new Set(rels.map(h => h.name))].map(name => {
      const hs = rels.filter(h => h.name === name);
      return `${hs.map(h => BRANCH_PLACE[h.position]).join('·')} ${hs[0].branchCharacter}${josa(hs[0].branchCharacter, '과', '와')} ${name}`;
    }).join(', ');
    const shaken = is('root-shaken'), tilted = is('root-tilted'), unknown = is('root-unknown', 'relieve-unknown');
    const lower = [
      ...shaken.map(x => `${label(x)} 대운은 뿌리가 되지만 원국 ${relText(x.root.relations)}이라 흔들리며 드러나는 쪽으로 낮춰 읽어요`),
      ...tilted.map(x => `${label(x)} 대운은 뿌리가 되지만 원국 ${relText(x.root.relations)}을 이뤄 합의 기운(${[...new Set(x.root.relations.map(h => ELEMENTS[h.element]))].join('·')})으로 기울 수 있어 약하게 봐요`),
      unknown.length && `${listPeriods(unknown)}은 원국 지지와 충·합·형이 겹쳐 정하지 않아요`,
    ].filter(Boolean);
    if (lower.length) lines.push(`${lower.join('. ')}.`);
    lines.push(rule === 'rootless'
      ? '뿌리가 없는 천간은 운에서 뿌리를 만날 때마다 쓰이고, 특히 대운에서 뿌리를 얻으면 원국에 있는 것처럼 뚜렷하게 드러난다는 기준과, 운에서 들어온 뿌리의 십성으로 어느 쪽에서 주체성이 생기는지 읽는 예시를 따랐어요. 대운 지지가 원국과 충·형·합을 이룰 때 낮추거나 보류한 것은 원국 뿌리에 쓰던 기준을 대운에 옮긴 가정이에요.'
      : `뿌리를 둔 지지가 충을 받으면 그 뿌리를 제대로 쓰기 어렵지만, 충을 풀어 주는 합운이나 뿌리가 되는 운이 오면 그때마다 쓸 수 있다는 기준을 따랐어요. 원문은 어느 글자와의 합인지 적지 않아 충을 받은 뿌리 지지와 직접 합하는 대운만 골랐고, 새 뿌리는 원국 풀이처럼 ${t.env}의 환경인 지지만 셌어요. 새 뿌리가 원국과 충·형·합을 이룰 때 낮추거나 보류한 것은 원국 뿌리의 기준을 대운에 옮긴 가정이에요.`);
    lines.push(DAEUN_LIMIT);
  }
  return { policy: 'daeun-timing-v1', scope: 'natal-decision-and-daeun-apart', rule, target: { policy: work.policy, mode: work.mode, side: work.side },
    applicable, element, clashed: clashed.map(x => x.position),
    daeun: { su: chart.daeun.su, forward: chart.daeun.forward }, periods: read,
    candidates: usable.map(x => ({ order: x.order, age: x.age, ganji: x.ganji, status: x.status, envLink: x.envLink })),
    active, lines,
    assumption: 'reference rules on luck roots (2114~2125, 2166, 2172, 2180) applied to each 대운 branch; the natal-root 충·사신형 weakening, the 2188~2190 합 weakening and 충 with 합 unknown are carried over to the luck branch as assumptions; a 합 relieves a natal 충 only when it meets the clashed root branch; periods are candidates, not events or measured timing',
    sourceLines: [2114, 2118, 2122, 2125, 2166, 2172, 2176, 2180, 2188, 2190, 2479],
    natalDecisionUnchanged: true, beforeFeedback: true, probability: null, trainingEligible: false };
}
