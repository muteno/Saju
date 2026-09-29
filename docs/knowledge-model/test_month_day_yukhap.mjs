import assert from 'node:assert/strict';
import {test,before} from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {buildContextReading} from '../../dosa-app/engine/src/contextReading.js';
import {buildReport} from '../../dosa-app/engine/src/report.js';
import {chartToKeys} from '../../dosa-app/engine/src/keyset.js';
import {compareMonthDayYukhap,summarizeMonthDayYukhap,calendarSamples,calendarPairs,actual,priorReading} from './measure_month_day_yukhap.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),copy=v=>JSON.parse(JSON.stringify(v));
let result;before(async()=>{result=await compareMonthDayYukhap();});

function assertOnlyRelationChange(current,previous){
 const normal=copy(current);normal.policy=previous.policy;delete normal.monthDayYukhap;
 if(current.monthDayYukhap.status==='present'){
  const r=current.monthDayYukhap;
  assert.ok(current.blocks[2].lines.includes(r.facts));assert.ok(current.blocks[2].lines.includes(r.interpretation));
  assert.ok(current.experienceQuestions[1].prompt.startsWith(previous.experienceQuestions[1].prompt+' '));
  assert.ok(current.experienceQuestions[1].prompt.endsWith(r.question));
  normal.blocks[2].lines=normal.blocks[2].lines.filter(l=>l!==r.facts&&l!==r.interpretation);
  normal.experienceQuestions[1]=copy(previous.experienceQuestions[1]);normal.blocks[3].lines[1]=previous.blocks[3].lines[1];
 }else{
  assert.equal(current.monthDayYukhap.facts,null);assert.equal(current.monthDayYukhap.interpretation,null);assert.equal(current.monthDayYukhap.question,null);
 }
 assert.deepEqual(normal,previous);
}

test('7200 independent natal vectors cover all144 month/day pairs and keep other-position relations outside the reading',()=>{
 const pairs=new Set(),hits=new Set();let present=0;
 for(let day=0;day<60;day++)for(let month=0;month<60;month++)for(const hour of [0,17]){
  const c={input:{hour:12,minute:0},pillarsIdx:{year:(day+6)%60,month,day,hour}},original=copy(c);
  const r=buildContextReading(c),old=priorReading(c),rel=r.monthDayYukhap;
  const m=month%12,d=day%12,expected=new Set(['0:1','2:11','3:10','4:9','5:8','6:7']).has([m,d].sort((a,b)=>a-b).join(':'));
  pairs.add(`${m}:${d}`);assert.equal(rel.status,expected?'present':'absent');assert.equal(rel.scope,'natal-month-day-branch-yukhap');
  assert.deepEqual(rel.branches,[m,d]);assertOnlyRelationChange(r,old);assert.deepEqual(c,original);
  assert.deepEqual(r.experienceQuestions[0],old.experienceQuestions[0]);assert.deepEqual(r.experienceQuestions[2],old.experienceQuestions[2]);
  assert.equal(r.experienceQuestions.length,3);assert.equal(r.probability,null);assert.equal(r.predictionEnabled,false);assert.equal(r.trainingEligible,false);
  if(expected){present++;hits.add([m,d].sort((a,b)=>a-b).join(':'));assert.deepEqual(rel.relation.positions,['월','일']);assert.notEqual(r.monthMain.group,rel.dayMain.group);assert.equal(r.monthDayChung.status,'absent');
   assert.match(rel.facts,/월지.+일지.+육합/);assert.match(rel.facts,/합화 성립·원래 오행의 소실이나 실제 조화·성공·변화 시기/);assert.match(rel.question,/없었거나|없다면/);
  }else assert.equal(rel.relation,null);
 }
 assert.equal(pairs.size,144);assert.equal(present,600);assert.deepEqual([...hits].sort(),['0:1','2:11','3:10','4:9','5:8','6:7']);
});

