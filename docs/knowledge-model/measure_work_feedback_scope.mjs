// Reproduces the PR228 measurements (see CONDITIONAL_WORK_READING.md).
//   node docs/knowledge-model/measure_work_feedback_scope.mjs grid
//     → 1950-01-01..2009-12-31, every day × even hours, F, no solar correction, keepDay
//   node docs/knowledge-model/measure_work_feedback_scope.mjs same <git-ref>
//     → buildContextReading on Jia-day symbolic charts, current vs <ref>'s workCandidates.js
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
 const out={total:0,jiaDay:0,modes:{},scopeWithheld:{bothBranchOnly:0,wealthStemOnly:0,authorityStemOnly:0},revisable:0};
 for(let t=Date.UTC(1950,0,1);t<Date.UTC(2010,0,1);t+=86400000){const d=new Date(t);
  for(let hour=0;hour<24;hour+=2){out.total++;
   const decision=buildContextReading(computeChart({year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour,minute:0,gender:'F',solarTimeCorrection:false,lateZiRule:'keepDay'},terms))?.decision;
   if(!decision)continue;out.jiaDay++;const m=decision.active?decision.mode:'outside-bundle';out.modes[m]=(out.modes[m]??0)+1;
   if(m==='scope-withheld'){const f=decision.features,a=f.officerStem||f.killingStem;out.scopeWithheld[!f.wealthStem&&!a?'bothBranchOnly':f.wealthStem?'wealthStemOnly':'authorityStemOnly']++;}
   if(feedbackPlan(decision))out.revisable++;}}
 console.log(JSON.stringify(out,null,1));
}else if(mode==='same'&&ref){
 const dir=mkdtempSync(join(tmpdir(),'saju-work-same-'));
 try{
  cpSync(root+'dosa-app/engine/src',dir,{recursive:true});writeFileSync(join(dir,'package.json'),'{"type":"module"}');
  writeFileSync(join(dir,'workCandidates.js'),execFileSync('git',['show',`${ref}:dosa-app/engine/src/workCandidates.js`],{cwd:root}));
  const {buildContextReading:old}=await import(pathToFileURL(join(dir,'contextReading.js')).href);
  let n=0,diff=0;
  for(const day of[0,10,20,30,40,50])for(let year=0;year<60;year++)for(let month=0;month<60;month++)for(const hour of[0,1,2,3,4,5,6,7,8,9,10,11,26,37,48,59]){
   const c={input:{hour:12,minute:0},pillarsIdx:{year,month,day,hour}};n++;if(!isDeepStrictEqual(buildContextReading(c),old(c)))diff++;}
  console.log(JSON.stringify({ref,charts:n,different:diff}));if(diff)process.exitCode=1;
 }finally{rmSync(dir,{recursive:true,force:true});}
}else{console.error('usage: grid | same <git-ref>');process.exitCode=2;}
