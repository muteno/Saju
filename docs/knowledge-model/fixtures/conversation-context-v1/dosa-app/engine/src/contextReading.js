// Read the complete natal chart together. Exact symbol conditions are not
// probabilities, strength measurements, occupational aptitude or predictions.
import { STEMS_HANJA, BRANCHES_HANJA, HIDDEN_STEMS, TEN_GODS, tenGod, sexStem, sexBranch, sexName } from './tables.js';

const POSITIONS = ['year', 'month', 'day', 'hour'];
const POSITION_NAMES = { year: '연', month: '월', day: '일', hour: '시' };
const GROUPS = ['비겁', '식상', '재성', '관성', '인성'];
const ROLES = ['자기 기준과 동료', '표현과 실행', '결과와 자원 관리', '규칙과 책임', '배움과 준비'];
export const CONTEXT_READING_NOTICE = '글자의 조합을 읽는 설명이에요. 기운의 세기나 직업 적성·수입·성공을 확정하지 않으며, 실제 경험과 대조해서 읽어 주세요.';

// Interpretation prompts, not measured personal effects. Pair keys are sorted;
// the actual month/hour positions remain explicit in every rendered synthesis.
const PAIR_READINGS = {
  '0:1': ['자기 기준을 정하는 일과 생각을 표현·실행하는 일을 연결해 읽어요.', '최근 직접 방향을 정해 만든 일이 있나요? 혼자 결정한 부분과 다른 사람의 의견을 반영한 부분은 각각 무엇이었나요?'],
  '0:2': ['자기 방식으로 선택하는 일과 시간·비용·결과를 관리하는 일을 함께 읽어요.', '최근 원하는 방식과 쓸 수 있는 시간·비용이 달랐던 일이 있나요? 무엇을 유지하고 무엇을 바꿨나요?'],
  '0:3': ['자기 판단으로 정하는 범위와 정해진 기준·책임을 맡는 범위를 함께 읽어요.', '최근 맡은 일에서 스스로 정한 부분과 정해진 기준을 따른 부분은 무엇이었나요? 두 방식이 잘 맞았거나 맞지 않았던 장면이 있나요?'],
  '0:4': ['자기 기준을 세우는 일과 배워서 판단을 보완하는 일을 연결해 읽어요.', '최근 새로 배운 내용 때문에 본인의 판단을 바꾼 일이 있나요? 바꾸지 않은 부분이 있다면 이유는 무엇이었나요?'],
  '1:2': ['표현·실행한 것을 결과와 자원 관리로 이어가는 과정을 함께 읽어요.', '최근 만든 결과물은 어떻게 사용되었나요? 만드는 과정과 시간·비용·결과를 관리하는 과정에서 각각 맡은 일은 무엇이었나요?'],
  '1:3': ['자유롭게 표현·실행하는 과정과 기준·책임을 지키는 과정을 함께 읽어요.', '최근 새 방식으로 시도한 일에서 정해진 기준은 어떤 역할을 했나요? 도움이 된 점이나 맞지 않았던 점이 있나요?'],
  '1:4': ['배움·준비와 표현·실행 사이를 어떻게 오가는지 함께 읽어요.', '최근 배운 것을 실제로 써 본 일이 있나요? 준비한 대로 된 부분과 해 보면서 바꾼 부분은 무엇이었나요?'],
  '2:3': ['결과·자원을 관리하는 과정과 맡은 기준·책임을 지키는 과정을 함께 읽어요.', '최근 맡은 일에서 시간·비용·결과와 지켜야 할 기준을 어떻게 조정했나요? 조정할 필요가 없었다면 그대로 말해 주세요.'],
  '2:4': ['배움·준비가 시간·비용·결과 관리와 어떻게 이어지는지 함께 읽어요.', '최근 자료를 찾거나 배운 내용이 시간·비용·결과를 관리하는 데 쓰였나요? 쓰이지 않은 부분도 있었나요?'],
  '3:4': ['배움·준비와 기준·책임을 맡는 과정을 함께 읽어요.', '최근 맡은 역할을 위해 새로 배운 것이 있나요? 준비가 도움이 된 부분과 실제로 해 보아야 알 수 있었던 부분은 무엇이었나요?'],
};
const SAME_QUESTIONS = [
  '최근 스스로 결정한 일과 다른 사람과 함께 정한 일은 각각 무엇이었나요? 상황에 따라 방식이 달랐나요?',
  '최근 생각을 말하거나 결과물로 옮긴 일은 무엇이었나요? 실행하지 않은 생각이 있다면 이유는 무엇이었나요?',
  '최근 시간·비용·결과를 관리한 일은 무엇이었나요? 계획과 실제가 같았던 점과 달랐던 점은 무엇이었나요?',
  '최근 정해진 기준이나 맡은 책임을 다룬 일은 무엇이었나요? 기준을 따르거나 조정한 이유는 무엇이었나요?',
  '최근 새로 배우거나 준비한 일은 무엇이었나요? 실제로 써 본 부분과 아직 쓰지 않은 부분은 무엇이었나요?',
];

