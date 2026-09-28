// Product readiness snapshot. No external provider calls; all consultation requests are mocked.
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { capture } from './measure_hyeonchim_consumers.mjs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = new URL('data/product_readiness_20260928.json', import.meta.url);
assert.ok(['--write','--check'].includes(process.argv[2]), 'Use --write or --check');
const all = await capture();
// Rebuild fixed-clock KB without changing current app assets.
const directory = mkdtempSync(resolve(tmpdir(),'saju-product-readiness-'));
for(const p of ['scripts','app/public','app/src/engine/vendor']) mkdirSync(resolve(directory,p),{recursive:true});
symlinkSync(resolve(root,'dosa-app'),resolve(directory,'dosa-app'),'junction');
writeFileSync(resolve(directory,'scripts/build_kb.mjs'),readFileSync(resolve(root,'scripts/build_kb.mjs')));
writeFileSync(resolve(directory,'clock.mjs'), `const D=Date;globalThis.Date=class extends D{constructor(...a){super(...(a.length?a:['2026-09-28T00:00:00Z']));}static now(){return D.parse('2026-09-28T00:00:00Z');}};`);
execFileSync(process.execPath,['--import',pathToFileURL(resolve(directory,'clock.mjs')).href,resolve(directory,'scripts/build_kb.mjs')],{cwd:directory,timeout:30000,stdio:'pipe'});
const fixedRef = JSON.parse(readFileSync(resolve(directory,'app/src/engine/vendor/kb_ref.json')));
const fixedKb = readFileSync(resolve(directory,'app/public',fixedRef.file));
const hash = value => createHash('sha256').update(value).digest('hex');
assert.equal(hash(fixedKb),all.assets.kb_sha256);
const auditEnv={...process.env}; delete auditEnv.NODE_TEST_CONTEXT;
const python = path => JSON.parse(execFileSync('python3',path,{cwd:root,env:auditEnv,encoding:'utf8',maxBuffer:8*1024*1024,timeout:60000}));
const compare=python(['docs/knowledge-model/case_review.py','--compare']);
const sourceCases=python(['docs/knowledge-model/source_case_review.py','--summary']);
const checks=execFileSync(process.execPath,['dosa-app/engine/test/test_manseryeok.mjs'],{cwd:root,env:auditEnv,encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']});
const checksPassed=(checks.match(/^ok [0-9]+ -/gm)||[]).length;
assert.equal(checksPassed,19);
const require = createRequire(resolve(root, 'app/package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')));
const instant = '2026-09-28T00:00:00Z', D = Date, oldFetch = fetch;
globalThis.Date = class extends D { constructor(...a) { super(...(a.length ? a : [instant])); } static now(){return D.parse(instant);} };
const ref = JSON.parse(readFileSync(resolve(root,'app/src/engine/vendor/kb_ref.json')));
let requestCount = 0;
globalThis.fetch = async (url, init) => {
 if(url === '/api/dosa') { requestCount++; return Response.json({text:'transport-only-mock'}); }
 if(!['/'+ref.file,'/brain.json'].includes(String(url))) throw new Error('Unexpected fetch '+url);
 return new Response((String(url)==='/brain.json' ? readFileSync(resolve(root,'app/public/brain.json')) : fixedKb),{headers:{'content-type':'application/json'}});
};
const server = await createServer({ root: resolve(root,'app'), server:{middlewareMode:true},appType:'custom',logLevel:'error' });
try {
 const engine = await server.ssrLoadModule('/src/engine/index.js');
 const profiles = await server.ssrLoadModule('/src/data/profiles.ts');
 const read = await server.ssrLoadModule('/src/data/saju.ts');
 const topics = await server.ssrLoadModule('/src/data/dosaTopics.ts');
 const client = await server.ssrLoadModule('/src/data/dosaClient.ts');
 await engine.loadKb(); await engine.loadBrain();
 const samples=[
  {id:'normal-1990',year:1990,month:1,day:1,hour:12,minute:0,gender:'여자',city:'서울'},
  {id:'normal-1995',year:1995,month:5,day:15,hour:9,minute:30,gender:'남자',city:'부산'},
  {id:'normal-2000',year:2000,month:8,day:20,hour:18,minute:20,gender:'여자',city:'광주'},
  {id:'unknown-1990',year:1990,month:1,day:1,hour:12,minute:0,gender:'여자',city:'서울',hourUnknown:true}
 ];
 const rows=[];
 for(const sample of samples){
  const p={name:'합성 검수',calendar:'양력',marital:'미혼',hourUnknown:false,...sample};
  const input=profiles.profileToInput(p), chart=engine.computeChartUI(input), report=engine.buildReading(input,'병오'), reading=read.toReading(input), brain=engine.brainReading(input,'병오'), raw=engine.jeonggokRaw(input);
  const start=requestCount;
  for(const topic of ['성격','올해','직업','관계','주의']) await client.requestDosaText({topic,lines:topics.topicLines(report,topic),report,chefId:'noona',model:'sonnet'});
  rows.push({id:sample.id,input,city:sample.city,chart,report_sections:report.sections.map(s=>({id:s.id,title:s.title})),reading:{headline:reading.headline,card_count:reading.cards.length,cards:reading.cards.map(c=>({id:c.id,title:c.title,block_labels:c.blocks.map(b=>b.label??null),line_count:c.blocks.reduce((n,b)=>n+b.lines.length,0),note:c.note??null})),ilju_first_line:reading.cards.find(c=>c.id==='ilju')?.blocks[0]?.lines[0]??null},brain_counts:Object.fromEntries(Object.entries(brain).map(([k,v])=>[k,Array.isArray(v)?v.length:null])),strength:raw?.strength??null,daeun_cross_relations:raw?.daeunHits?.reduce((n,d)=>n+d.relations.length,0)??null,fortune:engine.todayFortune(input),mocked_consultation_requests:requestCount-start});
 }
 const fs = readdirSync(resolve(root,'dosa-app/kb/distilled/ilju')).filter(f=>f.endsWith('.json'));
 const characterDrafts = fs.reduce((n,f)=>n+(JSON.parse(readFileSync(resolve(root,'dosa-app/kb/distilled/ilju',f))).distilled?.성격?.length??0),0);
 const baseInput=rows[0].input;
 const alternateInput={...baseInput,month:3,day:2,hour:18,gender:'M'};
 const baseReport=engine.buildReading(baseInput,'병오'), alternateReport=engine.buildReading(alternateInput,'병오');
 const iljuBlock=r=>r.sections.find(s=>s.id==='ilju').block;
 const summarizedContext=(input,report)=>({input,pillars_year_to_hour:[...engine.computeChartUI(input).pillars].reverse().map(p=>p.ganK+p.jiK),first_daeun:engine.computeChartUI(input).daeun.list[0],ilju_key:iljuBlock(report).key,ilju_block_sha256:hash(JSON.stringify(iljuBlock(report)))});
 const sameIlju={base:summarizedContext(baseInput,baseReport),alternate:summarizedContext(alternateInput,alternateReport),ilju_blocks_identical:JSON.stringify(iljuBlock(baseReport))===JSON.stringify(iljuBlock(alternateReport)),report_sections_identical:JSON.stringify(baseReport.sections)===JSON.stringify(alternateReport.sections),scope:'Same ilju literature block despite different natal context; not identical whole reports'};
 const sourcePaths=['app/src/data/profiles.ts','app/src/data/cities.ts','app/src/pages/InfoInput.tsx','app/src/engine/index.js','app/src/data/saju.ts','app/src/data/dosaTopics.ts','functions/api/dosa.ts','dosa-app/engine/src/manseryeok.js','dosa-app/engine/src/judge.js','dosa-app/engine/src/keyset.js','dosa-app/engine/src/report.js','dosa-app/engine/test/test_manseryeok.mjs','docs/knowledge-model/measure_product_readiness.mjs'];
 const value={schema_version:1,baseline_commit:'b2432b0',synthetic_clock_at:instant,scope:'Synthetic local app function execution; no provider invocation or observed-person outcome labels',input_sha256:hash(JSON.stringify(rows.map(({id,input})=>({id,input})))),source_sha256_lf:Object.fromEntries(sourcePaths.map(p=>[p,hash(readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n'))])),distilled_ilju_files:fs.length,character_drafts:characterDrafts,existing_capture:{rows:all.rows.length,known:all.rows.filter(r=>!r.profile.hourUnknown).length,unknown:all.rows.filter(r=>r.profile.hourUnknown).length,mocked_requests:all.rows.reduce((n,r)=>n+r.requests.length,0),assets:all.assets},rows,same_ilju_context_comparison:sameIlju};
 value.calculation_checks={command:'node dosa-app/engine/test/test_manseryeok.mjs',passed_checks:checksPassed,external_reference_chart_cases:1,held_out_evaluation:false,fixture:'1990-01-01 12:00 F Seoul; repository Forceteller snapshot',meaning:'Regression and fixture agreement, not measured personal predictive accuracy'};
 value.training_audit={command:'python3 docs/knowledge-model/case_review.py --compare',status:compare.status,models:compare.models,probability:compare.probability,case_count:compare.audit.case_count,eligible_count:compare.audit.eligible_count,excluded_count:compare.audit.excluded_count,blockers:compare.audit.blockers,exclusion_counts:compare.audit.exclusion_counts};
 value.source_case_audit={command:'python3 docs/knowledge-model/source_case_review.py --summary',...Object.fromEntries(['status','case_count','source_file_count','training_eligible_count','training_labels_created','probability','provenance'].map(k=>[k,sourceCases[k]]))};
 // JSON omits undefined optional UI fields; both modes compare the saved representation.
 const snapshot=JSON.parse(JSON.stringify(value));
 if(process.argv[2]==='--write') writeFileSync(output,JSON.stringify(snapshot,null,2)+'\n');
 else assert.deepEqual(snapshot,JSON.parse(readFileSync(output)), 'Product readiness snapshot drift');
 console.log(JSON.stringify({iljuFiles:fs.length,characterDrafts,rows:rows.map(r=>({id:r.id,headline:r.reading.headline,cards:r.reading.card_count,pillars:r.chart.pillars.map(p=>p.ganK+p.jiK),daeun:r.chart.daeun?.su??null,requests:r.mocked_consultation_requests}))},null,2));
}finally{await server.close();globalThis.Date=D;globalThis.fetch=oldFetch;rmSync(directory,{recursive:true,force:true});}
