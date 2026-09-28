// L3 해석 조립기 — LLM 없이 완결 동작하는 근거 기반 리포트 (절대 원칙 3의 기반층).
// 입력: L1 차트 + keyset + KB(색인·별칭·본문). 출력: 섹션 구조체 (+ 마크다운 직렬화).
// 모든 서술 블록에는 출처(문서·글 제목)가 붙는다. 근거 유닛이 없으면 "소장 문헌에 상세 없음".

import { STEMS, BRANCHES, ELEMENTS, STEM_ELEMENT, HIDDEN_STEMS, TEN_GODS, tenGod, sexStem, sexBranch } from './tables.js';

/** aliases 체인을 따라 색인에서 유닛 목록을 찾는다 (결정론 조회 — 검색 없음) */
export function lookupUnits(key, kb) {
  const chain = kb.aliases[key] || [key];
  const seen = new Set(), found = [];
  for (const c of chain) {
    for (const e of kb.index[c] || []) {
      if (!seen.has(e.key)) { seen.add(e.key); found.push(e); }
    }
  }
  return found;
}

/** 유닛 발췌 블록: 앞 n문단 + 출처 (증류(distill) 전 v1 — 증류본이 생기면 그걸 우선 사용) */
function excerpt(entry, kb, nParas = 4) {
  const body = kb.bodies[entry.key];
  if (!body) return null;
  const paras = body.paras.slice(0, nParas);
  const total = body.totalParas ?? body.paras.length; // 경량 번들(앞 N문단만)에서도 원문 문단수 유지
  return { source: { doc: entry.doc, title: entry.title }, paras, truncated: total > paras.length, totalParas: total };
}

function topicBlock(key, kb, { maxUnits = 2, nParas = 4 } = {}) {
  // 증류본이 있으면 우선 사용 (요소별 정제 유닛 — 원문 발췌보다 조밀)
  if (kb.distilled && kb.distilled[key]) return { key, distilled: kb.distilled[key] };
  const units = lookupUnits(key, kb);
  if (!units.length) return { key, empty: true, note: '소장 문헌에 상세 없음' };
  return { key, excerpts: units.slice(0, maxUnits).map((u) => excerpt(u, kb, nParas)).filter(Boolean), totalUnits: units.length };
}

/** 십신 분포 (천간 3 + 지지 본기 4 = 7자, 일간 제외) */
export function sipsinDistribution(chart) {
  const p = chart.pillarsIdx;
  const day = sexStem(p.day);
  const count = Object.fromEntries(TEN_GODS.map((g) => [g, 0]));
  for (const q of ['year', 'month', 'hour']) count[TEN_GODS[tenGod(day, sexStem(p[q]))]]++;
  for (const q of ['year', 'month', 'day', 'hour']) {
    const hs = HIDDEN_STEMS[sexBranch(p[q])];
    count[TEN_GODS[tenGod(day, hs[hs.length - 1])]]++;
  }
  return count;
}

/** 오행 분포 (8자: 천간 4 + 지지 본기 4) */
export function elementDistribution(chart) {
  const p = chart.pillarsIdx;
  const count = [0, 0, 0, 0, 0];
  for (const q of ['year', 'month', 'day', 'hour']) {
    count[STEM_ELEMENT[sexStem(p[q])]]++;
    const hs = HIDDEN_STEMS[sexBranch(p[q])];
    count[STEM_ELEMENT[hs[hs.length - 1]]]++;
  }
  return Object.fromEntries(ELEMENTS.map((e, i) => [e, count[i]]));
}

/**
 * 리포트 생성.
 * @param {object} chart computeChart 결과
 * @param {object} keyset chartToKeys 결과
 * @param {object} kb { index, aliases, bodies }
 */
