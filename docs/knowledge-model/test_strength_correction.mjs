import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compare, summarize, hash } from './measure_strength_correction.mjs';
import { strengthJudge, judgeStructure, STRENGTH_BRANCH_WEIGHTS, STRENGTH_STEM_WEIGHT } from '../../dosa-app/engine/src/judge.js';
import { STEM_ELEMENT, HIDDEN_STEMS } from '../../dosa-app/engine/src/tables.js';

const original = JSON.parse(readFileSync(new URL('data/foundation_calculation_measurement.json', import.meta.url)));
const snapshot = JSON.parse(readFileSync(new URL('data/foundation_strength_correction.json', import.meta.url)));
let result;
before(async () => { result = await compare(); });
const copy = x => JSON.parse(JSON.stringify(x));
const classify = score => score >= 85 ? '극신강' : score >= 60 ? '신강' : score > 30 ? '중화' : score > 15 ? '신약' : '극신약';

// Deliberately derives support from element indexes, not engine tenGod/detail or its weight constants.
function independent(pillars) {
  const master = STEM_ELEMENT[pillars.day % 10];
  const helps = stem => [master, (master + 4) % 5].includes(STEM_ELEMENT[stem]);
  return Object.entries(pillars).reduce((sum, [position, p]) => sum +
    (helps(p % 10) ? 10 : 0) + (helps(HIDDEN_STEMS[p % 12].at(-1)) ? {year:10,month:30,day:15,hour:15}[position] : 0), 0);
}

// Independent data lookup, preserving source iteration order and the established deduplication key.
function expectedBrain(keys) {
  const pack = JSON.parse(readFileSync(new URL('../../app/public/brain.json', import.meta.url)));
  const names = [], nodes = [], missing = [];
  for (const key of keys) {
    const name = pack.키매핑[key];
    if (!name) { missing.push(key); continue; }
    if (names.includes(name)) continue;
    names.push(name); nodes.push({키:key,노드:name,...pack.노드[name]});
  }
  const edges = new Map(), tables = [];
  for (const name of names) {
    for (const row of pack.관계.filter(r => r.a === name || r.b === name)) edges.set([row.a,row.관계,row.b].join('\u0001'),row);
    tables.push(...(pack.조견표 ?? []).filter(r => r.a === name || r.b === name));
  }
  return {노드:nodes,관계:[...edges.values()],조견표:tables,못맞춘키:missing};
}

test('128 support patterns use corrected positions with unchanged flags and explicit inherited cutoffs', () => {
  assert.deepEqual(STRENGTH_BRANCH_WEIGHTS, {year:10,month:30,day:15,hour:15});
  assert.equal(STRENGTH_STEM_WEIGHT,10); assert.ok(Object.isFrozen(STRENGTH_BRANCH_WEIGHTS));
  const patterns = original.support_patterns;
  assert.equal(patterns.length,128);
  let scores=0,labels=0;
  for (const row of patterns) {
    const actual = strengthJudge({pillarsIdx:row.pillars});
    assert.equal(actual.score,independent(row.pillars));
    assert.equal(actual.label,classify(actual.score));
    assert.deepEqual(actual,row.counterfactual);
    assert.equal(actual.score-row.current.score,5*(Number(actual.detail.hour.branchHelp)-Number(actual.detail.year.branchHelp)));
    assert.deepEqual(judgeStructure({pillarsIdx:row.pillars}).strength,actual);
    scores += actual.score !== row.current.score; labels += actual.label !== row.current.label;
  }
  assert.equal(scores,64);assert.equal(labels,14);
});

test('fixed real assets and all 48 full result hashes reproduce the successor snapshot', () => {
  assert.deepEqual(summarize(result),snapshot);
  const legacy=JSON.parse(readFileSync(new URL('data/foundation_strength_consumers.json',import.meta.url)));
  assert.equal(result.after.assets.kb_sha256,legacy.assets.kb.payload_sha256);
  assert.equal(result.after.assets.brain_sha256,legacy.assets.brain_sha256);
  assert.equal(snapshot.rows.filter(r=>r.before.strength?.score!==r.after.strength?.score).length,34);
  assert.equal(snapshot.rows.filter(r=>r.before.strength?.label!==r.after.strength?.label).length,22);
});

test('known inputs change only intended strength consumers; chart, fortune, topics and hook remain coherent', () => {
  for (let i=0;i<result.after.rows.length;i++) {
    const current=result.after.rows[i], old=result.before.rows[i];
    if(current.profile.hourUnknown) continue;
    const actual=copy(current), expected=copy(old);
    const calendar = JSON.parse(readFileSync(new URL('data/foundation_strength_consumers.json',import.meta.url))).rows.find(r=>r.id===actual.id);
    assert.equal(actual.raw.strength.score,independent(calendar.pillars));
    assert.equal(actual.raw.strength.label,classify(actual.raw.strength.score));
    assert.deepEqual(actual.keys.judge.strength,actual.raw.strength);
    expected.raw.strength.score=actual.raw.strength.score; expected.raw.strength.label=actual.raw.strength.label;
    expected.keys.judge.strength=copy(expected.raw.strength);
    for(const list of [expected.keys.keys,expected.keys.byTopic.frame,expected.keys.judge.keys]) list[0]=`frame/${actual.raw.strength.label}`;
    // Brain performs the same immutable-data lookup with only that corrected frame key.
    assert.deepEqual(actual.brain,expectedBrain([...actual.keys.keys,`unse/병오/ilju/${actual.chart.pillars.find(p=>p.title==='일').ganK+actual.chart.pillars.find(p=>p.title==='일').jiK}`,'unse/병오/general']));
    expected.brain=actual.brain;
    const oldLine=expected.report.sections.find(s=>s.id==='judge').lines[0];
    const newLine=actual.report.sections.find(s=>s.id==='judge').lines[0];
    expected.report.sections.find(s=>s.id==='judge').lines[0]=newLine;
    expected.summary=expected.summary.replace(oldLine.replace(/\*\*/g,''),newLine.replace(/\*\*/g,''));
    for(const target of [expected.reading,expected.hook.reading]) {
      const block=target.cards.find(c=>c.id==='judge').blocks[0];
      const updated=actual.reading.cards.find(c=>c.id==='judge').blocks[0];
      block.lines[0]=updated.lines[0];block.source=updated.source;
    }
    expected.hook.report.sections.find(s=>s.id==='judge').lines[0]=newLine;
    assert.deepEqual(actual.hook.chart,actual.chart);
    assert.deepEqual(actual.hook.jeonggok,actual.direct);
    assert.deepEqual(actual,expected,`Unrelated output drift: ${actual.id}`);
  }
});

