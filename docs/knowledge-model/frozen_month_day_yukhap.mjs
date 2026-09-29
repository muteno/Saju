// PR223 source bytes for its historical seven checks; receipts remain unchanged.
import {spawnSync} from 'node:child_process';
import {readFileSync,copyFileSync,cpSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {frozenApp} from './frozen_app_audit.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=new URL('fixtures/month-day-yukhap-v1/',import.meta.url);
export function monthDayYukhapBaseline() {
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',source)));
 assert.equal(manifest.commit,'1b53a24f3ac6dfbdee2867d13f05ed95b628b9f3');
 const frozen=frozenApp({consumers:'context-synthesis-v1'});
 try {
  for(const path of ['app/src','dosa-app/engine/src','functions/api/dosa.ts'])
   cpSync(resolve(root,path),resolve(frozen.directory,path),{recursive:true});
  for(const file of manifest.files){
   assert.ok(/^(app\/src\/|dosa-app\/engine\/src\/)/.test(file.path)&&!file.path.includes('..'));
   const src=new URL(file.path,source);
   assert.equal(createHash('sha256').update(readFileSync(src,'utf8').replace(/\r\n/g,'\n')).digest('hex'),file.sha256_lf);
   const dest=resolve(frozen.directory,file.path);mkdirSync(dirname(dest),{recursive:true});copyFileSync(src,dest);
  }
  return frozen;
 } catch(error){frozen.cleanup();throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const frozen=monthDayYukhapBaseline();
 try {
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const result=spawnSync(process.execPath,process.argv.slice(2),{cwd:frozen.directory,env,encoding:'utf8',timeout:150000,maxBuffer:8*1024*1024});
  process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
  if(result.error)throw result.error;
  if(result.status!==0)throw Error(`Frozen month-day yukhap baseline exit ${result.status}`);
 } finally {frozen.cleanup();}
}
