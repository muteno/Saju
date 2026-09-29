import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {capture,hash} from './measure_hyeonchim_consumers.mjs';
import {monthDayYukhapBaseline} from './frozen_month_day_yukhap.mjs';
import {computeChart} from '../../dosa-app/engine/src/manseryeok.js';
import {buildContextReading} from '../../dosa-app/engine/src/contextReading.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
export const calendarPairs=[[[2023,5,14,12],[2025,7,2,12]],[[2024,2,5,12],[2024,2,5,0]]];
const {terms}=JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
export const actual=([year,month,day,hour])=>computeChart({year,month,day,hour,minute:0,gender:'F',solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
const priorSource=readFileSync(new URL('fixtures/month-day-yukhap-v1/dosa-app/engine/src/contextReading.js',import.meta.url),'utf8')
 .replaceAll("'./tables.js'",JSON.stringify(pathToFileURL(root+'dosa-app/engine/src/tables.js').href))
 .replaceAll("'./judge.js'",JSON.stringify(pathToFileURL(root+'dosa-app/engine/src/judge.js').href))
 .replaceAll("'./relations.js'",JSON.stringify(pathToFileURL(root+'dosa-app/engine/src/relations.js').href));
export const {buildContextReading:priorReading}=await import('data:text/javascript;base64,'+Buffer.from(priorSource).toString('base64'));
export async function compareMonthDayCompound(){
 const frozen=monthDayYukhapBaseline();let before;
 try {
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  execFileSync(process.execPath,['docs/knowledge-model/measure_hyeonchim_consumers.mjs','--capture','capture.json'],{cwd:frozen.directory,env,timeout:90000,stdio:'pipe'});
  before=JSON.parse(readFileSync(resolve(frozen.directory,'capture.json')));
 }finally{frozen.cleanup();}
 const after=await capture();assert.deepEqual(after.assets,before.assets);assert.deepEqual(after.lookup,before.lookup);
 return {before,after};
}
export function summarizeMonthDayCompound({before,after}){
 const paths=['dosa-app/engine/src/contextReading.js','dosa-app/engine/src/contextReading.d.ts','app/src/engine/vendor/contextReading.js','app/src/engine/vendor/contextReading.d.ts','app/src/data/dosaClient.ts','dosa-app/engine/src/relations.js'];
 return {baseline_commit:'1b53a24f3ac6dfbdee2867d13f05ed95b628b9f3',policy:'natal-work-context-v8',scope:'same month/day pair yukhap and pa together; synthetic calendar inputs; personal accuracy unmeasured',training_eligible:0,probability:null,
 sources:paths.map(path=>({path,sha256_lf:hash(readFileSync(resolve(root,path),'utf8').replace(/\r\n/g,'\n'))})),
 rows:after.rows.map((row,i)=>{const r=row.report.sections.find(s=>s.id==='context-reading')?.context;
  return {id:row.id,unknown:row.profile.hourUnknown,compound:r?.monthDayCompound?.status??null,
   calculations_unchanged:['chart','raw','keys','brain','direct','fortune'].every(k=>JSON.stringify(row[k])===JSON.stringify(before.rows[i][k])),
   before_sha256:hash(JSON.stringify(before.rows[i])),after_sha256:hash(JSON.stringify(row))};})};
}
export function calendarSamples(){
 const sample=(input,fn)=>{const r=fn(actual(input));return {input,day:r.dayPillar,month_group:r.monthMain.group,hour_group:r.hourStem.group,
  score:r.strength.observation.score,roots:[r.strength.roots.sameStem.status,r.strength.roots.sameElement.status],
  relation:r.monthDayCompound??null,synthesis:r.blocks[2].lines,questions:r.experienceQuestions};};
 return {baseline_commit:'1b53a24f3ac6dfbdee2867d13f05ed95b628b9f3',pairs:calendarPairs.map(pair=>({before:pair.map(i=>sample(i,priorReading)),after:pair.map(i=>sample(i,buildContextReading))}))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.ok(['--write','--check'].includes(process.argv[2]));const result=summarizeMonthDayCompound(await compareMonthDayCompound());
 for(const [name,data] of [['month_day_compound_delivery',result],['month_day_compound_samples',calendarSamples()]]){
  const out=new URL(`data/${name}.json`,import.meta.url);
  if(process.argv[2]==='--write')writeFileSync(out,JSON.stringify(data,null,2)+'\n');else assert.deepEqual(data,JSON.parse(readFileSync(out)));
 }
 console.log(JSON.stringify({rows:result.rows.length,unknown:result.rows.filter(r=>r.unknown).length,compound:result.rows.filter(r=>r.compound==='present').length,calculations_unchanged:result.rows.every(r=>r.calculations_unchanged)}));
}
