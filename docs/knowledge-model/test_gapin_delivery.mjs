import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compare, summarize } from './measure_gapin_delivery.mjs';
import records from '../../dosa-app/engine/src/gapinSentenceData.js';
import originalRecords from '../../dosa-app/engine/src/basicSentenceData.js';
import { applyBasicSentencePolicy as applyOld } from './fixtures/gapin-delivery-v1/dosa-app/engine/src/basicSentences.js';
import { evaluateGapinConditions, gapinConditionLines } from '../../dosa-app/engine/src/gapinConditions.js';
import { applyBasicSentencePolicy, basicSentenceMatches, basicSentenceReviews, safeBasicSentenceParagraphs, GAPIN_SENTENCE_NOTICE } from '../../dosa-app/engine/src/basicSentences.js';
import { computeChart } from '../../dosa-app/engine/src/manseryeok.js';
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../app/package.json', import.meta.url));
const review = JSON.parse(readFileSync(new URL('data/gapin_sentence_review.json', import.meta.url)));
const draft = JSON.parse(readFileSync(new URL('../../dosa-app/kb/distilled/ilju/갑인.json', import.meta.url)));
const { terms } = JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json', import.meta.url)));
const copy = value => JSON.parse(JSON.stringify(value));
let result, server, topics, client, api;
before(async () => {
  result = await compare();
  const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
  server = await createServer({ root: root+'app', server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  topics = await server.ssrLoadModule('/src/data/dosaTopics.ts');
  client = await server.ssrLoadModule('/src/data/dosaClient.ts');
  api = (await server.ssrLoadModule('/@fs'+root+'functions/api/dosa.ts')).onRequestPost;
});
after(async () => { await server?.close(); });

test('new 110-input receipt is reproducible and preserves unknown-time, chart and existing nontext contracts', () => {
  assert.deepEqual(summarize(result), JSON.parse(readFileSync(new URL('data/gapin_delivery.json', import.meta.url))));
  let unknown = 0;
  for (let i=0; i<result.after.rows.length; i++) {
    const row = result.after.rows[i], old = result.before.rows[i];
    if (row.profile.hourUnknown) { unknown++; assert.deepEqual(row, old); assert.equal(row.requests.length, 0); continue; }
    for (const key of ['chart','raw','keys','fortune','summary','direct','input','share']) assert.deepEqual(row[key], old[key], `${row.id}/${key}`);
    assert.deepEqual(row.report.sections.find(s=>s.id==='sinsal'), old.report.sections.find(s=>s.id==='sinsal'));
    assert.deepEqual(row.reading.cards.find(c=>c.id==='sinsal'), old.reading.cards.find(c=>c.id==='sinsal'));
    if (row.report.sections.find(s=>s.id==='ilju')?.block.key !== 'ilju/갑인')
      for (const field of ['reading','topics','requests','brain']) assert.deepEqual(row[field],old[field],`${row.id}/unrelated-${field}`);
    for (const field of ['reading','topics','requests','brain']) assert.deepEqual(basicSentenceMatches(row[field]), [], `${row.id}/${field}`);
    assert.deepEqual(row.hook.report, row.report); assert.deepEqual(row.hook.reading, row.reading);
  }
  assert.equal(unknown,8); assert.equal(result.after.rows.reduce((n,r)=>n+r.requests.length,0),510);
});

test('35 source claims retain exact review, physical provenance, prior reuse and all comparison members', () => {
  assert.equal(records.length,35);
  for (const item of review.items.filter(i=>i.id!=='GI36')) {
    const record=basicSentenceReviews('ilju/갑인').find(r=>r.id===item.id);
    assert.deepEqual(record.review,item.review); assert.deepEqual(record.priorReviewIds,item.prior_review_ids);
    assert.equal(record.personalApplication,'withheld'); assert.equal(record.probability,null);
    for (const [i, source] of record.sources.entries()) {
      const span=review.spans.find(s=>s.id===item.evidence[i]);
      assert.deepEqual(source.bodyParagraphs,span.body_paragraphs);
      assert.deepEqual(source.xmlParagraphs,span.paragraphs.map(p=>p.xml_paragraph));
    }
    assert.ok(basicSentenceMatches(item.draft_value,'ilju/갑인').includes(item.id));
  }
  for (const group of review.perspective_groups) for (const id of group.member_item_ids)
    assert.ok(group.member_item_ids.every(other=>basicSentenceMatches(records.find(r=>r.id===id).needles[0],'ilju/갑인').includes(other)));
});

test('full known draft, quotes, comparison groups and partial reuse are withheld without mutating originals', () => {
  const original=copy(draft), b={key:'ilju/갑인',distilled:draft};
  const filtered=applyBasicSentencePolicy(b);
  assert.deepEqual(draft,original); assert.deepEqual(filtered.sentences,[]);
  assert.deepEqual(filtered.distilled.관점차이,[]); assert.deepEqual(filtered.distilled.인용,[]); assert.deepEqual(filtered.distilled.기타,[]);
  assert.deepEqual(applyBasicSentencePolicy(filtered),filtered);
  assert.equal(filtered.basicReview.status,'source_reviewed_personal_withheld');
  assert.equal(filtered.basicReview.unreviewedNotice,GAPIN_SENTENCE_NOTICE);
  assert.ok(filtered.basicReview.withheldIds.includes('GI21'));
  for (const record of records) {
    const text=record.needles[0], out=applyBasicSentencePolicy({key:'ilju/병자',distilled:{distilled:{성격:['unrelated',text.normalize('NFD')]}}});
    if (record.matchScope === 'gapin_block_only') {
      assert.equal(out.distilled.distilled.성격.length,2);
      assert.ok(!out.basicReview.reviewed.some(r=>r.id===record.id));
      continue;
    }
    assert.deepEqual(out.distilled.distilled.성격,['unrelated']);
    assert.ok(out.basicReview.reviewed.some(r=>r.id===record.id));
    assert.deepEqual(safeBasicSentenceParagraphs(text+'\n\n'+text.replaceAll(' ','\n\n')),[]);
  }
  for (const record of originalRecords) for (const text of record.needles) {
    const old=applyOld({key:'ilju/병자',distilled:{distilled:{성격:['unrelated',text]}}});
    const next=applyBasicSentencePolicy(old);
    assert.ok(next.basicReview.withheldIds.includes(record.id));
    assert.ok(next.basicReview.reviewed.some(r=>r.id===record.id)); assert.ok(next.basicReview.note);
    assert.deepEqual(next.distilled,old.distilled);
  }
});

test('same day pillar with different sex and hour changes necessary scopes and observations, never approves outcomes', () => {
  const cases=[];
  for (const gender of ['M','F']) for (const hour of [0,12,18]) {
    const chart=computeChart({year:2024,month:2,day:20,hour,minute:0,gender,solarTimeCorrection:false,lateZiRule:false},terms);
    assert.equal(chart.pillarsIdx.day,50);
    const value=evaluateGapinConditions(chart); cases.push(value);
    const matching=value.items.find(i=>i.id===(gender==='M'?'GI09':'GI10'));
    assert.ok(matching.scopes.every(s=>s.status==='met')); assert.equal(matching.status,'unknown');
    assert.equal(value.items.find(i=>i!==matching).status,'unmet');
    assert.ok(gapinConditionLines(value).some(l=>l.includes(gender==='M'?'남자·갑인':'여자·갑인')));
    for (const item of value.items) { assert.equal(item.personalApplication,'withheld'); assert.equal(item.probability,null); }
  }
  assert.ok(new Set(cases.map(v=>JSON.stringify(v.observations))).size>1);
});

test('hidden 식신 does not erase the source absence branch; metal strength remains a male-only alternative', () => {
  const value=evaluateGapinConditions({input:{gender:'F',hour:12,minute:0},pillarsIdx:{year:0,month:0,day:50,hour:0}});
  assert.deepEqual(value.observations.stemsAndPrincipal,[]);
  assert.deepEqual(value.observations.stemsAndAllHidden,[{position:'day',part:'hidden_stem',stem:2,principal:false}]);
  assert.equal(value.observations.sourcePresenceCondition,'unknown');
  assert.deepEqual(value.items[1].branches.map(b=>b.id),['siksang_present','siksang_absent']);
  assert.ok(value.items.every(i=>i.branches.every(b=>b.status==='unknown')));
  assert.equal(value.items[0].branches[2].id,'metal_official_strong_alternative');
});

test('missing, malformed and unknown-time input cannot become a satisfied source condition', () => {
  for (const chart of [null,{}, {input:{hourUnknown:true,gender:'F'},pillarsIdx:{year:0,month:0,day:50,hour:0}},
    {input:{hour:null,minute:null},pillarsIdx:{day:50}}, {input:{gender:'unexpected'},pillarsIdx:{day:true}},
    ...[undefined,'12',true,-1,24].map(hour=>({input:{hour,minute:0},pillarsIdx:{year:0,month:0,day:50,hour:0}}))]) {
    const value=evaluateGapinConditions(chart);
    assert.equal(value.observations.stemsAndAllHidden,null);
    assert.ok(value.items.every(i=>i.status!=='met'));
    assert.ok(value.items.every(i=>i.status===(i.scopes.some(s=>s.status==='unmet')?'unmet':'unknown')));
    assert.ok(value.items.every(i=>i.scopes[0].status==='unknown'));
  }
  assert.ok(evaluateGapinConditions({pillarsIdx:{day:0},input:{gender:'F',hour:12,minute:0}}).items.every(i=>i.status==='unmet'));
});

test('old reports and stale caller lines lose every known new phrase at the actual request boundary', async () => {
  const old=result.before.rows.find(r=>r.report.sections.find(s=>s.id==='ilju')?.block.key==='ilju/갑인');
  for (const topic of ['성격','직업','관계','주의']) assert.deepEqual(basicSentenceMatches(topics.topicLines(old.report,topic)),[]);
  const fetch=globalThis.fetch, requests=[];
  try {
    globalThis.fetch=async(url,init)=>{requests.push(JSON.parse(init.body)); return Response.json({text:'모의 응답'});};
    const answer=await client.requestDosaText({report:old.report,topic:'직업',lines:[{text:records.find(r=>r.id==='GI10').needles[0]}],chefId:'noona',model:'sonnet'});
    assert.equal(requests.length,1); assert.deepEqual(basicSentenceMatches(requests[0].grounds),[]);
    assert.ok(answer.includes(GAPIN_SENTENCE_NOTICE));
  } finally {globalThis.fetch=fetch;}
});

test('31 portable claim phrases are withheld at server boundaries; generic metadata keeps its source scope', async () => {
  const fetch=globalThis.fetch; let generated='모의 응답'; const requests=[];
  const call=grounds=>api({request:new Request('https://example.test/api/dosa',{method:'POST',body:JSON.stringify({topic:'직업',grounds})}),env:{ANTHROPIC_API_KEY:'test-only'}});
  try {
    globalThis.fetch=async(url,init)=>{assert.equal(url,'https://api.anthropic.com/v1/messages'); requests.push(JSON.parse(init.body)); return Response.json({content:[{type:'text',text:generated}]});};
    for (const record of records.filter(r=>r.matchScope!=='gapin_block_only')) {
      const words=record.needles[0].split(' '), mid=Math.ceil(words.length/2);
      generated='모의 응답'; assert.equal((await call([{text:words.slice(0,mid).join(' ')},{text:words.slice(mid).join(' ')}])).status,200);
      assert.deepEqual(basicSentenceMatches(requests.at(-1).messages[0].content),[]);
      generated=record.needles[0]; assert.equal((await call([{text:'unrelated'}])).status,502);
    }
    for (const record of records.filter(r=>r.matchScope==='gapin_block_only')) {
      assert.deepEqual(basicSentenceMatches(record.needles[0]),[]);
      assert.ok(basicSentenceMatches(record.needles[0],'ilju/갑인').includes(record.id));
    }
  } finally {globalThis.fetch=fetch;}
});

test('source projection and canonical engine mirrors are validated', () => {
  execFileSync('python3',['scripts/build_gapin_sentence_policy.py','--check'],{cwd:root,stdio:'pipe'});
  execFileSync(process.execPath,['scripts/sync_engine.mjs','--check'],{cwd:root,stdio:'pipe'});
});
