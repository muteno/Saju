// PR217's original checks/measurements remain unchanged and run on exact source bytes.
import {spawnSync} from 'node:child_process';
import {readFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import assert from 'node:assert/strict';
import {frozenApp} from './frozen_app_audit.mjs';
const source=new URL('fixtures/conversation-context-v1/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',source)));
assert.equal(manifest.commit,'d0d4c8e6d228541b6c3db11f9c53daf1c9ad4892');
const frozen=frozenApp({consumers:'context-synthesis-v1'});
try{
 for(const file of manifest.files){
  assert.ok(/^(app\/src\/|dosa-app\/engine\/src\/|functions\/api\/dosa\.ts$)/.test(file.path)&&!file.path.includes('..'));
  const src=new URL(file.path,source);
  assert.equal(createHash('sha256').update(readFileSync(src,'utf8').replace(/\r\n/g,'\n')).digest('hex'),file.sha256_lf);
  const dest=resolve(frozen.directory,file.path);mkdirSync(dirname(dest),{recursive:true});copyFileSync(src,dest);
 }
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,process.argv.slice(2),{cwd:frozen.directory,env,encoding:'utf8',timeout:150000,maxBuffer:8*1024*1024});
 process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(`Frozen conversation baseline exit ${result.status}`);
}finally{frozen.cleanup();}
