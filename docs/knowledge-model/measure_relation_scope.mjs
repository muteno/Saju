// Reproduces the PR236 measurement of the close-relationship reading (see CONDITIONAL_RELATION_READING.md).
//   node docs/knowledge-model/measure_relation_scope.mjs grid
//     → 1950-01-01..2009-12-31, every day × even hours, both genders, no solar correction, keepDay (the work and
//       temperament grid's charts). Modes, where the spouse star sits, how often charts of one day pillar (and the
//       two genders of one chart) get different readings. Before this change the 관계 topic read the day pillar's
//       draft list and the day branch excerpt only, so every chart of one day pillar, of either gender, had one text.
//     원문95: also how the 관계 reading meets the 성격 reading of the same chart — charts whose temperament reading is
//     ‘peer-blocked’ (the 일지 관성 blocks the strong 비겁 mind) and what the 관계 reading says of that same 일지 관성
//     (`crossTopic`; `replaced` is the reading PR236 showed for them, kept as the superseded candidate).
// A synthetic calendar grid, not a user distribution and not an accuracy measure.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {computeChart} from '../../dosa-app/engine/src/manseryeok.js';
import {buildRelationReading} from '../../dosa-app/engine/src/relationCandidates.js';
import {buildTemperamentReading} from '../../dosa-app/engine/src/temperamentCandidates.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const [mode]=process.argv.slice(2);
if(mode!=='grid'){console.error('usage: measure_relation_scope.mjs grid');process.exit(2);}
const {terms}=JSON.parse(readFileSync(root+'dosa-app/engine/data/solar_terms.json'));
const pct=(a,b)=>Math.round(a/b*1000)/10;
const G=['F','M'];
const out={charts:0,modes:{F:{},M:{}},palaceClashByMode:{F:{},M:{}},farPlaces:{F:{},M:{}},bondedByDayBranch:{F:0,M:0},
 genderDiffers:0,genderModeDiffers:0,sameDate:{dates:0,readingVaries:{F:0,M:0},modeVaries:{F:0,M:0}},
 cross:{F:{blocked:0,checked:0,checkedNotBlocked:0,replaced:{},warmStar:0,followup:{}},M:{blocked:0,checked:0}}};
const byPillar={F:new Map(),M:new Map()},modesByPillar={F:new Map(),M:new Map()};
for(let t=Date.UTC(1950,0,1);t<Date.UTC(2010,0,1);t+=86400000){const d=new Date(t);const day={F:[],M:[]};let sameMonth=true,first=null;
 for(let hour=0;hour<24;hour+=2){out.charts++;const readings={};
  for(const g of G){
   const c=computeChart({year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),hour,minute:0,gender:g,solarTimeCorrection:false,lateZiRule:'keepDay'},terms);
   const r=buildRelationReading(c);readings[g]=r;
   const blocked=buildTemperamentReading(c).mode==='peer-blocked',x=out.cross[g];
   if(blocked)x.blocked++;if(r.mode==='near-checked'){x.checked++;if(!blocked)x.checkedNotBlocked=(x.checkedNotBlocked??0)+1;}
   if(g==='F'&&r.mode==='near-checked'){const rep=r.candidates.filter(k=>k.status==='superseded').map(k=>k.id).join('+');x.replaced[rep]=(x.replaced[rep]??0)+1;
    if(r.checked.warm)x.warmStar++;x.followup[r.followup.candidate]=(x.followup[r.followup.candidate]??0)+1;}
   if(g==='F'){if(first===null)first=c.pillarsIdx;else if(c.pillarsIdx.month!==first.month||c.pillarsIdx.day!==first.day)sameMonth=false;}
   out.modes[g][r.mode]=(out.modes[g][r.mode]??0)+1;
   if(r.palaceClash.length)out.palaceClashByMode[g][r.mode]=(out.palaceClashByMode[g][r.mode]??0)+1;
   if(r.mode==='far')for(const s of new Set(r.stars.far.map(s=>s.placeName)))out.farPlaces[g][s]=(out.farPlaces[g][s]??0)+1;
   if(r.mode==='near-bonded'&&r.bonded.place==='dayBranch')out.bondedByDayBranch[g]++;
   const key=`${r.mode}|${r.interpretation}`;
   if(!byPillar[g].has(r.dayPillar))byPillar[g].set(r.dayPillar,new Map());const m=byPillar[g].get(r.dayPillar);m.set(key,(m.get(key)??0)+1);
   if(!modesByPillar[g].has(r.dayPillar))modesByPillar[g].set(r.dayPillar,new Map());const mm=modesByPillar[g].get(r.dayPillar);mm.set(r.mode,(mm.get(r.mode)??0)+1);
   day[g].push(key);
  }
  if(readings.F.interpretation!==readings.M.interpretation)out.genderDiffers++;
  if(readings.F.mode!==readings.M.mode)out.genderModeDiffers++;
 }
 // One date (same day and month pillar): what changes with the hour alone.
 if(sameMonth){out.sameDate.dates++;for(const g of G){if(new Set(day[g]).size>1)out.sameDate.readingVaries[g]++;if(new Set(day[g].map(k=>k.split('|')[0])).size>1)out.sameDate.modeVaries[g]++;}}
}
const pairShare=maps=>{let pairs=0,differ=0;const distinct=[];
 for(const m of maps.values()){const n=[...m.values()].reduce((a,b)=>a+b,0),same=[...m.values()].reduce((a,b)=>a+b*(b-1)/2,0);pairs+=n*(n-1)/2;differ+=n*(n-1)/2-same;distinct.push(m.size);}
 distinct.sort((a,b)=>a-b);return{share:pct(differ,pairs),distinct:{min:distinct[0],median:distinct[Math.floor(distinct.length/2)],max:distinct.at(-1)}};};