test('three real same-day/role/score/root-state pairs distinguish a present month/day yukhap from its absence',()=>{
 const samples=calendarSamples();assert.deepEqual(samples,JSON.parse(readFileSync(new URL('data/month_day_yukhap_samples.json',import.meta.url))));
 for(const pair of calendarPairs){
  const readings=pair.map(actual).map(buildContextReading),old=pair.map(actual).map(priorReading);
  const [a,b]=readings;assert.equal(a.dayPillar,b.dayPillar);assert.equal(a.monthMain.group,b.monthMain.group);assert.equal(a.hourStem.group,b.hourStem.group);
  assert.equal(a.strength.observation.score,b.strength.observation.score);
  assert.deepEqual([a.strength.roots.sameStem.status,a.strength.roots.sameElement.status],[b.strength.roots.sameStem.status,b.strength.roots.sameElement.status]);
  assert.deepEqual(readings.map(r=>r.monthDayYukhap.status),['present','absent']);
  assert.notEqual(a.experienceQuestions[1].prompt,b.experienceQuestions[1].prompt);
  assertOnlyRelationChange(a,old[0]);assertOnlyRelationChange(b,old[1]);
 }
});

test('real KB110/510 delivery retains calculations and all consumers outside context card/work grounds/summary, unknown8 request0',()=>{
 let known=0,unknown=0,present=0;
 for(const [i,row] of result.after.rows.entries()){
  const prior=result.before.rows[i];if(row.profile.hourUnknown){unknown++;assert.deepEqual(row,prior);assert.equal(row.requests.length,0);continue;}
  known++;const sec=row.report.sections.find(s=>s.id==='context-reading'),old=prior.report.sections.find(s=>s.id==='context-reading');
  assertOnlyRelationChange(sec.context,old.context);const r=sec.context.monthDayYukhap;if(r.status==='present')present++;
  assert.deepEqual(row.reading.cards.find(c=>c.id==='context-reading').blocks,sec.context.blocks);
  for(const text of [...sec.context.experienceQuestions.map(q=>q.prompt),...(r.status==='present'?[r.facts,r.interpretation]:[])]){
   assert.ok(row.summary.includes(text));assert.ok(row.topics.직업.some(l=>l.text===text));for(const req of row.requests)assert.ok(req.chartSummary.includes(text));
  }
  const normal=copy(row);for(const rep of [normal.report,normal.hook.report])rep.sections=rep.sections.map(s=>s.id==='context-reading'?copy(old):s);
  for(const reading of [normal.reading,normal.hook.reading])reading.cards=reading.cards.map(c=>c.id==='context-reading'?copy(prior.reading.cards.find(c=>c.id==='context-reading')):c);
  normal.topics.직업=[...copy(prior.topics.직업.slice(0,old.lines.length)),...normal.topics.직업.slice(sec.lines.length)];
  const replace=s=>s.replace(`원국 조건에 따른 풀이: ${sec.lines.join(' / ')}`,`원국 조건에 따른 풀이: ${old.lines.join(' / ')}`);
  normal.summary=replace(normal.summary);
  for(const req of normal.requests){req.chartSummary=replace(req.chartSummary);if(req.topic==='직업'){
   assert.deepEqual(req.grounds.slice(0,sec.lines.length).map(l=>l.text),sec.lines);
   req.grounds=[...copy(prior.requests.find(x=>x.topic==='직업').grounds.slice(0,old.lines.length)),...req.grounds.slice(sec.lines.length)];
  }}assert.deepEqual(normal,prior,row.id);
 }
 assert.equal(known,102);assert.equal(unknown,8);assert.ok(present>0);assert.equal(result.after.rows.reduce((n,r)=>n+r.requests.length,0),510);
});

