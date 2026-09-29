// Read the complete natal chart together. Exact symbol conditions are not
// probabilities, strength measurements, occupational aptitude or predictions.
import { STEMS_HANJA, BRANCHES_HANJA, HIDDEN_STEMS, STEM_ELEMENT, ELEMENTS, TEN_GODS, tenGod, sexStem, sexBranch, sexName } from './tables.js';
import { strengthJudge } from './judge.js';

const POSITIONS = ['year', 'month', 'day', 'hour'];
const POSITION_NAMES = { year: '연', month: '월', day: '일', hour: '시' };
const GROUPS = ['비겁', '식상', '재성', '관성', '인성'];
const ROLES = ['자기 기준과 동료', '표현과 실행', '결과와 자원 관리', '규칙과 책임', '배움과 준비'];
export const CONTEXT_READING_NOTICE = '글자의 조합과 앱의 잠정 계산 기준으로 본 강약을 읽는 설명이에요. 점수는 능력이나 확률이 아니며, 직업 적성·수입·성공이나 기운의 세기를 확정하지 않으니 실제 경험과 대조해서 읽어 주세요.';

// Interpretation prompts, not measured personal effects. Unreviewed role pairs
// retain the shared reading; the six work-role pairs below retain position order.
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
// Month branch principal and hour stem are different observation positions.
// This is a reading/question order, never a life-stage or causal prediction.
const ORDERED_WORK_READINGS = {
  '1:2': ['월지 본기의 표현·실행을 중심으로 무엇을 만드는지 읽고, 시간의 결과·자원 관리는 만든 것을 어디에 쓰고 어떻게 관리하는지 살펴보는 주제로 붙여요.', '최근 직접 만들거나 실행한 일부터 떠올려 볼까요? 그 결과를 사용하는 목적이나 시간·비용에 맞춰 무엇을 조정했나요? 그런 조정이나 경험이 없었다면 없다고 말해 주세요.'],
  '2:1': ['월지 본기의 결과·자원 관리를 중심으로 목표와 쓸 수 있는 자원을 읽고, 시간의 표현·실행은 그 조건에 맞는 방법이나 결과물을 살펴보는 주제로 붙여요.', '최근 맡은 목표나 쓸 수 있는 시간·비용부터 떠올려 볼까요? 그 조건에 맞추어 만들거나 실행하는 방법을 바꾼 적이 있나요? 바꾸지 않았거나 경험이 없다면 그대로 말해 주세요.'],
  '1:3': ['월지 본기의 표현·실행을 중심으로 시도한 방식을 읽고, 시간의 규칙·책임은 그 시도를 지켜야 할 기준과 맞춰 보는 주제로 붙여요.', '최근 시도하거나 표현한 일부터 떠올려 볼까요? 정해진 기준이나 맡은 책임이 그 방식에 도움이 되었거나 맞지 않았던 점은 무엇이었나요? 영향이나 경험이 없었다면 없다고 말해 주세요.'],
  '3:1': ['월지 본기의 규칙·책임을 중심으로 맡은 역할과 지켜야 할 기준을 읽고, 시간의 표현·실행은 그 안에서 선택하거나 제안한 방식을 살펴보는 주제로 붙여요.', '최근 맡은 책임이나 지켜야 했던 기준부터 떠올려 볼까요? 그 안에서 직접 선택하거나 제안한 방법은 무엇이었나요? 선택할 여지가 없었거나 경험이 없다면 그대로 말해 주세요.'],
  '2:3': ['월지 본기의 결과·자원 관리를 중심으로 목표와 자원 배분을 읽고, 시간의 규칙·책임은 그 목표를 맡을 때 지켜야 할 범위를 살펴보는 주제로 붙여요.', '최근 관리한 결과나 시간·비용부터 떠올려 볼까요? 그 목표와 맡은 책임의 범위가 맞았거나 조정이 필요했던 점은 무엇이었나요? 조정이나 경험이 없었다면 없다고 말해 주세요.'],
  '3:2': ['월지 본기의 규칙·책임을 중심으로 맡은 역할의 범위를 읽고, 시간의 결과·자원 관리는 그 역할에 필요한 시간·비용과 결과를 살펴보는 주제로 붙여요.', '최근 맡은 역할이나 책임부터 떠올려 볼까요? 그 일을 위해 필요한 시간·비용과 기대한 결과를 어떻게 정했나요? 직접 정하지 않았거나 경험이 없다면 그대로 말해 주세요.'],
};
const ORDERED_READING_LIMIT = '이는 두 자리를 구별하는 풀이 순서이며, 실제 행동이나 인생의 시간 순서를 뜻하지 않아요.';
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
  const ordered = ORDERED_WORK_READINGS[`${mi}:${hi}`];
  const interpretation = mi === hi
    ? `두 자리에서 ‘${ROLES[mi]}’ 주제가 반복돼요. 같은 주제가 겹치는 구성이지, 그 성향이나 능력이 더 강하다는 판정은 아니에요.`
    : ordered ? `${ordered[0]} ${ORDERED_READING_LIMIT}` : pair[0];
  const synthesis = `${positionText(monthMain)} 및 ${positionText(hourStem)}의 조합에서는 ${interpretation}`;
  const hidden = ['식상', '재성', '관성'].filter(g => groups[g].status === 'hidden_only');
  const absent = ['식상', '재성', '관성'].filter(g => groups[g].status === 'absent');
  const question = hidden.length
    ? `지장간에만 보이는 ${hidden.join('·')}의 주제(${hidden.map(g => ROLES[GROUPS.indexOf(g)]).join(' / ')})를 실제로 맡았던 일이 있나요? 맡은 적이 없거나 떠오르지 않아도 괜찮아요.`
    : absent.length
      ? `글자에서 보이지 않는 ${absent.join('·')}의 주제(${absent.map(g => ROLES[GROUPS.indexOf(g)]).join(' / ')})도 현실에서 맡은 적이 있나요? 있었다면 어떤 상황이었나요?`
      : '표현·실행, 결과·자원 관리, 규칙·책임 가운데 최근 실제로 맡은 일과 맡지 않은 일은 각각 무엇이었나요?';
  const questions = [
    { id: `month-hour-${mi}-${hi}`, prompt: mi === hi ? SAME_QUESTIONS[mi] : (ordered ?? pair)[1],
      clarifies: ordered ? '월지 본기 주제를 먼저 확인하고 시간 주제를 대조하는 질문; 실제 행동 순서·인과·시기 판정은 아님' : '월·시에서 읽은 주제가 실제 업무에서 함께 나타나는 방식과 맞지 않는 상황' },
    { id: hidden.length ? 'hidden-context' : absent.length ? 'absent-context' : 'shared-context', prompt: question,
      clarifies: '글자의 관찰 범위와 별개로 실제 맡은 역할·경험의 유무' },
  ];
  return { synthesis, questions };
}

