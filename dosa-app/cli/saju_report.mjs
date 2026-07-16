#!/usr/bin/env node
// 사주 리포트 CLI (LLM 없는 완결 MVP 데모)
// 사용: node saju_report.mjs 1990-01-01 12:00 F [--unse 병오] [--out report.md]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeChart } from '../engine/src/manseryeok.js';
import { chartToKeys } from '../engine/src/keyset.js';
import { buildReport, toMarkdown } from '../engine/src/report.js';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
if (argv.length < 3) {
  console.error('사용: node saju_report.mjs YYYY-MM-DD HH:MM M|F [--unse 병오] [--out report.md]');
  process.exit(1);
}
const [ymd, hm, gender] = argv;
const [year, month, day] = ymd.split('-').map(Number);
const [hour, minute] = hm.split(':').map(Number);
const unse = argv.includes('--unse') ? argv[argv.indexOf('--unse') + 1] : '병오';
const outPath = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;

const load = (p) => JSON.parse(readFileSync(join(here, p), 'utf-8'));
const { terms } = load('../engine/data/solar_terms.json');
const kb = {
  index: load('../kb/unit_index.json'),
  aliases: Object.fromEntries(Object.entries(load('../kb/aliases.json')).filter(([k]) => !k.startsWith('_'))),
  bodies: load('../kb/unit_bodies.json'), // extract_bodies.py로 생성 (git 제외)
};

const chart = computeChart({ year, month, day, hour, minute, gender }, terms);
const keyset = chartToKeys(chart, { unseYearName: unse });
const report = buildReport(chart, keyset, kb);
const md = `# 사주 리포트 — ${ymd} ${hm} (${gender === 'M' ? '남' : '여'})\n` + toMarkdown(report);

if (outPath) { writeFileSync(outPath, md, 'utf-8'); console.error('저장:', outPath); }
else console.log(md);
