// Reproduces the PR235 measurement of the basic temperament reading (see CONDITIONAL_TEMPERAMENT_READING.md).
//   node docs/knowledge-model/measure_temperament_scope.mjs grid
//     → 1950-01-01..2009-12-31, every day × even hours, F, no solar correction, keepDay (the work grid's charts).
//       Modes, how the pattern was found, other schools' patterns, and how often charts of one day pillar get
//       different readings (before this change the 성격 topic read the day pillar and the day master only, so
//       every chart of one day pillar had one 성격 text).
// A synthetic calendar grid, not a user distribution and not an accuracy measure.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {computeChart} from '../../dosa-app/engine/src/manseryeok.js';
import {buildTemperamentReading} from '../../dosa-app/engine/src/temperamentCandidates.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const [mode]=process.argv.slice(2);
if(mode!=='grid'){console.error('usage: measure_temperament_scope.mjs grid');process.exit(2);}
const {terms}=JSON.parse(readFileSync(root+'dosa-app/engine/data/solar_terms.json'));
const pct=(a,b)=>Math.round(a/b*1000)/10;
const out={total:0,modes:{},sources:{},revealedBy:{month:0,yearOnly:0,hourOnly:0,yearAndHour:0},strength:{},
 alternatives:{eightPatternsDiffer:0,eightPatternsNone:0,variantReveal:0,variantRevealWouldChangeMode:0},
 byDayPillar:{},sameDate:{dates:0,modeVaries:0,readingVaries:0,byHourStem:0,byStrengthOnly:0},sameMonthPillar:{groups:0,readingVaries:0}};
const byPillar=new Map(),byMonth=new Map();
for(let t=Date.UTC(1950,0,1);t<Date.UTC(2010,0,1);t+=86400000){const d=new Date(t);const day=[];
 for(let hour=0;hour<24;hour+=2){out.total++;
  const c=computeChart({year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour,minute:0,gender:'F',solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
  const r=buildTemperamentReading(c);
  out.modes[r.mode]=(out.modes[r.mode]??0)+1;out.sources[r.pattern.source]=(out.sources[r.pattern.source]??0)+1;
  out.strength[r.strength.band]=(out.strength[r.strength.band]??0)+1;
  if(r.pattern.source==='other-stem'){const ps=r.pattern.positions;out.revealedBy[ps.length===2?'yearAndHour':ps[0]==='year'?'yearOnly':'hourOnly']++;}
  else if(r.pattern.source==='month-stem')out.revealedBy.month++;
  const eight=r.pattern.alternatives.find(a=>a.view==='eight-patterns');
  if(eight){if(eight.god===null)out.alternatives.eightPatternsNone++;else out.alternatives.eightPatternsDiffer++;}
  // Another school (변격 투간) would count the pattern as revealed: an inside/outside reading would become shown-together.
  if(r.pattern.alternatives.some(a=>a.view==='variant-reveal')){out.alternatives.variantReveal++;if(r.mode==='inner-outer')out.alternatives.variantRevealWouldChangeMode++;}
  // Another school counts only a stem near the month branch: an hour-stem reveal would not count.
  const near=r.pattern.alternatives.find(a=>a.view==='near-reveal-only');
  if(near){out.alternatives.nearOnly=(out.alternatives.nearOnly??0)+1;if(near.god!==r.pattern.god||near.source==='month-branch')out.alternatives.nearOnlyChangesPattern=(out.alternatives.nearOnlyChangesPattern??0)+1;}
  const name=r.dayPillar,key=`${r.mode}|${r.interpretation}`;
  if(!byPillar.has(name))byPillar.set(name,new Map());const m=byPillar.get(name);m.set(key,(m.get(key)??0)+1);
  const mk=`${name}|${c.pillarsIdx.month}`;if(!byMonth.has(mk))byMonth.set(mk,new Set());byMonth.get(mk).add(key);
  day.push({r,c});
 }
 // One date (same day pillar, mostly the same month pillar): what changes with the hour alone.
 const sameMonth=day.every(x=>x.c.pillarsIdx.month===day[0].c.pillarsIdx.month)&&day.every(x=>x.c.pillarsIdx.day===day[0].c.pillarsIdx.day);
 if(sameMonth){out.sameDate.dates++;
  const modes=new Set(day.map(x=>x.r.mode)),readings=new Set(day.map(x=>x.r.interpretation));
  if(modes.size>1)out.sameDate.modeVaries++;
  if(readings.size>1){out.sameDate.readingVaries++;
   const patterns=new Set(day.map(x=>`${x.r.pattern.god}|${x.r.pattern.source}`));
   if(patterns.size>1)out.sameDate.byHourStem++;else out.sameDate.byStrengthOnly++;}
 }
}
let pairs=0,differ=0,distinct=[];
for(const[name,m]of byPillar){const n=[...m.values()].reduce((a,b)=>a+b,0),same=[...m.values()].reduce((a,b)=>a+b*(b-1)/2,0),all=n*(n-1)/2;
 pairs+=all;differ+=all-same;distinct.push(m.size);out.byDayPillar[name]={charts:n,distinctReadings:m.size};}
distinct.sort((a,b)=>a-b);
out.sameDayPillar={dayPillars:byPillar.size,pairs,pairsWithDifferentReading:differ,share:pct(differ,pairs),
 distinctReadingsPerDayPillar:{min:distinct[0],median:distinct[Math.floor(distinct.length/2)],max:distinct.at(-1)},before:'1 per day pillar (topicLines 성격 read ilju + daymaster only)'};
for(const s of byMonth.values()){out.sameMonthPillar.groups++;if(s.size>1)out.sameMonthPillar.readingVaries++;}
out.share={modes:Object.fromEntries(Object.entries(out.modes).map(([k,v])=>[k,pct(v,out.total)])),sources:Object.fromEntries(Object.entries(out.sources).map(([k,v])=>[k,pct(v,out.total)])),
 sameDateReadingVaries:pct(out.sameDate.readingVaries,out.sameDate.dates),sameMonthPillarReadingVaries:pct(out.sameMonthPillar.readingVaries,out.sameMonthPillar.groups)};
const {byDayPillar,...summary}=out;
console.log(JSON.stringify(summary,null,1));