export function buildReport(chart, keyset, kb) {
  const S = [];
  const saju = chart.saju;

  // 1) 원국 표
  S.push({
    id: 'wonguk', title: '원국(原局)',
    table: ['hour', 'day', 'month', 'year'].map((q) => ({
      pos: { hour: '시주', day: '일주', month: '월주', year: '년주' }[q],
      ganji: `${saju[q].name}(${saju[q].hanja})`,
      stemTenGod: saju[q].stemTenGod, branchTenGod: saju[q].branchTenGod,
      hidden: saju[q].hiddenStems.join(''), stage: saju[q].twelveStage,
    })),
    meta: {
      dayMaster: chart.dayMaster,
      corrected: `${chart.correctedLocal.hh}:${String(chart.correctedLocal.mm).padStart(2, '0')} (보정 ${chart.correctedLocal.correctionMinutes}분)`,
      monthTerm: chart.monthTerm.name,
      elements: elementDistribution(chart),
    },
  });

  // 1.5) 구조 판정 (보드 통변 순서: 조후·신강신약이 개별 요소보다 먼저)
  if (keyset.judge) {
    const j = keyset.judge;
    const flags = [
      j.strength.deukryeong ? '득령' : '실령',
      j.strength.deukji ? '득지' : null,
      j.strength.deuksi ? '득시' : null,
      j.strength.deukse ? '득세' : null,
    ].filter(Boolean);
    const lines = [
      `신강신약: **${j.strength.label}** (${j.strength.score}/110점 — 방법론 보드 배점: 천간 각10, 지지 년15·월30·일15·시10) · ${flags.join('·')}`,
      `조후: ${j.johu.season}생${j.johu.need ? ` — ${j.johu.need} 기운 필요, 원국 ${j.johu.satisfied ? '보유' : '**부재**'}` : ' (조후 무난)'}`,
      `오행: ${Object.entries(j.profile.elements).map(([e, c]) => `${e}${c}`).join(' ')}${j.profile.missing.length ? ` · 부재 [${j.profile.missing.join(',')}]` : ''}${j.profile.excess.length ? ` · 과다 [${j.profile.excess.join(',')}]` : ''}`,
      j.profile.missingGroups.length ? `십신 부재: ${j.profile.missingGroups.join(', ')}` : null,
      j.chains.length ? `구조 후보: ${j.chains.join(' · ')} (성립 세부는 문헌 근거로 판단)` : null,
    ].filter(Boolean);
    S.push({ id: 'judge', title: '원국 구조 판정', lines });
  }

  // 2) 일주론 (해석의 중심)
  S.push({ id: 'ilju', title: `일주 — ${saju.day.name}일주`, block: topicBlock(keyset.byTopic.ilju[0], kb, { maxUnits: 2, nParas: 6 }) });

  // 3) 일간 천간론 + 일지
  S.push({ id: 'daymaster', title: `일간 — ${chart.dayMaster}`, block: topicBlock(`cheongan/${chart.dayMaster}`, kb) });
  S.push({ id: 'daybranch', title: `일지 — ${saju.day.branch}`, block: topicBlock(`jiji/${saju.day.branch}`, kb) });

  // 4) 십신 구성 — 분포 + 최다 십신 근거
  const dist = sipsinDistribution(chart);
  const present = Object.entries(dist).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
  S.push({
    id: 'sipsin', title: '십신 구성', distribution: dist,
    blocks: present.slice(0, 3).map(([g, c]) => ({ label: `${g} ×${c}`, ...topicBlock(`sipsin/${g}`, kb, { maxUnits: 1, nParas: 4 }) })),
  });

  // 5) 합충
  const rel = keyset.relations;
  const relLines = [];
  for (const [field, label] of [['stemHap', '천간합'], ['stemChung', '천간충'], ['yukhap', '육합'], ['samhap', '삼합'], ['banghap', '방합'], ['chung', '충'], ['hyeong', '형'], ['pa', '파'], ['hae', '해'], ['wonjin', '원진']]) {
    for (const r of rel[field]) relLines.push(`${label}: ${r.name} (${r.positions.join('·')})`);
  }
  S.push({
    id: 'hapchung', title: '합충 관계', lines: relLines.length ? relLines : ['원국 내 두드러진 합충 없음'],
    blocks: [...new Set(keyset.byTopic.hapchung)].map((k) => ({ label: k.split('/')[1], ...topicBlock(k, kb, { maxUnits: 1, nParas: 3 }) })),
  });

  // 6) 신살
  const sinsalKeys = [...new Set(keyset.byTopic.sinsal)];
  S.push({
    id: 'sinsal', title: '신살',
    blocks: sinsalKeys.map((k) => ({ label: k.split('/')[1], ...topicBlock(k, kb, { maxUnits: 1, nParas: 3 }) })),
  });

  // 7) 대운
  S.push({
    id: 'daeun', title: `대운 — ${chart.daeun.forward ? '순행' : '역행'}, 대운수 ${chart.daeun.su}`,
    table: chart.daeun.list.map((d) => ({ age: d.age, ganji: d.name, tenGod: d.stemTenGod, stage: d.twelveStage })),
  });

  // 8) 올해 세운
  for (const k of keyset.byTopic.unse) {
    if (k.endsWith('/general')) continue;
    const yearName = k.split('/')[1];
    S.push({ id: 'unse', title: `올해의 운 — ${yearName}년 ${saju.day.name}일주`, block: topicBlock(k, kb, { maxUnits: 1, nParas: 8 }) });
  }

  return { input: chart.input, sections: S };
}

