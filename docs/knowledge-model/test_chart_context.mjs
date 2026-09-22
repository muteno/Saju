import test from 'node:test';
import assert from 'node:assert/strict';
import { observations, exportContext, completesSamhap, selectDaewoon, parseInstant } from './chart_context.mjs';

const birth = { year: 1990, month: 1, day: 1, hour: 12, minute: 0, gender: 'F' };
const request = { birth, evaluated_at: '2026-09-22T12:00:00+09:00' };

test('canonical fixture retains visible absence while hidden wealth exists', () => {
  const r = exportContext(request);
  assert.equal(r.features['natal.day.stem.丙'], 1);
  assert.equal(r.features['natal.month.branch.子'], 1);
  assert.equal(r.features['natal.surface_role.wealth.present'], 0);
  assert.equal(r.features['natal.hidden_role.wealth.present'], 1);
  assert.equal(r.features['natal.stem.丙.fraction'], 0.5);
  assert.equal(r.probability, null);
  assert.equal(r.time_context.daewoon.status, 'unknown_period');
});

test('explicit unknown is not absence and does not change denominator', () => {
  const r = observations({ year: 5, month: 12, day: 2, hour: null });
  assert.equal(r.features['natal.surface_role.wealth.present'], null);
  assert.equal(r.features['natal.stem.丙.present'], 1);
  assert.equal(r.features['natal.stem.丙.fraction'], null);
  assert.deepEqual(r.bounds['natal.stem.丙.fraction'], [0.5, 0.75]);
  assert.equal(r.features['natal.hour.stem.甲'], null);
});

test('unknown time enumerates possible days instead of a midday placeholder', () => {
  const r = exportContext({ ...request, birth: { ...birth, hour: null, minute: null, solarTimeCorrection: false } });
  assert.equal(r.natal.scenarios, 1440);
  assert.deepEqual(r.natal.pillar_choices.day, [2, 3]);
  assert.equal(r.features['natal.day.stem.丙'], null);
  assert.equal(r.features['natal.hour.branch.午'], null);
  assert.equal(r.features['natal.year.stem.己'], 1);
});

test('unknown birth on solar-term boundary preserves year and month uncertainty', () => {
  const r = exportContext({ ...request, birth: { year: 2024, month: 2, day: 4, hour: null, gender: 'M', solarTimeCorrection: false } });
  assert.equal(r.natal.pillar_choices.year.length, 2);
  assert.equal(r.natal.pillar_choices.month.length, 2);
  assert.equal(r.features['natal.year.stem.甲'], null);
});

test('yearly and monthly context uses solar-term boundaries, not January 1', () => {
  const before = exportContext({ ...request, evaluated_at: '2024-02-04T17:00:00+09:00' });
  const after = exportContext({ ...request, evaluated_at: '2024-02-04T17:30:00+09:00' });
  assert.equal(before.features['time.yearly.stem.癸'], 1);
  assert.equal(after.features['time.yearly.stem.甲'], 1);
  assert.notEqual(before.time_context.monthly.pillar, after.time_context.monthly.pillar);
  assert.deepEqual(before.natal, after.natal);
});

test('explicit daewoon periods are half-open and gaps remain unknown', () => {
  const periods = [
    { start: '2020-01-01T00:00:00Z', end: '2030-01-01T00:00:00Z', pillar: 4, source: 'test supplied period, not birth-derived' },
    { start: '2030-01-01T00:00:00Z', end: '2040-01-01T00:00:00Z', pillar: 5, source: 'test supplied period, not birth-derived' },
  ];
  assert.equal(selectDaewoon(periods, parseInstant('2029-12-31T23:59:00Z')).pillar, 4);
  assert.equal(selectDaewoon(periods, parseInstant('2030-01-01T00:00:00Z')).pillar, 5);
  assert.equal(selectDaewoon(periods, parseInstant('2040-01-01T00:00:00Z')).pillar, null);
  assert.throws(() => selectDaewoon([periods[0], { ...periods[1], start: '2029-01-01T00:00:00Z' }], 0), /Overlapping/);
  assert.throws(() => selectDaewoon([{ ...periods[0], source: '' }], 0), /source policy/);
  assert.throws(() => selectDaewoon(periods, NaN), /finite/);
  const supplied = [{ ...periods[0], pillar: 10 }, periods[1]]; // fixture natal 寅午 + supplied 戌
  const before = exportContext({ ...request, daewoon_periods: supplied, evaluated_at: '2029-12-31T23:59:00Z' });
  const after = exportContext({ ...request, daewoon_periods: supplied, evaluated_at: '2030-01-01T00:00:00Z' });
  assert.equal(before.features['time.daewoon.completes_centered_samhap'], 1);
  assert.equal(after.features['time.daewoon.completes_centered_samhap'], 0);
  assert.deepEqual(before.natal, after.natal);
});

test('completion requires an existing center-containing pair and a missing member', () => {
  assert.equal(completesSamhap([8, 0, 2, 6], 4), 1); // 申子 + 辰
  assert.equal(completesSamhap([8, 4, 2, 6], 0), 0); // center absent in original pair
  assert.equal(completesSamhap([8, 0, 4, 6], 4), 0); // already complete
  assert.equal(completesSamhap([8, 8, 2, 6], 0), 0); // duplicate is not two members
  assert.equal(completesSamhap([8, 0, 2, null], 4), null);
  assert.equal(completesSamhap([8, 0, 2, 6], null), null);
  assert.equal(observations({ year: 8, month: 0, day: 2, hour: 6 }, { daewoon: 4 }).features['time.daewoon.completes_centered_samhap'], 1);
});

test('malformed and temporally impossible inputs fail explicitly', () => {
  assert.throws(() => exportContext({ ...request, birth: { ...birth, month: 2, day: 30 } }), /Gregorian/);
  assert.throws(() => exportContext({ ...request, birth: { ...birth, hour: 24 } }), /hour/);
  assert.throws(() => exportContext({ ...request, birth: { ...birth, hour: null } }), /Unknown hour/);
  assert.throws(() => exportContext({ ...request, evaluated_at: '1989-01-01T00:00:00Z' }), /before/);
  assert.throws(() => parseInstant('2026-09-22T12:00:00'), /UTC offset/);
  assert.throws(() => parseInstant('2026-09-22T12:00:01Z'), /precision/);
  assert.throws(() => observations({ year: true, month: 0, day: 2, hour: 6 }), /integer/);
  assert.throws(() => observations({ year: 0, month: 0, day: 2 }), /Exactly/);
});

test('timezone transition day cannot claim exhaustive unknown-time consensus', () => {
  const r = exportContext({ ...request, birth: { year: 2024, month: 3, day: 10, hour: null, gender: 'F', timeZone: 'America/New_York', longitude: -74 } });
  assert.equal(r.natal.status, 'timezone_transition_unresolved');
  assert.equal(r.features['natal.day.stem.甲'], null);
  assert.equal(r.features['time.yearly.stem_ten_god.비견'], null);
  assert.throws(() => exportContext({ ...request, birth: { year: 2024, month: 3, day: 10, hour: 2, minute: 30, gender: 'F', timeZone: 'America/New_York', longitude: -74 } }), /does not exist/);
  assert.throws(() => exportContext({ ...request, birth: { year: 2011, month: 12, day: 30, hour: null, gender: 'F', timeZone: 'Pacific/Apia', longitude: -172 } }), /No valid birth minute/);
});
