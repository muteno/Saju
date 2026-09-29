import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {capture,hash} from './measure_hyeonchim_consumers.mjs';
import {strengthBaseline} from './frozen_strength_context.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function compareHiddenRoots(){
 const frozen=strengthBaseline();let before;
 try {
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  execFileSync(process.execPath,['docs/knowledge-model/measure_hyeonchim_consumers.mjs','--capture','capture.json'],{cwd:frozen.directory,env,timeout:90000,stdio:'pipe'});
  before=JSON.parse(readFileSync(resolve(frozen.directory,'capture.json')));
 } finally {frozen.cleanup();}
 const after=await capture();assert.deepEqual(after.assets,before.assets);assert.deepEqual(after.lookup,before.lookup);
 return {before,after};
}
export function summarizeHiddenRoots({before,after}){
 const paths=['dosa-app/engine/src/contextReading.js','dosa-app/engine/src/contextReading.d.ts','app/src/engine/vendor/contextReading.js','app/src/engine/vendor/contextReading.d.ts','app/src/data/dosaClient.ts','dosa-app/engine/src/judge.js','dosa-app/engine/src/tables.js'];
 return {baseline_commit:'b1720e16561a2bc2784e04879add53be05555ac1',policy:'natal-work-context-v4',scope:'110 synthetic calendar inputs; personal accuracy unmeasured',training_eligible:0,probability:null,
 sources:paths.map(path=>({path,sha256_lf:hash(readFileSync(resolve(root,path),'utf8').replace(/\r\n/g,'\n'))})),
 rows:after.rows.map((row,i)=>{const roots=row.report.sections.find(s=>s.id==='context-reading')?.context?.strength?.roots;
  return {id:row.id,unknown:row.profile.hourUnknown,same_stem:roots?.sameStem.status??null,same_element:roots?.sameElement.status??null,
   calculations_unchanged:['chart','raw','keys','brain','direct','fortune'].every(k=>JSON.stringify(row[k])===JSON.stringify(before.rows[i][k])),
   before_sha256:hash(JSON.stringify(before.rows[i])),after_sha256:hash(JSON.stringify(row))};})};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.ok(['--write','--check'].includes(process.argv[2]));const result=summarizeHiddenRoots(await compareHiddenRoots());
 const out=new URL('data/hidden_root_context_delivery.json',import.meta.url);
 if(process.argv[2]==='--write')writeFileSync(out,JSON.stringify(result,null,2)+'\n');else assert.deepEqual(result,JSON.parse(readFileSync(out)));
 console.log(JSON.stringify({rows:result.rows.length,unknown:result.rows.filter(r=>r.unknown).length,calculations_unchanged:result.rows.every(r=>r.calculations_unchanged)}));
}
