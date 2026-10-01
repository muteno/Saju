// Evaluation bundle (원문95, handoff §5.1): the 성격·직업·관계 readings of one person read together, for several app
// versions, with the version names hidden. It collects what the chat speaks for a topic when the provider is not used
// (DosaChat selectTopic: the topic lines without raw excerpts, the app's own question and footer last), then measures
// the bundle by criteria fixed before reading the outputs (READING_BUNDLE_EVAL.md): sentences used for any chart,
// the same character named by two topics, repetition across topics, questions, and outcome/timing words. The
// contradiction judgement itself is the implementer's reading, kept in READING_BUNDLE_EVAL.md, not computed here.
//
//   git worktree add <dir> <commit>; ln -s $PWD/app/node_modules <dir>/app/node_modules
//   cp app/public/kb-*.json <dir>/app/public/; cp app/src/engine/vendor/kb_ref.json <dir>/app/src/engine/vendor/
//   BUNDLE_ROOTS="pr225=<dir225>,pr236=<dir236>,branch=." node docs/knowledge-model/reading_bundle_eval.mjs
// writes data/reading_bundle_eval.json (with the key) and evidence/reading-bundle/bundle.md (blinded).
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const here=fileURLToPath(new URL('./',import.meta.url));
const repo=resolve(here,'../..');
const roots=(process.env.BUNDLE_ROOTS||`current=${repo}`).split(',').map(s=>{const[label,dir]=s.split('=');return{label,dir:resolve(repo,dir)};});

// ── Inputs: adults (born 1960~2000), 진태양시 보정 끔, keepDay. Hand-picked charts of earlier PRs (same day pillar in
// another month, the same chart as both genders, the same day at another hour) and seeded draws, each with a same-day-
// pillar partner 60 days later (another month) and some gender flips. Synthetic calendar inputs, not personal cases.
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rand=mulberry32(95);
const day=ms=>{const d=new Date(ms);return[d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate()];};
const HAND=[
 ['h1',1980,2,11,4,'F','갑인 寅월 (PR227·235·236)'],['h2',1980,2,11,4,'M','h1과 같은 명식, 남'],
 ['h3',1980,4,11,4,'F','h1과 같은 일주, 辰월'],['h4',1985,9,7,2,'F','기유 申월 (PR235·236)'],
 ['h5',1985,9,7,2,'M','h4와 같은 명식, 남'],['h6',1985,11,6,2,'F','h4와 같은 일주, 戌월'],
 ['h7',1975,2,2,2,'F','기묘 丑월 02시 (PR235)'],['h8',1975,2,2,14,'F','h7과 같은 날 14시'],
];
const INPUTS=HAND.map(([id,y,m,d,h,g,note])=>({id,y,m,d,h,g,note}));
const start=Date.UTC(1960,0,1),span=Date.UTC(2000,11,31)-start;
for(let i=1;i<=8;i++){
 const ms=start+Math.floor(rand()*span/864e5)*864e5,[y,m,d]=day(ms),h=2*Math.floor(rand()*12),g=rand()<0.5?'F':'M';
 const[y2,m2,d2]=day(ms+60*864e5),h2=2*Math.floor(rand()*12);
 INPUTS.push({id:`r${i}`,y,m,d,h,g,note:'무작위'},{id:`r${i}b`,y:y2,m:m2,d:d2,h:h2,g,note:`r${i}과 같은 일주, 60일 뒤`});
 if(i<=4)INPUTS.push({id:`r${i}x`,y,m,d,h,g:g==='F'?'M':'F',note:`r${i}과 같은 명식, 성별 반대`});
}