const sameDayPillar={};
for(const g of G){let pairs=0,differ=0;const distinct=[];
 for(const m of byPillar[g].values()){const n=[...m.values()].reduce((a,b)=>a+b,0),same=[...m.values()].reduce((a,b)=>a+b*(b-1)/2,0);
  pairs+=n*(n-1)/2;differ+=n*(n-1)/2-same;distinct.push(m.size);}
 distinct.sort((a,b)=>a-b);
 sameDayPillar[g]={dayPillars:byPillar[g].size,pairs,pairsWithDifferentReading:differ,share:pct(differ,pairs),
  distinctReadingsPerDayPillar:{min:distinct[0],median:distinct[Math.floor(distinct.length/2)],max:distinct.at(-1)},
  // The judgment alone (the mode), apart from the star names and places the text carries.
  modeLevel:(({share,distinct})=>({pairsWithDifferentMode:share,distinctModesPerDayPillar:distinct}))(pairShare(modesByPillar[g]))};
}
const share=o=>Object.fromEntries(Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,pct(v,out.charts)]));
console.log(JSON.stringify({charts:out.charts,
 modes:{F:share(out.modes.F),M:share(out.modes.M)},
 palaceClashWithinMode:Object.fromEntries(G.map(g=>[g,Object.fromEntries(Object.entries(out.palaceClashByMode[g]).map(([k,v])=>[k,pct(v,out.modes[g][k])]))])),
 farPlacesWithinFar:Object.fromEntries(G.map(g=>[g,Object.fromEntries(Object.entries(out.farPlaces[g]).map(([k,v])=>[k,pct(v,out.modes[g].far)]))])),
 bondedByDayBranch:out.bondedByDayBranch,
 sameDayPillar,before:'1 per day pillar for both genders (topicLines 관계 read ilju 관계 + daybranch only)',
 genderDiffers:{readingText:pct(out.genderDiffers,out.charts),mode:pct(out.genderModeDiffers,out.charts)},
 crossTopic:{F:{...out.cross.F,blockedShare:pct(out.cross.F.blocked,out.charts),checkedOfBlocked:pct(out.cross.F.checked,out.cross.F.blocked)},
  M:{...out.cross.M,blockedShare:pct(out.cross.M.blocked,out.charts),note:'남명: 관성 is not the spouse star; the 관계 reading is not tied to it'}},
 sameDate:{dates:out.sameDate.dates,readingVaries:Object.fromEntries(G.map(g=>[g,pct(out.sameDate.readingVaries[g],out.sameDate.dates)])),
  modeVaries:Object.fromEntries(G.map(g=>[g,pct(out.sameDate.modeVaries[g],out.sameDate.dates)]))}},null,1));
