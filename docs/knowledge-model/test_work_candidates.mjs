import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {evaluateCondition,compareWorkCandidates,reviseWorkDecision} from '../../dosa-app/engine/src/workCandidates.js';
import {buildContextReading} from '../../dosa-app/engine/src/contextReading.js';
import {computeChart} from '../../dosa-app/engine/src/manseryeok.js';
import {buildReport} from '../../dosa-app/engine/src/report.js';
import {chartToKeys} from '../../dosa-app/engine/src/keyset.js';
import {detectRelations} from '../../dosa-app/engine/src/relations.js';
import {capture} from './measure_hyeonchim_consumers.mjs';
import {hyeongScopeBaseline} from './frozen_hyeong_scope.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const {terms}=JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
const chart=hour=>computeChart({year:1980,month:2,day:11,hour,minute:0,gender:'F',solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
const mock=pillarsIdx=>({input:{hour:12,minute:0},pillarsIdx});
const reportOf=c=>buildReport(c,chartToKeys(c),{aliases:{},index:{},bodies:{}});
const decision=c=>buildContextReading(c)?.decision;
const oldSource=readFileSync(new URL('fixtures/hyeong-scope-v1/contextReading.js',import.meta.url),'utf8')
 .replaceAll("'./tables.js'",JSON.stringify(pathToFileURL(root+'dosa-app/engine/src/tables.js').href))
 .replaceAll("'./judge.js'",JSON.stringify(pathToFileURL(root+'dosa-app/engine/src/judge.js').href))
 .replaceAll("'./relations.js'",JSON.stringify(pathToFileURL(root+'dosa-app/engine/src/relations.js').href));
const {buildContextReading:oldReading}=await import('data:text/javascript;base64,'+Buffer.from(oldSource).toString('base64'));

test('three-valued all/any/not agrees with independent truth tables and Python contract',()=>{
 const vectors=[];for(const a of[0,1,null])for(const b of[0,1,null]){
  const features={a,b},expressions=[{all:[{feature:'a'},{feature:'b'}]},{any:[{feature:'a'},{feature:'b'}]},{not:{feature:'a'}}];
  const expected=[a===0||b===0?0:a===null||b===null?null:1,a===1||b===1?1:a===null||b===null?null:0,a===null?null:1-a];
  expressions.forEach((expression,i)=>{assert.equal(evaluateCondition(expression,features).value,expected[i]);vectors.push({expression,features});});
 }
 const py=execFileSync('python3',['-c',"import sys,json;sys.path.insert(0,'docs/knowledge-model');from context_query import evaluate_expression;print(json.dumps([evaluate_expression(x['expression'],x['features'])['value'] for x in json.load(sys.stdin)]))"],{cwd:root,input:JSON.stringify(vectors),encoding:'utf8'});
 assert.deepEqual(JSON.parse(py),vectors.map(x=>evaluateCondition(x.expression,x.features).value));
 assert.equal(evaluateCondition({not:{feature:'missing'}},{}).value,null);
 for(const bad of[true,0.5,'1',undefined])assert.throws(()=>evaluateCondition({feature:'a'},{a:bad}));
 for(const bad of[{all:[]},{wat:[]},{feature:''},{all:[],any:[]}])assert.throws(()=>evaluateCondition(bad,{}));
});

test('same adult Jia-Yin day: food versus hurting-officer changes the competing interpretation',()=>{
 const a=chart(4),b=chart(6),ra=buildContextReading(a),rb=buildContextReading(b);
 assert.equal(a.pillarsIdx.day,50);assert.equal(b.pillarsIdx.day,50);
 assert.deepEqual([a.pillarsIdx.year,a.pillarsIdx.month,a.pillarsIdx.hour],[56,14,2]);
 assert.deepEqual([b.pillarsIdx.year,b.pillarsIdx.month,b.pillarsIdx.hour],[56,14,3]);
 const broad=r=>r.blocks[2].lines.find(l=>l.startsWith('식상과 재성이'));
 assert.equal(broad(oldReading(a)),broad(oldReading(b)));assert.ok(broad(oldReading(a)));
 assert.equal(ra.decision.mode,'food-response');assert.equal(rb.decision.mode,'resource-demand');
 assert.equal(ra.decision.candidates.find(c=>c.id==='resource-demand').status,'weakened');
 assert.equal(rb.decision.candidates.find(c=>c.id==='food-response').status,'inapplicable');
 assert.notEqual(ra.blocks[2].lines[0],rb.blocks[2].lines[0]);assert.notEqual(ra.experienceQuestions[0].prompt,rb.experienceQuestions[0].prompt);
 assert.match(ra.decision.reason,/식신/);assert.match(rb.decision.alternative,/실제 해결 능력이 없다는 뜻이 아니/);
 assert.equal(ra.experienceQuestions.length,1);assert.equal(rb.experienceQuestions.length,1);
});

test('peer combination, orthodox officer, competing claims, branch-only scope and true absence stay distinct',()=>{
 assert.equal(decision(chart(2)).mode,'peer-response');
 assert.equal(decision(chart(14)).mode,'competing');assert.deepEqual(decision(chart(14)).selectedIds,['resource-duty','resource-demand']);
 assert.equal(decision(mock({year:57,month:14,day:50,hour:0})).mode,'resource-duty');
 const hidden=decision(mock({year:8,month:14,day:50,hour:2}));assert.equal(hidden.mode,'scope-withheld');assert.deepEqual(hidden.selectedIds,[]);
 const absent=decision(mock({year:0,month:14,day:50,hour:2}));assert.equal(absent.mode,'outside-bundle');assert.equal(absent.active,false);
 // PR227 returned null outside 甲; PR230 compares the same ten-god relations for every day master (test_stem_candidates.mjs).
 const yi=decision(mock({year:56,month:14,day:51,hour:2}));assert.equal(yi.mode,'resource-duty');assert.equal(yi.policy,'stem-resource-authority-v1');assert.equal(yi.features.stemScope,1);
 // Hidden food is present in this actual Yin month, but does not meet the stem-only countercondition.
 assert.equal(decision(chart(0)).mode,'resource-demand');assert.equal(decision(chart(0)).features.foodStem,0);
});

test('missing countercondition withholds the one-sided candidate; duplicate/unrelated observations add no strength',()=>{
 const f={jiaDay:1,wealthStem:1,killingStem:1,officerStem:0,foodStem:null,peerKillingCombination:0};
 assert.equal(compareWorkCandidates(f).find(c=>c.id==='resource-demand').status,'withheld');
 assert.equal(compareWorkCandidates({...f,foodStem:0}).find(c=>c.id==='resource-demand').status,'selected');
 assert.equal(compareWorkCandidates({...f,foodStem:1}).find(c=>c.id==='resource-demand').status,'weakened');
 const a=decision(chart(0)),b=decision(chart(20));assert.deepEqual(a,b); // same stem, different hour branch
 const repeat=decision(mock({year:56,month:14,day:50,hour:56}));assert.deepEqual(repeat.selectedIds,['resource-demand']);
 for(const x of[a,b,repeat]){assert.equal(x.probability,null);assert.equal(x.trainingEligible,false);}
});

test('support, opposite experience, no experience and unanswered revise without rewriting the prior reading',()=>{
 for(const hour of[0,2,4]){
  const d=decision(chart(hour)),before=structuredClone(d);
  for(const[answer,status,after]of[['맞아요.','supported','retained-as-self-report'],['반대예요.','contradicted','weakened'],['경험이 없어요.','no-experience','withheld'],['말하고 싶지 않아요.','unanswered','withheld']]){
   const r=reviseWorkDecision(d,answer);assert.equal(r.status,status);assert.equal(r.after,after);assert.deepEqual(r.before.selectedIds,d.selectedIds);assert.equal(r.probability,null);assert.equal(r.trainingEligible,false);
  }
  assert.deepEqual(d,before);for(const ambiguous of['아니요','대체로 맞지만 반대인 적도 있어요','모르겠어요','아니요. 하지만 또 맞아요'])assert.equal(reviseWorkDecision(d,ambiguous),null);
 }
 assert.equal(reviseWorkDecision(decision(chart(14)),'맞아요'),null);
});

test('current observations retain all historical hyeong/roots/strength facts and unknown-time withholding',()=>{
 for(let h=0;h<24;h+=2){const c=chart(h),r=buildContextReading(c),old=oldReading(c);
  for(const key of['groups','conditions','monthMain','hourStem','strength','monthDayChung','monthDayYukhap','monthDayCompound','monthDayHyeong'])assert.deepEqual(r[key],old[key]);
  assert.deepEqual(detectRelations(c.pillarsIdx),detectRelations(structuredClone(c.pillarsIdx)));
 }
 for(const c of[null,{}, {...chart(4),birthTime:{status:'unknown'}},{...chart(4),input:{...chart(4).input,hourUnknown:true}},{...chart(4),input:{...chart(4).input,hour:null}}])assert.equal(buildContextReading(c),null);
 const a=decision(chart(4));a.selectedIds.push('corrupt');a.candidates[0].condition.value=9;assert.deepEqual(decision(chart(4)).selectedIds,['food-response']);
});

async function withConsumers(run){
 const require=createRequire(new URL('../../app/package.json',import.meta.url));const{createServer}=await import(pathToFileURL(require.resolve('vite')).href);
 const server=await createServer({root:root+'app',server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'}),original=globalThis.fetch;
 try{await run(await server.ssrLoadModule('/src/data/dosaClient.ts'),await server.ssrLoadModule('/src/data/dosaTopics.ts'));}finally{globalThis.fetch=original;await server.close();}
}
test('report, work grounds, summaries and generated answers retain the selected reasoning and one question',async()=>withConsumers(async(client,topics)=>{
 for(const hour of[0,2,4,6,14]){
  const report=reportOf(chart(hour)),context=report.sections.find(s=>s.id==='context-reading').context,d=context.decision,lines=topics.topicLines(report,'직업');
  for(const line of d.lines){assert.ok(lines.some(l=>l.text===line));assert.ok(topics.chartSummaryOf(report).includes(line));}
  for(const text of['사용자가 맡은 상황을 더 살펴봐요.',[...d.lines,d.question.prompt,'그 경험은 아직 확인되지 않았어요.'].join(' ').split(/(?<=[.?!…])\s+/).join('\n\n')]){
   let sent;globalThis.fetch=async(_,opts)=>{sent=JSON.parse(opts.body);return Response.json({text});};
   const answer=await client.requestDosaText({topic:'직업',report,lines,chefId:'noona',model:'sonnet'});
   for(const line of d.lines)assert.equal(answer.split(line).length-1,1);
   assert.equal(answer.split(d.question.prompt).length-1,1);assert.ok(sent.chartSummary.includes(d.reason));
  }
 }
}));

// PR227 sent '아니요'/partial answers to the provider; workFeedback.js now asks one local clarifying question (test_work_feedback.mjs).
test('only the latest owned question consumes feedback locally; unrelated scope uses provider',async()=>withConsumers(async(client,topics)=>{
 const report=reportOf(chart(4)),d=report.sections.find(s=>s.id==='context-reading').context.decision;let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({text:'질문의 의미를 확인해요.'});};
 const options={topic:'성격',report,lines:topics.topicLines(report,'성격'),chefId:'noona',model:'sonnet',question:'반대예요.',conversation:{version:1,topic:'직업',messages:[{role:'assistant',text:d.question.prompt}]}};
 assert.match(await client.requestDosaText(options),/반대 경험을 반영/);assert.equal(calls,0);
 const footer=report.sections.find(s=>s.id==='context-reading').context.blocks.at(-1).lines.at(-1);
 assert.match(await client.requestDosaText({...options,conversation:{...options.conversation,messages:[...options.conversation.messages,...footer.split(/(?<=[.?!…])\s+/).map(text=>({role:'assistant',text}))]}}),/반대 경험을 반영/);
 assert.equal(calls,0);
 for(const answer of['맞아요.','경험이 없어요.','말하고 싶지 않아요.'])assert.ok(await client.requestDosaText({...options,question:answer}));assert.equal(calls,0);
 await client.requestDosaText({...options,conversation:{version:1,messages:[{role:'assistant',text:'다른 질문인가요?'}]}});assert.equal(calls,1);
 assert.match(await client.requestDosaText({...options,question:'반대인 때도 있고 아닌 때도 있어요.'}),/때에 따라 달랐다는 뜻/);assert.equal(calls,1);
 assert.match(await client.requestDosaText({...options,question:'아니요'}),/두 가지로 읽혀요/);assert.equal(calls,1);
 await client.requestDosaText({...options,question:'그게 무슨 뜻이에요?'});assert.equal(calls,2);
 await client.requestDosaText({...options,hourUnknown:true});assert.equal(calls,2);
}));

test('KB110 comparison keeps calculations/brain/fortune and all unknown8 exactly unchanged',async()=>{
 const frozen=hyeongScopeBaseline();let before;try{
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  execFileSync(process.execPath,['docs/knowledge-model/measure_hyeonchim_consumers.mjs','--capture','capture.json'],{cwd:frozen.directory,env,stdio:'pipe',timeout:120000});
  before=JSON.parse(readFileSync(frozen.directory+'/capture.json'));
 }finally{frozen.cleanup();}const after=await capture();
 assert.deepEqual(after.assets,before.assets);assert.deepEqual(after.lookup,before.lookup);let unknown=0,changed=0;
 for(const[rowIndex,row]of after.rows.entries()){
  const old=before.rows[rowIndex];if(row.profile.hourUnknown){unknown++;assert.deepEqual(row,old);assert.equal(row.requests.length,0);continue;}
  for(const key of['chart','raw','keys','brain','direct','fortune'])assert.deepEqual(row[key],old[key]);
  const r=row.report.sections.find(s=>s.id==='context-reading').context;
  const prior=old.report.sections.find(s=>s.id==='context-reading').context;
  assert.equal(prior.policy,'natal-work-context-v9');assert.equal(r.policy,'natal-work-context-v11');assert.ok(!Object.hasOwn(prior,'decision'));
  for(const key of['groups','conditions','strength','monthDayChung','monthDayYukhap','monthDayCompound','monthDayHyeong'])assert.deepEqual(r[key],prior[key]);
  if(r.decision?.active)changed++;else assert.deepEqual(r.blocks,prior.blocks);
  assert.deepEqual(row.reading.cards.find(c=>c.id==='context-reading').blocks,r.blocks);
 }assert.equal(unknown,8);assert.ok(changed>0);assert.equal(after.rows.length,110);
});