const TOPICS=['성격','직업','관계'];
async function collect({label,dir}){
 const require=createRequire(dir+'/app/package.json');const{createServer}=await import(pathToFileURL(require.resolve('vite')).href);
 const server=await createServer({root:dir+'/app',server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error',cacheDir:`${dir}/app/node_modules/.vite-bundle-${label}`});
 const ref=JSON.parse(readFileSync(dir+'/app/src/engine/vendor/kb_ref.json')),bytes=readFileSync(dir+'/app/public/'+ref.file);
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>new Response(bytes,{headers:{'content-type':'application/json'}});
  const engine=await server.ssrLoadModule('/src/engine/index.js');await engine.loadKb();globalThis.fetch=original;
  const topics=await server.ssrLoadModule('/src/data/dosaTopics.ts'),client=await server.ssrLoadModule('/src/data/dosaClient.ts');
  const out={};
  for(const x of INPUTS){
   // A fixed 세운 year keeps the bundle reproducible (the 올해 topic is not evaluated).
   const report=engine.buildReading({year:x.y,month:x.m,day:x.d,hour:x.h,minute:0,gender:x.g,solarTimeCorrection:false,lateZiRule:'keepDay'},'병오');
   const table=report.sections.find(s=>s.id==='wonguk')?.table??[];
   const pillars=Object.fromEntries(table.map(r=>[r.pos,r.ganji]));
   const readings={};
   for(const key of TOPICS){
    const lines=topics.topicLines(report,key),followups=client.readingFollowups(report,lines);
    readings[key]=[...lines.filter(l=>!l.raw&&!followups.includes(l.text)).map(l=>l.text),...followups];
   }
   out[x.id]={pillars,readings};
  }
  return out;
 }finally{globalThis.fetch=original;await server.close();}
}

// ── Measures (criteria fixed before reading; READING_BUNDLE_EVAL.md).
const sentences=lines=>lines.flatMap(t=>t.split(/\n+/)).flatMap(p=>p.split(/(?<=[.?!…])\s+/)).map(s=>s.trim()).filter(Boolean);
const OUTCOME=/결혼|이혼|재혼|파경|해로|이별|사별|성공|실패|부자|대박|발복|승진|합격|부모덕|남편덕|처덕|배우자 덕|사고|질병|수술|단명|장수|돈을 벌|재물|몇 살|중년 이후|말년|초년|시기/;
// A sentence that negates an outcome (‘… 정한 것이 아니에요’) or frames a period as a candidate to check is not an
// outcome claim. (The first pattern missed ‘것이 아니에요’ and ‘시기 후보’; fixed after the first run, criterion unchanged.)
const DISCLAIM=/정하지 않|뜻이 아니|확정하지 않|판단하지 않|단정하지 않|보류|않아요|아니에요|후보/;
const STAR=/([甲乙丙丁戊己庚辛壬癸])\((비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인)\)/g;
function measure(versions){
 const metrics={};
 for(const v of Object.keys(versions)){
  const data=versions[v],ilju=id=>data[id].pillars['일주'];
  const allIlju=new Set(INPUTS.map(x=>ilju(x.id)));
  const need=Math.ceil(allIlju.size/2);
  const m={topics:{},crossTopic:{}};
  for(const t of TOPICS){
   const where=new Map();
   for(const x of INPUTS)for(const s of new Set(sentences(data[x.id].readings[t]))){if(!where.has(s))where.set(s,new Set());where.get(s).add(ilju(x.id));}
   const universal=new Set([...where].filter(([,set])=>set.size>=need).map(([s])=>s));
   const rows=INPUTS.map(x=>{const ss=sentences(data[x.id].readings[t]),chars=ss.join('').length;
    const u=ss.filter(s=>universal.has(s));
    return{id:x.id,sentences:ss.length,chars,universalSentences:u.length,universalShare:chars?+(u.join('').length/chars).toFixed(3):0,
     questions:ss.filter(s=>/\?$/.test(s)).length,endsWithQuestion:/\?$/.test(ss.filter(s=>!/^답(에 따라|을 통해)/.test(s)).at(-1)??''),
     outcome:ss.filter(s=>OUTCOME.test(s)&&!DISCLAIM.test(s)),outcomeDisclaimed:ss.filter(s=>OUTCOME.test(s)&&DISCLAIM.test(s)).length};});
   // Same day pillar pairs (different month or hour, the same gender): the share of one reading's sentences the other repeats.
   const pairs=INPUTS.filter(x=>INPUTS.some(y=>y.id!==x.id&&y.g===x.g&&ilju(y.id)===ilju(x.id)&&y.id<x.id)).map(x=>{
    const y=INPUTS.find(y=>y.id!==x.id&&y.g===x.g&&ilju(y.id)===ilju(x.id)&&y.id<x.id),a=new Set(sentences(data[x.id].readings[t])),b=sentences(data[y.id].readings[t]);
    return{pair:[y.id,x.id],sharedShare:b.length?+(b.filter(s=>a.has(s)).length/b.length).toFixed(3):0,sameQuestion:(data[x.id].readings[t].filter(s=>/\?$/.test(s)).join()===data[y.id].readings[t].filter(s=>/\?$/.test(s)).join())};});
   const avg=k=>+(rows.reduce((a,r)=>a+r[k],0)/rows.length).toFixed(3);
   m.topics[t]={universalThreshold:`${need}/${allIlju.size} 일주`,universal:[...universal],rows,pairs,
    mean:{sentences:avg('sentences'),chars:avg('chars'),universalShare:avg('universalShare'),questions:avg('questions')},
    readingsWithOutcome:rows.filter(r=>r.outcome.length).length,samePairShare:pairs.length?+(pairs.reduce((a,p)=>a+p.sharedShare,0)/pairs.length).toFixed(3):null};
  }
  for(const x of INPUTS){
   const per=Object.fromEntries(TOPICS.map(t=>[t,sentences(data[x.id].readings[t])]));
   // The same character with its ten god named in two topics: listed for reading, not judged here.
   const named={};
   for(const t of TOPICS)for(const s of per[t])for(const [,c,god] of s.matchAll(STAR)){const k=`${c}(${god})`;(named[k]??={})[t]??=[];if(!named[k][t].includes(s))named[k][t].push(s);}
   const shared=Object.fromEntries(Object.entries(named).filter(([,o])=>Object.keys(o).length>=2));
   const repeated=[];for(let i=0;i<TOPICS.length;i++)for(let j=i+1;j<TOPICS.length;j++)for(const s of new Set(per[TOPICS[i]]))if(per[TOPICS[j]].includes(s))repeated.push({topics:[TOPICS[i],TOPICS[j]],sentence:s});
   m.crossTopic[x.id]={sharedCharacters:shared,repeated};
  }
  m.summary={readingsWithSharedCharacter:INPUTS.filter(x=>Object.keys(m.crossTopic[x.id].sharedCharacters).length).length,
   repeatedSentences:INPUTS.reduce((a,x)=>a+m.crossTopic[x.id].repeated.length,0)};
  metrics[v]=m;
 }
 return metrics;
}

const versions={};
for(const r of roots)versions[r.label]=await collect(r);
// Blind labels: a seeded order per input, so a reader cannot tell the versions by their column.
const BLIND=['판ㄱ','판ㄴ','판ㄷ','판ㄹ'].slice(0,roots.length);
const key={};
const shuffle=mulberry32(9500);
for(const x of INPUTS){const order=roots.map(r=>r.label);for(let i=order.length-1;i>0;i--){const j=Math.floor(shuffle()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 key[x.id]=Object.fromEntries(BLIND.map((b,i)=>[b,order[i]]));}
const metrics=measure(versions);
const json={generatedBy:'docs/knowledge-model/reading_bundle_eval.mjs',criteria:'READING_BUNDLE_EVAL.md',
 versions:roots.map(r=>r.label),inputs:INPUTS,key,readings:versions,metrics};
mkdirSync(here+'data',{recursive:true});
writeFileSync(here+'data/reading_bundle_eval.json',JSON.stringify(json,null,1)+'\n');

// The blinded bundle for a reader: per input, each topic under blind labels only.
const md=['# 세 주제 완성 풀이 평가 묶음 — 버전 가림판','',
 '`reading_bundle_eval.mjs`가 만든 파일이다. 손으로 고치지 않는다. 각 입력에서 버전 이름은 판ㄱ·판ㄴ…으로 가렸고, 판과 버전의 대응은 입력마다 다르게 섞여 `data/reading_bundle_eval.json`의 `key`에만 있다. 대화 화면이 공급자 없이 말하는 순서(정제 안 된 발췌 제외, 앱 질문·안내는 끝)를 그대로 적었다. 합성 달력 입력이며 실제 개인 사례가 아니다.',''];
for(const x of INPUTS){
 const anyVersion=versions[roots[0].label][x.id].pillars;
 md.push(`## ${x.id} — ${x.y}-${String(x.m).padStart(2,'0')}-${String(x.d).padStart(2,'0')} ${String(x.h).padStart(2,'0')}시 ${x.g==='F'?'여':'남'} · ${['년주','월주','일주','시주'].map(p=>anyVersion[p]).join(' ')} · ${x.note}`,'');
 for(const t of TOPICS){md.push(`### ${t}`,'');
  for(const b of BLIND){md.push(`**${b}**`,'');for(const line of versions[key[x.id][b]][x.id].readings[t])md.push(...line.split(/\n+/).map(s=>`> ${s}`),'>');md.push('');}}
}
mkdirSync(here+'evidence/reading-bundle',{recursive:true});
writeFileSync(here+'evidence/reading-bundle/bundle.md',md.join('\n'));
const brief=Object.fromEntries(Object.entries(metrics).map(([v,m])=>[v,{...Object.fromEntries(TOPICS.map(t=>[t,{...m.topics[t].mean,universal:m.topics[t].universal.length,readingsWithOutcome:m.topics[t].readingsWithOutcome,samePairShare:m.topics[t].samePairShare}])),...m.summary}]));
console.log(JSON.stringify(brief,null,1));
