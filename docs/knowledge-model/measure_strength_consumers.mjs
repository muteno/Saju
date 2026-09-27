// Audit only. Execute the app's original modules through Vite; no app policy adoption.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { computeChart } from '../../dosa-app/engine/src/manseryeok.js';
import { chartToKeys } from '../../dosa-app/engine/src/keyset.js';
import { compareStrength } from './measure_calculation_policies.mjs';
import { exportContext, civilMinuteInstants } from './chart_context_v2.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = new URL('data/foundation_strength_consumers.json', import.meta.url);
const require = createRequire(new URL('../../app/package.json', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const textHash = bytes => hash(bytes.toString().replace(/\r\n/g, '\n'));
const load = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const { terms } = load('dosa-app/engine/data/solar_terms.json');
const instant = '2026-09-28T00:00:00Z';
const unique = xs => [...new Set(xs)].sort((a, b) => typeof a === 'number' ? a - b : a.localeCompare(b, 'en'));
const range = xs => [Math.min(...xs), Math.max(...xs)];
const pick = p => p ? { token: p.token, layer: p.layer, evid: p.evid, line: p.line } : null;
const strength = s => ({ score: s.score, max: s.max, label: s.label,
  flags: [s.deukryeong, s.deukji, s.deuksi, s.deukse] });

export const knownFixtures = [
  ['extreme-down', 2024, 1, 2, 12, 0], ['strong-down', 2024, 1, 3, 14, 0],
  ['strong-up', 2024, 1, 9, 0, 0], ['weak-down', 2024, 1, 13, 0, 0],
  ['weak-up', 2024, 1, 19, 16, 0],
  ['extreme-up', 1989, 4, 10, 8, 0],
  ['zi-before', 1990, 1, 1, 23, 31], ['zi-after', 1990, 1, 1, 23, 32],
  ['ipchun-before', 2024, 2, 4, 17, 27], ['ipchun-after', 2024, 2, 4, 17, 28],
];
const unknownFixtures = [['ordinary', 1990, 1, 1, 8, 24], ['ipchun', 2024, 2, 4, 8, 24]];

// These are application source dependencies, not a claim that their policy is correct.
export const trackedFiles = [
  'app/src/engine/index.js', 'app/src/engine/brain.js', 'app/src/data/profiles.ts',
  'app/src/data/cities.ts', 'app/src/data/saju.ts', 'app/src/data/jeonggok.ts',
  'app/src/data/useReport.ts', 'app/src/pages/Analysis.tsx', 'app/src/data/dosaTopics.ts',
  'app/src/pages/Intro.tsx',
  'app/src/data/enneaLens.ts', 'app/src/components/BrainPanel.tsx',
  ...['manseryeok', 'tables', 'judge', 'keyset', 'report', 'sinsal', 'relations', 'unse']
    .flatMap(name => [`dosa-app/engine/src/${name}.js`, `app/src/engine/vendor/${name}.js`]),
  'dosa-app/engine/data/solar_terms.json', 'app/src/engine/vendor/data/solar_terms.json',
  'app/public/brain.json', 'docs/knowledge-model/chart_context_v2.mjs',
  'docs/knowledge-model/chart_context.mjs', 'scripts/build_kb.mjs', 'app/package.json',
  'docs/knowledge-model/measure_calculation_policies.mjs',
  'docs/knowledge-model/data/foundation_calculation_review.json',
  'docs/knowledge-model/data/foundation_calculation_measurement.json',
  'docs/knowledge-model/data/foundation_timezone_measurement.json',
  'docs/knowledge-model/measure_strength_consumers.mjs',
];

// Run the unmodified KB builder with a fixed date in an isolated output tree.
// Production app/public and vendor pointers are never rewritten by this audit.
function auditBundle(directory) {
  for (const path of ['scripts', 'app/public', 'app/src/engine/vendor']) mkdirSync(resolve(directory, path), { recursive: true });
  symlinkSync(resolve(root, 'dosa-app'), resolve(directory, 'dosa-app'), 'junction');
  writeFileSync(resolve(directory, 'scripts/build_kb.mjs'), readFileSync(resolve(root, 'scripts/build_kb.mjs')));
  writeFileSync(resolve(directory, 'clock.mjs'), `const OriginalDate = Date;\n` +
    `globalThis.Date = class extends OriginalDate { constructor(...args) { super(...(args.length ? args : [${JSON.stringify(instant)}])); } static now() { return OriginalDate.parse(${JSON.stringify(instant)}); } };\n`);
  execFileSync(process.execPath, ['--import', pathToFileURL(resolve(directory, 'clock.mjs')).href, resolve(directory, 'scripts/build_kb.mjs')],
    { cwd: directory, timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
  const pointer = readFileSync(resolve(directory, 'app/src/engine/vendor/kb_ref.json'));
  const ref = JSON.parse(pointer);
  const payload = readFileSync(resolve(directory, 'app/public', ref.file));
  return { pointer, payload, file: ref.file, unseYears: JSON.parse(payload).meta.unseYears };
}

export async function measure() {
  const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
  const originalFetch = globalThis.fetch, OriginalDate = globalThis.Date;
  const directory = mkdtempSync(resolve(tmpdir(), 'saju-strength-audit-'));
  let server;
  // Reproduce the app's time-dependent selections at an explicit evaluation instant.
  class AuditDate extends OriginalDate {
    constructor(...args) { super(...(args.length ? args : [instant])); }
    static now() { return OriginalDate.parse(instant); }
  }
  try {
    server = await createServer({ root: resolve(root, 'app'),
      server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
    globalThis.Date = AuditDate;
    const bundle = auditBundle(directory);
    const kbRef = load('app/src/engine/vendor/kb_ref.json');
    const brainPayload = readFileSync(resolve(root, 'app/public/brain.json'));
    const allowed = new Map([[`/${kbRef.file}`, bundle.payload], ['/brain.json', brainPayload]]);
    // Only serve actual local build assets. No network, empty KB or invented content.
    globalThis.fetch = async url => {
      const payload = allowed.get(String(url));
      assert.ok(payload, `Unexpected audit fetch: ${url}`);
      return new Response(payload, { headers: { 'content-type': 'application/json' } });
    };
    const engine = await server.ssrLoadModule('/src/engine/index.js');
    const profiles = await server.ssrLoadModule('/src/data/profiles.ts');
    const readings = await server.ssrLoadModule('/src/data/saju.ts');
    const jeonggok = await server.ssrLoadModule('/src/data/jeonggok.ts');
    const topics = await server.ssrLoadModule('/src/data/dosaTopics.ts');
    await engine.loadKb();
    await engine.loadBrain();
    const rows = [];
    for (const hourUnknown of [false, true]) {
      for (const [id, year, month, day, hour, minute] of hourUnknown ? unknownFixtures : knownFixtures) {
        for (const solarCorrection of [true, false]) for (const lateZi of [false, true]) {
          const profile = { id: 'audit', createdAt: 1, name: '', calendar: '양력', gender: '여자',
            marital: '미혼', city: '서울', year, month, day, hour, minute, hourUnknown, solarCorrection, lateZi };
          const input = profiles.profileToInput(profile);
          const shared = profiles.parseShare(profiles.profileToSearch(profile));
          assert.deepEqual(shared.input, input, 'stored/share paths differ');
          assert.equal(shared.hourUnknown, hourUnknown);
          const chart = computeChart(input, terms), keys = chartToKeys(chart);
          const comparison = compareStrength(chart.pillarsIdx);
          const raw = engine.jeonggokRaw(input), rep = engine.buildReading(input, '병오');
          const reading = readings.toReading(input, { hourUnknown });
          const line = rep.sections.find(s => s.id === 'judge').lines[0];
          assert.deepEqual(raw.strength, comparison.current, 'raw and canonical strength differ');
          assert.deepEqual(keys.judge.strength, raw.strength, 'keyset and raw strength differ');
          const card = reading.cards.find(c => c.id === 'judge');
          if (!hourUnknown) assert.ok(card.blocks[0].lines[0].includes(raw.strength.label));
          const brain = engine.brainReading(input, '병오');
          const row = { id: `${hourUnknown ? 'unknown' : 'known'}-${id}-${solarCorrection ? 'solar' : 'civil'}-${lateZi ? 'keepDay' : 'midnight23'}`,
            profile, input, pillars: chart.pillarsIdx,
            current: strength(raw.strength), frame_keys: keys.byTopic.frame,
            report_line: line, reading_judge_card_present: !!card,
            reading_judge_line: card?.blocks[0].lines[0] ?? null,
            // Direct function output is NOT the guarded component's visible output.
            direct_jeonggok: pick(jeonggok.selectJeonggok(raw)),
            weight_swap_only: { ...strength(comparison.counterfactual), delta: comparison.delta,
              frame_key: `frame/${comparison.counterfactual.label}`,
              direct_jeonggok: pick(jeonggok.selectJeonggok({ ...raw, strength: comparison.counterfactual })) },
            summary: topics.chartSummaryOf(rep, hourUnknown),
            brain: { matched_keys: brain.노드.map(n => n.키), unmatched_keys: brain.못맞춘키,
              node_count: brain.노드.length, relation_count: brain.관계.length },
          };
          if (hourUnknown) {
            row.notice = reading.dialogue.find(d => d.label === '시간 모름')?.lines;
            row.card_ids = reading.cards.map(c => c.id);
            const fortune = readings.myTodayFortune(input);
            row.noon_fortune = { score: fortune.score, basis: fortune.basis };
            const birth = { ...input, timeZone: 'Asia/Seoul', hour: null, minute: null };
            const context = exportContext({ birth, evaluated_at: instant });
            const inverses = civilMinuteInstants(birth);
            // Only these two modern Seoul dates: assert no gap/fold before using the app's civil minutes.
            assert.equal(inverses.length, 1440);
            assert.equal(new Set(inverses.map(r => r.civil_minute)).size, 1440);
            const candidates = inverses.map(r => computeChart({ ...input,
              hour: Math.floor(r.civil_minute / 60), minute: r.civil_minute % 60 }, terms));
            const choices = Object.fromEntries(['year', 'month', 'day', 'hour'].map(p => [p, unique(candidates.map(c => c.pillarsIdx[p]))]));
            assert.deepEqual(choices, context.natal.pillar_choices);
            const strengths = candidates.map(c => compareStrength(c.pillarsIdx));
            row.possible = { scenarios: context.natal.scenarios, pillar_choices: choices,
              current_range: range(strengths.map(c => c.current.score)),
              current_labels: unique(strengths.map(c => c.current.label)),
              swap_range: range(strengths.map(c => c.counterfactual.score)),
              swap_labels: unique(strengths.map(c => c.counterfactual.label)), probability: null };
          }
          rows.push(row);
        }
      }
    }
    return { schema_version: 1, baseline_commit: '7c861977a39f55e5331d630818a88b7d2ed1ab00',
      evaluated_at: instant, scope: 'Application function execution, not component visibility or policy adoption',
      runtime: { node: process.version, icu: process.versions.icu, tz: process.versions.tz },
      assets: { kb: { generated_at: instant, file: bundle.file,
        pointer_sha256: hash(bundle.pointer), payload_sha256: hash(bundle.payload), unse_years: bundle.unseYears },
        brain_sha256: hash(brainPayload) },
      source_hashes: trackedFiles.map(path => ({ path, sha256_lf: textHash(readFileSync(resolve(root, path))) })),
      rows, apply_to_runtime: false, training_labels: false, probability: null };
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.Date = OriginalDate;
    try { await server?.close(); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  }
}

export function checkSnapshot(actual, expected) {
  const { runtime: a, ...result } = actual, { runtime: b, ...stored } = expected;
  assert.deepEqual(result, stored, 'App consumer audit drift; review a successor version, not silent hash replacement');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.ok(process.argv.length === 3 && ['--write', '--check'].includes(process.argv[2]),
      'Usage: node measure_strength_consumers.mjs --write|--check (after npm run build)');
    const result = await measure();
    if (process.argv[2] === '--write') writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
    else checkSnapshot(result, JSON.parse(readFileSync(output)));
    console.log(JSON.stringify({ rows: result.rows.length, unknown: result.rows.filter(r => r.profile.hourUnknown).length,
      apply_to_runtime: false, probability: null }));
  } catch (error) { console.error(error); process.exitCode = 1; }
}
