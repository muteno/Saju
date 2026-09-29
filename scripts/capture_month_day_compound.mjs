import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=createRequire(root+'/app/package.json')('playwright-core');
const label=process.argv[2]||'current',out=process.env.QA_OUT||'/tmp/saju-compound-ui';mkdirSync(out,{recursive:true});
const {createServer:createViteServer}=await import(root+'/app/node_modules/vite/dist/node/index.js');
const vite=await createViteServer({root:root+'/app',cacheDir:out+'/vite-'+label,logLevel:'silent',server:{host:'127.0.0.1',port:0,watch:null}});await vite.listen();const server=vite.httpServer;
const browser=await chromium.launch({executablePath:'/tmp/chromium',headless:true,args:['--no-proxy-server','--disable-gpu']});
try {
 const page=await browser.newPage({viewport:{width:Number(process.argv[3]||390),height:844},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // The bundled local font is loaded normally; no external provider is contacted.
 await page.route('**/*',route=>{const u=new URL(route.request().url()); if(u.origin!==`http://127.0.0.1:${server.address().port}`) return route.abort(); if(u.pathname==='/api/dosa')return route.fulfill({status:503,json:{}});return route.continue();});
 const rows=[];
 for(const [id,month,day,hour,hu] of [['single-yukhap',1,18,12,0],['no-yukhap',7,17,12,0],['compound',5,14,12,0],['unknown',1,18,12,1]]) {
   const query=`?y=2023&mo=${month}&d=${day}&t=${hour}:00&g=F&city=서울&sc=0&lz=0&hu=${hu}&n=검수`;
   await page.goto(`http://127.0.0.1:${server.address().port}/analysis${query}`,{waitUntil:'networkidle'});
   await page.evaluate(()=>document.fonts.ready);
   await page.addStyleTag({content:'*{caret-color:transparent !important}'});
   if(!hu) {
     const btn=page.locator('[role="button"]').filter({hasText:'일과 재능'}).first();await btn.click();
     const region=btn.locator('..');await region.getByText('함께 읽으면', {exact:true}).evaluate(el => { for (let p=el.parentElement;p;p=p.parentElement) { if (getComputedStyle(p).overflowY==='auto' && p.scrollHeight>p.clientHeight) { p.scrollTop += el.getBoundingClientRect().top-p.getBoundingClientRect().top; break; } } });
     await page.waitForTimeout(750); await page.screenshot({path:`${out}/${id}-work-${label}.png`});
     rows.push({id,text:await region.innerText(),box:await region.boundingBox()});
   } else {
     await page.waitForTimeout(750); await page.screenshot({path:`${out}/${id}-${label}.png`});rows.push({id,text:await page.locator('body').innerText()});
   }
   rows.at(-1).viewport=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
 }
 assert.deepEqual(errors,[]);for(const row of rows)assert.equal(row.viewport.width,row.viewport.scrollWidth);
 writeFileSync(`${out}/dom-${label}.json`,JSON.stringify({rows,errors},null,2));
 console.log(JSON.stringify({label,rows:rows.map(r=>({id:r.id,box:r.box,viewport:r.viewport})),errors}));
} finally {await browser.close();await vite.close();}
