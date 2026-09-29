import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFeedbackAnswer,feedbackPlan,resolveWorkFeedback,ownedFeedbackPrompts} from '../../dosa-app/engine/src/workFeedback.js';
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
const DEMAND='work-candidate-resource-demand',MENU='또 궁금한 것이 있는가?';
// The chat splits a reply into bubbles of at most two sentences per paragraph.
const bubbles=text=>text.split(/\n{2,}/).flatMap(p=>{const s=p.trim().split(/(?<=[.?!…])\s+/).filter(Boolean),o=[];for(let i=0;i<s.length;i+=2)o.push(s.slice(i,i+2).join(' '));return o;});
function session(c){
 const reading=buildContextReading(c),decision=reading.decision,footer=reading.blocks.at(-1).lines.at(-1);
 const messages=[{role:'assistant',text:decision.question.prompt},...bubbles(footer).map(text=>({role:'assistant',text}))];
 return{decision,footer,messages,say(answer){const step=resolveWorkFeedback({decision,footer,messages,answer,menuPrompts:[MENU]});if(step)messages.push({role:'user',text:answer},...bubbles(step.text).map(text=>({role:'assistant',text})));return step;}};
}
const definite=k=>k!==null&&!String(k).startsWith('clarify:');

test('written, probe and reviewer answers: expected readings, and never a confident reading outside the accepted set',()=>{
 const p=cases.probe_after_first_pass;let n=0;
 for(const[kind,means,rows]of[['help','self',cases.help],['demand',null,cases.demand],['help','self',p.help_self],['help','others',p.help_others],['duty',null,p.duty],['demand',null,p.demand]])
  for(const[answer,expected,parts]of rows){n++;
   const read=readFeedbackAnswer(answer,kind,means);assert.equal(read?.kind??null,expected,`${kind}: ${answer}`);
   if(parts)assert.deepEqual(read.segments.filter(s=>['support','contradict'].includes(s.tag)).map(s=>s.tag),parts,answer);
  }
 assert.equal(n,73);
 const r=cases.review_adversarial;let m=0,exact=0;
 for(const[kind,means,rows]of[['help','self',r.help_self],['help','others',r.help_others],['help','self',r.help_self_means],['duty',null,r.duty],['demand',null,r.demand]])
  for(const[answer,accepted]of rows){m++;const k=readFeedbackAnswer(answer,kind,means)?.kind??null;
   if(accepted.includes(k))exact++;else assert.ok(!definite(k),`${kind}: ${answer} → ${k} (accepted ${accepted.join('/')})`);}
 assert.equal(m,233);assert.ok(exact>=120,`reviewer set exact ${exact}`);
 // Blind set (not tuned on at PR228): a confident misreading is a failure; clarify/chat are safe.
 const b=cases.blind_holdout,label=k=>k===null?'chat':k.startsWith('clarify:')?'clarify':k,count={correct:0,clarify:0,chat:0};
 for(const[q,kind,means]of[['Q_SELF','help','self'],['Q_OTHERS','help','others'],['Q_DUTY','duty',null],['Q_DEMAND','demand',null]])
  for(const[answer,accepted]of b[q]){const k=label(readFeedbackAnswer(answer,kind,means)?.kind??null);
   if(accepted.includes(k))count.correct++;else{assert.ok(['clarify','chat'].includes(k),`${q}: ${answer} → ${k}`);count[k]++;}}
 assert.deepEqual(count,{correct:b.score_at_pr228.correct,clarify:b.score_at_pr228.clarify,chat:b.score_at_pr228.chat});
 for(const bad of[null,1,'','   ','도움이 됐어요 '.repeat(40)])assert.equal(readFeedbackAnswer(bad,'help','self'),null);
 assert.equal(readFeedbackAnswer('맞아요','nonsense'),null);
 // Punctuation and spacing variants of the same content stay on the same side.
 for(const a of['아니요 도움이 안 됐어요','아니요, 도움이 안 됐어요','아니 별로 도움 안 됐어'])assert.equal(readFeedbackAnswer(a,'help','self').kind,'contradicted',a);
 for(const a of['네 경험 없어요','네, 경험 없어요'])assert.equal(readFeedbackAnswer(a,'help','self').kind,'no-experience',a);
 for(const a of['아니요, 도움이 됐어요','맞아요 도움 안 됐어요','네, 오히려 더 힘들어졌어요'])assert.equal(readFeedbackAnswer(a,'help','self').kind,'clarify:unclear',a);
});