test('generated complete/split facts and questions appear once; absent/unknown do not acquire relation notices',async()=>{
 const require=createRequire(new URL('../../app/package.json',import.meta.url)),{createServer}=await import(pathToFileURL(require.resolve('vite')).href);
 const server=await createServer({root:root+'app',server:{middlewareMode:true},appType:'custom',logLevel:'error'}),fetch=globalThis.fetch;let count=0;
 try{
  const client=await server.ssrLoadModule('/src/data/dosaClient.ts'),topics=await server.ssrLoadModule('/src/data/dosaTopics.ts');
  for(const date of calendarPairs.flat()){
   const chart=actual(date),report=buildReport(chart,chartToKeys(chart),{index:{},aliases:{},bodies:{}}),r=report.sections.find(s=>s.id==='context-reading').context;
   const facts=r.monthDayYukhap.facts,qs=r.experienceQuestions,body='실제 경험을 더 확인할 본문이에요.';
   for(const topic of ['직업','성격'])for(const text of [body,[facts,...qs.map(q=>q.prompt),body].filter(Boolean).join(' '),[facts,...qs.map(q=>q.prompt),body].filter(Boolean).join(' ').split(/(?<=[.?!…])\s+/).join('\n\n')]){
    let sent;globalThis.fetch=async(_,o)=>{sent=JSON.parse(o.body);return Response.json({text});};
    const answer=await client.requestDosaText({topic,report,lines:topics.topicLines(report,topic),chefId:'noona',model:'sonnet',...(topic==='성격'?{question:'월지와 일지를 같이 읽어줘'}:{})});
    assert.ok(answer);if(facts){assert.ok(sent.chartSummary.includes(facts));assert.equal(answer.split(facts).length-1,1);for(const clause of facts.split(/(?<=[.?!…])\s+/))assert.equal(answer.split(clause).length-1,1);}
    else assert.ok(!client.readingNotices(report,topics.topicLines(report,topic)).some(s=>s.includes('합화 성립·원래 오행의 소실')));
    if(topic==='직업')for(const q of qs){assert.equal(answer.split(q.prompt).length-1,1);assert.ok(answer.indexOf(body)<answer.indexOf(q.prompt));}
    count++;
   }
   if(facts){globalThis.fetch=async()=>Response.json({text:facts.split(/(?<=[.?!…])\s+/).join('\n\n')});
    assert.ok(await client.requestDosaText({topic:'성격',question:'이 관계만 설명해줘',report,lines:topics.topicLines(report,'성격'),chefId:'noona',model:'sonnet'}));}
   globalThis.fetch=async()=>Response.json({text:qs[1].prompt});
   assert.equal(await client.requestDosaText({topic:'직업',report,lines:topics.topicLines(report,'직업'),chefId:'noona',model:'sonnet'}),null);
  }
 }finally{globalThis.fetch=fetch;await server.close();}assert.equal(count,36);
});

test('unknown/malformed charts stay withheld and returned relation mutations cannot change later calls',()=>{
 const c=actual(calendarPairs[0][0]);for(const value of [null,{}, {...c,birthTime:{status:'unknown'}},{...c,input:{...c.input,hourUnknown:true}},{...c,input:{...c.input,hour:null}},{...c,pillarsIdx:{...c.pillarsIdx,month:60}},{...c,pillarsIdx:{...c.pillarsIdx,day:null}}])assert.equal(buildContextReading(value),null);
 const old=buildContextReading(c),r=buildContextReading(c);r.monthDayYukhap.relation.positions[0]='mutated';r.monthDayYukhap.branches[0]=99;r.monthDayYukhap.dayMain.character='mutated';r.experienceQuestions[1].prompt='mutated';
 assert.deepEqual(buildContextReading(c),old);
});

test('all six yukhap pairs occur in real dates, including concurrent pa without erasing it',async()=>{
 const {detectRelations}=await import('../../dosa-app/engine/src/relations.js');
 const names=new Set();
 for(const input of [[2023,1,18,12],[2024,2,5,12],[2023,11,5,12],[2023,4,9,12],[2023,5,14,12],[2023,8,4,12]]){
  const chart=actual(input),r=buildContextReading(chart),old=priorReading(chart);
  assert.equal(r.monthDayYukhap.status,'present');assertOnlyRelationChange(r,old);names.add(r.monthDayYukhap.relation.name);
  if([input[1],input[2]].join(':')==='2:5'||input[1]===5)assert.ok(detectRelations(chart.pillarsIdx).pa.some(x=>x.positions.join(',')==='월,일'));
 }assert.equal(names.size,6);
});

test('current receipt retains all original PR222 output hashes and fixed source bytes',()=>{
 const summary=summarizeMonthDayYukhap(result),previous=JSON.parse(readFileSync(new URL('data/month_day_relation_delivery.json',import.meta.url)));
 assert.deepEqual(summary,JSON.parse(readFileSync(new URL('data/month_day_yukhap_delivery.json',import.meta.url))));
 assert.deepEqual(summary.rows.map(r=>r.before_sha256),previous.rows.map(r=>r.after_sha256));assert.ok(summary.rows.every(r=>r.calculations_unchanged));
});
