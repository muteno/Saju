// Research calendar resolution v2. The v1 adapter is frozen for the F03 audit.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { observations, POLICY, parseInstant, selectDaewoon } from './chart_context.mjs';
import { jdn } from '../../dosa-app/engine/src/manseryeok.js';
import { K_IPCHUN, monthBranchOfTerm, sexIndex } from '../../dosa-app/engine/src/tables.js';

export { observations, POLICY, parseInstant, selectDaewoon };
export const RESOLUTION_POLICY = 'civil-minute-inverse-v2';
const POS = ['year', 'month', 'day', 'hour'];
const DAY = 86400000, MINUTE = 60000;
// Explicit research support bound, covering RFC 9636 section 3.2's recommended
// offset range (-25h,+26h). This is not a claim about arbitrary TZif files.
const OFFSET_LIMIT = 26 * 3600000;
const { terms } = JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json', import.meta.url)));
const cache = new Map();
const hash = x => createHash('sha256').update(x).digest('hex');
const mod = (n, d) => ((n % d) + d) % d;

function validDate(year, month, day) {
  if (![year, month, day].every(Number.isInteger) || year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 ||
      new Date(Date.UTC(year, month - 1, day)).getUTCDate() !== day) throw new Error('Invalid or unsupported Gregorian date');
}

function validateBirth(input) {
  const allowed = ['year', 'month', 'day', 'hour', 'minute', 'gender', 'timeZone', 'longitude', 'solarTimeCorrection', 'lateZiRule'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k)))
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

/** Every inverse of civil hh:mm:00, including second-valued historical offsets.
 * Enumerate UTC seconds, not sampled offsets or L1's single inverse choice.
 * Intl/IANA data and integral-second offsets/transitions are the support contract.
 * No probability mass is assigned to repeated civil minutes.
 */
