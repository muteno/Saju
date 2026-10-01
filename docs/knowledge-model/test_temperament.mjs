// PR235: the 성격 topic reads the month branch pattern with the day branch (temperamentCandidates.js) and revises it
// from one answer (temperamentFeedback.js). Expected values are written here from the rules in
// CONDITIONAL_TEMPERAMENT_READING.md — the source's pattern procedure (104·122), its examples (103·104·106·107·122·
// 123·126) and the app's mode table — not copied from the engine's wording. The work decisions are checked apart by
// `measure_work_feedback_scope.mjs layer <prev main> strict`.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {computeChart} from '../../dosa-app/engine/src/manseryeok.js';
import {chartToKeys} from '../../dosa-app/engine/src/keyset.js';
import {buildReport} from '../../dosa-app/engine/src/report.js';
import {buildContextReading} from '../../dosa-app/engine/src/contextReading.js';
import {strengthJudge} from '../../dosa-app/engine/src/judge.js';
import {HIDDEN_STEMS,tenGod,sexIndex,sexStem,sexBranch} from '../../dosa-app/engine/src/tables.js';
import {buildTemperamentReading,monthPattern,TEMPERAMENT_TRAITS,TEMPERAMENT_NAMES} from '../../dosa-app/engine/src/temperamentCandidates.js';
import {resolveTemperamentFeedback,readTemperamentAnswer,ownedTemperamentPrompts,temperamentPlan} from '../../dosa-app/engine/src/temperamentFeedback.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const {terms}=JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
const chart=(y,m,d,hour,gender='F')=>computeChart({year:y,month:m,day:d,hour,minute:0,gender,solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
const S='甲乙丙丁戊己庚辛壬癸',B='子丑寅卯辰巳午未申酉戌亥',GROUPS=['비겁','식상','재성','관성','인성'];
const P=g=>sexIndex(S.indexOf(g[0]),B.indexOf(g[1]));
// A symbolic chart (시·일·월·연 as the source writes them is not used: year, month, day, hour here).
const sym=(y,m,d,h)=>({input:{hour:12,minute:0},pillarsIdx:{year:P(y),month:P(m),day:P(d),hour:P(h)}});
const MENU='또 궁금한 것이 있는가?';
const bubbles=text=>text.split(/\n{2,}/).flatMap(p=>{const s=p.trim().split(/(?<=[.?!…])\s+/).filter(Boolean),o=[];for(let i=0;i<s.length;i+=2)o.push(s.slice(i,i+2).join(' '));return o;});
function session(c){
 const decision=buildTemperamentReading(c);
 const messages=[{role:'assistant',text:decision.question.prompt},...bubbles(decision.footer).map(text=>({role:'assistant',text}))];
 return{decision,messages,say(answer){const step=resolveTemperamentFeedback({decision,footer:decision.footer,messages,answer,menuPrompts:[MENU]});
  if(step)messages.push({role:'user',text:answer},...bubbles(step.text).map(text=>({role:'assistant',text})));return step;}};
}

test('pattern: the month stem first, then the other stems, in the order 정기·여기·중기; else the month branch itself',()=>{
 // Independent reading of 104 (‘정기가 월간에 투간하면 우선 … 여기, 중기 순으로 월간 … 어느것도 월간에 투간하지 못했으면, 일간을
 // 제외한 다른 천간에 투간한 것 … 월지 자체’) and 122 (‘본기부터 여기, 중기 순으로 … 천간은 월간부터’).
 const expect=(month,yearStem,hourStem)=>{
  const hs=HIDDEN_STEMS[month%12],ms=month%10;
  const ranked=hs.map((s,i)=>({s,rank:i===hs.length-1?0:i===0?1:2})).sort((a,b)=>a.rank-b.rank);
  const m=ranked.find(x=>x.s===ms);if(m)return[m.s,'month-stem'];
  const o=ranked.find(x=>x.s===yearStem||x.s===hourStem);if(o)return[o.s,'other-stem'];
  return[hs.at(-1),'month-branch'];
 };
 let n=0;const seen=new Set();
 for(let day=0;day<60;day+=7)for(let month=0;month<60;month++)for(let ys=0;ys<10;ys++)for(let hs=0;hs<10;hs++){
  const p={year:sexIndex(ys,ys%2),month,day,hour:sexIndex(hs,(hs%2)+2)};
  const got=monthPattern(p),[stem,source]=expect(month,ys,hs);n++;
  assert.deepEqual([got.stem,got.source,got.revealed],[stem,source,source!=='month-branch'],JSON.stringify(p));
  assert.equal(got.god,['비견','겁재','식신','상관','편재','정재','편관','정관','편인','정인'][tenGod(sexStem(day),stem)]);
  seen.add(source);
 }
 assert.ok(n>=50000);assert.deepEqual([...seen].sort(),['month-branch','month-stem','other-stem']);
 // The day master is not a revealed stem: 甲 day in 寅 month (정기 甲) with 戊 month stem reveals 여기 戊 (편재).
 assert.deepEqual([monthPattern(sym('庚申','戊寅','甲寅','丙寅').pillarsIdx).god,monthPattern(sym('庚申','戊寅','甲寅','丙寅').pillarsIdx).role],['편재','여기']);
 assert.equal(monthPattern(sym('庚申','庚寅','甲子','乙亥').pillarsIdx).source,'month-branch'); // nothing revealed: 寅's 정기 甲 itself
 assert.equal(monthPattern(sym('庚申','庚寅','甲子','乙亥').pillarsIdx).god,'비견');
 // Two-stem months: 子 = 壬(여기)·癸(정기).
 assert.deepEqual(['god','role','source'].map(k=>monthPattern(sym('壬午','丙子','甲寅','丙寅').pillarsIdx)[k]),['편인','여기','other-stem']);
});

test('source charts: the strong 비견/겁재 examples, the 충 that changes nothing, and the patterns of 122·123·126',()=>{
 // 104 예시1·103 예시1: 寅월 甲 일간, 월간 비견 甲, 신강; 일지 상관 午 → the mind’s 식상 is in the day branch (당당한 행동).
 const flow=buildTemperamentReading(sym('壬子','甲寅','甲午','戊辰'));
 assert.equal(strengthJudge(sym('壬子','甲寅','甲午','戊辰')).label,'신강');
 assert.deepEqual([flow.pattern.god,flow.pattern.source,flow.dayMain.god,flow.mode],['비견','month-stem','상관','peer-flow']);
 // 104 예시2·103 예시2·106: the same with 편관 申 in the day branch → blocked; the 寅申 충 ‘성립하지 않는 경우라도 결과는 동일’.
 const blocked=buildTemperamentReading(sym('壬子','甲寅','甲申','戊辰'));
 assert.deepEqual([blocked.dayMain.god,blocked.mode],['편관','peer-blocked']);
 assert.equal(buildTemperamentReading(sym('壬子','甲寅','甲戌','戊辰')).mode,'peer-flow'); // 戌 본기 戊 = 편재
 // No 충: 乙 day (甲 = 겁재 pattern), 酉 본기 辛 = 편관 does not clash with 寅 and reads the same as 寅申충.
 assert.equal(buildTemperamentReading(sym('壬子','甲寅','乙酉','戊辰')).mode,'peer-blocked');
 // 107: 卯월 비견격 신강, 일지 식상 巳 → flow (시간 편관 辛 does not change the month/day reading).
 assert.equal(buildTemperamentReading(sym('壬子','乙卯','乙巳','辛巳')).mode,'peer-flow');
 // Not strong: the specific rule does not hold and the generic reading is kept.
 const weak=sym('庚申','甲寅','甲申','庚午');assert.notEqual(strengthJudge(weak).label,'신강');
 assert.equal(buildTemperamentReading(weak).mode,'shown-together');
 // 122: 申월 辛 일간, 월간 겁재 庚 → 겁재; 팔정격 reads the 여기 戊 of the year stem → 정인.
 const p122=buildTemperamentReading(sym('戊辰','庚申','辛卯','戊子'));
 assert.deepEqual([p122.pattern.god,p122.pattern.source],['겁재','month-stem']);
 assert.deepEqual(p122.pattern.alternatives.find(a=>a.view==='eight-patterns'),{view:'eight-patterns',god:'정인',character:'戊'});
 // 123: 寅월 戊 일간, 월간 甲 (정기) → 편관. 126 (주원장 戊辰·壬戌·丁丑·丁未): 戌 정기 戊 in the year stem → 상관.
 assert.deepEqual(['god','source'].map(k=>buildTemperamentReading(sym('庚午','甲寅','戊午','丁巳')).pattern[k]),['편관','month-stem']);
 const p126=buildTemperamentReading(sym('戊辰','壬戌','丁丑','丁未')).pattern;
 assert.deepEqual([p126.god,p126.role,p126.source,p126.positions],['상관','정기','other-stem',['year']]);
});

test('mode table: every symbolic chart gets one reading, a specific source rule supersedes the generic one',()=>{
 const want=c=>{
  const p=c.pillarsIdx,day=sexStem(p.day),pat=monthPattern(p),g=GROUPS[Math.floor(tenGod(day,pat.stem)/2)];
  const dh=HIDDEN_STEMS[sexBranch(p.day)],dg=GROUPS[Math.floor(tenGod(day,dh.at(-1))/2)],strong=['신강','극신강'].includes(strengthJudge(c).label);
  if(g==='비겁'&&strong&&dg==='관성')return'peer-blocked';
  if(g==='비겁'&&strong&&(dg==='식상'||dg==='재성'))return'peer-flow';
  return g===dg?'one-direction':pat.revealed?'shown-together':'inner-outer';
 };
 const modes={},superseded={};
 for(let day=0;day<60;day++)for(let month=0;month<60;month++)for(const year of[0,13,26,39,52])for(const hour of[5,22,47]){
  const c={input:{hour:12,minute:0},pillarsIdx:{year,month,day,hour}},r=buildTemperamentReading(c);
  assert.equal(r.mode,want(c));assert.deepEqual(r.selectedIds,[r.mode]);
  modes[r.mode]=(modes[r.mode]??0)+1;
  for(const x of r.candidates.filter(x=>x.status==='superseded'))superseded[x.id]=(superseded[x.id]??0)+1;
  assert.ok(r.mode.startsWith('peer-')===r.candidates.some(x=>x.status==='superseded'));
  assert.equal(r.probability,null);assert.equal(r.trainingEligible,false);assert.equal(r.lines[0],r.interpretation);
 }
 assert.deepEqual(Object.keys(modes).sort(),['inner-outer','one-direction','peer-blocked','peer-flow','shown-together']);
 assert.deepEqual(Object.keys(superseded).sort(),['inner-outer','shown-together']); // a 비겁 pattern with a 관성/식상/재성 day branch is never the same group
 // Unknown birth time keeps the null contract; the section is then absent from the report.
 const known=chart(1985,9,7,2);
 for(const unknown of[{...known,input:{...known.input,hourUnknown:true}},{...known,birthTime:{status:'unknown'}},{...known,input:{...known.input,hour:null}}])
  assert.equal(buildTemperamentReading(unknown),null);
});

test('same day pillar: the month (and sometimes the hour) changes the selected reading; the gender and an unrevealing hour do not',()=>{
 const r=(...a)=>buildTemperamentReading(chart(...a));
 // 甲寅: 寅월 with the 여기 戊 in the month stem (revealed) vs 辰월 with nothing revealed.
 const [a,b]=[r(1980,2,11,4),r(1980,4,11,4)];
 assert.equal(chart(1980,2,11,4).saju.day.hanja,chart(1980,4,11,4).saju.day.hanja);
 assert.deepEqual([a.mode,b.mode],['shown-together','inner-outer']);
 assert.notEqual(a.interpretation,b.interpretation);assert.notEqual(a.question.prompt,b.question.prompt);
 // 04시/06시: the month stem decides first, so the hour stem changes nothing here (unrelated condition).
 assert.deepEqual(r(1980,2,11,6).lines,a.lines);
 // 己酉: 申월 상관 with a 식신 day branch (same group) vs 戌월 겁재, 신강, 식신 day branch (the strong 겁재 flows to it).
 const [c,d]=[r(1985,9,7,2),r(1985,11,6,2)];
 assert.equal(chart(1985,9,7,2).saju.day.hanja,chart(1985,11,6,2).saju.day.hanja);
 assert.deepEqual([c.mode,d.mode],['one-direction','peer-flow']);
 assert.deepEqual(r(1985,9,7,2,'M').lines,c.lines); // no 대운 in this reading
 // One day, different hours: a revealed hour stem and the strength change the reading (1975-02-02, 己 day in 丑월).
 const hours=[0,2,14,16,18].map(h=>[h,r(1975,2,2,h)]);
 assert.deepEqual(hours.map(([h,x])=>[h,x.mode,x.pattern.god]),
  [[0,'inner-outer','비견'],[2,'peer-blocked','비견'],[14,'shown-together','식신'],[16,'inner-outer','비견'],[18,'shown-together','편재']]);
 // The hour-stem reveal is recorded with the stricter ‘near stems only’ view (record only, never chosen).
 assert.deepEqual(hours[2][1].pattern.alternatives.find(a=>a.view==='near-reveal-only'),{view:'near-reveal-only',god:'비견',character:'己',source:'month-branch'});
 assert.ok(!hours[1][1].pattern.alternatives.some(a=>a.view==='near-reveal-only'));
 // The trait words are the source characters paraphrased: every pattern and day branch god has one.
 for(const x of[a,b,c,d])for(const g of[x.pattern.god,x.dayMain.god])assert.ok(x.interpretation.includes(TEMPERAMENT_TRAITS[g])||x.facts.includes(g));
 // The work reading is untouched by this layer.
 const work=buildContextReading(chart(1980,2,11,4));assert.equal(work.policy,'natal-work-context-v14');assert.ok(!('temperament' in work));
});

test('answers: kept, lowered, reversed, scoped or withheld by the mode; the complementary question once; one clarification',()=>{
 // Reader: whole short forms only.
 for(const[text,kind]of[['네','supported'],['네 맞아요','supported'],['그런 편이에요','supported'],['저는 그런 편이에요','supported'],['자주 그래요','supported'],
  ['아니요','contradicted'],['별로요','contradicted'],['그런 적 없어요','contradicted'],['때에 따라 달라요','mixed'],['가끔요','mixed'],['반반이에요','mixed'],
  ['잘 모르겠어요','unsure'],['음 잘 모르겠어요','unsure'],['말하고 싶지 않아요','unanswered'],['반대예요','reversed'],['아니요 반대예요','reversed'],
  ['네 근데 가끔은 아니에요','clarify:unclear'],['회사에선 그런데 집에선 별로','clarify:unclear']])
  assert.equal(readTemperamentAnswer(text,{reversible:true})?.kind,kind,text);
 assert.equal(readTemperamentAnswer('반대예요').kind,'contradicted'); // only the inside/outside question has an opposite
 for(const text of['그게 무슨 뜻인가요?','연애운은 어때요','네, 알겠어요','오늘 날씨 좋네요','네…'])assert.equal(readTemperamentAnswer(text,{reversible:true}),null,text);
 // Mode × answer table (independent of wording): status of the asked candidate, and whether the complementary question follows.
 const cases=[
  [chart(1980,4,11,4),'inner-outer',[['네',{'inner-outer':'retained-as-self-report'},false]]],
  [chart(1980,4,11,4),'inner-outer',[['아니요',{'inner-outer':'weakened'},true],['네',{'inner-outer':'weakened','shown-together':'retained-as-self-report'},false]]],
  [chart(1980,4,11,4),'inner-outer',[['아니요',{'inner-outer':'weakened'},true],['아니요',{'inner-outer':'weakened','shown-together':'weakened','month-pattern':'weakened'},false]]],
  [chart(1980,4,11,4),'inner-outer',[['반대예요',{'inner-outer':'weakened','pattern-outward':'retained-as-self-report'},false]]],
  [chart(1980,2,11,4),'shown-together',[['아니요',{'shown-together':'weakened'},true],['네',{'shown-together':'weakened','inner-outer':'retained-as-self-report'},false]]],
  [chart(1980,2,11,4),'shown-together',[['반대예요',{'shown-together':'weakened'},true],['때에 따라 달라요',{'shown-together':'weakened','inner-outer':'scoped'},false]]],
  [chart(1985,9,7,2),'one-direction',[['아니요',{'one-direction':'weakened'},false]]],
  [chart(1985,9,7,2),'one-direction',[['때에 따라 달라요',{'one-direction':'scoped'},false]]],
  [chart(1985,11,6,2),'peer-flow',[['아니요',{'peer-flow':'weakened'},false]]],
  [chart(1975,2,2,2),'peer-blocked',[['자주 그래요',{'peer-blocked':'retained-as-self-report'},false]]],
  [chart(1975,2,2,2),'peer-blocked',[['잘 모르겠어요',{'peer-blocked':'withheld'},false]]],
  [chart(1975,2,2,2),'peer-blocked',[['말하고 싶지 않아요',{'peer-blocked':'withheld'},false]]],
 ];
 for(const[c,mode,steps]of cases){
  const s=session(c);assert.equal(s.decision.mode,mode);const before=JSON.parse(JSON.stringify(s.decision));
  for(const[answer,feedback,asks]of steps){
   const step=s.say(answer);assert.ok(step,`${mode} ${answer}`);assert.deepEqual(step.feedback,feedback,`${mode} ${answer}`);
   assert.equal(Boolean(step.nextQuestion),asks,`${mode} ${answer}`);if(asks)assert.equal(step.nextQuestion.prompt,s.decision.followup.prompt);
   assert.equal(step.probability,null);assert.equal(step.trainingEligible,false);
   assert.deepEqual(step.beforeFeedback.selectedIds,[mode]);assert.equal(step.beforeFeedback.interpretation,before.interpretation);
  }
  assert.deepEqual(s.decision,before); // the natal reading itself is never changed by an answer
  assert.equal(s.say('네'),null); // nothing is pending: back to normal chat
 }
 // A revised reading says it was revised after the answer, never that the chart predicted it.
 const t=session(chart(1980,4,11,4));t.say('아니요');assert.match(t.say('네').text,/처음 풀이의 적중으로 세지 않아요/);
 // One clarification, then unconfirmed without asking again.
 const u=session(chart(1985,11,6,2));
 assert.equal(u.say('회사에선 그런데 집에선 별로').action,'clarify');
 const end=u.say('글쎄 그렇다고 하기도 그렇고요');assert.equal(end.action,'unresolved');assert.deepEqual(end.feedback,{'peer-flow':'unconfirmed'});assert.equal(u.say('네'),null);
 const v=session(chart(1985,11,6,2));v.say('회사에선 그런데 집에선 별로');assert.equal(v.say('때에 따라 달라요').after,'scoped');
});

test('replay: only the latest shown question with every local answer shown; a menu line takes a bare yes; prompts are owned',()=>{
 const s=session(chart(1980,4,11,4)),{decision}=s,q=decision.question.prompt;
 const resolve=(messages,answer='아니요')=>resolveTemperamentFeedback({decision,footer:decision.footer,messages,answer,menuPrompts:[MENU]});
 assert.ok(resolve(s.messages));assert.equal(resolve([]),null);
 assert.equal(resolve([...s.messages,{role:'assistant',text:MENU}],'네'),null);
 assert.equal(resolve([...s.messages,{role:'assistant',text:MENU}],'아니요'),null);
 // A worded answer cannot be an answer to the menu line.
 assert.equal(resolve([...s.messages,{role:'assistant',text:MENU}],'그런 편이에요').after,'retained-as-self-report');
 assert.equal(resolve([...s.messages,{role:'assistant',text:MENU}],'별로 그렇지 않아요').nextQuestion.id,decision.followup.id);
 assert.equal(resolve([...s.messages,{role:'assistant',text:MENU}],'때에 따라 달라요').after,'scoped');
 assert.equal(resolve([{role:'assistant',text:q},{role:'assistant',text:'공급자가 덧붙인 문장이에요.'}]),null);
 assert.equal(resolve([...s.messages,{role:'user',text:'무슨 뜻이에요?'},{role:'assistant',text:'공급자 답변이에요.'}]),null);
 s.say('아니요');
 assert.equal(resolve(s.messages,'네').questionId,decision.followup.id);
 const edited=s.messages.map((m,i)=>i===s.messages.length-1?{...m,text:m.text+' 추가'}:m);assert.equal(resolve(edited,'네'),null);
 assert.equal(resolveTemperamentFeedback({decision:null,messages:s.messages,answer:'네'}),null);
 assert.deepEqual(ownedTemperamentPrompts(decision),[q,decision.followup.prompt]);
 assert.deepEqual(ownedTemperamentPrompts(buildTemperamentReading(chart(1985,9,7,2))),[buildTemperamentReading(chart(1985,9,7,2)).question.prompt]);
 assert.equal(temperamentPlan(decision).first.name,TEMPERAMENT_NAMES['inner-outer']);
});

async function withConsumers(run){
 const require=createRequire(new URL('../../app/package.json',import.meta.url));const{createServer}=await import(pathToFileURL(require.resolve('vite')).href);
 const server=await createServer({root:root+'app',server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'}),original=globalThis.fetch;
 try{await run(await server.ssrLoadModule('/src/data/dosaClient.ts'),await server.ssrLoadModule('/src/data/dosaTopics.ts'),await server.ssrLoadModule('/src/data/conversationContext.ts'),
  await server.ssrLoadModule('/src/data/analysisGroups.ts'));}finally{globalThis.fetch=original;await server.close();}
}
test('the app: the 성격 topic shows the reading first and its question last, answers it locally and keeps it out of free answers',async()=>withConsumers(async(client,topics,ctx,groups)=>{
 const c=chart(1980,4,11,4),report=buildReport(c,chartToKeys(c),{aliases:{},index:{},bodies:{}}),t=report.sections.find(s=>s.id==='temperament-reading').temperament;
 const lines=topics.topicLines(report,'성격').map(l=>l.text);
 assert.equal(lines[0],t.interpretation);assert.ok(lines.includes(t.question.prompt));
 assert.deepEqual(client.readingFollowups(report,topics.topicLines(report,'성격')),[t.question.prompt,t.footer]);
 assert.deepEqual(client.readingNotices(report,topics.topicLines(report,'성격')).slice(0,t.lines.length),t.lines); // the topic's own reading leads
 assert.ok(!topics.topicLines(report,'직업').some(l=>l.text===t.question.prompt)); // the work topic keeps its own reading
 assert.ok(!client.readingNotices(report,topics.topicLines(report,'직업')).includes(t.interpretation));
 assert.deepEqual(topics.TOPIC_FOCUS['성격'],['월','일']);
 let calls=0,reply='공급자 답변이에요.';globalThis.fetch=async()=>{calls++;return Response.json({text:reply});};
 const visible=[{role:'assistant',text:t.interpretation},{role:'assistant',text:t.question.prompt},...bubbles(t.footer).map(text=>({role:'assistant',text}))];
 const ask=(question,topic='성격',extra={})=>client.requestDosaText({topic:'성격',report,lines:topics.topicLines(report,'성격'),chefId:'noona',model:'sonnet',question,
  conversation:ctx.recentConversation(visible,topic),feedbackMessages:[...visible],...extra});
 const first=await ask('아니요');assert.match(first,/낮춰요/);assert.ok(first.endsWith(t.followup.prompt));assert.equal(calls,0);
 visible.push({role:'user',text:'아니요'},...bubbles(first).map(text=>({role:'assistant',text})));
 const second=await ask('네');assert.match(second,/함께 보이는 쪽으로 고쳐 읽어요/);assert.equal(calls,0);
 assert.ok((await ask('그게 무슨 뜻이에요?')).endsWith('공급자 답변이에요.'));assert.equal(calls,1);
 assert.ok((await ask('네','관계')).endsWith('공급자 답변이에요.'));assert.equal(calls,2); // another topic: provider
 const unknown=await ask('아니요','성격',{hourUnknown:true});assert.doesNotMatch(unknown,/공급자 답변|낮춰요/);assert.equal(calls,2);
 // A free answer is grounded on the reading but never re-attaches or re-asks the topic question.
 let sent=null;globalThis.fetch=async(_,init)=>{calls++;sent=JSON.parse(init.body);return Response.json({text:reply});};
 reply=`설명을 이어 갈게요.\n\n${t.question.prompt}`;
 const answered=await ask('그건 왜 그런가요?');assert.ok(!answered.includes(t.question.prompt));assert.ok(!answered.includes(t.footer));assert.match(answered,/설명을 이어 갈게요/);
 assert.ok(sent.grounds.some(g=>g.text===t.interpretation));assert.ok(!sent.grounds.some(g=>g.text===t.question.prompt||g.text===t.footer));
 assert.ok(!answered.includes(t.reason)); // the reading's lines are not prepended to a free answer
 // The topic reading request keeps the reading and its question around a generated text.
 reply='공급자 풀이예요.';
 const reading=await client.requestDosaText({topic:'성격',report,lines:topics.topicLines(report,'성격'),chefId:'noona',model:'sonnet'});
 assert.ok(reading.startsWith(t.interpretation));assert.ok(reading.endsWith(`${t.question.prompt}\n\n${t.footer}`));assert.ok(reading.includes('공급자 풀이예요.'));
 // The analysis card goes to 성향과 기질.
 const card={headline:'',unseYear:'',dialogue:[],cards:[{id:'judge',title:'원국 구조 판정',blocks:[]},{id:'temperament-reading',title:'내 원국으로 읽는 기본 성향',blocks:t.blocks,note:t.note}]};
 const temper=groups.buildTopicGroups(card).find(g=>g.id==='temper');assert.deepEqual(temper.cards.map(card=>card.id),['judge','temperament-reading']);
}));
