import assert from 'node:assert/strict';
import {test,before} from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {buildContextReading} from '../../dosa-app/engine/src/contextReading.js';
import {buildReport} from '../../dosa-app/engine/src/report.js';
import {chartToKeys} from '../../dosa-app/engine/src/keyset.js';
import {detectRelations} from '../../dosa-app/engine/src/relations.js';
import {compareMonthDayCompound,summarizeMonthDayCompound,calendarSamples,actual,priorReading} from './measure_month_day_compound.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const copy=v=>JSON.parse(JSON.stringify(v));
let result;before(async()=>{result=await compareMonthDayCompound();});

function assertOnlyCompoundChange(current,previous){
 const normal=copy(current);normal.policy=previous.policy;delete normal.monthDayCompound;
 const r=current.monthDayCompound;
 if(r.status==='present'){
  assert.ok(current.blocks[2].lines.includes(r.facts));assert.ok(current.blocks[2].lines.includes(r.interpretation));
  assert.ok(!current.blocks[2].lines.includes(current.monthDayYukhap.facts));
  const oldQuestion=previous.monthDayYukhap.question;
  const prefix=previous.experienceQuestions[1].prompt.slice(0,-oldQuestion.length);
  assert.equal(current.experienceQuestions[1].prompt,prefix+r.question);
  normal.blocks[2].lines=normal.blocks[2].lines.map(l=>l===r.facts?previous.monthDayYukhap.facts:l===r.interpretation?previous.monthDayYukhap.interpretation:l);
  normal.experienceQuestions[1]=copy(previous.experienceQuestions[1]);normal.blocks[3].lines[1]=previous.blocks[3].lines[1];
 }else{
  assert.deepEqual(r.relations,[]);assert.equal(r.facts,null);assert.equal(r.interpretation,null);assert.equal(r.question,null);
 }
 assert.deepEqual(normal,previous);
}

test('7200 independent vectors: only the same month/day yukhap+pa pairs get a joint reading',()=>{
 const pairs=new Set(),hits=new Set();let present=0;
 for(let day=0;day<60;day++)for(let month=0;month<60;month++)for(const hour of [0,17]){
  const c={input:{hour:12,minute:0},pillarsIdx:{year:(day+6)%60,month,day,hour}},original=copy(c);
  const r=buildContextReading(c),old=priorReading(c),rel=r.monthDayCompound;
  const m=month%12,d=day%12,key=[m,d].sort((a,b)=>a-b).join(':');
  const expected=key==='2:11'||key==='5:8';pairs.add(`${m}:${d}`);
  assert.equal(rel.status,expected?'present':'absent');assert.equal(rel.scope,'natal-month-day-yukhap-pa');
  assert.deepEqual(rel.branches,[m,d]);assertOnlyCompoundChange(r,old);assert.deepEqual(c,original);
  assert.equal(r.experienceQuestions.length,3);assert.deepEqual(r.experienceQuestions[0],old.experienceQuestions[0]);assert.deepEqual(r.experienceQuestions[2],old.experienceQuestions[2]);
  assert.equal(r.probability,null);assert.equal(r.predictionEnabled,false);assert.equal(r.trainingEligible,false);
  if(expected){present++;hits.add(key);assert.deepEqual(rel.relations.map(x=>x.kind),['yukhap','pa']);
   for(const x of rel.relations){assert.deepEqual(x.positions,['월','일']);assert.ok(rel.facts.includes(x.name));}
   assert.match(rel.facts,/합이 파를 없애거나/);assert.match(rel.facts,/합화/);assert.match(rel.facts,/실제 조화·갈등·성공·실패·변화 시기/);
   assert.match(rel.interpretation,/힘으로 합산하지/);assert.match(rel.question,/처음부터 따로 다룬/);assert.match(rel.question,/조정하거나 나눈/);assert.match(rel.question,/차이나 경험이 없다면/);
  }
 }
 assert.equal(pairs.size,144);assert.equal(present,200);assert.deepEqual([...hits].sort(),['2:11','5:8']);
});

