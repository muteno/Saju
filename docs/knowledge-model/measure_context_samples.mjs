// Readable before/after output for actual calendar inputs, not observed people.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeChart } from '../../dosa-app/engine/src/manseryeok.js';
import { chartToKeys } from '../../dosa-app/engine/src/keyset.js';
import { buildReport } from '../../dosa-app/engine/src/report.js';
import { frozenApp } from './frozen_app_audit.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
function samples() {
  const { terms } = JSON.parse(readFileSync(resolve(root,'dosa-app/engine/data/solar_terms.json')));
  const ref = JSON.parse(readFileSync(resolve(root,'app/src/engine/vendor/kb_ref.json')));
  const kb = JSON.parse(readFileSync(resolve(root,'app/public',ref.file)));
  return [[2024,2,20,0],[2024,2,20,12],[2024,2,20,18],[2024,4,20,12],
    [1990,1,1,12],[2024,1,1,12]].map(([year,month,day,hour])=>{
    const input={year,month,day,hour,minute:0,gender:'F',timeZone:'Asia/Seoul',solarTimeCorrection:false,lateZiRule:'keepDay'};
    const chart=computeChart(input,terms),report=buildReport(chart,chartToKeys(chart),kb);
    return {input,pillars:chart.pillarsIdx,sections:report.sections.filter(s=>['judge','ilju','context-reading'].includes(s.id))};
  });
}
if(process.argv[2]==='--capture') process.stdout.write(JSON.stringify(samples()));
else {
  const frozen=frozenApp({consumers:'context-reading-v1'});
  let before;
  try {before=JSON.parse(execFileSync(process.execPath,['docs/knowledge-model/measure_context_samples.mjs','--capture'],
    {cwd:frozen.directory,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}));}
  finally {frozen.cleanup();}
  const after=samples();
  const result={scope:'6 synthetic calendar inputs, no personal accuracy measurement',before,after};
  if(process.argv[2]!=='--write') throw new Error('Use --write or --capture');
  writeFileSync(new URL('data/context_reading_samples.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log('6 before/after reports saved');
}
