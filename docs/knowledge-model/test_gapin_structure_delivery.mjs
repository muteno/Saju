import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compare, summarize } from './measure_gapin_structure_delivery.mjs';
import records from '../../dosa-app/engine/src/gapinStructureData.js';
import blockedRecords from '../../dosa-app/engine/src/basicSentenceData.js';
import { gapinStructureReference } from '../../dosa-app/engine/src/gapinStructure.js';
import { computeChart } from '../../dosa-app/engine/src/manseryeok.js';
import { chartToKeys } from '../../dosa-app/engine/src/keyset.js';
import { buildReport, toMarkdown } from '../../dosa-app/engine/src/report.js';
import { basicSentenceMatches } from '../../dosa-app/engine/src/basicSentences.js';
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../app/package.json', import.meta.url));
const review = JSON.parse(readFileSync(new URL('data/gapin_structure_review.json', import.meta.url)));
const { terms } = JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json', import.meta.url)));
const copy = v => JSON.parse(JSON.stringify(v));
const chart = () => ({input:{hour:12,minute:0},pillarsIdx:{year:0,month:0,day:50,hour:0}});
let result, server, groups, presentation, components, api, client;
before(async()=>{
  result = await compare();
  const {createServer} = await import(pathToFileURL(require.resolve('vite')).href);
  server = await createServer({root:root+'app',server:{middlewareMode:true},appType:'custom',logLevel:'error'});
  groups = await server.ssrLoadModule('/src/data/analysisGroups.ts');
  presentation = await server.ssrLoadModule('/src/data/readingPresentation.ts');
  components = await server.ssrLoadModule('/src/components/ReportParts.tsx');
  api = (await server.ssrLoadModule('/@fs'+root+'functions/api/dosa.ts')).onRequestPost;
  client = await server.ssrLoadModule('/src/data/dosaClient.ts');
});
after(async()=>{await server?.close();});

test('five existing reviewed definitions are reused without expanding source metadata in the browser',()=>{
  execFileSync('python3',['scripts/build_gapin_structure_data.py','--check'],{cwd:root,stdio:'pipe'});
  assert.deepEqual(records.map(r=>r.id),['GS01','GS02','GS03','GS04','GS05']);
  for (const [i,item] of records.entries()) {
    const original=review.claims[i];
    assert.equal(item.text,original.text); assert.equal(item.scope,original.scope); assert.equal(item.limits,original.limits);
    assert.equal(item.sources,undefined);
    assert.equal(item.personalApplication,'withheld'); assert.equal(item.trainingEligible,false); assert.equal(item.probability,null);
  }
});

test('unknown, malformed, partial and other 59 day pillars cannot receive a personal-day reference',()=>{
  const invalid=[null,{}, {input:{hour:12,minute:0}}, {...chart(),birthTime:{status:'unknown'}},
    {...chart(),input:{hour:12,minute:0,hourUnknown:true}}];
  for(const field of ['hour','minute']) for(const value of [undefined,null,true,'0',-1,NaN,Infinity,field==='hour'?24:60])
    invalid.push({...chart(),input:{...chart().input,[field]:value}});
  for(const field of ['year','month','day','hour']) for(const value of [undefined,null,true,'50',-1,60,0.5])
    invalid.push({...chart(),pillarsIdx:{...chart().pillarsIdx,[field]:value}});
  for (const input of invalid) assert.equal(gapinStructureReference(input),null);
  for(let day=0;day<60;day++) if(day!==50)
    assert.equal(gapinStructureReference({...chart(),pillarsIdx:{...chart().pillarsIdx,day}}),null);
});

