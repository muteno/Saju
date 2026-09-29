// Regression: a three-sentence owned notice was split and duplicated on late replies.
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '../app/node_modules/playwright-core/index.mjs';
import {createServer} from '../app/node_modules/vite/dist/node/index.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=process.env.QA_OUT||'/tmp/saju-strength-notice';await mkdir(out,{recursive:true});
const server=await createServer({root:root+'/app',logLevel:'silent',server:{host:'127.0.0.1',port:0,watch:null}});await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
async function next(page){const b=page.getByRole('button',{name:/^(다음 이야기|한 번에 보기)$/});if(await b.count()){await b.click();return true;}const y=page.getByRole('button',{name:'그… 맞아',exact:true});if(await y.count()){await y.click();return true;}return false;}
try{
 for(const width of [390,1280])for(const timing of ['selection','intro']){
  const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'}),held=[],errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin!==base){external.push(url.origin);return route.abort();}
   if(url.pathname==='/api/dosa'){
    const body=route.request().postDataJSON();if(body.topic==='성격'&&!body.question){held.push({route,body});return;}return route.fulfill({status:503,json:{}});
   }return route.continue();
  });
  await page.goto(base+'/talk?y=2024&mo=2&d=20&t=12:00&g=F&city=서울&sc=0&lz=0&hu=0&n=검수');await page.getByRole('log').waitFor();
  const note=await page.evaluate(async()=>(await import('/src/engine/vendor/contextReading.js')).CONTEXT_READING_NOTICE);
  assert.ok(note.includes('앱의 잠정 계산 기준으로 본 강약'));assert.equal(note.split(/(?<=[.?!…])\s+/).length,2);
  const label=await page.evaluate(async()=>(await import('/src/data/dosaTopics.ts')).TOPICS.find(t=>t.key==='성격').label);
  const choice=page.getByRole('button',{name:label,exact:true});for(let i=0;i<75&&!await choice.count();i++)assert.ok(await next(page));await choice.click();
  for(let i=0;!held.length&&i<100;i++)await page.waitForTimeout(25);assert.ok(held.length);
  if(timing==='intro')assert.ok(await next(page));
  const response=Array.from({length:12},(_,i)=>`성격 생성 검수 본문 ${i+1}을 확인해요.`).join('\n\n');
  await held[0].route.fulfill({status:200,json:{text:response}});await page.waitForTimeout(100);
  for(let i=0;i<90;i++)if(!await next(page))break;
  const text=await page.getByRole('log').innerText();
  assert.equal(text.split(note).length-1,1,'Entire two-sentence notice exactly once');
  for(const clause of ['앱의 잠정 계산 기준으로 본 강약','점수는 능력이나 확률이 아니며','기운의 세기를 확정하지 않으니'])assert.equal(text.split(clause).length-1,1,clause);
  assert.ok(text.includes('성격 생성 검수 본문 12을 확인해요.'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await writeFile(`${out}/notice-${timing}-${width}.json`,JSON.stringify({note,text,errors,external},null,2));results.push({width,timing,noticeCount:1,provisionalClauseCount:1,errors:0});await page.close();
 }
}finally{await writeFile(`${out}/notice-results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();await server.close();}
