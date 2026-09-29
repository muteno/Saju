import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {capture,hash} from './measure_hyeonchim_consumers.mjs';
import {hiddenRootBaseline} from './frozen_hidden_root_context.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
export async function compareOrderedRoles(){
 const frozen=hiddenRootBaseline();let before;
 try {
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  execFileSync(process.execPath,['docs/knowledge-model/measure_hyeonchim_consumers.mjs','--capture','capture.json'],{cwd:frozen.directory,env,timeout:90000,stdio:'pipe'});
  before=JSON.parse(readFileSync(resolve(frozen.directory,'capture.json')));
 } finally {frozen.cleanup();}
 const after=await capture();assert.deepEqual(after.assets,before.assets);assert.deepEqual(after.lookup,before.lookup);
 return {before,after};
}
export function summarizeOrderedRoles({before,after}){
 const paths=['dosa-app/engine/src/contextReading.js','dosa-app/engine/src/contextReading.d.ts','app/src/engine/vendor/contextReading.js','app/src/engine/vendor/contextReading.d.ts','app/src/data/dosaClient.ts','dosa-app/engine/src/judge.js','dosa-app/engine/src/tables.js'];
 return {baseline_commit:'ca3afb9b4ec22949f15c7eba72972fe76e2f1248',policy:'natal-work-context-v5',scope:'110 synthetic calendar inputs; six ordered work-role pairs; personal accuracy unmeasured',training_eligible:0,probability:null,
 sources:paths.map(path=>({path,sha256_lf:hash(readFileSync(resolve(root,path),'utf8').replace(/\r\n/g,'\n'))})),
 rows:after.rows.map((row,i)=>{const r=row.report.sections.find(s=>s.id==='context-reading')?.context;
  const old=before.rows[i].report.sections.find(s=>s.id==='context-reading')?.context;
  return {id:row.id,unknown:row.profile.hourUnknown,month_group:r?.monthMain.group??null,hour_group:r?.hourStem.group??null,
   ordered_text_changed:r?.blocks[2].lines[0]!==old?.blocks[2].lines[0],
   calculations_unchanged:['chart','raw','keys','brain','direct','fortune'].every(k=>JSON.stringify(row[k])===JSON.stringify(before.rows[i][k])),
   before_sha256:hash(JSON.stringify(before.rows[i])),after_sha256:hash(JSON.stringify(row))};})};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.ok(['--write','--check'].includes(process.argv[2]));const result=summarizeOrderedRoles(await compareOrderedRoles());
 const out=new URL('data/ordered_roles_delivery.json',import.meta.url);
 if(process.argv[2]==='--write')writeFileSync(out,JSON.stringify(result,null,2)+'\n');else assert.deepEqual(result,JSON.parse(readFileSync(out)));
 console.log(JSON.stringify({rows:result.rows.length,unknown:result.rows.filter(r=>r.unknown).length,ordered_text_changed:result.rows.filter(r=>r.ordered_text_changed).length,calculations_unchanged:result.rows.every(r=>r.calculations_unchanged)}));
}
