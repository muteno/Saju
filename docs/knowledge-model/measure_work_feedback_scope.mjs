// Reproduces the PR228/PR230 measurements (see CONDITIONAL_WORK_READING.md).
//   node docs/knowledge-model/measure_work_feedback_scope.mjs grid
//     → 1950-01-01..2009-12-31, every day × even hours, F, no solar correction, keepDay
//   node docs/knowledge-model/measure_work_feedback_scope.mjs same <git-ref> [strict]
//     → buildContextReading on symbolic charts of every day master (days k*7 mod 60, k=0..9: one day of each stem),
//       current vs <ref>'s workCandidates.js. Reports identical charts, charts the ref did not cover,
//       and for the rest which decision fields changed and the mode transitions. `strict` exits 1 on any change.
// A synthetic calendar grid, not a user distribution and not an accuracy measure.
import {readFileSync,writeFileSync,mkdtempSync,cpSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {computeChart} from '../../dosa-app/engine/src/manseryeok.js';
import {buildContextReading} from '../../dosa-app/engine/src/contextReading.js';
import {feedbackPlan} from '../../dosa-app/engine/src/workFeedback.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const [mode,ref]=process.argv.slice(2);
if(mode==='grid'){
 const {terms}=JSON.parse(readFileSync(root+'dosa-app/engine/data/solar_terms.json'));
 const out={total:0,withDecision:0,displayed:0,revisable:0,modes:{},scopeWithheld:{bothBranchOnly:0,wealthStemOnly:0,authorityStemOnly:0},
  conditionWithheld:{jiaMonthKilling:0,yangPeer:0,yinHurting:0},displayedHidingRelationQuestion:0,jia:{total:0,modes:{}}};
 for(let t=Date.UTC(1950,0,1);t<Date.UTC(2010,0,1);t+=86400000){const d=new Date(t);
  for(let hour=0;hour<24;hour+=2){out.total++;
   const c=computeChart({year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour,minute:0,gender:'F',solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
   const r=buildContextReading(c),decision=r?.decision;
   if(!decision)continue;out.withDecision++;const m=decision.mode;out.modes[m]=(out.modes[m]??0)+1;
   const stem=c.pillarsIdx.day%10;
   if(stem===0){out.jia.total++;out.jia.modes[m]=(out.jia.modes[m]??0)+1;}
   if(decision.active){out.displayed++;
    // A displayed candidate asks one question; a month/day relation question is then kept only in the record.
    if(r.monthDayChung.question||r.monthDayYukhap.question||r.monthDayCompound.question||r.monthDayHyeong.question)out.displayedHidingRelationQuestion++;}
   if(m==='scope-withheld'){const f=decision.features,a=f.officerStem||f.killingStem;out.scopeWithheld[!f.wealthStem&&!a?'bothBranchOnly':f.wealthStem?'wealthStemOnly':'authorityStemOnly']++;}
   if(m==='condition-withheld')out.conditionWithheld[stem===0?'jiaMonthKilling':stem%2?'yinHurting':'yangPeer']++;
   if(feedbackPlan(decision))out.revisable++;}}
 console.log(JSON.stringify(out,null,1));
}else if(mode==='same'&&ref){
 const dir=mkdtempSync(join(tmpdir(),'saju-work-same-'));
 try{
  cpSync(root+'dosa-app/engine/src',dir,{recursive:true});writeFileSync(join(dir,'package.json'),'{"type":"module"}');
  writeFileSync(join(dir,'workCandidates.js'),execFileSync('git',['show',`${ref}:dosa-app/engine/src/workCandidates.js`],{cwd:root}));
  const {buildContextReading:old}=await import(pathToFileURL(join(dir,'contextReading.js')).href);
  const out={ref,charts:0,identical:0,notCoveredByRef:0,changed:0,changedFields:{},transitions:{},blocksChangedWithoutDecisionChange:0};
  const bump=(o,k)=>{o[k]=(o[k]??0)+1;};
  for(let k=0;k<10;k++)for(let day=k*7%60,year=0;year<60;year++)for(let month=0;month<60;month++)for(const hour of[0,1,2,3,4,5,6,7,8,9,10,11,26,37,48,59]){
   const c={input:{hour:12,minute:0},pillarsIdx:{year,month,day,hour}};out.charts++;const a=buildContextReading(c),b=old(c);
   if(isDeepStrictEqual(a,b)){out.identical++;continue;}
   if(!b.decision){out.notCoveredByRef++;continue;}
   const fields=Object.keys(a.decision).filter(k=>!isDeepStrictEqual(a.decision[k],b.decision[k]));
   if(!fields.length){out.blocksChangedWithoutDecisionChange++;continue;}
   out.changed++;bump(out.changedFields,fields.join(','));bump(out.transitions,`${b.decision.mode}→${a.decision.mode}`);}
  console.log(JSON.stringify(out,null,1));if(process.argv[4]==='strict'&&(out.changed||out.blocksChangedWithoutDecisionChange))process.exitCode=1;
 }finally{rmSync(dir,{recursive:true,force:true});}
}else{console.error('usage: grid | same <git-ref>');process.exitCode=2;}
