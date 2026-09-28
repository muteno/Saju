// Actual React/DOM requests. Provider replies are mocked; no external AI calls or storage.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from '../app/node_modules/playwright-core/index.mjs';
import {createServer} from '../app/node_modules/vite/dist/node/index.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=process.env.QA_OUT||'/tmp/saju-conversation-browser';await mkdir(out,{recursive:true});
const server=await createServer({root:root+'app',logLevel:'silent',server:{host:'127.0.0.1',port:0,watch:null}});await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[];
const QUERY='/talk?y=2024&mo=2&d=20&t=12:00&g=F&city=서울&sc=0&lz=0&hu=0&n=검수';
const FOLLOWUP='그때 본인이 정할 수 있었던 범위가 있었나요?';
async function open({motion='reduce',query=QUERY,width=390}={}){
  const page=await browser.newPage({viewport:{width,height:844},reducedMotion:motion});page.setDefaultTimeout(8000);
  const requests=[],held=new Map(),counts=new Map(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    window.__aborted=[];const original=window.fetch.bind(window);
    window.fetch=(url,options)=>{
      if(String(url).includes('/api/dosa')&&options?.signal){const body=JSON.parse(options.body);options.signal.addEventListener('abort',()=>window.__aborted.push(body.question));}
      return original(url,options);
    };
  });
  await page.route('**/api/dosa',async route=>{
    const body=route.request().postDataJSON();requests.push(body);
    if(!body.question)return route.fulfill({status:503,json:{}});
    const n=(counts.get(body.question)||0)+1;counts.set(body.question,n);
    if(body.question.startsWith('보류')){held.set(body.question,route);return;}
    if(body.question==='재시도 질문'&&n===1)return route.fulfill({status:503,json:{}});
    return route.fulfill({status:200,json:{text:`말씀하신 경험의 범위를 먼저 확인할게요.\n\n${FOLLOWUP}`}});
  });
  await page.goto(base+query);await page.getByRole('log').waitFor();
  return {page,requests,held,errors,close:async()=>{assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await page.close();}};
}
async function next(page,allowYes=true){
  await page.evaluate(()=>document.activeElement?.blur());await page.waitForTimeout(50);
  const button=page.getByRole('button',{name:/^(다음 이야기|한 번에 보기)$/});
  if(await button.count()){await button.click();return true;}
  const yes=page.getByRole('button',{name:'그… 맞아',exact:true});
  if(allowYes&&await yes.count()){await yes.click();return true;}
  return false;
}
async function until(page,predicate){for(let i=0;i<85;i++){if(await predicate())return;assert.ok(await next(page),'Dialogue ended before expected content');}assert.fail('Dialogue did not reach target');}
async function topic(page,key){
  const label=await page.evaluate(async key=>(await import('/src/data/dosaTopics.ts')).TOPICS.find(t=>t.key===key).label,key);
  const choice=page.getByRole('button',{name:label,exact:true});await until(page,()=>choice.count());await choice.click();
}
async function send(page,text,wait=true){
  await page.getByRole('textbox',{name:'도사에게 직접 묻기'}).fill(text);await page.getByRole('button',{name:'보내기',exact:true}).click();
  if(wait)await page.waitForFunction(()=>document.querySelector('textarea')?.readOnly===false);
}
const free=x=>x.requests.filter(r=>r.question);
const textOf=r=>r.conversation?.messages.map(m=>m.text).join('\n')||'';
async function save(name,x){await writeFile(`${out}/${name}.json`,JSON.stringify({requests:free(x),dom:await x.page.getByRole('log').innerText(),errors:x.errors},null,2));results.push({name,ok:true});await x.close();}
try{
  for(const width of [390,1280]){
    const x=await open({width}),{page}=x,log=page.getByRole('log');await topic(page,'직업');
    await until(page,async()=>(await log.innerText()).includes('최근 맡은 일에서 스스로 정한 부분'));
    assert.ok(!(await log.innerText()).includes('표현·실행, 결과·자원 관리, 규칙·책임 가운데 최근 실제로 맡은 일'));
    await send(page,'정해진 절차를 따랐고 스스로 정한 부분은 없었어요.');
    assert.match(textOf(free(x)[0]),/최근 맡은 일에서 스스로 정한 부분/);
    assert.doesNotMatch(textOf(free(x)[0]),/표현·실행, 결과·자원 관리, 규칙·책임 가운데 최근 실제로 맡은 일/);
    assert.ok(!free(x)[0].conversation.messages.some(m=>m.text===free(x)[0].question),'Current reply duplicated in history');
    await until(page,async()=>(await log.innerText()).includes(FOLLOWUP));
    await send(page,'그런 범위가 없었어요.');
    assert.ok(free(x)[1].conversation.messages.some(m=>m.text===FOLLOWUP));
    assert.ok(free(x)[1].conversation.messages.some(m=>m.role==='user'&&m.text===free(x)[0].question));
    await send(page,'재시도 질문');await page.getByRole('button',{name:'질문 다시 보내기',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('textarea')?.readOnly===false);
    const attempts=free(x).filter(r=>r.question==='재시도 질문');assert.equal(attempts.length,2);assert.deepEqual(attempts[0].conversation,attempts[1].conversation);
    assert.doesNotMatch(textOf(attempts[1]),/답변을 받지 못했어요/);
    assert.equal((await log.innerText()).split('재시도 질문').length-1,1);
    await topic(page,'관계');await next(page);await send(page,'관계 주제로 새로 물을게요.');
    assert.equal(free(x).at(-1).conversation.topic,'관계');
    assert.doesNotMatch(textOf(free(x).at(-1)),/정해진 절차를 따랐고|그런 범위가 없었어요|재시도 질문|최근 맡은 일에서/);
    await page.screenshot({path:`${out}/chat-${width}.png`});await save(`visible-retry-topic-${width}`,x);
  }
  {
    const x=await open({query:'/talk?qa=1'}),{page}=x;
    const no=page.getByRole('button',{name:'아니, 딱히?',exact:true});
    for(let i=0;i<15&&!await no.count();i++)assert.ok(await next(page,false));
    await no.click();for(let i=0;i<15;i++)if(!await next(page))break;
    await send(page,'새 도사에게 묻는 말');
    assert.doesNotMatch(textOf(free(x).at(-1)),/아니, 딱히\?/);
    assert.ok(!free(x).at(-1).conversation?.messages.some(m=>m.role==='user'));
    await save('automatic-chef-scope',x);
  }
  for(const boundary of ['chef','profile']){
    const x=await open(),{page}=x;
    await send(page,'이전 대화만의 표식');await send(page,`보류 ${boundary}`,false);
    await page.waitForFunction(()=>document.querySelector('textarea')?.readOnly===true);
    if(boundary==='chef')await page.getByRole('button',{name:/도사 바꾸기/}).click();
    else await page.evaluate(()=>{history.pushState(null,'','/talk?y=1993&mo=11&d=30&t=09:00&g=M&city=서울&n=새프로필');dispatchEvent(new PopStateEvent('popstate'));});
    await page.waitForFunction(q=>window.__aborted.includes(q),`보류 ${boundary}`);
    const route=x.held.get(`보류 ${boundary}`);assert.ok(route);await route.fulfill({status:200,json:{text:'들어오면 안 되는 오래된 답'}}).catch(()=>{});
    await send(page,`새 ${boundary} 질문`);
    assert.doesNotMatch(textOf(free(x).at(-1)),/이전 대화만의 표식|보류|들어오면 안 되는/);
    assert.doesNotMatch(await page.getByRole('log').innerText(),/들어오면 안 되는 오래된 답/);
    await save(`${boundary}-abort-scope`,x);
  }
  {
    const x=await open({query:QUERY.replace('hu=0','hu=1')}),{page}=x;
    await send(page,'시간을 모르는 상태의 경험');await page.waitForTimeout(100);
    assert.equal(x.requests.length,0);assert.match(await page.getByRole('log').innerText(),/출생 시간/);
    await save('unknown-no-request',x);
  }
  {
    const x=await open({motion:'no-preference'}),{page}=x;
    await next(page);await next(page);await page.waitForTimeout(90);
    await send(page,'타이핑 도중 입력');
    assert.equal(free(x)[0].conversation,undefined);
    await save('partial-speech-excluded',x);
  }
  await writeFile(`${out}/result.json`,JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
}finally{await browser.close();await server.close();}
