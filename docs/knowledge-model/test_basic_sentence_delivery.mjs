import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compare, summarize } from './measure_basic_sentence_delivery.mjs';
import { applyBasicSentencePolicy, safeBasicSentenceParagraphs, basicSentenceMatches, basicSentenceReviews, BASIC_SENTENCE_NOTICE } from '../../dosa-app/engine/src/basicSentences.js';
import { toMarkdown } from '../../dosa-app/engine/src/report.js';
const root = fileURLToPath(new URL('../../',import.meta.url));
const require = createRequire(new URL('../../app/package.json',import.meta.url));
const review = JSON.parse(readFileSync(new URL('data/basic_sentence_review.json',import.meta.url)));
const copy = value => JSON.parse(JSON.stringify(value));
let result, server, topics, client, groups, api;
before(async()=>{
  result=await compare();
  const {createServer}=await import(pathToFileURL(require.resolve('vite')).href);
  server=await createServer({root:root+'app',server:{middlewareMode:true},appType:'custom',logLevel:'error'});
  topics=await server.ssrLoadModule('/src/data/dosaTopics.ts');
  client=await server.ssrLoadModule('/src/data/dosaClient.ts');
  groups=await server.ssrLoadModule('/src/data/analysisGroups.ts');
  api=(await server.ssrLoadModule('/@fs'+root+'functions/api/dosa.ts')).onRequestPost;
});
after(async()=>{await server?.close();});
const needles = item => typeof item.draft_value==='string'?[item.draft_value]:item.draft_value.견해.map(v=>v.내용);

