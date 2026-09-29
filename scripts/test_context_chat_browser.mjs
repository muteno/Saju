// Real React queue regression; every provider response is local and mocked.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '../app/node_modules/playwright-core/index.mjs';
import { createServer } from '../app/node_modules/vite/dist/node/index.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=process.env.QA_OUT||'/tmp/saju-synthesis-chat';await mkdir(out,{recursive:true});
const server=await createServer({root:root+'app',logLevel:'silent',server:{host:'127.0.0.1',port:0,watch:null}});await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
const next=async page=>{
  const button=page.getByRole('button',{name:/^(다음 이야기|한 번에 보기)$/});
  if(await button.count()){await button.click();return true;}
  const yes=page.getByRole('button',{name:'그… 맞아',exact:true});
  if(await yes.count()){await yes.click();return true;}
  return false;
};
try{
  for(const mode of ['early','after-question']){
    const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const held=[];
    await page.route('**/api/dosa',async route=>{
      const body=route.request().postDataJSON();
      if(body.topic==='직업'&&!body.question){held.push({route,body});return;}
      await route.fulfill({status:503,json:{}});
    });
    await page.goto(`${base}/talk?y=2024&mo=2&d=20&t=12:00&g=F&city=서울&sc=0&lz=0&hu=0&n=검수`);
    const log=page.getByRole('log');await log.waitFor();
    // Labels are read from the app's topic definition to avoid drift.
    const label=await page.evaluate(async()=> (await import('/src/data/dosaTopics.ts')).TOPICS.find(t=>t.key==='직업').label);
    const choice=page.getByRole('button',{name:label,exact:true});
    for(let i=0;i<45&&!(await choice.count());i++)assert.ok(await next(page),'opening must reach topics');
    await choice.waitFor();
    // In early mode release only after selection: exercise the late-response branch
    // before any substantive fallback line is read, rather than a cache hit.
    await choice.click();
    const started=Date.now();while(!held.length&&Date.now()-started<5000)await page.waitForTimeout(50);
    assert.ok(held.length,'work request must be held');
    const ground=held[0].body.grounds;
    const q1=ground.find(g=>g.text.startsWith('최근 맡은 일에서 스스로 정한 부분')).text;
    const q2=ground.find(g=>g.text.startsWith('표현·실행, 결과·자원 관리')).text;
    const q3=ground.find(g=>g.text.startsWith('최근 자기 판단대로 진행한 일')).text;
    const limit=ground.find(g=>g.text.startsWith('답을 통해 실제 맡은 역할')).text;
    if(mode==='after-question'){
      for(let i=0;i<50&&!(await log.innerText()).includes(q1);i++)assert.ok(await next(page),'must reach first question');
      assert.ok((await log.innerText()).includes(q1));
    }
    const response=`${q1} ${q2} ${q3} ${limit}\n\n`+Array.from({length:12},(_,i)=>`생성 본문 ${i+1}을 확인해요.`).join('\n\n');
    await held[0].route.fulfill({status:200,json:{text:response}});
    await page.waitForTimeout(150);
    for(let i=0;i<70;i++){if(!await next(page))break;}
    const text=await log.innerText();
    assert.equal(text.split(q1).length-1,1,`${mode}: first question exactly once`);
    assert.equal(text.split(q2).length-1,1,`${mode}: second question exactly once`);
    assert.equal(text.split(q3).length-1,1,`${mode}: third question exactly once`);
    assert.ok(text.indexOf(q2)<text.indexOf(q3),`${mode}: third question after second`);
    assert.equal(text.split(limit).length-1,1,`${mode}: question limit exactly once`);
    if(mode==='early'){
      assert.ok(text.includes('생성 본문 1을 확인해요.'));
      assert.ok(text.indexOf('생성 본문 12을 확인해요.')<text.indexOf(q1),'generated body before follow-up questions');
    }else{
      assert.ok(!text.includes('생성 본문'),'started local reading must finish without a late replacement');
      assert.ok(text.includes('월지 본기 甲(비견) 및 시간 庚(편관)의 조합에서는'));
      assert.ok(text.indexOf('식상을 어디까지 세는지 원문에서 확정하지 못했어요.')<text.indexOf(q1),'all local conditions precede follow-up questions');
    }
    assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
    await page.screenshot({path:`${out}/${mode}.png`});
    await writeFile(`${out}/${mode}.txt`,text);
    results.push({mode,questions:3,duplicates:0,errors,fullBody:mode==='early'?'generated':'local'});
    await page.close();
  }
  await writeFile(`${out}/result.json`,JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
}finally{await browser.close();await server.close();}
