// Execute pre-207 and current consumers with identical real KB, Brain and fixed clock.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { frozenApp } from './frozen_app_audit.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../app/package.json', import.meta.url));
const oldRows = JSON.parse(readFileSync(new URL('data/foundation_strength_consumers.json', import.meta.url))).rows;
const calendarRows = JSON.parse(readFileSync(new URL('data/foundation_hyeonchim_measurement.json', import.meta.url))).engine.reports;
const inputs = [...oldRows, ...calendarRows.map((row, i) => ({ id: `hyeonchim-${i}`, profile: {
  name: '검수', gender: '여자', calendar: '양력', city: '서울', marital: '미혼',
  year: row.input.year, month: row.input.month, day: row.input.day, hour: row.input.hour,
  minute: 0, hourUnknown: false, solarCorrection: false, lateZi: false,
} }))];
const instant = '2026-09-28T00:00:00Z';
const output = new URL('data/foundation_hyeonchim_consumers.json', import.meta.url);
export const hash = value => createHash('sha256').update(value).digest('hex');
const jsonHash = value => hash(JSON.stringify(value));
const plain = value => JSON.parse(JSON.stringify(value));
export const changedSources = ['dosa-app/engine/src/report.js', 'app/src/engine/vendor/report.js', 'app/src/data/saju.ts', 'app/src/data/dosaTopics.ts', 'app/src/engine/brain.js', 'app/src/components/BrainPanel.tsx'];

