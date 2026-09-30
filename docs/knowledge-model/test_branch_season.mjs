// PR232: branch readings for charts the stem–stem (PR227/230) and stem–branch rooting (PR231) comparisons
// leave to the branches. Expected values come from the reference's own tables written out here — seasons
// (1689~1695), the storage branches' season body (1681·2624), the 삼합 frames (1053~1055), the rooting table
// (2080~2085) and the principal (本氣) table — not from the engine tables or the implementation's wording.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {buildContextReading} from '../../dosa-app/engine/src/contextReading.js';
import {computeChart} from '../../dosa-app/engine/src/manseryeok.js';
import {resolveWorkFeedback,feedbackPlan} from '../../dosa-app/engine/src/workFeedback.js';
import {ROOTING_QUESTIONS} from '../../dosa-app/engine/src/rootingCandidates.js';
import {BRANCH_SEASON_LIMIT,SEASON_ROOTING_LIMIT} from '../../dosa-app/engine/src/branchSeasonCandidates.js';
const {terms}=JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
const chart=(y,m,d,hour)=>computeChart({year:y,month:m,day:d,hour,minute:0,gender:'F',solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
const mock=pillarsIdx=>({input:{hour:12,minute:0},pillarsIdx});
const STEMS='甲乙丙丁戊己庚辛壬癸',BRANCHES='子丑寅卯辰巳午未申酉戌亥',POS=['year','month','day','hour'];
const pillar=i=>STEMS[i%10]+BRANCHES[i%12];
const idx=s=>{for(let i=0;i<60;i++)if(pillar(i)===s)return i;throw new Error(`not a pillar: ${s}`);};
const ix=s=>[...s].map(c=>BRANCHES.indexOf(c));
// 1689~1695 계절: 봄(木) 여름(火) 가을(金) 겨울(水); 1681 戌 본체 가을, 2624 丑 계절로 겨울.
const SEASONS=[ix('寅卯辰'),ix('巳午未'),ix('申酉戌'),ix('亥子丑')],SEASON_EL=[0,1,3,4];
const season=b=>SEASONS.findIndex(s=>s.includes(b));
const STORAGE=ix('辰戌丑未');
// 삼합 frames (1053~1055 申子辰 水, 2605~2607 申子 반합): members and element.
const TRIADS=[[ix('申子辰'),4],[ix('巳酉丑'),3],[ix('寅午戌'),1],[ix('亥卯未'),0]];
// 2080~2085 "천간이 통근하는 지지" by element (木火土金水).
const ROOT=[ix('寅卯辰亥未'),ix('巳午未寅戌'),ix('辰戌丑未寅申巳亥午'),ix('申酉戌巳丑'),ix('亥子丑申辰')];
// 사공 month table (FOUNDATION_MONTH_PERIODS.md): hidden stems, the last is the principal (정기).
const HID={子:'壬癸',丑:'癸辛己',寅:'戊丙甲',卯:'甲乙',辰:'乙癸戊',巳:'戊庚丙',午:'丙己丁',未:'丁乙己',申:'戊壬庚',酉:'庚辛',戌:'辛丁戊',亥:'戊甲壬'};
const hid=b=>[...HID[BRANCHES[b]]].map(c=>STEMS.indexOf(c));
const el=s=>Math.floor(s/2);
const GROUPS=['비겁','식상','재성','관성','인성'];
const groupOfEl=(day,e)=>GROUPS[(e-el(day)+5)%5];
const group=(day,s)=>groupOfEl(day,el(s));
const CHUNG=[[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]],YUKHAP=[[0,1],[2,11],[3,10],[4,9],[5,8],[6,7]];
const BANGHAP=[[2,3,4],[5,6,7],[8,9,10],[11,0,1]],FAMILY=[[2,5,8],[1,10,7]];
const SAMHAP=[[8,0,4],[5,9,1],[2,6,10],[11,3,7]];
function clashAt(bs,q){const b=bs[q],others=bs.filter((_,i)=>i!==q),has=x=>others.includes(x);
 return CHUNG.some(([x,y])=>(b===x&&has(y))||(b===y&&has(x)))||FAMILY.some(f=>f.includes(b)&&f.some(x=>x!==b&&has(x)))
  ||(b===0&&has(3))||(b===3&&has(0))||([4,6,9,11].includes(b)&&has(b));}
// Root state (PR231): 사신형/충 weaken, 충 with a natal 합 and other 형 unknown.
function state(bs,q){const b=bs[q],others=bs.filter((_,i)=>i!==q),has=x=>others.includes(x);
 if((b===5&&bs.includes(8))||(b===8&&bs.includes(5)))return 1;
 const chung=CHUNG.some(([x,y])=>(b===x&&has(y))||(b===y&&has(x)));
 const hap=YUKHAP.some(([x,y])=>(b===x&&has(y))||(b===y&&has(x)))
  ||SAMHAP.some(t=>t.includes(b)&&(t.every(x=>bs.includes(x))||(b===t[1]?has(t[0])||has(t[2]):bs.includes(t[1]))))
  ||BANGHAP.some(t=>t.includes(b)&&t.every(x=>bs.includes(x)));
 const hyeong=FAMILY.some(f=>f.includes(b)&&f.some(x=>x!==b&&has(x)))||(b===0&&has(3))||(b===3&&has(0))||([4,6,9,11].includes(b)&&has(b));
 if(chung&&hap)return null;if(chung)return 1;if(hyeong)return null;return 0;}
const env=(day,bs,g)=>bs.map((b,i)=>i).filter(i=>group(day,hid(bs[i]).at(-1))===g||(STORAGE.includes(bs[i])&&groupOfEl(day,SEASON_EL[season(bs[i])])===g));
function pairKind(day,bs,w,a){
 if(w===a||season(bs[w])===season(bs[a]))return'season';
 const t=TRIADS.find(([m])=>m.includes(bs[w])&&m.includes(bs[a]));
 if(t&&bs[w]!==bs[a]){const g=groupOfEl(day,t[1]);return g==='관성'?'triad-authority':g==='인성'?'triad-resource':'triad-wealth';}
 return'none';}
function expected(p){
 const day=p.day%10,bs=POS.map(q=>p[q]%12),stems=['year','month','hour'].map(q=>({q,s:p[q]%10,g:group(day,p[q]%10)}));
 const anywhere=g=>stems.some(x=>x.g===g)||bs.some(b=>hid(b).some(s=>group(day,s)===g));
 if(!anywhere('재성')||!anywhere('관성'))return null;
 const w=stems.filter(x=>x.g==='재성'),a=stems.filter(x=>x.g==='관성');
 if(w.length&&a.length)return null; // the stem–stem comparison's charts
 if(!w.length&&!a.length){
  const W=env(day,bs,'재성'),A=env(day,bs,'관성');
  if(!W.length||!A.length)return{scope:'both-natal-branches',side:null,mode:'hidden-only'};
  const pairs=W.flatMap(x=>A.map(y=>({w:x,a:y,kind:pairKind(day,bs,x,y)}))),dir=pairs.filter(x=>x.kind!=='none');
  const has=k=>dir.some(x=>x.kind===k),link=has('season')||has('triad-authority'),res=has('triad-resource'),wea=has('triad-wealth');
  const clear=![...new Set(dir.flatMap(x=>[x.w,x.a]))].some(q=>clashAt(bs,q));
  const features={bothBranches:1,linkDirection:+link,resourceDirection:+res,wealthDirection:+wea,directionClear:clear?1:null};
  const mode=link&&!res&&!wea?(clear?'branch-link':'direction-clash'):res&&!link&&!wea?(clear?'branch-diverted':'direction-clash')
   :!dir.length?'no-direction':wea&&!link&&!res?'direction-unset':'mixed-direction';
  return{scope:'both-natal-branches',side:null,mode,features};
 }
 const side=w.length?'wealth':'authority',S=w.length?w:a,G=w.length?'관성':'재성';
 if(bs.some(b=>group(day,hid(b).at(-1))===G))return null; // the rooting comparison reads it (PR231)
 const envs=bs.map((b,i)=>i).filter(i=>STORAGE.includes(bs[i])&&groupOfEl(day,SEASON_EL[season(bs[i])])===G);
 if(!envs.length)return{scope:'one-side-stem-season-body',side,mode:'hidden-only'};
 const roots=S.flatMap(x=>bs.map((b,i)=>i).filter(i=>ROOT[el(x.s)].includes(bs[i])));
 const links=roots.filter(i=>envs.includes(i)),states=links.map(i=>state(bs,i));
 const usable=states.includes(0)?1:states.includes(null)?null:0;
 const mode=links.length?(usable===1?'season-grounded':usable===0?'season-shaken':'season-link-withheld'):roots.length?'season-separate':'season-surface';
 return{scope:'one-side-stem-season-body',side,mode,features:{[`${side}StemOnly`]:1,otherSeason:1,stemRooted:+!!roots.length,rootedInOther:+!!links.length,linkUsable:links.length?usable:0}};
}
const ACTIVE=new Set(['branch-link','branch-diverted','season-grounded','season-shaken','season-separate','season-surface']);

test('every day master: scope, side, features and mode follow the independent season, 삼합 and rooting rules',()=>{
 const seen={};let n=0,covered=0;
 for(let k=0;k<10;k++){const day=k*7%60;
  for(let year=0;year<60;year++)for(let month=0;month<60;month+=3)for(const hour of[0,1,2,3,4,5,6,7,8,9,10,11]){
   const p={year,month,day,hour},r=buildContextReading(mock(p)),bd=r.branchDecision,e=expected(p),at=POS.map(q=>pillar(p[q])).join(' ');n++;
   if(!e){assert.equal(bd,null,at);continue;}
   covered++;const key=`${e.side??'both'}:${e.mode}`;seen[key]=(seen[key]??0)+1;
   assert.equal(r.decision.active,false,at);assert.notEqual(r.rootingDecision?.active,true,at); // earlier comparisons first, unchanged
   assert.deepEqual([bd.scope,bd.side,bd.mode],[e.scope,e.side,e.mode],at);if(e.features)assert.deepEqual(bd.features,e.features,at);
   assert.equal(bd.active,ACTIVE.has(e.mode),at);assert.ok(bd.selectedIds.length<=1);
   assert.equal(bd.policy,'branch-season-v1');assert.equal(bd.probability,null);assert.equal(bd.trainingEligible,false);
   const lines=r.blocks[2].lines;
   if(bd.active){
    assert.deepEqual(bd.question.prompt,e.side?ROOTING_QUESTIONS[e.side]:ROOTING_QUESTIONS.authority);assert.deepEqual(r.experienceQuestions,[bd.question]);
    assert.deepEqual(lines.slice(0,bd.lines.length),bd.lines);assert.equal(bd.lines.at(-1),e.side?SEASON_ROOTING_LIMIT:BRANCH_SEASON_LIMIT);
    assert.ok(lines[bd.lines.length].includes('의 조합에서는'),at); // the month/hour roles stay
    assert.ok(lines.includes(r.strength.hypothesis));
    for(const line of bd.lines)assert.ok(!/감당|받아들일 수|확률|반드시|성공한다/.test(line),line);
   }else{
    assert.equal(bd.question,null);assert.deepEqual(bd.lines,[]);assert.equal(r.experienceQuestions.length,3);
    assert.ok(!lines.includes(BRANCH_SEASON_LIMIT)&&!lines.includes(SEASON_ROOTING_LIMIT));
   }
  }}
 assert.ok(n>=140000);assert.ok(covered>40000);
 for(const m of['branch-link','branch-diverted','direction-clash','no-direction','direction-unset','mixed-direction','hidden-only'])assert.ok(seen[`both:${m}`]>0,m);
 for(const m of['season-grounded','season-shaken','season-link-withheld','hidden-only'])assert.ok(seen[`wealth:${m}`]>0,m);
 for(const m of['season-grounded','season-shaken','season-separate','season-surface','season-link-withheld','hidden-only'])assert.ok(seen[`authority:${m}`]>0,m);
});

test('the reference\'s own branch examples read as written (1053~1059, 2605~2607, 2624)',()=>{
 const P=(y,m,d,h)=>({year:idx(y),month:idx(m),day:idx(d),hour:idx(h)});
 const bd=p=>buildContextReading(mock(p)).branchDecision;
 // 1058 午戌申子 (甲): "술토는 진토보다 재생관이 수월, 같은 계절의 토" — 戌(편재) and 申(편관) in 가을; 戌 itself is 가을.
 const same=bd(P('壬子','壬申','甲戌','丙午'));
 assert.equal(same.mode,'branch-link');assert.deepEqual([...new Set(same.pairs.filter(x=>x.kind!=='none').map(x=>x.basis))].sort(),['same-branch','same-season']);
 assert.match(same.reason,/같은 가을 계절/);assert.match(same.interpretation,/비교적 수월한 구성/);
 // 1053~1055 辰申 (甲): 정기만 보면 재생살이지만 申子辰 水 = 인성 방향.
 const diverted=bd(P('丁卯','壬申','甲辰','丁卯'));
 assert.equal(diverted.mode,'branch-diverted');assert.match(diverted.reason,/申子辰 수 삼합의 두 글자이고, 그 오행은 일간에게 인성/);
 // 1057 卯辰申酉 (甲): 재생관은 판단하기 어렵고, 방향 전환은 신진반합 水 인성.
 assert.equal(bd(P('丁酉','壬申','甲辰','丁卯')).mode,'branch-diverted');
 // 1059 丑申 (乙): 판단하기 어려움; 丑 is the storage of 金 (the 관성 here) — withheld, with that reason.
 const tomb=bd(P('丁亥','丙申','乙丑','壬午'));
 assert.equal(tomb.mode,'no-direction');assert.equal(tomb.active,false);assert.match(tomb.reason,/일지 丑은 금을 거두는 고지\(묘지\)라, 운에 따라/);
 // 2605~2607 (천간을 가리고 지지만): 월지 申 정재 + 연지 子 편관, 신자반합 → 결과가 평가로. 2624: 丑 is 관성 by season.
 const yu=bd(P('甲子','丙申','丁丑','甲辰'));
 assert.equal(yu.mode,'branch-link');assert.match(yu.interpretation,/결과를 꾸준히 내면 맡는 역할이나 평가로/);
 assert.deepEqual(yu.environments.authority.map(x=>[x.position,x.branchCharacter,x.via]),[['year','子','principal'],['day','丑','season']]);
});

test('same day, different hours: the branch conditions change the reading (and the earlier decisions stay)',()=>{
 const at=(y,m,d,h)=>buildContextReading(chart(y,m,d,h));
 const pil=(y,m,d,h)=>POS.map(q=>pillar(chart(y,m,d,h).pillarsIdx[q])).join(' ');
 // 1965-01-10 甲子: 16시 辰·申 (水, 인성) diverted; 18시 丑·酉 (金, 관성) link; 20시 戌 in 가을 but 진술충·축술형 withheld.
 assert.deepEqual([16,18,20,22].map(h=>pil(1965,1,10,h)),['甲辰 丁丑 甲子 壬申','甲辰 丁丑 甲子 癸酉','甲辰 丁丑 甲子 甲戌','甲辰 丁丑 甲子 乙亥']);
 const [a,b,c,d]=[16,18,20,22].map(h=>at(1965,1,10,h));
 assert.deepEqual([a,b,c,d].map(r=>r.branchDecision.mode),['branch-diverted','branch-link','direction-clash','hidden-only']);
 assert.deepEqual([a,b,c,d].map(r=>r.experienceQuestions.length),[1,1,3,3]);
 assert.match(b.branchDecision.reason,/巳酉丑 금\(관성\) 삼합의 두 글자/);assert.deepEqual(c.branchDecision.clashes.sort(),['진술충','축술형'].sort());
 assert.equal(at(1965,1,10,12).branchDecision,null);assert.equal(at(1965,1,10,12).rootingDecision.mode,'grounded-link');
 // 1980-01-02 甲戌: 08시 관성 only in 戌's 辛, 戌 is 가을 → 戊·己 root in it, 진술충 → shaken; 16시 PR231 as before.
 const e=at(1980,1,2,8),f=at(1980,1,2,16);
 assert.equal(e.rootingDecision.mode,'hidden-only');assert.equal(e.branchDecision.mode,'season-shaken');
 assert.match(e.branchDecision.facts,/일지 戌은 본기가 戊\(편재\)이지만 계절로는 금의 계절인 가을에 속해 관성의 환경을 품어요/);
 assert.equal(f.rootingDecision.mode,'grounded-link');assert.equal(f.branchDecision,null);
 // 1980-01-04 02시 丙子: 재성 辛 only in 丑 (금의 고지) — withheld, the reason now names it.
 const g=at(1980,1,4,2);
 assert.equal(g.branchDecision.mode,'hidden-only');assert.equal(g.experienceQuestions.length,3);assert.match(g.branchDecision.reason,/시지 丑은 금을 거두는 고지/);
 // One side in the stems: rooted in the season body, shaken, unknown; roots elsewhere or none.
 assert.deepEqual([2,14,20].map(h=>at(1965,5,23,h).branchDecision.mode),['season-grounded','season-shaken','season-link-withheld']);
 assert.deepEqual([2,4].map(h=>at(1965,6,4,h).branchDecision.mode),['season-surface','season-separate']);
 assert.equal(at(1965,6,9,20).branchDecision.mode,'branch-link'); // 甲 with 戌 alone: 편재 by principal, 가을 by season
 assert.equal(at(1965,1,12,18).branchDecision.mode,'direction-unset'); // 丙: 酉·丑 frame 金 = 재성
 assert.equal(at(1965,1,1,18).branchDecision.mode,'no-direction');assert.equal(at(1965,1,20,16).branchDecision.mode,'mixed-direction');
 // Unknown birth time: nothing is computed.
 const u=chart(1965,1,10,18);
 for(const bad of[{...u,birthTime:{status:'unknown'}},{...u,input:{...u.input,hourUnknown:true}}])assert.equal(buildContextReading(bad),null);
});

test('the same answer revises differently by condition: a link keeps a yes, a diverted reading lowers it',()=>{
 const reply=(date,answer)=>{const d=buildContextReading(chart(...date)).branchDecision;
  return resolveWorkFeedback({decision:d,footer:'',messages:[{role:'assistant',text:d.question.prompt}],answer});};
 const link=[1965,1,10,18],diverted=[1965,1,10,16],grounded=[1965,5,23,2],shaken=[1965,5,23,14],separate=[1965,6,4,4];
 const after=(date,answer)=>reply(date,answer).after;
 assert.deepEqual(['맞아요','반대예요','경험이 없어요'].map(x=>after(link,x)),['retained-as-self-report','weakened','withheld']);
 assert.deepEqual(['맞아요','반대예요','경험이 없어요'].map(x=>after(diverted,x)),['weakened','retained-as-self-report','withheld']);
 assert.deepEqual(['맞아요','반대예요'].map(x=>after(grounded,x)),['retained-as-self-report','weakened']);
 assert.deepEqual(['맞아요','반대예요'].map(x=>after(separate,x)),['weakened','retained-as-self-report']);
 assert.deepEqual(['맞아요','반대예요'].map(x=>after(shaken,x)),['retained-as-self-report','retained-as-self-report']);
 assert.match(reply(link,'반대예요').revisedInterpretation,/이어지기 수월하다.*낮춰요/);
 assert.match(reply(diverted,'맞아요').revisedInterpretation,/배움·준비 쪽으로 묶인다고 봤지만.*이 비교로는 그 연결을 설명하지 못해요/);
 assert.match(reply(grounded,'반대예요').revisedInterpretation,/근거로 나온다.*낮춰요/);
 assert.match(reply(shaken,'반대예요').revisedInterpretation,/흔들린다는 풀이와 같은 방향/);
 const mixed='처음에는 도움이 됐는데 나중에는 도움이 안 됐어요';
 assert.match(reply(link,mixed).text,/도움이 된 쪽에서는 .*유지하고, 그렇지 않았던 쪽에서는 낮춰요/);
 assert.match(reply(diverted,mixed).text,/도움이 된 쪽에서는 .*낮추고, 그렇지 않았던 쪽에서는 유지해요/);
 for(const date of[link,diverted,grounded]){const r=reply(date,'반대예요');
  assert.equal(r.beforeFeedback.policy,'branch-season-v1');assert.equal(r.nextQuestion,null);assert.equal(r.probability,null);assert.equal(r.trainingEligible,false);}
 assert.equal(reply(link,'반대예요').beforeFeedback.scope,'both-natal-branches');assert.equal(reply(grounded,'반대예요').beforeFeedback.scope,'one-side-stem-season-body');
 // Withheld branch modes ask nothing, so nothing is revised.
 for(const date of[[1965,1,10,20],[1980,1,4,2],[1965,5,23,20]])assert.equal(feedbackPlan(buildContextReading(chart(...date)).branchDecision),null);
 // A duty-kind clarification still applies to answers that credit only other people.
 assert.equal(reply(link,'팀원이랑 나눠서 해결했어요').action,'clarify');
});