export function civilMinuteInstants(birth) {
  validateBirth(birth);
  const zone = birth.timeZone ?? 'Asia/Seoul';
  const start = Date.UTC(birth.year, birth.month - 1, birth.day);
  const key = `${zone}/${start}`;
  if (cache.has(key)) return cache.get(key);
  const formatter = new Intl.DateTimeFormat('en-CA-u-ca-gregory-nu-latn', { timeZone: zone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const rows = [];
  for (let instant = start - OFFSET_LIMIT; instant < start + DAY + OFFSET_LIMIT; instant += 1000) {
    const parts = {};
    for (const p of formatter.formatToParts(instant)) if (p.type !== 'literal') parts[p.type] = +p.value;
    const civil = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    if (Math.abs(civil - instant) >= OFFSET_LIMIT) throw new Error('Timezone offset outside supported +/-26 hour range');
    if (parts.year === birth.year && parts.month === birth.month && parts.day === birth.day && parts.second === 0)
      rows.push(Object.freeze({ utc_ms: instant, civil_minute: parts.hour * 60 + parts.minute }));
  }
  if (cache.size >= 16) cache.delete(cache.keys().next().value);
  cache.set(key, Object.freeze(rows));
  return cache.get(key);
}

// Same L1 solar-term rules, with exact UTC retained across historical second offsets.
function solarPillars(instant) {
  if (!Number.isFinite(instant) || instant < terms[0][0] || instant > terms.at(-1)[0])
    throw new Error('Instant outside solar-term table range');
  let lo = 0, hi = terms.length - 1, index = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (terms[mid][0] <= instant) { index = mid; lo = mid + 1; } else hi = mid - 1;
  }
  let jeol = index, ipchun = index;
  while (jeol >= 0 && terms[jeol][1] % 2 !== 1) jeol--;
  while (ipchun >= 0 && terms[ipchun][1] !== K_IPCHUN) ipchun--;
  if (jeol < 0 || ipchun < 0) throw new Error('Instant before available solar-term year');
  const year = mod(new Date(terms[ipchun][0] + 9 * 3600000).getUTCFullYear() - 1984, 60);
  const branch = monthBranchOfTerm(terms[jeol][1]);
  const stem = ((year % 10 % 5) * 2 + 2 + mod(branch - 2, 12)) % 10;
  return { year, month: sexIndex(stem, branch) };
}

function pillarsAt(birth, row) {
  const civil = Date.UTC(birth.year, birth.month - 1, birth.day, 0, row.civil_minute);
  const local = new Date(birth.solarTimeCorrection === false ? civil :
    row.utc_ms + Math.round((birth.longitude ?? 126.978) * 4) * MINUTE);
  const advance = (birth.lateZiRule ?? 'midnight23') === 'midnight23' && local.getUTCHours() >= 23;
  const day = mod(jdn(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate()) + 49 + Number(advance), 60);
  const hourBranch = Math.floor(((local.getUTCHours() * 60 + local.getUTCMinutes() + 60) % 1440) / 120);
  const hour = sexIndex(((day % 10 % 5) * 2 + hourBranch) % 10, hourBranch);
  return { ...solarPillars(row.utc_ms), day, hour };
}

export function exportContext(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      Object.keys(payload).some(k => !['birth', 'evaluated_at', 'daewoon_periods'].includes(k))) throw new Error('Invalid context request');
  const birth = payload.birth;
  validateBirth(birth);
  const at = parseInstant(payload.evaluated_at);
  const daewoon = selectDaewoon(payload.daewoon_periods ?? [], at);
  const clock = solarPillars(at);
  const incoming = { daewoon: daewoon.pillar, yearly: clock.year, monthly: clock.month };
  const unknown = birth.hour === null;
  const all = civilMinuteInstants(birth);
  const rows = unknown ? all : all.filter(r => r.civil_minute === birth.hour * 60 + (birth.minute ?? 0));
  if (!rows.length) throw new Error(unknown ? 'No valid birth minute exists on the selected civil date' : 'Birth civil time does not exist in the selected timezone');
  if (!unknown && rows.length > 1) throw new Error('Birth civil time is ambiguous in the selected timezone; an explicit occurrence policy is required');
  if (rows.some(r => at < r.utc_ms)) throw new Error('evaluated_at is before a possible birth instant');
  const features = {}, bounds = {}, choices = Object.fromEntries(POS.map(p => [p, new Set()]));
  for (const row of rows) {
    const pillars = pillarsAt(birth, row);
    const measured = observations(pillars, incoming);
    POS.forEach(p => choices[p].add(pillars[p]));
    for (const [key, value] of Object.entries(measured.features)) {
      if (!Object.hasOwn(features, key)) features[key] = value;
      else if (features[key] !== value) features[key] = null;
      if (value !== null) {
        if (!bounds[key]) bounds[key] = [value, value];
        else { bounds[key][0] = Math.min(bounds[key][0], value); bounds[key][1] = Math.max(bounds[key][1], value); }
      }
    }
  }
  const counts = Array(1440).fill(0);
  all.forEach(r => counts[r.civil_minute]++);
  const sourcePaths = ['dosa-app/engine/src/manseryeok.js', 'dosa-app/engine/src/tables.js', 'dosa-app/engine/data/solar_terms.json'];
  const adapterFiles = ['chart_context_v2.mjs', 'chart_context.mjs'].map(path => ({ path: `docs/knowledge-model/${path}`,
    sha256: hash(readFileSync(new URL(path, import.meta.url))) }));
  const timezoneRuntime = { icu: process.versions.icu, tz: process.versions.tz };
  return { schema_version: 1, feature_policy: POLICY, resolution_policy: RESOLUTION_POLICY, evaluated_at: payload.evaluated_at,
    time_context: { daewoon, yearly: { pillar: incoming.yearly, policy: 'L1 solar-term boundary' }, monthly: { pillar: incoming.monthly, policy: 'L1 solar-term boundary' } },
    natal: { status: unknown ? 'minute_scenarios' : 'calculated', hour_unknown: unknown, scenarios: rows.length,
      pillar_choices: Object.fromEntries(POS.map(p => [p, [...choices[p]].sort((a,b) => a-b)])),
      civil_date_resolution: { valid_minutes: counts.filter(n => n > 0).length, missing_minutes: counts.filter(n => n === 0).length,
        repeated_minutes: counts.filter(n => n > 1).length, possible_instants: all.length } },
    features, bounds, probability: null,
    measurement: { fractions: 'unweighted symbol count / fixed 4 or 8 positions; not strength or probability',
      unknown: 'null; bounds describe possible measurements, never a mean estimate',
      birth_resolution: RESOLUTION_POLICY,
      scenario_unit: 'each UTC inverse of a civil hh:mm:00 input; seconds retained, not probability weights',
      support: 'Intl/IANA integral-second offsets/transitions, absolute offset <26h; POSIX time without leap seconds',
      daewoon: 'explicit [start,end) intervals; L1 age-only schedule is not converted into start dates' },
    provenance: { calculator_files: sourcePaths.map(path => ({ path, sha256: hash(readFileSync(new URL(`../../${path}`, import.meta.url))) })),
      request_sha256: hash(JSON.stringify(payload)), adapter_files: adapterFiles,
      adapter_sha256: hash(JSON.stringify({ adapter_files: adapterFiles, timezone_runtime: timezoneRuntime })),
      runtime: { node: process.version, icu: process.versions.icu, tz: process.versions.tz } } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node chart_context_v2.mjs request.json|-');
    console.log(JSON.stringify(exportContext(JSON.parse(readFileSync(process.argv[2] === '-' ? 0 : process.argv[2], 'utf8'))), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
