// Preserve PR216 measurements and compare its full consumers with the current app.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture, hash } from './measure_hyeonchim_consumers.mjs';
import { frozenApp } from './frozen_app_audit.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
export async function compareSynthesis() {
  const frozen = frozenApp({ consumers: 'context-synthesis-v1' });
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
export function summarizeSynthesis({ before, after }) {
  return { baseline_commit: 'bba9975a33e0a343109d51d7657b062d72f39b73',
    scope: '110 synthetic calendar inputs; 102 known and 8 unknown. Personal accuracy unmeasured.',
    policy: 'natal-work-context-v2', training_eligible: 0, probability: null,
    sources: ['dosa-app/engine/src/contextReading.js', 'dosa-app/engine/src/contextReading.d.ts', 'app/src/data/dosaClient.ts', 'app/src/components/DosaChat.tsx', 'app/src/engine/index.d.ts']
      .map(path => ({ path, sha256_lf: hash(readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')) })),
    rows: after.rows.map((row, i) => ({id: row.id, unknown: row.profile.hourUnknown,
      context: row.report.sections.find(s=>s.id==='context-reading')?.context ?? null,
      calculations_unchanged: ['chart','raw','keys','brain','direct','fortune'].every(k=>JSON.stringify(row[k])===JSON.stringify(before.rows[i][k])),
      before_sha256:hash(JSON.stringify(before.rows[i])), after_sha256:hash(JSON.stringify(row)) })) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(['--write','--check'].includes(process.argv[2]));
  const result = summarizeSynthesis(await compareSynthesis());
  // Store concise delivery evidence; full explanations use a separate 6-input sample.
  result.rows = result.rows.map(({context,...row})=>({...row,questions:context?.experienceQuestions ?? [],synthesis:context?.blocks[2].lines ?? []}));
  const output = new URL('data/context_synthesis_delivery.json',import.meta.url);
  if(process.argv[2]==='--write')writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  else assert.deepEqual(result,JSON.parse(readFileSync(output)));
  console.log(JSON.stringify({rows:result.rows.length,unknown:result.rows.filter(r=>r.unknown).length,calculations_unchanged:result.rows.every(r=>r.calculations_unchanged)}));
}
