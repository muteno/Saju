import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compare, summarize, hash } from './measure_hyeonchim_consumers.mjs';
import { buildReport, toMarkdown, hyeonchimObservation, HYEONCHIM_NOTICE } from '../../dosa-app/engine/src/report.js';
import { computeChart } from '../../dosa-app/engine/src/manseryeok.js';
import { chartToKeys } from '../../dosa-app/engine/src/keyset.js';

const prior = JSON.parse(readFileSync(new URL('data/foundation_hyeonchim_measurement.json', import.meta.url)));
const snapshot = JSON.parse(readFileSync(new URL('data/foundation_hyeonchim_consumers.json', import.meta.url)));
const copy = x => JSON.parse(JSON.stringify(x));
const sinsal = report => report.sections.find(s=>s.id==='sinsal');
const candidate = report => sinsal(report)?.blocks.find(b=>b.key==='sinsal/현침살');
const named = value => /현침|懸針|悬针/.test(JSON.stringify(value));
let result;
before(async()=>{result=await compare();});

// Independent character oracle; does not read the engine's marker constants or auspicious().
function expectedMarkers(pillars) {
  return ['year','month','day','hour'].flatMap(position => {
    const n=pillars[position], stem='甲乙丙丁戊己庚辛壬癸'[n%10], branch='子丑寅卯辰巳午未申酉戌亥'[n%12];
    return [...('甲辛'.includes(stem)?[{position,part:'stem',character:stem}]:[]),
      ...('卯午未申'.includes(branch)?[{position,part:'branch',character:branch}]:[])];
  });
}

test('240 pillar and 12 combination fixtures preserve exact surface markers without manifestation',()=>{
  for(const row of [...prior.engine.singlePillars,...prior.engine.combinations]) {
    const actual=hyeonchimObservation({pillarsIdx:row.pillars});
    assert.deepEqual(actual.markers,expectedMarkers(row.pillars));
    assert.equal(actual.markerCount,actual.markers.length);
    assert.equal(actual.status,'candidate_only');assert.equal(actual.manifestation,'withheld');
    assert.equal(actual.probability,null);assert.equal(actual.basis,'legacy-surface-character-list-v1');
  }
  const cases=Object.fromEntries(prior.engine.combinations.map(r=>[r.id,hyeonchimObservation({pillarsIdx:r.pillars})]));
  assert.equal(cases['hidden-jia-only'].markerCount,0);assert.equal(cases['eight-markers'].markerCount,8);
  assert.equal(cases['jia-ji-neighbor'].markerCount,1);assert.equal(cases['jia-ji-separated'].markerCount,1);
});

test('missing, invalid and explicitly unknown pillars cannot become a candidate observation',()=>{
  for(const n of [null,undefined,-1,60,1.5,'3',true,NaN]) {
    assert.throws(()=>hyeonchimObservation({pillarsIdx:{year:0,month:0,day:0,hour:n}}));
  }
  for(const input of [{hourUnknown:true},{hour:null},{minute:null}])
    assert.throws(()=>hyeonchimObservation({input,pillarsIdx:{year:0,month:0,day:0,hour:0}}));
  assert.throws(()=>hyeonchimObservation({birthTime:{status:'unknown'},pillarsIdx:{year:0,month:0,day:0,hour:0}}));
});

test('fixed real KB and all 110 complete outputs reproduce the recorded comparison',()=>{
  assert.deepEqual(summarize(result),snapshot);
  assert.equal(result.after.rows.length,110);assert.equal(result.after.rows.filter(r=>r.profile.hourUnknown).length,8);
  assert.deepEqual(result.before.assets,result.after.assets);
  assert.deepEqual(result.after.lookup.chain,['sinsal/신살이란?']);
  assert.equal(result.after.lookup.index[0].entries.length,2);
  assert.equal(result.after.lookup.distilled,null);assert.equal(result.after.lookup.brain_node,null);
});

