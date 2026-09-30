import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
// Run from scripts/ or set SAJU_ROOT. API responses are mocked; all external requests abort.
// Known limitation: sentence-middle truncations/paraphrases are outside exact-owned-line normalization.
const root=process.env.SAJU_ROOT||fileURLToPath(new URL('../',import.meta.url));
const out=process.env.QA_OUT||'/tmp/saju-compound-browser';
const {chromium}=await import(pathToFileURL(root+'/app/node_modules/playwright-core/index.mjs').href);
const {createServer}=await import(pathToFileURL(root+'/app/node_modules/vite/dist/node/index.js').href);
await mkdir(out,{recursive:true});
const tracked=['app/src/data/dosaClient.ts','app/src/components/DosaChat.tsx','app/src/engine/vendor/contextReading.js','dosa-app/engine/src/contextReading.js'];
const hashes=async()=>Object.fromEntries(await Promise.all(tracked.map(async f=>[f,createHash('sha256').update(await readFile(root+'/'+f)).digest('hex')])));
const beforeHashes=await hashes();
const server=await createServer({root:root+'/app',cacheDir:out+'/vite-cache',logLevel:'silent',server:{host:'127.0.0.1',port:0,watch:null}});await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],env:{...process.env,FONTCONFIG_PATH:process.env.FONTCONFIG_PATH||'/etc/fonts'}});
const results=[];
const dates=[{id:'2023-05-14',y:2023,mo:5,d:14,ilju:'임신',same:false},{id:'2024-02-05',y:2024,mo:2,d:5,t:'10:00',ilju:'기해',same:false}];
const norm=s=>s.replace(/(?:도사|나):/g,'').replace(/\s+/g,' ').trim();
const clauses=s=>s.split(/(?<=[.?!…])\s+/).filter(Boolean);
const count=(text,part)=>norm(text).split(norm(part)).length-1;
async function next(page){await page.evaluate(()=>document.activeElement?.blur());const b=page.getByRole('button',{name:/^(다음 이야기|한 번에 보기)$/});if(await b.count()){await b.click();return true;}const y=page.getByRole('button',{name:'그… 맞아',exact:true});if(await y.count()){await y.click();return true;}return false;}
async function until(page,fn){for(let i=0;i<130;i++){if(await fn())return;assert.ok(await next(page),'dialogue ended before target');}assert.fail('target not reached');}
async function finish(page){for(let i=0;i<150;i++)if(!await next(page))return;assert.fail('dialogue never completed');}
async function waitHeld(x){for(let i=0;i<240&&!x.held.length;i++)await x.page.waitForTimeout(25);assert.ok(x.held.length,'mock API request was made');}
async function open(date,width,target='직업',unknown=false){
 const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await context.newPage();page.setDefaultTimeout(7000);
 const x={page,context,requests:[],held:[],errors:[],external:[],aborted:[]};
 page.on('pageerror',e=>x.errors.push(e.message));
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==base){x.external.push(u.href);await route.abort();x.aborted.push(u.href);return;}
 if(u.pathname==='/api/dosa'){const body=route.request().postDataJSON();x.requests.push(body);if(body.topic===target&&!body.question){x.held.push({route,body});return;}return route.fulfill({status:503,json:{}});}return route.continue();});
 await page.goto(`${base}/talk?y=${date.y}&mo=${date.mo}&d=${date.d}&t=${date.t??'12:00'}&g=F&city=서울&sc=0&lz=0&hu=${unknown?1:0}&n=검수`);await page.getByRole('log').waitFor();
 x.model=await page.evaluate(async()=>{const {parseShare}=await import('/src/data/profiles.ts'),{buildReading}=await import('/src/engine/index.js'),{topicLines,TOPICS}=await import('/src/data/dosaTopics.ts'),{readingNotices,readingFollowups}=await import('/src/data/dosaClient.ts');const s=parseShare(location.search),r=buildReading(s.input),c=r.sections.find(s=>s.id==='context-reading')?.context;return {input:s.input,context:c,labels:Object.fromEntries(TOPICS.map(t=>[t.key,t.label])),workLines:topicLines(r,'직업'),personalityLines:topicLines(r,'성격'),notices:readingNotices(r,topicLines(r,'성격')),followups:readingFollowups(r,topicLines(r,'직업'))};});
 return x;
}
async function save(id,x,details){const rawText=await x.page.getByRole('log').innerText();const docWidth=await x.page.evaluate(()=>document.documentElement.scrollWidth);const data={id,...details,rawText,docWidth,requests:x.requests,model:x.model,errors:x.errors,external:x.external,aborted:x.aborted};await writeFile(`${out}/${id}.json`,JSON.stringify(data,null,2)+'\n');await x.page.screenshot({path:`${out}/${id}.png`});return data;}
function audit(data,fn){try{fn();data.result='PASS';}catch(e){data.result='FAIL';data.failure=e.stack;}results.push({id:data.id,result:data.result,failure:data.failure,counts:data.counts,questionCounts:data.questionCounts,clauseCounts:data.clauseCounts,docWidth:data.docWidth,errors:data.errors,external:data.external});return data;}
async function commit(data,x){await writeFile(`${out}/${data.id}.json`,JSON.stringify(data,null,2)+'\n');console.log(`${data.result} ${data.id}${data.failure?' '+data.failure.split('\n')[0]:''}`);await x.context.close();}
try{
 for(const date of dates)for(const width of [390,1280])for(const mode of ['cached','early','after-body','after-question']){
  const id=`work-${date.id}-${width}-${mode}`,x=await open(date,width),{page}=x,log=page.getByRole('log');
  try{
   const c=x.model.context;assert.equal(c.dayPillar,date.ilju);assert.equal(c.monthDayCompound.status,'present');assert.equal(c.monthMain.group===c.monthDayCompound.dayMain.group,date.same);
   const facts=c.monthDayCompound.facts,questions=c.experienceQuestions.map(q=>q.prompt),limit=x.model.followups.at(-1);assert.equal(clauses(facts).length,2);assert.equal(questions.length,3);
   const choice=page.getByRole('button',{name:x.model.labels['직업'],exact:true});await until(page,()=>choice.count());if(mode==='cached')await waitHeld(x);else{await choice.click();await waitHeld(x);}
   const grounds=x.held[0].body.grounds.map(g=>g.text);assert.ok(grounds.includes(facts));assert.ok(grounds.includes(c.monthDayCompound.interpretation));assert.ok(grounds.includes(questions[1]));
   if(mode==='after-body')await until(page,async()=>count(await log.innerText(),grounds[0])>0);
   if(mode==='after-question')await until(page,async()=>count(await log.innerText(),questions[0])>0);
   const generatedBody=Array.from({length:12},(_,i)=>`별도 생성 본문 ${i+1}을 확인해요.`);
   const response=[questions[2]+' '+facts+' '+questions[0],generatedBody[0]+' '+clauses(questions[1]).join('\n\n'),clauses(facts).join('\n\n'),questions[0]+' '+questions[1]+' '+limit,...generatedBody.slice(1),...clauses(questions[2])].join('\n\n');
   await x.held[0].route.fulfill({status:200,json:{text:response}});await page.waitForTimeout(200);if(mode==='cached')await choice.click();await finish(page);
   const rawText=await log.innerText(),questionCounts=questions.map(q=>count(rawText,q)),clauseCounts=questions.map(q=>clauses(q).map(s=>count(rawText,s))),counts={facts:count(rawText,facts),factClauses:clauses(facts).map(s=>count(rawText,s)),limit:count(rawText,limit),interpretation:count(rawText,c.monthDayCompound.interpretation)};
   const data=await save(id,x,{date,width,mode,response,questionCounts,clauseCounts,counts});audit(data,()=>{assert.deepEqual(questionCounts,[1,1,1]);for(const qs of clauseCounts)for(const n of qs)assert.equal(n,1);assert.equal(counts.facts,1);assert.deepEqual(counts.factClauses,[1,1]);assert.equal(counts.limit,1);const positions=questions.map(q=>norm(rawText).indexOf(norm(q)));assert.ok(positions[0]<positions[1]&&positions[1]<positions[2]);const generated=mode==='cached'||mode==='early';assert.equal(rawText.includes(generatedBody[0]),generated);assert.equal(rawText.includes(generatedBody[11]),generated);assert.equal(counts.interpretation,generated?0:1);if(generated)assert.ok(norm(rawText).indexOf(generatedBody[11])<positions[0]);else assert.ok(norm(rawText).indexOf(norm(c.monthDayCompound.interpretation))<positions[0]);assert.equal(x.requests.filter(r=>r.topic==='직업'&&!r.question).length,1);assert.equal(data.docWidth,width);assert.deepEqual(x.errors,[]);assert.deepEqual(x.external,[]);});await commit(data,x);
  }catch(e){const data=await save(id,x,{date,width,mode,result:'ERROR',failure:e.stack});results.push({id,result:'ERROR',failure:e.stack});console.log(`ERROR ${id} ${e.message}`);await x.context.close();}
 }
 for(const date of dates)for(const width of [390,1280])for(const mode of ['selection','after-intro','after-body']){
  const id=`nonwork-${date.id}-${width}-${mode}`,x=await open(date,width,'성격'),{page}=x;
  try{
   const facts=x.model.context.monthDayCompound.facts;assert.ok(x.model.notices.includes(facts));const choice=page.getByRole('button',{name:x.model.labels['성격'],exact:true});await until(page,()=>choice.count());await choice.click();await waitHeld(x);
   if(mode==='after-intro')assert.ok(await next(page));
   if(mode==='after-body'){assert.ok(await next(page));assert.ok(await next(page));}
   const generatedBody=Array.from({length:12},(_,i)=>`성격 검수 생성 본문 ${i+1}을 확인해요.`);
   const response=[facts,generatedBody[0]+' '+clauses(facts).join('\n\n'),...generatedBody.slice(1)].join('\n\n');await x.held[0].route.fulfill({status:200,json:{text:response}});await page.waitForTimeout(200);await finish(page);
   const rawText=await page.getByRole('log').innerText(),counts={facts:count(rawText,facts),factClauses:clauses(facts).map(s=>count(rawText,s))};const data=await save(id,x,{date,width,mode,response,counts});audit(data,()=>{assert.equal(counts.facts,1);assert.deepEqual(counts.factClauses,[1,1]);assert.ok(rawText.includes(generatedBody[11]));assert.equal(data.docWidth,width);assert.deepEqual(x.errors,[]);assert.deepEqual(x.external,[]);});await commit(data,x);
  }catch(e){const data=await save(id,x,{date,width,mode,result:'ERROR',failure:e.stack});results.push({id,result:'ERROR',failure:e.stack});console.log(`ERROR ${id} ${e.message}`);await x.context.close();}
 }
 for(const date of dates)for(const width of [390,1280]){
  const id=`unknown-${date.id}-${width}`,x=await open(date,width,'직업',true),{page}=x;
  try{await page.getByRole('textbox',{name:'도사에게 직접 묻기'}).fill('태어난 시간을 몰라도 월지와 일지의 합과 파를 알려줘요.');await page.getByRole('button',{name:'보내기',exact:true}).click();await finish(page);await page.waitForTimeout(1400);const data=await save(id,x,{date,width,mode:'unknown'});audit(data,()=>{assert.equal(x.requests.length,0);assert.equal(x.model.context,undefined);assert.match(data.rawText,/출생 시간/);assert.doesNotMatch(data.rawText,/사신합|인해합|두 주제를 연결해/);assert.equal(data.docWidth,width);assert.deepEqual(x.errors,[]);assert.deepEqual(x.external,[]);});await commit(data,x);}catch(e){const data=await save(id,x,{date,width,mode:'unknown',result:'ERROR',failure:e.stack});results.push({id,result:'ERROR',failure:e.stack});console.log(`ERROR ${id} ${e.message}`);await x.context.close();}
 }
}finally{const afterHashes=await hashes();const summary={base,browser:browser.version(),beforeHashes,afterHashes,sourceUnchanged:JSON.stringify(beforeHashes)===JSON.stringify(afterHashes),results,totals:{pass:results.filter(r=>r.result==='PASS').length,fail:results.filter(r=>r.result==='FAIL').length,error:results.filter(r=>r.result==='ERROR').length}};await writeFile(out+'/results.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary.totals));await browser.close();await server.close();if(summary.totals.fail||summary.totals.error||!summary.sourceUnchanged)process.exitCode=1;}