test('real 110-input comparison reproduces the recorded new contract',()=>{
  assert.deepEqual(summarize(result),JSON.parse(readFileSync(new URL('data/basic_sentence_delivery.json',import.meta.url))));
  assert.equal(result.after.rows.length,110);assert.deepEqual(result.after.assets,result.before.assets);
});
test('all 14 reviewed items disappear from cards, dialogue, topics, real request bodies and Brain',()=>{
  const seen=new Set();
  for(let i=0;i<result.after.rows.length;i++) {
    const row=result.after.rows[i], prior=result.before.rows[i];
    for(const item of review.items)for(const text of needles(item)) {
      if(JSON.stringify(prior.reading).includes(text))seen.add(item.id);
      for(const field of ['reading','topics','requests','brain'])assert.ok(!JSON.stringify(row[field]).includes(text),`${row.id}/${item.id}/${field}`);
      assert.ok(!toMarkdown(row.report).includes(text));
    }
    assert.deepEqual(row.hook.reading,row.reading);assert.deepEqual(row.hook.report,row.report);
  }
  assert.deepEqual([...seen].sort(),review.items.map(x=>x.id).sort());
});
test('review records retain exact conditions, both comparison sources and physical locators',()=>{
  for(const item of review.items) {
    const found=basicSentenceReviews(item.key).find(x=>x.id===item.id);
    assert.deepEqual(found.review,item.review);assert.equal(found.personalApplication,'withheld');
    assert.equal(found.trainingEligible,false);assert.equal(found.probability,null);
    assert.deepEqual(found.sources.map(s=>s.unit),item.evidence.map(id=>review.spans.find(s=>s.id===id).unit));
    for(let i=0;i<item.evidence.length;i++) {
      const span=review.spans.find(s=>s.id===item.evidence[i]);
      assert.deepEqual(found.sources[i].bodyParagraphs,span.body_paragraphs);
      assert.deepEqual(found.sources[i].xmlParagraphs,span.paragraphs.map(p=>p.xml_paragraph));
      assert.equal(found.sources[i].lineage,review.source_units[span.unit].lineage);
    }
  }
  assert.equal(basicSentenceReviews('ilju/갑오').find(x=>x.id==='OH04').sources.length,3);
});
test('all remaining ilju drafts are explicitly unreviewed and have no guessed sentence source',()=>{
  for(const row of result.after.rows.filter(r=>!r.profile.hourUnknown)) {
    const b=row.report.sections.find(s=>s.id==='ilju').block;
    assert.equal(b.basicReview.status,b.basicReview.reviewed.length?'partial_review':'unreviewed');
    for(const s of b.sentences){assert.equal(s.reviewStatus,'unreviewed');assert.equal(s.personalApplication,'not_evaluated');assert.deepEqual(s.sources,[]);}
    const card=row.reading.cards.find(c=>c.id==='ilju');assert.match(card.note,/미.*검수|아직 검수하지/);
    assert.ok(card.blocks.every(b=>!b.source));
    assert.ok(row.reading.dialogue.filter(d=>d.icon==='🎴').every(d=>!d.source));
    for(const key of ['성격','직업','관계','주의']) {
      assert.ok(row.topics[key].some(l=>l.text.includes('문헌 초안')));
      for(const line of row.topics[key].filter(l=>!l.raw))assert.ok(!line.grounds?.some(g=>/^일주론|^명리학탐구/.test(g.doc)));
    }
  }
});
test('unknown eight rows, chart, strength, summary, daily fortune and opening selection remain identical',()=>{
  let n=0;
  for(let i=0;i<result.after.rows.length;i++) {
    const row=result.after.rows[i],old=result.before.rows[i];
    if(row.profile.hourUnknown){n++;assert.deepEqual(row,old);assert.equal(row.requests.length,0);continue;}
    for(const key of ['chart','raw','keys','fortune','summary','direct','input','share'])assert.deepEqual(row[key],old[key],`${row.id}/${key}`);
    assert.deepEqual(row.report.sections.find(s=>s.id==='sinsal'),old.report.sections.find(s=>s.id==='sinsal'));
    assert.deepEqual(row.reading.cards.find(c=>c.id==='sinsal'),old.reading.cards.find(c=>c.id==='sinsal'));
  }
  assert.equal(n,8);
});
test('whole comparison, quotes, duplicates and whitespace copies are withheld without mutating KB',()=>{
  const item=review.items.find(x=>x.id==='IN06'),single=review.items[0].draft_value;
  const d={key:'ilju/갑인',distilled:{sources:[{doc:'unchanged'}],distilled:{성격:['unrelated',single,single]},
    관점차이:[copy(item.draft_value)],인용:[{text:single,src:'copied'}],기타:[single]},
    excerpts:[{source:{doc:'original'},paras:['unrelated',single.replaceAll(' ','\n  ')]}]};
  const original=copy(d),out=applyBasicSentencePolicy(d);
  assert.deepEqual(d,original);assert.deepEqual(out.distilled.distilled.성격,['unrelated']);
  assert.deepEqual(out.distilled.관점차이,[]);assert.deepEqual(out.distilled.인용,[]);assert.deepEqual(out.distilled.기타,[]);
  assert.deepEqual(out.excerpts[0].paras,['unrelated']);assert.deepEqual(out.distilled.sources,d.distilled.sources);
  assert.deepEqual([...out.basicReview.withheldIds].sort(),['IN01','IN06']);
  assert.deepEqual(basicSentenceMatches({nested:[single.normalize('NFD')]}),['IN01']);
  for (const record of review.items) {
    const text=needles(record)[0];
    assert.deepEqual(safeBasicSentenceParagraphs(text+'\n\n'+text.replaceAll(' ','\n\n')),[]);
    assert.deepEqual(safeBasicSentenceParagraphs(text+'\n\nretained'),['retained']);
  }
});
test('stale report and actual request boundary cannot reintroduce reviewed personal claims',async()=>{
  const old=result.before.rows.find(r=>r.report.sections.find(s=>s.id==='ilju')?.block.key==='ilju/갑인');
  for(const key of ['성격','직업','관계','주의'])for(const line of topics.topicLines(old.report,key))assert.deepEqual(basicSentenceMatches(line.text),[]);
  const fetch=globalThis.fetch,requests=[];
  try {
    globalThis.fetch=async(url,init)=>{assert.equal(url,'/api/dosa');requests.push(JSON.parse(init.body));return Response.json({text:'ok'});};
    const response = await client.requestDosaText({report:old.report,topic:'성격',chefId:'noona',model:'sonnet',
      lines:[{text:review.items[0].draft_value,grounds:[{doc:'stale',title:'stale'}]},{text:'retained unrelated line'}]});
    assert.equal(requests.length,1);assert.deepEqual(basicSentenceMatches(requests[0].grounds),[]);
    assert.ok(requests[0].grounds.some(l=>l.text===BASIC_SENTENCE_NOTICE));
    // Supplied stale lines are replaced by current report grounding.
    const draft=JSON.parse(readFileSync(new URL('../../dosa-app/kb/distilled/ilju/갑인.json',import.meta.url)));
    assert.ok(requests[0].grounds.some(l=>l.text===draft.distilled.성격[1]));
    assert.ok(requests[0].grounds.filter(l=>!l.raw).every(l=>!l.grounds?.some(g=>g.doc==='stale')));
    assert.ok(response.includes(BASIC_SENTENCE_NOTICE));
    assert.ok(response.includes('문헌 초안'));
  } finally {globalThis.fetch=fetch;}
});
test('splitting topic cards never copies or overwrites another statement source',()=>{
  const value={headline:'',unseYear:'',dialogue:[],cards:[{id:'ilju',title:'unit',note:'review note',blocks:[
    {label:'성격',lines:['A'],source:'source A'},{label:'관계',lines:['B']},{label:'일과 재능',lines:['C'],source:'source C'}]}]};
  const original=copy(value),out=groups.buildTopicGroups(value);
  assert.deepEqual(value,original);assert.equal(out.find(g=>g.id==='rel').cards[0].blocks[0].source,undefined);
  assert.equal(out.find(g=>g.id==='work').cards[0].blocks[0].source,'source C');
  assert.ok(out.every(g=>g.cards[0].note==='review note'));
});
test('projection is pinned and engine vendor derives from the canonical files',()=>{
  execFileSync('python3',['scripts/build_basic_sentence_policy.py','--check'],{cwd:root,stdio:'pipe'});
  execFileSync(process.execPath,['scripts/sync_engine.mjs','--check'],{cwd:root,stdio:'pipe'});
});

