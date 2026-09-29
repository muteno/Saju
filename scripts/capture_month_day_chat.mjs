import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.SAJU_ROOT||fileURLToPath(new URL('../',import.meta.url));
const out=process.env.QA_OUT||'/tmp/saju-month-day-chat',label=process.argv[2]||'current';
await mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(root+'/app/node_modules/playwright-core/index.mjs').href);
const {createServer}=await import(pathToFileURL(root+'/app/node_modules/vite/dist/node/index.js').href);
const server=await createServer({root:root+'/app',logLevel:'silent',server:{host:'127.0.0.1',port:0,watch:null}});await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==base){external.push(u.origin);return route.abort();}
  if(u.pathname==='/api/dosa')return route.fulfill({status:503,json:{}});return route.continue();});
 await page.goto(`${base}/talk?y=2024&mo=4&d=28&t=12:00&g=F&city=서울&sc=0&lz=0&hu=0&n=검수`);await page.getByRole('log').waitFor();
 const next=async()=>{await page.evaluate(()=>document.activeElement?.blur());const b=page.getByRole('button',{name:/^(다음 이야기|한 번에 보기)$/});if(await b.count()){await b.click();return true;}
  const y=page.getByRole('button',{name:'그… 맞아',exact:true});if(await y.count()){await y.click();return true;}return false;};
 const choice=page.getByRole('button',{name:'일·직업 방향은?',exact:true});
 for(let i=0;i<100&&!await choice.count();i++)assert.ok(await next());await choice.click();
 for(let i=0;i<150;i++)if(!await next())break;
 const log=page.getByRole('log'),text=await log.innerText();assert.ok(text.includes('최근 맡은 역할이나 책임부터'));
 await page.evaluate(()=>document.fonts.ready);
 await log.getByText(/표현·실행, 결과·자원 관리, 규칙·책임 가운데/).first().evaluate(el=>{
  for(let p=el.parentElement;p;p=p.parentElement)if(getComputedStyle(p).overflowY==='auto'&&p.scrollHeight>p.clientHeight){p.scrollTop+=el.getBoundingClientRect().top-p.getBoundingClientRect().top;break;}
 });
 await page.waitForTimeout(500);await page.screenshot({path:`${out}/chat-${label}.png`});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
 await writeFile(`${out}/chat-${label}.json`,JSON.stringify({label,text,errors,external,response:'503 local fallback'},null,2)+'\n');
 console.log(JSON.stringify({label,errors,external}));
}finally{await browser.close();await server.close();}
