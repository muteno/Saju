// PR236: the 관계 topic reads the spouse star (여명 관성, 남명 재성) by its place and polarity (relationCandidates.js) and
// revises it from one answer (relationFeedback.js). Expected values are written here from the rules in
// CONDITIONAL_RELATION_READING.md — the source's places (고급2 401·407), warmth (401), combination (고급1 314·315,
// 고급2 406·407), the bridged 월간 편관 (중급1 105·110, 고급1 315), hidden stems (고급2 404) and the app's mode table —
// with an independent element/polarity rule, not copied from the engine's tables or wording. The temperament and work
// readings are checked apart (test_temperament.mjs, `measure_work_feedback_scope.mjs layer <prev main> strict`).
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {computeChart} from '../../dosa-app/engine/src/manseryeok.js';
import {chartToKeys} from '../../dosa-app/engine/src/keyset.js';
import {buildReport} from '../../dosa-app/engine/src/report.js';
import {buildTemperamentReading} from '../../dosa-app/engine/src/temperamentCandidates.js';
import {sexIndex} from '../../dosa-app/engine/src/tables.js';
import {buildRelationReading,RELATION_NAMES} from '../../dosa-app/engine/src/relationCandidates.js';
import {resolveRelationFeedback,readRelationAnswer,ownedRelationPrompts,relationPlan} from '../../dosa-app/engine/src/relationFeedback.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const {terms}=JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
const chart=(y,m,d,hour,gender='F')=>computeChart({year:y,month:m,day:d,hour,minute:0,gender,solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
const S='甲乙丙丁戊己庚辛壬癸',B='子丑寅卯辰巳午未申酉戌亥';
const P=g=>sexIndex(S.indexOf(g[0]),B.indexOf(g[1]));
// A symbolic chart: year, month, day, hour pillars as written.
const sym=(y,m,d,h,gender='F')=>({input:{hour:12,minute:0,gender},pillarsIdx:{year:P(y),month:P(m),day:P(d),hour:P(h)}});
const GANJI=Array.from({length:60},(_,i)=>S[i%10]+B[i%12]);

// ── Independent rule (element strings, not the engine's index tables).
const HID={子:'壬癸',丑:'癸辛己',寅:'戊丙甲',卯:'甲乙',辰:'乙癸戊',巳:'戊庚丙',午:'丙己丁',未:'丁乙己',申:'戊壬庚',酉:'庚辛',戌:'辛丁戊',亥:'戊甲壬'};
const EL={甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};
const PRODUCES={木:'火',火:'土',土:'金',金:'水',水:'木'},CONTROLS={木:'土',土:'水',水:'火',火:'金',金:'木'};
const yang=c=>S.indexOf(c)%2===0;
const kind=(me,o)=>{const a=EL[me],b=EL[o];return a===b?'비겁':PRODUCES[a]===b?'식상':CONTROLS[a]===b?'재성':CONTROLS[b]===a?'관성':'인성';};
const warm=(me,o)=>yang(me)!==yang(o);
const HAP=['甲己','乙庚','丙辛','丁壬','戊癸'],combine=(a,b)=>HAP.includes(a+b)||HAP.includes(b+a);
function expected([y,m,d,h],gender){
 const me=d[0],want=gender==='F'?'관성':'재성',main=gz=>HID[gz[1]].at(-1);
 const visible=[['연간',y[0]],['월간',m[0]],['시간',h[0]],['연지',main(y)],['월지',main(m)],['일지',main(d)],['시지',main(h)]].filter(([,c])=>kind(me,c)===want);
 const near=visible.filter(([p])=>['월간','일지','시간'].includes(p));
 const hidden=[y,m,d,h].some(gz=>[...HID[gz[1]]].slice(0,-1).some(c=>kind(me,c)===want));
 if(near.length){
  const w=near.filter(([,c])=>warm(me,c)),f=near.filter(([,c])=>!warm(me,c));
  if(w.length&&f.length)return'near-mixed';
  if(w.length)return w.some(([,c])=>combine(me,c))?'near-bonded':'near-warm';
  return gender==='F'&&near.every(([p])=>p==='월간')&&[m,d].some(gz=>kind(me,main(gz))==='인성')?'near-bridged':'near-firm';
 }
 return visible.length?'far':hidden?'hidden':'absent';
}
const MENU='또 궁금한 것이 있는가?';
const bubbles=text=>text.split(/\n{2,}/).flatMap(p=>{const s=p.trim().split(/(?<=[.?!…])\s+/).filter(Boolean),o=[];for(let i=0;i<s.length;i+=2)o.push(s.slice(i,i+2).join(' '));return o;});
function session(c){
 const decision=buildRelationReading(c);
 const messages=[{role:'assistant',text:decision.question.prompt},...bubbles(decision.footer).map(text=>({role:'assistant',text}))];
 return{decision,messages,say(answer){const step=resolveRelationFeedback({decision,footer:decision.footer,messages,answer,menuPrompts:[MENU]});
  if(step)messages.push({role:'user',text:answer},...bubbles(step.text).map(text=>({role:'assistant',text})));return step;}};
}

test('source charts: places, warmth, combination, the bridged 월간 편관 and hidden stems',()=>{
 const mode=(...a)=>buildRelationReading(sym(...a)).mode;
 // 중급1 106 (220~224): 인월 甲 여명, 일지 申 편관 — one body (인연) without harmony (정).
 const r106=buildRelationReading(sym('壬子','甲寅','甲申','丙寅','F'));
 assert.equal(r106.mode,'near-firm');assert.deepEqual(r106.stars.facing.map(s=>[s.placeName,s.character,s.god]),[['일지','庚','편관']]);
 assert.ok(r106.palaceClash.includes('인신충'));assert.equal(r106.features.bridged,0); // recorded, not used
 assert.equal(mode('壬子','甲寅','甲申','丙寅','M'),'hidden'); // the same chart as 남명: 戊 only as a hidden stem
 // 고급2 401 (56~58): 인월 丙 남명, 일지 申 편재.
 assert.equal(mode('甲辰','壬寅','丙申','己亥','M'),'near-firm');
 // 고급2 404 (137~138): 甲 남명 — 일지 편재 with a 연간 정재 far away; 시간 정재 combining; both beside.
 const r404=buildRelationReading(sym('己巳','丙寅','甲戌','甲子','M'));
 assert.equal(r404.mode,'near-firm');assert.deepEqual(r404.stars.far.map(s=>[s.placeName,s.god]),[['연간','정재']]);
 assert.equal(mode('壬子','丙寅','甲子','己巳','M'),'near-bonded');
 assert.equal(mode('壬子','丙寅','甲辰','己巳','M'),'near-mixed');
 // 고급2 407 (228~231): 戊子 남명 — 일지 子의 본기 癸 정재와 명암합; 시간 癸 정재도 합.
 const r407=buildRelationReading(sym('甲寅','丙寅','戊子','甲寅','M'));
 assert.equal(r407.mode,'near-bonded');assert.equal(r407.bonded.place,'dayBranch');
 assert.equal(mode('甲寅','丙寅','戊午','癸亥','M'),'near-bonded');
 // 고급1 315 (344~347): 丁亥 여명 (壬 정관과 명암합); 丙 여명 월간 癸 정관 (합은 아님).
 assert.equal(mode('甲寅','丙寅','丁亥','甲辰','F'),'near-bonded');
 assert.equal(mode('甲午','癸巳','丙寅','甲午','F'),'near-warm');
 // 고급1 315 (332~340)·중급1 105 (200): 乙 여명 월간 辛 편관 — 인성 in 월지 or 일지 bridges it, 시지 does not.
 assert.equal(mode('丁卯','辛巳','乙未','丙戌','F'),'near-firm');
 assert.equal(mode('丁卯','辛亥','乙未','丙戌','F'),'near-bridged');
 assert.equal(mode('丁卯','辛巳','乙亥','丙戌','F'),'near-bridged');
 assert.equal(mode('丁卯','辛巳','乙未','丙子','F'),'near-firm');
 // 중급1 110 (316~318): 甲 여명 월간 庚 편관 with 子 in 월지 or 일지; 중급1 105 (196~203): 辛 여명 월간 丁 편관 over 丑.
 assert.equal(mode('丙寅','庚子','甲寅','丙寅','F'),'near-bridged');
 assert.equal(mode('丙寅','庚午','甲子','丙寅','F'),'near-bridged');
 assert.equal(mode('丙寅','庚午','甲午','丙寅','F'),'near-firm');
 assert.equal(mode('壬子','丁丑','辛卯','庚寅','F'),'near-bridged');
 // A 시간 편관 over its own 인성 is not bridged: the source bridges the 월간 only.
 assert.equal(mode('丙寅','丙寅','甲寅','庚子','F'),'near-firm');
 // 고급2 401 (62~63): 辛 여명 — 연간·연지·월지·시지 hardly face the day master; 월간·시간·일지 do.
 assert.equal(mode('丙寅','甲辰','辛卯','庚寅','F'),'far');assert.equal(mode('壬午','甲辰','辛卯','庚寅','F'),'far');
 assert.equal(mode('壬寅','戊午','辛卯','庚寅','F'),'far');assert.equal(mode('壬寅','甲辰','辛卯','庚午','F'),'far');
 // 丙 is 辛's 정관 and combines with it beside the day master (월간, or 巳's 본기 in 일지); a 시간 丁 is a 편관.
 assert.equal(mode('壬寅','丙申','辛卯','庚寅','F'),'near-bonded');assert.equal(mode('壬寅','甲辰','辛巳','庚寅','F'),'near-bonded');
 assert.equal(mode('壬寅','甲辰','辛卯','丁酉','F'),'near-firm');
 // 고급2 404 (132): 오월 丙 남명, 재성 only as 시지 丑의 지장간 辛.
 assert.equal(mode('丙寅','甲午','丙午','己丑','M'),'hidden');
 // No spouse star anywhere: the reading keeps to the day branch and never states a missing bond.
 const none=buildRelationReading(sym('丙寅','甲午','丙午','甲午','M'));
 assert.equal(none.mode,'absent');assert.doesNotMatch(none.lines.join(' '),/인연이 (?:부족|없)|결혼(?:을|이) (?:못|늦)/);
});

test('mode table: every symbolic chart gets one reading, a specific source rule supersedes only its generic reading',()=>{
 const seen={F:new Set(),M:new Set()};let n=0;
 for(const d of GANJI)for(const m of GANJI)for(const y of ['甲子','丁卯','庚午','辛酉','壬戌'])for(const h of ['乙亥','戊申','癸丑'])for(const g of ['F','M']){
  const r=buildRelationReading(sym(y,m,d,h,g));n++;
  assert.equal(r.mode,expected([y,m,d,h],g),`${y}·${m}·${d}·${h} ${g}`);
  assert.equal(r.selectedIds.length,1);seen[g].add(r.mode);
  const generic=r.candidates.filter(c=>!c.specific&&c.condition.value===1);assert.equal(generic.length,1);
  const superseded=r.candidates.filter(c=>c.status==='superseded').map(c=>c.id);
  if(r.mode==='near-bonded')assert.deepEqual(superseded,['near-warm']);
  else if(r.mode==='near-bridged')assert.deepEqual(superseded,['near-firm']);
  else assert.deepEqual(superseded,[]);
  assert.equal(r.probability,null);assert.equal(r.trainingEligible,false);assert.equal(r.beforeFeedback,true);
 }
 assert.equal(n,108000);
 assert.deepEqual([...seen.F].sort(),['absent','far','hidden','near-bonded','near-bridged','near-firm','near-mixed','near-warm']);
 assert.deepEqual([...seen.M].sort(),['absent','far','hidden','near-bonded','near-firm','near-mixed','near-warm']); // 편재 is never bridged
 // Unknown birth time, a missing gender and incomplete charts keep the null contract.
 for(const c of [null,{},{...sym('甲子','丙寅','甲寅','丙寅'),birthTime:{status:'unknown'}},{...sym('甲子','丙寅','甲寅','丙寅'),input:{hour:12,minute:0,gender:'F',hourUnknown:true}},
  {input:{hour:12,minute:0},pillarsIdx:sym('甲子','丙寅','甲寅','丙寅').pillarsIdx},{input:{hour:12,minute:0,gender:'X'},pillarsIdx:sym('甲子','丙寅','甲寅','丙寅').pillarsIdx}])
  assert.equal(buildRelationReading(c),null);
});

test('same day pillar: the month, the hour and the gender change the selected reading',()=>{
 const pair=(a,b)=>[buildRelationReading(a),buildRelationReading(b)];
 // 갑인 1980-02-11 / 04-11 04시: 관성 庚 only in the year (far) vs in the month stem (near, 편관 without 인성).
 let [a,b]=pair(chart(1980,2,11,4,'F'),chart(1980,4,11,4,'F'));
 assert.equal(a.dayPillar,b.dayPillar);assert.equal(a.mode,'far');assert.equal(b.mode,'near-firm');assert.notEqual(a.interpretation,b.interpretation);
 // The same charts as 남명: 재성 戊 in the month stem (near) vs only the month branch 辰 (far).
 [a,b]=pair(chart(1980,2,11,4,'M'),chart(1980,4,11,4,'M'));assert.equal(a.mode,'near-firm');assert.equal(b.mode,'far');
 // 기유 1985-09-07 / 11-06 02시 여명: 甲 정관 (월간) beside 乙 편관 (시간) vs 乙 편관 only; 남명: 재성 only hidden in both.
 [a,b]=pair(chart(1985,9,7,2,'F'),chart(1985,11,6,2,'F'));assert.equal(a.mode,'near-mixed');assert.equal(b.mode,'near-firm');
 assert.match(a.facts,/합을 이뤄요/); // 甲己 is recorded beside the mixed reading
 [a,b]=pair(chart(1985,9,7,2,'M'),chart(1985,11,6,2,'M'));assert.equal(a.mode,'hidden');assert.equal(b.mode,'hidden');assert.notEqual(a.facts,b.facts);
 // One date, the hour alone: a 시간 己 정재 (己巳) beside the month's 戊 편재 makes the reading mixed; 戊辰 keeps it firm;
 // for 여명 a 시간 辛 정관 (辛未) or 庚 편관 (庚午) brings the far 관성 beside the day master.
 [a,b]=pair(chart(1980,2,11,10,'M'),chart(1980,2,11,8,'M'));assert.equal(a.dayPillar,b.dayPillar);assert.equal(a.mode,'near-mixed');assert.equal(b.mode,'near-firm');
 assert.deepEqual([12,14,16].map(h=>buildRelationReading(chart(1980,2,11,h,'F')).mode),['near-firm','near-warm','far']);
 // The reading is the spouse star's: the same chart gives the 성격 reading unchanged for both genders.
 assert.deepEqual(buildTemperamentReading(chart(1980,2,11,4,'F')),buildTemperamentReading(chart(1980,2,11,4,'M')));
 for(const r of [a,b])assert.doesNotMatch(r.lines.join(' '),/이혼|파경|재혼|바람|문란|배우자 덕|해로/);
});

const find=(mode,g)=>{for(const d of GANJI)for(const m of GANJI){const c=sym('辛酉',m,d,'戊申',g);if(expected(['辛酉',m,d,'戊申'],g)===mode)return c;}throw new Error(mode);};
const MODES={'near-bonded':'F','near-bridged':'F','near-warm':'F','near-firm':'M','near-mixed':'F',far:'M',hidden:'F',absent:'M'};
test('answers: kept, lowered, switched, narrowed, scoped or withheld by the mode; the complementary question once; one clarification',()=>{
 const followed=['near-bonded','near-bridged','near-warm','near-firm','near-mixed'],reversible=['near-warm','near-firm','near-mixed'];
 const opposite={'near-warm':'near-firm','near-firm':'near-warm','near-mixed':'near-firm','near-bonded':'near-warm','near-bridged':'near-firm'};
 for(const [mode,g] of Object.entries(MODES)){
  const c=find(mode,g),first=answer=>session(c).say(answer),d=buildRelationReading(c);assert.equal(d.mode,mode);
  const frozen=JSON.stringify(d);
  // Yes
  let s=first('맞아요');
  if(mode==='near-mixed'){assert.equal(s.after,'narrowed');assert.equal(s.feedback['near-warm'],'retained-as-self-report');}
  else{assert.equal(s.after,'retained-as-self-report');assert.equal(s.nextQuestion,null);}
  // No
  s=first('아니요');
  if(followed.includes(mode)){assert.equal(s.nextQuestion.targetCandidateId,opposite[mode]);assert.ok(s.text.endsWith(s.nextQuestion.prompt));
   assert.equal(s.after,mode==='near-mixed'?'narrowed':'weakened');}
  else{assert.equal(s.after,'weakened');assert.equal(s.nextQuestion,null);assert.match(s.revisedInterpretation,/낮춰요/);}
  // The opposite: its own answer only where the question names one.
  s=first('반대예요');
  if(reversible.includes(mode)){assert.equal(s.nextQuestion,null);assert.equal(s.feedback[opposite[mode]],'retained-as-self-report');assert.match(s.text,/적중으로 세지 않아요/);}
  else assert.equal(s.answer.kind,'contradicted');
  assert.equal(first('때에 따라 달라요').after,'scoped');
  assert.equal(first('잘 모르겠어요').after,'withheld');assert.equal(first('말하고 싶지 않아요').after,'withheld');
  // The complementary question: yes switches to it, no lowers both; it is asked once.
  if(followed.includes(mode)){
   for(const [reply,status] of [['네','retained-as-self-report'],['아니요','weakened']]){
    const t=session(c);t.say('아니요');const step=t.say(reply);
    assert.equal(step.questionId,d.followup.id);assert.equal(step.feedback[opposite[mode]],status);assert.equal(step.nextQuestion,null);
    assert.equal(t.say('네'),null); // nothing pending: back to chat
   }
  }
  // One clarification, then unconfirmed; the decision object never changes.
  const t=session(c);assert.equal(t.say('연애할 때는 그런 편이에요').action,'clarify');
  const after=t.say('글쎄 그렇다고 하기도 그렇고요');assert.equal(after.action,'unresolved');assert.equal(after.after,'unconfirmed');
  assert.equal(JSON.stringify(d),frozen);assert.equal(after.beforeFeedback.mode,mode);assert.equal(after.probability,null);assert.equal(after.trainingEligible,false);
 }
 // Relationship words are part of an answer here (the temperament reader sends them to chat).
 assert.equal(readRelationAnswer('남편이랑은 그래요').kind,'clarify:unclear');
 assert.equal(readRelationAnswer('올해 연애운은 어때요?'),null);assert.equal(readRelationAnswer('직업 얘기도 해 주세요'),null);
});

test('replay: only the latest shown question with every local answer shown; a menu line takes a bare yes; prompts are owned',()=>{
 const s=session(chart(1980,4,11,4,'F')),{decision}=s,q=decision.question.prompt;
 const resolve=(messages,answer='아니요')=>resolveRelationFeedback({decision,footer:decision.footer,messages,answer,menuPrompts:[MENU]});
 assert.ok(resolve(s.messages));assert.equal(resolve([]),null);
 assert.equal(resolve([...s.messages,{role:'assistant',text:MENU}],'네'),null);
 assert.equal(resolve([...s.messages,{role:'assistant',text:MENU}],'아니요'),null);
 assert.equal(resolve([...s.messages,{role:'assistant',text:MENU}],'그런 편이에요').after,'retained-as-self-report');
 assert.equal(resolve([...s.messages,{role:'assistant',text:MENU}],'별로 그렇지 않아요').nextQuestion.id,decision.followup.id);
 assert.equal(resolve([{role:'assistant',text:q},{role:'assistant',text:'공급자가 덧붙인 문장이에요.'}]),null);
 assert.equal(resolve([...s.messages,{role:'user',text:'무슨 뜻이에요?'},{role:'assistant',text:'공급자 답변이에요.'}]),null);
 s.say('아니요');
 assert.equal(resolve(s.messages,'네').questionId,decision.followup.id);
 const edited=s.messages.map((m,i)=>i===s.messages.length-1?{...m,text:m.text+' 추가'}:m);assert.equal(resolve(edited,'네'),null);
 assert.equal(resolveRelationFeedback({decision:null,messages:s.messages,answer:'네'}),null);
 assert.deepEqual(ownedRelationPrompts(decision),[q,decision.followup.prompt]);
 const far=buildRelationReading(chart(1980,2,11,4,'F'));assert.deepEqual(ownedRelationPrompts(far),[far.question.prompt]);
 assert.equal(relationPlan(decision).first.name,RELATION_NAMES['near-firm']);
});

async function withConsumers(run){
 const require=createRequire(new URL('../../app/package.json',import.meta.url));const{createServer}=await import(pathToFileURL(require.resolve('vite')).href);
 const server=await createServer({root:root+'app',server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'}),original=globalThis.fetch;
 try{
  // The analysis cards need the built KB bundle (npm run build runs before test:app).
  const ref=JSON.parse(readFileSync(root+'app/src/engine/vendor/kb_ref.json')),bytes=readFileSync(root+'app/public/'+ref.file);
  globalThis.fetch=async url=>{assert.equal(String(url),'/'+ref.file);return new Response(bytes,{headers:{'content-type':'application/json'}});};
  await (await server.ssrLoadModule('/src/engine/index.js')).loadKb();globalThis.fetch=original;
  await run(await server.ssrLoadModule('/src/data/dosaClient.ts'),await server.ssrLoadModule('/src/data/dosaTopics.ts'),await server.ssrLoadModule('/src/data/conversationContext.ts'),
  await server.ssrLoadModule('/src/data/analysisGroups.ts'),await server.ssrLoadModule('/src/data/saju.ts'));}finally{globalThis.fetch=original;await server.close();}
}
test('the app: the 관계 topic shows the reading first and its question last, answers it locally and keeps it out of free answers',async()=>withConsumers(async(client,topics,ctx,groups,saju)=>{
 const c=chart(1980,4,11,4,'F'),report=buildReport(c,chartToKeys(c),{aliases:{},index:{},bodies:{}}),r=report.sections.find(s=>s.id==='relation-reading').relation;
 const lines=topics.topicLines(report,'관계').map(l=>l.text);
 assert.equal(lines[0],r.interpretation);assert.ok(lines.includes(r.question.prompt));
 assert.deepEqual(client.readingFollowups(report,topics.topicLines(report,'관계')),[r.question.prompt,r.footer]);
 assert.deepEqual(client.readingNotices(report,topics.topicLines(report,'관계')).slice(0,r.lines.length),r.lines);
 // The other topics keep their own readings.
 for(const key of ['성격','직업'])assert.ok(!topics.topicLines(report,key).some(l=>l.text===r.question.prompt||l.text===r.interpretation));
 assert.ok(!client.readingNotices(report,topics.topicLines(report,'성격')).includes(r.interpretation));
 // The same chart as 남명 reads another star (the gender is a condition of this topic only).
 const m=chart(1980,4,11,4,'M'),mReport=buildReport(m,chartToKeys(m),{aliases:{},index:{},bodies:{}});
 assert.notEqual(topics.topicLines(mReport,'관계')[0].text,lines[0]);
 assert.deepEqual(topics.topicLines(mReport,'성격').map(l=>l.text),topics.topicLines(report,'성격').map(l=>l.text));
 let calls=0,reply='공급자 답변이에요.';globalThis.fetch=async()=>{calls++;return Response.json({text:reply});};
 const visible=[{role:'assistant',text:r.interpretation},{role:'assistant',text:r.question.prompt},...bubbles(r.footer).map(text=>({role:'assistant',text}))];
 const ask=(question,topic='관계',extra={})=>client.requestDosaText({topic:'관계',report,lines:topics.topicLines(report,'관계'),chefId:'noona',model:'sonnet',question,
  conversation:ctx.recentConversation(visible,topic),feedbackMessages:[...visible],...extra});
 const first=await ask('아니요');assert.match(first,/낮춰요/);assert.ok(first.endsWith(r.followup.prompt));assert.equal(calls,0);
 visible.push({role:'user',text:'아니요'},...bubbles(first).map(text=>({role:'assistant',text})));
 const second=await ask('네');assert.match(second,/다정함이 오가는 쪽으로 고쳐 읽어요/);assert.equal(calls,0);
 assert.ok((await ask('그게 무슨 뜻이에요?')).endsWith('공급자 답변이에요.'));assert.equal(calls,1);
 assert.ok((await ask('네','성격')).endsWith('공급자 답변이에요.'));assert.equal(calls,2); // another topic: provider
 const unknown=await ask('아니요','관계',{hourUnknown:true});assert.doesNotMatch(unknown,/공급자 답변|낮춰요/);assert.equal(calls,2);
 // A free answer is grounded on the reading but never re-attaches or re-asks the topic question.
 let sent=null;globalThis.fetch=async(_,init)=>{calls++;sent=JSON.parse(init.body);return Response.json({text:reply});};
 reply=`설명을 이어 갈게요.\n\n${r.question.prompt}`;
 const answered=await ask('그건 왜 그런가요?');assert.ok(!answered.includes(r.question.prompt));assert.ok(!answered.includes(r.footer));assert.match(answered,/설명을 이어 갈게요/);
 assert.ok(sent.grounds.some(g=>g.text===r.interpretation));assert.ok(!sent.grounds.some(g=>g.text===r.question.prompt||g.text===r.footer));
 // The topic reading request keeps the reading and its question around a generated text.
 reply='공급자 풀이예요.';
 const reading=await client.requestDosaText({topic:'관계',report,lines:topics.topicLines(report,'관계'),chefId:'noona',model:'sonnet'});
 assert.ok(reading.startsWith(r.interpretation));assert.ok(reading.endsWith(`${r.question.prompt}\n\n${r.footer}`));assert.ok(reading.includes('공급자 풀이예요.'));
 // The analysis card goes to 관계와 인연, with the reading's own blocks.
 const card=saju.toReading({year:1980,month:4,day:11,hour:4,minute:0,gender:'F',solarTimeCorrection:false,lateZiRule:'keepDay'}).cards.find(x=>x.id==='relation-reading');
 assert.ok(card);assert.equal(card.blocks.length,3);
 const rel=groups.buildTopicGroups({headline:'',unseYear:'',dialogue:[],cards:[{id:'hapchung',title:'끌리고 부딪히는 작용',blocks:[]},card]}).find(g=>g.id==='rel');
 assert.deepEqual(rel.cards.map(x=>x.id),['hapchung','relation-reading']);
}));
