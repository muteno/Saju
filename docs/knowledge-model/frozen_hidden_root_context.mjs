// PR220 source bytes for its historical nine checks; receipts remain unchanged.
import {spawnSync} from 'node:child_process';
import {readFileSync,copyFileSync,cpSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {frozenApp,pinPreTemperament} from './frozen_app_audit.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=new URL('fixtures/hidden-root-context-v1/',import.meta.url);
export function hiddenRootBaseline() {
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',source)));
 assert.equal(manifest.commit,'ca3afb9b4ec22949f15c7eba72972fe76e2f1248');
 const frozen=frozenApp({consumers:'context-synthesis-v1'});
 try {
  for(const path of ['app/src','dosa-app/engine/src','functions/api/dosa.ts'])
   cpSync(resolve(root,path),resolve(frozen.directory,path),{recursive:true});
  pinPreTemperament(frozen.directory); // PR235's report/consumer changes are not part of this receipt
  // This client was unchanged between PR220 and PR221 (Git blob d7eca4c).
  // Pin it now that the current client also preserves a month/day observation.
  const clientSource=new URL('fixtures/ordered-roles-v1/',import.meta.url);
  const clientManifest=JSON.parse(readFileSync(new URL('manifest.json',clientSource)));
  assert.equal(clientManifest.commit,'220052673e927b355eec41240e2408d7172310d2');
  const client=clientManifest.files.find(file=>file.path==='app/src/data/dosaClient.ts');
  assert.ok(client);
  const clientBytes=readFileSync(new URL(client.path,clientSource));
  assert.equal(createHash('sha256').update(clientBytes.toString('utf8').replace(/\r\n/g,'\n')).digest('hex'),client.sha256_lf);
  copyFileSync(new URL(client.path,clientSource),resolve(frozen.directory,client.path));
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
 const frozen=hiddenRootBaseline();
 try {
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const result=spawnSync(process.execPath,process.argv.slice(2),{cwd:frozen.directory,env,encoding:'utf8',timeout:150000,maxBuffer:8*1024*1024});
  process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');
  if(result.error)throw result.error;
  if(result.status!==0)throw Error(`Frozen hidden-root baseline exit ${result.status}`);
 } finally {frozen.cleanup();}
}
