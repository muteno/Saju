// Compare the added strength explanation against the exact v2 context on the
// same current consumers. Keep all historical receipts and source hashes intact.
import assert from 'node:assert/strict';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture, hash } from './measure_hyeonchim_consumers.mjs';
import { frozenApp } from './frozen_app_audit.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = new URL('fixtures/conversation-context-v1/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixture)));
const contextPaths = ['dosa-app/engine/src/contextReading.js', 'dosa-app/engine/src/contextReading.d.ts',
  'app/src/engine/vendor/contextReading.js', 'app/src/engine/vendor/contextReading.d.ts'];

export async function compareStrengthContext() {
  const frozen = frozenApp({ consumers: 'context-synthesis-v1' });
  let before;
  try {
    // Undo the older consumer overlays, then pin ONLY the previous context.
    for (const path of ['app/src', 'dosa-app/engine/src', 'functions/api/dosa.ts'])
      cpSync(resolve(root, path), resolve(frozen.directory, path), { recursive: true });
    assert.equal(manifest.commit, 'd0d4c8e6d228541b6c3db11f9c53daf1c9ad4892');
    for (const path of contextPaths) {
      const entry = manifest.files.find(f => f.path === path);
      const bytes = readFileSync(new URL(path, fixture));
      assert.equal(hash(bytes.toString().replace(/\r\n/g, '\n')), entry.sha256_lf);
      writeFileSync(resolve(frozen.directory, path), bytes);
    }
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
    execFileSync(process.execPath, ['docs/knowledge-model/measure_hyeonchim_consumers.mjs', '--capture', 'capture.json'],
      { cwd: frozen.directory, env, timeout: 90000, stdio: 'pipe' });
    before = JSON.parse(readFileSync(resolve(frozen.directory, 'capture.json')));
  } finally { frozen.cleanup(); }
  const after = await capture();
  assert.deepEqual(after.assets, before.assets);
  assert.deepEqual(after.lookup, before.lookup);
  return { before, after };
}

export function summarizeStrengthContext({ before, after }) {
  return {
    baseline_commit: '513226cfce058b4135102b539cb4371dbb05c8bb',
    scope: '110 synthetic calendar inputs, 102 known and 8 unknown; personal accuracy unmeasured',
    policy: 'natal-work-context-v3', training_eligible: 0, probability: null,
    sources: [...contextPaths, 'dosa-app/engine/src/judge.js'].map(path => ({ path,
      sha256_lf: hash(readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')) })),
    rows: after.rows.map((row, i) => {
      const context = row.report.sections.find(s => s.id === 'context-reading')?.context;
      return { id: row.id, unknown: row.profile.hourUnknown,
        label: context?.strength.observation.label ?? null, score: context?.strength.observation.score ?? null,
        calculations_unchanged: ['chart', 'raw', 'keys', 'brain', 'direct', 'fortune'].every(k =>
          JSON.stringify(row[k]) === JSON.stringify(before.rows[i][k])),
        before_sha256: hash(JSON.stringify(before.rows[i])), after_sha256: hash(JSON.stringify(row)) };
    }),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(['--write', '--check'].includes(process.argv[2]));
  const measured = summarizeStrengthContext(await compareStrengthContext());
  const out = new URL('data/strength_context_delivery.json', import.meta.url);
  if (process.argv[2] === '--write') writeFileSync(out, JSON.stringify(measured, null, 2) + '\n');
  else assert.deepEqual(measured, JSON.parse(readFileSync(out)));
  console.log(JSON.stringify({ rows: measured.rows.length, unknown: measured.rows.filter(r => r.unknown).length,
    calculations_unchanged: measured.rows.every(r => r.calculations_unchanged) }));
}