test('candidate positions are exact and unrelated cards, excerpts and source labels are preserved',()=>{
  for(let i=0;i<result.after.rows.length;i++) {
    const row=result.after.rows[i],old=result.before.rows[i];
    if(row.profile.hourUnknown)continue;
    const current=copy(row),expected=copy(old), block=candidate(row.report);
    const pillars=Object.fromEntries(row.chart.pillars.map(p=>[{'년':'year','월':'month','일':'day','시':'hour'}[p.title],p.gan+p.ji]));
    const expectedCount=Object.values(pillars).reduce((n,p)=>n+Number('甲辛'.includes(p[0]))+Number('卯午未申'.includes(p[1])),0);
    assert.equal(!!block,expectedCount>0);
    if(block) {
      const map={'year':'년','month':'월','day':'일','hour':'시'};
      for(const m of block.observation.markers) {
        const p=row.chart.pillars.find(p=>p.title===map[m.position]);
        assert.equal(m.character,m.part==='stem'?p.gan:p.ji);
      }
      assert.equal(block.observation.markerCount,expectedCount);
      assert.equal(block.label,'현침살 글자 후보');assert.equal(block.observation.manifestation,'withheld');
      assert.equal(block.observation.probability,null);assert.ok(!block.excerpts && !block.distilled);
      assert.match(block.note,/성향·직업·사건을 판단하지 않아요/);assert.match(block.note,/해석을 보류/);
      for(const [a,b] of [[current.reading,expected.reading],[current.hook.reading,expected.hook.reading]]) {
        assert.deepEqual(a.cards.find(c=>c.id==='sinsal').blocks[0],{label:block.label,lines:[block.note]});
        assert.ok(!a.cards.find(c=>c.id==='sinsal').chips.includes('현침살'));
        const newBlocks=a.cards.find(c=>c.id==='sinsal').blocks;
        for(const oldBlock of b.cards.find(c=>c.id==='sinsal').blocks.filter(x=>x.label!=='현침살'))
          assert.ok(newBlocks.some(x=>JSON.stringify(x)===JSON.stringify(oldBlock)),`Lost other excerpt/source: ${row.id}/${oldBlock.label}`);
        assert.ok(newBlocks.length<=6);
        a.cards=a.cards.filter(c=>c.id!=='sinsal');b.cards=b.cards.filter(c=>c.id!=='sinsal');
      }
    }
    for (const [a,b] of [[current.reading,expected.reading],[current.hook.reading,expected.hook.reading]]) {
      a.cards=a.cards.filter(c=>c.id!=='ilju'); b.cards=b.cards.filter(c=>c.id!=='ilju');
      assert.deepEqual(a,b,`Unrelated reading changed: ${row.id}`);
    }
    assert.deepEqual(row.report,row.hook.report);assert.deepEqual(row.reading,row.hook.reading);
  }
});

test('unknown eight inputs are unchanged and candidate-free dates gain no candidate claims',()=>{
  let unknown=0,none=0;
  for(let i=0;i<result.after.rows.length;i++) {
    const row=result.after.rows[i];
    if(row.profile.hourUnknown || !candidate(row.report)) {
      if(row.profile.hourUnknown){unknown++;assert.deepEqual(row,result.before.rows[i]);assert.deepEqual(row.report.sections,[]);assert.deepEqual(row.requests,[]);}
      else {none++; for(const key of ['report','reading','topics','requests','hook'])assert.deepEqual(row[key],result.before.rows[i][key]);}
    }
  }
  assert.equal(unknown,8);assert.ok(none>=1);
});

test('even an injected hyeonchim distilled interpretation cannot bypass report deferral or Markdown',()=>{
  const {terms}=JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
  const input=prior.engine.reports[0].input,chart=computeChart(input,terms),keys=chartToKeys(chart);
  const payload='INJECTED_PERSONAL_CLAIM';
  const kb={aliases:{},index:{},bodies:{},distilled:{'sinsal/현침살':{distilled:{핵심:payload,직업:[payload]}}}};
  const report=buildReport(chart,keys,kb);
  assert.ok(candidate(report));assert.ok(!JSON.stringify(report).includes(payload));
  const md=toMarkdown(report);assert.match(md,/현침살 글자 후보/);assert.match(md,/해석을 보류/);
  assert.ok(!md.includes(payload));
});

test('Brain withholds whole named records while chart, summary, fortune and selected opening stay identical',()=>{
  for(let i=0;i<result.after.rows.length;i++) {
    const row=result.after.rows[i], old=result.before.rows[i];
    for(const key of ['summary','chart','fortune','direct','raw','keys','input','share'])
      assert.deepEqual(row[key],old[key],`${row.id}/${key}`);
    for(const field of ['노드','관계','조견표']) {
      assert.deepEqual(row.brain[field],old.brain[field].filter(r=>!named(r)));
      assert.equal(row.brain.보류?.[field]??0,old.brain[field].length-row.brain[field].length);
    }
    assert.deepEqual(row.brain.못맞춘키,old.brain.못맞춘키);
  }
});

test('frozen report, vendor, reading and original thirteen tests retain exact baseline bytes',()=>{
  const dir=new URL('fixtures/hyeonchim-consumers-v1/',import.meta.url);
  const manifest=JSON.parse(readFileSync(new URL('manifest.json',dir)));
  assert.equal(manifest.commit,'41fbb1f8f3ad0bc07daffac8b8a4fc4ee960063b');assert.equal(manifest.files.length,7);
  for(const f of manifest.files)assert.equal(hash(readFileSync(new URL(f.path,dir),'utf8').replace(/\r\n/g,'\n')),f.sha256_lf);
  assert.equal(readFileSync(new URL('../../dosa-app/engine/src/report.js',import.meta.url),'utf8'),
    readFileSync(new URL('../../app/src/engine/vendor/report.js',import.meta.url),'utf8'));
});

