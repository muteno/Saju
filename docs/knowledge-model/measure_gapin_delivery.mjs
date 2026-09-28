// New receipt, separate from the immutable PR211/212 measurements.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture, hash } from './measure_hyeonchim_consumers.mjs';
import { frozenApp } from './frozen_app_audit.mjs';
import { basicSentenceMatches } from '../../dosa-app/engine/src/basicSentences.js';
import { toMarkdown } from '../../dosa-app/engine/src/report.js';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = new URL('data/gapin_delivery.json', import.meta.url);
export const sources = ['dosa-app/engine/src/basicSentences.js', 'dosa-app/engine/src/gapinConditions.js',
  'dosa-app/engine/src/gapinSentenceData.js', 'dosa-app/engine/src/report.js', 'app/src/data/saju.ts',
  'app/src/data/dosaTopics.ts', 'app/src/data/dosaClient.ts', 'app/src/data/analysisGroups.ts', 'app/src/components/DosaChat.tsx',
  'app/src/engine/brain.js', 'functions/api/dosa.ts', 'scripts/build_gapin_sentence_policy.py'];
export async function compare() {
  const frozen = frozenApp({ consumers: 'gapin-delivery-v1' });
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
const personal = row => [row.reading, row.topics, row.requests, row.brain];
export function summarize({ before, after }) {
  return { baseline_commit: '70b1a9c0a118b6681fe0372499197fc2e424a468',
    scope: '110 synthetic inputs, 102 known/8 unknown, no observed-person accuracy or semantic-paraphrase classifier',
    source_review_items: 35, personal_approved: 0, training_eligible: 0, probability: null,
    assets: after.assets, sources: sources.map(path => ({ path, sha256_lf: hash(readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')) })),
    rows: after.rows.map((row, i) => {
      const old = before.rows[i], b = row.report.sections.find(s => s.id === 'ilju')?.block;
      return { id: row.id, input: row.input, unknown: row.profile.hourUnknown, ilju: b?.key ?? null,
        before_present: basicSentenceMatches(personal(old)), after_present: basicSentenceMatches(personal(row)),
        markdown_remaining: basicSentenceMatches(toMarkdown(row.report)),
        withheld_ids: b?.basicReview?.withheldIds ?? [], assessment: b?.gapinConditions ?? null,
        request_count: row.requests.length, before_sha256: hash(JSON.stringify(old)), after_sha256: hash(JSON.stringify(row)) };
    }) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(['--write', '--check'].includes(process.argv[2]));
  const result = summarize(await compare());
  if (process.argv[2] === '--write') writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  else assert.deepEqual(result, JSON.parse(readFileSync(output)));
  console.log(JSON.stringify({ rows: result.rows.length, requests: result.rows.reduce((n, r) => n+r.request_count, 0),
    gapin: result.rows.filter(r => r.ilju === 'ilju/갑인').length, remaining: result.rows.flatMap(r => r.after_present) }));
}
