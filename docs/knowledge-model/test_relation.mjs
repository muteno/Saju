// PR236: the 관계 topic reads the spouse star (여명 관성, 남명 재성) by its place and polarity (relationCandidates.js) and
// revises it from one answer (relationFeedback.js). Expected values are written here from the rules in
// CONDITIONAL_RELATION_READING.md — the source's places (고급2 401·407), warmth (401), combination (고급1 314·315,
// 고급2 406·407), the bridged 월간 편관 (중급1 105·110, 고급1 315), hidden stems (고급2 404) and the app's mode table —
// with an independent element/polarity rule, not copied from the engine's tables or wording. The temperament and work
// readings are checked apart (test_temperament.mjs, `measure_work_feedback_scope.mjs layer <prev main> strict`).
// 원문95 (READING_BUNDLE_EVAL.md): a woman whose temperament reading is ‘peer-blocked’ (비겁 pattern, 신강, 관성 in the
// day branch) reads that same 일지 관성 — her spouse star — as checking her direction (중급1 104 예시2, 106), so the two
// topics never read one character with opposite qualities; the temperament reading is the oracle of that condition.
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
function expected([y,m,d,h],gender,c){
 const me=d[0],want=gender==='F'?'관성':'재성',main=gz=>HID[gz[1]].at(-1);
 // Cross-topic: the 일지 관성 that blocks the strong 비겁 mind in the 성격 reading is the 여명's spouse star.
 if(gender==='F'&&kind(me,main(d))==='관성'&&c&&buildTemperamentReading(c).mode==='peer-blocked')return'near-checked';
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
 // 중급1 106 (219~224): 인월 甲 비견격 신강 여명, 일지 申 편관 — one body (인연) without harmony (정), and the husband
 // star blocking the strong mind (가로막아 방해): the 성격 reading of the same chart is ‘peer-blocked’ (원문95).
 const r106=buildRelationReading(sym('壬子','甲寅','甲申','丙寅','F'));
 assert.equal(buildTemperamentReading(sym('壬子','甲寅','甲申','丙寅','F')).mode,'peer-blocked');
 assert.equal(r106.mode,'near-checked');assert.deepEqual(r106.stars.facing.map(s=>[s.placeName,s.character,s.god]),[['일지','庚','편관']]);
 assert.deepEqual(r106.candidates.filter(c=>c.status==='superseded').map(c=>c.id),['near-firm']);
 assert.deepEqual([r106.checked.god,r106.checked.warm,r106.checked.pattern,r106.checked.temperamentMode],['편관',false,'비견','peer-blocked']);
 assert.match(r106.interpretation,/제동/);assert.match(r106.interpretation,/서로의 기준이 앞서는/);
 assert.ok(r106.palaceClash.includes('인신충'));assert.equal(r106.features.bridged,0); // recorded, not used
 assert.equal(mode('壬子','甲寅','甲申','丙寅','M'),'hidden'); // the same chart as 남명: 戊 only as a hidden stem
 // 104 예시2 (121~124·175~178): the same with 시간 戊 — 여명 checked; 남명 reads its 재성 (178: for a man it is work).
 assert.equal(mode('壬子','甲寅','甲申','戊辰','F'),'near-checked');assert.equal(mode('壬子','甲寅','甲申','戊辰','M'),'near-firm');
 // 104 예시1: 일지 午 상관 (the mind's 식상) — no 관성 beside the day master to check it; not strong — the generic reading.
 assert.notEqual(mode('壬子','甲寅','甲午','戊辰','F'),'near-checked');assert.equal(mode('庚申','甲寅','甲申','庚午','F'),'near-firm');
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
 // 고급1 315 (344~347): 丁亥 여명 (壬 정관과 명암합); 丙 여명 월간 癸 정관 (합은 아님). The source names no pattern or
 // strength for 丁亥: a 寅월 정인 pattern keeps the combination; the earlier test chart (丙寅 month: 丙 겁재 pattern,
 // 신강) is also the 성격 ‘부딪힘’ chart, so the check comes first and the combination is its next question (원문95).
 assert.equal(mode('甲寅','壬寅','丁亥','甲辰','F'),'near-bonded');
 const both=buildRelationReading(sym('甲寅','丙寅','丁亥','甲辰','F'));assert.equal(both.mode,'near-checked');
 assert.deepEqual(both.candidates.filter(c=>c.status==='superseded').map(c=>c.id),['near-bonded','near-warm']);assert.equal(both.followup.candidate,'near-bonded');
 // 고급1 315 (347~349): 丙 여명 일지 子 정관 — 인연·정 있으나 지향점이 달라 갈등: with the strong 비겁 pattern, checked and warm.
 const p349=buildRelationReading(sym('丙寅','甲午','丙子','丙申','F'));assert.deepEqual([p349.mode,p349.checked.warm,p349.followup.candidate],['near-checked',true,'near-warm']);
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
 const seen={F:new Set(),M:new Set()};let n=0,checked=0,checkedBonded=0;
 for(const d of GANJI)for(const m of GANJI)for(const y of ['甲子','丁卯','庚午','辛酉','壬戌'])for(const h of ['乙亥','戊申','癸丑'])for(const g of ['F','M']){
  const c=sym(y,m,d,h,g),r=buildRelationReading(c);n++;
  assert.equal(r.mode,expected([y,m,d,h],g,c),`${y}·${m}·${d}·${h} ${g}`);
  assert.equal(r.selectedIds.length,1);seen[g].add(r.mode);
  const generic=r.candidates.filter(c=>!c.specific&&c.condition.value===1);assert.equal(generic.length,1);
  const superseded=r.candidates.filter(c=>c.status==='superseded').map(c=>c.id);
  // The checked reading supersedes every other reading that holds (its generic one, and a combination with it).
  if(r.mode==='near-checked'){checked++;assert.ok(generic[0].id.startsWith('near-'));
   assert.deepEqual(superseded,r.candidates.filter(c=>c.id!=='near-checked'&&c.condition.value===1).map(c=>c.id));
   if(superseded.includes('near-bonded'))checkedBonded++;}
  else if(r.mode==='near-bonded')assert.deepEqual(superseded,['near-warm']);
  else if(r.mode==='near-bridged')assert.deepEqual(superseded,['near-firm']);
  else assert.deepEqual(superseded,[]);
  assert.equal(r.probability,null);assert.equal(r.trainingEligible,false);assert.equal(r.beforeFeedback,true);
 }
 assert.equal(n,108000);assert.ok(checked>0&&checkedBonded>0);
 assert.deepEqual([...seen.F].sort(),['absent','far','hidden','near-bonded','near-bridged','near-checked','near-firm','near-mixed','near-warm']);
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

test('cross-topic (원문95): the 성격 ‘부딪힘’ and the 관계 reading of the same 일지 관성 agree; men and other charts keep theirs',()=>{
 // 1975-02-02 02시 (乙丑·丁丑·己卯·甲... 己卯 day, 丑월 비견, 신강): 성격 blocked by 일지 卯 乙 편관 → 관계 checked by the same star.
 const f=chart(1975,2,2,2,'F'),m=chart(1975,2,2,2,'M'),t=buildTemperamentReading(f),r=buildRelationReading(f);
 assert.equal(t.mode,'peer-blocked');assert.equal(r.mode,'near-checked');assert.equal(r.checked.character,t.dayMain.character);
 assert.match(r.reason,/성격 풀이의 ‘부딪힘’과 같은 조건/);assert.match(r.facts,/월지 바탕은 비견이고, 원국 강약은 앱의 잠정 기준으로 신강이에요/);
 assert.doesNotMatch(r.lines.join(' '),/사이가 나쁘다는 뜻이 아니에요\. 다정한/); // the near-firm reassurance is gone
 assert.equal(buildTemperamentReading(m).mode,'peer-blocked');assert.equal(buildRelationReading(m).mode,'hidden'); // 남명: 관성 is not the spouse star
 // The same day at 14시 is not blocked (the 식신 pattern shows at the hour): the generic reading stays.
 assert.notEqual(buildTemperamentReading(chart(1975,2,2,14,'F')).mode,'peer-blocked');assert.equal(buildRelationReading(chart(1975,2,2,14,'F')).mode,'near-firm');
 // 정관 in the day branch keeps its warmth beside the check; a combining 정관 is superseded with it (an explicit precedence).
 const warm=buildRelationReading(sym('丙寅','甲午','丙子','丙申','F'));assert.equal(warm.mode,'near-checked');assert.equal(warm.checked.warm,true);
 assert.match(warm.interpretation,/다정한 마음은 오갈 수 있어요/);assert.equal(warm.followup.candidate,'near-warm');
 const bonded=buildRelationReading(sym('丁卯','丁未','丁亥','丙午','F'));assert.equal(bonded.mode,'near-checked');
 assert.deepEqual(bonded.candidates.filter(c=>c.status==='superseded').map(c=>c.id),['near-bonded','near-warm']);assert.match(bonded.facts,/명암합/);
 for(const x of [r,warm,bonded])assert.doesNotMatch(x.lines.join(' '),/이혼|파경|재혼|바람|문란|배우자 덕|해로|남편덕/);
});

const find=(mode,g,warm)=>{for(const d of GANJI)for(const m of GANJI){const c=sym('辛酉',m,d,'戊申',g);
 if(expected(['辛酉',m,d,'戊申'],g,c)===mode&&(warm===undefined||buildRelationReading(c).checked?.warm===warm))return c;}throw new Error(mode);};
const MODES={'near-checked':'F','near-bonded':'F','near-bridged':'F','near-warm':'F','near-firm':'M','near-mixed':'F',far:'M',hidden:'F',absent:'M'};
test('answers: kept, lowered, switched, narrowed, scoped or withheld by the mode; the complementary question once; one clarification',()=>{
 const followed=['near-checked','near-bonded','near-bridged','near-warm','near-firm','near-mixed'],reversible=['near-warm','near-firm','near-mixed'];
 // The checked reading asks the warmth of its own day-branch star next: 정관 → 다정함, 편관 → 기준 (both are run).
 // A checked reading whose star combines asks the combination next (one of the warm finds is checked for it below).
 const cases=[...Object.entries(MODES).map(([mode,g])=>[mode,g,find(mode,g)]),['near-checked','F',find('near-checked','F',true)],['near-checked','F',find('near-checked','F',false)],
  ['near-checked','F',sym('甲寅','丙寅','丁亥','甲辰','F')]];
 assert.deepEqual(cases.filter(([m])=>m==='near-checked').map(([,,c])=>buildRelationReading(c).followup.candidate).filter((x,i,a)=>a.indexOf(x)===i).sort(),['near-bonded','near-firm','near-warm']);
 for(const [mode,g,c] of cases){
  const first=answer=>session(c).say(answer),d=buildRelationReading(c);assert.equal(d.mode,mode);
  const opposite={'near-warm':'near-firm','near-firm':'near-warm','near-mixed':'near-firm','near-bonded':'near-warm','near-bridged':'near-firm',
   'near-checked':d.followup?.candidate};
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
    // The checked reading switches to the reading its next question named (정관 → 다정함, 편관 → 기준, 합 → 묶음).
    if(mode==='near-checked')assert.match(step.revisedInterpretation,reply==='네'
     ?{'near-warm':/제동으로 읽힌다는 가정을 낮추고, 음양이 조화되는 별로 다정함이 오가는 쪽으로/,'near-firm':/제동으로 읽힌다는 가정을 낮추고, 기준이 먼저 서는 쪽으로/,
       'near-bonded':/제동으로 읽힌다는 가정을 낮추고, 곁에서 합하는 별로 묶어 꾸려 가는 쪽으로/}[d.followup.candidate]
     :{'near-warm':/부딪히지도, 다정한 표현이 자연스럽게 오가지도 않는다/,'near-firm':/부딪히지도, 각자의 원칙과 기준을 먼저 세우지도 않는다/,
       'near-bonded':/부딪히지도, 마음을 묶어 함께 꾸려 가지도 않는다/}[d.followup.candidate]);
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
  const engine=await server.ssrLoadModule('/src/engine/index.js');await engine.loadKb();globalThis.fetch=original;
  await run(await server.ssrLoadModule('/src/data/dosaClient.ts'),await server.ssrLoadModule('/src/data/dosaTopics.ts'),await server.ssrLoadModule('/src/data/conversationContext.ts'),
  await server.ssrLoadModule('/src/data/analysisGroups.ts'),await server.ssrLoadModule('/src/data/saju.ts'),engine);}finally{globalThis.fetch=original;await server.close();}
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
test('the app (원문95): day-pillar draft items addressed to the other gender are left out of the chat and the card',async()=>withConsumers(async(client,topics,ctx,groups,saju,engine)=>{
 const input=(gender,y=1985,m=9,d=7,h=2)=>({year:y,month:m,day:d,hour:h,minute:0,gender,solarTimeCorrection:false,lateZiRule:'keepDay'});
 const male=/^\s*(?:남명|남자|남성)\s*[:：]/u,female=/^\s*(?:여명|여자|여성)\s*[:：]/u;
 const items=lines=>lines.flatMap(l=>l.text.split(/\n{2,}/));
 // 기유 (1985-09-07 02시) carries both 남명 and 여명 items in its 관계 draft; each gender's card reads its own only.
 // (원문96 moved the 관계 draft out of the chat, so the chat filter is read on 임오's 직업 draft, the one 여자-only item.)
 assert.equal(topics.topicLines(engine.buildReading(input('F')),'관계')[0].text,buildRelationReading(chart(1985,9,7,2,'F')).interpretation);
 const card=g=>saju.toReading(input(g)).cards.find(c=>c.id==='ilju').blocks.find(b=>b.label==='관계').lines;
 assert.ok(!card('F').some(t=>male.test(t))&&card('F').some(t=>female.test(t)));assert.ok(!card('M').some(t=>female.test(t))&&card('M').some(t=>male.test(t)));
 const work=g=>items(topics.topicLines(engine.buildReading(input(g,1990,1,17,10)),'직업'));
 assert.ok(work('F').some(t=>female.test(t)));assert.ok(!work('M').some(t=>female.test(t)||male.test(t)));
 // The checked reading leads the 관계 chat of 1975-02-02 02시 여명 and its question ends it.
 const report=engine.buildReading(input('F',1975,2,2,2)),r=report.sections.find(s=>s.id==='relation-reading').relation,lines=topics.topicLines(report,'관계').map(l=>l.text);
 assert.equal(r.mode,'near-checked');assert.equal(lines[0],r.interpretation);assert.deepEqual(client.readingFollowups(report,topics.topicLines(report,'관계')),[r.question.prompt,r.footer]);
}));
test('the app (원문96): with the topic\'s own chart reading, the 성격·관계 chat leaves the day-pillar draft to the analysis card',async()=>withConsumers(async(client,topics,ctx,groups,saju,engine)=>{
 // The draft is read from the KB bundle itself (not from the app's projection), so a withheld or reworded copy also counts.
 const ref=JSON.parse(readFileSync(root+'app/src/engine/vendor/kb_ref.json')),kb=JSON.parse(readFileSync(root+'app/public/'+ref.file));
 const unit=k=>{const u=kb.distilled[k];return(Array.isArray(u)?u[0]:u)?.distilled??{};};
 const NOTICES=['남은 일주 설명은','갑인 서술은 원문과 대조했지만','조건·시기·출처를 검토한 일부 문장은','현침살 관련 문장은'];
 const POINTER='분석 탭의 ‘일주 이야기’ 카드에 따로 두었어요.';
 const input=(y,m,d,h,gender)=>({year:y,month:m,day:d,hour:h,minute:0,gender,solarTimeCorrection:false,lateZiRule:'keepDay'});
 // The bundle's hand-picked charts (READING_BUNDLE_EVAL.md h1~h8) with 임오 and a 갑인 남명.
 const charts=[[1980,2,11,4,'F'],[1980,2,11,4,'M'],[1980,4,11,4,'F'],[1985,9,7,2,'F'],[1985,9,7,2,'M'],[1985,11,6,2,'F'],[1975,2,2,2,'F'],[1975,2,2,14,'F'],[1990,1,17,10,'F'],[1976,12,25,8,'M']];
 let held=0;
 for(const c of charts){
  const report=engine.buildReading(input(...c)),block=report.sections.find(s=>s.id==='ilju').block,pillar=block.key,dd=unit(pillar);
  const card=saju.toReading(input(...c)).cards.find(x=>x.id==='ilju');
  for(const [topic,fields] of [['성격',['핵심','성격']],['관계',['관계']]]){
   const lines=topics.topicLines(report,topic).map(l=>l.text),draft=fields.flatMap(f=>[dd[f]??[]].flat()).filter(Boolean);
   // No draft item and none of the draft's review notices in the chat lines; the reading leads.
   for(const item of draft)assert.ok(!lines.some(l=>l.includes(item)),`${pillar} ${topic}: ${item.slice(0,30)}`);
   assert.ok(!lines.some(l=>NOTICES.some(n=>l.startsWith(n))),`${pillar} ${topic} notices`);
   const reading=report.sections.find(s=>s.id===(topic==='성격'?'temperament-reading':'relation-reading'))[topic==='성격'?'temperament':'relation'];
   assert.equal(lines[0],reading.interpretation);
   assert.deepEqual(client.readingFollowups(report,topics.topicLines(report,topic)),[reading.question.prompt,reading.footer]);
   // The pointer ends the chat lines only when the card shows that draft (갑인's is withheld by the review policy).
   const inCard=fields.some(f=>card?.blocks.some(b=>b.label===f&&b.lines.length));
   assert.equal(lines.filter(l=>l.endsWith(POINTER)).length,inCard?1:0,`${pillar} ${topic} pointer`);
   if(inCard){assert.ok(lines.at(-1).endsWith(POINTER));assert.ok(client.readingNotices(report,topics.topicLines(report,topic)).some(n=>n.endsWith(POINTER)));held++;}
  }
  // The card keeps the draft (this gender's items) with its review notice; 직업·주의 chats keep theirs as before.
  assert.ok(card.note.includes(block.basicReview.unreviewedNotice));
  for(const topic of ['직업','주의']){
   const lines=topics.topicLines(report,topic).map(l=>l.text);
   assert.ok(!lines.some(l=>l.endsWith(POINTER)));assert.ok(lines.some(l=>NOTICES.some(n=>l.startsWith(n))),`${pillar} ${topic} keeps the notice`);
  }
 }
 assert.equal(held,(charts.length-3)*2); // all but the three 갑인 charts (h1·h2·h3)
 // A report without the topic reading (an older engine) still speaks the draft with its notice, and no pointer.
 const report=engine.buildReading(input(1976,12,25,8,'M')),old={...report,sections:report.sections.filter(s=>s.id!=='relation-reading'&&s.id!=='temperament-reading')};
 for(const [topic,field] of [['성격','성격'],['관계','관계']]){
  const lines=topics.topicLines(old,topic).map(l=>l.text);
  assert.ok(unit('ilju/신해')[field].some(item=>lines.some(l=>l.includes(item))));assert.ok(lines.at(-1).startsWith('남은 일주 설명은'));assert.ok(!lines.some(l=>l.endsWith(POINTER)));
 }
 // The provider is not given the draft as grounds either (r5 관계: ‘집요하게 집착’ against ‘속에 머묾’).
 let sent=null;globalThis.fetch=async(_,init)=>{sent=JSON.parse(init.body);return Response.json({text:'공급자 풀이예요.'});};
 const text=await client.requestDosaText({topic:'관계',report,lines:topics.topicLines(report,'관계'),chefId:'noona',model:'sonnet'});
 assert.ok(!sent.grounds.some(g=>/집요하게 집착/.test(g.text)));assert.ok(sent.grounds.some(g=>g.text.endsWith(POINTER)));
 assert.ok(text.includes('공급자 풀이예요.'));assert.ok(text.includes(POINTER));assert.doesNotMatch(text,/집요하게 집착/);
 // An unknown birth time keeps its single notice.
 assert.deepEqual(topics.topicLines(report,'관계',true).map(l=>l.text).filter(l=>l.endsWith(POINTER)),[]);
}));