// Same character and same element are distinct observations, not competing
// strength scores. Scope is the four natal branches under the existing table.
function hiddenRootContext(dayStem, hidden, positionText) {
  const collect = predicate => {
    const matches = hidden.filter(predicate);
    const principal = matches.filter(m => m.principal);
    const additional = matches.filter(m => !m.principal);
    return { principal, additional, status: principal.length ? 'principal_present'
      : additional.length ? 'additional_only' : 'absent' };
  };
  const sameStem = collect(m => m.stem === dayStem);
  const sameElement = collect(m => STEM_ELEMENT[m.stem] === STEM_ELEMENT[dayStem]);
  const locations = scope => [...scope.principal, ...scope.additional].map(positionText).join(', ') || '없음';
  const facts = `네 지지의 지장간에서 일간 ${STEMS_HANJA[dayStem]}과 같은 글자: ${locations(sameStem)} / 같은 ${ELEMENTS[STEM_ELEMENT[dayStem]]} 오행: ${locations(sameElement)}이에요. ` +
    '본기 밖 글자는 앞의 강약 점수에 따로 더하지 않았으며, 같은 글자와 같은 오행의 관찰만으로 통근의 강도나 실제 능력을 정하지 않아요.';
  let interpretation, question;
  if (sameElement.status === 'absent') {
    interpretation = '이 지장간표의 네 지지에는 일간과 같은 오행이 보이지 않아요. 앞의 도움 목록에는 다른 천간이나 일간을 생하는 인성이 있을 수 있으므로, 이 관찰을 원국 전체의 도움 부재나 혼자 일할 능력의 부족으로 읽지 않아요.';
    question = '네 지지에 같은 오행이 없다는 관찰을 실제 도움이나 능력이 없다는 뜻으로 읽지는 않아요.';
  } else if (sameStem.status === 'absent') {
    interpretation = `같은 글자는 없지만 같은 오행은 ${sameElement.status === 'additional_only' ? '본기 밖 지장간에' : '지지 본기에'} 있어요. 같은 글자 기준의 부재를 같은 오행까지 없다는 뜻으로 넓히지 않고, 앞의 일·재능 가설도 능력의 유무를 단정하지 않는 범위로 읽어요.`;
    question = '같은 글자는 없지만 같은 오행은 있다는 차이를 실제 능력 차이로 정하지 않아요.';
  } else if (sameStem.additional.length || sameElement.additional.length) {
    interpretation = sameElement.status === 'additional_only'
      ? '지지 본기에는 없던 같은 오행이 나머지 지장간에는 남아 있어요. 앞의 점수가 이 글자를 따로 세지 않았다는 뜻이므로, 점수만 보고 자기 기준과 동료라는 주제까지 없다고 단정하지 않아요.'
      : '지지 본기에서 읽은 구성에 더해 본기 밖에도 같은 글자나 같은 오행이 보여요. 같은 글자의 자리와 같은 오행의 자리를 구별해 앞의 일·재능 가설을 읽되, 겹친 개수를 힘이나 적성의 크기로 바꾸지 않아요.';
    question = '점수에 따로 세지 않은 지장간의 글자가 있다는 관찰을 숨은 능력의 증거로 읽지는 않아요.';
  } else {
    interpretation = '같은 글자와 같은 오행은 지지 본기에 있고 본기 밖의 추가 관찰은 없어요. 앞에서 이미 도움으로 센 자리를 다시 가산하지 않으며, 이 구성과 실제 일하는 방식이 맞는지는 경험으로 확인해요.';
    question = '이미 본기에서 센 글자를 다시 가산하거나 실제 능력으로 정하지 않아요.';
  }
  return { scope: 'four-natal-branches-existing-hidden-stems', sameStem, sameElement,
    facts, interpretation, question };
}

