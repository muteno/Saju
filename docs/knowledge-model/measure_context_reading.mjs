import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture, hash } from './measure_hyeonchim_consumers.mjs';
import { frozenApp } from './frozen_app_audit.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = new URL('data/context_reading_delivery.json', import.meta.url);
export const sources = ['dosa-app/engine/src/contextReading.js', 'dosa-app/engine/src/report.js',
  'app/src/data/saju.ts', 'app/src/data/dosaTopics.ts', 'app/src/data/analysisGroups.ts',
  'app/src/data/dosaClient.ts', 'app/src/components/DosaChat.tsx'];
export async function compare() {
  const frozen = frozenApp({ consumers: 'context-reading-v1' });
  let before;
  try {
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
    execFileSync(process.execPath, ['docs/knowledge-model/measure_hyeonchim_consumers.mjs', '--capture', 'capture.json'],
      { cwd: frozen.directory, env, timeout: 90000, stdio: 'pipe' });
    before = JSON.parse(readFileSync(resolve(frozen.directory, 'capture.json')));
  } finally { frozen.cleanup(); }
  const after = await capture();
  assert.deepEqual(after.assets, before.assets); assert.deepEqual(after.lookup, before.lookup);
  return { before, after };
}
export function summarize({ before, after }) {
  return { baseline_commit: '875756c9113144148fcbb88fb7adce3477612af4',
    scope: '110 synthetic calendar inputs, 102 known/8 unknown. Not people or accuracy.',
    policy: 'natal-work-context-v1', training_eligible: 0, probability: null,
    sources: sources.map(path => ({ path, sha256_lf: hash(readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')) })),
    rows: after.rows.map((row, i) => {
      const context = row.report.sections.find(s => s.id === 'context-reading')?.context;
      const prior = before.rows[i];
      return { id: row.id, input: row.input, unknown: row.profile.hourUnknown,
        conditions: context?.conditions ?? null,
        groups: context ? Object.fromEntries(Object.entries(context.groups).map(([k,v]) => [k,v.status])) : null,
        card: row.reading.cards.some(c => c.id === 'context-reading'),
        calculations_unchanged: ['chart','raw','keys','brain','direct','fortune'].every(k => JSON.stringify(row[k]) === JSON.stringify(prior[k])),
        requests: row.requests.length, before_sha256: hash(JSON.stringify(prior)), after_sha256: hash(JSON.stringify(row)) };
    }) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(['--write','--check'].includes(process.argv[2]));
  const result = summarize(await compare());
  if (process.argv[2] === '--write') writeFileSync(output, JSON.stringify(result, null, 2)+'\n');
  else assert.deepEqual(result, JSON.parse(readFileSync(output)));
  console.log(JSON.stringify({ rows: result.rows.length, cards: result.rows.filter(r=>r.card).length,
    unknown: result.rows.filter(r=>r.unknown).length, calculations_unchanged: result.rows.every(r=>r.calculations_unchanged) }));
}
