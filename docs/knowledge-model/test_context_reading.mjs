import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildContextReading, CONTEXT_READING_NOTICE } from '../../dosa-app/engine/src/contextReading.js';
import { computeChart } from '../../dosa-app/engine/src/manseryeok.js';
import { chartToKeys } from '../../dosa-app/engine/src/keyset.js';
import { buildReport, toMarkdown } from '../../dosa-app/engine/src/report.js';
import { basicSentenceMatches } from '../../dosa-app/engine/src/basicSentences.js';
import { observations } from './chart_context_v2.mjs';
import { compare, summarize } from './measure_context_reading.mjs';
import { buildTopicGroups } from '../../app/src/data/analysisGroups.ts';
const { terms } = JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
const copy = x => JSON.parse(JSON.stringify(x));
const emptyKB = { index:{}, aliases:{}, bodies:{} };
const chart = () => ({ input:{hour:12,minute:0}, pillarsIdx:{year:0,month:2,day:50,hour:6} });
const actual = (month, day, hour) => computeChart({year:2024,month,day,hour,minute:0,gender:'F',solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
let result;
before(async()=> { result = await compare(); });

test('unknown and incomplete inputs never create an absence or a personal reading',()=>{
  const invalid=[null,{}, {...chart(),birthTime:{status:'unknown'}}, {...chart(),input:{hour:12,minute:0,hourUnknown:true}}];
  for(const field of ['hour','minute']) for(const v of [undefined,null,true,'0',-1,NaN,Infinity,field==='hour'?24:60])
    invalid.push({...chart(),input:{...chart().input,[field]:v}});
  for(const p of ['year','month','day','hour']) for(const v of [undefined,null,true,'0',-1,60,0.5])
    invalid.push({...chart(),pillarsIdx:{...chart().pillarsIdx,[p]:v}});
  for(const c of invalid) assert.equal(buildContextReading(c),null);
});

test('all 60 day pillars and 12 branches agree with the existing independent surface/hidden predicates',()=>{
  const seen = new Set();
  for(let day=0;day<60;day++) for(let month=0;month<12;month++) {
    const c={input:{hour:12,minute:0},pillarsIdx:{year:(day+19)%60,month,day,hour:(month+31)%60}};
    const r=buildContextReading(c), f=observations(c.pillarsIdx).features;
    for(const [group,id] of [['재성','wealth'],['관성','authority']]) {
      const surface=f[`natal.surface_role.${id}.present`], hidden=f[`natal.hidden_role.${id}.present`];
      assert.equal(r.conditions[`${id}_surface_absence`],surface?'unmet':'met');
      assert.equal(r.conditions[`${id}_surface_and_hidden_absence`],surface||hidden?'unmet':'met');
      assert.equal(r.groups[group].status,surface?'surface_present':hidden?'hidden_only':'absent');
      seen.add(r.groups[group].status);
    }
    assert.equal(Object.values(r.groups).reduce((n,g)=>n+g.surface.length,0),7);
    assert.equal(r.probability,null);assert.equal(r.predictionEnabled,false);assert.equal(r.trainingEligible,false);
  }
  assert.deepEqual([...seen].sort(),['absent','hidden_only','surface_present']);
});

test('the existing calendar fixture retains hidden wealth instead of reading it as no wealth',()=>{
  const c=computeChart(JSON.parse(readFileSync(new URL('data/context_example.json',import.meta.url))).birth,terms);
  const r=buildContextReading(c);
  assert.equal(r.dayPillar,'병인');assert.equal(r.groups.재성.status,'hidden_only');
  assert.deepEqual(r.groups.재성.hidden.map(m=>[m.position,m.character]),[['year','庚']]);
  assert.equal(r.conditions.wealth_surface_absence,'met');
  assert.equal(r.conditions.wealth_surface_and_hidden_absence,'unmet');
  assert.match(r.blocks[1].lines[1],/겉에 없다는 이유로 아예 없다고 읽지 않아요/);
  assert.match(r.blocks[2].lines[0],/재성은 지장간에서만 보이므로/);
});

test('same Gapin day but changed month/hour actually changes the combined reading',()=>{
  const cs=[actual(2,20,0),actual(2,20,12),actual(2,20,18),actual(4,20,12)];
  const rs=cs.map(buildContextReading);
  assert.ok(rs.every(r=>r.dayPillar==='갑인'));
  assert.deepEqual(rs.map(r=>r.hourStem.tenGod),['비견','편관','정인','편관']);
  assert.deepEqual(rs.map(r=>r.monthMain.tenGod),['비견','비견','비견','편재']);
  assert.equal(rs[0].groups.관성.status,'absent');assert.equal(rs[1].groups.관성.status,'surface_present');
  assert.equal(new Set(rs.map(r=>r.blocks[0].lines[0])).size,4);
  for(const c of cs) {
    const report=buildReport(c,chartToKeys(c),emptyKB);
    const old=report.sections.find(s=>s.id==='ilju').block;
    assert.ok(old.gapinConditions.items.every(item=>item.status!=='met'));
    assert.equal(old.structureReference.items.length,5);
    assert.ok(toMarkdown(report).includes(CONTEXT_READING_NOTICE));
    assert.deepEqual(basicSentenceMatches(report.sections.find(s=>s.id==='context-reading')),[]);
  }
});

test('110 real-KB inputs preserve calculations and unknown8, while known102 reach cards and work grounds',()=>{
  assert.deepEqual(summarize(result),JSON.parse(readFileSync(new URL('data/context_reading_delivery.json',import.meta.url))));
  let known=0,unknown=0;
  for(const [i,row] of result.after.rows.entries()) {
    const prior=result.before.rows[i];
    if(row.profile.hourUnknown) {unknown++;assert.deepEqual(row,prior);assert.equal(row.requests.length,0);continue;}
    known++;
    for(const key of ['chart','raw','keys','brain','direct','fortune','input','share']) assert.deepEqual(row[key],prior[key],`${row.id}/${key}`);
    const sec=row.report.sections.find(s=>s.id==='context-reading');assert.ok(sec);
    assert.equal(row.reading.cards.filter(c=>c.id==='context-reading').length,1);
    assert.deepEqual(row.reading.cards.find(c=>c.id==='context-reading').blocks,sec.context.blocks);
    assert.deepEqual(buildTopicGroups(row.reading).filter(g=>g.cards.some(c=>c.id==='context-reading')).map(g=>g.id),['work']);
    assert.deepEqual(row.topics.직업.slice(0,sec.lines.length).map(l=>l.text),sec.lines);
    assert.ok(row.summary.endsWith(`원국 조건에 따른 풀이: ${sec.lines.join(' / ')}`));
    const request=row.requests.find(r=>r.topic==='직업');
    assert.deepEqual(request.grounds.slice(0,sec.lines.length).map(l=>l.text),sec.lines);
    assert.equal(request.chartSummary,row.summary);
    assert.deepEqual(basicSentenceMatches(row.reading),[]);
    for(const topic of ['성격','올해','관계','주의']) assert.deepEqual(row.topics[topic],prior.topics[topic]);
  }
  assert.equal(known,102);assert.equal(unknown,8);
  assert.equal(result.after.rows.reduce((n,r)=>n+r.requests.length,0),510);
});

test('the only whole-consumer changes are the new section/card/work lines and explicit absence scope',()=>{
  const priorScope=value=>typeof value==='string'?value.replaceAll('천간·지지 본기에서 안 보이는 십신:','십신 부재:'):
    Array.isArray(value)?value.map(priorScope):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,priorScope(v)])):value;
  for(const [i,row] of result.after.rows.entries()) {
    const r=copy(row), old=result.before.rows[i];
    if(row.profile.hourUnknown) continue;
    const sec=r.report.sections.find(s=>s.id==='context-reading'), suffix=`\n원국 조건에 따른 풀이: ${sec.lines.join(' / ')}`;
    for(const rep of [r.report,r.hook.report]) rep.sections=rep.sections.filter(s=>s.id!=='context-reading');
    for(const reading of [r.reading,r.hook.reading]) reading.cards=reading.cards.filter(c=>c.id!=='context-reading');
    r.topics.직업=r.topics.직업.slice(sec.lines.length);r.summary=r.summary.replace(suffix,'');
    for(const req of r.requests) {req.chartSummary=req.chartSummary.replace(suffix,'');if(req.topic==='직업')req.grounds=req.grounds.slice(sec.lines.length);}
    assert.deepEqual(priorScope(r),old,row.id);
  }
});

