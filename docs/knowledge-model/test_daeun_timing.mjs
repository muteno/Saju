// PR233: 대운 periods for the natal work readings whose reason the reference resolves by luck — a rootless visible
// stem (2122~2125, 2166, 2172, 2180) and a root under 충 (2114~2118). Expected values come from the reference's
// rooting table (2080~2085), the principal (本氣) table and the textbook relation pairs written out here, not from
// the engine tables or the implementation's wording. The natal decisions themselves are checked by
// `measure_work_feedback_scope.mjs layer <prev main> strict` and the earlier tests.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {buildContextReading} from '../../dosa-app/engine/src/contextReading.js';
import {computeChart} from '../../dosa-app/engine/src/manseryeok.js';
import {luckBranchRelations,luckRootStatus,daeunPillars,DAEUN_LIMIT} from '../../dosa-app/engine/src/daeunTiming.js';
const {terms}=JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
const chart=(y,m,d,hour,gender='F')=>computeChart({year:y,month:m,day:d,hour,minute:0,gender,solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
const STEMS='甲乙丙丁戊己庚辛壬癸',BRANCHES='子丑寅卯辰巳午未申酉戌亥',POS=['year','month','day','hour'];
const pillar=i=>STEMS[i%10]+BRANCHES[i%12];
const idx=s=>{for(let i=0;i<60;i++)if(pillar(i)===s)return i;throw new Error(`not a pillar: ${s}`);};
const ix=s=>[...s].map(c=>BRANCHES.indexOf(c));
// 2080~2085 "천간이 통근하는 지지" by element (木火土金水).
const ROOT=[ix('寅卯辰亥未'),ix('巳午未寅戌'),ix('辰戌丑未寅申巳亥午'),ix('申酉戌巳丑'),ix('亥子丑申辰')];
const HID={子:'壬癸',丑:'癸辛己',寅:'戊丙甲',卯:'甲乙',辰:'乙癸戊',巳:'戊庚丙',午:'丙己丁',未:'丁乙己',申:'戊壬庚',酉:'庚辛',戌:'辛丁戊',亥:'戊甲壬'};
const principal=b=>STEMS.indexOf(HID[BRANCHES[b]].at(-1));
const el=s=>Math.floor(s/2);
const GROUPS=['비겁','식상','재성','관성','인성'];
const groupOfEl=(day,e)=>GROUPS[(e-el(day)+5)%5];
const SEASONS=[ix('寅卯辰'),ix('巳午未'),ix('申酉戌'),ix('亥子丑')],SEASON_EL=[0,1,3,4],STORAGE=ix('辰戌丑未');
const season=b=>SEASONS.findIndex(s=>s.includes(b));
// 충 子午 丑未 寅申 卯酉 辰戌 巳亥; 육합 子丑(土) 寅亥(木) 卯戌(火) 辰酉(金) 巳申(水) 午未(火); 삼합 申子辰 水,
// 巳酉丑 金, 寅午戌 火, 亥卯未 木 (two members of one frame, as an incoming branch is read); 형 寅巳申·丑戌未, 子卯, 辰午酉亥 자형.
const same=(a,b,x,y)=>(a===x&&b===y)||(a===y&&b===x);
const isChung=(a,b)=>(a+6)%12===b;
const YUK=[['子丑',2],['寅亥',0],['卯戌',1],['辰酉',3],['巳申',4],['午未',1]].map(([s,e])=>[...ix(s),e]);
const SAM=[['申子辰',4],['巳酉丑',3],['寅午戌',1],['亥卯未',0]].map(([s,e])=>[ix(s),e]);
const hapEl=(a,b)=>{const y=YUK.find(([x,z])=>same(a,b,x,z));if(y)return y[2];const t=SAM.find(([m])=>m.includes(a)&&m.includes(b));return t&&a!==b?t[1]:null;};
const isSasin=(a,b)=>same(a,b,5,8);
const isHyeong=(a,b)=>!isChung(a,b)&&!isSasin(a,b)&&([ix('寅巳申'),ix('丑戌未')].some(f=>f.includes(a)&&f.includes(b)&&a!==b)||same(a,b,0,3)||(a===b&&ix('辰午酉亥').includes(a)));
const RULE={'surface-only':'rootless','season-surface':'rootless','shaken-link':'clashed','season-shaken':'clashed'};
const shownWork=r=>[r.decision,r.rootingDecision,r.branchDecision].find(d=>d?.active)??null;

/** Status of each 대운 from the rules as written in CONDITIONAL_WORK_READING.md (대운의 뿌리·합). */
function expected(p,daeun,work){
 const rule=work?RULE[work.mode]:null;if(!rule)return null;
 const day=p.day%10,bs=POS.map(q=>p[q]%12),e=el(work.roots[0].stem),env=work.side==='wealth'?'관성':'재성';
 const clashed=rule==='clashed'?[...new Set(work.roots.flatMap(r=>r.places.filter(x=>x.link&&x.state.basis==='chung').map(x=>POS.indexOf(x.position))))]:[];
 const applicable=rule==='rootless'||clashed.length>0;
 return daeun.list.map((_,i)=>{const B=((p.month+(daeun.forward?i+1:-(i+1)))%60+60)%60%12;
  const chung=bs.some(b=>isChung(B,b)),sasin=bs.some(b=>isSasin(B,b)),hyeong=bs.some(b=>isHyeong(B,b));
  const haps=bs.map((b,q)=>({q,e:hapEl(B,b)})).filter(h=>h.e!==null);
  let root='none';
  if(ROOT[e].includes(B))root=sasin||(chung&&!haps.length)?'root-shaken':chung||hyeong?'root-unknown':haps.some(h=>h.e!==e)?'root-tilted':'root';
  const envLink=groupOfEl(day,el(principal(B)))===env||(work.policy==='branch-season-v1'&&STORAGE.includes(B)&&groupOfEl(day,SEASON_EL[season(B)])===env);
  if(!applicable)return'no-rule';
  if(haps.some(h=>clashed.includes(h.q)))return chung||sasin||hyeong?'relieve-unknown':'relieve';
  if(rule==='clashed'&&root!=='none'&&!envLink)return'root-elsewhere';
  return root;});
}
const hanjaOf=name=>STEMS['갑을병정무기경신임계'.indexOf(name[0])]+BRANCHES['자축인묘진사오미신유술해'.indexOf(name[1])];
const synthetic=(month,forward,su)=>({su,forward,list:Array.from({length:10},(_,i)=>{const g=((month+(forward?i+1:-(i+1)))%60+60)%60;
 return{age:su+i*10,name:'갑을병정무기경신임계'[g%10]+'자축인묘진사오미신유술해'[g%12]};})});

test('every day master and both directions: each 대운 status follows the independent rooting, 합 and 충 rules',()=>{
 const seen={},targets={};let n=0,covered=0,shown=0;
 for(let k=0;k<10;k++){const day=k*7%60;
  for(let year=0;year<60;year+=2)for(let month=0;month<60;month+=3)for(const hour of[0,1,2,3,4,5,6,7,8,9,10,11]){
   const p={year,month,day,hour},daeun=synthetic(month,(year+hour)%2===0,1+(year+month+hour)%10);
   const r=buildContextReading({input:{hour:12,minute:0},pillarsIdx:p,daeun}),w=shownWork(r),t=r.daeunTiming,at=POS.map(q=>pillar(p[q])).join(' ');n++;
   const e=expected(p,daeun,w);
   if(!e){assert.equal(t,null,at);continue;}
   covered++;targets[w.mode]=(targets[w.mode]??0)+1;
   assert.deepEqual(t.periods.map(x=>x.status),e,at);for(const s of e)seen[s]=(seen[s]??0)+1;
   assert.deepEqual(t.periods.map(x=>[x.age,x.ganji]),daeun.list.map(x=>[x.age,hanjaOf(x.name)]),at);
   assert.deepEqual(t.candidates.map(x=>x.order),t.periods.filter(x=>['root','relieve'].includes(x.status)).map(x=>x.order));
   assert.equal(t.active,!e.includes('no-rule'),at);assert.equal(t.probability,null);assert.equal(t.trainingEligible,false);
   const lines=r.blocks[2].lines;
   if(t.active){shown++;
    // The timing sits right after the shown comparison and before the month/hour roles; the one question stays.
    assert.deepEqual(lines.slice(w.lines.length,w.lines.length+t.lines.length),t.lines,at);
    assert.ok(lines[w.lines.length+t.lines.length].includes('의 조합에서는'),at);
    assert.equal(t.lines.at(-1),DAEUN_LIMIT);assert.deepEqual(r.experienceQuestions,[w.question]);
    for(const line of t.lines)assert.ok(!/확률|반드시|성공한다|사건이 일어|좋아진다/.test(line),line);
   }else{assert.deepEqual(t.lines,[]);assert.ok(!lines.includes(DAEUN_LIMIT));}
  }}
 assert.ok(n>=70000);assert.ok(covered>5000);assert.ok(shown>5000);
 for(const m of Object.keys(RULE))assert.ok(targets[m]>0,m);
 for(const s of['root','root-shaken','root-tilted','root-unknown','root-elsewhere','relieve','relieve-unknown','none','no-rule'])assert.ok(seen[s]>0,s);
});

test('the reference\'s own luck examples read as written (2114~2118, 2174~2176) and the assumptions stay visible (2180)',()=>{
 const P=(y,m,d,h)=>({year:idx(y),month:idx(m),day:idx(d),hour:idx(h)});
 // 2114~2118 甲 rooted in 寅 under 寅申충: a 합 with 寅 (亥, 午) relieves it; a 통근운 (卯) is a root; 寅 again meets 申.
 const a=P('壬申','丙寅','甲寅','丙寅');
 for(const b of ix('亥午'))assert.ok(luckBranchRelations(a,b).hap.some(h=>h.position==='month'),BRANCHES[b]);
 assert.equal(luckRootStatus(a,ix('卯')[0],0).status,'root');
 assert.deepEqual([luckRootStatus(a,ix('寅')[0],0).status,luckRootStatus(a,ix('寅')[0],0).basis],['root-shaken','chung']);
 // 2174~2176 甲 without roots (子午申): 亥 brings a root; its principal 壬 is 편인, the 인성(자격) of the example.
 const b=P('戊申','戊午','甲子','甲戌');
 assert.ok(!POS.some(q=>ROOT[0].includes(b[q]%12)));assert.equal(luckRootStatus(b,ix('亥')[0],0).status,'root');
 assert.equal(groupOfEl(0,el(principal(ix('亥')[0]))),'인성');
 // 2180 乙 without roots (子酉申午): the reference only says a rooting 대운 is needed. The carried-over natal rules
 // (implementation assumptions) lower 卯 (卯酉충), leave 寅 open (寅申충 with 寅午 반합), lower 辰·未 (합 toward 金·水 / 火)
 // and keep 亥.
 const c=P('甲午','壬申','乙酉','丙子');
 assert.deepEqual(ix('卯寅辰未亥').map(x=>luckRootStatus(c,x,0).status),['root-shaken','root-unknown','root-tilted','root-tilted','root']);
 // 사신형 and other 형 are named apart (巳申 is also a 육합).
 const d=luckBranchRelations(a,ix('巳')[0]);assert.deepEqual([d.sasin.length,d.hyeong.map(h=>h.name)],[1,['寅巳형','寅巳형','寅巳형']]);
});

test('the same natal chart with the other 대운 direction names different periods, and the natal reading stays',()=>{
 const pair=(y,m,d,h)=>[buildContextReading(chart(y,m,d,h,'F')),buildContextReading(chart(y,m,d,h,'M'))];
 const periods=r=>r.daeunTiming.candidates.map(x=>`${x.age}${x.ganji}:${x.status}`);
 for(const[date,mode,f,m]of[
  // 1980-01-02 08시 甲戌: 재성 戊·己 rooted in 戌 (가을=관성) under 진술충 → a 寅 (寅午戌) relieves it.
  [[1980,1,2,8],'season-shaken',['12戊寅:relieve'],['99丙寅:relieve']],
  // 1976-12-09 14시 乙未: 관성 庚 without roots → 酉·巳 bring clean roots, in different decades by direction.
  [[1976,12,9,14],'surface-only',['21丁酉:root','61癸巳:root'],['50乙巳:root','90己酉:root']],
  // 1976-07-09 02시 壬戌: 재성 丙 rooted in 未·戌 (관성) under 丑未충·진술충 → 합 with 未 or 戌 relieves.
  [[1976,7,9,2],'shaken-link',['1甲午:relieve','31辛卯:relieve','41庚寅:relieve','71丁亥:relieve'],['40己亥:relieve','70壬寅:relieve','80癸卯:relieve']],
  // 1965-05-23 14시 丁丑: 재성 辛 rooted in 丑 (겨울=관성) under 丑未충 → 酉·子 relieve.
  [[1965,5,23,14],'season-shaken',['35乙酉:relieve','65戊子:relieve'],null],
 ]){
  const[F,M]=pair(...date);
  for(const key of['decision','rootingDecision','branchDecision','groups','strength','experienceQuestions'])assert.deepEqual(F[key],M[key],`${date} ${key}`);
  assert.equal(shownWork(F).mode,mode);assert.deepEqual(periods(F),f,String(date));
  if(m){assert.deepEqual(periods(M),m,String(date));assert.notDeepEqual(F.daeunTiming.lines,M.daeunTiming.lines);}
 }
 // Text: the relief names its 합; a clean root names its principal and whether it is the other group's environment.
 const e=pair(1980,1,2,8)[0].daeunTiming.lines;
 assert.match(e[0],/충을 받은 일지 戌의 뿌리로 흔들리던 연간 己, 시간 戊의 근거를 다시 쓰기 쉬운 대운/);
 assert.match(e[1],/12세\(1992년\) 戊寅 대운은 寅戌반합으로 충을 풀어 줘서, 기준·책임 환경에 둔 원래 뿌리/);
 assert.match(e[2],/92세\(2072년\) 丙戌 대운은 뿌리가 되지만 원국 시지 辰과 辰戌충이라 흔들리며/);
 const s=pair(1976,12,9,14)[0].daeunTiming.lines;
 assert.match(s[1],/21세\(1997년\) 丁酉 대운은 酉의 지장간에 같은 금 기운이 있고 본기가 辛\(편관\)이라, 그 본기의 ‘규칙과 책임’ 쪽/);
 assert.match(s[2],/31세\(2007년\) 丙申 대운은 뿌리가 되지만 원국 연지 辰과 辰申반합, 월지 子와 子申반합을 이뤄 합의 기운\(수\)으로 기울 수 있어/);
 // 2024-02-20 12시: 丑 is the 재성 environment (본기 己 정재) → 성과·자원 환경을 근거로.
 assert.match(buildContextReading(chart(2024,2,20,12)).daeunTiming.lines[1],/乙丑 대운은 丑의 지장간에 같은 금 기운이 있고 본기가 己\(정재\)라, 재성의 환경인 성과·자원 환경을 근거로/);
});

test('scope: other readings, a root weakened only by 사신형, missing 대운 and unknown birth time add nothing',()=>{
 // A usable link (grounded) has no luck reason in the reference here.
 assert.equal(buildContextReading(chart(1965,1,10,12)).daeunTiming,null);
 // 사신형 only (2235): no luck rule, kept in the record without lines.
 let found=null;
 for(let t=Date.UTC(1970,0,1);!found&&t<Date.UTC(1990,0,1);t+=86400000)for(const h of[0,4,8,12,16,20]){const d=new Date(t);
  const r=buildContextReading(chart(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),h));
  if(r.daeunTiming&&!r.daeunTiming.applicable){found=r;break;}}
 assert.ok(found);assert.equal(found.daeunTiming.active,false);assert.deepEqual(found.daeunTiming.lines,[]);
 assert.ok(found.daeunTiming.periods.every(x=>x.status==='no-rule'));assert.ok(!found.blocks[2].lines.includes(DAEUN_LIMIT));
 // A chart without the existing 대운 list, or with a list that does not follow the month pillar, guesses nothing.
 const c=chart(1980,1,2,8);
 assert.equal(buildContextReading({...c,daeun:null}).daeunTiming,null);
 assert.equal(daeunPillars({...c,daeun:{...c.daeun,list:c.daeun.list.map((x,i)=>i===3?{...x,name:'갑자'}:x)}}),null);
 // Unknown birth time: nothing is computed.
 for(const bad of[{...c,birthTime:{status:'unknown'}},{...c,input:{...c.input,hourUnknown:true}}])assert.equal(buildContextReading(bad),null);
});
