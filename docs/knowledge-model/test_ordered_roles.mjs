import assert from 'node:assert/strict';
import {test,before} from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {buildContextReading,CONTEXT_READING_NOTICE} from '../../dosa-app/engine/src/contextReading.js';
import {computeChart} from '../../dosa-app/engine/src/manseryeok.js';
import {buildReport} from '../../dosa-app/engine/src/report.js';
import {chartToKeys} from '../../dosa-app/engine/src/keyset.js';
import {compareOrderedRoles,summarizeOrderedRoles} from './measure_ordered_roles.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const {terms}=JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
const priorSource=readFileSync(new URL('fixtures/hidden-root-context-v1/dosa-app/engine/src/contextReading.js',import.meta.url),'utf8')
 .replaceAll("'./tables.js'",JSON.stringify(pathToFileURL(root+'dosa-app/engine/src/tables.js').href))
 .replaceAll("'./judge.js'",JSON.stringify(pathToFileURL(root+'dosa-app/engine/src/judge.js').href));
const {buildContextReading:priorReading}=await import('data:text/javascript;base64,'+Buffer.from(priorSource).toString('base64'));
const copy=v=>JSON.parse(JSON.stringify(v));
const groups=['비겁','식상','재성','관성','인성'];
const targeted=r=>['식상','재성','관성'].includes(r.monthMain.group)&&['식상','재성','관성'].includes(r.hourStem.group)&&r.monthMain.group!==r.hourStem.group;
const pairs=[[[2024,3,9,12],[2024,5,8,8]],[[2024,1,13,8],[2024,11,8,0]],[[2024,5,9,12],[2024,11,5,8]]];
const actual=([year,month,day,hour])=>computeChart({year,month,day,hour,minute:0,gender:'F',solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
let result;
before(async()=>{result=await compareOrderedRoles();});

function assertOnlyOrderedChange(current,previous){
 const normal=copy(current);normal.policy=previous.policy;
 if(targeted(current)){
  assert.notEqual(current.blocks[2].lines[0],previous.blocks[2].lines[0]);
  assert.notEqual(current.experienceQuestions[0].prompt,previous.experienceQuestions[0].prompt);
  assert.equal(current.experienceQuestions[0].id,previous.experienceQuestions[0].id);
  normal.blocks[2].lines[0]=previous.blocks[2].lines[0];
  normal.experienceQuestions[0]=copy(previous.experienceQuestions[0]);
  normal.blocks[3].lines[0]=previous.blocks[3].lines[0];
 }
 assert.deepEqual(normal,previous);
}

test('7200 symbol inputs retain all observations and isolate the six ordered pairs from the other19',()=>{
 const changed=new Set(),unchanged=new Set();
 for(let day=0;day<10;day++)for(let month=0;month<12;month++)for(let hour=0;hour<60;hour++){
  const c={input:{hour:12,minute:0},pillarsIdx:{year:0,month,day,hour}};
  const original=copy(c),r=buildContextReading(c),old=priorReading(c);
  const key=[groups.indexOf(r.monthMain.group),groups.indexOf(r.hourStem.group)].join(':');
  assertOnlyOrderedChange(r,old);assert.deepEqual(c,original);
  (targeted(r)?changed:unchanged).add(key);
  assert.equal(r.experienceQuestions.length,3);assert.equal(r.probability,null);assert.equal(r.trainingEligible,false);assert.equal(r.predictionEnabled,false);
  if(targeted(r)){
   assert.match(r.blocks[2].lines[0],/월지 본기.+시간.+월지 본기의.+시간의/);
   assert.match(r.blocks[2].lines[0],/실제 행동이나 인생의 시간 순서를 뜻하지 않/);
   assert.match(r.experienceQuestions[0].prompt,/없었|없다면|없었다면/);
  }
 }
 assert.deepEqual([...changed].sort(),['1:2','1:3','2:1','2:3','3:1','3:2']);assert.equal(unchanged.size,19);
});

test('three real calendar pairs retain same day/score/root state but reverse reading focus and first experience question',()=>{
 const expected=[['식상','재성'],['식상','관성'],['재성','관성']];
 const samples=JSON.parse(readFileSync(new URL('data/ordered_roles_samples.json',import.meta.url)));
 assert.equal(samples.baseline_commit,'ca3afb9b4ec22949f15c7eba72972fe76e2f1248');assert.equal(samples.pairs.length,3);
 for(const [i,pair] of pairs.entries()){
  const current=pair.map(actual).map(buildContextReading),old=pair.map(actual).map(priorReading);
  assert.equal(current[0].dayPillar,current[1].dayPillar);
  assert.equal(current[0].strength.observation.score,current[1].strength.observation.score);
  assert.deepEqual(current.map(r=>[r.monthMain.group,r.hourStem.group]),[expected[i],[...expected[i]].reverse()]);
  const states=r=>[r.strength.roots.sameStem.status,r.strength.roots.sameElement.status];
  assert.deepEqual(states(current[0]),states(current[1]));
  assert.equal(old[0].blocks[2].lines[0].split('조합에서는 ')[1],old[1].blocks[2].lines[0].split('조합에서는 ')[1]);
  assert.equal(old[0].experienceQuestions[0].prompt,old[1].experienceQuestions[0].prompt);
  assert.notEqual(current[0].blocks[2].lines[0].split('조합에서는 ')[1],current[1].blocks[2].lines[0].split('조합에서는 ')[1]);
  assert.notEqual(current[0].experienceQuestions[0].prompt,current[1].experienceQuestions[0].prompt);
  current.forEach((r,j)=>{assertOnlyOrderedChange(r,old[j]);
   for(const [version,reading] of [['before',old[j]],['after',r]]){
    const sample=samples.pairs[i][version][j];for(const [k,v] of Object.entries(sample.input))assert.equal(actual(pair[j]).input[k],v);
    assert.equal(sample.day,reading.dayPillar);assert.equal(sample.a,reading.monthMain.group);assert.equal(sample.b,reading.hourStem.group);
    assert.equal(sample.score,reading.strength.observation.score);assert.equal(sample.band,reading.strength.band);assert.deepEqual(sample.roots,states(reading));
    assert.equal(sample.text,reading.blocks[2].lines[0]);assert.equal(sample.question,reading.experienceQuestions[0].prompt);
   }
  });
 }
});

test('actual KB110/510 consumers preserve everything outside the context card/work grounds/summary; unknown8 requests0',()=>{
 let known=0,unknown=0,changed=0;
 for(const [i,row] of result.after.rows.entries()){
  const prior=result.before.rows[i];
  if(row.profile.hourUnknown){unknown++;assert.deepEqual(row,prior);assert.equal(row.requests.length,0);continue;}
  known++;
  const sec=row.report.sections.find(s=>s.id==='context-reading'),old=prior.report.sections.find(s=>s.id==='context-reading');
  assertOnlyOrderedChange(sec.context,old.context);if(targeted(sec.context))changed++;
  const card=row.reading.cards.find(c=>c.id==='context-reading');assert.deepEqual(card.blocks,sec.context.blocks);
  for(const text of [sec.context.blocks[2].lines[0],...sec.context.experienceQuestions.map(q=>q.prompt),sec.context.strength.facts,sec.context.strength.roots.facts]){
   assert.ok(row.summary.includes(text));assert.ok(row.topics.직업.some(l=>l.text===text));
   for(const req of row.requests)assert.ok(req.chartSummary.includes(text));
  }
  const normal=copy(row);
  for(const rep of [normal.report,normal.hook.report])rep.sections=rep.sections.map(s=>s.id==='context-reading'?copy(old):s);
  const oldCard=prior.reading.cards.find(c=>c.id==='context-reading');
  for(const reading of [normal.reading,normal.hook.reading])reading.cards=reading.cards.map(c=>c.id==='context-reading'?copy(oldCard):c);
  normal.topics.직업=[...copy(prior.topics.직업.slice(0,old.lines.length)),...normal.topics.직업.slice(sec.lines.length)];
  const replace=s=>s.replace(`원국 조건에 따른 풀이: ${sec.lines.join(' / ')}`,`원국 조건에 따른 풀이: ${old.lines.join(' / ')}`);
  normal.summary=replace(normal.summary);
  for(const req of normal.requests){req.chartSummary=replace(req.chartSummary);if(req.topic==='직업'){
   assert.deepEqual(req.grounds.slice(0,sec.lines.length).map(l=>l.text),sec.lines);
   req.grounds=[...copy(prior.requests.find(x=>x.topic==='직업').grounds.slice(0,old.lines.length)),...req.grounds.slice(sec.lines.length)];
  }}
  assert.deepEqual(normal,prior,row.id);
 }
 assert.equal(known,102);assert.equal(unknown,8);assert.ok(changed>0);
 assert.equal(result.after.rows.reduce((n,r)=>n+r.requests.length,0),510);
});

test('all six ordered questions survive generated and sentence-split replies once, with body first and existing roots/strength intact',async()=>{
 const require=createRequire(new URL('../../app/package.json',import.meta.url));
 const {createServer}=await import(pathToFileURL(require.resolve('vite')).href);
 const server=await createServer({root:root+'app',server:{middlewareMode:true},appType:'custom',logLevel:'error'});
 const fetch=globalThis.fetch;let count=0;
 try{
  const client=await server.ssrLoadModule('/src/data/dosaClient.ts'),topics=await server.ssrLoadModule('/src/data/dosaTopics.ts');
  for(const date of pairs.flat()){
   const chart=actual(date),report=buildReport(chart,chartToKeys(chart),{index:{},aliases:{},bodies:{}});
   const r=report.sections.find(s=>s.id==='context-reading').context,qs=r.experienceQuestions;
   const body='실제 경험을 더 확인할 본문이에요.';
   for(const topic of ['직업','성격'])for(const text of [body,qs.map(q=>q.prompt).join(' ')+' '+body,qs.map(q=>q.prompt).join(' ').split(/(?<=[.?!…])\s+/).join('\n\n')+'\n\n'+body]){
    let sent;globalThis.fetch=async(_,options)=>{sent=JSON.parse(options.body);return Response.json({text});};
    const answer=await client.requestDosaText({topic,report,lines:topics.topicLines(report,topic),chefId:'noona',model:'sonnet',...(topic==='성격'?{question:'내 월지와 시간은 어떻게 함께 읽어?'}:{})});
    assert.ok(answer);assert.ok(sent.chartSummary.includes(r.blocks[2].lines[0]));assert.ok(sent.chartSummary.includes(qs[0].prompt));
    assert.equal(answer.split(CONTEXT_READING_NOTICE).length-1,1);assert.equal(answer.split(r.strength.roots.facts).length-1,1);
    if(topic==='직업')for(const q of qs){assert.equal(answer.split(q.prompt).length-1,1);assert.ok(answer.indexOf(body)<answer.indexOf(q.prompt));}
    count++;
   }
   globalThis.fetch=async()=>Response.json({text:qs[0].prompt});
   assert.equal(await client.requestDosaText({topic:'직업',report,lines:topics.topicLines(report,'직업'),chefId:'noona',model:'sonnet'}),null);
  }
 }finally{globalThis.fetch=fetch;await server.close();}
 assert.equal(count,36);
});

test('unknown/malformed input is withheld and callers cannot mutate later explanations',()=>{
 const c=actual(pairs[0][0]);
 for(const value of [null,{}, {...c,birthTime:{status:'unknown'}},{...c,input:{...c.input,hourUnknown:true}},{...c,input:{...c.input,hour:null}},{...c,pillarsIdx:{...c.pillarsIdx,hour:null}}])assert.equal(buildContextReading(value),null);
 const old=buildContextReading(c),r=buildContextReading(c);r.experienceQuestions[0].prompt='mutated';r.blocks[2].lines[0]='mutated';
 assert.deepEqual(buildContextReading(c),old);
});

test('new receipt preserves every PR220 row hash while validating the current code and output',()=>{
 const summary=summarizeOrderedRoles(result),previous=JSON.parse(readFileSync(new URL('data/hidden_root_context_delivery.json',import.meta.url)));
 assert.deepEqual(summary,JSON.parse(readFileSync(new URL('data/ordered_roles_delivery.json',import.meta.url))));
 assert.deepEqual(summary.rows.map(r=>r.before_sha256),previous.rows.map(r=>r.after_sha256));
 assert.ok(summary.rows.every(r=>r.calculations_unchanged));
});