test('the same opposite answer revises differently by natal condition and keeps the prior reading',()=>{
 const food=session(chart(4)),demand=session(chart(6)),peer=session(chart(2));
 const before=structuredClone(food.decision);
 const a=food.say('반대예요.'),b=demand.say('반대예요.'),c=peer.say('반대예요.');
 assert.deepEqual(food.decision,before);
 assert.equal(a.targetCandidateId,'food-response');assert.equal(b.targetCandidateId,'resource-demand');assert.equal(c.targetCandidateId,'peer-response');
 assert.equal(a.after,'weakened');assert.deepEqual(a.feedback,{'food-response':'weakened'});assert.equal(a.nextQuestion.id,DEMAND);assert.equal(a.nextQuestion.prompt,WORK_QUESTIONS['resource-demand']);
 assert.equal(b.nextQuestion,null);assert.deepEqual(b.feedback,{'resource-demand':'weakened'});assert.equal(c.nextQuestion.id,DEMAND);
 assert.notEqual(a.revisedInterpretation,b.revisedInterpretation);assert.notEqual(a.revisedInterpretation,c.revisedInterpretation);
 assert.match(a.revisedInterpretation,/가설만 남겨요/);assert.match(b.revisedInterpretation,/설명하지 못해요/);
 assert.equal(a.beforeFeedback.interpretation,before.interpretation);assert.deepEqual(a.beforeFeedback.selectedIds,['food-response']);
 assert.equal(a.beforeFeedback.candidates.find(x=>x.id==='resource-demand').status,'weakened'); // natal counter, not feedback
 for(const step of[a,b,c]){assert.equal(step.probability,null);assert.equal(step.trainingEligible,false);assert.equal(step.action,'revise');}
 const duty=session(mock({year:57,month:14,day:50,hour:0})).say('반대예요');assert.equal(duty.targetCandidateId,'resource-duty');assert.equal(duty.nextQuestion,null);assert.match(duty.revisedInterpretation,/따로 움직였거나 오히려 부딪혔을/);
 // Choice questions and branch-only scope are not revised by this path.
 for(const c2 of[chart(14),mock({year:8,month:14,day:50,hour:2}),mock({year:0,month:14,day:50,hour:2})])assert.equal(feedbackPlan(buildContextReading(c2).decision),null);
 // The peer plan carries its own means: an own-execution answer is not its answer.
 assert.equal(peer.decision.mode,'peer-response');assert.equal(session(chart(2)).say('직접 해 보니 도움이 됐어요').answer.kind,'clarify:other-means');
 assert.equal(session(chart(4)).say('팀원이랑 나눠서 해결했어요').answer.kind,'clarify:other-means');
});

test('chains: one clarification, only offered options, no repeated question, all-weakened ending',()=>{
 const s=session(chart(4));
 const first=s.say('아니요');assert.equal(first.action,'clarify');assert.equal(first.after,'pending');assert.match(first.text,/경험이 없어요/);assert.match(first.text,/반대예요/);
 const second=s.say('경험이 없어요');assert.equal(second.answer.kind,'no-experience');assert.equal(second.after,'withheld');assert.equal(second.nextQuestion.id,DEMAND);
 const third=s.say('네, 일이 많이 늘었어요');assert.equal(third.questionId,DEMAND);assert.equal(third.answer.kind,'supported');assert.equal(third.nextQuestion,null);
 assert.deepEqual(third.feedback,{'food-response':'withheld','resource-demand':'retained-as-self-report'});
 assert.equal(third.before.reading,s.decision.interpretation);assert.match(third.revisedInterpretation,/보류한 상태 그대로/);
 assert.equal(s.say('맞아요'),null); // finished: normal chat
 const all=s.messages.filter(m=>m.role==='assistant').map(m=>m.text).join(' ');
 assert.equal(all.split(s.decision.question.prompt).length-1,1);assert.equal(all.split(WORK_QUESTIONS['resource-demand']).length-1,1);

 const both=session(chart(4));both.say('반대예요');const end=both.say('반대예요');
 assert.equal(end.questionId,DEMAND);assert.match(end.revisedInterpretation,/모두 낮아져/);assert.deepEqual(end.feedback,{'food-response':'weakened','resource-demand':'weakened'});
 assert.match(end.before.reading,/가설만 남겨요/); // the reading shown after the first answer

 const twice=session(chart(4));twice.say('아니요');const unresolved=twice.say('아니요');
 assert.equal(unresolved.action,'unresolved');assert.equal(unresolved.after,'unconfirmed');assert.deepEqual(unresolved.feedback,{'food-response':'unconfirmed'});assert.equal(twice.say('반대예요'),null);
 const offered=session(chart(4));offered.say('아니요');assert.equal(offered.say('네').action,'unresolved'); // '네' was not an offered option

 const partial=session(chart(4));assert.equal(partial.say('반대인 때도 있고 아닌 때도 있어요.').answer.kind,'clarify:partial');
 const mixed=partial.say('처음엔 도움이 됐는데 일이 커지니까 오히려 부담이 늘었어요');
 assert.equal(mixed.answer.kind,'mixed');assert.equal(mixed.after,'scoped');assert.equal(mixed.nextQuestion,null);
 assert.deepEqual(mixed.answer.segments.map(x=>x.tag),['support','contradict']);assert.match(mixed.text,/처음엔 도움이 됐는데/);assert.match(mixed.text,/일이 커지니까/);
});

