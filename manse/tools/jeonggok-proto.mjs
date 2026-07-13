// jeonggok-proto.mjs — 정곡(正鵠) 선별기 프로토타입 (기본 로직 실증)
// ─────────────────────────────────────────────────────────────────────────
// 위상: 프로토(충돌 회피). 정식 모듈 번호(설계.md §9의 008-jeonggok 등)는 3세션
//       (PR#28 엔진·설계 / PR#29 캐릭터맵 / PR#30 실행·화법) 조율 후 승격.
// 하는 일: buildSaju(판) → 참인 정곡만 탐지 → 임팩트 랭킹 → 3단 어조(CALC/INFER/EVENT) 태깅.
// 안정층 manse/js/ 만 import (PR#29가 리팩한 manse/app/ 무의존).
// 실행: node manse/tools/jeonggok-proto.mjs
// 근거: docs/상담엔진_설계.md §3 랭킹 · docs/화법_드래프트.md §2 어조 · buildSaju 반환 필드(실측).

import { buildSaju } from '../js/core/002-saju-engine.core.js';
import { branchRelations } from '../js/knowledge/008-hapchung.knowledge.js';
import { STEMS, BRANCHES } from '../js/knowledge/001-ganji.knowledge.js';

const EL5 = ['목', '화', '토', '금', '수'];
const POS = ['시', '일', '월', '년']; // relations의 i/j 위치 = pillarBranchRelations 입력 순서
const gungOf = (p) => (p === 1 ? '배우자궁' : p === 2 ? '사회궁' : p === 0 ? '자식·말년궁' : '조상·부모궁');
const han = (k, s) => STEMS[s.pillars[k].stem].han + BRANCHES[s.pillars[k].branch].han;

// 임팩트 = 희소성×0.35 + 체감성×0.40 + 안전성×0.25 (설계.md §3)
const impact = (c) => c.rarity * 0.35 + c.felt * 0.40 + c.safety * 0.25;