test('policy is idempotent and cross-key withheld copies carry the original review metadata',()=>{
  for(const row of result.after.rows.filter(r=>!r.profile.hourUnknown)) {
    const b=row.report.sections.find(s=>s.id==='ilju').block;
    assert.deepEqual(applyBasicSentencePolicy(b),b);
  }
  const b=applyBasicSentencePolicy({key:'ilju/병자',distilled:{distilled:{성격:[review.items[0].draft_value]}}});
  assert.deepEqual(b.basicReview.withheldIds,['IN01']);assert.equal(b.basicReview.reviewed[0].id,'IN01');
});
test('server rejects old bundle grounds, split-whitespace copies and exact withheld generated responses',async()=>{
  const fetch=globalThis.fetch,requests=[];let output='검증용 응답';
  const call=grounds=>api({request:new Request('https://example.test/api/dosa',{method:'POST',body:JSON.stringify({topic:'성격',grounds})}),env:{ANTHROPIC_API_KEY:'test-only'}});
  try {
    globalThis.fetch=async(url,init)=>{assert.equal(url,'https://api.anthropic.com/v1/messages');requests.push(JSON.parse(init.body));return Response.json({content:[{type:'text',text:output}]});};
    for(const text of [review.items[0].draft_value,review.items[0].draft_value.replaceAll(' ','\n\n')]) {
      assert.equal((await call([{text:text+'\n\nretained separate paragraph',grounds:[{doc:'old unit bibliography'}]}])).status,200);
      const message=requests.at(-1).messages[0].content;
      assert.ok(!basicSentenceMatches(message).length);assert.ok(message.includes(BASIC_SENTENCE_NOTICE));
    }
    const words=review.items[0].draft_value.split(' '),mid=Math.floor(words.length/2);
    const divided=[{text:words.slice(0,mid).join(' ')},{text:words.slice(mid).join(' ')}];
    assert.equal((await call(divided)).status,200);
    const dividedMessage=requests.at(-1).messages[0].content;
    assert.ok(dividedMessage.includes(BASIC_SENTENCE_NOTICE));
    assert.ok(divided.every(line=>!dividedMessage.includes(line.text)));
    globalThis.fetch=async(url,init)=>{requests.push(JSON.parse(init.body));return Response.json({text:'ok'});};
    for(const lines of [divided,[{text:review.items[0].draft_value+'\n\nretained'}]]) {
      const answer=await client.requestDosaText({report:{sections:[]},topic:'성격',lines,chefId:'noona',model:'sonnet'});
      assert.ok(answer.includes(BASIC_SENTENCE_NOTICE));
      assert.deepEqual(basicSentenceMatches(requests.at(-1).grounds.map(g=>g.text).join('\n\n')),[]);
    }
    globalThis.fetch=async()=>Response.json({content:[{type:'text',text:output}]});
    output=review.items[0].draft_value;
    assert.equal((await call([{text:'unrelated'}])).status,502);
    globalThis.fetch=async()=>Response.json({text:output});
    assert.equal(await client.requestDosaText({report:result.after.rows[0].report,topic:'성격',lines:[],chefId:'noona',model:'sonnet'}),null);
  } finally {globalThis.fetch=fetch;}
});
test('current stale topic regrouping preserves adjacent unreviewed draft and group atomicity',()=>{
  const row=result.before.rows.find(r=>r.report.sections.find(s=>s.id==='ilju')?.block.key==='ilju/갑인');
  const draft=JSON.parse(readFileSync(new URL('../../dosa-app/kb/distilled/ilju/갑인.json',import.meta.url)));
  const lines=topics.topicLines(row.report,'성격');
  for(const index of [1,2])assert.ok(lines.some(l=>l.text.includes(draft.distilled.성격[index])));
  assert.ok(lines.some(l=>l.text===BASIC_SENTENCE_NOTICE));
  const excerptReport={sections:[{id:'ilju',block:{key:'ilju/갑인',excerpts:[{
    source:{doc:'original'},paras:[review.items[0].draft_value,'unreviewed excerpt'],
  }]}}]};
  const excerpts=topics.topicLines(excerptReport,'성격');
  assert.ok(excerpts.some(l=>l.text===BASIC_SENTENCE_NOTICE));
  assert.ok(excerpts.some(l=>l.text.includes('문헌 초안')));
});
