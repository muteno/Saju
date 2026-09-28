import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildContextReading, CONTEXT_READING_NOTICE } from '../../dosa-app/engine/src/contextReading.js';
import { computeChart } from '../../dosa-app/engine/src/manseryeok.js';
import { chartToKeys } from '../../dosa-app/engine/src/keyset.js';
import { buildReport } from '../../dosa-app/engine/src/report.js';
import { basicSentenceMatches } from '../../dosa-app/engine/src/basicSentences.js';
import { compareSynthesis, summarizeSynthesis } from './measure_context_synthesis.mjs';
const {terms}=JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
const copy=x=>JSON.parse(JSON.stringify(x));
const actual=(month,hour)=>computeChart({year:2024,month,day:20,hour,minute:0,gender:'F',solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
let result;
before(async()=>{result=await compareSynthesis();});

test('same day/month-hour changes reach the final synthesis, not just the overview',()=>{
  const rs=[actual(2,0),actual(2,12),actual(2,18),actual(4,12)].map(buildContextReading);
  assert.deepEqual(rs.map(r=>[r.monthMain.tenGod,r.hourStem.tenGod]),[['비견','비견'],['비견','편관'],['비견','정인'],['편재','편관']]);
  assert.equal(new Set(rs.map(r=>r.blocks[2].lines[0])).size,4);
  assert.equal(new Set(rs.map(r=>r.experienceQuestions[0].prompt)).size,4);
  for(const r of rs){assert.equal(r.dayPillar,'갑인');assert.match(r.blocks[2].lines[0],/월지 본기 .*시간 /);assert.deepEqual(basicSentenceMatches(r),[]);}
});

test('all 25 role pairs retain ordered anchors and scoped observations across 8640 symbol combinations',()=>{
  const seen=new Set();
  for(let day=0;day<60;day++)for(let month=0;month<12;month++)for(let hour=0;hour<12;hour++){
    const r=buildContextReading({input:{hour:12,minute:0},pillarsIdx:{year:0,month,day,hour}});
    seen.add(`${r.monthMain.group}/${r.hourStem.group}`);
    const line=r.blocks[2].lines[0];
    assert.ok(line.includes(`${r.monthMain.character}(${r.monthMain.tenGod}) 및 시간 ${r.hourStem.character}(${r.hourStem.tenGod})`));
    assert.equal(r.experienceQuestions.length,2);
    assert.ok(r.experienceQuestions.every(q=>q.id && (q.prompt.endsWith('?') || q.prompt.endsWith('요.'))));
    assert.ok(r.experienceQuestions.every(q=>q.clarifies.length>0));
    assert.equal(r.probability,null);assert.equal(r.predictionEnabled,false);assert.equal(r.trainingEligible,false);
    if(r.monthMain.group===r.hourStem.group)assert.match(line,/더 강하다는 판정은 아니/);
  }
  assert.equal(seen.size,25);
});

test('hidden-only and absent roles yield different experience questions without inferring incapacity',()=>{
  const hidden=buildContextReading(computeChart(JSON.parse(readFileSync(new URL('data/context_example.json',import.meta.url))).birth,terms));
  assert.equal(hidden.groups.재성.status,'hidden_only');
  assert.equal(hidden.experienceQuestions[1].id,'hidden-context');assert.match(hidden.experienceQuestions[1].prompt,/지장간에만 보이는 재성/);
  const absent=buildContextReading(actual(2,0));assert.equal(absent.groups.관성.status,'absent');
  assert.equal(absent.experienceQuestions[1].id,'absent-context');assert.match(absent.experienceQuestions[1].prompt,/현실에서 맡은 적이 있나요/);
  assert.match(hidden.blocks[3].lines.at(-1),/맞지 않는 경험/);
  assert.match(hidden.blocks[3].lines.at(-1),/적성을 확인했다고 판단하지 않아요/);
});

test('unknown, malformed and caller-edited inputs do not create or contaminate a reading',()=>{
  const c=actual(2,12);
  for(const invalid of [null,{}, {...c,birthTime:{status:'unknown'}},{...c,input:{...c.input,hourUnknown:true}},
    ...[null,undefined,-1,24,'12',true].map(hour=>({...c,input:{...c.input,hour}})),
    ...[null,undefined,-1,60,'0',true].map(minute=>({...c,input:{...c.input,minute}})),
    ...[null,undefined,-1,60,'2',true].map(month=>({...c,pillarsIdx:{...c.pillarsIdx,month}}))])assert.equal(buildContextReading(invalid),null);
  const prior=copy(c),r=buildContextReading(c);r.experienceQuestions[0].prompt='mutated';r.blocks[2].lines[0]='mutated';
  assert.deepEqual(c,prior);assert.notEqual(buildContextReading(c).experienceQuestions[0].prompt,'mutated');
});

test('110 complete consumers change only the context card, work grounds and summary; unknown8 stay identical',()=>{
  let known=0,unknown=0;
  for(const [i,row]of result.after.rows.entries()){
    const prior=result.before.rows[i];
    if(row.profile.hourUnknown){unknown++;assert.deepEqual(row,prior);assert.equal(row.requests.length,0);continue;}
    known++;
    const sec=row.report.sections.find(s=>s.id==='context-reading'),old=prior.report.sections.find(s=>s.id==='context-reading');
    assert.deepEqual(sec.context.blocks.slice(0,2),old.context.blocks.slice(0,2));
    assert.deepEqual(sec.context.groups,old.context.groups);assert.deepEqual(sec.context.conditions,old.context.conditions);
    assert.deepEqual(row.reading.cards.find(c=>c.id==='context-reading').blocks,sec.context.blocks);
    for(const q of sec.context.experienceQuestions){assert.ok(row.summary.includes(q.prompt));assert.ok(row.topics.직업.some(l=>l.text===q.prompt));}
    const r=copy(row);
    for(const rep of [r.report,r.hook.report])rep.sections=rep.sections.map(s=>s.id==='context-reading'?copy(old):s);
    const oldCard=prior.reading.cards.find(c=>c.id==='context-reading');
    for(const reading of [r.reading,r.hook.reading])reading.cards=reading.cards.map(c=>c.id==='context-reading'?copy(oldCard):c);
    r.topics.직업=[...copy(prior.topics.직업.slice(0,old.lines.length)),...r.topics.직업.slice(sec.lines.length)];
    const replaceSummary=s=>s.replace(`원국 조건에 따른 풀이: ${sec.lines.join(' / ')}`,`원국 조건에 따른 풀이: ${old.lines.join(' / ')}`);
    r.summary=replaceSummary(r.summary);
    for(const req of r.requests){
      assert.ok(req.chartSummary.includes(sec.context.experienceQuestions[0].prompt));
      req.chartSummary=replaceSummary(req.chartSummary);
      if(req.topic==='직업'){
        assert.deepEqual(req.grounds.slice(0,sec.lines.length).map(l=>l.text),sec.lines);
        req.grounds=[...copy(prior.requests.find(x=>x.topic==='직업').grounds.slice(0,old.lines.length)),...req.grounds.slice(sec.lines.length)];
      }
    }
    assert.deepEqual(r,prior,row.id);assert.deepEqual(basicSentenceMatches(row.reading),[]);
  }
  assert.equal(known,102);assert.equal(unknown,8);
  assert.equal(result.after.rows.reduce((n,r)=>n+r.requests.length,0),510);
});

test('generated work answers preserve questions once; free questions receive context without forced work follow-ups',async()=>{
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const require=createRequire(new URL('../../app/package.json',import.meta.url));
  const {createServer}=await import(pathToFileURL(require.resolve('vite')).href);
  const server=await createServer({root:root+'app',server:{middlewareMode:true},appType:'custom',logLevel:'error'});
  const fetch=globalThis.fetch;
  try{
    const client=await server.ssrLoadModule('/src/data/dosaClient.ts');
    const topics=await server.ssrLoadModule('/src/data/dosaTopics.ts');
    const c=actual(2,12),report=buildReport(c,chartToKeys(c),{index:{},aliases:{},bodies:{}});
    const context=report.sections.find(s=>s.id==='context-reading').context;
    for(const topic of ['직업','성격'])for(const alreadyIncluded of [false,true]){
      let request;
      globalThis.fetch=async(_,options)=>{request=JSON.parse(options.body);return Response.json({text:alreadyIncluded?`본문 첫 문장. ${context.blocks[3].lines.join(' ')}\n\n입력된 조합을 함께 살펴봐요.`:'입력된 조합을 함께 살펴봐요.'});};
      const lines=topics.topicLines(report,topic);
      const answer=await client.requestDosaText({topic,report,lines,chefId:'noona',model:'sonnet',...(topic==='성격'?{question:'일을 어떻게 읽어?'}:{})});
      assert.equal(answer.split(CONTEXT_READING_NOTICE).length-1,1);
      for(const q of context.experienceQuestions){
        assert.ok(request.chartSummary.includes(q.prompt));
        assert.equal(answer.split(q.prompt).length-1,topic==='직업'||alreadyIncluded?1:0);
      }
      const followups=client.readingFollowups(report,lines);
      for(const q of context.experienceQuestions)assert.equal(followups.includes(q.prompt),topic==='직업');
      if(topic==='직업')assert.ok(answer.indexOf('입력된 조합')<answer.indexOf(context.experienceQuestions[0].prompt));
    }
    assert.deepEqual(client.readingNotices({...report,birthTime:{status:'unknown'}},topics.topicLines(report,'직업')),[]);
    assert.deepEqual(client.readingFollowups({...report,birthTime:{status:'unknown'}},topics.topicLines(report,'직업')),[]);
  }finally{globalThis.fetch=fetch;await server.close();}
});

test('new delivery receipt matches current source and outputs without overwriting PR216 evidence',()=>{
  const measured=summarizeSynthesis(result);
  measured.rows=measured.rows.map(({context,...row})=>({...row,questions:context?.experienceQuestions??[],synthesis:context?.blocks[2].lines??[]}));
  assert.deepEqual(measured,JSON.parse(readFileSync(new URL('data/context_synthesis_delivery.json',import.meta.url))));
  const old=JSON.parse(readFileSync(new URL('data/context_reading_delivery.json',import.meta.url)));
  assert.equal(old.policy,'natal-work-context-v1');assert.equal(old.baseline_commit,'875756c9113144148fcbb88fb7adce3477612af4');
});
