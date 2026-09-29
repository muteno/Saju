import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildContextReading, CONTEXT_READING_NOTICE } from '../../dosa-app/engine/src/contextReading.js';
import { computeChart } from '../../dosa-app/engine/src/manseryeok.js';
import { chartToKeys } from '../../dosa-app/engine/src/keyset.js';
import { buildReport } from '../../dosa-app/engine/src/report.js';
import { basicSentenceMatches } from '../../dosa-app/engine/src/basicSentences.js';
import { compareHiddenRoots, summarizeHiddenRoots } from './measure_hidden_root_context.mjs';
const { terms } = JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json', import.meta.url)));
const copy = value => JSON.parse(JSON.stringify(value));
const actual = (year, month, day, hour = 12) => computeChart({year,month,day,hour,minute:0,gender:'F',solarTimeCorrection:false,lateZiRule:'keepDay'}, terms);
let result;
before(async () => { result = await compareHiddenRoots(); });

test('128 independent help patterns retain the old score/boundaries and identify the exact supporting positions', () => {
  const labels = new Set(), scores = new Set();
  // 甲/丙 and 子/午: help/non-help without using the production tables or judge.
  const pillar = (stemHelp, branchHelp) => Array.from({length:60},(_,i)=>i)
    .find(i => i % 10 === (stemHelp ? 0 : 2) && i % 12 === (branchHelp ? 0 : 6));
  for (let mask = 0; mask < 128; mask++) {
    const bit = i => Boolean(mask & (1 << i));
    const chart = {input:{hour:12,minute:0}, pillarsIdx:{
      year:pillar(bit(0),bit(3)), month:pillar(bit(1),bit(4)),
      day:pillar(true,bit(5)), hour:pillar(bit(2),bit(6))}};
    const original = copy(chart), r = buildContextReading(chart), s = r.strength;
    const score = 10 + [10,10,10,10,30,15,15].reduce((sum,w,i)=>sum+(bit(i)?w:0),0);
    const label = score>=85?'극신강':score>=60?'신강':score>30?'중화':score>15?'신약':'극신약';
    assert.equal(s.observation.score,score); assert.equal(s.observation.max,110);
    assert.equal(s.observation.label,label); labels.add(label); scores.add(score);
    const expected = [];
    for (const [pos,si,bi] of [['year',0,3],['month',1,4],['day',null,5],['hour',2,6]]) {
      if (si!==null && bit(si)) expected.push(`${pos}:stem:0`);
      if (bit(bi)) expected.push(`${pos}:hidden:9`); // 子's principal is 癸, not 壬.
    }
    assert.deepEqual(s.supports.map(m=>`${m.position}:${m.part}:${m.stem}`),expected);
    assert.ok(s.supports.every(m=>m.part==='stem'||m.principal));
    assert.match(s.facts,new RegExp(`${label}\\(${score}/110점\\)`));
    assert.match(s.hypothesis,/해석 가설/); assert.match(r.note,/잠정 계산 기준.*확률이 아니/);
    assert.equal(r.probability,null); assert.equal(r.predictionEnabled,false); assert.equal(r.trainingEligible,false);
    assert.deepEqual(basicSentenceMatches(r),[]); assert.deepEqual(chart,original);
  }
  assert.equal(labels.size,5);
  for (const score of [10,20,30,35,55,60,80,85]) assert.ok(scores.has(score));
});

