// Research-only symbol comparison. Does not calculate births or interpret people.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { HIDDEN_STEMS, STEMS_HANJA, BRANCHES_HANJA, TEN_GODS,
  TWELVE_STAGES, tenGod, twelveStage, sexStem, sexBranch } from '../../dosa-app/engine/src/tables.js';

const positions = ['year', 'month', 'day', 'hour'];

export function observe(pillars) {
  if (!Array.isArray(pillars) || pillars.length !== 4 ||
      !Array.from(pillars).every(x => x === null || (Number.isInteger(x) && x >= 0 && x < 60)))
    throw new Error('Expected four symbolic pillar indices (0..59 or null).');
  const complete = pillars.every(x => x !== null);
  const result = { inputKind: 'symbolic_pillars_not_birth_validation', pillars: [...pillars],
    scope: pillars[2] === null ? 'unknown' : pillars[2] === 50 ? 'met' : 'unmet',
    observations: null, sourcePresence: 'unknown', sourceAbsence: 'unknown',
    personalApplication: 'withheld', trainingEligible: false, probability: null };
  // Missing symbols are not absent symbols. Keep the existing conservative boundary.
  if (!complete || pillars[2] !== 50) return result;
  const dayStem = sexStem(pillars[2]), dayBranch = sexBranch(pillars[2]);
  const hidden = HIDDEN_STEMS[dayBranch];
  const markers = positions.flatMap((position, i) => {
    const stems = HIDDEN_STEMS[sexBranch(pillars[i])];
    return [ ...(position === 'day' ? [] : [{ position, part: 'stem', stem: sexStem(pillars[i]) }]),
      ...stems.map((stem, j) => ({ position, part: 'hidden_stem', stem, principal: j === stems.length - 1 })) ];
  }).filter(m => [2, 3].includes(tenGod(dayStem, m.stem)))
    .map(m => ({ ...m, symbol: STEMS_HANJA[m.stem], tenGod: TEN_GODS[tenGod(dayStem, m.stem)] }));
  const scope = rows => ({ present: rows.length > 0, markers: rows });
  result.observations = {
    tablePolicy: 'existing-tables-stems-and-hidden-v1',
    dayStem: STEMS_HANJA[dayStem], dayBranch: BRANCHES_HANJA[dayBranch],
    hidden: hidden.map(stem => ({ symbol: STEMS_HANJA[stem], tenGod: TEN_GODS[tenGod(dayStem, stem)] })),
    principal: STEMS_HANJA[hidden.at(-1)], principalTenGod: TEN_GODS[tenGod(dayStem, hidden.at(-1))],
    stage: TWELVE_STAGES[twelveStage(dayStem, dayBranch)],
    scopes: {
      stemsOnly: scope(markers.filter(m => m.part === 'stem')),
      stemsAndPrincipal: scope(markers.filter(m => m.part === 'stem' || m.principal)),
      stemsAndAllHidden: scope(markers),
    },
  };
  return result;
}

export function measure() {
  // 180 labelled axis cases, 178 unique vectors. No real-person sample or frequency estimate.
  const rows = [];
  for (const axis of [0, 1, 3]) for (let index = 0; index < 60; index++) {
    const pillars = [0, 0, 50, 0]; pillars[axis] = index;
    const result = observe(pillars);
    rows.push({ axis: positions[axis], index, pillars,
      present: Object.fromEntries(Object.entries(result.observations.scopes).map(([k, v]) => [k, v.present])),
      sourcePresence: result.sourcePresence, sourceAbsence: result.sourceAbsence });
  }
  const sum = key => rows.filter(r => r.present[key]).length;
  return { schemaVersion: 1, cases: rows.length,
    uniqueVectors: new Set(rows.map(r => JSON.stringify(r.pillars))).size,
    presentCounts: Object.fromEntries(['stemsOnly', 'stemsAndPrincipal', 'stemsAndAllHidden'].map(k => [k, sum(k)])),
    rows, trainingEligible: 0, probability: null };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--measure') console.log(JSON.stringify(measure()));
  else if (args.length === 0) console.log(JSON.stringify(observe(JSON.parse(readFileSync(0, 'utf8')))));
  else throw new Error('Use stdin JSON array or --measure.');
}
