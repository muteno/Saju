// The current app must preserve all PR217 no-history consumers. Do not rewrite its receipt.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compareSynthesis,summarizeSynthesis} from '../docs/knowledge-model/measure_context_synthesis.mjs';
const result=await compareSynthesis();
const measured=summarizeSynthesis(result);
const expected=JSON.parse(readFileSync(new URL('../docs/knowledge-model/data/context_synthesis_delivery.json',import.meta.url)));
const rows=measured.rows.map(({context,...row})=>({...row,questions:context?.experienceQuestions??[],synthesis:context?.blocks[2].lines??[]}));
assert.deepEqual(rows,expected.rows);
assert.equal(rows.length,110);assert.equal(rows.filter(r=>r.unknown).length,8);
assert.ok(rows.every(r=>r.calculations_unchanged));
const requests=result.after.rows.reduce((n,r)=>n+r.requests.length,0);
assert.equal(requests,510);
console.log(JSON.stringify({rows:rows.length,unknown:rows.filter(r=>r.unknown).length,requests,calculations_unchanged:true}));
