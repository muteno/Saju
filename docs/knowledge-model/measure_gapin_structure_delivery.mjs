// PR214 -> structural-reference delivery. The original receipts keep their bytes/hashes.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture, hash } from './measure_hyeonchim_consumers.mjs';
import { frozenApp } from './frozen_app_audit.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = new URL('data/gapin_structure_delivery.json', import.meta.url);
export const sources = ['dosa-app/engine/src/report.js', 'dosa-app/engine/src/gapinStructure.js',
  'dosa-app/engine/src/gapinStructureData.js', 'app/src/data/saju.ts', 'scripts/build_gapin_structure_data.py',
  'app/src/components/ReportParts.tsx', 'app/src/data/readingPresentation.ts', 'app/src/data/dosaTopics.ts',
  'app/src/data/dosaClient.ts', 'functions/api/dosa.ts'];
export async function compare() {
  const frozen = frozenApp({ consumers: 'gapin-structure-v1' });
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
  return { baseline_commit: '6a4d75775f3e71f5e0c651cd3ea208e06c450247',
    scope: '110 synthetic calendar inputs, 102 known/8 unknown. Not observed people or accuracy.',
    policy: 'gapin-structure-reference-v1', reference_definitions: 5,
    personal_approved: 0, training_eligible: 0, probability: null, assets: after.assets,
    sources: sources.map(path => ({ path, sha256_lf: hash(readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')) })),
    rows: after.rows.map((row, i) => {
      const prior = before.rows[i], ref = row.report.sections.find(s=>s.id==='ilju')?.block?.structureReference;
      return { id: row.id, input: row.input, unknown: row.profile.hourUnknown,
        reference_ids: ref?.items.map(item=>item.id) ?? [], observation: ref?.observation ?? null,
        reference_card: row.reading.cards.some(c=>c.id==='ilju-structure'),
        calculations_unchanged: ['chart', 'raw', 'keys', 'brain', 'summary', 'direct', 'fortune'].every(k => JSON.stringify(row[k])===JSON.stringify(prior[k])),
        topics_changed: Object.keys(row.topics).filter(k=>JSON.stringify(row.topics[k])!==JSON.stringify(prior.topics[k])),
        requests: row.requests.length, before_sha256: hash(JSON.stringify(prior)), after_sha256: hash(JSON.stringify(row)) };
    }) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(['--write', '--check'].includes(process.argv[2]));
  const result = summarize(await compare());
  if (process.argv[2] === '--write') writeFileSync(output, JSON.stringify(result, null, 2)+'\n');
  else assert.deepEqual(result, JSON.parse(readFileSync(output)));
  console.log(JSON.stringify({rows:result.rows.length, references:result.rows.filter(r=>r.reference_card).length,
    unknown:result.rows.filter(r=>r.unknown).length, calculations_unchanged:result.rows.every(r=>r.calculations_unchanged)}));
}
