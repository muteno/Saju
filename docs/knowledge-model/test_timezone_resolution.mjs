import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { computeChart } from '../../dosa-app/engine/src/manseryeok.js';
import { exportContext as oldContext, observations } from './chart_context.mjs';
import { exportContext, civilMinuteInstants, RESOLUTION_POLICY } from './chart_context_v2.mjs';
const {terms} = JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
const at = '2026-09-27T12:00:00Z';
const base = {year:1990,month:1,day:1,hour:12,minute:0,gender:'F',timeZone:'Asia/Seoul',longitude:126.978};
const sao = {...base,year:2019,month:2,day:16,hour:null,minute:null,timeZone:'America/Sao_Paulo',longitude:-46.633};
const run = (birth,evaluated_at=at) => exportContext({birth,evaluated_at});

test('midnight fold restores 1500 instants and the missing third day without probabilities',()=>{
  const old = oldContext({birth:sao,evaluated_at:at}), now = run(sao);
  assert.deepEqual(old.natal.pillar_choices.day,[19,20]);
  assert.equal(now.natal.scenarios,1500);
  assert.deepEqual(now.natal.pillar_choices.day,[19,20,21]);
  assert.deepEqual(now.natal.civil_date_resolution,{valid_minutes:1440,missing_minutes:0,repeated_minutes:60,possible_instants:1500});
  assert.equal(now.features['natal.day.stem.乙'],null);
  assert.deepEqual(now.bounds['natal.day.stem.乙'],[0,1]);
  assert.equal(now.probability,null);
  assert.equal(now.resolution_policy,RESOLUTION_POLICY);
});

test('UTC inverse list agrees exactly with an independent Python zoneinfo fold roundtrip',()=>{
  const dates = [sao,
    {...base,year:2024,month:3,day:10,timeZone:'America/New_York'},
    {...base,year:2024,month:11,day:3,timeZone:'America/New_York'},
    {...base,year:1988,month:10,day:9},
    {...base,year:2024,month:4,day:7,timeZone:'Australia/Lord_Howe'},
    {...base,year:2011,month:12,day:30,timeZone:'Pacific/Apia'},
    {...base,year:1901,month:2,day:4},
    {...base,year:1969,month:9,day:30,timeZone:'Pacific/Kwajalein'}];
  const script = `import json,sys\nfrom datetime import datetime,timedelta,timezone\nfrom zoneinfo import ZoneInfo\nout=[]\nfor b in json.load(sys.stdin):\n z=ZoneInfo(b['timeZone']); start=datetime(b['year'],b['month'],b['day']); rows=set()\n for minute in range(1440):\n  local=start+timedelta(minutes=minute)\n  for fold in (0,1):\n   candidate=local.replace(tzinfo=z,fold=fold).astimezone(timezone.utc)\n   if candidate.astimezone(z).replace(tzinfo=None)==local: rows.add((int(candidate.timestamp()*1000),minute))\n out.append([{'utc_ms':ms,'civil_minute':m} for ms,m in sorted(rows)])\nprint(json.dumps(out))`;
  const expected = JSON.parse(execFileSync('python3',['-c',script],{input:JSON.stringify(dates),maxBuffer:4*1024*1024}));
  dates.forEach((birth,i)=>assert.deepEqual(civilMinuteInstants(birth),expected[i],birth.timeZone));
  assert.equal(expected.at(-1).length,2820);
});

test('fold consensus agrees with canonical engine for every possible instant and both policies',()=>{
  for (const solarTimeCorrection of [true,false]) for (const lateZiRule of ['midnight23','keepDay']) {
    const birth = {...sao,solarTimeCorrection,lateZiRule}, actual = run(birth);
    const features = {}, bounds = {}, choices = {year:new Set(),month:new Set(),day:new Set(),hour:new Set()};
    const incoming = {yearly:actual.time_context.yearly.pillar,monthly:actual.time_context.monthly.pillar,daewoon:null};
    // Independent fixed UTC interval: local 00:00-23:59 has 1500 inverses here.
    for(let ms=Date.parse('2019-02-16T02:00:00Z');ms<Date.parse('2019-02-17T03:00:00Z');ms+=60000) {
      const d = new Date(ms);
      const utc = {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour:d.getUTCHours(),minute:d.getUTCMinutes(),timeZone:'UTC'};
      const absolute = computeChart({...birth,...utc},terms).pillarsIdx;
      let pillars=absolute;
      if(!solarTimeCorrection) {
        const offset=ms<Date.parse('2019-02-17T02:00:00Z')?-120:-180;
        const civil=new Date(ms+offset*60000);
        const local=computeChart({...birth,year:2019,month:2,day:16,hour:civil.getUTCHours(),minute:civil.getUTCMinutes(),timeZone:'UTC'},terms).pillarsIdx;
        pillars={...absolute,day:local.day,hour:local.hour};
      }
      Object.keys(choices).forEach(p=>choices[p].add(pillars[p]));
      for(const [key,value] of Object.entries(observations(pillars,incoming).features)) {
        if(!Object.hasOwn(features,key)) {features[key]=value;bounds[key]=value===null?undefined:[value,value];}
        else if(features[key]!==value) features[key]=null;
        if(value!==null) bounds[key]=[Math.min(bounds[key][0],value),Math.max(bounds[key][1],value)];
      }
    }
    Object.keys(bounds).forEach(k=>{if(bounds[k]===undefined)delete bounds[k];});
    assert.deepEqual(actual.features,features);
    assert.deepEqual(actual.bounds,bounds);
    assert.deepEqual(actual.natal.pillar_choices,Object.fromEntries(Object.entries(choices).map(([k,v])=>[k,[...v].sort((a,b)=>a-b)])));
  }
});

