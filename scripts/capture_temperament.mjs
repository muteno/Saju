// Before/after capture for PR235 (the 성격 topic reads the month branch pattern with the day branch). Real local React;
// the provider answers free questions with a fixed mock line and the reading request with 503; external URLs are blocked.
//   SAJU_ROOT=<checkout> QA_OUT=<dir> node scripts/capture_temperament.mjs <before|after>
// Then `node scripts/capture_temperament.mjs compare` (QA_OUT with both runs) writes side-by-side compare-*.png.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.SAJU_ROOT||fileURLToPath(new URL('../',import.meta.url));
const label=process.argv[2]||'after',out=process.env.QA_OUT||'/tmp/saju-temperament';await mkdir(out,{recursive:true});
const{chromium}=await import(pathToFileURL(root+'/app/node_modules/playwright-core/index.mjs'));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',headless:true,args:['--no-sandbox','--no-proxy-server','--disable-gpu']});
if(label==='compare'){
 // Two columns of the same scene, before | after, each a vertical strip of its log slices.
 const rows=label==='compare'?{before:JSON.parse(await readFile(`${out}/rows-before.json`,'utf8')),after:JSON.parse(await readFile(`${out}/rows-after.json`,'utf8'))}:null;
 const p=await (await browser.newContext({viewport:{width:900,height:900}})).newPage();
 for(const a of rows.after){const b=rows.before.find(x=>x.id===a.id);if(!b)continue;
  const img=f=>`<img src="data:image/png;base64,${f}">`,col=async(r,name)=>`<div class="col"><h2>${name}</h2>${(await Promise.all(r.slices.map(async s=>img((await readFile(`${out}/${s}`)).toString('base64'))))).join('')}</div>`;
  await p.setContent(`<html><head><style>body{margin:0;background:#fff;font:14px sans-serif}.wrap{display:flex;gap:12px;padding:12px;align-items:flex-start}.col{display:flex;flex-direction:column;gap:4px}h2{margin:0 0 6px;font-size:15px}img{display:block;max-width:${a.width>600?640:400}px}</style></head>
   <body><div class="wrap">${await col(b,'전(main)')}${await col(a,'후(이번 변경)')}</div></body></html>`);
  await p.locator('.wrap').screenshot({path:`${out}/compare-${a.id}.png`});
 }
 await browser.close();console.log('compare done');process.exit(0);
}
const{createServer}=await import(pathToFileURL(root+'/app/node_modules/vite/dist/node/index.js'));
const server=await createServer({root:root+'/app',cacheDir:out+'/vite-'+label,logLevel:'silent',server:{host:'127.0.0.1',port:0,hmr:false,watch:null}});await server.listen();
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
const PROVIDER='(모의 공급자) 말해 준 경험을 일반 상담으로 이어서 볼게요.',MENU='또 궁금한 것이 있는가?';
const norm=s=>s.replace(/\s+/g,' ').trim();
// [id, kind, date, hour, gender, width, answers]: one day pillar in two months (甲寅 寅월/辰월, 己酉 申월/戌월), the answers
// that lower an inside/outside reading and ask the complementary question, and the analysis card.
const SCENES=[['gapin-yin-F','chat','1980-02-11',4,'F',390,[]],['gapin-jin-F','chat','1980-04-11',4,'F',390,['아니요','네']],
 ['giyu-sin-F','chat','1985-09-07',2,'F',390,[]],['giyu-sul-F','chat','1985-11-06',2,'F',390,['아니요']],
 ['gapin-jin-F-1280','chat','1980-04-11',4,'F',1280,[]],['card-gapin-jin-F','card','1980-04-11',4,'F',390,[]],['card-giyu-sul-F-1280','card','1985-11-06',2,'F',1280,[]]];
const query=(date,hour,g)=>{const[y,mo,d]=date.split('-').map(Number);return`y=${y}&mo=${mo}&d=${d}&t=${hour}:00&g=${g}&city=서울&sc=0&lz=0&hu=0&n=검수`;};
async function next(p){await p.evaluate(()=>document.activeElement?.blur());const b=p.getByRole('button',{name:/^(다음 이야기|한 번에 보기)$/});if(await b.count()){await b.click();return true;}const y=p.getByRole('button',{name:'그… 맞아',exact:true});if(await y.count()){await y.click();return true;}return false;}
const logText=async p=>norm(await p.getByRole('log').innerText());
// The log box is short: slice it from a starting text to the end (element shots at successive scroll positions).
async function slices(p,start,file){const log=p.getByRole('log');
 const top=await log.evaluate((box,text)=>{const mine=[...box.querySelectorAll('*')].filter(el=>el.textContent.trim().endsWith(text)&&el.textContent.trim().length<=text.length+4).at(-1);
  return mine?box.scrollTop+mine.getBoundingClientRect().top-box.getBoundingClientRect().top-8:0;},start);
 const shots=[];for(let n=0,y=top;n<14;n++){const at=await log.evaluate((box,y)=>{box.scrollTop=y;return{y:box.scrollTop,end:box.scrollTop+box.clientHeight>=box.scrollHeight-2,h:box.clientHeight};},y);
  await p.waitForTimeout(150);const f=`${file}-${n}.png`;await log.screenshot({path:`${out}/${f}`});shots.push(f);if(at.end)break;y=at.y+at.h-24;}
 return shots;}
