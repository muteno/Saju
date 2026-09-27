// F03 audit only: reproduce current L1 behavior and one isolated weight swap.
// No runtime policy, source truth, prediction, or training label is selected here.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { computeChart } from '../../dosa-app/engine/src/manseryeok.js';
import { strengthJudge } from '../../dosa-app/engine/src/judge.js';
import { exportContext } from './chart_context.mjs';

const root = new URL('../../', import.meta.url);
const output = new URL('data/foundation_calculation_measurement.json', import.meta.url);
const reviewFile = new URL('data/foundation_calculation_review.json', import.meta.url);
const { terms } = JSON.parse(readFileSync(new URL('dosa-app/engine/data/solar_terms.json', root)));
const POS = ['year', 'month', 'day', 'hour'];
const FLAGS = ['deukryeong', 'deukji', 'deuksi', 'deukse'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const textHash = bytes => hash(bytes.toString().replace(/\r\n/g,'\n'));
const unique = xs => [...new Set(xs)].sort((a, b) => typeof a === 'string' ? a.localeCompare(b, 'en') : Number(a) - Number(b));
const bounds = xs => [Math.min(...xs), Math.max(...xs)];

// These are the existing engine's cutoffs, deliberately held fixed to isolate weights.
export function inheritedLabel(score) {
  return score >= 85 ? '극신강' : score >= 60 ? '신강' : score > 30 ? '중화' : score > 15 ? '신약' : '극신약';
}

export function compareStrength(pillarsIdx) {
  if (!pillarsIdx || Object.keys(pillarsIdx).length !== 4 || POS.some(p =>
    !Number.isInteger(pillarsIdx[p]) || pillarsIdx[p] < 0 || pillarsIdx[p] > 59))
    throw new Error('Four known integer pillars [0,59] required; unknown is not zero');
  const current = strengthJudge({ pillarsIdx });
  const weights = { year: 10, month: 30, day: 15, hour: 15 };
  const score = POS.reduce((sum, p) => sum + (current.detail[p].stemHelp ? 10 : 0) +
    (current.detail[p].branchHelp ? weights[p] : 0), 0);
  const counterfactual = { ...current, score, label: inheritedLabel(score) };
  assert.equal(current.label, inheritedLabel(current.score));
  return { current, counterfactual, delta: score - current.score,
    label_changed: current.label !== counterfactual.label };
}

function signature(detail) {
  return POS.flatMap(p => [p === 'day' ? [] : [Number(detail[p].stemHelp)], [Number(detail[p].branchHelp)]]).flat().join('');
}

export function supportPatterns() {
  // All support signatures of the actual pillar table, not a population sample.
  const rows = new Map();
  for (let day = 0; day < 60; day++) {
    const representatives = new Map();
    for (let p = 0; p < 60; p++) {
      const d = strengthJudge({ pillarsIdx: { year: p, month: 0, day, hour: 0 } }).detail.year;
      const k = `${Number(d.stemHelp)}${Number(d.branchHelp)}`;
      if (!representatives.has(k)) representatives.set(k, p);
    }
    for (const year of representatives.values()) for (const month of representatives.values()) for (const hour of representatives.values()) {
      const pillars = { year, month, day, hour };
      const comparison = compareStrength(pillars);
      const key = signature(comparison.current.detail);
      if (!rows.has(key)) rows.set(key, { signature: key, pillars, ...comparison });
    }
  }
  return [...rows.values()].sort((a,b) => a.signature.localeCompare(b.signature));
}

function clockInput(y, m, d, h, min, solarTimeCorrection = false) {
  return { year: y, month: m, day: d, hour: h, minute: min, gender: 'F',
    timeZone: 'Asia/Seoul', longitude: 126.978, solarTimeCorrection };
}

export function boundaryInputs() {
  const rows = [];
  for (const [hour, minute] of [[22,59],[23,0],[23,1],[23,59],[0,0],[0,1],[0,59],[1,0]])
    rows.push({ id: `civil-${hour}-${minute}`, input: clockInput(1990,1,hour < 2 ? 2 : 1,hour,minute) });
  for (const [day,hour,minute] of [[1,23,31],[1,23,32],[1,23,33],[2,0,0],[2,0,31],[2,0,32],[2,0,33],[2,1,31],[2,1,32]])
    rows.push({ id: `seoul-lmt-${day}-${hour}-${minute}`, input: clockInput(1990,1,day,hour,minute,true) });
  // Last whole minute before and first whole minute after the stored instant.
  const ipchun = terms.find(([ms,k]) => k === 21 && new Date(ms).getUTCFullYear() === 2024)[0];
  for (const [side, ms] of [['before', Math.ceil(ipchun/60000)*60000-60000], ['after', Math.ceil(ipchun/60000)*60000]]) {
    const d = new Date(ms);
    for (const correction of [false,true]) rows.push({ id: `ipchun-${side}-${correction}`, term_utc_ms: ipchun,
      input: { year: d.getUTCFullYear(), month: d.getUTCMonth()+1, day: d.getUTCDate(), hour: d.getUTCHours(),
        minute: d.getUTCMinutes(), gender: 'F', timeZone: 'UTC', longitude: 126.978, solarTimeCorrection: correction } });
  }
  // Same absolute birth moment expressed in two civil time zones with the same longitude.
  rows.push({id:'same-instant-seoul',input:clockInput(1990,1,1,23,32,true)});
  rows.push({id:'same-instant-utc',input:{...clockInput(1990,1,1,14,32,true),timeZone:'UTC'}});
  for(const correction of [false,true]) for(const minute of [58,59])
    rows.push({id:`late-ipchun-${minute}-${correction}`,input:clockInput(2021,2,3,23,minute,correction)});
  rows.push({id:'seoul-1955',input:clockInput(1955,1,1,12,0,true)});
  rows.push({id:'seoul-1988-dst',input:clockInput(1988,6,1,12,0,true)});
  return rows;
}

export function boundaryRow(row) {
  const results = {};
  for (const lateZiRule of ['midnight23','keepDay']) {
    const chart = computeChart({...row.input, lateZiRule},terms);
    results[lateZiRule] = { utc_ms:chart.utcMs, corrected_local:chart.correctedLocal,
      pillars:chart.pillarsIdx, names:Object.fromEntries(POS.map(p=>[p,chart.saju[p].name])),
      month_term:chart.monthTerm, strength:compareStrength(chart.pillarsIdx) };
  }
  return {...row, results, changed_pillars:POS.filter(p=>results.midnight23.pillars[p] !== results.keepDay.pillars[p])};
}

const formatters=new Map();
function civilParts(ms, zone) {
  if (!formatters.has(zone)) formatters.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
  const p = Object.fromEntries(formatters.get(zone).formatToParts(ms).map(p=>[p.type,p.value]));
  return [+p.year,+p.month,+p.day,+p.hour,+p.minute];
}

// Audit fixtures only: discover nearby offsets independently of L1's single UTC choice.
// Hourly probes from civil-date start -36h to +60h are not offered as a general historical timezone resolver.
export function civilAmbiguity(input) {
  const start=Date.UTC(input.year,input.month-1,input.day), offsets=new Set();
  for(let h=-36;h<=60;h++) {
    const ms=start+h*3600000, p=civilParts(ms,input.timeZone);
    offsets.add(Date.UTC(p[0],p[1]-1,p[2],p[3],p[4])-ms);
  }
  let ambiguous=0, first=null;
  for(let minute=0;minute<1440;minute++) {
    const want=[input.year,input.month,input.day,Math.floor(minute/60),minute%60];
    const choices=[...offsets].map(o=>start+minute*60000-o).filter(ms=>civilParts(ms,input.timeZone).every((n,i)=>n===want[i])).sort((a,b)=>a-b);
    if(choices.length>1) {ambiguous++;first??={civil_minute:minute,utc_choices:choices.map(ms=>new Date(ms).toISOString())};}
  }
  return {ambiguous_civil_minutes:ambiguous,first_ambiguous:first,method:'Nearby offset probes and exact civil-minute roundtrip; fixed audit fixtures only'};
}

export function unknownRow(input) {
  const context = exportContext({birth:{...input,hour:null,minute:null},evaluated_at:'2026-09-27T12:00:00Z'});
  const comparisons = [], charts = [];
  for (let minute=0;minute<1440;minute++) {
    const sample={...input,hour:Math.floor(minute/60),minute:minute%60};
    const chart=computeChart(sample,terms);
    if (civilParts(chart.utcMs,input.timeZone).some((n,i)=>n !== [input.year,input.month,input.day,sample.hour,sample.minute][i])) continue;
    charts.push(chart); comparisons.push(compareStrength(chart.pillarsIdx));
  }
  assert.equal(charts.length,context.natal.scenarios);
  for (const p of POS) assert.deepEqual(unique(charts.map(c=>c.pillarsIdx[p])),context.natal.pillar_choices[p]);
  const ambiguity=civilAmbiguity(input);
  const resolved=context.natal.status !== 'timezone_transition_unresolved' && ambiguity.ambiguous_civil_minutes===0;
  const summarize=key=>({score_range:bounds(comparisons.map(c=>c[key].score)),labels:unique(comparisons.map(c=>c[key].label)),
    flags:Object.fromEntries(FLAGS.map(f=>{const vs=unique(comparisons.map(c=>c[key][f]));return [f,vs.length===1?vs[0]:null];}))});
  const noon=computeChart({...input,hour:12,minute:0},terms);
  return {input:{...input,hour:null,minute:null},natal:context.natal,ambiguity,
    audit_status:resolved?'enumerated_current_policy':'timezone_transition_unresolved',
    current:resolved?summarize('current'):null,counterfactual:resolved?summarize('counterfactual'):null,
    delta_range:resolved?bounds(comparisons.map(c=>c.delta)):null,
    noon_placeholder_simulation:{pillars:noon.pillarsIdx,strength:compareStrength(noon.pillarsIdx)},
    limitation:resolved?'Minute scenarios under existing L1 rules; no averaging or probabilities.':
      (ambiguity.ambiguous_civil_minutes>0 ? 'Repeated civil minutes: L1 selects one occurrence; exhaustive strength bounds withheld.' :
        'Civil offset transition with missing minutes: exhaustive strength bounds withheld.')};
}

export function overlapWitness() {
  const instants=['2019-02-17T01:30:00Z','2019-02-17T02:30:00Z'];
  return instants.map(instant=>{
    const ms=Date.parse(instant),d=new Date(ms);
    assert.deepEqual(civilParts(ms,'America/Sao_Paulo'),[2019,2,16,23,30]);
    const calculator_input={year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:d.getUTCHours(),minute:d.getUTCMinutes(),
      gender:'F',timeZone:'UTC',longitude:-46.633,solarTimeCorrection:true,lateZiRule:'midnight23'};
    const c=computeChart(calculator_input,terms);
    const civil_offset_minutes=(Date.UTC(2019,1,16,23,30)-ms)/60000;
    return {instant,civil:[2019,2,16,23,30],civil_time_zone:'America/Sao_Paulo',calculator_input,
      civil_offset_minutes,civil_correction_minutes:Math.round(-46.633*4)-civil_offset_minutes,
      corrected_local:c.correctedLocal,correction_note:'corrected_local.correctionMinutes is relative to calculator_input UTC, not the Sao Paulo civil clock',pillars:c.pillarsIdx};
  });
}

export function verifyEvidence(review) {
  assert.equal(review.schema_version,1);
  assert.equal(review.hash_policy,'sha256_lf_git_text');
  assert.equal(review.apply_to_runtime,false);
  assert.equal(review.use_as_training_labels,false);
  assert.deepEqual(review.comparison.current_branch_weights,{year:15,month:30,day:15,hour:10});
  assert.deepEqual(review.comparison.counterfactual_branch_weights,{year:10,month:30,day:15,hour:15});
  assert.equal(review.comparison.stem_each,10);assert.equal(review.comparison.daymaster_included,true);assert.equal(review.comparison.max,110);
  assert.equal(review.evidence.length,17);assert.equal(new Set(review.evidence.map(e=>e.id)).size,17);
  const preserved=new Set(review.preserved_files.map(f=>f.path));
  assert.equal(preserved.size,review.preserved_files.length);
  for (const file of review.preserved_files) assert.equal(textHash(readFileSync(new URL(file.path,root))),file.sha256,`Preserved file drift: ${file.path}`);
  for (const span of review.evidence) {
    assert.ok(preserved.has(span.path),`Unpinned evidence: ${span.id}`);
    const lines=readFileSync(new URL(span.path,root),'utf8').split(/\r?\n/);
    const excerpt=lines.slice(span.lines[0]-1,span.lines[1]).join('\n');
    assert.equal(excerpt,span.excerpt,`Evidence mismatch: ${span.id}`);
    assert.equal(hash(excerpt),span.sha256,`Evidence hash mismatch: ${span.id}`);
  }
}

export function measure() {
  const review=JSON.parse(readFileSync(reviewFile,'utf8'));
  verifyEvidence(review);
  const patterns=supportPatterns();
  const changed=patterns.filter(r=>r.label_changed);
  const unknownInputs=[
    ['ordinary-civil',clockInput(1990,1,1,12,0)],
    ['ordinary-lmt',clockInput(1990,1,1,12,0,true)],
    ['ipchun',clockInput(2024,2,4,12,0)],
    ['dst-gap',{...clockInput(2024,3,10,12,0),timeZone:'America/New_York',longitude:-74}],
    ['midnight-overlap',{...clockInput(2019,2,16,12,0,true),timeZone:'America/Sao_Paulo',longitude:-46.633}],
  ];
  const unknown=[];
  for (const [id,input] of unknownInputs) for (const lateZiRule of ['midnight23','keepDay'])
    unknown.push({id:`${id}-${lateZiRule}`,...unknownRow({...input,lateZiRule})});
  return {schema_version:1,baseline_commit:review.baseline_commit,apply_to_runtime:false,use_as_training_labels:false,probability:null,
    method:'Current engine vs only year/hour branch weights swapped; current cutoffs and support flags held fixed. Synthetic signatures are not calendar frequencies.',
    runtime:{node:process.version,icu:process.versions.icu,tz:process.versions.tz},
    provenance:{hash_policy:review.hash_policy,review_sha256:textHash(readFileSync(reviewFile)),measurement_code_sha256:textHash(readFileSync(fileURLToPath(import.meta.url)))},
    summary:{support_patterns:patterns.length,score_changed:patterns.filter(r=>r.delta!==0).length,label_changed:changed.length,
      delta_range:bounds(patterns.map(r=>r.delta)),flag_changes:patterns.filter(r=>FLAGS.some(f=>r.current[f]!==r.counterfactual[f])).length,
      transitions:unique(changed.map(r=>`${r.current.label} → ${r.counterfactual.label}`))},
    support_patterns:patterns,boundaries:boundaryInputs().map(boundaryRow),unknown_time:unknown,overlap_witness:overlapWitness()};
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const mode=process.argv[2];
    if (!['--check','--write'].includes(mode) || process.argv.length!==3) throw new Error('Usage: node measure_calculation_policies.mjs --check|--write');
    const result=measure();
    if(mode==='--write') writeFileSync(output,JSON.stringify(result,null,2)+'\n');
    else {
      const stored=JSON.parse(readFileSync(output,'utf8'));
      // Runtime versions are a receipt, not a required Node patch-version pin.
      // All calculated outputs and hashes must still reproduce exactly.
      const {runtime:actualRuntime,...actual}=result,{runtime:storedRuntime,...expected}=stored;
      assert.deepEqual(actual,expected,'Calculation audit snapshot drift');
    }
    console.log(JSON.stringify({summary:result.summary,runtime:result.runtime}));
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
