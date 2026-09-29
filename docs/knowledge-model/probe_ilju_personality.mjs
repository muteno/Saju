// Reproduces the handoff §5.1 failure (원문88): the first-screen personality lines come from the
// 일주 key only, so charts with the same day pillar but different strength read the same.
//   node docs/knowledge-model/probe_ilju_personality.mjs [YYYY-MM-DD HH ...]   (needs `npm run build` for the KB)
import {readFileSync} from 'node:fs';
import {computeChart} from '../../dosa-app/engine/src/manseryeok.js';
import {chartToKeys} from '../../dosa-app/engine/src/keyset.js';
import {buildReport} from '../../dosa-app/engine/src/report.js';
import {strengthJudge} from '../../dosa-app/engine/src/judge.js';
const root=new URL('../../',import.meta.url);
const {terms}=JSON.parse(readFileSync(new URL('dosa-app/engine/data/solar_terms.json',root)));
const ref=JSON.parse(readFileSync(new URL('app/src/engine/vendor/kb_ref.json',root)));
const kb=JSON.parse(readFileSync(new URL(`app/public/${ref.file}`,root)));
const args=process.argv.slice(2),inputs=args.length?args.reduce((a,v,i)=>i%2?a:[...a,[v,+args[i+1]]],[])
 :[['1970-06-15',18],['1970-06-15',0],['1971-12-07',8]]; // 丙寅: 신강 / 중화 / 신약(겨울)
const rows=inputs.map(([date,hour])=>{const[y,m,d]=date.split('-').map(Number);
 const c=computeChart({year:y,month:m,day:d,hour,minute:0,gender:'F',solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
 const s=strengthJudge(c),dd=buildReport(c,chartToKeys(c),kb).sections.find(x=>x.id==='ilju')?.block?.distilled?.distilled??{};
 return{input:`${date} ${hour}시`,pillars:['year','month','day','hour'].map(k=>c.saju[k].hanja).join(' '),strength:`${s.label} ${s.score}/${s.max}`,
  firstScreen:[dd.핵심,dd.성격?.[0]].filter(Boolean)};});
console.log(JSON.stringify(rows,null,1));
console.log('same first-screen text:',new Set(rows.map(r=>JSON.stringify(r.firstScreen))).size===1);