test('returned edits do not mutate the chart or future readings',()=>{
  const c=chart(),before=copy(c),r=buildContextReading(c);
  r.blocks[0].lines[0]='edited';r.groups.재성.surface.length=0;
  assert.deepEqual(c,before);assert.notEqual(buildContextReading(c).blocks[0].lines[0],'edited');
});

test('successful, free and late answers retain the structural limit without duplicate notices',async()=>{
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const require=createRequire(new URL('../../app/package.json',import.meta.url));
  const {createServer}=await import(pathToFileURL(require.resolve('vite')).href);
  const server=await createServer({root:root+'app',server:{middlewareMode:true},appType:'custom',logLevel:'error'});
  const fetch=globalThis.fetch;
  try {
    const client=await server.ssrLoadModule('/src/data/dosaClient.ts');
    const topics=await server.ssrLoadModule('/src/data/dosaTopics.ts');
    const report=buildReport(actual(2,20,12),chartToKeys(actual(2,20,12)),emptyKB);
    for(const topic of ['직업','성격']) for(const body of ['확인한 조합을 함께 살펴봐요.',CONTEXT_READING_NOTICE+'\n\n같이 살펴봐요.']) {
      globalThis.fetch=async()=>Response.json({text:body});
      const lines=topics.topicLines(report,topic);
      const answer=await client.requestDosaText({topic,report,lines,chefId:'noona',model:'sonnet',question:'일을 어떻게 읽어?'});
      assert.equal(answer.split(CONTEXT_READING_NOTICE).length-1,1);
      // The same helper is called after the late-answer paragraph offset.
      assert.ok(client.readingNotices(report,lines).includes(CONTEXT_READING_NOTICE));
    }
    assert.deepEqual(client.readingNotices({...report,birthTime:{status:'unknown'}},[]),[]);
  } finally {globalThis.fetch=fetch;await server.close();}
});