test('calendar inputs retain solo/no-relation readings and distinguish both compound pairs',()=>{
 const cases=[[[2024,2,5,12],'present'],[[2023,5,14,12],'present'],[[2023,1,18,12],'absent'],[[2023,4,9,12],'absent'],[[2025,7,2,12],'absent'],[[2024,4,28,12],'absent']];
 for(const [date,status] of cases){const c=actual(date),r=buildContextReading(c);assert.equal(r.monthDayCompound.status,status);assertOnlyCompoundChange(r,priorReading(c));}
 const [a,b]=[[2023,5,14,12],[2025,7,2,12]].map(actual).map(buildContextReading);
 assert.equal(a.dayPillar,b.dayPillar);assert.equal(a.monthMain.group,b.monthMain.group);assert.equal(a.hourStem.group,b.hourStem.group);
 assert.equal(a.strength.observation.score,b.strength.observation.score);
 assert.deepEqual([a.strength.roots.sameStem.status,a.strength.roots.sameElement.status],[b.strength.roots.sameStem.status,b.strength.roots.sameElement.status]);
 assert.notEqual(a.experienceQuestions[1].prompt,b.experienceQuestions[1].prompt);
 // Literal calendar expectations prevent regenerated snapshots from blessing
 // a month/day role swap. These two pairs have different principal-stem roles.
 for(const [date,monthStem,dayStem,monthRole,dayRole] of [
  [[2023,5,14,12],'丙','庚','결과와 자원 관리','배움과 준비'],
  [[2024,2,5,12],'甲','壬','규칙과 책임','결과와 자원 관리'],
 ]){
  const r=buildContextReading(actual(date)),joint=r.monthDayCompound;
  assert.equal(r.monthMain.character,monthStem);assert.equal(joint.dayMain.character,dayStem);
  assert.ok(joint.interpretation.startsWith(`월지 본기의 ‘${monthRole}’ 주제와 일지 본기 ${dayStem}(`));
  assert.ok(joint.interpretation.includes(`의 ‘${dayRole}’ 주제를 연결해`));
  assert.ok(joint.question.startsWith(`또 월지의 ‘${monthRole}’ 주제와 일지의 ‘${dayRole}’ 주제를`));
 }
 assert.deepEqual(calendarSamples(),JSON.parse(readFileSync(new URL('data/month_day_compound_samples.json',import.meta.url))));
});

test('third positions and partial/full hyeong remain separate; standalone pa is not a compound reading',()=>{
 for(const year of [2,5,8,11,17])for(const hour of [0,2,5,8,11]){
  const c={input:{hour:12,minute:0},pillarsIdx:{year,month:5,day:8,hour}};
  const before=detectRelations(c.pillarsIdx),r=buildContextReading(c);
  assert.equal(r.monthDayCompound.status,'present');assert.equal(r.monthDayCompound.relations.length,2);
  assert.deepEqual(detectRelations(c.pillarsIdx),before);assertOnlyCompoundChange(r,priorReading(c));
  assert.ok(r.monthDayCompound.relations.every(x=>x.positions.join(',')==='월,일'));
 }
 for(const [month,day] of [[0,9],[1,4],[3,6],[10,7],[5,2]]){
  const c={input:{hour:12,minute:0},pillarsIdx:{year:11,month,day,hour:5}},r=buildContextReading(c);
  assert.equal(r.monthDayCompound.status,'absent');assertOnlyCompoundChange(r,priorReading(c));
 }
});