test('actual male/female and changing known hours share the verified structure but leave source conditions unknown',()=>{
  for(const gender of ['M','F']) for(const hour of [0,12,18]) {
    const c=computeChart({year:2024,month:2,day:20,hour,minute:0,gender,solarTimeCorrection:false,lateZiRule:false},terms);
    const ref=gapinStructureReference(c);
    assert.deepEqual(ref.observation,{dayIndex:50,dayStem:0,dayBranch:2,principalTenGod:'비견',
      hidden:[{stem:4,tenGod:'편재'},{stem:2,tenGod:'식신'},{stem:0,tenGod:'비견'}],stage:'건록'});
    assert.equal(ref.sourcePresenceCondition,'unknown'); assert.equal(ref.probability,null);
    const report=buildReport(c,chartToKeys(c),{index:{},aliases:{},bodies:{}});
    assert.ok(report.sections.find(s=>s.id==='ilju').block.gapinConditions.items.every(i=>i.status!=='met'));
  }
});

test('110 real-KB inputs change only the new structure and attribution wording; conditions and unknown8 stay equal',()=>{
  assert.deepEqual(summarize(result),JSON.parse(readFileSync(new URL('data/gapin_structure_delivery.json',import.meta.url))));
  let references=0, unknown=0;
  for(const [i,row] of result.after.rows.entries()) {
    const old=result.before.rows[i], normalized=copy(row), expected=copy(old);
    const ref=row.report.sections.find(s=>s.id==='ilju')?.block?.structureReference;
    if(ref) {
      references++;
      assert.deepEqual(ref.items.map(r=>r.id),['GS01','GS02','GS03','GS04','GS05']);
      assert.equal(row.report.sections.find(s=>s.id==='ilju').block.key,'ilju/갑인');
      for(const rep of [normalized.report,normalized.hook.report]) delete rep.sections.find(s=>s.id==='ilju').block.structureReference;
      for(const reading of [normalized.reading,normalized.hook.reading]) reading.cards=reading.cards.filter(c=>c.id!=='ilju-structure');
    }
    if(row.profile.hourUnknown) {unknown++; assert.equal(ref,undefined); assert.equal(row.requests.length,0);}
    // Only presentation strings can change: derive the expected replacement from
    // the prior report's own comparison members, preserving order and every word.
    const views=old.report.sections.find(s=>s.id==='ilju')?.block?.distilled?.관점차이 ?? [];
    const replacements=views.map(pd=>({pd,text:`${pd.주제}에는 다른 해석도 있어요. ${pd.견해.map((v,n)=>`견해 ${n+1}: "${v.내용}"`).join(', ')}`}));
    const present=text=>{
      const match=replacements.find(({pd})=>text.startsWith('문헌마다 보는 눈이 다르구나 — '+pd.주제));
      return match ? match.text : presentation.displayReadingText(text);
    };
    for(const lines of Object.values(expected.topics)) for(const line of lines) line.text=present(line.text);
    for(const request of expected.requests) for(const line of request.grounds) line.text=present(line.text);
    assert.deepEqual(normalized,expected,`${row.id}: unauthorized consumer change`);
    assert.deepEqual(basicSentenceMatches(row.reading),[]);
  }
  assert.equal(references,1); assert.equal(unknown,8);
  assert.equal(result.after.rows.reduce((n,r)=>n+r.requests.length,0),510);
});

test('empty KB still retains source-defined report references and Markdown without restoring blocked effects',()=>{
  const c=computeChart({year:2024,month:2,day:20,hour:12,minute:0,gender:'F',solarTimeCorrection:false},terms);
  const report=buildReport(c,chartToKeys(c),{index:{},aliases:{},bodies:{}});
  const ref=report.sections.find(s=>s.id==='ilju').block.structureReference;
  assert.equal(ref.items.length,5);
  const md=toMarkdown(report);
  for(const r of records) assert.ok(md.includes(r.text));
  assert.deepEqual(basicSentenceMatches(md),[]);
});

test('structure card keeps five definitions/limits without citations and uses the existing evidence group',()=>{
  for(const row of result.after.rows.filter(r=>r.reading.cards.some(c=>c.id==='ilju-structure'))) {
    const card=row.reading.cards.find(c=>c.id==='ilju-structure');
    assert.equal(card.blocks.length,5);
    for(const [i,block] of card.blocks.entries()) {
      assert.deepEqual(block.lines,[records[i].text,records[i].displayLimit]);
    }
    const grouped=groups.buildTopicGroups(row.reading);
    assert.deepEqual(grouped.filter(g=>g.cards.some(c=>c.id==='ilju-structure')).map(g=>g.id),['etc']);
    for(const k of ['topics','requests','brain']) assert.ok(!JSON.stringify(row[k]).includes('gapin-structure-reference-v1'));
  }
});