test('actual same 갑인/month-hour roles gain different whole-chart explanations without changing the old pair text', () => {
  const charts=[actual(2011,2,28),actual(2026,2,9),actual(2024,2,20),actual(2023,2,25)];
  const readings=charts.map(buildContextReading);
  assert.deepEqual(readings.map(r=>r.dayPillar),Array(4).fill('갑인'));
  assert.deepEqual(readings.map(r=>[r.monthMain.tenGod,r.hourStem.tenGod]),Array(4).fill(['비견','편관']));
  for(const pos of ['month','day','hour'])assert.equal(charts[0].pillarsIdx[pos],charts[1].pillarsIdx[pos]);
  assert.notEqual(charts[0].pillarsIdx.year,charts[1].pillarsIdx.year);
  assert.equal(new Set(readings.map(r=>r.blocks[2].lines[0])).size,1);
  assert.deepEqual(readings.map(r=>r.strength.observation.score),[65,55,65,85]);
  assert.deepEqual(readings.map(r=>r.strength.observation.label),['신강','중화','신강','극신강']);
  assert.equal(new Set(readings.map(r=>r.strength.facts)).size,4);
  assert.equal(new Set(readings.map(r=>r.strength.hypothesis)).size,2);
  assert.equal(new Set(readings.map(r=>r.experienceQuestions[2].prompt)).size,2);
  for(const r of readings){
    assert.equal(r.experienceQuestions.length,3);
    assert.ok(r.blocks[2].lines.includes(r.strength.facts));
    assert.ok(r.blocks[2].lines.includes(r.strength.hypothesis));
    assert.match(r.experienceQuestions[2].prompt,/최근.*(맞았거나 달랐|무리 없었|차이가 없)/);
  }
});

test('unknown and malformed inputs never turn into a weak chart; returned data cannot mutate future readings', () => {
  const c=actual(2024,2,20);
  const bad=[null,{}, {...c,birthTime:{status:'unknown'}},{...c,input:{...c.input,hourUnknown:true}},
    {...c,pillarsIdx:[]}, {...c,pillarsIdx:{...c.pillarsIdx,hour:undefined}},
    ...[null,undefined,-1,24,'12',true].map(hour=>({...c,input:{...c.input,hour}})),
    ...[null,undefined,-1,60,'0',true].map(minute=>({...c,input:{...c.input,minute}}))];
  for(const value of bad)assert.equal(buildContextReading(value),null);
  const original=copy(c),expected=buildContextReading(c),r=buildContextReading(c);
  r.strength.observation.detail.year.stemHelp=false; r.strength.supports.length=0;
  r.experienceQuestions[2].prompt='modified'; r.blocks[2].lines.length=0;
  assert.deepEqual(c,original); assert.deepEqual(buildContextReading(c),expected);
});

test('110 complete consumers change only the context card/work topic/summary and preserve unknown8 with no requests', () => {
  let known=0,unknown=0;
  for(const [i,row] of result.after.rows.entries()){
    const prior=result.before.rows[i];
    if(row.profile.hourUnknown){unknown++;assert.deepEqual(row,prior);assert.equal(row.requests.length,0);continue;}
    known++;
    const sec=row.report.sections.find(s=>s.id==='context-reading'),old=prior.report.sections.find(s=>s.id==='context-reading');
    assert.deepEqual(sec.context.blocks.slice(0,2),old.context.blocks.slice(0,2));
    assert.deepEqual(sec.context.groups,old.context.groups); assert.deepEqual(sec.context.conditions,old.context.conditions);
    assert.deepEqual(sec.context.blocks[2].lines.slice(0,4),old.context.blocks[2].lines);
    assert.deepEqual(sec.context.experienceQuestions.slice(0,2),old.context.experienceQuestions.slice(0,2));
    const card=row.reading.cards.find(c=>c.id==='context-reading');
    assert.deepEqual(card.blocks,sec.context.blocks); assert.equal(card.note,sec.context.note);
    assert.equal(card.title,sec.title);
    assert.deepEqual(row.hook.report.sections.find(s=>s.id==='context-reading'),sec);
    assert.deepEqual(row.hook.reading.cards.find(c=>c.id==='context-reading'),card);
    for(const text of [sec.context.strength.facts,sec.context.strength.hypothesis,sec.context.strength.question.prompt,sec.context.strength.roots.facts,sec.context.strength.roots.interpretation,sec.context.note]){
      assert.ok(row.summary.includes(text),row.id); assert.ok(row.topics.직업.some(l=>l.text===text));
      for(const req of row.requests)assert.ok(req.chartSummary.includes(text));
    }
    const normalized=copy(row);
    for(const rep of [normalized.report,normalized.hook.report])rep.sections=rep.sections.map(s=>s.id==='context-reading'?copy(old):s);
    const oldCard=prior.reading.cards.find(c=>c.id==='context-reading');
    for(const reading of [normalized.reading,normalized.hook.reading])reading.cards=reading.cards.map(c=>c.id==='context-reading'?copy(oldCard):c);
    normalized.topics.직업=[...copy(prior.topics.직업.slice(0,old.lines.length)),...normalized.topics.직업.slice(sec.lines.length)];
    const replaceSummary=s=>s.replace(`원국 조건에 따른 풀이: ${sec.lines.join(' / ')}`,`원국 조건에 따른 풀이: ${old.lines.join(' / ')}`);
    normalized.summary=replaceSummary(normalized.summary);
    for(const req of normalized.requests){
      req.chartSummary=replaceSummary(req.chartSummary);
      if(req.topic==='직업'){
        assert.deepEqual(req.grounds.slice(0,sec.lines.length).map(l=>l.text),sec.lines);
        req.grounds=[...copy(prior.requests.find(x=>x.topic==='직업').grounds.slice(0,old.lines.length)),...req.grounds.slice(sec.lines.length)];
      }
    }
    assert.deepEqual(normalized,prior,row.id); assert.deepEqual(basicSentenceMatches(row.reading),[]);
  }
  assert.equal(known,102);assert.equal(unknown,8);
  assert.equal(result.after.rows.reduce((n,r)=>n+r.requests.length,0),510);
});