test('KB110/510 delivery preserves calculation/Brain/fortune and unknown8; all summary consumers receive the joint reading',()=>{
 let known=0,unknown=0,present=0;
 for(const [i,row] of result.after.rows.entries()){
  const prior=result.before.rows[i];if(row.profile.hourUnknown){unknown++;assert.deepEqual(row,prior);assert.equal(row.requests.length,0);continue;}
  known++;const sec=row.report.sections.find(s=>s.id==='context-reading'),old=prior.report.sections.find(s=>s.id==='context-reading');
  assertOnlyCompoundChange(sec.context,old.context);const r=sec.context.monthDayCompound;if(r.status==='present')present++;
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

test('generated/split compound notices and work questions survive once; solo and absent notices remain unchanged',async()=>{
 const require=createRequire(new URL('../../app/package.json',import.meta.url)),{createServer}=await import(pathToFileURL(require.resolve('vite')).href);
 const server=await createServer({root:root+'app',server:{middlewareMode:true},appType:'custom',logLevel:'error'}),fetch=globalThis.fetch;let count=0;
 try{
  const client=await server.ssrLoadModule('/src/data/dosaClient.ts'),topics=await server.ssrLoadModule('/src/data/dosaTopics.ts');
  for(const date of [[2024,2,5,12],[2023,5,14,12],[2023,1,18,12],[2025,7,2,12]]){
   const chart=actual(date),report=buildReport(chart,chartToKeys(chart),{index:{},aliases:{},bodies:{}}),r=report.sections.find(s=>s.id==='context-reading').context;
   const compound=r.monthDayCompound.status==='present';
   const facts=compound?r.monthDayCompound.facts:r.monthDayYukhap.facts,qs=r.experienceQuestions,body='실제 경험을 더 확인할 본문이에요.';
   for(const topic of ['직업','성격'])for(const text of [body,[facts,...qs.map(q=>q.prompt),body].filter(Boolean).join(' '),[facts,...qs.map(q=>q.prompt),body].filter(Boolean).join(' ').split(/(?<=[.?!…])\s+/).join('\n\n')]){
    let sent;globalThis.fetch=async(_,o)=>{sent=JSON.parse(o.body);return Response.json({text});};
    const answer=await client.requestDosaText({topic,report,lines:topics.topicLines(report,topic),chefId:'noona',model:'sonnet',...(topic==='성격'?{question:'합과 파를 함께 읽어줘'}:{})});
    assert.ok(answer);if(facts){assert.ok(sent.chartSummary.includes(facts));assert.equal(answer.split(facts).length-1,1);for(const clause of facts.split(/(?<=[.?!…])\s+/))assert.equal(answer.split(clause).length-1,1);}
    if(compound)assert.ok(!client.readingNotices(report,topics.topicLines(report,topic)).includes(r.monthDayYukhap.facts));
    else assert.ok(!client.readingNotices(report,topics.topicLines(report,topic)).some(s=>s.includes('합이 파를 없애거나')));
    if(topic==='직업')for(const q of qs){assert.equal(answer.split(q.prompt).length-1,1);assert.ok(answer.indexOf(body)<answer.indexOf(q.prompt));}count++;
   }
   if(facts){globalThis.fetch=async()=>Response.json({text:facts.split(/(?<=[.?!…])\s+/).join('\n\n')});
    assert.ok(await client.requestDosaText({topic:'성격',question:'이 관계만 설명해줘',report,lines:topics.topicLines(report,'성격'),chefId:'noona',model:'sonnet'}));}
  }
 }finally{globalThis.fetch=fetch;await server.close();}assert.equal(count,24);
});

test('unknown/malformed input is withheld and mutating a returned compound does not affect future readings',()=>{
 const c=actual([2023,5,14,12]);for(const value of [null,{}, {...c,birthTime:{status:'unknown'}},{...c,input:{...c.input,hourUnknown:true}},{...c,input:{...c.input,hour:null}},{...c,pillarsIdx:{...c.pillarsIdx,month:60}},{...c,pillarsIdx:{...c.pillarsIdx,day:null}}])assert.equal(buildContextReading(value),null);
 const old=buildContextReading(c),r=buildContextReading(c);r.monthDayCompound.relations[0].positions[0]='mutated';r.monthDayCompound.relations[1].name='mutated';r.monthDayCompound.branches[0]=99;r.experienceQuestions[1].prompt='mutated';
 assert.deepEqual(buildContextReading(c),old);
});

test('current receipt preserves the original PR223 after hashes and all calculation results',()=>{
 const summary=summarizeMonthDayCompound(result),previous=JSON.parse(readFileSync(new URL('data/month_day_yukhap_delivery.json',import.meta.url)));
 assert.deepEqual(summary,JSON.parse(readFileSync(new URL('data/month_day_compound_delivery.json',import.meta.url))));
 assert.deepEqual(summary.rows.map(r=>r.before_sha256),previous.rows.map(r=>r.after_sha256));assert.ok(summary.rows.every(r=>r.calculations_unchanged));
});