/** 마크다운 직렬화 (CLI·검수용. 웹은 구조체를 직접 렌더) */
export function toMarkdown(report) {
  const L = [];
  const src = (s) => `> — 출처: ${s.doc} · 「${s.title}」`;
  for (const sec of report.sections) {
    L.push(`\n## ${sec.title}\n`);
    if (sec.table && sec.id === 'wonguk') {
      L.push('| 구분 | 간지 | 천간 십신 | 지지 십신 | 지장간 | 12운성 |');
      L.push('|---|---|---|---|---|---|');
      for (const r of sec.table) L.push(`| ${r.pos} | ${r.ganji} | ${r.stemTenGod} | ${r.branchTenGod} | ${r.hidden} | ${r.stage} |`);
      L.push('');
      L.push(`- 일간: **${sec.meta.dayMaster}** · 월령: ${sec.meta.monthTerm} · 보정시각: ${sec.meta.corrected}`);
      L.push(`- 오행 분포(본기): ${Object.entries(sec.meta.elements).map(([e, c]) => `${e}${c}`).join(' ')}`);
    }
    if (sec.table && sec.id === 'daeun') {
      L.push('| 나이 | 간지 | 십신 | 12운성 |');
      L.push('|---|---|---|---|');
      for (const r of sec.table) L.push(`| ${r.age} | ${r.ganji} | ${r.tenGod} | ${r.stage} |`);
    }
    if (sec.distribution) {
      L.push(Object.entries(sec.distribution).filter(([, c]) => c).map(([g, c]) => `${g}×${c}`).join(' · '));
    }
    if (sec.lines) for (const ln of sec.lines) L.push(`- ${ln}`);
    const renderBlock = (b, label) => {
      if (!b) return;
      if (b.empty) { L.push(`\n**${label || b.key}** — ${b.note}`); return; }
      if (label) L.push(`\n### ${label}`);
      if (b.distilled) {
        const d = b.distilled;
        const dd = d.distilled || {};
        if (dd['핵심']) L.push(`**${dd['핵심']}**\n`);
        for (const sec of ['성격', '직업', '관계', '주의']) {
          if (dd[sec] && dd[sec].length) {
            L.push(`**${sec}**`);
            for (const item of dd[sec]) L.push(`- ${item}`);
            L.push('');
          }
        }
        if (dd['물상']) L.push(`물상: ${dd['물상']}\n`);
        for (const q of d['인용'] || []) L.push(`> "${q.text}" — ${q.src}`);
        for (const pd of d['관점차이'] || []) {
          L.push(`\n*관점차이 — ${pd['주제']}*: ${pd['견해'].map((v) => `${v['내용']} (${v.src.split('#')[0]})`).join(' ↔ ')}`);
        }
        L.push('');
        return;
      }
      for (const ex of b.excerpts) {
        for (const p of ex.paras) L.push(`${p}\n`);
        if (ex.truncated) L.push(`(…전문 ${ex.totalParas}문단 중 발췌)`);
        L.push(src(ex.source));
        L.push('');
      }
    };
    if (sec.block) renderBlock(sec.block);
    if (sec.blocks) for (const b of sec.blocks) renderBlock(b, b.label);
  }
  return L.join('\n');
}
