// PR234: the time of an experience answer compared with the 대운 periods read apart from the chart (PR233). Expected
// values are written here from the rules in CONDITIONAL_WORK_READING.md (경험의 시기와 대운 대조) — the told age/year,
// the one-year margins and the verdict per period status — not copied from the engine's wording. The period statuses
// themselves are checked independently in test_daeun_timing.mjs; the natal decisions by
// `measure_work_feedback_scope.mjs layer <prev main> strict`.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {buildContextReading} from '../../dosa-app/engine/src/contextReading.js';
import {computeChart} from '../../dosa-app/engine/src/manseryeok.js';
import {resolveWorkFeedback,feedbackPlan,ownedFeedbackPrompts,readFeedbackAnswer} from '../../dosa-app/engine/src/workFeedback.js';
import {leadingTimes,placeSpan,timingPlan,compareTiming,TIMING_SINGLE,TIMING_SPLIT} from '../../dosa-app/engine/src/timingFeedback.js';
const {terms}=JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
const chart=(y,m,d,hour,gender='F')=>computeChart({year:y,month:m,day:d,hour,minute:0,gender,solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
const shownWork=r=>[r.decision,r.rootingDecision,r.branchDecision].find(d=>d?.active)??null;
const MENU='또 궁금한 것이 있는가?';
// The chat splits a reply into bubbles of at most two sentences per paragraph.
const bubbles=text=>text.split(/\n{2,}/).flatMap(p=>{const s=p.trim().split(/(?<=[.?!…])\s+/).filter(Boolean),o=[];for(let i=0;i<s.length;i+=2)o.push(s.slice(i,i+2).join(' '));return o;});
function session(c,asOfYear=null){
 const r=buildContextReading(c),decision=shownWork(r),footer=r.blocks.at(-1).lines.at(-1);
 const messages=[{role:'assistant',text:decision.question.prompt},...bubbles(footer).map(text=>({role:'assistant',text}))];
 return{r,decision,messages,say(answer){const step=resolveWorkFeedback({decision,timing:r.daeunTiming,asOfYear,footer,messages,answer,menuPrompts:[MENU]});
  if(step)messages.push({role:'user',text:answer},...bubbles(step.text).map(text=>({role:'assistant',text})));return step;}};
}

test('times told in an answer: ages, years, decades and ranges are read; durations and relative times are not placed',()=>{
 const read=t=>{const x=leadingTimes(t);return[x.spans.map(s=>[s.unit,s.from,s.to]),x.relative.length,x.rest];};
 for(const[text,spans,rest]of[
  ['25살 무렵엔 도움이 됐',[['age',25,25]],'도움이 됐'],
  ['만 25세 때 도움이 됐어요',[['age',25,25]],'도움이 됐어요'],
  ['스물다섯 살 때요',[['age',25,25]],'요'],
  ['서른 살 때부터 도움',[['age',30,30]],'도움'],
  ['20대 후반엔 도움이 됐',[['age',26,29]],'도움이 됐'],
  ['30대 초반이요',[['age',30,34]],'이요'],
  ['삼십대 중반에',[['age',33,37]],''],
  ['25~28살 때는',[['age',25,28]],''],
  ['2005년쯤 도움이 됐어요',[['year',2005,2005]],'도움이 됐어요'],
  ['2005년쯤이었어요',[['year',2005,2005]],'이었어요'],
  ['2003~2005년에는',[['year',2003,2005]],''],
  ['2003년부터 2005년까지 도움이 됐어요',[['year',2003,2005]],'도움이 됐어요'],
  ['1990년대 후반에',[['year',1996,1999]],''],
  ['25살이랑 33살 때요',[['age',25,25],['age',33,33]],'요'],
 ])assert.deepEqual(read(text),[spans,0,rest],text);
 // Durations, a word that starts like a decade, and relative times give no placeable span.
 for(const text of['10년 동안 도움이 됐어요','10년 넘게 도움이 됐어요','20대표가 도움이 됐어요','도움이 25살에 됐어요'])assert.deepEqual(read(text)[0],[],text);
 for(const text of['10년쯤 전에 도움이 됐어요','요즘엔 도움이 돼요','첫 직장 때요','예전엔 도움이 됐어요'])assert.deepEqual(read(text).slice(0,2),[[],1],text);
 // Without a 대운 layer a time at the start of a clause stays unread (the earlier reading is kept).
 assert.equal(readFeedbackAnswer('25살 무렵엔 도움이 됐어요','duty').kind,'clarify:unclear');
 assert.equal(readFeedbackAnswer('25살 무렵엔 도움이 됐어요','duty',null,{timed:true}).kind,'supported');
 const mixed=readFeedbackAnswer('25살 무렵엔 도움이 됐고 40살 무렵엔 아니었어요','duty',null,{timed:true});
 assert.equal(mixed.kind,'mixed');assert.deepEqual(mixed.segments.map(s=>[s.tag,s.spans.map(x=>x.from)]),[['support',[25]],['contradict',[40]]]);
});

test('placement: a told time is one period only when every possible year is inside it, one year off each change',()=>{
 // Independent rule: a told age N is any year from b+N−1 (세는 나이) to b+N+1 (만 나이 before the birthday);
 // a period that the app shows from year b+a_k is certain from b+a_k+1 to b+a_{k+1}−2.
 const expect=(ages,b,span,asOf)=>{
  const[y0,y1]=span.unit==='age'?[b+span.from-1,b+span.to+1]:[span.from,span.to];
  if(y0<b)return'unplaced';if(asOf!==null&&y0>asOf)return'future';
  const of=y=>{if(y<=b+ages[0]-2)return'B';for(let k=0;k<ages.length;k++){const lo=b+ages[k]+1,hi=b+(k<ages.length-1?ages[k+1]:ages[k]+10)-2;if(y>=lo&&y<=hi)return k;}return'X';};
  const seen=new Set();for(let y=y0;y<=y1;y++)seen.add(of(y));
  if(seen.size===1&&seen.has('B'))return'before-first';if(seen.size===1&&typeof [...seen][0]==='number')return`p${[...seen][0]}`;
  return y0>=b+ages.at(-1)+10?'unplaced':'boundary';
 };
 let n=0;const kinds={};
 for(const su of[1,2,5,9,10])for(const b of[1960,1987]){
  const ages=Array.from({length:10},(_,i)=>su+i*10),periods=ages.map((age,i)=>({order:i+1,age,startYear:b+age,ganji:'甲子'}));
  for(const asOf of[null,b+40])for(const span of[
   ...Array.from({length:70},(_,N)=>({unit:'age',from:N,to:N,text:'x'})),
   ...Array.from({length:70},(_,i)=>({unit:'year',from:b-2+i,to:b-2+i,text:'x'})),
   ...[[20,23],[23,27],[26,29],[30,34],[25,28]].map(([f,t])=>({unit:'age',from:f,to:t,text:'x'})),
   ...[[b+20,b+22],[b+31,b+38]].map(([f,t])=>({unit:'year',from:f,to:t,text:'x'})),
  ]){const got=placeSpan(periods,span,asOf),key=got.place==='period'?`p${got.period.order-1}`:got.place;
   assert.equal(key,expect(ages,b,span,asOf),`su${su} b${b} ${span.unit} ${span.from}-${span.to} asOf${asOf}`);n++;kinds[got.place]=(kinds[got.place]??0)+1;}
 }
 assert.ok(n>1400);for(const k of['period','boundary','before-first','future','unplaced'])assert.ok(kinds[k]>0,k);
 // A two-digit year is the year inside the life.
 const periods=[1,11,21,31,41,51,61,71,81,91].map((age,i)=>({order:i+1,age,startYear:1985+age,ganji:'甲子'}));
 assert.equal(placeSpan(periods,{unit:'year',from:8,to:8,short:true,text:'08년'}).period.order,3);
 assert.equal(placeSpan(periods,leadingTimes('90년대 초반').spans[0]).period.order,1);
 assert.equal(placeSpan(periods,leadingTimes('90년대 후반').spans[0]).place,'boundary'); // 1996~1999 touches the 11세 change
});

test('every day master and both directions: the verdict at a told age follows the period status and the told side',()=>{
 // Verdicts written from the rules: a rootless stem is explained only by a clean root whose principal is the other
 // group's environment; a root under 충 by a relieving 합 or a clean new root there; lowered or open periods are not used.
 const LOWERED=['root-shaken','root-tilted','root-unknown','relieve-unknown'];
 const verdict=(rule,status,envLink,side)=>{
  const explains=rule==='rootless'?status==='root'&&envLink:status==='root'||status==='relieve';
  if(explains)return side==='support'?'matched':'weakened';
  if(LOWERED.includes(status))return'not-adopted';
  return side==='support'?'unexplained':'consistent';
 };
 const synthetic=(month,forward,su)=>({su,forward,list:Array.from({length:10},(_,i)=>{const g=((month+(forward?i+1:-(i+1)))%60+60)%60;
  return{age:su+i*10,name:'갑을병정무기경신임계'[g%10]+'자축인묘진사오미신유술해'[g%12]};})});
 const seen={};let charts=0;
 for(let k=0;k<10;k++){const day=k*7%60;
  for(let year=0;year<60;year+=4)for(let month=0;month<60;month+=5)for(const hour of[0,2,4,6,8,10]){
   const pillarsIdx={year,month,day,hour},r=buildContextReading({input:{hour:12,minute:0},pillarsIdx,daeun:synthetic(month,(year+hour)%2===0,1+(year+month+hour)%10)});
   const w=shownWork(r),plan=timingPlan(w,r.daeunTiming);
   if(!r.daeunTiming?.active){assert.equal(plan,null);continue;}
   charts++;assert.equal(feedbackPlan(w,r.daeunTiming).timing.rule,plan.rule);
   for(const p of plan.periods)for(const side of['support','contradict']){
    const cmp=compareTiming(plan,[{polarity:side,spans:[{unit:'age',from:p.age+5,to:p.age+5,text:`${p.age+5}살`}],relative:[]}]);
    const want=verdict(plan.rule,p.status,p.envLink,side);assert.equal(cmp.record[0].verdict,want,`${p.status} ${side}`);
    seen[`${plan.rule}:${want}`]=(seen[`${plan.rule}:${want}`]??0)+1;
    assert.equal(cmp.placed,true);assert.equal(Object.keys(cmp.feedback).length,['matched','weakened'].includes(want)?1:0);
    for(const line of cmp.lines)assert.ok(!/확률|반드시|성공한다|적중했|맞혔/.test(line),line);
   }
   // The explaining periods are the ones the rule names, and only those make the time question worth asking.
   assert.deepEqual(plan.explains,plan.periods.filter(p=>verdict(plan.rule,p.status,p.envLink,'support')==='matched').map(p=>p.order));
  }}
 assert.ok(charts>500,`${charts}`);
 for(const rule of['rootless','clashed'])for(const v of['matched','weakened','not-adopted','unexplained','consistent'])assert.ok(seen[`${rule}:${v}`]>0,`${rule}:${v}`);
});

test('the same chart with the other 대운 direction: the same answer and the same time revise differently',()=>{
 // 1985-09-07 02시 乙丑·甲申·己酉·乙丑 (season-surface, 관성 甲·乙 without roots): F's 21세 丁亥 brings a root whose
 // principal 壬 is 재성 (the asked environment); M's periods do not until 91세 乙亥.
 const f=session(chart(1985,9,7,2,'F'),2026),m=session(chart(1985,9,7,2,'M'),2026);
 for(const key of['decision','rootingDecision','branchDecision','experienceQuestions'])assert.deepEqual(f.r[key],m.r[key],key);
 const fa=f.say('맞아요'),ma=m.say('맞아요');
 assert.equal(fa.after,'weakened');assert.equal(ma.after,'weakened');assert.equal(fa.revisedInterpretation,ma.revisedInterpretation);
 assert.equal(fa.nextQuestion.prompt,TIMING_SINGLE);assert.equal(fa.timing.status,'asked');
 assert.equal(ma.nextQuestion,null);assert.equal(ma.timing.status,'no-period');assert.match(ma.text,/지금까지 시작한 대운 가운데/);
 const ft=f.say('28살 무렵이요');assert.equal(ft.timing.record[0].verdict,'matched');assert.equal(ft.feedback['daeun-3'],'matched-as-self-report');
 assert.match(ft.text,/21세\(2006년\) 丁亥 대운 안/);assert.equal(m.say('28살 무렵이요'),null); // nothing pending: chat
 // Without today's year the 91세 period still counts, so M is asked and the same time is not explained.
 const m2=session(chart(1985,9,7,2,'M'));assert.equal(m2.say('맞아요').nextQuestion.prompt,TIMING_SINGLE);
 const mt=m2.say('28살 무렵이요');assert.equal(mt.timing.record[0].verdict,'unexplained');assert.match(mt.text,/21세\(2006년\) 壬午 대운 안/);
 assert.notEqual(ft.text,mt.text);
 // 1976-07-09 02시 (shaken-link): 'at some times' asks when, once; the split answer reads 24 and 33 apart.
 const g=session(chart(1976,7,9,2,'F'),2026),h=session(chart(1976,7,9,2,'M'),2026);
 for(const s of[g,h]){const c=s.say('도움이 된 때도 있고 아닌 때도 있었어요');assert.equal(c.action,'clarify');assert.ok(c.text.endsWith(TIMING_SPLIT));}
 const answer='24살 무렵엔 아니었는데 33살 무렵엔 도움이 됐어요',gs=g.say(answer),hs=h.say(answer);
 assert.equal(gs.after,'retained-as-self-report');assert.equal(gs.revisedInterpretation,hs.revisedInterpretation);
 // F: 24 in 21세 壬辰 (no relief) and 33 in 31세 辛卯 (卯未·卯戌 relieve); M: 24 in 20세 丁酉, 33 in 30세 戊戌 (root under 辰戌충).
 assert.deepEqual(gs.timing.record.map(x=>[x.period,x.verdict]),[[3,'consistent'],[4,'matched']]);
 assert.deepEqual(hs.timing.record.map(x=>[x.period,x.verdict]),[[2,'consistent'],[3,'not-adopted']]);
 assert.match(gs.text,/가르는 조건을 원국이 아니라 대운에서 찾은 후보/);assert.doesNotMatch(hs.text,/대운에서 찾은 후보/);
 // The natal decision and the 대운 layer are inputs only; probabilities stay null.
 for(const s of[fa,ft,gs,hs]){assert.equal(s.probability,null);assert.equal(s.trainingEligible,false);}
 assert.deepEqual(fa.beforeFeedback.timing.candidates,f.r.daeunTiming.candidates);
});

test('asked once: unknown, relative, boundary and future times stop; time in the first answer is compared at once',()=>{
 const F=()=>session(chart(1985,9,7,2,'F'),2026);
 const stop=(answer,pattern)=>{const s=F();s.say('맞아요');const t=s.say(answer);assert.equal(t.nextQuestion,null,answer);assert.equal(t.state.pending,null);
  assert.match(t.text,pattern,answer);assert.equal(t.timing.status,'unknown');assert.equal(s.say('2008년이요'),null);};
 stop('몰라요',/같은 질문은 다시 묻지 않아요/);
 stop('첫 직장 때요',/나이나 연도로 정할 수 없어[\s\S]*같은 질문은 다시 묻지 않아요/);
 stop('30대 초반이요',/바뀌는 무렵에 걸쳐 어느 대운인지 정하지 않아요[\s\S]*같은 질문은 다시 묻지 않아요/);
 stop('2030년이요',/아직 오지 않은 때/);
 // A question or an unrelated yes goes to chat.
 {const s=F();s.say('맞아요');assert.equal(s.say('대운이 뭐예요?'),null);}
 {const s=F();s.say('맞아요');assert.equal(s.say('네'),null);}
 // Time in the first answer: compared at once, nothing asked.
 {const s=F(),t=s.say('28살 무렵에 도움이 됐어요');assert.equal(t.nextQuestion,null);assert.equal(t.timing.record[0].verdict,'matched');}
 // A boundary time in the first answer: said why, then asked once for an age or a year.
 {const s=F(),t=s.say('30대 초반에 도움이 됐어요');assert.equal(t.nextQuestion.prompt,TIMING_SINGLE);assert.match(t.text,/정하지 않아요/);
  const u=s.say('2008년이요');assert.equal(u.timing.record[0].verdict,'matched');}
 // A contradicted answer agrees with a rootless chart: nothing is asked, a told time is still compared.
 {const s=F(),t=s.say('반대예요');assert.equal(t.nextQuestion,null);assert.equal(t.timing,undefined);}
 {const s=F(),t=s.say('28살 땐 도움이 안 됐어요');assert.equal(t.timing.record[0].verdict,'weakened');assert.equal(t.feedback['daeun-3'],'weakened');}
 // After 'at some times' asked when, an answer without times is revised and not asked again.
 {const s=F();s.say('도움이 된 때도 있고 아닌 때도 있었어요');const t=s.say('처음에는 도움이 됐는데 나중에는 도움이 안 됐어요');
  assert.equal(t.after,'scoped');assert.equal(t.nextQuestion,null);assert.match(t.text,/언제였는지는 듣지 못해/);}
 // The owned time prompts are stripped from provider replies.
 const r=buildContextReading(chart(1985,9,7,2,'F'));assert.deepEqual(ownedFeedbackPrompts(shownWork(r),r.daeunTiming).slice(-2),[TIMING_SINGLE,TIMING_SPLIT]);
});

test('scope: without the 대운 layer nothing changes, and other readings ignore it',()=>{
 // The earlier rooting tests' charts, with and without the layer passed: the same replies where no layer applies.
 for(const date of[[1980,1,2,16],[1975,1,1,2],[1965,1,10,18],[1965,1,10,16],[1965,5,23,2],[1965,6,4,4]]){
  const r=buildContextReading(chart(...date)),d=shownWork(r);
  assert.equal(timingPlan(d,r.daeunTiming),null,String(date));
  for(const a of['맞아요','반대예요','경험이 없어요','처음에는 도움이 됐는데 나중에는 도움이 안 됐어요']){
   const args={decision:d,footer:'',messages:[{role:'assistant',text:d.question.prompt}],answer:a};
   assert.deepEqual(resolveWorkFeedback({...args,timing:r.daeunTiming,asOfYear:2026}),resolveWorkFeedback(args),`${date} ${a}`);}
 }
 // A chart with the layer but called without it (older callers) keeps the PR233 replies.
 const r=buildContextReading(chart(1985,9,7,2,'F')),d=shownWork(r);
 const old=resolveWorkFeedback({decision:d,footer:'',messages:[{role:'assistant',text:d.question.prompt}],answer:'맞아요'});
 assert.equal(old.nextQuestion,null);assert.match(old.text,/운의 시기는 아직 이 비교에 합치지 않았어요/);assert.equal(old.timing,undefined);
 // Stem–stem decisions (갑목 1980-02-11) never take the layer.
 const g=buildContextReading(chart(1980,2,11,4));assert.equal(g.daeunTiming,null);assert.equal(timingPlan(g.decision,g.daeunTiming),null);
 // A provider reply between the time question and the answer leaves the answer to chat.
 const s=session(chart(1985,9,7,2,'F'),2026);s.say('맞아요');s.messages.push({role:'assistant',text:'(공급자) 다른 이야기'});assert.equal(s.say('28살 무렵이요'),null);
 // The menu line may sit between the time question and its answer.
 const t=session(chart(1985,9,7,2,'F'),2026);t.say('맞아요');t.messages.push({role:'assistant',text:MENU});assert.equal(t.say('28살 무렵이요').timing.record[0].verdict,'matched');
 // Unknown birth time: no reading, nothing to compare.
 const c=chart(1985,9,7,2);assert.equal(buildContextReading({...c,input:{...c.input,hourUnknown:true}}),null);
});