test('generated/free answers retain root observations without duplication or false failure for an observation-only answer', async () => {
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const require=createRequire(new URL('../../app/package.json',import.meta.url));
  const {createServer}=await import(pathToFileURL(require.resolve('vite')).href);
  const server=await createServer({root:root+'app',server:{middlewareMode:true},appType:'custom',logLevel:'error'});
  const fetch=globalThis.fetch;
  try{
    const client=await server.ssrLoadModule('/src/data/dosaClient.ts');
    const topics=await server.ssrLoadModule('/src/data/dosaTopics.ts');
    for(const date of [[2024,1,8],[2024,1,7],[2024,2,6]]){
      const chart=actual(...date),report=buildReport(chart,chartToKeys(chart),{index:{},aliases:{},bodies:{}});
      const context=report.sections.find(s=>s.id==='context-reading').context, roots=context.strength.roots;
      const clauses=roots.facts.split(/(?<=[.?!…])\s+/);
      const body='함께 확인할 본문이에요.';
      const replies=[body,`${roots.facts} ${roots.facts}\n\n${context.blocks[3].lines.join(' ')}\n\n${body}`,
        `${clauses.join('\n\n')}\n\n${body}`,`${clauses[0]}\n\n${body}`,roots.facts,clauses.join('\n\n')];
      for(const topic of ['직업','성격'])for(const [i,text] of replies.entries()){
        let sent;
        globalThis.fetch=async(_,options)=>{sent=JSON.parse(options.body);return Response.json({text});};
        const answer=await client.requestDosaText({topic,report,lines:topics.topicLines(report,topic),chefId:'noona',model:'sonnet',...(topic==='성격'?{question:'내 지장간에 일간과 같은 글자가 있나요?'}:{})});
        assert.ok(answer,`observation-only answers must not become a failure: ${topic}/${i}`);
        for(const observation of [context.strength.facts,context.strength.hypothesis,roots.facts,roots.interpretation])assert.ok(sent.chartSummary.includes(observation));
        assert.equal(answer.split(CONTEXT_READING_NOTICE).length-1,1);
        assert.equal(answer.split(roots.facts).length-1,1);
        for(const clause of clauses)assert.equal(answer.split(clause).length-1,1);
        for(const q of context.experienceQuestions){
          assert.equal(answer.split(q.prompt).length-1,topic==='직업'||i===1?1:0);
          if(topic==='직업'&&i<4)assert.ok(answer.indexOf(body)<answer.indexOf(q.prompt));
        }
      }
    }
  }finally{globalThis.fetch=fetch;await server.close();}
});

test('new hidden-root receipt matches current source/output and preserves every PR219 row hash', () => {
  assert.deepEqual(summarizeHiddenRoots(result),JSON.parse(readFileSync(new URL('data/hidden_root_context_delivery.json',import.meta.url))));
  const previous=JSON.parse(readFileSync(new URL('data/strength_context_delivery.json',import.meta.url)));
  assert.equal(previous.policy,'natal-work-context-v3');
  assert.deepEqual(summarizeHiddenRoots(result).rows.map(r=>r.before_sha256),previous.rows.map(r=>r.after_sha256));
});

