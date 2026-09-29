import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFeedbackAnswer,feedbackPlan,resolveWorkFeedback} from '../../dosa-app/engine/src/workFeedback.js';
import {WORK_QUESTIONS} from '../../dosa-app/engine/src/workCandidates.js';
import {buildContextReading} from '../../dosa-app/engine/src/contextReading.js';
import {computeChart} from '../../dosa-app/engine/src/manseryeok.js';
import {buildReport} from '../../dosa-app/engine/src/report.js';
import {chartToKeys} from '../../dosa-app/engine/src/keyset.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const {terms}=JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
const cases=JSON.parse(readFileSync(new URL('data/work_feedback_cases.json',import.meta.url)));
const chart=hour=>computeChart({year:1980,month:2,day:11,hour,minute:0,gender:'F',solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
const mock=pillarsIdx=>({input:{hour:12,minute:0},pillarsIdx});
const DEMAND='work-candidate-resource-demand';
// The chat splits a reply into bubbles of at most two sentences per paragraph.
const bubbles=text=>text.split(/\n{2,}/).flatMap(p=>{const s=p.trim().split(/(?<=[.?!…])\s+/).filter(Boolean),o=[];for(let i=0;i<s.length;i+=2)o.push(s.slice(i,i+2).join(' '));return o;});
function session(c){
 const reading=buildContextReading(c),decision=reading.decision,footer=reading.blocks.at(-1).lines.at(-1);
 const messages=[{role:'assistant',text:decision.question.prompt},...bubbles(footer).map(text=>({role:'assistant',text}))];
 return{decision,footer,messages,say(answer){const step=resolveWorkFeedback({decision,footer,messages,answer});if(step)messages.push({role:'user',text:answer},...bubbles(step.text).map(text=>({role:'assistant',text})));return step;}};
}

test('pre-written and probe answers are read into the expected kinds without merging mixed parts',()=>{
 const p=cases.probe_after_first_pass;let n=0;
 for(const[kind,means,rows]of[['help','self',cases.help],['demand',null,cases.demand],['help','self',p.help_self],['help','others',p.help_others],['duty',null,p.duty],['demand',null,p.demand]])
  for(const[answer,expected,parts]of rows){n++;
   const read=readFeedbackAnswer(answer,kind,means);assert.equal(read?.kind??null,expected,`${kind}: ${answer}`);
   if(parts)assert.deepEqual(read.segments.filter(s=>['support','contradict'].includes(s.tag)).map(s=>s.tag),parts,answer);
  }
 assert.equal(n,73);
 for(const bad of[null,1,'','   ','x'.repeat(241)])assert.equal(readFeedbackAnswer(bad,'help','self'),null);
 assert.equal(readFeedbackAnswer('맞아요','nonsense'),null);
});

test('the same opposite answer revises differently by natal condition and keeps the prior reading',()=>{
 const food=session(chart(4)),demand=session(chart(6)),peer=session(chart(2));
 const before=structuredClone(food.decision);
 const a=food.say('반대예요.'),b=demand.say('반대예요.'),c=peer.say('반대예요.');
 assert.deepEqual(food.decision,before);
 assert.equal(a.targetCandidateId,'food-response');assert.equal(b.targetCandidateId,'resource-demand');assert.equal(c.targetCandidateId,'peer-response');
 assert.equal(a.after,'weakened');assert.equal(a.statuses['food-response'],'weakened');assert.equal(a.nextQuestion.id,DEMAND);assert.equal(a.nextQuestion.prompt,WORK_QUESTIONS['resource-demand']);
 assert.equal(b.nextQuestion,null);assert.equal(b.statuses['resource-demand'],'weakened');assert.equal(c.nextQuestion.id,DEMAND);
 assert.notEqual(a.revisedInterpretation,b.revisedInterpretation);assert.notEqual(a.revisedInterpretation,c.revisedInterpretation);
 assert.deepEqual(a.beforeFeedback,{mode:'food-response',selectedIds:['food-response'],interpretation:before.interpretation});
 assert.equal(a.before.statuses['resource-demand'],'weakened');
 for(const step of[a,b,c]){assert.equal(step.probability,null);assert.equal(step.trainingEligible,false);assert.equal(step.action,'revise');}
 const duty=session(mock({year:57,month:14,day:50,hour:0})).say('반대예요');assert.equal(duty.targetCandidateId,'resource-duty');assert.equal(duty.nextQuestion,null);assert.match(duty.revisedInterpretation,/따로 움직였을 가능성/);
 // Choice questions and branch-only scope are not revised by this path.
 assert.equal(feedbackPlan(buildContextReading(chart(14)).decision),null);
 assert.equal(feedbackPlan(buildContextReading(mock({year:8,month:14,day:50,hour:2})).decision),null);
 assert.equal(feedbackPlan(buildContextReading(mock({year:0,month:14,day:50,hour:2})).decision),null);
});

test('clarify once, then revise and ask only a question that was not answered yet',()=>{
 const s=session(chart(4));
 const first=s.say('아니요');assert.equal(first.action,'clarify');assert.equal(first.after,'pending');assert.equal(first.nextQuestion,null);assert.match(first.text,/경험이 없어요/);assert.match(first.text,/반대예요/);
 const second=s.say('경험이 없어요');assert.equal(second.answer.kind,'no-experience');assert.equal(second.after,'withheld');assert.equal(second.nextQuestion.id,DEMAND);
 const third=s.say('네, 일이 많이 늘었어요');assert.equal(third.questionId,DEMAND);assert.equal(third.answer.kind,'supported');assert.equal(third.nextQuestion,null);
 assert.equal(third.statuses['resource-demand'],'retained-as-self-report');assert.equal(third.statuses['food-response'],'withheld');
 assert.equal(s.say('맞아요'),null); // finished: normal chat
 const all=s.messages.filter(m=>m.role==='assistant').map(m=>m.text).join(' ');
 assert.equal(all.split(s.decision.question.prompt).length-1,1);assert.equal(all.split(WORK_QUESTIONS['resource-demand']).length-1,1);

 const twice=session(chart(4));twice.say('아니요');const unresolved=twice.say('아니요');
 assert.equal(unresolved.action,'unresolved');assert.equal(unresolved.after,'unconfirmed');assert.equal(unresolved.nextQuestion,null);assert.equal(twice.say('반대예요'),null);

 const partial=session(chart(4));assert.equal(partial.say('반대인 때도 있고 아닌 때도 있어요.').answer.kind,'clarify:partial');
 const mixed=partial.say('처음엔 도움이 됐는데 일이 커지니까 오히려 부담이 늘었어요');
 assert.equal(mixed.answer.kind,'mixed');assert.equal(mixed.after,'scoped');assert.equal(mixed.nextQuestion,null);
 assert.deepEqual(mixed.answer.segments.map(x=>x.tag),['support','contradict']);assert.match(mixed.text,/처음엔 도움이 됐는데/);assert.match(mixed.text,/일이 커지니까/);
});

test('task increase said inside a help answer is not asked again',()=>{
 const up=session(chart(4));const told=up.say('일이 많이 늘었어요');assert.equal(told.answer.kind,'clarify:help-unanswered');
 const after=up.say('반대예요');assert.equal(after.nextQuestion,null);assert.equal(after.statuses['resource-demand'],'retained-as-self-report');assert.doesNotMatch(after.text,/요구·과제도 함께 늘린 경험이 있나요/);
 const both=session(chart(4)).say('도움이 안 됐어요, 일만 늘었어요');assert.equal(both.answer.kind,'contradicted');assert.equal(both.answer.demandEvidence,'up');assert.equal(both.nextQuestion,null);
 const down=session(chart(4)).say('일이 늘어난 적이 없어요');assert.equal(down.answer.kind,'no-experience');assert.equal(down.nextQuestion,null);assert.equal(down.statuses['resource-demand'],'weakened');
 const direct=session(chart(4)).say('처음에는 도움이 됐는데 일이 커지면서 오히려 부담이 늘었어');assert.equal(direct.answer.kind,'mixed');assert.equal(direct.nextQuestion,null);
 const other=session(chart(4)).say('팀원이랑 나눠서 해결했어요');assert.equal(other.answer.kind,'clarify:other-means');assert.match(other.text,/직접 만들거나 실행하는 방식/);
});

test('only the latest shown owned question and fully shown local replies are replayed',()=>{
 const base=session(chart(4)),{decision,footer}=base,q=decision.question.prompt;
 const resolve=(messages,answer='반대예요')=>resolveWorkFeedback({decision,footer,messages,answer});
 assert.ok(resolve(base.messages));
 assert.equal(resolve([]),null);assert.equal(resolve([{role:'assistant',text:'다른 질문인가요?'}]),null);
 assert.equal(resolve([...base.messages,{role:'assistant',text:'또 궁금한 것이 있는가?'}],'네'),null);
 assert.equal(resolve([...base.messages,{role:'assistant',text:'또 궁금한 것이 있는가?'}],'처음엔 도움이 됐는데 나중엔 오히려 부담이 늘었어요'),null);
 assert.equal(resolve([{role:'assistant',text:q},{role:'assistant',text:'공급자가 덧붙인 문장이에요.'}]),null);
 // A cue-less message went to chat and the provider answered: the chain is broken.
 assert.equal(resolve([...base.messages,{role:'user',text:'그게 무슨 뜻이에요?'},{role:'assistant',text:'공급자 답변이에요.'}]),null);
 const s=session(chart(4));const step=s.say('반대예요');
 const shown=bubbles(step.text);assert.ok(shown.length>1);
 const partly=s.messages.slice(0,s.messages.length-1);
 assert.equal(resolveWorkFeedback({decision,footer,messages:partly,answer:'네'}),null); // follow-up question not shown yet
 assert.equal(resolveWorkFeedback({decision,footer,messages:s.messages,answer:'네'}).questionId,DEMAND);
 const edited=s.messages.map((m,i)=>i===s.messages.length-2?{...m,text:m.text+' 추가'}:m);
 assert.equal(resolveWorkFeedback({decision,footer,messages:edited,answer:'네'}),null);
 assert.equal(resolveWorkFeedback({decision:null,footer,messages:base.messages,answer:'반대예요'}),null);
 assert.equal(resolve(base.messages,'도움은 됐어요. 그런데 올해 운은 어때요?'),null);
});

async function withConsumers(run){
 const require=createRequire(new URL('../../app/package.json',import.meta.url));const{createServer}=await import(pathToFileURL(require.resolve('vite')).href);
 const server=await createServer({root:root+'app',server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'}),original=globalThis.fetch;
 try{await run(await server.ssrLoadModule('/src/data/dosaClient.ts'),await server.ssrLoadModule('/src/data/dosaTopics.ts'));}finally{globalThis.fetch=original;await server.close();}
}
test('the chat client answers the chain locally and leaves other scopes to the provider',async()=>withConsumers(async(client,topics)=>{
 const c=chart(4),report=buildReport(c,chartToKeys(c),{aliases:{},index:{},bodies:{}});
 const context=report.sections.find(s=>s.id==='context-reading').context,d=context.decision,footer=context.blocks.at(-1).lines.at(-1);
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({text:'공급자 답변이에요.'});};
 const messages=[{role:'assistant',text:d.question.prompt},...bubbles(footer).map(text=>({role:'assistant',text}))];
 const ask=(question,topic='직업',extra={})=>client.requestDosaText({topic:'성격',report,lines:topics.topicLines(report,'성격'),chefId:'noona',model:'sonnet',question,conversation:{version:1,topic,messages:[...messages]},...extra});
 const clarify=await ask('아니요');assert.match(clarify,/두 가지로 읽혀요/);assert.equal(calls,0);
 messages.push({role:'user',text:'아니요'},...bubbles(clarify).map(text=>({role:'assistant',text})));
 const revised=await ask('해 본 적이 없어요');assert.match(revised,/개인에게 적용하는 판단은 보류/);assert.ok(revised.endsWith(WORK_QUESTIONS['resource-demand']));assert.equal(calls,0);
 messages.push({role:'user',text:'해 본 적이 없어요'},...bubbles(revised).map(text=>({role:'assistant',text})));
 assert.match(await ask('과제가 늘지 않았어요'),/이 천간 비교로는 말해 준 경험을 설명하지 못해요/);assert.equal(calls,0);
 assert.ok((await ask('과제가 늘지 않았어요','관계')).endsWith('공급자 답변이에요.'));assert.equal(calls,1); // other topic: provider
 const unknown=await ask('과제가 늘지 않았어요','직업',{hourUnknown:true});assert.doesNotMatch(unknown,/공급자 답변|천간 비교/);assert.equal(calls,1);
}));