test('known repeated birth is rejected even if correction is off or pillars happen to agree',()=>{
  for(const solarTimeCorrection of [true,false]) for(const lateZiRule of ['midnight23','keepDay'])
    assert.throws(()=>run({...sao,hour:23,minute:30,solarTimeCorrection,lateZiRule}),/ambiguous/);
});

test('gaps and missing dates never normalize to another birth; resolved gap retains common features',()=>{
  const b={...base,year:2024,month:3,day:10,timeZone:'America/New_York',longitude:-74};
  assert.throws(()=>run({...b,hour:2,minute:30}),/does not exist/);
  const r=run({...b,hour:null,minute:null});
  assert.equal(r.natal.scenarios,1380);
  assert.equal(r.natal.civil_date_resolution.missing_minutes,60);
  assert.equal(r.features['natal.year.stem.甲'],1);
  assert.throws(()=>run({...b,year:2011,month:12,day:30,hour:null,minute:null,timeZone:'Pacific/Apia'}),/No valid birth minute/);
});

test('historical seconds preserve the correct side of solar-term boundaries',()=>{
  for(const b of [{...base,year:1901,month:2,day:4,hour:20,minute:7},
    {...base,year:1901,month:1,day:6,hour:5,minute:34,timeZone:'Asia/Kathmandu',longitude:85.324}]) {
    const r=run(b,'1902-01-01T00:00:00Z');
    const canonical=computeChart(b,terms);
    assert.notEqual(canonical.utcMs%60000,0);
    for(const [p,n] of Object.entries(canonical.pillarsIdx)) assert.deepEqual(r.natal.pillar_choices[p],[n]);
  }
});

test('absolute evaluation selects both occurrences and keeps solar-term half-open boundaries',()=>{
  const b={...base,timeZone:'America/New_York',longitude:-74};
  for(const evaluated of ['2024-11-03T05:30:00Z','2024-11-03T06:30:00Z'])
    assert.equal(run(b,evaluated).natal.scenarios,1);
  const before=run(base,'2024-02-04T08:27:00Z'), after=run(base,'2024-02-04T08:28:00Z');
  assert.notEqual(before.time_context.yearly.pillar,after.time_context.yearly.pillar);
  assert.notEqual(before.time_context.monthly.pillar,after.time_context.monthly.pillar);
});

test('evaluation before a later possible fold birth fails; no candidate is filtered to force chronology',()=>{
  assert.throws(()=>run(sao,'2019-02-17T02:00:00Z'),/before a possible/);
  assert.equal(run(sao,'2019-02-17T03:00:00Z').natal.scenarios,1500);
});

test('ordinary-day output preserves v1 observations and bounds for both options',()=>{
  for(const hour of [12,null]) for(const solarTimeCorrection of [true,false]) for(const lateZiRule of ['midnight23','keepDay']) {
    const birth={...base,hour,minute:hour===null?null:0,solarTimeCorrection,lateZiRule};
    const old=oldContext({birth,evaluated_at:at}), now=run(birth);
    assert.deepEqual(now.features,old.features);assert.deepEqual(now.bounds,old.bounds);
    assert.deepEqual(now.natal.pillar_choices,old.natal.pillar_choices);
    assert.notEqual(now.provenance.adapter_sha256,old.provenance.adapter_sha256);
    assert.equal(now.provenance.adapter_files.length,2);
  }
});

test('new entrypoint retains input rejection and cannot mutate cached candidates',()=>{
  for(const patch of [{month:2,day:30},{hour:24},{hour:null},{longitude:NaN},{solarTimeCorrection:null},{lateZiRule:'choose'},{extra:1},{timeZone:'bad/zone'}])
    assert.throws(()=>run({...base,...patch}));
  const rows=civilMinuteInstants(base);
  assert.throws(()=>rows.push({}));assert.throws(()=>{rows[0].utc_ms=0;});
  const a=run(base);a.natal.pillar_choices.day.push(59);
  assert.deepEqual(run(base).natal.pillar_choices.day,[2]);
});

test('L1 agreement at longitude extremes, solar-term seconds and supported date limits',()=>{
  for(const longitude of [-180,0,180]) for(const solarTimeCorrection of [true,false]) for(const lateZiRule of ['midnight23','keepDay'])
    for(const minute of [14,15]) {
      const b={...base,year:1908,month:2,day:5,hour:13,minute,longitude,solarTimeCorrection,lateZiRule};
      const actual=run(b), expected=computeChart(b,terms).pillarsIdx;
      for(const [p,n] of Object.entries(expected)) assert.deepEqual(actual.natal.pillar_choices[p],[n]);
    }
  assert.throws(()=>run({...base,year:1900,month:1,day:1}),/solar-term/);
  assert.throws(()=>run(base,'2100-12-31T00:00:00Z'),/solar-term/);
});
