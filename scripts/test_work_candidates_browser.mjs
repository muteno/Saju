// Real local React interaction; provider replies mocked and external URLs blocked.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.SAJU_ROOT||fileURLToPath(new URL('../',import.meta.url));
const out=process.env.QA_OUT||'/tmp/saju-work-candidates-browser';await mkdir(out,{recursive:true});
const{chromium}=await import(pathToFileURL(root+'/app/node_modules/playwright-core/index.mjs'));
const{createServer}=await import(pathToFileURL(root+'/app/node_modules/vite/dist/node/index.js'));
const server=await createServer({root:root+'/app',cacheDir:out+'/vite',logLevel:'silent',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--no-proxy-server','--disable-gpu']});
const results=[];
async function next(page){await page.evaluate(()=>document.activeElement?.blur());const b=page.getByRole('button',{name:/^(다음 이야기|한 번에 보기)$/});if(await b.count()){await b.click();return true;}const y=page.getByRole('button',{name:'그… 맞아',exact:true});if(await y.count()){await y.click();return true;}return false;}
async function until(page,fn){for(let i=0;i<150;i++){if(await fn())return;assert.ok(await next(page),'ended before target');}assert.fail('target missing');}
async function finish(page){for(let i=0;i<170;i++)if(!await next(page))return;assert.fail('dialogue not complete');}
const norm=s=>s.replace(/\s+/g,' ').trim();
async function open(width,mode,unknown=false){
 const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(8000);
 const x={context,page,requests:[],held:[],errors:[],external:[]};page.on('pageerror',e=>x.errors.push(e.message));
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==base){x.external.push(u.href);return route.abort();}if(u.pathname==='/api/dosa'){
  const body=route.request().postDataJSON();x.requests.push(body);
  if(mode!=='local'&&body.topic==='직업'&&!body.question){x.held.push({route,body});return;}
  return route.fulfill({status:503,json:{}});
 }return route.continue();});
 await page.goto(`${base}/talk?y=1980&mo=2&d=11&t=4:00&g=F&city=서울&sc=0&lz=0&hu=${unknown?1:0}&n=검수`);await page.getByRole('log').waitFor();
 x.model=await page.evaluate(async()=>{const{parseShare}=await import('/src/data/profiles.ts'),{buildReading}=await import('/src/engine/index.js'),{TOPICS}=await import('/src/data/dosaTopics.ts');const s=parseShare(location.search),r=buildReading(s.input);return{context:r.sections.find(s=>s.id==='context-reading')?.context,labels:Object.fromEntries(TOPICS.map(t=>[t.key,t.label]))};});return x;
}
async function save(id,x){const data={id,dom:await x.page.getByRole('log').innerText(),requests:x.requests,errors:x.errors,external:x.external,scrollWidth:await x.page.evaluate(()=>document.documentElement.scrollWidth)};await writeFile(`${out}/${id}.json`,JSON.stringify(data,null,2));await x.page.screenshot({path:`${out}/${id}.png`});results.push({id,requests:x.requests.length,errors:x.errors});return data;}
try{
 const baseline=process.argv.includes('--baseline');
 for(const width of[390,1280])for(const mode of baseline?['local']:['local','cached','early','late']){
  const x=await open(width,mode),{page}=x;try{
   const c=x.model.context,d=c.decision,button=page.getByRole('button',{name:x.model.labels['직업'],exact:true});await until(page,()=>button.count());
   if(mode!=='cached')await button.click();
   if(mode!=='local'){
    for(let i=0;i<150&&!x.held.length;i++)await page.waitForTimeout(25);assert.ok(x.held.length);
    if(mode==='late')await until(page,async()=>norm(await page.getByRole('log').innerText()).includes(norm(d.interpretation)));
    const text=[...d.lines,d.question.prompt,'사용자 경험을 확인하기 전의 생성 예시예요.'].join('\n\n');
    await x.held[0].route.fulfill({status:200,json:{text}});await page.waitForTimeout(150);
    if(mode==='cached')await button.click();
   }
   await finish(page);const text=norm(await page.getByRole('log').innerText());
   if(!baseline){for(const line of d.lines)assert.equal(text.split(norm(line)).length-1,1);assert.equal(text.split(d.question.prompt).length-1,1);}
   const data=await save(`${baseline?'before':'after'}-chat-${width}-${mode}`,x);assert.equal(data.scrollWidth,width);assert.deepEqual(x.errors,[]);assert.deepEqual(x.external,[]);
  }finally{await x.context.close();}
 }
 if(!baseline)for(const[answer,pattern]of[['맞아요.',/풀이’를 유지해요/],['반대예요.',/반대 경험을 반영/],['경험이 없어요.',/개인에게 적용하는 판단은 보류/],['말하고 싶지 않아요.',/답하지 않은 상태/]]){
  const x=await open(390,'local'),{page}=x;try{const d=x.model.context.decision,button=page.getByRole('button',{name:x.model.labels['직업'],exact:true});await until(page,()=>button.count());await button.click();await until(page,async()=>norm(await page.getByRole('log').innerText()).includes(d.question.prompt));
   const freeBefore=x.requests.filter(r=>r.question).length;
   await page.getByRole('textbox',{name:'도사에게 직접 묻기'}).fill(answer);await page.getByRole('button',{name:'보내기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('textarea')?.readOnly===false);await finish(page);
   const data=await save('feedback-'+answer.replace(/[. ]/g,''),x);assert.match(data.dom,pattern);assert.equal(x.requests.filter(r=>r.question).length,freeBefore);assert.equal(norm(data.dom).split(d.question.prompt).length-1,1);assert.deepEqual(x.errors,[]);
  }finally{await x.context.close();}
 }
 if(!baseline){const x=await open(390,'local',true);try{await x.page.getByRole('textbox',{name:'도사에게 직접 묻기'}).fill('반대예요.');await x.page.getByRole('button',{name:'보내기',exact:true}).click();await finish(x.page);await save('unknown',x);assert.equal(x.requests.length,0);assert.equal(x.model.context,undefined);}finally{await x.context.close();}}
}finally{await writeFile(out+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();await server.close();}