test('task increase heard in a help answer is used once, and conflicting reports are asked, not merged',()=>{
 const up=session(chart(4));assert.equal(up.say('일이 많이 늘었어요').answer.kind,'clarify:help-unanswered');
 const after=up.say('반대예요');assert.equal(after.nextQuestion,null);assert.equal(after.feedback['resource-demand'],'retained-as-self-report');assert.doesNotMatch(after.text,/요구·과제도 함께 늘린 경험이 있나요/);
 const both=session(chart(4)).say('도움이 안 됐어요, 일만 늘었어요');assert.equal(both.answer.kind,'contradicted');assert.equal(both.answer.demandEvidence,'up');assert.equal(both.nextQuestion,null);
 // Task growth after 오히려/더 is the premise, not a failure of the method (PR228 Codex review).
 const rather=session(chart(4)).say('오히려 일이 더 늘었어요');assert.equal(rather.answer.kind,'clarify:help-unanswered');assert.equal(rather.state.evidence,'up');
 const helped=session(chart(4)).say('도움이 됐어요. 오히려 일이 많이 늘었어요');assert.equal(helped.answer.kind,'supported');assert.equal(helped.feedback['resource-demand'],'retained-as-self-report');
 assert.equal(session(chart(4)).say('오히려 부담이 늘었어요').answer.kind,'contradicted');
 // "Tasks never grew" does not decide the resource→task candidate: it is asked.
 const down=session(chart(4)).say('일이 늘어난 적이 없어요');assert.equal(down.answer.kind,'no-experience');assert.equal(down.nextQuestion.id,DEMAND);
 assert.equal(down.feedback['resource-demand'],undefined);assert.match(down.text,/성과·자원을 늘린 적이 없어서인지/);
 // Earlier and later reports disagree: ask the demand question instead of either.
 const flip=session(chart(4));assert.equal(flip.say('일이 늘지는 않았어요').nextQuestion.id,DEMAND);
 const flip2=session(chart(4));flip2.say('일이 많이 늘었어요');const res=flip2.say('일이 늘어난 적이 없어요');
 assert.equal(res.nextQuestion?.id,DEMAND);assert.match(res.text,/서로 달라서/);assert.doesNotMatch(res.text,/받아들여요/);
 const direct=session(chart(4)).say('처음에는 도움이 됐는데 일이 커지면서 오히려 부담이 늘었어');assert.equal(direct.answer.kind,'mixed');assert.equal(direct.nextQuestion,null);
});

test('only the latest shown owned question and fully shown local replies are replayed',()=>{
 const base=session(chart(4)),{decision,footer}=base,q=decision.question.prompt;
 const resolve=(messages,answer='반대예요')=>resolveWorkFeedback({decision,footer,messages,answer,menuPrompts:[MENU]});
 assert.ok(resolve(base.messages));
 assert.equal(resolve([]),null);assert.equal(resolve([{role:'assistant',text:'다른 질문인가요?'}]),null);
 // After the menu line a bare yes/no answers the menu; a content answer still answers the question.
 assert.equal(resolve([...base.messages,{role:'assistant',text:MENU}],'네'),null);
 assert.equal(resolve([...base.messages,{role:'assistant',text:MENU}],'처음엔 도움이 됐는데 나중엔 오히려 부담이 늘었어요').answer.kind,'mixed');
 assert.equal(resolveWorkFeedback({decision,footer,messages:[...base.messages,{role:'assistant',text:MENU}],answer:'반대예요'}),null); // menu not declared
 assert.equal(resolve([{role:'assistant',text:q},{role:'assistant',text:'공급자가 덧붙인 문장이에요.'}]),null);
 assert.equal(resolve([...base.messages,{role:'user',text:'그게 무슨 뜻이에요?'},{role:'assistant',text:'공급자 답변이에요.'}]),null);
 // The latest copy of the question starts the replay (an older chain is not resumed).
 const old=session(chart(4));old.say('반대예요');
 const again=[...old.messages,{role:'assistant',text:q}];assert.equal(resolve(again,'맞아요').questionId,decision.question.id);
 const s=session(chart(4));const step=s.say('반대예요');
 assert.ok(bubbles(step.text).length>1);
 assert.equal(resolve(s.messages.slice(0,-1),'네'),null); // follow-up question not shown yet
 assert.equal(resolve(s.messages,'네').questionId,DEMAND);
 assert.equal(resolve([...s.messages,{role:'assistant',text:MENU}],'네, 일이 많이 늘었어요').questionId,DEMAND);
 const edited=s.messages.map((m,i)=>i===s.messages.length-2?{...m,text:m.text+' 추가'}:m);assert.equal(resolve(edited,'네'),null);
 assert.equal(resolveWorkFeedback({decision:null,footer,messages:base.messages,answer:'반대예요'}),null);
 for(const a of['도움은 됐어요. 그런데 올해 운은 어때요?','도움이 됐어요. 그런데 올해 운은 어때요','맞아요 그럼 이직 시기 알려주세요','네, 알겠어요','남편이랑 사이가 안 좋았어요'])assert.equal(resolve(base.messages,a),null,a);
 assert.deepEqual(ownedFeedbackPrompts(decision),[q,WORK_QUESTIONS['resource-demand']]);
});

