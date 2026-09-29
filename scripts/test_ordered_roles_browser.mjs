import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../app/node_modules/playwright-core/index.mjs';
import { createServer } from '../app/node_modules/vite/dist/node/index.js';
const root=fileURLToPath(new URL('../',import.meta.url)), out=process.env.QA_OUT||'/tmp/saju-ordered-browser';
await mkdir(out,{recursive:true});
const server=await createServer({root:root+'/app',logLevel:'silent',server:{host:'127.0.0.1',port:0,watch:null}});await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
const dates=[{id:'2024-03-09-12',mo:3,d:9,t:'12:00',width:390,q1:'최근 직접 만들거나 실행한 일부터 떠올려 볼까요?'},{id:'2024-05-08-08',mo:5,d:8,t:'08:00',width:1280,q1:'최근 맡은 목표나 쓸 수 있는 시간·비용부터 떠올려 볼까요?'}];
const normalize=s=>s.replace(/(?:도사|나):/g,'').replace(/\s+/g,' ').trim();
const clauses=s=>s.split(/(?<=[.?!…])\s+/).filter(Boolean);
async function next(page){
 await page.evaluate(()=>document.activeElement?.blur());
 const b=page.getByRole('button',{name:/^(다음 이야기|한 번에 보기)$/});if(await b.count()){await b.click();return true;}
 const y=page.getByRole('button',{name:'그… 맞아',exact:true});if(await y.count()){await y.click();return true;}return false;
}
async function until(page,fn){for(let i=0;i<100;i++){if(await fn())return;assert.ok(await next(page),'dialogue ended before requested content');}assert.fail('never reached target');}
async function waitHeld(page,held){for(let i=0;i<200&&!held.length;i++)await page.waitForTimeout(25);assert.ok(held.length,'work request');}
async function open(date,unknown=false){
 const page=await browser.newPage({viewport:{width:date.width,height:844},reducedMotion:'reduce'});page.setDefaultTimeout(7000);
 const requests=[],held=[],errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin!==base){external.push(u.origin);return route.abort();}
  if(u.pathname==='/api/dosa'){
   const body=route.request().postDataJSON();requests.push(body);
   if(body.topic==='직업'&&!body.question){held.push({route,body});return;}
   return route.fulfill({status:503,json:{}});
  }return route.continue();
 });
 await page.goto(`${base}/talk?y=2024&mo=${date.mo}&d=${date.d}&t=${date.t}&g=F&city=서울&sc=0&lz=0&hu=${unknown?1:0}&n=검수`);
 await page.getByRole('log').waitFor();return {page,requests,held,errors,external};
}
async function save(id,x,details){
 const dom=await x.page.getByRole('log').innerText();
 await writeFile(`${out}/${id}.json`,JSON.stringify({...details,requests:x.requests,dom,errors:x.errors,external:x.external},null,2)+'\n');
 await x.page.screenshot({path:`${out}/${id}.png`});
 assert.deepEqual(x.errors,[]);assert.deepEqual(x.external,[]);
 results.push({id,...details,errors:0,external:0});await x.page.close();
}
try{
 for(const date of dates)for(const mode of ['cached','early','after-body','after-question']){
  const x=await open(date),{page,held}=x,log=page.getByRole('log');
  const label=await page.evaluate(async()=>(await import('/src/data/dosaTopics.ts')).TOPICS.find(t=>t.key==='직업').label);
  const choice=page.getByRole('button',{name:label,exact:true});await until(page,()=>choice.count());
  if(mode==='cached')await waitHeld(page,held);else {await choice.click();await waitHeld(page,held);}
  const grounds=held[0].body.grounds.map(g=>g.text),limitIndex=grounds.findIndex(t=>t.startsWith('답을 통해 실제 맡은 역할'));
  assert.ok(limitIndex>=3);const questions=grounds.slice(limitIndex-3,limitIndex),limit=grounds[limitIndex];
  assert.equal(questions.length,3);assert.ok(questions[0].startsWith(date.q1),`${date.id}: changed ordered question`);
  const synthesis=grounds.find(t=>t.includes('및 시간')&&t.includes('이는 두 자리를 구별하는 풀이 순서'));
  assert.ok(synthesis,'new ordered synthesis in live request');
  if(mode==='after-body')await until(page,async()=>normalize(await log.innerText()).includes(normalize(grounds[0])));
  if(mode==='after-question')await until(page,async()=>normalize(await log.innerText()).includes(normalize(questions[0])));
  // Maliciously copy complete questions and individual clauses, interleave with body,
  // and invert their initial order. Exact owned wording must only survive once at end.
  const body=Array.from({length:12},(_,i)=>`독립 검토 생성 본문 ${i+1}을 확인해요.`);
  const response=[questions[2]+' '+questions[0],body[0]+' '+clauses(questions[1]).join('\n\n'),questions[0]+' '+questions[1]+' '+limit,...body.slice(1),...clauses(questions[2])].join('\n\n');
  await held[0].route.fulfill({status:200,json:{text:response}});await page.waitForTimeout(200);
  if(mode==='cached')await choice.click();
  for(let i=0;i<120;i++)if(!await next(page))break;
  const rawText=await log.innerText(),text=normalize(rawText),counts=questions.map(q=>text.split(normalize(q)).length-1);
  await writeFile(`${out}/${date.id}-${mode}-preassert.json`,JSON.stringify({questions,limit,synthesis,response,rawText,text,counts,grounds,errors:x.errors},null,2)+'\n');
  await page.screenshot({path:`${out}/${date.id}-${mode}-preassert.png`});
  assert.deepEqual(counts,[1,1,1],`${date.id} ${mode} full questions normalized exactly once`);
  for(const q of questions)for(const c of clauses(q))assert.equal(text.split(normalize(c)).length-1,1,`${mode} clause exactly once: ${c}`);
  const positions=questions.map(q=>text.indexOf(normalize(q)));assert.ok(positions[0]<positions[1]&&positions[1]<positions[2]);
  assert.equal(text.split(normalize(limit)).length-1,1,'followup limitation exactly once');
  const generated=mode==='cached'||mode==='early';
  assert.equal(text.includes(body[0]),generated);assert.equal(text.includes(body[11]),generated);
  if(generated)assert.ok(text.indexOf(body[11])<positions[0],'complete generated body precedes questions');
  else {assert.ok(text.includes(normalize(synthesis)));assert.ok(text.indexOf(normalize(synthesis))<positions[0]);}
  assert.equal(x.requests.filter(r=>r.topic==='직업'&&!r.question).length,1,'cache request must not duplicate');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),date.width);
  await save(`${date.id}-${mode}`,x,{mode,width:date.width,questionCounts:counts,questions,ordered:true,body:generated?'generated':'local',requestCount:1});
  console.log(`PASS ${date.id} ${mode}`);
 }
 for(const date of dates){
  const x=await open(date,true),{page}=x;
  await page.getByRole('textbox',{name:'도사에게 직접 묻기'}).fill('태어난 시간을 모르는 상태에서 일을 물어봐요.');await page.getByRole('button',{name:'보내기',exact:true}).click();
  for(let i=0;i<20;i++)if(!await next(page))break;
  await page.waitForTimeout(1400);assert.equal(x.requests.length,0);assert.match(await page.getByRole('log').innerText(),/출생 시간/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),date.width);
  await save(`${date.id}-unknown`,x,{mode:'unknown',width:date.width,requests:0});console.log(`PASS ${date.id} unknown request0`);
 }
}catch(e){await writeFile(out+'/failure.txt',e.stack+'\n');throw e;}
finally{await writeFile(out+'/results.json',JSON.stringify(results,null,2)+'\n');await browser.close();await server.close();}
