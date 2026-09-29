import assert from 'node:assert/strict';
import {test,before} from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {buildContextReading} from '../../dosa-app/engine/src/contextReading.js';
import {buildReport} from '../../dosa-app/engine/src/report.js';
import {chartToKeys} from '../../dosa-app/engine/src/keyset.js';
import {detectRelations} from '../../dosa-app/engine/src/relations.js';
import {compareHyeongScope,summarizeHyeongScope,calendarSamples,actual,priorReading} from './measure_hyeong_scope.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const copy=v=>JSON.parse(JSON.stringify(v));
let result;before(async()=>{result=await compareHyeongScope();});
function assertOnlyHyeongChange(current,previous){
 const normal=copy(current);normal.policy=previous.policy;delete normal.monthDayHyeong;
 const r=current.monthDayHyeong;
 if(r.status==='present'){
  assert.ok(current.blocks[2].lines.includes(r.facts));assert.ok(current.blocks[2].lines.includes(r.interpretation));
  assert.equal(current.experienceQuestions[1].prompt,previous.experienceQuestions[1].prompt+' '+r.question);
  normal.blocks[2].lines=normal.blocks[2].lines.filter(l=>l!==r.facts&&l!==r.interpretation);
  normal.experienceQuestions[1]=copy(previous.experienceQuestions[1]);normal.blocks[3].lines[1]=previous.blocks[3].lines[1];
 }else{assert.deepEqual(r.participants,[]);for(const key of ['form','relation','facts','interpretation','question'])assert.equal(r[key],null);assert.equal(r.branchKindCount,0);}
 assert.deepEqual(normal,previous);
}

test('20736 independent branch vectors: repeated positions never upgrade partial hyeong to full',()=>{
 const keys=['year','month','day','hour'],counts={partial:0,full:0,absent:0};let withRepeat=0;
 for(let y=0;y<12;y++)for(let m=0;m<12;m++)for(let d=0;d<12;d++)for(let h=0;h<12;h++){
  const b=[y,m,d,h],c={input:{hour:12,minute:0},pillarsIdx:{year:y,month:m,day:d+12*((y+m+h)%5),hour:h}},original=copy(c);
  const family=[[2,5,8],[1,10,7]].find(f=>f.includes(m)&&f.includes(d));
  const distinct=family?[...new Set(b.filter(x=>family.includes(x)))]:[];
  const expected=distinct.length>=2?(distinct.length===3?'full':'partial'):null;
  const r=buildContextReading(c),rel=r.monthDayHyeong;counts[expected??'absent']++;
  assert.equal(rel.form,expected);assert.equal(rel.status,expected?'present':'absent');
  assertOnlyHyeongChange(r,priorReading(c));assert.deepEqual(c,original);
  assert.equal(r.experienceQuestions.length,3);assert.equal(r.probability,null);assert.equal(r.trainingEligible,false);
  if(expected){
   const indices=b.flatMap((v,i)=>family.includes(v)?[i]:[]);
   assert.deepEqual(rel.participants.map(p=>p.position),indices.map(i=>keys[i]));
   assert.deepEqual(rel.participants.map(p=>p.branch),indices.map(i=>b[i]));assert.equal(rel.branchKindCount,distinct.length);
   const raw=detectRelations(c.pillarsIdx).hyeong.find(x=>(x.partial||x.name.endsWith('삼형'))&&x.positions.includes('월')&&x.positions.includes('일'));
   assert.deepEqual(rel.relation,raw);assert.equal(rel.relation.partial===true,expected==='partial');
   assert.match(rel.facts,/갈등·질병·성패·변화 시기나 기운의 세기를 정하지/);
   assert.match(rel.interpretation,/상쇄하거나 힘을 합산하지/);assert.match(rel.question,/조정할 필요가 없었거나 그런 경험이 없다면/);
   if(indices.length>distinct.length){withRepeat++;assert.match(rel.facts,/같은 글자가 여러 자리에 있어도/);}
   for(const p of rel.participants){assert.ok(rel.facts.includes(`지(${p.branchCharacter})`));assert.ok(rel.interpretation.includes(`본기 ${p.character}(${p.tenGod})`));}
  }
 }
 assert.deepEqual(counts,{partial:1704,full:288,absent:18744});assert.ok(withRepeat>0);
});

