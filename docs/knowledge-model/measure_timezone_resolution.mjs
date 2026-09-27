// Successor audit. PR #200's code, evidence and result snapshots remain unchanged.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { exportContext as before } from './chart_context.mjs';
import { exportContext as after, RESOLUTION_POLICY } from './chart_context_v2.mjs';

const hash = bytes => createHash('sha256').update(bytes.toString().replace(/\r\n/g, '\n')).digest('hex');
const snapshot = new URL('data/foundation_timezone_measurement.json', import.meta.url);
export const fixtures = [
  ['ordinary', {year:1990,month:1,day:1,timeZone:'Asia/Seoul',longitude:126.978}],
  ['ipchun', {year:2024,month:2,day:4,timeZone:'Asia/Seoul',longitude:126.978}],
  ['midnight-fold', {year:2019,month:2,day:16,timeZone:'America/Sao_Paulo',longitude:-46.633}],
  ['dst-gap', {year:2024,month:3,day:10,timeZone:'America/New_York',longitude:-74}],
  ['dst-fold', {year:2024,month:11,day:3,timeZone:'America/New_York',longitude:-74}],
  ['seoul-fold', {year:1988,month:10,day:9,timeZone:'Asia/Seoul',longitude:126.978}],
  ['half-hour-fold', {year:2024,month:4,day:7,timeZone:'Australia/Lord_Howe',longitude:159.08}],
  ['date-gap', {year:2011,month:12,day:30,timeZone:'Pacific/Apia',longitude:-172}],
];

const summarize = (fn, request) => {
  try {
    const r = fn(request);
    return { status: 'ok', natal: r.natal, time_context: r.time_context,
      features_sha256: hash(JSON.stringify(r.features)), bounds_sha256: hash(JSON.stringify(r.bounds)), probability: r.probability };
  } catch (error) { return { status: 'error', message: error.message }; }
};

export function measure() {
  const requests = fixtures.map(([id,birth]) => ({ id, request: { birth: {...birth,hour:null,minute:null,gender:'F',solarTimeCorrection:true,lateZiRule:'midnight23'},
    evaluated_at:'2026-09-27T12:00:00Z' } }));
  const fold = requests.find(r => r.id === 'midnight-fold').request;
  requests.push({id:'known-fold',request:{...fold,birth:{...fold.birth,hour:23,minute:30}}});
  const gap = requests.find(r => r.id === 'dst-gap').request;
  requests.push({id:'known-gap',request:{...gap,birth:{...gap.birth,hour:2,minute:30}}});
  requests.push({id:'historic-second-ipchun',request:{birth:{year:1901,month:2,day:4,hour:20,minute:7,gender:'F',timeZone:'Asia/Seoul',longitude:126.978},evaluated_at:'1902-01-01T00:00:00Z'}});
  requests.push({id:'evaluated-fold-later',request:{birth:{year:1990,month:1,day:1,hour:12,minute:0,gender:'F',timeZone:'America/New_York',longitude:-74},evaluated_at:'2024-11-03T06:30:00Z'}});
  const files = ['chart_context.mjs','measure_calculation_policies.mjs','data/foundation_calculation_review.json','data/foundation_calculation_measurement.json',
    'chart_context_v2.mjs','context_query.py','measure_timezone_resolution.mjs'];
  return {schema_version:1,baseline_commit:'f97cb2cd1657d4b2524cef9f0119e4501d364dfe',resolution_policy:RESOLUTION_POLICY,
    method:'Same requests, frozen v1 vs v2; scenario counts are possible instants, not probabilities. v1 snapshots remain immutable.',
    runtime:{node:process.version,icu:process.versions.icu,tz:process.versions.tz},
    source_hashes:files.map(path=>({path:`docs/knowledge-model/${path}`,sha256:hash(readFileSync(new URL(path,import.meta.url)))})),
    rows:requests.map(({id,request})=>({id,request,before:summarize(before,request),after:summarize(after,request)})),probability:null};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3 || !['--check','--write'].includes(process.argv[2])) throw new Error('Usage: node measure_timezone_resolution.mjs --check|--write');
    const result = measure();
    if (process.argv[2] === '--write') writeFileSync(snapshot,JSON.stringify(result,null,2)+'\n');
    else {
      const {runtime,...actual} = result;
      const {runtime:storedRuntime,...expected} = JSON.parse(readFileSync(snapshot));
      assert.deepEqual(actual,expected,'Timezone successor measurement drift');
    }
    console.log(JSON.stringify({rows:result.rows.length,policy:result.resolution_policy,runtime:result.runtime}));
  } catch (error) { console.error(error.message); process.exitCode=1; }
}
