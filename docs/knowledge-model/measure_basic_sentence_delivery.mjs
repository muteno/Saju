// Current delivery contract versus PR210, using real KB/Brain and original app consumers.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture, hash } from './measure_hyeonchim_consumers.mjs';
import { frozenApp } from './frozen_app_audit.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = new URL('data/basic_sentence_delivery.json', import.meta.url);
const review = JSON.parse(readFileSync(new URL('data/basic_sentence_review.json', import.meta.url)));
export const changedSources = ['dosa-app/engine/src/basicSentences.js', 'dosa-app/engine/src/basicSentenceData.js',
  'dosa-app/engine/src/report.js', 'app/src/data/saju.ts', 'app/src/data/analysisGroups.ts',
  'app/src/data/dosaTopics.ts', 'app/src/data/dosaClient.ts', 'app/src/engine/brain.js',
  'scripts/build_basic_sentence_policy.py', 'functions/api/dosa.ts', 'app/src/components/DosaChat.tsx'];
export async function compare() {
  const frozen = frozenApp({ consumers: 'basic-sentences-v1' });
  let before;
  try {
    const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
    execFileSync(process.execPath, ['docs/knowledge-model/measure_hyeonchim_consumers.mjs', '--capture', 'capture.json'],
      { cwd: frozen.directory, env, timeout: 90000, stdio: 'pipe' });
    before = JSON.parse(readFileSync(resolve(frozen.directory, 'capture.json')));
  } finally { frozen.cleanup(); }
  const after = await capture();
  assert.deepEqual(after.assets, before.assets);
  return { before, after };
}
const digest = value => hash(JSON.stringify(value));
const strings = item => typeof item.draft_value === 'string' ? [item.draft_value] : item.draft_value.견해.map(v => v.내용);
const personal = row => JSON.stringify([row.reading, row.topics, row.requests, row.brain]);
export function summarize({ before, after }) {
  return { baseline_commit: '931f81c6acc852316c48272a3cd691d8c8d481ec', policy: 'reviewed-sentences-withheld-v1',
    scope: '110 synthetic inputs, 102 known/8 unknown; 14 selected items, not all-60 approval or provider-generated-answer validation',
    assets: after.assets,
    sources: changedSources.map(path => ({ path, sha256_lf: hash(readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')) })),
    rows: after.rows.map((row,i) => {
      const old = before.rows[i], block = row.report.sections.find(s => s.id === 'ilju')?.block;
      return { id: row.id, input: row.input, unknown: row.profile.hourUnknown,
        ilju: block?.key ?? null, reviewed_ids: block?.basicReview?.reviewed?.map(r => r.id) ?? [],
        withheld_ids: block?.basicReview?.withheldIds ?? [],
        before_present: review.items.filter(item => strings(item).some(s => personal(old).includes(s))).map(item => item.id),
        after_present: review.items.filter(item => strings(item).some(s => personal(row).includes(s))).map(item => item.id),
        request_count: row.requests.length, before_sha256: digest(old), after_sha256: digest(row),
        unreviewed_statements: block?.sentences?.length ?? 0 };
    }), reviewed_items: 14, fully_reviewed_ilju: 0, training_eligible: 0, probability: null };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(['--write','--check'].includes(process.argv[2]));
  const value = summarize(await compare());
  if (process.argv[2] === '--write') writeFileSync(output, JSON.stringify(value,null,2)+'\n');
  else assert.deepEqual(value, JSON.parse(readFileSync(output)));
  console.log(JSON.stringify({ rows:value.rows.length, requests:value.rows.reduce((n,r)=>n+r.request_count,0),
    reviewed_covered:[...new Set(value.rows.flatMap(r=>r.before_present))], remaining:value.rows.flatMap(r=>r.after_present) }));
}