test('reference mutations do not contaminate another chart or the generated canonical records',()=>{
  const c=chart(), original=copy(c), first=gapinStructureReference(c);
  first.items[0].text='tampered';first.items[1].limits='tampered';
  assert.deepEqual(gapinStructureReference(c).items,records);assert.deepEqual(c,original);
  execFileSync(process.execPath,['scripts/sync_engine.mjs','--check'],{cwd:root,stdio:'pipe'});
});

test('existing card and live/stale API boundaries omit citation labels while retaining content and conditions',async()=>{
  const {createElement}=require('react'), {renderToStaticMarkup}=require('react-dom/server');
  const html=renderToStaticMarkup(createElement(components.ReportCard,{card:{id:'test',title:'비교',blocks:[
    {label:'관점 차이 — 성격',lines:['숨길자료명: 조건이 있을 때의 해석'],source:'숨길자료명 · 제목'},
  ]}}));
  assert.ok(!html.includes('숨길자료명'));assert.ok(html.includes('조건이 있을 때의 해석'));
  const text='조건이 있을 때만 적용해요.\n\n미상이면 판단을 보류해요.';
  assert.equal(presentation.withoutCitationLines(text),text);
  assert.equal(presentation.withoutCitationLines('조건: 월지 일치\n해석: 가능성'),'조건: 월지 일치\n해석: 가능성');
  const fetch=globalThis.fetch;let sent;
  try {
    globalThis.fetch=async(url,init)=>{
      sent=JSON.parse(init.body);
      return Response.json({content:[{type:'text',text}]});
    };
    const response=await api({request:new Request('https://example.test/api/dosa',{method:'POST',body:JSON.stringify({topic:'성격',grounds:[{text:'조건이 있을 때만 적용해요.',grounds:[{doc:'숨길자료명',title:'비공개표시'}]}]})}),env:{ANTHROPIC_API_KEY:'test-only'}});
    assert.equal(response.status,200);assert.equal((await response.json()).text,presentation.withoutCitationLines(text));
    assert.ok(sent.system[0].text.includes('출처·자료명·저자명'));
    assert.ok(!sent.messages[0].content.includes('숨길자료명'));
    const ambiguous=[
      '조건을 따져야 해요.\n출처: 문헌A. 단, 식상이 없으면 이 풀이를 적용하지 마세요.',
      '조건이 있을 때만 적용해요. (출처: 문헌A)',
      '▸근거줄: 식상 유무는 미상 · 문헌A',
      '▸근거: 식상이 있을 때 / 문헌A',
      blockedRecords[0].needles[0].replace('매사에 적극적','매사에\n출처: 참고 문헌\n적극적'),
    ];
    for(const answer of ambiguous) {
      assert.equal(presentation.withoutCitationLines(answer),'');
      globalThis.fetch=async()=>Response.json({content:[{type:'text',text:answer}]});
      const fallback=await api({request:new Request('https://example.test/api/dosa',{method:'POST',body:JSON.stringify({topic:'성격',grounds:[]})}),env:{ANTHROPIC_API_KEY:'test-only'}});
      assert.equal(fallback.status,502);
      globalThis.fetch=async()=>Response.json({text:answer});
      assert.equal(await client.requestDosaText({report:{sections:[]},topic:'성격',lines:[],chefId:'noona',model:'sonnet'}),null);
    }
    globalThis.fetch=async()=>Response.json({text});
    assert.equal(await client.requestDosaText({report:{sections:[]},topic:'성격',lines:[],chefId:'noona',model:'sonnet'}),presentation.withoutCitationLines(text));
    globalThis.fetch=async()=>Response.json({text:'출처: 제목'});
    assert.equal(await client.requestDosaText({report:{sections:[]},topic:'성격',lines:[],chefId:'noona',model:'sonnet'}),null);
  } finally {globalThis.fetch=fetch;}
});
