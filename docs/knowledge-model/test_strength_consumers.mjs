import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { measure, checkSnapshot } from './measure_strength_consumers.mjs';

let result;
before(async () => { result = await measure(); });

test('actual Vite app consumers reproduce the separate audit without changing old policies', () => {
  checkSnapshot(result, JSON.parse(readFileSync(new URL('data/foundation_strength_consumers.json', import.meta.url))));
  assert.equal(result.rows.length, 48);
  assert.equal(result.apply_to_runtime, false);
  assert.equal(result.training_labels, false);
  assert.equal(result.probability, null);
});

test('six calendar witnesses cross inherited cutoffs when only year/hour weights are swapped', () => {
  const witnesses = { 'extreme-down': [85, 80], 'strong-down': [60, 55],
    'strong-up': [55, 60], 'weak-down': [35, 30], 'weak-up': [30, 35], 'extreme-up': [80, 85] };
  for (const [id, expected] of Object.entries(witnesses)) {
    const row = result.rows.find(r => r.id === `known-${id}-solar-midnight23`);
    assert.deepEqual([row.current.score, row.weight_swap_only.score], expected);
    assert.notEqual(row.current.label, row.weight_swap_only.label);
    assert.equal(row.weight_swap_only.delta, expected[1] - expected[0]);
    assert.deepEqual(row.current.flags, row.weight_swap_only.flags);
    assert.equal(row.frame_keys[0], `frame/${row.current.label}`);
    assert.ok(row.reading_judge_line.includes(row.current.label));
    assert.ok(!row.reading_judge_line.includes('/110'), 'UI card strips numeric score');
    // A changed candidate condition is not a changed winning opening.
    assert.deepEqual(row.direct_jeonggok, row.weight_swap_only.direct_jeonggok);
  }
});

test('unknown time audit distinguishes hidden cards from the still computed noon consumers', () => {
  const rows = result.rows.filter(r => r.profile.hourUnknown);
  assert.equal(rows.length, 8);
  for (const row of rows) {
    assert.equal(row.input.hour, 12);
    assert.equal(row.input.minute, 0);
    assert.equal(row.reading_judge_card_present, false);
    assert.doesNotMatch(row.summary, /구조 판정:|시주 [가-힣]{2}/);
    assert.ok(row.brain.matched_keys.includes(`frame/${row.current.label}`));
    assert.equal(row.possible.scenarios, 1440);
    assert.equal(row.possible.probability, null);
    assert.ok(row.possible.current_range[0] < row.possible.current_range[1]);
    // Known defect recorded for a successor fix, not an approved product requirement.
    assert.match(row.notice.join(''), /일주 중심의 풀이는 그대로 정확/);
  }
  const ordinary = rows.find(r => r.id === 'unknown-ordinary-solar-midnight23');
  assert.deepEqual(ordinary.possible.pillar_choices.day, [2, 3]);
  assert.deepEqual(ordinary.possible.current_range, [50, 70]);
  const ipchun = rows.find(r => r.id === 'unknown-ipchun-solar-midnight23');
  assert.deepEqual(ipchun.possible.pillar_choices.year, [39, 40]);
  assert.deepEqual(ipchun.possible.pillar_choices.month, [1, 2]);
  assert.deepEqual(ipchun.possible.current_range, [35, 75]);
  assert.deepEqual(ipchun.possible.swap_range, [30, 80]);
});

test('correction and late-zi propagate through stored/share inputs to the original app', () => {
  const row = id => result.rows.find(r => r.id === `known-${id}`);
  const before = row('zi-before-solar-midnight23');
  const after = row('zi-after-solar-midnight23');
  assert.notEqual(before.pillars.day, after.pillars.day);
  assert.notEqual(before.pillars.hour, after.pillars.hour);
  const keep = row('zi-after-solar-keepDay');
  assert.equal(keep.pillars.day, before.pillars.day);
  assert.equal(keep.input.lateZiRule, 'keepDay');
  assert.equal(row('zi-before-civil-midnight23').input.solarTimeCorrection, false);
  for (const clock of ['solar', 'civil']) for (const zi of ['midnight23', 'keepDay']) {
    const a = row(`ipchun-before-${clock}-${zi}`), b = row(`ipchun-after-${clock}-${zi}`);
    assert.notEqual(a.pillars.year, b.pillars.year);
    assert.notEqual(a.pillars.month, b.pillars.month);
  }
});

test('a changed source fingerprint or observed consumer value cannot silently pass', () => {
  const source = structuredClone(result);
  source.source_hashes[0].sha256_lf = '0'.repeat(64);
  assert.throws(() => checkSnapshot(result, source), /audit drift/);
  const observed = structuredClone(result);
  observed.rows[0].current.score++;
  assert.throws(() => checkSnapshot(result, observed), /audit drift/);
  const kb = structuredClone(result);
  kb.assets.kb.payload_sha256 = '0'.repeat(64);
  assert.throws(() => checkSnapshot(result, kb), /audit drift/);
});
