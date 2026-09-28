// Read the complete natal chart together. Exact symbol conditions are not
// probabilities, strength measurements, occupational aptitude or predictions.
import { STEMS_HANJA, BRANCHES_HANJA, HIDDEN_STEMS, TEN_GODS, tenGod, sexStem, sexBranch, sexName } from './tables.js';

const POSITIONS = ['year', 'month', 'day', 'hour'];
const POSITION_NAMES = { year: '연', month: '월', day: '일', hour: '시' };
const GROUPS = ['비겁', '식상', '재성', '관성', '인성'];
const ROLES = ['자기 기준과 동료', '표현과 실행', '결과와 자원 관리', '규칙과 책임', '배움과 준비'];
export const CONTEXT_READING_NOTICE = '글자의 조합을 읽는 설명이에요. 기운의 세기나 직업 적성·수입·성공을 확정하지 않으며, 실제 경험과 대조해서 읽어 주세요.';

function completeChart(chart) {
  const { hour, minute, hourUnknown } = chart?.input ?? {};
  return chart?.birthTime?.status !== 'unknown' && hourUnknown !== true &&
    Number.isInteger(hour) && hour >= 0 && hour < 24 &&
    Number.isInteger(minute) && minute >= 0 && minute < 60 &&
    POSITIONS.every(p => Number.isInteger(chart?.pillarsIdx?.[p]) && chart.pillarsIdx[p] >= 0 && chart.pillarsIdx[p] < 60);
}

/** Four already-reviewed absence predicates retain their original scopes.
 * For wealth/authority, excluding the day master leaves the 8-symbol presence
 * predicate unchanged: the day master can only be 비견 relative to itself. */
export function buildContextReading(chart) {
  if (!completeChart(chart)) return null;
  const p = chart.pillarsIdx, dayStem = sexStem(p.day);
  const marker = (position, part, stem, principal = false) => {
    const god = tenGod(dayStem, stem);
    return { position, part, stem, character: STEMS_HANJA[stem], tenGod: TEN_GODS[god], group: GROUPS[Math.floor(god / 2)], principal };
  };
  const stems = ['year', 'month', 'hour'].map(q => marker(q, 'stem', sexStem(p[q])));
  const hidden = POSITIONS.flatMap(q => HIDDEN_STEMS[sexBranch(p[q])].map((s, i, all) => marker(q, 'hidden', s, i === all.length - 1)));
  const surface = [...stems, ...hidden.filter(m => m.principal)];
  const groups = Object.fromEntries(GROUPS.map(group => {
    const visible = surface.filter(m => m.group === group), all = hidden.filter(m => m.group === group);
    return [group, { surface: visible, hidden: all,
      status: visible.length ? 'surface_present' : all.length ? 'hidden_only' : 'absent' }];
  }));
  const conditions = {};
  for (const [group, id] of [['재성', 'wealth'], ['관성', 'authority']]) {
    conditions[`${id}_surface_absence`] = groups[group].surface.length === 0 ? 'met' : 'unmet';
    conditions[`${id}_surface_and_hidden_absence`] = groups[group].status === 'absent' ? 'met' : 'unmet';
  }
  const positionText = m => `${POSITION_NAMES[m.position]}${m.part === 'stem' ? '간' : m.principal ? '지 본기' : '지 지장간'} ${m.character}(${m.tenGod})`;
  const monthMain = hidden.find(m => m.position === 'month' && m.principal);
  const hourStem = stems.find(m => m.position === 'hour');
  const role = m => ROLES[GROUPS.indexOf(m.group)];
  const same = monthMain.group === hourStem.group;
  const overview = `${sexName(p.day)}일주를 월주·시주와 함께 보면, 월지 ${BRANCHES_HANJA[sexBranch(p.month)]}의 본기는 ${monthMain.character}(${monthMain.tenGod}), 시주의 천간은 ${hourStem.character}(${hourStem.tenGod})이에요. ` +
    (same ? `두 자리에서 ${monthMain.group} 계열이 겹쳐, ‘${role(monthMain)}’ 주제를 함께 읽어요.`
      : `‘${role(monthMain)}’ 그리고 ‘${role(hourStem)}’ 주제를 함께 읽어요.`);
  const roleLines = ['식상', '재성', '관성'].map(group => {
    const g = groups[group], meaning = ROLES[GROUPS.indexOf(group)];
    if (g.status === 'surface_present') return `${group}(${meaning}): 천간·지지 본기에서 ${g.surface.map(positionText).join(', ')} 등의 글자가 보여요.`;
    if (g.status === 'hidden_only') return `${group}(${meaning}): 천간·지지 본기에는 없지만 ${g.hidden.map(positionText).join(', ')}에 있어요. 겉에 없다는 이유로 아예 없다고 읽지 않아요.`;
    return `${group}(${meaning}): 천간·지지 본기와 전체 지장간에서도 보이지 않아요. 글자의 부재를 실제 능력이나 기회의 부재로 해석하지 않아요.`;
  });
  const present = group => groups[group].status === 'surface_present';
  const supporting = ['식상', '재성', '관성'].filter(present);
  let synthesis;
  if (present('식상') && present('재성')) {
    synthesis = '식상과 재성이 겉에서 함께 보여, 표현하고 만들어 내는 과정과 결과를 관리하는 과정을 연결해서 읽을 수 있어요. 공존만으로 식상생재의 성립이나 사업 적성을 확정하지 않아요.';
  } else if (present('재성') && present('관성')) {
    synthesis = '재성과 관성이 겉에서 함께 보여, 결과·자원 관리와 규칙·책임을 함께 살펴보는 풀이예요. 공존만으로 재생관의 성립이나 직장 적성을 확정하지 않아요.';
  } else if (present('식상') && present('관성')) {
    synthesis = '식상과 관성이 겉에서 함께 보여, 자신의 표현·실행과 정해진 규칙·책임을 함께 살펴봐요. 두 계열의 공존만으로 충돌이나 상관견관을 확정하지 않아요.';
  } else if (supporting.length) {
    synthesis = `일을 읽는 세 계열 가운데 겉에서는 ${supporting[0]}이 보여요. 다른 계열은 위의 지장간 관찰까지 구분해서 읽으며, 한 계열만으로 직업 방향을 정하지 않아요.`;
  } else {
    synthesis = '일을 읽는 식상·재성·관성이 겉에 드러나지 않아, 지장간에 남은 글자와 배움·준비 및 자기 기준을 함께 살펴봐야 해요. 이 구성만으로 일의 성패를 정하지 않아요.';
  }
  if (supporting.length === 3) synthesis += ' 관성도 함께 있으므로 규칙·책임이라는 조건까지 같이 읽어야 해요.';
  const hiddenTopics = ['식상', '재성', '관성'].filter(group => groups[group].status === 'hidden_only');
  if (hiddenTopics.length) synthesis += ` ${hiddenTopics.join('·')}은 지장간에서만 보이므로, 겉에 드러난 계열만으로 풀이를 끝내지 않아요. 다만 숨은 글자가 실제로 얼마나 작용하는지는 아직 판단하지 않아요.`;
  return { policy: 'natal-work-context-v1', kind: 'conditional_structural_reading',
    dayPillar: sexName(p.day), groups, conditions, monthMain, hourStem,
    blocks: [{ label: '같은 일주여도 달라지는 부분', lines: [overview] },
      { label: '표현·결과·책임의 구성', lines: roleLines },
      { label: '함께 읽으면', lines: [synthesis] }],
    note: CONTEXT_READING_NOTICE, predictionEnabled: false, trainingEligible: false, probability: null };
}
