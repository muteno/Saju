// Preserve PR225 receipts while the current pipeline starts comparing candidates.
// Three distinct old sources; the engine mirror reuses the source bytes.
import {spawnSync} from 'node:child_process';
import {readFileSync,cpSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {frozenApp} from './frozen_app_audit.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=new URL('fixtures/hyeong-scope-v1/',import.meta.url);
export function hyeongScopeBaseline(){
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',source)));
 assert.equal(manifest.commit,'dde2be8f9a9cfb07fdc19fd887e274ee02f5b26f');
 const frozen=frozenApp({consumers:'context-synthesis-v1'});
 try{
  for(const path of ['app/src','dosa-app/engine/src','functions/api/dosa.ts'])cpSync(resolve(root,path),resolve(frozen.directory,path),{recursive:true});
  for(const file of manifest.files){
   const bytes=readFileSync(new URL(file.source,source));
   assert.equal(createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g,'\n')).digest('hex'),file.sha256_lf);
   for(const path of file.destinations){assert.ok(/^(app\/src\/|dosa-app\/engine\/src\/)/.test(path)&&!path.includes('..'));
    const dest=resolve(frozen.directory,path);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,bytes);
   }
  }return frozen;
 }catch(error){frozen.cleanup();throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const frozen=hyeongScopeBaseline();try{
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const result=spawnSync(process.execPath,process.argv.slice(2),{cwd:frozen.directory,env,encoding:'utf8',timeout:150000,maxBuffer:8*1024*1024});
  process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
  if(result.error)throw result.error;if(result.status!==0)throw Error(`Frozen hyeong baseline exit ${result.status}`);
 }finally{frozen.cleanup();}
}
