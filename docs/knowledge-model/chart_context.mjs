// Research bridge: canonical L1 calculation -> measured facts, never interpretation scores.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { computeChart } from '../../dosa-app/engine/src/manseryeok.js';
import { STEMS_HANJA, BRANCHES_HANJA, STEM_ELEMENT, BRANCH_ELEMENT, ELEMENTS,
  HIDDEN_STEMS, TEN_GODS, tenGod } from '../../dosa-app/engine/src/tables.js';

export const POLICY = 'chart-observations-v1';
const POS = ['year', 'month', 'day', 'hour'];
const SCOPES = ['daewoon', 'yearly', 'monthly'];
// Same triples/order as L1 relations.js; center inclusion is reviewed against source P530–532.
const SAMHAP = [[8, 0, 4], [5, 9, 1], [2, 6, 10], [11, 3, 7]];
const termsFile = new URL('../../dosa-app/engine/data/solar_terms.json', import.meta.url);
const { terms } = JSON.parse(readFileSync(termsFile, 'utf8'));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const any = (xs) => xs.includes(1) ? 1 : xs.includes(null) ? null : 0;
const eq = (value, expected) => value === null ? null : Number(value === expected);
const index = (value) => value === null || Number.isInteger(value) && value >= 0 && value < 60;

function requireIndex(value) {
  if (!index(value)) throw new Error('Pillars must be integer sexagenary indices [0,59] or null');
}

/** Incoming missing member completes an existing center-containing pair.
 * This is a source-specific structural trigger, not automatic transformation.
 */
export function completesSamhap(branches, incoming) {
  if (incoming === null || branches.includes(null)) return null;
  const have = new Set(branches);
  return Number(SAMHAP.some((group) => {
    const missing = group.filter((x) => !have.has(x));
    return have.has(group[1]) && missing.length === 1 && missing[0] === incoming;
  }));
}

/** Pure adapter also accepts explicitly unknown pillars; it never fills a missing hour. */
export function observations(pillars, incoming = {}) {
  if (!pillars || Object.keys(pillars).length !== 4 || POS.some((p) => !Object.hasOwn(pillars, p)))
    throw new Error('Exactly year, month, day, hour pillars are required; use null for unknown');
  POS.forEach((p) => requireIndex(pillars[p]));
  if (Object.keys(incoming).some((s) => !SCOPES.includes(s))) throw new Error('Unknown time scope');
  SCOPES.forEach((s) => requireIndex(incoming[s] ?? null));
  const stems = POS.map((p) => pillars[p] === null ? null : pillars[p] % 10);
  const branches = POS.map((p) => pillars[p] === null ? null : pillars[p] % 12);
  const master = stems[2];
  const features = {}, bounds = {};
  const putCount = (key, values) => {
    const n = values.filter((x) => x === 1).length, unknown = values.filter((x) => x === null).length;
    features[key + '.present'] = any(values);
    features[key + '.fraction'] = unknown ? null : n / values.length;
    bounds[key + '.fraction'] = [n / values.length, (n + unknown) / values.length];
  };
  POS.forEach((pos, i) => {
    STEMS_HANJA.forEach((name, n) => { features[`natal.${pos}.stem.${name}`] = eq(stems[i], n); });
    BRANCHES_HANJA.forEach((name, n) => { features[`natal.${pos}.branch.${name}`] = eq(branches[i], n); });
  });
  STEMS_HANJA.forEach((name, n) => putCount('natal.stem.' + name, stems.map((x) => eq(x, n))));
  BRANCHES_HANJA.forEach((name, n) => putCount('natal.branch.' + name, branches.map((x) => eq(x, n))));
  const surface = [...stems.map((x) => x === null ? null : STEM_ELEMENT[x]),
    ...branches.map((x) => x === null ? null : BRANCH_ELEMENT[x])];
  ELEMENTS.forEach((name, n) => {
    putCount('natal.surface_element.' + name, surface.map((x) => eq(x, n)));
    features['natal.stem_element.' + name + '.present'] = any(stems.map((s) => eq(s === null ? null : STEM_ELEMENT[s], n)));
  });
  // Surface branch element and hidden stems remain distinct scopes.
  for (const [role, delta] of [['wealth', 2], ['authority', 3]]) {
    const target = master === null ? null : (STEM_ELEMENT[master] + delta) % 5;
    features[`natal.surface_role.${role}.present`] = target === null ? null : any(surface.map((x) => eq(x, target)));
    features[`natal.hidden_role.${role}.present`] = target === null ? null : any(branches.map((b) =>
      b === null ? null : Number(HIDDEN_STEMS[b].some((s) => STEM_ELEMENT[s] === target))));
  }
  for (const scope of SCOPES) {
    const pillar = incoming[scope] ?? null;
    const stem = pillar === null ? null : pillar % 10, branch = pillar === null ? null : pillar % 12;
    STEMS_HANJA.forEach((name, n) => { features[`time.${scope}.stem.${name}`] = eq(stem, n); });
    BRANCHES_HANJA.forEach((name, n) => { features[`time.${scope}.branch.${name}`] = eq(branch, n); });
    const god = master === null || stem === null ? null : tenGod(master, stem);
    TEN_GODS.forEach((name, n) => { features[`time.${scope}.stem_ten_god.${name}`] = eq(god, n); });
    features[`time.${scope}.completes_centered_samhap`] = completesSamhap(branches, branch);
  }
  return { features, bounds };
}