// ── 정곡 탐지: 참인 것만(엔진 필드 조건). 각 후보 = {token, layer, rarity, felt, safety, evid, calc} ──
function detectJeonggok(s) {
  const out = [];
  const push = (c) => out.push(c);

  // A. 오행 부재/과다 (counts) — CALC
  for (const el of EL5) {
    if (s.counts[el] === 0) push({ token: `오행 부재·${el}`, layer: 'CALC', rarity: 0.30, felt: 0.78, safety: 0.90, evid: `counts.${el}=0`, calc: `여덟 글자에 ${el}이(가) 하나도 없어. 세는 거라 그냥 사실이야.` });
    else if (s.counts[el] >= 4) push({ token: `오행 과다·${el}`, layer: 'CALC', rarity: 0.50, felt: 0.72, safety: 0.78, evid: `counts.${el}=${s.counts[el]}`, calc: `${el} 기운이 ${s.counts[el]}개, 여기 몰려 있어.` });
  }

  // B. 관성 부재 (sipsinCounts) — CALC
  const gwan = (s.sipsinCounts['정관'] || 0) + (s.sipsinCounts['편관'] || 0);
  if (gwan === 0) push({ token: '관성 부재', layer: 'CALC', rarity: 0.50, felt: 0.80, safety: 0.70, evid: '정관+편관=0', calc: '관성이 하나도 없어.' });

  // C. 지지관계: 충·원진·형 (relations) — CALC
  for (const r of s.relations) {
    const types = r.rel.map((x) => x.type);
    if (types.includes('충')) {
      const pos = [1, 2, 0, 3].find((p) => r.i === p || r.j === p) ?? 3;
      push({ token: `${POS[pos]}지 충`, layer: 'CALC', rarity: 0.50, felt: pos === 1 ? 0.95 : 0.80, safety: 0.50, evid: `${POS[r.i]}↔${POS[r.j]} 충`, calc: `${POS[pos]}지가 충이야 (${gungOf(pos)}).` });
    }
    if (types.includes('원진')) push({ token: '원진', layer: 'CALC', rarity: 0.50, felt: 0.90, safety: 0.50, evid: `${POS[r.i]}↔${POS[r.j]} 원진`, calc: '원진이 걸렸어.' });
    const hy = types.find((t) => t.startsWith('형') || t === '자형');
    if (hy) push({ token: '형(刑)', layer: 'CALC', rarity: 0.72, felt: 0.88, safety: 0.42, evid: `${POS[r.i]}↔${POS[r.j]} ${hy}`, calc: `${hy}이 있어.` });
  }

  // D. 신살: 도화(년살)·역마·화개 (pillars[k].sinsal) — CALC(이름)
  for (const k of ['시주', '일주', '월주', '년주']) {
    const ss = s.pillars[k].sinsal;
    if (ss === '년살') push({ token: '도화', layer: 'CALC', rarity: 0.30, felt: 0.60, safety: 0.70, evid: `${k} 년살(도화)`, calc: '신살에 도화가 떴어. 지지 대조표에서 바로 나와.' });
    if (ss === '역마살') push({ token: '역마', layer: 'CALC', rarity: 0.30, felt: 0.60, safety: 0.72, evid: `${k} 역마살`, calc: '역마살도 떴네. 계산값이야.' });
    if (ss === '화개살') push({ token: '화개', layer: 'CALC', rarity: 0.42, felt: 0.55, safety: 0.75, evid: `${k} 화개살`, calc: '화개살이 있어.' });
  }

  // E. 공망: 일지 (gongmang) — CALC
  if (s.gongmang.includes(s.pillars.일주.branch))
    push({ token: '일지 공망', layer: 'CALC', rarity: 0.55, felt: 0.75, safety: 0.60, evid: `공망 ${s.gongmang.map((i) => BRANCHES[i].han).join('')}`, calc: '일지가 공망이야.' });

  // F. 신강/신약 극단 (score) — INFER (라벨은 통설)
  if (s.score >= 50) push({ token: '신강(뚜렷)', layer: 'INFER', rarity: 0.50, felt: 0.75, safety: 0.60, evid: `score=${s.score}`, calc: `억부 점수 ${s.score} — 신강 쪽으로 계산돼.` });
  else if (s.score <= 30) push({ token: '신약(뚜렷)', layer: 'INFER', rarity: 0.50, felt: 0.75, safety: 0.60, evid: `score=${s.score}`, calc: `억부 점수 ${s.score} — 신약 쪽으로 계산돼.` });

  // G. 패턴(재다신약·간여지동 등) — INFER
  for (const p of s.patterns) push({ token: p.key, layer: 'INFER', rarity: 0.62, felt: 0.78, safety: 0.58, evid: 'patterns', calc: `${p.key} — ${p.gloss}` });

  // H. 일지 운성 극단(제왕·절) — INFER
  const un = s.pillars.일주.unseong;
  if (['제왕', '절'].includes(un)) push({ token: `일지 운성·${un}`, layer: 'INFER', rarity: 0.50, felt: 0.60, safety: 0.65, evid: '일주.unseong', calc: `일지 운성이 ${un}.` });

  // 중복 토큰 정리(최고 임팩트 1개만)
  const best = new Map();
  for (const c of out) { const k = c.token; if (!best.has(k) || impact(c) > impact(best.get(k))) best.set(k, c); }
  return [...best.values()];
}