const rows=[];
try{
 for(const[id,kind,date,hour,g,width,answers]of SCENES){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'}),p=await context.newPage();p.setDefaultTimeout(8000);
  const errors=[],external=[],requests=[];p.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!==base){external.push(u.href);return route.abort();}
   if(u.pathname==='/api/dosa'){const body=route.request().postDataJSON();requests.push(body);return body.question?route.fulfill({status:200,json:{text:PROVIDER}}):route.fulfill({status:503,json:{}});}
   return route.continue();});
  try{
   if(kind==='card'){
    await p.goto(`${base}/analysis?${query(date,hour,g)}`,{waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);
    const btn=p.locator('[role="button"]').filter({hasText:'성향과 기질'}).first();await btn.click();const region=btn.locator('..');await p.waitForTimeout(400);
    const card=region.getByText('내 원국으로 읽는 기본 성향',{exact:true});
    if(await card.count())await card.first().evaluate(el=>{for(let q=el.parentElement;q;q=q.parentElement)if(getComputedStyle(q).overflowY==='auto'&&q.scrollHeight>q.clientHeight){q.scrollTop+=el.getBoundingClientRect().top-q.getBoundingClientRect().top-8;break;}});
    await p.waitForTimeout(300);const f=`${id}-${label}.png`;await p.screenshot({path:`${out}/${f}`});
    rows.push({id,kind,date,hour,gender:g,width,slices:[f],text:await region.innerText(),errors,external,scrollWidth:await p.evaluate(()=>document.documentElement.scrollWidth)});
    continue;
   }
   await p.goto(`${base}/talk?${query(date,hour,g)}`);await p.getByRole('log').waitFor();
   const labels=await p.evaluate(async()=>{const{TOPICS}=await import('/src/data/dosaTopics.ts');return Object.fromEntries(TOPICS.map(t=>[t.key,t.label]));});
   const topic=p.getByRole('button',{name:labels['성격'],exact:true});for(let i=0;i<80&&!(await topic.count());i++)if(!(await next(p)))await p.waitForTimeout(200);
   await topic.click();
   // The whole 성격 reading: advance until the menu line comes back.
   for(let i=0;i<80;i++){const t=await logText(p);if(t.endsWith(MENU)&&t.split(MENU).length>1&&t.lastIndexOf(MENU)>t.indexOf(labels['성격']))break;if(!(await next(p)))await p.waitForTimeout(250);}
   const reading=await slices(p,labels['성격'],`chat-${id}-0-${label}`);
   const steps=[];
   for(const[k,answer]of answers.entries()){
    const before=requests.filter(r=>r.question).length,shownBefore=(await logText(p)).length;
    await p.getByRole('textbox',{name:'도사에게 직접 묻기'}).fill(answer);await p.getByRole('button',{name:'보내기',exact:true}).click();
    await p.waitForFunction(()=>document.querySelector('textarea')?.readOnly===false);await p.waitForTimeout(300);
    for(let i=0;i<60;i++){const t=await logText(p);if(t.length>shownBefore&&t.endsWith(MENU))break;if(!(await next(p)))await p.waitForTimeout(250);}
    steps.push({answer,slices:await slices(p,answer,`chat-${id}-${k+1}-${label}`),providerRequests:requests.filter(r=>r.question).length-before});
   }
   rows.push({id,kind,date,hour,gender:g,width,slices:[...reading,...steps.flatMap(s=>s.slices)],steps,text:await p.getByRole('log').innerText(),errors,external,
    readingRequests:requests.filter(r=>!r.question).length,scrollWidth:await p.evaluate(()=>document.documentElement.scrollWidth)});
  }finally{await context.close();}
 }
}finally{await writeFile(`${out}/rows-${label}.json`,JSON.stringify(rows,null,1));await browser.close();await server.close();}
console.log(JSON.stringify(rows.map(r=>({id:r.id,kind:r.kind,slices:r.slices.length,steps:r.steps?.map(s=>[s.answer,s.providerRequests]),errors:r.errors.length,external:r.external.length,scrollWidth:r.scrollWidth,
 reading:/월지의 바탕/.test(r.text),asked:/편인가요|느낀 적이 있나요|있나요\?/.test(r.text)}))));
