// Source-reported symbols: no invented birth, civil time, or active transit dates.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { observations, POLICY } from './chart_context.mjs';

const hash = (path) => createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex');

export function reportedContext(request) {
  if (!request || Array.isArray(request) || typeof request !== 'object' ||
      Object.keys(request).sort().join(',') !== 'incoming,pillars')
    throw new Error('Reported input requires only pillars and incoming; no birth or evaluated_at');
  if (!request.incoming || Array.isArray(request.incoming) || typeof request.incoming !== 'object')
    throw new Error('incoming must be an object; omit unknown scopes');
  const measured = observations(request.pillars, request.incoming);
  return {
    schema_version: 1, feature_policy: POLICY, input_mode: 'source_reported_pillars',
    evaluated_at: null, natal: { status: 'source_reported_not_calendar_verified', pillars: request.pillars },
    time_context: Object.fromEntries(['daewoon', 'yearly', 'monthly'].map((scope) => [scope, {
      pillar: request.incoming[scope] ?? null, status: request.incoming[scope] == null ? 'unknown' : 'source_reported',
      start: null, end: null, active_at_instant_verified: false,
    }])),
    ...measured, probability: null,
    measurement: {
      fractions: 'unweighted symbol count / fixed 4 or 8 positions; not strength or probability',
      unknown: 'null; no completion from other passages, calendars, or assumed birth hours',
      time: 'each reported scope remains separate; no daewoon/yearly union or exact instant inferred',
    },
    provenance: {
      calendar_calculation_performed: false, calendar_consistency_verified: false,
      adapter_sha256: hash('./reported_context.mjs'), observation_adapter_sha256: hash('./chart_context.mjs'),
      symbol_tables_sha256: hash('../../dosa-app/engine/src/tables.js'),
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node reported_context.mjs requests.json|-');
    const requests = JSON.parse(readFileSync(process.argv[2] === '-' ? 0 : process.argv[2], 'utf8'));
    if (!Array.isArray(requests) || !requests.length) throw new Error('A nonempty request array is required');
    console.log(JSON.stringify(requests.map(reportedContext)));
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