export function parseInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new Error('Timestamp must include UTC offset and have whole-minute precision');
  const [year, month, day, hour, minute] = value.slice(0, 16).split(/[-T:]/).map(Number);
  validDate(year, month, day);
  if (hour > 23 || minute > 59 || !Number.isFinite(Date.parse(value))) throw new Error('Invalid timestamp');
  return Date.parse(value);
}

function validDate(year, month, day) {
  if (![year, month, day].every(Number.isInteger) || year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 ||
      new Date(Date.UTC(year, month - 1, day)).getUTCDate() !== day) throw new Error('Invalid or unsupported Gregorian date');
}

export function selectDaewoon(periods, at) {
  if (!Array.isArray(periods)) throw new Error('daewoon_periods must be an array');
  if (!Number.isFinite(at)) throw new Error('Daewoon selection requires a finite evaluation instant');
  const rows = periods.map((p) => {
    if (!p || typeof p !== 'object' || Object.keys(p).some((k) => !['start', 'end', 'pillar', 'source'].includes(k)))
      throw new Error('Invalid daewoon period');
    requireIndex(p.pillar);
    if (p.pillar === null || typeof p.source !== 'string' || !p.source.trim()) throw new Error('Daewoon period needs a pillar and source policy');
    const start = parseInstant(p.start), end = parseInstant(p.end);
    if (start >= end) throw new Error('Daewoon period must have start < end');
    return { ...p, startMs: start, endMs: end };
  }).sort((a, b) => a.startMs - b.startMs);
  for (let i = 1; i < rows.length; i++) if (rows[i].startMs < rows[i-1].endMs) throw new Error('Overlapping daewoon periods');
  const active = rows.find((p) => p.startMs <= at && at < p.endMs);
  return active ? { status: 'supplied_period', pillar: active.pillar, start: active.start, end: active.end, source: active.source } :
    { status: 'unknown_period', pillar: null };
}

function validateBirth(input) {
  const allowed = ['year', 'month', 'day', 'hour', 'minute', 'gender', 'timeZone', 'longitude', 'solarTimeCorrection', 'lateZiRule'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((k) => !allowed.includes(k)))
    throw new Error('Invalid birth input fields');
  validDate(input.year, input.month, input.day);
  if (input.hour !== null && (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23)) throw new Error('hour must be 0..23 or explicitly null');
  if (input.hour === null && input.minute !== undefined && input.minute !== null) throw new Error('Unknown hour cannot have a known minute');
  if (input.hour !== null && (!Number.isInteger(input.minute ?? 0) || (input.minute ?? 0) < 0 || (input.minute ?? 0) > 59)) throw new Error('Invalid minute');
  if (!['M', 'F'].includes(input.gender)) throw new Error('Explicit M/F calculator policy is required');
  if (input.longitude !== undefined && (!Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180)) throw new Error('Invalid longitude');
  if (input.solarTimeCorrection !== undefined && typeof input.solarTimeCorrection !== 'boolean') throw new Error('Invalid solarTimeCorrection');
  if (input.lateZiRule !== undefined && !['midnight23', 'keepDay'].includes(input.lateZiRule)) throw new Error('Invalid lateZiRule');
  new Intl.DateTimeFormat('en', { timeZone: input.timeZone ?? 'Asia/Seoul' });
}

function atLocal(at, zone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute };
}