function combineRoles(monthMain, hourStem, groups, positionText) {
  const mi = GROUPS.indexOf(monthMain.group), hi = GROUPS.indexOf(hourStem.group);
  const key = [mi, hi].sort((a, b) => a - b).join(':');
  const pair = PAIR_READINGS[key];
  const interpretation = mi === hi
    ? `두 자리에서 ‘${ROLES[mi]}’ 주제가 반복돼요. 같은 주제가 겹치는 구성이지, 그 성향이나 능력이 더 강하다는 판정은 아니에요.`
    : pair[0];
  const synthesis = `${positionText(monthMain)} 및 ${positionText(hourStem)}의 조합에서는 ${interpretation}`;
  const hidden = ['식상', '재성', '관성'].filter(g => groups[g].status === 'hidden_only');
  const absent = ['식상', '재성', '관성'].filter(g => groups[g].status === 'absent');
  const question = hidden.length
    ? `지장간에만 보이는 ${hidden.join('·')}의 주제(${hidden.map(g => ROLES[GROUPS.indexOf(g)]).join(' / ')})를 실제로 맡았던 일이 있나요? 맡은 적이 없거나 떠오르지 않아도 괜찮아요.`
    : absent.length
      ? `글자에서 보이지 않는 ${absent.join('·')}의 주제(${absent.map(g => ROLES[GROUPS.indexOf(g)]).join(' / ')})도 현실에서 맡은 적이 있나요? 있었다면 어떤 상황이었나요?`
      : '표현·실행, 결과·자원 관리, 규칙·책임 가운데 최근 실제로 맡은 일과 맡지 않은 일은 각각 무엇이었나요?';
  const questions = [
    { id: `month-hour-${mi}-${hi}`, prompt: mi === hi ? SAME_QUESTIONS[mi] : pair[1],
      clarifies: '월·시에서 읽은 주제가 실제 업무에서 함께 나타나는 방식과 맞지 않는 상황' },
    { id: hidden.length ? 'hidden-context' : absent.length ? 'absent-context' : 'shared-context', prompt: question,
      clarifies: '글자의 관찰 범위와 별개로 실제 맡은 역할·경험의 유무' },
  ];
  return { synthesis, questions };
}

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
  const combined = combineRoles(monthMain, hourStem, groups, positionText);
  return { policy: 'natal-work-context-v2', kind: 'conditional_structural_reading',
    dayPillar: sexName(p.day), groups, conditions, monthMain, hourStem,
    experienceQuestions: combined.questions,
    blocks: [{ label: '같은 일주여도 달라지는 부분', lines: [overview] },
      { label: '표현·결과·책임의 구성', lines: roleLines },
      { label: '함께 읽으면', lines: [combined.synthesis, synthesis] },
      { label: '경험으로 확인할 부분', lines: [...combined.questions.map(q => q.prompt),
        '답을 통해 실제 맡은 역할과 상황을 더 구체적으로 물을 수 있고, 경험이 없다면 없다고 말해도 돼요. 맞지 않는 경험도 함께 살피며, 답만으로 사주가 맞았다거나 적성을 확인했다고 판단하지 않아요.'] }],
    note: CONTEXT_READING_NOTICE, predictionEnabled: false, trainingEligible: false, probability: null };
}