async function withConsumers(run){
 const require=createRequire(new URL('../../app/package.json',import.meta.url));const{createServer}=await import(pathToFileURL(require.resolve('vite')).href);
 const server=await createServer({root:root+'app',server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'}),original=globalThis.fetch;
 try{await run(await server.ssrLoadModule('/src/data/dosaClient.ts'),await server.ssrLoadModule('/src/data/dosaTopics.ts'),await server.ssrLoadModule('/src/data/conversationContext.ts'));}finally{globalThis.fetch=original;await server.close();}
}
test('the chat client answers the chain locally, keeps a longer local window and leaves other scopes to the provider',async()=>withConsumers(async(client,topics,ctx)=>{
 const c=chart(4),report=buildReport(c,chartToKeys(c),{aliases:{},index:{},bodies:{}});
 const context=report.sections.find(s=>s.id==='context-reading').context,d=context.decision,footer=context.blocks.at(-1).lines.at(-1);
 let calls=0,reply='공급자 답변이에요.';globalThis.fetch=async()=>{calls++;return Response.json({text:reply});};
 assert.equal(client.MENU_PROMPT,MENU);
 const visible=[{role:'assistant',text:'앞의 풀이 문장이에요.'},{role:'assistant',text:d.question.prompt},...bubbles(footer).map(text=>({role:'assistant',text}))];
 const ask=(question,topic='직업',extra={})=>client.requestDosaText({topic:'성격',report,lines:topics.topicLines(report,'성격'),chefId:'noona',model:'sonnet',question,
  conversation:ctx.recentConversation(visible,topic),feedbackMessages:[...visible],...extra});
 for(const[answer,pattern]of[['아니요. 도움이 된 적은 없어요.',/두 가지로 읽혀요/],['해 본 적이 없어요. 그럴 기회가 없었어요.',/두 가지로 읽혀요|개인에게 적용하는 판단은 보류/]]){
  const text=await ask(answer);assert.match(text,pattern);visible.push({role:'user',text:answer},...bubbles(text).map(t=>({role:'assistant',text:t})));
 }
 assert.equal(calls,0);
 // The provider history (at most 12) may lose the question; the local replay uses the display window.
 const truncated=ctx.recentConversation(visible.slice(-2),'직업');assert.ok(!truncated.messages.some(m=>m.text===d.question.prompt));
 assert.ok((await ask('과제가 늘지 않았어요','직업',{conversation:truncated,feedbackMessages:undefined})).endsWith('공급자 답변이에요.'));assert.equal(calls,1);
 const final=await ask('과제가 늘지 않았어요','직업',{conversation:truncated});assert.match(final,/설명하지 못해요/);assert.equal(calls,1);
 assert.ok((await ask('과제가 늘지 않았어요','관계')).endsWith('공급자 답변이에요.'));assert.equal(calls,2); // other topic: provider
 const unknown=await ask('과제가 늘지 않았어요','직업',{hourUnknown:true});assert.doesNotMatch(unknown,/공급자 답변|천간 비교/);assert.equal(calls,2);
 // A provider reply to a free question cannot re-ask the owned question as its own last bubble.
 reply=`설명을 이어 갈게요.\n\n${d.question.prompt}`;
 const answered=await ask('그게 무슨 뜻이에요?');assert.equal(calls,3);assert.ok(!answered.includes(d.question.prompt));assert.match(answered,/설명을 이어 갈게요/);
}));
