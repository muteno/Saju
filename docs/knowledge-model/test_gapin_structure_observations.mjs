import test from 'node:test';
import assert from 'node:assert/strict';
import { observe, measure } from './gapin_structure_observations.mjs';
import { evaluateGapinConditions } from '../../dosa-app/engine/src/gapinConditions.js';

test('source-bound Gapin names and isolated hidden-only counterexample', () => {
  const r = observe([0, 0, 50, 0]);
  assert.deepEqual([r.observations.dayStem, r.observations.dayBranch, r.observations.principal,
    r.observations.principalTenGod, r.observations.stage], ['甲', '寅', '甲', '비견', '건록']);
  assert.deepEqual(r.observations.hidden, [
    { symbol: '戊', tenGod: '편재' }, { symbol: '丙', tenGod: '식신' }, { symbol: '甲', tenGod: '비견' }]);
  assert.equal(r.observations.scopes.stemsOnly.present, false);
  assert.equal(r.observations.scopes.stemsAndPrincipal.present, false);
  assert.deepEqual(r.observations.scopes.stemsAndAllHidden.markers,
    [{ position: 'day', part: 'hidden_stem', stem: 2, principal: false, symbol: '丙', tenGod: '식신' }]);
  assert.equal(r.sourceAbsence, 'unknown');
});

test('180 labelled axis cases match independent fire-symbol oracle and current policy', () => {
  const measurement = measure();
  assert.deepEqual([measurement.cases, measurement.uniqueVectors], [180, 178]);
  assert.deepEqual(measurement.presentCounts, { stemsOnly: 36, stemsAndPrincipal: 60, stemsAndAllHidden: 180 });
  for (const row of measurement.rows) {
    // 甲生火: visible 丙/丁. Principal fire: 巳/午. 寅 itself always contains 丙.
    const visible = [2, 3].includes(row.index % 10);
    const principal = [5, 6].includes(row.index % 12);
    assert.deepEqual(row.present, { stemsOnly: visible, stemsAndPrincipal: visible || principal, stemsAndAllHidden: true });
    const r = observe(row.pillars);
    for (const gender of ['M', 'F']) {
      const policy = evaluateGapinConditions({ input: { hour: 12, minute: 0, gender },
        pillarsIdx: Object.fromEntries(['year', 'month', 'day', 'hour'].map((p, i) => [p, row.pillars[i]])) });
      for (const scope of ['stemsAndPrincipal', 'stemsAndAllHidden']) {
        const markers = r.observations.scopes[scope].markers.map(({ symbol, tenGod, ...m }) => m);
        assert.deepEqual(markers, policy.observations[scope]);
      }
      assert.deepEqual(policy.items.map(i => i.status), gender === 'M' ? ['unknown', 'unmet'] : ['unmet', 'unknown']);
      assert.equal(policy.items[0].branches.length, 3); // Male-only metal alternative.
      assert.equal(policy.items[1].branches.length, 2);
      assert.ok(policy.items.every(i => i.probability === null && i.personalApplication === 'withheld'));
    }
  }
});

test('missing symbol never turns into absence; other days are out of scope', () => {
  for (let i = 0; i < 4; i++) {
    const input = [0, 0, 50, 0]; input[i] = null;
    const r = observe(input);
    assert.equal(r.observations, null);
    assert.equal(r.sourcePresence, 'unknown');
    assert.equal(r.sourceAbsence, 'unknown');
    assert.equal(r.scope, i === 2 ? 'unknown' : 'met');
  }
  for (let day = 0; day < 60; day++) if (day !== 50) {
    const r = observe([0, 0, day, 0]);
    assert.equal(r.scope, 'unmet'); assert.equal(r.observations, null);
  }
});

test('invalid symbolic types and input lengths rejected', () => {
  for (const bad of [null, {}, [], Array(4), [0, 0, , 0], [0, 0, 50], [0, 0, 50, 0, 0],
    [true, 0, 50, 0], ['0', 0, 50, 0], [NaN, 0, 50, 0], [0, 0, 60, 0], [-1, 0, 50, 0]])
    assert.throws(() => observe(bad));
});