test('literal calendar expectations distinguish two positions, third branch and repeated third positions',()=>{
 for(const [hour,form,name,positions,branches,characters,roles] of [
  [12,'partial','사신형',['month','day'],['巳','申'],['丙','庚'],['결과와 자원 관리','배움과 준비']],
  [4,'full','인사신삼형',['month','day','hour'],['巳','申','寅'],['丙','庚','甲'],['결과와 자원 관리','배움과 준비','표현과 실행']],
  [10,'partial','사신형',['month','day','hour'],['巳','申','巳'],['丙','庚','丙'],['결과와 자원 관리','배움과 준비','결과와 자원 관리']],
  [16,'partial','사신형',['month','day','hour'],['巳','申','申'],['丙','庚','庚'],['결과와 자원 관리','배움과 준비','배움과 준비']],
 ]){
  const r=buildContextReading(actual([2023,5,14,hour])),x=r.monthDayHyeong;
  assert.equal(r.dayPillar,'임신');assert.equal(x.form,form);assert.equal(x.relation.name,name);
  assert.deepEqual(x.participants.map(p=>p.position),positions);assert.deepEqual(x.participants.map(p=>p.branchCharacter),branches);
  assert.deepEqual(x.participants.map(p=>p.character),characters);
  const names={month:'월',day:'일',hour:'시'};
  x.participants.forEach((p,i)=>assert.ok(x.interpretation.includes(`${names[p.position]}지(${branches[i]}) 본기 ${characters[i]}(${p.tenGod})의 ‘${roles[i]}’`)));
  if(hour!==12)assert.ok(x.interpretation.includes(`시지(${branches[2]})까지 포함하므로`));
  assert.equal(r.monthDayCompound.status,'present');assertOnlyHyeongChange(r,priorReading(actual([2023,5,14,hour])));
 }
 assert.deepEqual(calendarSamples(),JSON.parse(readFileSync(new URL('data/hyeong_scope_samples.json',import.meta.url))));
});

test('other-position hyeong and pair-only sang/jahyeong do not leak into the selected scope',()=>{
 for(const pillars of [{year:2,month:3,day:0,hour:5},{year:0,month:4,day:4,hour:5},{year:1,month:2,day:5,hour:11},{year:1,month:1,day:10,hour:7}]){
  const c={input:{hour:12,minute:0},pillarsIdx:pillars},before=detectRelations(pillars),r=buildContextReading(c);
  assertOnlyHyeongChange(r,priorReading(c));assert.deepEqual(detectRelations(pillars),before);
 }
 assert.equal(buildContextReading({input:{hour:12,minute:0},pillarsIdx:{year:2,month:3,day:0,hour:5}}).monthDayHyeong.status,'absent');
 assert.equal(buildContextReading({input:{hour:12,minute:0},pillarsIdx:{year:0,month:4,day:4,hour:5}}).monthDayHyeong.status,'absent');
 const full=buildContextReading({input:{hour:12,minute:0},pillarsIdx:{year:1,month:1,day:10,hour:7}}).monthDayHyeong;
 assert.equal(full.form,'full');assert.equal(full.branchKindCount,3);assert.equal(full.participants.length,4);assert.equal(full.relation.name,'축술미삼형');
});

