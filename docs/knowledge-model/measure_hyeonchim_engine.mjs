// Audit only: execute current engine functions; never decide a source policy.
import { readFileSync } from 'node:fs';
import { auspicious } from '../../dosa-app/engine/src/sinsal.js';
import { computeChart } from '../../dosa-app/engine/src/manseryeok.js';
import { chartToKeys } from '../../dosa-app/engine/src/keyset.js';
import { buildReport } from '../../dosa-app/engine/src/report.js';

const positions = ['year', 'month', 'day', 'hour'];
const observations = p => Object.fromEntries(positions.map(pos => {
  const value = auspicious(p)[pos];
  return [pos, { stem: value.stem.includes('현침살'), branch: value.branch.includes('현침살') }];
}));
const singlePillars = positions.flatMap(position => Array.from({ length: 60 }, (_, index) => {
  const pillars = { year: 2, month: 2, day: 2, hour: 2, [position]: index };
  return { position, index, pillars, observations: observations(pillars) };
}));
const combinations = [
  ['none', [2, 2, 2, 2]], ['one-stem', [0, 2, 2, 2]],
  ['two-repeated-stems', [0, 0, 2, 2]], ['three-repeated-stems', [0, 0, 0, 2]],
  ['two-same-pillar', [30, 2, 2, 2]], ['two-separated', [0, 2, 2, 6]],
  ['myo-only', [3, 2, 2, 2]], ['mi-only', [55, 2, 2, 2]],
  ['hidden-jia-only', [2, 2, 2, 2]], ['jia-ji-neighbor', [0, 5, 2, 2]],
  ['jia-ji-separated', [0, 2, 2, 5]], ['eight-markers', [30, 30, 27, 27]],
].map(([id, indices]) => {
  const pillars = Object.fromEntries(positions.map((p, i) => [p, indices[i]]));
  return { id, pillars, observations: observations(pillars) };
});
const { terms } = JSON.parse(readFileSync(new URL('../../dosa-app/engine/data/solar_terms.json', import.meta.url), 'utf8'));
// Empty KB deliberately tests label propagation only, NOT real excerpts or UI.
const kb = { aliases: {}, index: {}, bodies: {} };
const dates = Array.from({ length: 60 }, (_, offset) => new Date(Date.UTC(2024, 0, 1 + offset, 12)));
// These UTC Date objects carry fixture fields, not the requested birth instant.
dates.push(new Date(Date.UTC(2022, 1, 4, 10)), new Date(Date.UTC(2022, 1, 4, 12)));
const reports = dates.map(date => {
  const input = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1,
    day: date.getUTCDate(), hour: date.getUTCHours(), minute: 0, gender: 'F', timeZone: 'Asia/Seoul',
    longitude: 126.978, solarTimeCorrection: false, lateZiRule: 'midnight23' };
  const chart = computeChart(input, terms);
  const keys = chartToKeys(chart);
  const report = buildReport(chart, keys, kb);
  return { input, pillars: chart.pillarsIdx, observations: observations(chart.pillarsIdx),
    topic_occurrences: keys.byTopic.sinsal.filter(k => k === 'sinsal/현침살').length,
    distinct_key_count: keys.keys.filter(k => k === 'sinsal/현침살').length,
    report_label_count: report.sections.find(s => s.id === 'sinsal').blocks.filter(b => b.label === '현침살').length };
});
process.stdout.write(JSON.stringify({ scope: 'engine_observation_not_source_adoption',
  report_scope: 'label_propagation_with_empty_kb_not_excerpt_or_ui_validation',
  singlePillars, combinations, reports }));