test('report, card and consultation distinguish board positions from provisional app classification', () => {
  for(const row of result.after.rows.filter(r=>!r.profile.hourUnknown)) {
    const line=row.report.sections.find(s=>s.id==='judge').lines[0];
    assert.match(line,/지지 년10·월30·일15·시15/);
    assert.ok(line.startsWith(`신강신약: **${row.raw.strength.label}** `));
    assert.match(line,/도움·득세·분류는 앱 잠정 기준/);
    assert.ok(line.includes(`${row.raw.strength.score}/110점`));
    assert.ok(row.summary.includes(line.replace(/\*\*/g,'')) || row.summary.includes(line));
    const card=row.reading.cards.find(c=>c.id==='judge');
    assert.ok(card.blocks[0].lines[0].startsWith(`신강신약: ${row.raw.strength.label} · `));
    assert.match(card.blocks[0].lines[0],/앱 잠정 기준/); assert.doesNotMatch(card.blocks[0].lines[0],/110점/);
    assert.match(card.blocks[0].source,/강약은 앱 잠정 기준/);
  }
});

test('unknown eight inputs remain byte-equivalent to the post-203 deferral contract', () => {
  const indexes=result.after.rows.flatMap((row,i)=>row.profile.hourUnknown?[i]:[]);assert.equal(indexes.length,8);
  for(const i of indexes) {
    const row=result.after.rows[i];assert.deepEqual(row,result.before.rows[i]);
    assert.equal(row.input.hour,null);assert.equal(row.input.minute,null);
    assert.equal(row.raw,null);assert.equal(row.fortune,null);assert.equal(row.hook.jeonggok,null);
    assert.deepEqual(row.report.sections,[]);assert.deepEqual(row.brain,{노드:[],관계:[],조견표:[],못맞춘키:[]});
  }
});

test('pre-correction engine fixtures retain their exact source hashes and source/vendor parity', () => {
  const directory=new URL('fixtures/strength-position-v1/',import.meta.url);
  const manifest=JSON.parse(readFileSync(new URL('manifest.json',directory)));
  assert.equal(manifest.commit,'006d06c7bb0ee5281ebe94a170688709c48094db');assert.equal(manifest.files.length,6);
  for(const entry of manifest.files) assert.equal(hash(readFileSync(new URL(entry.path,directory),'utf8').replace(/\r\n/g,'\n')),entry.sha256_lf);
  for(const name of ['judge','report']) {
    assert.deepEqual(readFileSync(new URL(`dosa-app/engine/src/${name}.js`,directory)),readFileSync(new URL(`app/src/engine/vendor/${name}.js`,directory)));
    assert.deepEqual(readFileSync(new URL(`../../dosa-app/engine/src/${name}.js`,import.meta.url)),readFileSync(new URL(`../../app/src/engine/vendor/${name}.js`,import.meta.url)));
  }
});


test('isolated extreme candidates consume corrected labels and explicitly provisional evidence', async () => {
  // Synthetic selector inputs isolate this branch; these are not calendar charts or validation labels.
  const require=createRequire(new URL('../../app/package.json',import.meta.url));
  const {createServer}=await import(pathToFileURL(require.resolve('vite')).href);
  const server=await createServer({root:fileURLToPath(new URL('../../app',import.meta.url)),server:{middlewareMode:true},appType:'custom',logLevel:'error'});
  try {
    const {selectJeonggok}=await server.ssrLoadModule('/src/data/jeonggok.ts');
    const raw={...copy(result.after.rows[0].raw),elements:{목:2,화:2,토:2,금:1,수:1},missingGroups:[],gongmang:[],daeunHits:[],
      relations:{chung:[],wonjin:[],hyeong:[]},pillars:Object.fromEntries(['시','일','월','년'].map(p=>[p,{stemEl:'목',branchEl:'토',stage:'양',sinsal:'재살'}]))};
    for(const [score,label,token] of [[80,'신강',null],[85,'극신강','신강(뚜렷)'],[15,'극신약','신약(뚜렷)'],[20,'신약',null]]) {
      const picked=selectJeonggok({...raw,strength:{...raw.strength,score,label}});
      if(token===null) assert.equal(picked,null);
      else {assert.equal(picked.token,token);assert.equal(picked.layer,'INFER');assert.equal(picked.evid,`강약 앱 잠정 기준 ${score}/110 = ${label}`);}
    }
  } finally {await server.close();}
});
