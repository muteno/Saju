import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareStrength, inheritedLabel, supportPatterns, boundaryInputs, boundaryRow, civilAmbiguity, verifyEvidence, overlapWitness} from './measure_calculation_policies.mjs';
import {STEM_ELEMENT,HIDDEN_STEMS} from '../../dosa-app/engine/src/tables.js';

test('independent element arithmetic covers every support pattern and isolated delta',()=>{
  const rows=supportPatterns();
  assert.equal(rows.length,128);
  for(const row of rows){
    const master=STEM_ELEMENT[row.pillars.day%10];
    const help=stem=>[master,(master+4)%5].includes(STEM_ELEMENT[stem]);
    const score=weights=>Object.entries(row.pillars).reduce((sum,[pos,p])=>sum+
      (help(p%10)?10:0)+(help(HIDDEN_STEMS[p%12].at(-1))?weights[pos]:0),0);
    assert.equal(row.current.score,score({year:15,month:30,day:15,hour:10}));
    assert.equal(row.counterfactual.score,score({year:10,month:30,day:15,hour:15}));
    assert.equal(row.delta,5*(Number(row.current.detail.hour.branchHelp)-Number(row.current.detail.year.branchHelp)));
    for(const flag of ['deukryeong','deukji','deuksi','deukse']) assert.equal(row.current[flag],row.counterfactual[flag]);
  }
});

test('all existing cutoffs are explicit, including strict greater-than boundaries',()=>{
  for(const [score,label] of [[15,'극신약'],[16,'신약'],[30,'신약'],[31,'중화'],[59,'중화'],[60,'신강'],[84,'신강'],[85,'극신강']])
    assert.equal(inheritedLabel(score),label);
  for(const p of [null,{year:0,month:0,day:0,hour:null},{year:0,month:0,day:0,hour:true},{year:0,month:0,day:0,hour:60}])
    assert.throws(()=>compareStrength(p),/known integer/);
});

const clocks=Object.fromEntries(boundaryInputs().map(row=>[row.id,boundaryRow(row)]));
test('late zi changes both day and hour stems; corrected midnight is separate',()=>{
  assert.deepEqual(clocks['civil-22-59'].changed_pillars,[]);
  const at23=clocks['civil-23-0'].results;
  assert.equal(at23.midnight23.names.day,'정묘'); assert.equal(at23.midnight23.names.hour,'경자');
  assert.equal(at23.keepDay.names.day,'병인'); assert.equal(at23.keepDay.names.hour,'무자');
  assert.deepEqual(clocks['civil-0-0'].changed_pillars,[]);
  assert.deepEqual(clocks['seoul-lmt-1-23-31'].changed_pillars,[]);
  assert.deepEqual(clocks['seoul-lmt-1-23-32'].changed_pillars,['day','hour']);
  assert.deepEqual(clocks['seoul-lmt-2-0-31'].changed_pillars,['day','hour']);
  assert.deepEqual(clocks['seoul-lmt-2-0-32'].changed_pillars,[]);
});

test('solar-term year/month uses absolute time regardless of late zi and longitude correction',()=>{
  for(const correction of [false,true]){
    const before=clocks[`ipchun-before-${correction}`],after=clocks[`ipchun-after-${correction}`];
    for(const rule of ['midnight23','keepDay']){
      assert.ok(before.results[rule].utc_ms<before.term_utc_ms);
      assert.ok(after.results[rule].utc_ms>=after.term_utc_ms);
      assert.equal(before.results[rule].names.year,'계묘'); assert.equal(after.results[rule].names.year,'갑진');
      assert.equal(before.results[rule].names.month,'을축'); assert.equal(after.results[rule].names.month,'병인');
    }
  }
  for(const rule of ['midnight23','keepDay']) assert.deepEqual(clocks['same-instant-seoul'].results[rule].pillars,clocks['same-instant-utc'].results[rule].pillars);
});

test('independent roundtrip detects repeated midnight hour missed by current adapter',()=>{
  const r=civilAmbiguity({year:2019,month:2,day:16,timeZone:'America/Sao_Paulo'});
  assert.equal(r.ambiguous_civil_minutes,60);
  assert.deepEqual(r.first_ambiguous.utc_choices,['2019-02-17T01:00:00.000Z','2019-02-17T02:00:00.000Z']);
  assert.deepEqual(overlapWitness().map(r=>r.pillars.day),[20,21]);
  assert.deepEqual(overlapWitness().map(r=>r.civil_offset_minutes),[-120,-180]);
  assert.deepEqual(overlapWitness().map(r=>r.civil_correction_minutes),[-67,-7]);
});

test('stored unknown-time ranges retain day and term ambiguity and withhold overlap bounds',()=>{
  const m=JSON.parse(readFileSync(new URL('data/foundation_calculation_measurement.json',import.meta.url)));
  const byId=Object.fromEntries(m.unknown_time.map(r=>[r.id,r]));
  assert.deepEqual(byId['ordinary-civil-midnight23'].natal.pillar_choices.day,[2,3]);
  assert.deepEqual(byId['ordinary-civil-keepDay'].natal.pillar_choices.day,[2]);
  assert.equal(byId['ipchun-midnight23'].natal.pillar_choices.year.length,2);
  assert.equal(byId['ipchun-keepDay'].natal.pillar_choices.month.length,2);
  for(const rule of ['midnight23','keepDay'])for(const id of ['dst-gap','midnight-overlap']){
    const row=byId[`${id}-${rule}`];
    assert.equal(row.audit_status,'timezone_transition_unresolved');
    assert.equal(row.current,null);assert.equal(row.counterfactual,null);assert.equal(row.delta_range,null);
  }
  assert.equal(byId['midnight-overlap-midnight23'].natal.status,'minute_scenarios');
  assert.equal(m.apply_to_runtime,false);assert.equal(m.use_as_training_labels,false);assert.equal(m.probability,null);
});

test('evidence edits and activation flags cannot pass verification',()=>{
  const review=JSON.parse(readFileSync(new URL('data/foundation_calculation_review.json',import.meta.url)));
  verifyEvidence(review);
  const changed=structuredClone(review);changed.evidence[0].excerpt+=' altered';
  assert.throws(()=>verifyEvidence(changed),/Evidence mismatch/);
  assert.throws(()=>verifyEvidence({...review,apply_to_runtime:true}));
  const wrongWeights=structuredClone(review);wrongWeights.comparison.counterfactual_branch_weights.year=999;
  assert.throws(()=>verifyEvidence(wrongWeights));
  assert.throws(()=>verifyEvidence({...review,evidence:review.evidence.slice(1)}));
});
