// Reproduces the PR228/PR230/PR231/PR232 measurements (see CONDITIONAL_WORK_READING.md).
//   node docs/knowledge-model/measure_work_feedback_scope.mjs grid
//     → 1950-01-01..2009-12-31, every day × even hours, F, no solar correction, keepDay
//   node docs/knowledge-model/measure_work_feedback_scope.mjs layer <git-ref> [strict]
//     → the whole engine at <git-ref> vs now on the same symbolic charts: every decision the ref already
//       has (decision; rootingDecision from PR231) must be identical everywhere, and every other change must
//       be a chart whose new decision (rootingDecision for refs before PR231, branchDecision from PR232) is
//       shown. `strict` exits 1 otherwise.
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
const DECISIONS=['decision','rootingDecision','branchDecision'];
const shown=r=>DECISIONS.map(k=>r[k]).find(d=>d?.active)??null;
const root=fileURLToPath(new URL('../../',import.meta.url));
const [mode,ref]=process.argv.slice(2);
if(mode==='grid'){
 const {terms}=JSON.parse(readFileSync(root+'dosa-app/engine/data/solar_terms.json'));
 const out={total:0,withDecision:0,displayed:0,revisable:0,modes:{},scopeWithheld:{bothBranchOnly:0,wealthStemOnly:0,authorityStemOnly:0},
  rooting:{charts:0,displayed:0,revisable:0,modes:{},linkBases:{}},branch:{charts:0,displayed:0,revisable:0,modes:{},pairKinds:{},linkBases:{}},anyDisplayed:0,anyRevisable:0,anyDisplayedHidingRelationQuestion:0,
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
   if(feedbackPlan(decision))out.revisable++;
   // PR231: one-side charts read by stem–branch rooting; the shown comparison owns the one question.
   const rd=r.rootingDecision;
   if(rd){const o=out.rooting;o.charts++;const k=`${rd.side}:${rd.mode}`;o.modes[k]=(o.modes[k]??0)+1;
    if(rd.active)o.displayed++;if(feedbackPlan(rd))o.revisable++;
    for(const b of new Set(rd.roots.flatMap(x=>x.places.filter(p=>p.link).map(p=>p.state.basis))))o.linkBases[b]=(o.linkBases[b]??0)+1;}
   // PR232: charts left to the branches, read by season body and 삼합 direction.
   const bd=r.branchDecision;
   if(bd){const o=out.branch;o.charts++;const k=`${bd.scope==='both-natal-branches'?'both':bd.side}:${bd.mode}`;o.modes[k]=(o.modes[k]??0)+1;
    if(bd.active)o.displayed++;if(feedbackPlan(bd))o.revisable++;
    if(bd.pairs){const kinds=[...new Set(bd.pairs.map(x=>x.kind))].sort().join('|')||'no-pair';o.pairKinds[kinds]=(o.pairKinds[kinds]??0)+1;}
    if(bd.roots)for(const b of new Set(bd.roots.flatMap(x=>x.places.filter(p=>p.link).map(p=>p.state.basis))))o.linkBases[b]=(o.linkBases[b]??0)+1;}
   const w=shown(r);if(w){out.anyDisplayed++;if(feedbackPlan(w))out.anyRevisable++;
    if(r.monthDayChung.question||r.monthDayYukhap.question||r.monthDayCompound.question||r.monthDayHyeong.question)out.anyDisplayedHidingRelationQuestion++;}}}
 console.log(JSON.stringify(out,null,1));
}else if(mode==='layer'&&ref){
 const dir=mkdtempSync(join(tmpdir(),'saju-work-layer-'));
 try{
  const files=execFileSync('git',['ls-tree','--name-only',ref,'dosa-app/engine/src/'],{cwd:root,encoding:'utf8'}).trim().split('\n');
  for(const f of files)writeFileSync(join(dir,f.split('/').at(-1)),execFileSync('git',['show',`${ref}:${f}`],{cwd:root}));
  writeFileSync(join(dir,'package.json'),'{"type":"module"}');
  const {buildContextReading:old}=await import(pathToFileURL(join(dir,'contextReading.js')).href);
  const out={ref,charts:0,kept:null,added:null,decisionIdentical:0,decisionChanged:0,changedDecisions:{},identicalOtherwise:0,changedWithShown:{},changedOther:0,questionsBefore:{},questionsAfter:{}};
  const bump=(o,k)=>{o[k]=(o[k]??0)+1;};
  for(let k=0;k<10;k++)for(let day=k*7%60,year=0;year<60;year++)for(let month=0;month<60;month++)for(const hour of[0,1,2,3,4,5,6,7,8,9,10,11,26,37,48,59]){
   const c={input:{hour:12,minute:0},pillarsIdx:{year,month,day,hour}};out.charts++;const a=buildContextReading(c),b=old(c);
   // Decisions the ref already has must not change; decisions it lacks are the new layer.
   const kept=DECISIONS.filter(k=>k in b),added=DECISIONS.filter(k=>k in a&&!(k in b));out.kept??=kept;out.added??=added;
   const changed=kept.filter(k=>!isDeepStrictEqual(a[k],b[k]));
   if(changed.length){out.decisionChanged++;for(const k of changed)bump(out.changedDecisions,k);}else out.decisionIdentical++;
   const strip=r=>Object.fromEntries(Object.entries(r).filter(([key])=>key!=='policy'&&!added.includes(key)));
   if(isDeepStrictEqual(strip(a),strip(b))){out.identicalOtherwise++;continue;}
   const now=added.map(k=>a[k]).find(d=>d?.active);
   if(now){bump(out.changedWithShown,`${now.scope==='both-natal-branches'?'both':now.side}:${now.mode}`);
    bump(out.questionsBefore,b.experienceQuestions.length);bump(out.questionsAfter,a.experienceQuestions.length);}
   else out.changedOther++;}
  console.log(JSON.stringify(out,null,1));if(process.argv[4]==='strict'&&(out.decisionChanged||out.changedOther))process.exitCode=1;
 }finally{rmSync(dir,{recursive:true,force:true});}
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
}else{console.error('usage: grid | layer <git-ref> [strict] | same <git-ref> [strict]');process.exitCode=2;}