// Reuse the existing calculation, including its provisional help/classification
// policy. The reading below is a question to investigate, not a personal verdict.
function strengthContext(chart, monthMain, hourStem, hidden, positionText) {
  const observation = strengthJudge(chart);
  const band = ['신강', '극신강'].includes(observation.label) ? 'strong'
    : ['신약', '극신약'].includes(observation.label) ? 'weak' : 'balanced';
  const dayStem = sexStem(chart.pillarsIdx.day);
  const supports = [];
  for (const position of POSITIONS) {
    const branch = sexBranch(chart.pillarsIdx[position]);
    const hidden = HIDDEN_STEMS[branch];
    for (const [part, stem, helps] of [
      ['stem', sexStem(chart.pillarsIdx[position]), position !== 'day' && observation.detail[position].stemHelp],
      ['hidden', hidden[hidden.length - 1], observation.detail[position].branchHelp],
    ]) if (helps) supports.push({ position, part, stem, character: STEMS_HANJA[stem],
      tenGod: TEN_GODS[tenGod(dayStem, stem)], principal: part === 'hidden' });
  }
  const facts = `원국 전체의 강약을 함께 보면, 앱의 잠정 기준은 ${observation.label}(${observation.score}/${observation.max}점)이에요. ` +
    (supports.length ? `일간 자신 외에 ${supports.map(positionText).join(', ')}을 도움으로 셌어요.`
      : '이 기준에서는 일간 자신 외에 도움으로 세는 천간·지지 본기가 없어요.');
  const roles = [...new Set([monthMain.group, hourStem.group])].map(g => ROLES[GROUPS.indexOf(g)]).join(' / ');
  const focus = band === 'strong'
    ? '자기 판단을 일에 옮기는 방식과 다른 사람의 요구에 맞춰 조정하는 부분을'
    : band === 'weak'
      ? '맡은 일을 감당할 때 필요한 준비·협업과 혼자 맡을 수 있는 범위를'
      : '스스로 밀고 나갈 부분과 준비·협업이 필요한 부분을 상황에 따라 나누는 방식을';
  const hypothesis = `앞의 ‘${roles}’ 조합에 이 조건을 더하면, ${focus} 살펴보는 해석 가설로 이어져요. 실제로 그런지는 경험을 확인해야 해요.`;
  const roots = hiddenRootContext(dayStem, hidden, positionText);
  const question = band === 'strong'
    ? '최근 자기 판단대로 진행했거나 주도하지 않았던 일에서 다른 사람의 요구와 맞았거나 달랐던 부분은 무엇이었나요?'
    : band === 'weak'
      ? '최근 일을 혼자 진행할 때와 준비·도움을 받을 때 무엇이 달랐고, 혼자서도 무리 없었거나 차이가 없었던 경험은 무엇이었나요?'
      : '최근 비슷한 일을 혼자 진행한 경우와 준비·협업이 필요했던 경우 무엇이 달랐고, 차이가 없었다면 어떤 상황이었나요?';
  roots.question = `${roots.question} ${question}`;
  return { observation, band, supports, facts, hypothesis, roots,
    question: { id: `strength-${band}-${roots.sameStem.status}-${roots.sameElement.status}`, prompt: roots.question,
      clarifies: '잠정 강약·지장간 관찰과 실제 자기 방식·협업 경험의 일치·불일치' } };
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
  const strength = strengthContext(chart, monthMain, hourStem, hidden, positionText);
  const questions = [...combined.questions, strength.question];
  return { policy: 'natal-work-context-v5', kind: 'conditional_structural_reading',
    dayPillar: sexName(p.day), groups, conditions, monthMain, hourStem,
    strength, experienceQuestions: questions,
    blocks: [{ label: '같은 일주여도 달라지는 부분', lines: [overview] },
      { label: '표현·결과·책임의 구성', lines: roleLines },
      { label: '함께 읽으면', lines: [combined.synthesis, synthesis, strength.facts, strength.hypothesis, strength.roots.facts, strength.roots.interpretation] },
      { label: '경험으로 확인할 부분', lines: [...questions.map(q => q.prompt),
        '답을 통해 실제 맡은 역할과 상황을 더 구체적으로 물을 수 있고, 경험이 없다면 없다고 말해도 돼요. 맞지 않는 경험도 함께 살피며, 답만으로 사주가 맞았다거나 적성을 확인했다고 판단하지 않아요.'] }],
    note: CONTEXT_READING_NOTICE, predictionEnabled: false, trainingEligible: false, probability: null };
}
