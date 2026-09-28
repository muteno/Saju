// Read-only measurement of the existing report → toReading boundary.
// Synthetic inputs measure delivery, never personal interpretive accuracy.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { computeChart } from '../../dosa-app/engine/src/manseryeok.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../app/package.json', import.meta.url));
const output = new URL('data/basic_sentence_consumers.json', import.meta.url);
const review = JSON.parse(readFileSync(new URL('data/basic_sentence_review.json', import.meta.url)));
const ref = JSON.parse(readFileSync(resolve(root, 'app/src/engine/vendor/kb_ref.json')));
const bytes = readFileSync(resolve(root, 'app/public', ref.file));
const { terms } = JSON.parse(readFileSync(resolve(root, 'dosa-app/engine/data/solar_terms.json')));

export async function capture() {
  const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
  const originalFetch = globalThis.fetch;
  let server;
  try {
    globalThis.fetch = async url => {
      assert.equal(String(url), '/' + ref.file, 'Unexpected external request');
      return new Response(bytes, { headers: { 'content-type': 'application/json' } });
    };
    server = await createServer({ root: resolve(root, 'app'), server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
    const engine = await server.ssrLoadModule('/src/engine/index.js');
    const { toReading } = await server.ssrLoadModule('/src/data/saju.ts');
    const kb = await engine.loadKb();
    const selected = new Map();
    for (let day = 1; day <= 60; day++) {
      const date = new Date(Date.UTC(2024, 0, day));
      const input = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
        hour: 12, minute: 0, gender: 'F', solarCorrection: false, lateZi: false };
      const name = computeChart(input, terms).saju.day.name;
      if (review.inventory.selected_ilju.includes(name)) selected.set(name, input);
    }
    assert.equal(selected.size, 3);
    const rows = [];
    for (const name of review.inventory.selected_ilju) {
      for (const gender of ['F', 'M']) {
        const input = { ...selected.get(name), gender };
        const report = engine.buildReading(input, '병오');
        const reading = toReading(input);
        const block = report.sections.find(s => s.id === 'ilju').block;
        const card = reading.cards.find(c => c.id === 'ilju');
        const dialogue = reading.dialogue.find(d => d.icon === '🎴');
        const items = review.items.filter(i => i.key === 'ilju/' + name);
        const delivered = items.map(item => {
          const values = typeof item.draft_value === 'string' ? [item.draft_value]
            : item.draft_value.견해.map(g => `${g.src}: ${g.내용}`);
          const found = values.every(value => card.blocks.some(b => b.lines.includes(value)));
          assert.ok(found, `Missing reviewed draft ${item.id}`);
          return { id: item.id, delivered_unchanged: found };
        });
        rows.push({ key: block.key, input, first_source: block.distilled.sources[0],
          dialogue_source: dialogue?.source ?? null,
          card_source_blocks: card.blocks.flatMap((b, i) => b.source ? [{ index: i, label: b.label, source: b.source }] : []),
          delivered });
      }
    }
    // Remove only an in-memory draft to exercise the latent fallback. Restore
    // before testing unknown time; neither the source nor built KB is written.
    const key = 'ilju/갑자', saved = kb.distilled[key];
    let fallback;
    try {
      delete kb.distilled[key];
      const input = selected.get('갑자');
      const report = engine.buildReading(input, '병오');
      const block = report.sections.find(s => s.id === 'ilju').block;
      const reading = toReading(input);
      assert.deepEqual(block.excerpts.map(e => e.paras), review.fallback_review.ordered_units.map(u => u.first_six_body_paragraphs));
      assert.ok(!reading.cards.some(c => c.id === 'ilju'));
      assert.ok(!reading.dialogue.some(d => d.icon === '🎴'));
      fallback = { key, excerpts: block.excerpts,
        report_fallback_present: true, reading_ilju_card_present: false, reading_ilju_dialogue_present: false };
    } finally { kb.distilled[key] = saved; }
    const unknown = { ...selected.get('갑자'), hour: null, minute: null, hourUnknown: true };
    assert.equal(engine.buildReading(unknown, '병오').birthTime.status, 'unknown');
    const reading = toReading(unknown);
    assert.ok(!reading.cards.some(c => c.id === 'ilju'));
    return { baseline_commit: review.baseline_commit, scope: '6 synthetic known inputs and 1 unknown; data boundary only, no UI change',
      rows, fallback, unknown: { input: unknown, headline: reading.headline, card_ids: reading.cards.map(c => c.id) },
      inference_enabled: false, training_eligible: 0, probability: null };
  } finally {
    globalThis.fetch = originalFetch;
    await server?.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(['--write', '--check'].includes(process.argv[2]), 'Use --write or --check');
  const value = await capture();
  if (process.argv[2] === '--write') writeFileSync(output, JSON.stringify(value, null, 2) + '\n');
  else assert.deepEqual(value, JSON.parse(readFileSync(output)), 'Consumer measurement changed');
  console.log(JSON.stringify({ known_inputs: value.rows.length, unknown_inputs: 1,
    reviewed_items: review.items.length, draft_delivery_verified: true, ui_verified: false }));
}
