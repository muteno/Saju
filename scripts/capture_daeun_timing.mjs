// Before/after capture for PR233 (대운 periods on a rootless stem or a root under 충). Real local React, provider 503.
//   SAJU_ROOT=<checkout> QA_OUT=<dir> node scripts/capture_daeun_timing.mjs <before|after>
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.SAJU_ROOT||fileURLToPath(new URL('../',import.meta.url));
const label=process.argv[2]||'after',out=process.env.QA_OUT||'/tmp/saju-daeun-timing';await mkdir(out,{recursive:true});
const{chromium}=await import(pathToFileURL(root+'/app/node_modules/playwright-core/index.mjs'));
const{createServer}=await import(pathToFileURL(root+'/app/node_modules/vite/dist/node/index.js'));
const server=await createServer({root:root+'/app',cacheDir:out+'/vite-'+label,logLevel:'silent',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',headless:true,args:['--no-sandbox','--no-proxy-server','--disable-gpu']});
// [date, hour, gender, width, chat?]: the same natal chart with both 대운 directions (F/M) for a root under 충 in a
// season body, a rootless 관성 stem and a root under two 충; one wide card, one chat, and an unchanged grounded control.
const SCENES=[['1980-01-02',8,'F',390],['1980-01-02',8,'M',390],['1976-12-09',14,'F',390],['1976-12-09',14,'M',390],
 ['1976-07-09',2,'F',390],['1976-07-09',2,'F',1280],['1965-01-10',12,'F',390],['1976-12-09',14,'F',390,true]];
const query=(date,hour,g)=>{const[y,mo,d]=date.split('-').map(Number);return`y=${y}&mo=${mo}&d=${d}&t=${hour}:00&g=${g}&city=서울&sc=0&lz=0&hu=0&n=검수`;};
const rows=[];
async function page(width){const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'}),p=await context.newPage();p.setDefaultTimeout(8000);
 const errors=[],external=[],requests=[];p.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==base){external.push(u.href);return route.abort();}
  if(u.pathname==='/api/dosa'){requests.push(route.request().postDataJSON());return route.fulfill({status:503,json:{}});}return route.continue();});
 return{context,p,errors,external,requests};}
try{
 for(const[date,hour,g,width,chat]of SCENES){
  const id=`${date}-${String(hour).padStart(2,'0')}-${g}-${width}${chat?'-chat':''}`;
  const{context,p,errors,external,requests}=await page(width);try{
   if(!chat){
    await p.goto(`${base}/analysis?${query(date,hour,g)}`,{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);
    const btn=p.locator('[role="button"]').filter({hasText:'일과 재능'}).first();await btn.click();const region=btn.locator('..');
    await region.getByText('함께 읽으면',{exact:true}).evaluate(el=>{for(let q=el.parentElement;q;q=q.parentElement)if(getComputedStyle(q).overflowY==='auto'&&q.scrollHeight>q.clientHeight){q.scrollTop+=el.getBoundingClientRect().top-q.getBoundingClientRect().top;break;}});
    await p.waitForTimeout(400);await p.screenshot({path:`${out}/card-${id}-${label}.png`});
    // The 대운 lines scroll further: a second shot from the first of them (after only).
    const first=region.getByText(/원국 비교와 따로 대운만 겹쳐 보면/);
    if(await first.count()){await first.first().evaluate(el=>{for(let q=el.parentElement;q;q=q.parentElement)if(getComputedStyle(q).overflowY==='auto'&&q.scrollHeight>q.clientHeight){q.scrollTop+=el.getBoundingClientRect().top-q.getBoundingClientRect().top-8;break;}});
     await p.waitForTimeout(300);await p.screenshot({path:`${out}/card-${id}-${label}-daeun.png`});}
    rows.push({id,kind:'card',text:await region.innerText(),errors,external,scrollWidth:await p.evaluate(()=>document.documentElement.scrollWidth)});
   }else{
    await p.goto(`${base}/talk?${query(date,hour,g)}`);await p.getByRole('log').waitFor();
    const labels=await p.evaluate(async()=>{const{TOPICS}=await import('/src/data/dosaTopics.ts');return Object.fromEntries(TOPICS.map(t=>[t.key,t.label]));});
    const next=async()=>{await p.evaluate(()=>document.activeElement?.blur());const b=p.getByRole('button',{name:/^(다음 이야기|한 번에 보기)$/});if(await b.count()){await b.click();return true;}const y=p.getByRole('button',{name:'그… 맞아',exact:true});if(await y.count()){await y.click();return true;}return false;};
    const topic=p.getByRole('button',{name:labels['직업'],exact:true});for(let i=0;i<60&&!(await topic.count());i++)await next();await topic.click();
    for(let i=0;i<60;i++){const t=await p.getByRole('log').innerText();if(t.trim().endsWith('?')&&i>2)break;if(!(await next()))break;}
    await p.getByRole('log').evaluate(el=>{el.scrollTop=el.scrollHeight;});await p.waitForTimeout(200);
    await p.screenshot({path:`${out}/chat-${id}-${label}.png`});
    rows.push({id,kind:'chat',text:await p.getByRole('log').innerText(),errors,external,providerRequests:requests.length,
     groundsWithDaeun:requests.some(r=>(r?.grounds??[]).some(x=>/대운만 겹쳐 보면/.test(x.text))),summaryWithDaeun:requests.some(r=>/대운만 겹쳐 보면/.test(r?.chartSummary??'')),
     scrollWidth:await p.evaluate(()=>document.documentElement.scrollWidth)});
   }
  }finally{await context.close();}
 }
}finally{await writeFile(`${out}/rows-${label}.json`,JSON.stringify(rows,null,1));await browser.close();await server.close();}
console.log(JSON.stringify(rows.map(r=>({id:r.id,kind:r.kind,errors:r.errors.length,external:r.external.length,daeun:/대운만 겹쳐 보면/.test(r.text),grounds:r.groundsWithDaeun,summary:r.summaryWithDaeun,scrollWidth:r.scrollWidth}))));
