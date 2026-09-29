// Real local React chat: free experience answers after the owned work question.
// Provider replies are mocked and external URLs blocked. --baseline only captures.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.SAJU_ROOT||fileURLToPath(new URL('../',import.meta.url));
const baseline=process.argv.includes('--baseline'),label=baseline?'before':'after';
const out=process.env.QA_OUT||'/tmp/saju-work-feedback-browser';await mkdir(out,{recursive:true});
const{chromium}=await import(pathToFileURL(root+'/app/node_modules/playwright-core/index.mjs'));
const{createServer}=await import(pathToFileURL(root+'/app/node_modules/vite/dist/node/index.js'));
const server=await createServer({root:root+'/app',cacheDir:out+'/vite-'+label,logLevel:'silent',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--no-proxy-server','--disable-gpu']});
const PROVIDER='(모의 공급자) 말해 준 경험을 일반 상담으로 이어서 볼게요.';
const DEMAND_Q='성과나 자원을 늘린 일이 해결해야 할 요구·과제도 함께 늘린 경험이 있나요?';
const norm=s=>s.replace(/\s+/g,' ').trim();
const results=[];
async function next(page){await page.evaluate(()=>document.activeElement?.blur());const b=page.getByRole('button',{name:/^(다음 이야기|한 번에 보기)$/});if(await b.count()){await b.click();return true;}const y=page.getByRole('button',{name:'그… 맞아',exact:true});if(await y.count()){await y.click();return true;}return false;}
async function until(page,fn){for(let i=0;i<150;i++){if(await fn())return;assert.ok(await next(page),'ended before target');}assert.fail('target missing');}
const logText=async page=>norm(await page.getByRole('log').innerText());
const untilText=(page,text)=>until(page,async()=>(await logText(page)).includes(norm(text)));
async function open(width,hour,unknown=false){
 const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(8000);
 const x={context,page,requests:[],errors:[],external:[]};page.on('pageerror',e=>x.errors.push(e.message));
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==base){x.external.push(u.href);return route.abort();}if(u.pathname==='/api/dosa'){
  const body=route.request().postDataJSON();x.requests.push(body);
  return body.question?route.fulfill({status:200,json:{text:PROVIDER}}):route.fulfill({status:503,json:{}});
 }return route.continue();});
 await page.goto(`${base}/talk?y=1980&mo=2&d=11&t=${hour}:00&g=F&city=서울&sc=0&lz=0&hu=${unknown?1:0}&n=검수`);await page.getByRole('log').waitFor();
 x.model=await page.evaluate(async()=>{const{parseShare}=await import('/src/data/profiles.ts'),{buildReading}=await import('/src/engine/index.js'),{TOPICS}=await import('/src/data/dosaTopics.ts');const s=parseShare(location.search),r=buildReading(s.input);return{context:r.sections.find(s=>s.id==='context-reading')?.context,labels:Object.fromEntries(TOPICS.map(t=>[t.key,t.label]))};});
 return x;
}
async function openWork(x){const button=x.page.getByRole('button',{name:x.model.labels['직업'],exact:true});await until(x.page,()=>button.count());await button.click();await untilText(x.page,x.model.context.decision.question.prompt);}
async function send(x,text){const before=x.requests.length;await x.page.getByRole('textbox',{name:'도사에게 직접 묻기'}).fill(text);await x.page.getByRole('button',{name:'보내기',exact:true}).click();await x.page.waitForFunction(()=>document.querySelector('textarea')?.readOnly===false);return x.requests.length-before;}
const questions=x=>x.requests.filter(r=>r.question).length;
async function save(id,x){await x.page.getByRole('log').evaluate(el=>{el.scrollTop=el.scrollHeight;});await x.page.waitForTimeout(150);const data={id,label,dom:await x.page.getByRole('log').innerText(),requests:x.requests,errors:x.errors,external:x.external,scrollWidth:await x.page.evaluate(()=>document.documentElement.scrollWidth)};await writeFile(`${out}/${id}-${label}.json`,JSON.stringify(data,null,2));await x.page.screenshot({path:`${out}/${id}-${label}.png`});results.push({id,label,requests:x.requests.length,questions:questions(x),errors:x.errors});assert.deepEqual(x.errors,[]);assert.deepEqual(x.external,[]);assert.equal(data.scrollWidth,x.page.viewportSize().width);return data;}
const COMPOUND='처음에는 도움이 됐는데 일이 커지면서 오히려 부담이 늘었어';
try{
 // 1) One compound answer at 390/1280: before = generic provider chat, after = split revision.
 for(const width of[390,1280]){const x=await open(width,4);try{await openWork(x);await send(x,COMPOUND);
  await untilText(x.page,baseline?PROVIDER:'두 범위를 가르는 조건은 명식이 아니라 말해 준 경험에서 왔어요.');
  const data=await save(`feedback-compound-${width}`,x);
  if(!baseline){assert.equal(questions(x),0);assert.match(data.dom,/부분은 도움이 된 경험/);assert.match(data.dom,/좁혀 읽어요/);}
 }finally{await x.context.close();}}
 // 2) Bare no → one clarifying question → no experience → the not-yet-asked demand question → answer.
 {const x=await open(390,4);try{await openWork(x);const d=x.model.context.decision;
  if(baseline){await send(x,'아니요');await untilText(x.page,PROVIDER);await save('feedback-chain-390',x);}
  else{
   await send(x,'아니요');await untilText(x.page,'두 가지로 읽혀요');await save('feedback-clarify-390',x);
   await send(x,'경험이 없어요');await untilText(x.page,DEMAND_Q);
   await send(x,'네, 일이 많이 늘었어요');await untilText(x.page,'그대로예요');
   const data=await save('feedback-chain-390',x);const dom=norm(data.dom);
   assert.equal(questions(x),0);assert.equal(dom.split(norm(d.question.prompt)).length-1,1);assert.equal(dom.split(DEMAND_Q).length-1,1);
   assert.match(dom,/해결할 일도 함께 늘었다는 부분은 말해 준 경험 범위에서 받아들여요/);
  }
 }finally{await x.context.close();}}
 // 3) Same opposite answer on the 06:00 chart (hurting officer, no food) ends differently.
 {const x=await open(390,6);try{await openWork(x);assert.equal(x.model.context.decision.mode,'resource-demand');await send(x,'반대예요.');
  await untilText(x.page,baseline?'반대 경험을 반영':'이 천간 비교로는 말해 준 경험을 설명하지 못해요.');
  const data=await save('feedback-06-390',x);if(!baseline){assert.equal(questions(x),0);assert.doesNotMatch(data.dom,/요구·과제도 함께 늘린 경험이 있나요\?[\s\S]*요구·과제도 함께 늘린 경험이 있나요\?/);}
 }finally{await x.context.close();}}
 if(!baseline){
  // 4) After the menu question, a short answer is not attached to the work question.
  {const x=await open(390,4);try{await openWork(x);await untilText(x.page,'또 궁금한 것이 있는가?');assert.equal(await send(x,'네'),1);await untilText(x.page,PROVIDER);await save('menu-yes',x);}finally{await x.context.close();}}
  // 4b) A content answer after the menu line still answers the shown question.
  {const x=await open(390,4);try{await openWork(x);await untilText(x.page,'또 궁금한 것이 있는가?');assert.equal(await send(x,COMPOUND),0);await untilText(x.page,'좁혀 읽어요');await save('menu-content',x);}finally{await x.context.close();}}
  // 4c) Answering after the app's guidance paragraph is shown.
  {const x=await open(390,4);try{await openWork(x);const footer=x.model.context.blocks.at(-1).lines.at(-1);await untilText(x.page,footer);assert.equal(await send(x,'반대예요.'),0);await untilText(x.page,DEMAND_Q);await save('after-footer',x);}finally{await x.context.close();}}
  // 5) Another topic resets the conversation scope.
  {const x=await open(390,4);try{await openWork(x);await untilText(x.page,'또 궁금한 것이 있는가?');const other=x.page.getByRole('button',{name:x.model.labels['성격'],exact:true});await other.click();await until(x.page,async()=>(await logText(x.page)).endsWith('또 궁금한 것이 있는가?')&&(await logText(x.page)).split('또 궁금한 것이 있는가?').length>2);
   assert.equal(await send(x,'반대예요.'),1);await untilText(x.page,PROVIDER);await save('other-topic',x);}finally{await x.context.close();}}
  // 6) Unknown birth time: no chart reading, no request.
  {const x=await open(390,4,true);try{await send(x,COMPOUND);await save('unknown',x);assert.equal(x.requests.length,0);assert.equal(x.model.context,undefined);}finally{await x.context.close();}}
 }
}finally{await writeFile(`${out}/results-${label}.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();await server.close();}