export function exportContext(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      Object.keys(payload).some((k) => !['birth', 'evaluated_at', 'daewoon_periods'].includes(k))) throw new Error('Invalid context request');
  validateBirth(payload.birth);
  const at = parseInstant(payload.evaluated_at);
  const birth = payload.birth;
  const daewoon = selectDaewoon(payload.daewoon_periods ?? [], at);
  const clock = computeChart({ ...birth, ...atLocal(at, birth.timeZone ?? 'Asia/Seoul') }, terms);
  if (clock.utcMs !== at) throw new Error('Evaluation instant is ambiguous or outside calculator minute precision');
  const incoming = { daewoon: daewoon.pillar, yearly: clock.pillarsIdx.year, monthly: clock.pillarsIdx.month };
  const unknown = birth.hour === null;
  const features = {}, bounds = {}, choices = Object.fromEntries(POS.map((p) => [p, new Set()]));
  let count = 0;
  const offsets = new Set();
  for (let minute = 0; minute < (unknown ? 1440 : 1); minute++) {
    const sample = unknown ? { ...birth, hour: Math.floor(minute / 60), minute: minute % 60 } : birth;
    const chart = computeChart(sample, terms);
    const roundtrip = atLocal(chart.utcMs, birth.timeZone ?? 'Asia/Seoul');
    if (['year', 'month', 'day', 'hour', 'minute'].some((k) => roundtrip[k] !== (sample[k] ?? 0))) {
      if (unknown) continue;
      throw new Error('Birth civil time does not exist in the selected timezone');
    }
    if (at < chart.utcMs) throw new Error('evaluated_at is before a possible birth instant');
    offsets.add((Date.UTC(sample.year, sample.month - 1, sample.day, sample.hour, sample.minute ?? 0) - chart.utcMs) / 60000);
    const observation = observations(chart.pillarsIdx, incoming);
    POS.forEach((p) => choices[p].add(chart.pillarsIdx[p]));
    for (const [key, value] of Object.entries(observation.features)) {
      if (!Object.hasOwn(features, key)) features[key] = value;
      else if (features[key] !== value) features[key] = null;
      if (value !== null) {
        if (!bounds[key]) bounds[key] = [value, value];
        else { bounds[key][0] = Math.min(bounds[key][0], value); bounds[key][1] = Math.max(bounds[key][1], value); }
      }
    }
    count++;
  }
  if (!count) throw new Error('No valid birth minute exists on the selected civil date');
  // Existing calculator chooses one instant at timezone overlaps. Do not claim
  // exhaustive birth-time consensus on a date with a civil offset transition.
  const transition = unknown && offsets.size > 1;
  if (transition) for (const key of Object.keys(features)) {
    if (key.startsWith('natal.') || key.includes('stem_ten_god') || key.includes('completes_centered_samhap')) {
      features[key] = null; delete bounds[key];
    }
  }
  const sourcePaths = ['../../dosa-app/engine/src/manseryeok.js', '../../dosa-app/engine/src/tables.js', '../../dosa-app/engine/data/solar_terms.json'];
  return { schema_version: 1, feature_policy: POLICY, evaluated_at: payload.evaluated_at,
    time_context: { daewoon, yearly: { pillar: incoming.yearly, policy: 'L1 solar-term boundary' }, monthly: { pillar: incoming.monthly, policy: 'L1 solar-term boundary' } },
    natal: { status: transition ? 'timezone_transition_unresolved' : unknown ? 'minute_scenarios' : 'calculated',
      hour_unknown: unknown, scenarios: count, pillar_choices: Object.fromEntries(POS.map((p) => [p, [...choices[p]].sort((a,b) => a-b)])) },
    features, bounds, probability: null,
    measurement: { fractions: 'unweighted symbol count / fixed 4 or 8 positions; not strength or probability',
      unknown: 'null; bounds describe possible measurements, never a mean estimate',
      birth_resolution: 'existing L1 calculator, whole civil minutes; timezone overlap policy inherited',
      daewoon: 'explicit [start,end) intervals; L1 age-only schedule is not converted into start dates' },
    provenance: { calculator_files: sourcePaths.map((p) => ({ path: p.replace('../../', ''), sha256: hash(readFileSync(new URL(p, import.meta.url))) })),
      request_sha256: hash(JSON.stringify(payload)), adapter_sha256: hash(readFileSync(fileURLToPath(import.meta.url))) } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node chart_context.mjs request.json');
    console.log(JSON.stringify(exportContext(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2));
  } catch (error) {
    console.error(error.message); process.exitCode = 2;
  }
}