test('all report fields retain unrelated assertions and remove complete named claims without rewriting sources',()=>{
  let heldRows=0;
  for(let i=0;i<result.after.rows.length;i++) {
    const row=result.after.rows[i],old=result.before.rows[i]; let held=false;
    const baseline=copy(old.report);
    for(let j=0;j<baseline.sections.length;j++) {
      const sec=baseline.sections[j], actual=row.report.sections[j];
      const revise=(b,newBlock)=>{
        if(b.key==='sinsal/현침살')return copy(newBlock);
        let count=0; const keep=v=>{if(!named(v))return true;count++;return false;};
        if(b.distilled){
          for(const [k,v] of Object.entries(b.distilled.distilled??{})) {
            if(Array.isArray(v))b.distilled.distilled[k]=v.filter(keep);
            else if(!keep(v))delete b.distilled.distilled[k];
          }
          for(const k of ['인용','관점차이','기타'])if(Array.isArray(b.distilled[k]))b.distilled[k]=b.distilled[k].filter(keep);
        }
        for(const ex of b.excerpts??[])ex.paras=ex.paras.filter(keep);
        if(count){held=true;b.withheld={topic:'현침살',count,note:HYEONCHIM_NOTICE};}
        return b;
      };
      if(sec.block)sec.block=revise(sec.block,actual.block);
      if(sec.blocks)sec.blocks=sec.blocks.map((b,k)=>revise(b,actual.blocks[k]));
    }
    assert.deepEqual(row.report,baseline,row.id);if(held)heldRows++;
    for(const c of row.reading.cards.filter(c=>c.id!=='sinsal')) for(const b of c.blocks)
      assert.ok(b.lines.every(l=>!named(l)),`${row.id}/${c.id}`);
  }
  assert.equal(heldRows,15);
});

test('all five actual consultation requests exclude held assertions and preserve unrelated topic text',()=>{
  for(let i=0;i<result.after.rows.length;i++) {
    const row=result.after.rows[i],old=result.before.rows[i];
    if(row.profile.hourUnknown)continue;
    assert.equal(row.requests.length,5);
    for(const [topic,lines] of Object.entries(row.topics)) {
      const substantive=lines.filter(l=>l.text!==HYEONCHIM_NOTICE);
      assert.ok(substantive.every(l=>!named(l.text)),`${row.id}/${topic}`);
      const oldText=old.topics[topic].flatMap(l=>l.text.split('\n\n')).filter(t=>!named(t));
      assert.deepEqual(substantive.flatMap(l=>l.text.split('\n\n')),oldText,`${row.id}/${topic}`);
      const request=row.requests.find(r=>r.topic===topic);
      assert.equal(request.chartSummary,row.summary);
      assert.deepEqual(request.grounds,lines.map(l=>({text:l.text,grounds:l.grounds??[]})));
    }
  }
});

test('injected ilju quotations, comparison groups and raw paragraphs cannot bypass the eligibility boundary',()=>{
  const {terms}=JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json',import.meta.url)));
  const chart=computeChart(prior.engine.reports[0].input,terms),keys=chartToKeys(chart), key=keys.byTopic.ilju[0];
  const safe='Unrelated original assertion',bad='현침살 개인 직업 확정',hanja='懸針 個人發現';
  const unit={sources:[{doc:'original',title:'original'}],distilled:{핵심:bad,직업:[safe,bad]},인용:[{text:safe,src:'a'},{text:hanja,src:'b'}],
    관점차이:[{주제:'comparison',견해:[{src:'a',내용:safe},{src:'b',내용:bad}]}]};
  const kb={aliases:{},index:{},bodies:{},distilled:{[key]:unit}},before=copy(kb);
  const report=buildReport(chart,keys,kb),b=report.sections.find(s=>s.id==='ilju').block;
  assert.deepEqual(kb,before);assert.deepEqual(b.distilled.distilled,{직업:[safe]});
  assert.deepEqual(b.distilled.인용,[{text:safe,src:'a'}]);assert.deepEqual(b.distilled.관점차이,[]);
  assert.equal(b.withheld.count,4);assert.ok(!toMarkdown(report).includes(bad));assert.ok(!toMarkdown(report).includes(hanja));
  const raw={aliases:{},index:{[key]:[{key:'unit',doc:'original',title:'original'}]},bodies:{unit:{paras:[safe,bad,hanja],totalParas:3}}};
  assert.deepEqual(buildReport(chart,keys,raw).sections.find(s=>s.id==='ilju').block.excerpts[0].paras,[safe]);
});
