// Before/after capture for PR234 (the time of an experience answer compared with the 대운 periods). Real local React
// chat; the provider answers free questions with a fixed mock line and the reading request with 503; external URLs
// are blocked.   SAJU_ROOT=<checkout> QA_OUT=<dir> node scripts/capture_daeun_feedback.mjs <before|after>
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.SAJU_ROOT||fileURLToPath(new URL('../',import.meta.url));
const label=process.argv[2]||'after',out=process.env.QA_OUT||'/tmp/saju-daeun-feedback';await mkdir(out,{recursive:true});
const{chromium}=await import(pathToFileURL(root+'/app/node_modules/playwright-core/index.mjs'));
const{createServer}=await import(pathToFileURL(root+'/app/node_modules/vite/dist/node/index.js'));
const server=await createServer({root:root+'/app',cacheDir:out+'/vite-'+label,logLevel:'silent',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',headless:true,args:['--no-sandbox','--no-proxy-server','--disable-gpu']});
const PROVIDER='(모의 공급자) 말해 준 경험을 일반 상담으로 이어서 볼게요.',MENU='또 궁금한 것이 있는가?';
const norm=s=>s.replace(/\s+/g,' ').trim();
// [id, date, hour, gender, width, answers]: the same natal chart with both 대운 directions — a rootless 관성
// (1985-09-07 02시) answered 'yes' then an age, and a root under 충 (1976-07-09 02시) answered 'at some times' then split by age.
const YES=['맞아요','28살 무렵이요'],SPLIT=['도움이 된 때도 있고 아닌 때도 있었어요','24살 무렵엔 아니었는데 33살 무렵엔 도움이 됐어요'];
const SCENES=[['rootless-F','1985-09-07',2,'F',390,YES],['rootless-M','1985-09-07',2,'M',390,YES],
 ['clashed-F','1976-07-09',2,'F',390,SPLIT],['clashed-M','1976-07-09',2,'M',390,SPLIT],['rootless-F-1280','1985-09-07',2,'F',1280,YES]];
const query=(date,hour,g)=>{const[y,mo,d]=date.split('-').map(Number);return`y=${y}&mo=${mo}&d=${d}&t=${hour}:00&g=${g}&city=서울&sc=0&lz=0&hu=0&n=검수`;};
async function next(p){await p.evaluate(()=>document.activeElement?.blur());const b=p.getByRole('button',{name:/^(다음 이야기|한 번에 보기)$/});if(await b.count()){await b.click();return true;}const y=p.getByRole('button',{name:'그… 맞아',exact:true});if(await y.count()){await y.click();return true;}return false;}
async function until(p,fn){for(let i=0;i<150;i++){if(await fn())return;if(!(await next(p)))break;}if(!(await fn()))throw new Error('target missing');}
const logText=async p=>norm(await p.getByRole('log').innerText());
const rows=[];
try{
 for(const[id,date,hour,g,width,answers]of SCENES){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'}),p=await context.newPage();p.setDefaultTimeout(8000);
  const errors=[],external=[],requests=[];p.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==base){external.push(u.href);return route.abort();}
   if(u.pathname==='/api/dosa'){const body=route.request().postDataJSON();requests.push(body);return body.question?route.fulfill({status:200,json:{text:PROVIDER}}):route.fulfill({status:503,json:{}});}
   return route.continue();});
  try{
   await p.goto(`${base}/talk?${query(date,hour,g)}`);await p.getByRole('log').waitFor();
   const model=await p.evaluate(async()=>{const{parseShare}=await import('/src/data/profiles.ts'),{buildReading}=await import('/src/engine/index.js'),{TOPICS}=await import('/src/data/dosaTopics.ts');
    const s=parseShare(location.search),r=buildReading(s.input),c=r.sections.find(x=>x.id==='context-reading')?.context;
    const w=[c?.decision,c?.rootingDecision,c?.branchDecision].find(d=>d?.active);return{prompt:w?.question?.prompt,labels:Object.fromEntries(TOPICS.map(t=>[t.key,t.label]))};});
   const topic=p.getByRole('button',{name:model.labels['직업'],exact:true});await until(p,()=>topic.count());await topic.click();
   await until(p,async()=>(await logText(p)).includes(norm(model.prompt)));
   const steps=[];
   for(const[k,answer]of answers.entries()){
    const before=requests.filter(r=>r.question).length,shownBefore=(await logText(p)).length;
    await p.getByRole('textbox',{name:'도사에게 직접 묻기'}).fill(answer);await p.getByRole('button',{name:'보내기',exact:true}).click();
    await p.waitForFunction(()=>document.querySelector('textarea')?.readOnly===false);
    // Show the whole reply: the chat queues it in bubbles, and the menu line comes when the queue is empty.
    await p.waitForTimeout(300);
    for(let i=0;i<60;i++){const t=await logText(p);if(t.length>shownBefore&&t.endsWith(MENU))break;if(!(await next(p)))await p.waitForTimeout(250);}
    // The log box is short: slice it from the sent answer to the end (element shots at successive scroll positions).
    const log=p.getByRole('log');
    const top=await log.evaluate((box,text)=>{const mine=[...box.querySelectorAll('*')].filter(el=>{const t=el.textContent.trim();return t.endsWith(text)&&t.length<=text.length+4;}).at(-1); // '나: ' + answer
     return mine?box.scrollTop+mine.getBoundingClientRect().top-box.getBoundingClientRect().top-8:box.scrollHeight-box.clientHeight;},answer);
    const slices=[];
    for(let n=0,y=top;n<8;n++){const at=await log.evaluate((box,y)=>{box.scrollTop=y;return{y:box.scrollTop,end:box.scrollTop+box.clientHeight>=box.scrollHeight-2,h:box.clientHeight};},y);
     await p.waitForTimeout(150);const file=`chat-${id}-${k+1}-${label}-${n}.png`;await log.screenshot({path:`${out}/${file}`});slices.push(file);if(at.end)break;y=at.y+at.h-24;}
    await p.screenshot({path:`${out}/chat-${id}-${k+1}-${label}.png`});
    steps.push({answer,slices,providerRequests:requests.filter(r=>r.question).length-before});
   }
   rows.push({id,date,hour,gender:g,width,steps,text:await p.getByRole('log').innerText(),errors,external,scrollWidth:await p.evaluate(()=>document.documentElement.scrollWidth)});
  }finally{await context.close();}
 }
}finally{await writeFile(`${out}/rows-${label}.json`,JSON.stringify(rows,null,1));await browser.close();await server.close();}
console.log(JSON.stringify(rows.map(r=>({id:r.id,steps:r.steps,errors:r.errors.length,external:r.external.length,scrollWidth:r.scrollWidth,
 asked:/몇 살 무렵\(또는 몇 년\)/.test(r.text),compared:/대운 안으로 읽었어요/.test(r.text),noPeriod:/지금까지 시작한 대운 가운데/.test(r.text)}))));
