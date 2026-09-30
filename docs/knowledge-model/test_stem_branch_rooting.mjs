// PR231: stem–branch rooting comparison for charts with 재성 or 관성 in the stems on one side only.
// Expected values come from the reference's rooting table (2080~2085), the principal (本氣) table and the
// relation pairs written out here — not from the engine tables or the implementation's wording.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {buildContextReading} from '../../dosa-app/engine/src/contextReading.js';
import {computeChart} from '../../dosa-app/engine/src/manseryeok.js';
import {HIDDEN_STEMS} from '../../dosa-app/engine/src/tables.js';
import {resolveWorkFeedback,feedbackPlan} from '../../dosa-app/engine/src/workFeedback.js';
import {ROOTING_QUESTIONS,ROOTING_LIMIT} from '../../dosa-app/engine/src/rootingCandidates.js';
const {terms}=JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
const chart=(y,m,d,hour)=>computeChart({year:y,month:m,day:d,hour,minute:0,gender:'F',solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
const mock=pillarsIdx=>({input:{hour:12,minute:0},pillarsIdx});
const STEMS='甲乙丙丁戊己庚辛壬癸',BRANCHES='子丑寅卯辰巳午未申酉戌亥',POS=['year','month','day','hour'];
const pillar=i=>STEMS[i%10]+BRANCHES[i%12];
const ix=s=>[...s].map(c=>BRANCHES.indexOf(c));
// 2080~2085 "천간이 통근하는 지지" by element (木火土金水).
const ROOT=[ix('寅卯辰亥未'),ix('巳午未寅戌'),ix('辰戌丑未寅申巳亥午'),ix('申酉戌巳丑'),ix('亥子丑申辰')];
// 사공 month table (FOUNDATION_MONTH_PERIODS.md): full hidden stems and the principal (정기) of each branch.
const HID={子:'壬癸',丑:'癸辛己',寅:'戊丙甲',卯:'甲乙',辰:'乙癸戊',巳:'戊庚丙',午:'丙己丁',未:'丁乙己',申:'戊壬庚',酉:'庚辛',戌:'辛丁戊',亥:'戊甲壬'};
const hid=b=>[...HID[BRANCHES[b]]].map(c=>STEMS.indexOf(c));
const el=s=>Math.floor(s/2);
const group=(day,s)=>{const r=(el(s)-el(day)+5)%5;return r===2?'재성':r===3?'관성':null;};
const CHUNG=[[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]],YUKHAP=[[0,1],[2,11],[3,10],[4,9],[5,8],[6,7]];
const SAMHAP=[[8,0,4],[5,9,1],[2,6,10],[11,3,7]],BANGHAP=[[2,3,4],[5,6,7],[8,9,10],[11,0,1]],FAMILY=[[2,5,8],[1,10,7]];
// Root state: 2114~2118 (충), 2235 (사신형), 2188 (natal 합 keeps the root); anything else unknown.
function state(bs,q){const b=bs[q],others=bs.filter((_,i)=>i!==q),has=x=>others.includes(x);
 if((b===5&&bs.includes(8))||(b===8&&bs.includes(5)))return 1;
 const chung=CHUNG.some(([x,y])=>(b===x&&has(y))||(b===y&&has(x)));
 const hap=YUKHAP.some(([x,y])=>(b===x&&has(y))||(b===y&&has(x)))
  ||SAMHAP.some(t=>t.includes(b)&&(t.every(x=>bs.includes(x))||(b===t[1]?has(t[0])||has(t[2]):bs.includes(t[1]))))
  ||BANGHAP.some(t=>t.includes(b)&&t.every(x=>bs.includes(x)));
 const hyeong=FAMILY.some(f=>f.includes(b)&&f.some(x=>x!==b&&has(x)))||(b===0&&has(3))||(b===3&&has(0))||([4,6,9,11].includes(b)&&has(b));
 if(chung&&hap)return null;if(chung)return 1;if(hyeong)return null;return 0;}
function expected(p){
 const day=p.day%10,bs=POS.map(q=>p[q]%12),stems=['year','month','hour'].map(q=>({q,s:p[q]%10,g:group(day,p[q]%10)}));
 const anywhere=g=>stems.some(x=>x.g===g)||bs.some(b=>hid(b).some(s=>group(day,s)===g));
 const w=stems.filter(x=>x.g==='재성'),a=stems.filter(x=>x.g==='관성');
 if(!anywhere('재성')||!anywhere('관성')||!w.length===!a.length)return null;
 const side=w.length?'wealth':'authority',S=side==='wealth'?w:a,B=side==='wealth'?'관성':'재성';
 const principal=b=>hid(b).at(-1),envs=bs.map((b,i)=>i).filter(i=>group(day,principal(bs[i]))===B);
 const roots=S.flatMap(x=>bs.map((b,i)=>({i,b})).filter(r=>ROOT[el(x.s)].includes(r.b)));
 const links=roots.filter(r=>group(day,principal(r.b))===B),states=links.map(r=>state(bs,r.i));
 const usable=states.includes(0)?1:states.includes(null)?null:0;
 const mode=!envs.length?'hidden-only':links.length?(usable===1?'grounded-link':usable===0?'shaken-link':'link-withheld')
  :roots.length?'separate-roots':'surface-only';
 return {side,mode,features:{[`${side}StemOnly`]:1,otherPrincipal:+!!envs.length,stemRooted:+!!roots.length,rootedInOther:+!!links.length,linkUsable:links.length?usable:0}};
}
const ACTIVE=new Set(['grounded-link','shaken-link','separate-roots','surface-only']);

test('the engine hidden-stem table equals the reference rooting table (2080~2085) and the month table',()=>{
 for(let b=0;b<12;b++){assert.deepEqual(HIDDEN_STEMS[b],hid(b),BRANCHES[b]);
  for(let e=0;e<5;e++)assert.equal(hid(b).some(s=>el(s)===e),ROOT[e].includes(b),`${BRANCHES[b]} ${e}`);}
 // 乙–戌·丁–丑 (P012-04): no wood in 戌, no fire in 丑.
 assert.ok(!ROOT[0].includes(10));assert.ok(!ROOT[1].includes(1));
});

test('every day master: side, features and mode follow the independent rooting rules',()=>{
 const seen={},sides=new Set();let n=0,one=0;
 for(let k=0;k<10;k++){const day=k*7%60;
  for(let year=0;year<60;year++)for(let month=0;month<60;month+=3)for(const hour of[0,1,2,3,4,5,6,7,8,9,10,11]){
   const p={year,month,day,hour},r=buildContextReading(mock(p)),rd=r.rootingDecision,e=expected(p),at=POS.map(q=>pillar(p[q])).join(' ');n++;
   if(!e){assert.equal(rd,null,at);continue;}
   one++;sides.add(e.side);seen[`${e.side}:${e.mode}`]=(seen[`${e.side}:${e.mode}`]??0)+1;
   assert.equal(r.decision.mode,'scope-withheld',at); // one side only: the stem–stem comparison cannot apply
   assert.equal(rd.side,e.side,at);assert.equal(rd.mode,e.mode,at);assert.deepEqual(rd.features,e.features,at);
   for(const root of rd.roots)assert.deepEqual(root.places.map(x=>x.position),POS.filter(q=>ROOT[el(root.stem)].includes(p[q]%12)),at);
   assert.equal(rd.active,ACTIVE.has(e.mode),at);assert.ok(rd.selectedIds.length<=1);
   assert.equal(rd.probability,null);assert.equal(rd.trainingEligible,false);
   const lines=r.blocks[2].lines;
   if(rd.active){
    assert.deepEqual(rd.question.prompt,ROOTING_QUESTIONS[e.side]);assert.deepEqual(r.experienceQuestions,[rd.question]);
    assert.deepEqual(lines.slice(0,rd.lines.length),rd.lines);assert.equal(rd.lines.at(-1),ROOTING_LIMIT);
    assert.ok(lines[rd.lines.length].includes('의 조합에서는'),at); // the month/hour roles stay
    assert.ok(lines.includes(r.strength.hypothesis));
    // The F04 capacity sentence (재관을 받아들이고 … 감당) is not used, and nothing is promised.
    for(const line of rd.lines)assert.ok(!/감당|받아들일 수|확률/.test(line),line);
   }else{
    assert.equal(rd.question,null);assert.deepEqual(rd.lines,[]);
    // A withheld rooting comparison may hand over to the branch season comparison (PR232); otherwise nothing changes.
    if(r.branchDecision?.active)assert.deepEqual(r.experienceQuestions,[r.branchDecision.question]);else assert.equal(r.experienceQuestions.length,3);
    assert.ok(!lines.includes(ROOTING_LIMIT));
   }
  }}
 assert.ok(n>=140000);assert.ok(one>40000);assert.deepEqual([...sides].sort(),['authority','wealth']);
 for(const side of['wealth','authority'])for(const m of['grounded-link','shaken-link','separate-roots','surface-only','link-withheld','hidden-only'])
  assert.ok(seen[`${side}:${m}`]>0,`${side}:${m}`);
});

test('same 甲戌 day: 관성 only in 戌\'s 辛 is withheld, 관성 as the 申 principal rooting 己 reads a link',()=>{
 const at=h=>buildContextReading(chart(1980,1,2,h));
 const [a,b]=[at(8),at(16)];
 assert.deepEqual(POS.map(q=>pillar(chart(1980,1,2,8).pillarsIdx[q])),['己未','丙子','甲戌','戊辰']);
 assert.deepEqual(POS.map(q=>pillar(chart(1980,1,2,16).pillarsIdx[q])),['己未','丙子','甲戌','壬申']);
 assert.equal(a.decision.mode,'scope-withheld');assert.equal(b.decision.mode,'scope-withheld'); // same before
 assert.equal(a.rootingDecision.mode,'hidden-only'); // PR232: 戌's season body (가을) carries 관성; see test_branch_season.mjs
 assert.equal(a.branchDecision.mode,'season-shaken');assert.deepEqual(a.experienceQuestions,[a.branchDecision.question]);
 assert.match(a.rootingDecision.reason,/체용론/);
 assert.equal(b.rootingDecision.mode,'grounded-link');assert.deepEqual(b.experienceQuestions,[b.rootingDecision.question]);
 const link=b.rootingDecision.roots[0].places.find(x=>x.link);
 assert.deepEqual([link.position,link.branchCharacter,link.principal.tenGod,link.state.value],['hour','申','편관',0]);
 assert.match(b.blocks[2].lines[0],/시지 申의 기준·책임 환경에 뿌리/);
});

test('conditions flip the reading: 충 and 사신형 weaken the link, other 형 and 충 with 합 stay unknown, roots elsewhere or none',()=>{
 const rd=(y,m,d,h)=>buildContextReading(chart(y,m,d,h)).rootingDecision;
 const cases=[ // real adult dates; the expected mode is re-derived below from the independent rules
  [[1975,3,10,16],'wealth','grounded-link'],[[1975,1,3,22],'authority','grounded-link'],
  [[1975,1,6,14],'wealth','shaken-link'],[[1975,1,8,14],'authority','shaken-link'],[[1975,2,7,10],'wealth','shaken-link'],
  [[1975,1,6,20],'wealth','link-withheld'],[[1975,2,7,0],'wealth','link-withheld'],
  [[1975,1,1,2],'wealth','separate-roots'],[[1975,1,2,4],'authority','separate-roots'],
  [[1975,1,1,0],'wealth','surface-only'],[[1975,2,20,4],'authority','surface-only'],
  [[1975,1,6,0],'wealth','hidden-only'],[[1975,1,10,8],'authority','hidden-only']];
 for(const[[y,m,d,h],side,mode]of cases){const r=rd(y,m,d,h),e=expected(chart(y,m,d,h).pillarsIdx);
  assert.deepEqual([r.side,r.mode],[side,mode],`${y}-${m}-${d} ${h}`);assert.deepEqual([e.side,e.mode],[side,mode]);}
 const bases=r=>[...new Set(r.roots.flatMap(x=>x.places.filter(p=>p.link).map(p=>p.state.basis)))];
 assert.deepEqual(bases(rd(1975,1,6,14)),['chung']);assert.deepEqual(bases(rd(1975,2,7,10)),['sasin-hyeong']);
 assert.deepEqual(bases(rd(1975,1,6,20)),['other-hyeong']);assert.deepEqual(bases(rd(1975,2,7,0)),['chung-with-hap']);
 assert.match(rd(1975,1,6,14).reason,/충을 받으면 그 뿌리를 제대로 쓰기 어렵고/);assert.match(rd(1975,2,7,10).reason,/사신형.*예시를 따라/);
 assert.match(rd(1975,1,1,2).reason,/뿌리로 이어지지 않아요/);assert.match(rd(1975,1,1,0).reason,/뿌리를 두지 못했어요/);
});

test('F04 release conditions: exceptions, same stem vs element, distance, table version, unknown birth time',()=>{
 // 甲戌 丙子 己巳 乙酉: 관성 甲·乙 with 戌 but no wood (乙–戌). 癸卯 辛丑 辛丑 丁酉: 관성 丁 with 丑 but no fire (丁–丑).
 for(const p of[{year:10,month:12,day:5,hour:21},{year:39,month:37,day:37,hour:33}]){
  const r=buildContextReading(mock(p)).rootingDecision,bs=POS.map(q=>BRANCHES[p[q]%12]);
  assert.ok(bs.includes('戌')||bs.includes('丑'));assert.equal(r.side,'authority');assert.equal(r.mode,'surface-only');
  for(const root of r.roots)assert.deepEqual(root.places,[],root.character);}
 // Same stem (투출) is recorded but does not change the decision; distance is not weighed.
 const g=buildContextReading(chart(1975,3,10,16)).rootingDecision,place=g.roots[0].places[0];
 assert.equal(g.roots[0].position,'month');assert.equal(place.position,'hour');assert.equal(typeof place.sameStem,'boolean');
 // 인원용사 (year/day/hour): only 亥's 戊 changes an element, so only an earth stem rooted in a non-month 亥 is 'lost'.
 const personnel={0:[9],3:[1],6:[5,3],9:[7],11:[0,8]};
 for(let k=0;k<10;k++)for(let year=0;year<60;year+=7)for(let month=0;month<60;month+=5)for(const hour of[0,3,11]){
  const r=buildContextReading(mock({year,month,day:k*7%60,hour}))?.rootingDecision;if(!r)continue;
  for(const root of r.roots)for(const x of root.places){
   const lost=x.position!=='month'&&personnel[x.branch]&&!personnel[x.branch].some(s=>el(s)===el(root.stem));
   assert.equal(x.otherTable,lost?'lost':'kept');if(lost)assert.deepEqual([el(root.stem),x.branch],[2,11]);}}
 // Unknown birth time: nothing is computed.
 const c=chart(1980,1,2,16);
 for(const bad of[{...c,birthTime:{status:'unknown'}},{...c,input:{...c.input,hourUnknown:true}}])assert.equal(buildContextReading(bad),null);
 // Two-side charts keep the stem comparison and have no rooting decision.
 assert.equal(buildContextReading(chart(1980,2,11,4)).rootingDecision,null);
});

test('the same answer revises differently by condition: a link reading keeps a yes, a separate reading lowers it',()=>{
 const reply=(date,answer)=>{const r=buildContextReading(chart(...date)),d=r.rootingDecision;
  return resolveWorkFeedback({decision:d,footer:'',messages:[{role:'assistant',text:d.question.prompt}],answer});};
 const grounded=[1980,1,2,16],shaken=[1975,1,6,14],separate=[1975,1,1,2],surface=[1975,1,1,0];
 const after=(date,answer)=>reply(date,answer).after;
 assert.deepEqual(['맞아요','반대예요','경험이 없어요'].map(a=>after(grounded,a)),['retained-as-self-report','weakened','withheld']);
 assert.deepEqual(['맞아요','반대예요','경험이 없어요'].map(a=>after(separate,a)),['weakened','retained-as-self-report','withheld']);
 assert.deepEqual(['맞아요','반대예요'].map(a=>after(surface,a)),['weakened','retained-as-self-report']);
 assert.deepEqual(['맞아요','반대예요'].map(a=>after(shaken,a)),['retained-as-self-report','retained-as-self-report']);
 const mixed='처음에는 도움이 됐는데 나중에는 도움이 안 됐어요';
 assert.equal(reply(grounded,mixed).after,'scoped');assert.equal(reply(separate,mixed).after,'scoped');
 assert.match(reply(grounded,mixed).text,/도움이 된 쪽에서는 .*유지하고, 그렇지 않았던 쪽에서는 낮춰요/);
 assert.match(reply(separate,mixed).text,/도움이 된 쪽에서는 .*낮추고, 그렇지 않았던 쪽에서는 유지해요/);
 assert.match(reply(shaken,mixed).revisedInterpretation,/흔들린다는 풀이와 같은 방향/);
 assert.match(reply(grounded,'반대예요').revisedInterpretation,/근거로 나온다.*낮춰요/);
 assert.match(reply(separate,'맞아요').revisedInterpretation,/이 비교로는 그 연결을 설명하지 못해요/);
 for(const date of[grounded,separate]){const r=reply(date,'반대예요');
  assert.equal(r.beforeFeedback.policy,'stem-branch-rooting-v1');assert.equal(r.nextQuestion,null);
  assert.equal(r.probability,null);assert.equal(r.trainingEligible,false);}
 // Withheld rooting modes ask nothing, so nothing is revised.
 for(const date of[[1975,1,6,20],[1980,1,2,8]])assert.equal(feedbackPlan(buildContextReading(chart(...date)).rootingDecision),null);
 // A duty-kind clarification still applies to free answers that credit only other people.
 assert.equal(reply(grounded,'팀원이랑 나눠서 해결했어요').action,'clarify');
});