// ── 시기 특정: 원국 지지 × 대운 지지 크로스조인 → 충/원진/형 완성 10년 창 (설계.md §4·최강 정곡) ──
function detectTiming(s) {
  const natal = ['시주', '일주', '월주', '년주'].map((k) => ({ pos: k, b: s.pillars[k].branch }));
  const curAge = new Date().getFullYear() - s.input.y;
  const hits = [];
  for (const d of s.daeun) for (const n of natal) {
    const rels = branchRelations(n.b, d.branch).map((x) => x.type).filter((t) => t === '충' || t === '원진' || t.startsWith('형') || t === '자형');
    if (rels.length) {
      const strength = rels.includes('충') ? 3 : rels.includes('원진') ? 2 : 1;
      const prox = 1 / (1 + Math.abs(d.age - curAge) / 10);
      hits.push({ age: d.age, natalPos: n.pos, daeunGanji: STEMS[d.stem].han + BRANCHES[d.branch].han, rels, w: strength * prox });
    }
  }
  hits.sort((a, b) => b.w - a.w);
  return hits;
}

// ── 선별: 탐지 → 랭킹 → 시기 정곡 합류 ──
function selectJeonggok(s) {
  const cands = detectJeonggok(s).map((c) => ({ ...c, impact: +impact(c).toFixed(3) }));
  const timing = detectTiming(s);
  if (timing.length) {
    const t = timing[0];
    cands.push({ token: `시기 특정·${t.age}세`, layer: 'CALC→EVENT', rarity: 0.60, felt: 0.95, safety: 0.60, impact: +(0.60 * 0.35 + 0.95 * 0.40 + 0.60 * 0.25).toFixed(3), evid: `${t.natalPos}지 × ${t.age}세 대운(${t.daeunGanji}) ${t.rels.join('·')}`, calc: `${t.age}세부터 대운이 원국과 ${t.rels[0]} 걸려 — 이 배열은 계산이라 확정이야.` });
  }
  cands.sort((a, b) => b.impact - a.impact);
  return { cands, timing };
}

// ── 3단 어조 스텁(화법_드래프트 §2 어미 마커) — CALC=단정 / INFER=hedge / EVENT=질문 ──
const registerMark = (layer) => layer.includes('EVENT') ? '질문' : layer.startsWith('INFER') ? 'hedge' : '단정';

// ── 실행: 샘플 사주들 ──
const OPTS = { trueSolar: false, eot: false, apply1954: true, lon: 126.98, jasiMode: '야자시', daeunRound: '반올림', sinsalBase: '년지', daeunCount: 8, seunCount: 12 };
const SAMPLES = [
  { label: '1990-05-15 12:30 남 (자기검증 앵커)', input: { y: 1990, mo: 5, d: 15, h: 12, mi: 30, sex: 1 } },
  { label: '1988-02-04 07:00 여', input: { y: 1988, mo: 2, d: 4, h: 7, mi: 0, sex: 2 } },
  { label: '2001-11-23 22:10 남', input: { y: 2001, mo: 11, d: 23, h: 22, mi: 10, sex: 1 } },
];

for (const smp of SAMPLES) {
  const s = buildSaju(smp.input, OPTS);
  const paja = ['시주', '일주', '월주', '년주'].map((k) => han(k, s)).join(' ');
  const oh = EL5.map((e) => `${e}${s.counts[e]}`).join(' ');
  const { cands } = selectJeonggok(s);
  console.log(`\n━━━ ${smp.label} ━━━`);
  console.log(`팔자(시일월년): ${paja}  |  오행 ${oh}  |  신강약 ${s.strength}(${s.score})  |  용신(억부) ${s.yongsin.eokbu ?? '-'} · 격국 ${s.yongsin.gyeokguk ?? '-'}`);
  console.log(`정곡 후보 ${cands.length}개 → 임팩트 상위 6:`);
  cands.slice(0, 6).forEach((c, i) => {
    console.log(`  ${i + 1}. [${c.impact}] ${c.token}  <${c.layer}·${registerMark(c.layer)}>`);
    console.log(`       근거: ${c.evid}`);
    console.log(`       발화(${registerMark(c.layer)}): ${c.calc}`);
  });
}
console.log('\n(프로토 — 판=엔진 결정론, 이 선별기가 참인 정곡만 랭킹. 화법 문안·답변지·프리페치는 화법_드래프트·실행아키텍처 참조.)');
