import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hasUnknownBirthTime, UNKNOWN_BIRTH_TIME_NOTICE } from '../../app/src/engine/birthTime.js';
import { runFrozenAudit } from './frozen_app_audit.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../app/package.json', import.meta.url));
const baseline = JSON.parse(readFileSync(new URL('data/foundation_strength_consumers.json', import.meta.url)));
const corrected = new Map(JSON.parse(readFileSync(new URL('data/foundation_strength_correction.json', import.meta.url))).rows.map(r => [r.id, r.after]));
const OriginalDate = globalThis.Date, originalFetch = globalThis.fetch;
let engine, profiles, readings, topics, client, jeonggok, server, directory;

before(async () => {
  const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
  directory = mkdtempSync(resolve(tmpdir(), 'saju-unknown-time-'));
  for (const path of ['scripts', 'app/public', 'app/src/engine/vendor']) mkdirSync(resolve(directory, path), { recursive: true });
  symlinkSync(resolve(root, 'dosa-app'), resolve(directory, 'dosa-app'), 'junction');
  writeFileSync(resolve(directory, 'scripts/build_kb.mjs'), readFileSync(resolve(root, 'scripts/build_kb.mjs')));
  const clock = `const D = Date; globalThis.Date = class extends D { constructor(...a) { super(...(a.length ? a : ['2026-09-28T00:00:00Z'])); } static now() { return D.parse('2026-09-28T00:00:00Z'); } };`;
  writeFileSync(resolve(directory, 'clock.mjs'), clock);
  execFileSync(process.execPath, ['--import', pathToFileURL(resolve(directory, 'clock.mjs')).href, resolve(directory, 'scripts/build_kb.mjs')], { cwd: directory, timeout: 30000, stdio: 'pipe' });
  globalThis.Date = class extends OriginalDate {
    constructor(...args) { super(...(args.length ? args : [baseline.evaluated_at])); }
    static now() { return OriginalDate.parse(baseline.evaluated_at); }
  };
  const pointer = JSON.parse(readFileSync(resolve(directory, 'app/src/engine/vendor/kb_ref.json')));
  const livePointer = JSON.parse(readFileSync(resolve(root, 'app/src/engine/vendor/kb_ref.json')));
  const assets = new Map([
    [`/${livePointer.file}`, readFileSync(resolve(directory, 'app/public', pointer.file))],
    ['/brain.json', readFileSync(resolve(root, 'app/public/brain.json'))],
  ]);
  globalThis.fetch = async url => {
    assert.ok(assets.has(String(url)), `Unexpected fetch: ${url}`);
    return new Response(assets.get(String(url)), { headers: { 'content-type': 'application/json' } });
  };
  server = await createServer({ root: resolve(root, 'app'), server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  engine = await server.ssrLoadModule('/src/engine/index.js');
  profiles = await server.ssrLoadModule('/src/data/profiles.ts');
  readings = await server.ssrLoadModule('/src/data/saju.ts');
  topics = await server.ssrLoadModule('/src/data/dosaTopics.ts');
  client = await server.ssrLoadModule('/src/data/dosaClient.ts');
  jeonggok = await server.ssrLoadModule('/src/data/jeonggok.ts');
  await engine.loadKb(); await engine.loadBrain();
});
after(async () => {
  globalThis.Date = OriginalDate; globalThis.fetch = originalFetch;
  try { await server?.close(); } finally { if (directory) rmSync(directory, { recursive: true, force: true }); }
});

test('unknown profile/share round trips preserve missing time and all calendar policies', () => {
  for (const row of baseline.rows.filter(r => r.profile.hourUnknown)) {
    const p = row.profile, input = profiles.profileToInput(p);
    assert.deepEqual(input, { ...row.input, hour: null, minute: null, hourUnknown: true });
    const query = profiles.profileToSearch(p), share = profiles.parseShare(query);
    assert.deepEqual(share.input, input); assert.equal(profiles.matchesShare(p, share), true);
    assert.equal(new URLSearchParams(query).has('t'), false);
    assert.deepEqual(profiles.profileToInput({ ...p, hour: 23, minute: 59 }), input);
    assert.deepEqual(profiles.parseShare(query + '&t=08:24').input, input);
  }
});

test('all public app calculation boundaries withhold unknown and legacy noon inputs', () => {
  for (const row of baseline.rows.filter(r => r.profile.hourUnknown)) {
    for (const input of [profiles.profileToInput(row.profile), { ...row.input, hourUnknown: true }, { ...row.input, hour: null }]) {
      const chart = engine.computeChartUI(input), report = engine.buildReading(input);
      assert.deepEqual(chart.pillars, []); assert.deepEqual(chart.ohaeng, []);
      assert.equal(chart.daeun, null); assert.equal(chart.dayMaster, null); assert.equal(chart.corrected, null);
      assert.equal(chart.birthTime.status, 'unknown'); assert.deepEqual(report.sections, []);
      assert.equal(report.input.hour, null); assert.equal(report.input.minute, null);
      assert.equal(engine.jeonggokRaw(input), null); assert.equal(engine.todayFortune(input), null);
      assert.equal(readings.myTodayFortune(input), null);
      assert.deepEqual(engine.brainReading(input), { 노드: [], 관계: [], 조견표: [], 못맞춘키: [] });
    }
  }
});

test('unknown cards, dialogue and all topic grounds contain only the explicit deferral', () => {
  for (const row of baseline.rows.filter(r => r.profile.hourUnknown)) {
    const input = profiles.profileToInput(row.profile), rep = engine.buildReading(input);
    const reading = readings.toReading(input, { hourUnknown: false });
    assert.deepEqual(reading.cards.map(c => c.id), ['hour-unknown']);
    assert.equal(reading.dialogue.length, 1); assert.equal(reading.dialogue[0].lines[0], UNKNOWN_BIRTH_TIME_NOTICE);
    assert.equal(topics.chartSummaryOf(rep), UNKNOWN_BIRTH_TIME_NOTICE);
    for (const key of ['성격', '올해', '직업', '관계', '주의'])
      assert.deepEqual(topics.topicLines(rep, key), [{ text: UNKNOWN_BIRTH_TIME_NOTICE }]);
    assert.deepEqual(readings.toReading(row.input, { hourUnknown: true }), reading);
  }
});

test('explicit uncertainty cannot be overridden by false flags or stale known reports', async () => {
  const known = baseline.rows[0], rep = engine.buildReading(known.input);
  for (const [report, flag] of [[rep, true], [{ ...rep, input: { ...known.input, hourUnknown: true } }, false],
    [{ ...rep, birthTime: { status: 'unknown', policy: 'withhold-unverified-v1' } }, false]]) {
    assert.equal(topics.chartSummaryOf(report, flag), UNKNOWN_BIRTH_TIME_NOTICE);
    assert.deepEqual(topics.topicLines(report, '성격', flag), [{ text: UNKNOWN_BIRTH_TIME_NOTICE }]);
    // The fetch fixture rejects /api/dosa: any accidental provider call fails this assertion.
    assert.equal(await client.requestDosaText({ topic: '성격', report, hourUnknown: flag,
      lines: [{ text: 'stale private noon interpretation', grounds: [{ doc: 'stale' }] }],
      chefId: 'noona', model: 'sonnet', question: '내 사주는?' }), UNKNOWN_BIRTH_TIME_NOTICE);
  }
  const signal = AbortSignal.abort();
  assert.equal(await client.requestDosaText({ report: rep, hourUnknown: true, signal }), null);
});

test('forty known inputs preserve profile/share and enforce the explicit corrected strength policy', () => {
  const pick = p => p ? { token: p.token, layer: p.layer, evid: p.evid, line: p.line } : null;
  for (const row of baseline.rows.filter(r => !r.profile.hourUnknown)) {
    const input = profiles.profileToInput(row.profile), rep = engine.buildReading(input, '병오');
    const expected = corrected.get(row.id);
    assert.deepEqual(input, row.input);
    assert.deepEqual(profiles.parseShare(profiles.profileToSearch(row.profile)).input, input);
    assert.equal(topics.chartSummaryOf(rep), expected.summary);
    assert.equal(rep.sections.find(s => s.id === 'judge').lines[0], expected.report_line);
    const raw = engine.jeonggokRaw(input);
    assert.equal(raw.strength.score, row.weight_swap_only.score); assert.equal(raw.strength.label, row.weight_swap_only.label);
    assert.deepEqual(pick(jeonggok.selectJeonggok(raw)), row.direct_jeonggok);
    const reading = readings.toReading(input);
    assert.equal(reading.cards.find(c => c.id === 'judge').blocks[0].lines[0], expected.card.blocks[0].lines[0]);
    const brain = engine.brainReading(input, '병오');
    assert.deepEqual(brain.노드.map(n => n.키), expected.brain.matched_keys);
    assert.deepEqual(brain.못맞춘키, expected.brain.unmatched_keys);
    assert.equal(brain.관계.length + (brain.보류?.관계 ?? 0), expected.brain.relation_count);
    assert.ok(brain.관계.every(r => !/현침|懸針|悬针/.test(JSON.stringify(r))));
    assert.equal(engine.computeChartUI(input).pillars.length, 4);
    assert.ok(engine.todayFortune(input));
  }
});

test('null markers are unknown while midnight, noon and known defaults remain known', () => {
  for (const value of [{ hour: null }, { minute: null }, { hourUnknown: true }, { input: { hour: null } }])
    assert.equal(hasUnknownBirthTime(value), true);
  for (const value of [{ hour: 0, minute: 0 }, { hour: 12, minute: 0 }, { hourUnknown: false, hour: 8, minute: 24 }])
    assert.equal(hasUnknownBirthTime(value), false);
});

test('frozen audit timeout ends its child and cleans the temporary tree before caller deadlines', () => {
  let failure;
  try { runFrozenAudit(['-e', 'console.log(JSON.stringify({cwd:process.cwd(),pid:process.pid}));setTimeout(()=>{},30000)'], 1000); }
  catch (error) { failure = error; }
  assert.equal(failure?.code, 'ETIMEDOUT');
  const { cwd, pid } = JSON.parse(failure.stdout.trim());
  assert.equal(existsSync(cwd), false);
  assert.throws(() => process.kill(pid, 0));
});