// Literal reference table, intentionally independent of the runtime table/helper.
const oracleHidden=['壬癸','癸辛己','戊丙甲','甲乙','乙癸戊','戊庚丙','丙己丁','丁乙己','戊壬庚','庚辛','辛丁戊','戊甲壬'];
const oracleStems='甲乙丙丁戊己庚辛壬癸';
const pos=['year','month','day','hour'];
test('14400 independent symbol/position vectors distinguish exact character, element and principal/additional scope',()=>{
 let count=0;const states=new Set();
 for(let day=0;day<60;day++)for(const axis of pos)for(let value=0;value<60;value++){
  const chart={input:{hour:12,minute:0},pillarsIdx:{year:0,month:1,day,hour:2}};chart.pillarsIdx[axis]=value;
  const d=chart.pillarsIdx.day%10,roots=buildContextReading(chart).strength.roots;
  for(const [key,match] of [['sameStem',c=>c===oracleStems[d]],['sameElement',c=>Math.floor(oracleStems.indexOf(c)/2)===Math.floor(d/2)]]){
   const principal=[],additional=[];
   for(const q of pos){const chars=[...oracleHidden[chart.pillarsIdx[q]%12]];chars.forEach((c,i)=>{if(match(c))(i===chars.length-1?principal:additional).push(`${q}:${c}`);});}
   assert.deepEqual(roots[key].principal.map(m=>`${m.position}:${m.character}`),principal);
   assert.deepEqual(roots[key].additional.map(m=>`${m.position}:${m.character}`),additional);
   const expected=principal.length?'principal_present':additional.length?'additional_only':'absent';
   assert.equal(roots[key].status,expected);assert.ok(roots[key].principal.every(m=>m.principal));assert.ok(roots[key].additional.every(m=>!m.principal));
  }
  states.add(roots.sameStem.status+'/'+roots.sameElement.status);count++;
 }
 assert.equal(count,14400);assert.equal(states.size,6);
});

test('actual dates distinguish extra same character, element-only, absent and already-counted principal; score stays unchanged',()=>{
 const dates=[[2024,1,8],[2024,1,7],[2024,2,6],[2024,1,2],[2024,1,1],[2024,1,25]];
 const expected=[['additional_only','additional_only'],['absent','additional_only'],['absent','absent'],['principal_present','principal_present'],['additional_only','principal_present'],['absent','principal_present']];
 for(let i=0;i<dates.length;i++){
  const r=buildContextReading(actual(...dates[i])),roots=r.strength.roots;
  assert.deepEqual([roots.sameStem.status,roots.sameElement.status],expected[i]);
  assert.ok(r.blocks[2].lines.includes(roots.facts));assert.ok(r.blocks[2].lines.includes(roots.interpretation));
  assert.equal(roots.facts.split(/(?<=[.?!…])\s+/).length,2);
  assert.equal(r.experienceQuestions.length,3);assert.equal(r.experienceQuestions[2].prompt,roots.question);
  assert.match(roots.facts,/본기 밖 글자.*따로 더하지 않았/);assert.match(roots.facts,/통근의 강도나 실제 능력을 정하지/);
 }
 const elementOnly=buildContextReading(actual(2024,1,7)).strength.roots;
 assert.equal(elementOnly.sameElement.additional[0].character,'辛');assert.equal(elementOnly.sameElement.additional[0].position,'month');
});

test('root observations have no cross-call aliases and unknown time cannot become absence',()=>{
 const chart=actual(2024,1,8),baseline=buildContextReading(chart),r=buildContextReading(chart);
 r.strength.roots.sameStem.additional[0].character='변조';r.strength.roots.sameElement.additional.length=0;
 assert.deepEqual(buildContextReading(chart),baseline);
 for(const c of [{...chart,birthTime:{status:'unknown'}},{...chart,input:{...chart.input,hour:null}},{...chart,pillarsIdx:{...chart.pillarsIdx,hour:null}}])assert.equal(buildContextReading(c),null);
});