export async function capture() {
  const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
  const { createElement } = require('react');
  const { renderToString } = require('react-dom/server');
  const { MemoryRouter } = require('react-router-dom');
  const OriginalDate = Date, originalFetch = globalThis.fetch;
  const directory = mkdtempSync(resolve(tmpdir(), 'saju-hyeonchim-capture-'));
  let server;
  try {
    for (const path of ['scripts', 'app/public', 'app/src/engine/vendor']) mkdirSync(resolve(directory, path), { recursive: true });
    symlinkSync(resolve(root, 'dosa-app'), resolve(directory, 'dosa-app'), 'junction');
    writeFileSync(resolve(directory, 'scripts/build_kb.mjs'), readFileSync(resolve(root, 'scripts/build_kb.mjs')));
    writeFileSync(resolve(directory, 'clock.mjs'), `const D=Date;globalThis.Date=class extends D{constructor(...a){super(...(a.length?a:[${JSON.stringify(instant)}]));}static now(){return D.parse(${JSON.stringify(instant)});}};`);
    execFileSync(process.execPath, ['--import', pathToFileURL(resolve(directory, 'clock.mjs')).href, resolve(directory, 'scripts/build_kb.mjs')], { cwd: directory, timeout: 30000, stdio: 'pipe' });
    globalThis.Date = class extends OriginalDate {
      constructor(...args) { super(...(args.length ? args : [instant])); }
      static now() { return OriginalDate.parse(instant); }
    };
    const pointer = readFileSync(resolve(directory, 'app/src/engine/vendor/kb_ref.json'));
    const ref = JSON.parse(pointer), liveRef = JSON.parse(readFileSync(resolve(root, 'app/src/engine/vendor/kb_ref.json')));
    const kb = readFileSync(resolve(directory, 'app/public', ref.file));
    const brain = readFileSync(resolve(root, 'app/public/brain.json'));
    const requests = [];
    const assets = new Map([[`/${liveRef.file}`, kb], ['/brain.json', brain]]);
    globalThis.fetch = async (url, init) => {
      if (url === '/api/dosa') { requests.push(JSON.parse(init.body)); return Response.json({text:'transport check'}); }
      assert.ok(assets.has(String(url)), `Unexpected fetch: ${url}`);
      return new Response(assets.get(String(url)), { headers: { 'content-type': 'application/json' } });
    };
    server = await createServer({ root: resolve(root, 'app'), server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
    const engine = await server.ssrLoadModule('/src/engine/index.js');
    const profiles = await server.ssrLoadModule('/src/data/profiles.ts');
    const reading = await server.ssrLoadModule('/src/data/saju.ts');
    const topics = await server.ssrLoadModule('/src/data/dosaTopics.ts');
    const client = await server.ssrLoadModule('/src/data/dosaClient.ts');
    const jeonggok = await server.ssrLoadModule('/src/data/jeonggok.ts');
    const { useReport } = await server.ssrLoadModule('/src/data/useReport.ts');
    const { computeChart } = await import(pathToFileURL(resolve(root, 'dosa-app/engine/src/manseryeok.js')).href);
    const { chartToKeys } = await import(pathToFileURL(resolve(root, 'dosa-app/engine/src/keyset.js')).href);
    const { terms } = JSON.parse(readFileSync(resolve(root, 'dosa-app/engine/data/solar_terms.json')));
    await engine.loadKb(); await engine.loadBrain();
    const rows = inputs.map(row => {
      const input = profiles.profileToInput(row.profile);
      const search = profiles.profileToSearch(row.profile), share = profiles.parseShare(search);
      assert.deepEqual(share.input, input); assert.ok(profiles.matchesShare(row.profile, share));
      const report = engine.buildReading(input, '병오'), raw = engine.jeonggokRaw(input);
      let hook;
      function Probe() { hook = useReport(); return null; }
      renderToString(createElement(MemoryRouter, { initialEntries: [`/analysis?${search}`] }, createElement(Probe)));
      return plain({ id: row.id, profile: row.profile, input, share,
        chart: engine.computeChartUI(input), raw,
        keys: row.profile.hourUnknown ? null : chartToKeys(computeChart(input, terms)), report,
        reading: reading.toReading(input), brain: engine.brainReading(input, '병오'),
        fortune: engine.todayFortune(input), summary: topics.chartSummaryOf(report),
        topics: Object.fromEntries(['성격', '올해', '직업', '관계', '주의'].map(k => [k, topics.topicLines(report, k)])),
        direct: raw ? jeonggok.selectJeonggok(raw) : null, hook });
    });
    for (const row of rows) {
      const start = requests.length;
      for (const [topic, lines] of Object.entries(row.topics))
        await client.requestDosaText({topic, lines, report:row.report, chefId:'noona', model:'sonnet'});
      row.requests = requests.slice(start);
    }
    const pack = JSON.parse(kb), brainPack = JSON.parse(brain), key = 'sinsal/현침살';
    const chain = pack.aliases[key] || [key];
    return { assets: { pointer_sha256: hash(pointer), kb_sha256: hash(kb), brain_sha256: hash(brain) },
      lookup: { key, chain, index: chain.map(k => ({ key: k, entries: pack.index[k] ?? [] })),
        distilled: pack.distilled?.[key] ?? null, brain_node: brainPack.키매핑[key] ?? null }, rows };
  } finally {
    globalThis.Date = OriginalDate; globalThis.fetch = originalFetch;
    try { await server?.close(); } finally { rmSync(directory, { recursive: true, force: true }); }
  }
}

export async function compare() {
  const frozen = frozenApp({ consumers: 'pre-hyeonchim-v1' });
  let before;
  try {
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
    const resultPath = resolve(frozen.directory, 'capture.json');
    execFileSync(process.execPath, ['docs/knowledge-model/measure_hyeonchim_consumers.mjs', '--capture', resultPath],
      { cwd: frozen.directory, encoding: 'utf8', env, timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
    before = JSON.parse(readFileSync(resultPath));
  } finally { frozen.cleanup(); }
  const after = await capture();
  assert.deepEqual(after.assets, before.assets); assert.deepEqual(after.lookup, before.lookup);
  return { before, after };
}

function differences(a, b, path = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (Array.isArray(a) && Array.isArray(b)) return [path];
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return [path];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => differences(a[k], b[k], `${path}/${k}`));
}

export function summarize({ before, after }) {
  return { schema_version: 1, baseline_commit: '41fbb1f8f3ad0bc07daffac8b8a4fc4ee960063b',
    evaluated_at: instant, policy: 'hyeonchim-candidate-withhold-v1',
    scope: '110 synthetic calendar inputs, not observed people or personal accuracy',
    assets: after.assets, lookup: after.lookup,
    sources: [...changedSources, 'docs/knowledge-model/measure_hyeonchim_consumers.mjs'].map(path => ({ path,
      sha256_lf: hash(readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')) })),
    rows: after.rows.map((row,i) => {
      const prior = before.rows[i], block = row.report.sections.find(s => s.id === 'sinsal')?.blocks.find(b => b.key === 'sinsal/현침살');
      return { id: row.id, input: row.input, unknown: row.profile.hourUnknown,
        observation: block?.observation ?? null,
        withheld_blocks: row.report.sections.flatMap(s => [s.block, ...(s.blocks ?? [])].filter(b => b?.withheld).map(b => ({key:b.key,...b.withheld}))),
        withheld_brain: row.brain.보류 ?? null, changed_topics: Object.keys(row.topics).filter(k => JSON.stringify(row.topics[k]) !== JSON.stringify(prior.topics[k])),
        before_sha256: jsonHash(prior), after_sha256: jsonHash(row),
        changed_paths: differences(prior, row) };
    }), probability: null, training_labels: false };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    assert.ok(['--capture', '--write', '--check'].includes(process.argv[2]));
    if (process.argv[2] === '--capture') writeFileSync(process.argv[3], JSON.stringify(await capture()));
    else {
      const result = summarize(await compare());
      if (process.argv[2] === '--write') writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
      else assert.deepEqual(result, JSON.parse(readFileSync(output)), 'Hyeonchim consumer snapshot drift');
      console.log(JSON.stringify({ rows: result.rows.length, unknown: result.rows.filter(r=>r.unknown).length,
        candidates: result.rows.filter(r=>r.observation).length, changed: result.rows.filter(r=>r.changed_paths.length).length }));
    }
  } catch (error) { console.error(error.stderr ?? '', error.message); process.exitCode = 1; }
}