test('KB110/510 delivery preserves calculations and unknown8; summary and work consumers receive full participating scope',()=>{
 let known=0,unknown=0,present=0;
 for(const [i,row] of result.after.rows.entries()){
  const prior=result.before.rows[i];if(row.profile.hourUnknown){unknown++;assert.deepEqual(row,prior);assert.equal(row.requests.length,0);continue;}
  known++;const sec=row.report.sections.find(s=>s.id==='context-reading'),old=prior.report.sections.find(s=>s.id==='context-reading');
  assertOnlyHyeongChange(sec.context,old.context);const r=sec.context.monthDayHyeong;if(r.status==='present')present++;
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

test('generated, repeated and split hyeong notices survive once with three ordered work questions',async()=>{
 const require=createRequire(new URL('../../app/package.json',import.meta.url)),{createServer}=await import(pathToFileURL(require.resolve('vite')).href);
 const server=await createServer({root:root+'app',server:{middlewareMode:true},appType:'custom',logLevel:'error'}),fetch=globalThis.fetch;let count=0;
 try{
  const client=await server.ssrLoadModule('/src/data/dosaClient.ts'),topics=await server.ssrLoadModule('/src/data/dosaTopics.ts');
  for(const date of [[2023,5,14,12],[2023,5,14,4],[2023,5,14,10],[2024,2,5,12]]){
   const chart=actual(date),report=buildReport(chart,chartToKeys(chart),{index:{},aliases:{},bodies:{}}),r=report.sections.find(s=>s.id==='context-reading').context;
   const facts=r.monthDayHyeong.facts,qs=r.experienceQuestions,body='실제 경험을 더 확인할 본문이에요.';
   for(const topic of ['직업','성격'])for(const text of [body,[facts,...qs.map(q=>q.prompt),body].filter(Boolean).join(' '),[facts,...qs.map(q=>q.prompt),body].filter(Boolean).join(' ').split(/(?<=[.?!…])\s+/).join('\n\n')]){
    let sent;globalThis.fetch=async(_,o)=>{sent=JSON.parse(o.body);return Response.json({text});};
    const answer=await client.requestDosaText({topic,report,lines:topics.topicLines(report,topic),chefId:'noona',model:'sonnet',...(topic==='성격'?{question:'형에 참여하는 자리를 함께 읽어줘'}:{})});
    assert.ok(answer);if(facts){assert.ok(sent.chartSummary.includes(facts));assert.equal(answer.split(facts).length-1,1);for(const clause of facts.split(/(?<=[.?!…])\s+/))assert.equal(answer.split(clause).length-1,1);}
    if(topic==='직업')for(const q of qs){assert.equal(answer.split(q.prompt).length-1,1);assert.ok(answer.indexOf(body)<answer.indexOf(q.prompt));}count++;
   }
   if(facts){globalThis.fetch=async()=>Response.json({text:facts.split(/(?<=[.?!…])\s+/).join('\n\n')});
    assert.ok(await client.requestDosaText({topic:'성격',question:'이 관계만 설명해줘',report,lines:topics.topicLines(report,'성격'),chefId:'noona',model:'sonnet'}));}
  }
 }finally{globalThis.fetch=fetch;await server.close();}assert.equal(count,24);
});

test('unknown and malformed inputs withhold the reading; mutable results do not taint future calls',()=>{
 const c=actual([2023,5,14,4]);for(const value of [null,{}, {...c,birthTime:{status:'unknown'}},{...c,input:{...c.input,hourUnknown:true}},{...c,input:{...c.input,hour:null}},{...c,pillarsIdx:{...c.pillarsIdx,month:60}},{...c,pillarsIdx:{...c.pillarsIdx,day:null}}])assert.equal(buildContextReading(value),null);
 const old=buildContextReading(c),r=buildContextReading(c);r.monthDayHyeong.relation.positions[0]='mutated';r.monthDayHyeong.participants[0].character='mutated';r.experienceQuestions[1].prompt='mutated';assert.deepEqual(buildContextReading(c),old);
});

test('current receipt preserves PR224 original output hashes and all calculation results',()=>{
 const summary=summarizeHyeongScope(result),previous=JSON.parse(readFileSync(new URL('data/month_day_compound_delivery.json',import.meta.url)));
 assert.deepEqual(summary,JSON.parse(readFileSync(new URL('data/hyeong_scope_delivery.json',import.meta.url))));
 assert.deepEqual(summary.rows.map(r=>r.before_sha256),previous.rows.map(r=>r.after_sha256));assert.ok(summary.rows.every(r=>r.calculations_unchanged));
});
