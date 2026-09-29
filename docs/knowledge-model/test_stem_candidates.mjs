// PR230: the stem resource/authority comparison for every day master.
// Expected ten gods and modes are computed here from element/polarity rules, not from the engine.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {buildContextReading} from '../../dosa-app/engine/src/contextReading.js';
import {computeChart} from '../../dosa-app/engine/src/manseryeok.js';
import {readFeedbackAnswer,resolveWorkFeedback} from '../../dosa-app/engine/src/workFeedback.js';
import {WORK_CANDIDATE_LIMIT} from '../../dosa-app/engine/src/workCandidates.js';
const {terms}=JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
const cases=JSON.parse(readFileSync(new URL('./data/work_feedback_cases.json',import.meta.url)));
const chart=(y,m,d,hour)=>computeChart({year:y,month:m,day:d,hour,minute:0,gender:'F',solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
const mock=pillarsIdx=>({input:{hour:12,minute:0},pillarsIdx});
const STEMS='甲乙丙丁戊己庚辛壬癸',BRANCHES='子丑寅卯辰巳午未申酉戌亥';
const NAMES=['갑목','을목','병화','정화','무토','기토','경금','신금','임수','계수'];
const pillar=i=>STEMS[i%10]+BRANCHES[i%12];
// Independent ten-god rule: element = floor(stem/2), yang = even stem; controls = element + 2 (mod 5).
function god(day,other){const de=Math.floor(day/2),oe=Math.floor(other/2),same=day%2===other%2;
 if(oe===(de+2)%5)return same?'편재':'정재';if(oe===(de+3)%5)return same?'편관':'정관';if(oe===(de+1)%5)return same?'식신':'상관';
 if(oe===de)return same?'비견':'겁재';return same?'편인':'정인';}
const COMBINE=new Set(['0,5','1,6','2,7','3,8','4,9']); // 甲己 乙庚 丙辛 丁壬 戊癸
function expectedMode(p){
 const day=p.day%10,jia=day===0,others=[['year',p.year%10],['month',p.month%10],['hour',p.hour%10]],gods=others.map(([,s])=>god(day,s)),has=g=>gods.includes(g);
 const wealth=has('편재')||has('정재'),officer=has('정관'),killing=has('편관'),food=has('식신');
 // 편관 combined with another natal stem (any distance): its partner and the position of the 편관.
 const combos=[];for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){const[a,b]=[others[i][1],others[j][1]];
  if(!COMBINE.has([Math.min(a,b),Math.max(a,b)].join()))continue;
  if(gods[i]==='편관')combos.push({at:others[i][0],partner:gods[j]});if(gods[j]==='편관')combos.push({at:others[j][0],partner:gods[i]});}
 // Only 甲 with the 편관 outside the month stem keeps the 1035 response; every other combination is unknown.
 const combo=!combos.length?0:jia&&combos.every(c=>c.at!=='month')?1:null;
 const duty=wealth&&officer,demandCond=wealth&&killing,response=demandCond&&food,peerResp=demandCond&&combo===1;
 const counter=food||combo===1?1:combo===null?null:0;
 const demand=demandCond&&counter===0,withheld=demandCond&&(counter===null||combo===null);
 const selected=[duty&&'resource-duty',demand&&'resource-demand',response&&'food-response',peerResp&&'peer-response'].filter(Boolean);
 return{selected,withheld,combo,combos,surface:wealth&&(officer||killing)};
}
const ACTIVE=new Set(['resource-duty','resource-demand','food-response','peer-response','competing']);

test('every day master: ten gods, 편관 combinations and the selected candidates follow the independent rules',()=>{
 let n=0;const seen={},stems=new Set(),partners={yang:new Set(),yin:new Set()};
 for(let k=0;k<10;k++){const day=k*7%60;stems.add(day%10); // 甲子 辛未 戊寅 乙酉 壬辰 己亥 丙午 癸丑 庚申 丁卯
  for(let year=0;year<60;year++)for(let month=0;month<60;month+=3)for(const hour of[0,1,2,3,4,5,6,7,8,9]){
   const p={year,month,day,hour},r=buildContextReading(mock(p)),d=r.decision,e=expectedMode(p),jia=day%10===0,at=`${pillar(year)} ${pillar(month)} ${pillar(day)} ${pillar(hour)}`;n++;
   for(const c of e.combos)partners[day%2?'yin':'yang'].add(c.partner);
   assert.equal(d.features[jia?'peerKillingCombination':'killingCombination'],e.combo,at);
   assert.ok(!Object.hasOwn(d.features,jia?'killingCombination':'peerKillingCombination'));
   assert.deepEqual(d.selectedIds,e.selected,at);
   if(e.selected.length===1)assert.equal(d.mode,e.selected[0]);else if(e.selected.length>1)assert.equal(d.mode,'competing');
   else if(d.mode!=='outside-bundle')assert.equal(d.mode,e.withheld?'condition-withheld':'scope-withheld',at);
   if(e.surface)assert.notEqual(d.mode,'outside-bundle',at); // stems alone already show both groups
   assert.equal(d.active,ACTIVE.has(d.mode));
   assert.equal(d.policy,jia?'jia-stem-resource-authority-v1':'stem-resource-authority-v1');
   const lines=r.blocks[2].lines;
   if(!d.active){assert.equal(d.question,null);assert.deepEqual(d.lines,[]);assert.equal(r.experienceQuestions.length,3);
    for(const line of lines)assert.ok(!line.includes('해석 가설이에요. 참고 자료의 예시는'));}
   else{assert.equal(r.experienceQuestions.length,1);assert.deepEqual(lines.slice(0,d.lines.length),d.lines);
    assert.equal(d.lines.at(-1),jia?WORK_CANDIDATE_LIMIT:`${NAMES[day%10]} 일간의 천간 글자만 비교한 해석 가설이에요. 참고 자료의 예시는 갑목·병화 일간 몇 개뿐이라, 다른 일간에는 같은 십성 관계를 넓혀 적용했어요. 이 비교에는 지장간·강약·합의 실제 작용과 운의 시기를 넣지 않았고, 직업 적성·성공·개인 사건을 정하지 않아요.`);
    // The month/hour roles the strength line points back to stay on screen.
    assert.ok(lines[d.lines.length].includes('의 조합에서는'),at);assert.ok(lines.includes(r.strength.hypothesis));}
   assert.equal(d.probability,null);assert.equal(d.trainingEligible,false);
   assert.equal(d.features[jia?'jiaDay':'stemScope'],1);
   seen[d.mode]=(seen[d.mode]??0)+1;
  }}
 assert.equal(stems.size,10);assert.ok(n>=120000);
 // The 편관 partner is fixed by polarity: 겁재 for yang day masters, 상관 for yin ones.
 assert.deepEqual([...partners.yang],['겁재']);assert.deepEqual([...partners.yin],['상관']);
 for(const m of['resource-duty','resource-demand','food-response','peer-response','competing','scope-withheld','condition-withheld','outside-bundle'])assert.ok(seen[m]>0,m);
});

test('same 丙寅 day: food, hurting officer, 비견 and the unresolved 겁재·편관 combination read differently',()=>{
 const at=h=>chart(1970,6,15,h),mode=h=>buildContextReading(at(h)).decision;
 assert.deepEqual([0,2,16,18].map(h=>pillar(at(h).pillarsIdx.hour)),['戊子','己丑','丙申','丁酉']);
 assert.deepEqual([pillar(at(0).pillarsIdx.year),pillar(at(0).pillarsIdx.month),pillar(at(0).pillarsIdx.day)],['庚戌','壬午','丙寅']);
 assert.equal(mode(0).mode,'food-response');assert.equal(mode(2).mode,'resource-demand');assert.equal(mode(16).mode,'resource-demand');
 assert.match(mode(2).reason,/식신만 대응 조건으로 보므로, 천간의 상관\(시간 己\)은 넣지 않았어요/);
 assert.match(mode(0).facts,/시간 戊\(식신\)예요\.$/); // 무 ends in a vowel
 // 丁丙壬庚 is the source's own 丙 example (1175~1177): 편관 in the month stem 'pursues' the 겁재.
 const w=mode(18);assert.equal(w.mode,'condition-withheld');assert.equal(w.features.killingCombination,null);assert.equal(w.active,false);
 assert.equal(w.candidates.find(c=>c.id==='peer-response').status,'withheld');assert.equal(w.candidates.find(c=>c.id==='resource-demand').status,'withheld');
 // The withheld comparison keeps the existing month/hour synthesis and questions.
 const r=buildContextReading(at(18));assert.equal(r.experienceQuestions.length,3);assert.ok(r.blocks[2].lines.some(l=>l.startsWith('식상과 재성이 겉에서 함께 보여')));
 assert.match(mode(0).lines.at(-1),/^병화 일간의 천간 글자만 비교한 해석 가설이에요\. 참고 자료의 예시는 갑목·병화 일간 몇 개뿐이라/);
 assert.equal(mode(0).policy,'stem-resource-authority-v1');
});

test('yin day masters: 겁재 and 편관 never combine, but a 상관·편관 combination is withheld like the yang one',()=>{
 const yang=buildContextReading(chart(1970,6,15,18)).decision,yin=buildContextReading(chart(1965,1,7,4)).decision;
 const gods=d=>d.facts.match(/\((.+?)\)/g).map(x=>x.slice(1,-1)).map(g=>g.replace('정재','재성').replace('편재','재성')).sort();
 assert.deepEqual(gods(yang),gods(yin)); // 재성·편관·겁재 on both
 assert.equal(STEMS[chart(1965,1,7,4).pillarsIdx.day%10],'辛');
 assert.equal(yang.mode,'condition-withheld');assert.equal(yin.mode,'resource-demand');assert.equal(yin.features.killingCombination,0);
 assert.match(yin.lines.at(-1),/^신금 일간/);assert.match(yin.reason,/편관과 합을 이루는 천간도 없어요/);
 const c=chart(1950,1,8,4),hap=buildContextReading(c);
 assert.deepEqual(['year','month','day','hour'].map(k=>pillar(c.pillarsIdx[k])),['己丑','丁丑','癸卯','甲寅']); // 甲(상관)·己(편관) combine
 assert.equal(hap.decision.mode,'condition-withheld');assert.equal(hap.decision.features.killingCombination,null);
 assert.equal(hap.decision.active,false);assert.equal(hap.experienceQuestions.length,3);
});

test('甲 keeps PR227 wording; only a 편관 in the month stem withholds the 겁재 response, and withheld 甲 keeps the existing reading',()=>{
 const food=buildContextReading(chart(1980,2,11,4)).decision;
 assert.equal(food.mode,'food-response');assert.equal(food.lines.at(-1),WORK_CANDIDATE_LIMIT);assert.equal(food.policy,'jia-stem-resource-authority-v1');
 assert.ok(!Object.hasOwn(food.features,'stemScope'));
 const source=buildContextReading(mock({year:6,month:5,day:0,hour:1})).decision; // 乙甲己庚 (1033~1035): 편관 in the year stem
 assert.equal(source.mode,'peer-response');assert.equal(source.features.peerKillingCombination,1);
 const month=buildContextReading(mock({year:4,month:6,day:0,hour:1})).decision; // 乙甲庚戊: 편관 in the month stem, as in 1175
 assert.equal(month.mode,'condition-withheld');assert.equal(month.features.peerKillingCombination,null);assert.equal(month.active,false);
 const hidden=buildContextReading(mock({year:8,month:14,day:50,hour:2}));
 assert.equal(hidden.decision.mode,'scope-withheld');assert.equal(hidden.decision.active,false);assert.equal(hidden.decision.question,null);
 assert.equal(hidden.experienceQuestions.length,3);assert.ok(!hidden.blocks[2].lines.some(l=>l.startsWith('재성·관성 주제는 원국에 있지만')));
 assert.match(hidden.decision.interpretation,/천간끼리의 관계로 설명하는 후보는 보류/); // kept for the record, not shown
});

test('feedback revision works the same way outside 甲 and follows the chart condition',()=>{
 const reply=(h,answer)=>{const r=buildContextReading(chart(1970,6,15,h)),d=r.decision,footer=r.blocks.at(-1).lines.at(-1);
  return resolveWorkFeedback({decision:d,footer,messages:[{role:'assistant',text:d.question.prompt}],answer});};
 const food=reply(0,'반대예요'),demand=reply(2,'반대예요');
 assert.equal(food.targetCandidateId,'food-response');assert.equal(food.nextQuestion.id,'work-candidate-resource-demand');
 assert.equal(food.beforeFeedback.policy,'stem-resource-authority-v1');assert.equal(food.beforeFeedback.scope,'day-stem-natal-stems');
 assert.equal(demand.targetCandidateId,'resource-demand');assert.equal(demand.nextQuestion,null);assert.match(demand.revisedInterpretation,/설명하지 못해요/);
 const yin=buildContextReading(chart(1965,1,7,4)).decision;
 assert.equal(resolveWorkFeedback({decision:yin,footer:'',messages:[{role:'assistant',text:yin.question.prompt}],answer:'네, 일이 많이 늘었어요'}).after,'retained-as-self-report');
 assert.equal(buildContextReading(chart(1970,6,15,18)).decision.question,null); // withheld: nothing to revise
 // Duty question (乙 1970-01-05 08시): help credited only to other people is not a yes to it.
 const duty=buildContextReading(chart(1970,1,5,8)).decision;assert.equal(duty.mode,'resource-duty');
 const p=cases.pr230_duty_other_means;
 for(const[answer,expected]of p.rows)assert.equal(readFeedbackAnswer(answer,'duty')?.kind??null,expected,answer);
 const r=resolveWorkFeedback({decision:duty,footer:'',messages:[{role:'assistant',text:duty.question.prompt}],answer:p.rows[0][0]});
 assert.equal(r.action,'clarify');
});
