// Experimental, source-informed comparison of natal Jia-day stem candidates.
// References/assumptions: docs/knowledge-model/CONDITIONAL_WORK_READING.md.
// This never activates the source-claim catalog as personal prediction rules.
import { detectRelations } from './relations.js';

/** Same strong three-valued all/any/not contract as context_query.py.
 * Exact presence is 0/1/null; neither degrees nor calibrated probabilities. */
export function evaluateCondition(expression, features, depth = 0) {
  if (depth > 16 || !expression || typeof expression !== 'object' || Array.isArray(expression) || Object.keys(expression).length !== 1)
    throw new TypeError('Invalid condition expression');
  const [operator, value] = Object.entries(expression)[0];
  if (operator === 'feature') {
    if (typeof value !== 'string' || !value) throw new TypeError('Invalid feature name');
    const state = Object.hasOwn(features, value) ? features[value] : null;
    if (state !== null && state !== 0 && state !== 1) throw new TypeError('Conditions require 0, 1 or null');
    return { value: state, feature: value, unknownFeatures: state === null ? [value] : [] };
  }
  if (operator === 'not') {
    const child = evaluateCondition(value, features, depth + 1);
    return { value: child.value === null ? null : 1 - child.value, operator, children: [child], unknownFeatures: child.unknownFeatures };
  }
  if (!['all', 'any'].includes(operator) || !Array.isArray(value) || !value.length) throw new TypeError('Invalid condition operator');
  const children = value.map(e => evaluateCondition(e, features, depth + 1));
  const states = children.map(c => c.value);
  const result = operator === 'all' ? (states.includes(0) ? 0 : states.includes(null) ? null : 1)
    : (states.includes(1) ? 1 : states.includes(null) ? null : 0);
  return { value: result, operator, children, unknownFeatures: [...new Set(children.flatMap(c => c.unknownFeatures))].sort() };
}
const feature = name => ({ feature: name });
const all = (...names) => ({ all: names.map(feature) });
const COUNTER = { any: [feature('foodStem'), feature('peerKillingCombination')] };
const RULES = [
  { id: 'resource-duty', condition: all('jiaDay', 'wealthStem', 'officerStem'), label: '성과·자원과 기준·책임의 연결' },
  { id: 'resource-demand', condition: all('jiaDay', 'wealthStem', 'killingStem'), counter: COUNTER, label: '성과·자원 확대에 따른 과제 증가' },
  { id: 'food-response', condition: all('jiaDay', 'wealthStem', 'killingStem', 'foodStem'), label: '과제 증가와 직접 실행을 통한 대응의 공존' },
  { id: 'peer-response', condition: all('jiaDay', 'wealthStem', 'killingStem', 'peerKillingCombination'), label: '과제 증가와 협업·역할 조율의 공존' },
];

export function compareWorkCandidates(features) {
  return RULES.map(rule => {
    const condition = evaluateCondition(rule.condition, features);
    const counter = rule.counter ? evaluateCondition(rule.counter, features) : null;
    const status = condition.value === 0 ? 'inapplicable' : condition.value === null ? 'withheld'
      : counter?.value === 1 ? 'weakened' : counter?.value === null ? 'withheld' : 'selected';
    return { id: rule.id, label: rule.label, status, condition, counter };
  });
}
/** One app-owned question per comparison mode; feedback revision reuses the same text. */
export const WORK_QUESTIONS = Object.freeze({
  'scope-withheld': '현실에서는 결과·자원을 관리하는 일과 기준·책임을 맡는 일이 함께 이어졌나요, 따로였나요?',
  'food-response': '성과나 자원을 늘리는 과정에서 직접 만들거나 실행한 방식이 늘어난 과제를 다루는 데 도움이 된 경험이 있나요?',
  'peer-response': '성과나 자원을 늘리는 과정에서 다른 사람과 역할을 조율한 것이 늘어난 과제를 다루는 데 도움이 된 경험이 있나요?',
  'competing': '성과나 자원을 늘린 일이 정해진 책임을 수행하는 데 쓰였나요, 새로운 과제를 더 맡았나요, 둘 다였거나 어느 쪽도 아니었나요?',
  'resource-duty': '성과나 자원을 관리하는 일이 정해진 기준·책임을 수행하는 데 도움이 된 경험이 있나요?',
  'resource-demand': '성과나 자원을 늘린 일이 해결해야 할 요구·과제도 함께 늘린 경험이 있나요?',
});
const POSITION = { year: '연간', month: '월간', hour: '시간' };
const POS_KR = { year: '년', month: '월', hour: '시' };
const markerText = m => `${POSITION[m.position]} ${m.character}(${m.tenGod})`;
export const WORK_CANDIDATE_LIMIT = '갑목 일간의 원국 천간을 비교한 해석 가설이에요. 지장간·강약·합화의 실제 작용과 운의 시기는 아직 종합하지 않았고, 직업 적성·성공·개인 사건을 확정하지 않아요.';

/** Context markers come from the complete chart; no user-supplied conclusions. */
export function buildWorkDecision(chart, { stems, groups }) {
  if (chart.pillarsIdx.day % 10 !== 0) return null;
  const has = god => stems.some(m => m.tenGod === god);
  const wealth = stems.filter(m => ['정재', '편재'].includes(m.tenGod));
  const authority = stems.filter(m => ['정관', '편관'].includes(m.tenGod));
  const combinations = detectRelations(chart.pillarsIdx).stemHap.filter(r => {
    const participants = stems.filter(m => r.positions.includes(POS_KR[m.position]));
    return participants.length === 2 && participants.some(m => m.tenGod === '겁재') && participants.some(m => m.tenGod === '편관');
  });
  const features = { jiaDay: 1, wealthStem: +!!wealth.length, officerStem: +has('정관'), killingStem: +has('편관'),
    foodStem: +has('식신'), peerKillingCombination: +!!combinations.length };
  const candidates = compareWorkCandidates(features);
  const selectedIds = candidates.filter(c => c.status === 'selected').map(c => c.id);
  const applicable = groups['재성'].status !== 'absent' && groups['관성'].status !== 'absent';
  const scopeOnly = applicable && !selectedIds.length;
  const active = applicable;
  const mode = !active ? 'outside-bundle' : scopeOnly ? 'scope-withheld'
    : selectedIds.length > 1 ? 'competing' : selectedIds[0];
  const markerFacts = [...wealth, ...authority, ...stems.filter(m => ['식신','겁재'].includes(m.tenGod))];
  const facts = markerFacts.length ? `천간에서 확인한 글자는 ${markerFacts.map(markerText).join(', ')}이에요.` : '이 해석 묶음에 필요한 재성·관성의 천간 조합은 보이지 않아요.';
  let interpretation, reason, alternative, prompt;
  if (scopeOnly) {
    interpretation = '재성·관성 주제는 원국에 있지만, 천간끼리의 관계로 설명하는 후보는 보류해요.';
    reason = `재성은 ${wealth.length ? wealth.map(markerText).join(', ') : '천간에 없고 지지 본기·지장간에만'}, 관성은 ${authority.length ? authority.map(markerText).join(', ') : '천간에 없고 지지 본기·지장간에만'} 보여서 이번 후보의 자리 조건을 모두 충족하지 않아요.`;
    alternative = '지지의 다른 읽기 방법까지 틀렸다는 뜻은 아니에요. 원래의 자리 관찰은 유지하되, 천간과 지지를 섞어 재생관·재생살의 성립으로 옮기지 않아요.';
    prompt = WORK_QUESTIONS['scope-withheld'];
  } else if (mode === 'food-response') {
    interpretation = '성과·자원을 늘리는 일이 과제를 늘릴 가능성과, 직접 만들고 실행하는 방식으로 그 과제를 다룰 가능성을 함께 읽어요.';
    reason = '재성·편관과 함께 천간의 식신이 있어, 과제 증가만 보던 후보를 낮추고 실행을 통한 대응 후보를 먼저 비교해요.';
    alternative = '식신이 있다는 사실만으로 문제가 해결된 것은 아니에요. 실행이 부담을 줄인 경우와 오히려 일을 늘린 경우를 구분해야 해요.';
    prompt = WORK_QUESTIONS['food-response'];
  } else if (mode === 'peer-response') {
    interpretation = '성과·자원을 늘리는 일이 과제를 늘릴 가능성과, 다른 사람과 역할을 조율하며 그 과제를 다룰 가능성을 함께 읽어요.';
    reason = '재성·편관과 함께 겁재·편관의 천간합이 관찰돼, 과제 증가만 보던 후보를 낮추고 협업·역할 조율 후보를 먼저 비교해요.';
    alternative = '합이 편관을 없애거나 갈등을 해결했다는 판단은 아니에요. 협업이 부담을 줄인 경우와 늘린 경우를 나눠 확인해야 해요.';
    prompt = WORK_QUESTIONS['peer-response'];
  } else if (mode === 'competing') {
    interpretation = '성과·자원을 기준·책임으로 연결하는 방향과, 새 과제를 더 맡는 방향을 함께 후보로 남겨요.';
    reason = '천간에 재성·정관·편관이 함께 있어 정관 쪽 연결과 편관 쪽 연결 중 하나만 우선한다고 정할 수 없어요.';
    alternative = '정관·편관의 공존만으로 관살혼잡의 과강이나 실제 부담을 확정하지 않아요. 맡은 일의 성격에 따라 두 후보를 비교해야 해요.';
    prompt = WORK_QUESTIONS['competing'];
  } else if (mode === 'resource-duty') {
    interpretation = '성과·자원을 관리하는 일이 정해진 기준·책임을 수행하는 쪽으로 이어질 수 있다는 가설을 먼저 살펴요.';
    reason = '천간의 재성과 정관이 함께 있어, 편관에 관한 과제 증가 후보와 구분해 이 연결을 골랐어요.';
    alternative = '두 글자가 있다는 이유로 직장 적성이나 안정적인 성과를 정하지 않아요. 자원과 책임이 따로 움직인 경험도 대안으로 남아요.';
    prompt = WORK_QUESTIONS['resource-duty'];
  } else if (mode === 'resource-demand') {
    interpretation = '성과·자원을 늘리는 일이 해결해야 할 요구·과제도 함께 늘릴 수 있다는 가설을 먼저 살펴요.';
    reason = '천간의 재성과 편관이 함께 있고, 이번에 비교하는 식신 또는 겁재·편관 합의 대응 조건은 천간에서 확인되지 않아요.';
    const hurting = stems.filter(m => m.tenGod === '상관');
    if (hurting.length) reason += ` ${hurting.map(markerText).join(', ')}은 상관이므로 이번 식신 조건에 해당하지 않아요.`;
    alternative = '대응 조건이 안 보인다는 말은 실제 해결 능력이 없다는 뜻이 아니에요. 부담이 늘지 않았거나 다른 방식으로 해결한 경험이면 이 후보를 낮춰야 해요.';
    prompt = WORK_QUESTIONS['resource-demand'];
  }
  const question = active ? { id: `work-candidate-${mode}`, prompt,
    clarifies: '선택한 해석 가설의 경험상 일치·반대·경험 없음·미응답; 자기보고는 독립 적중률이 아님' } : null;
  return { policy: 'jia-stem-resource-authority-v1', scope: 'jia-day-natal-stems',
    assumption: 'reviewed generation_planes examples, finite stem-presence comparison; observed relations are not verified personal effects',
    sourceClaimIds: ['generation_definition', 'generation_planes'], features, candidates, selectedIds,
    active, mode, facts, interpretation: interpretation ?? null, reason: reason ?? null, alternative: alternative ?? null,
    lines: active ? [interpretation, facts, reason, alternative, WORK_CANDIDATE_LIMIT] : [], question,
    beforeFeedback: true, probability: null, trainingEligible: false };
}

/** Exact short answers the app offers; free sentences are read in workFeedback.js. */
export const EXPLICIT_ANSWERS = new Map([
  ['맞아요', 'supported'], ['네', 'supported'], ['반대예요', 'contradicted'],
  ['경험이 없어요', 'no-experience'], ['경험 없어요', 'no-experience'], ['말하고 싶지 않아요', 'unanswered'], ['답하지 않을래요', 'unanswered'],
]);

/** PR227 exact-answer contract, kept for its regression test. The app now reads
 * answers through workFeedback.js (resolveWorkFeedback), which reuses EXPLICIT_ANSWERS. */
export function reviseWorkDecision(decision, answer) {
  if (!decision?.active || !decision.question || ['scope-withheld','competing'].includes(decision.mode)) return null;
  const status = typeof answer === 'string' ? EXPLICIT_ANSWERS.get(answer.trim().replace(/[.!。!]+$/u, '').trim()) : undefined;
  if (!status) return null;
  const text = status === 'supported'
    ? '말해 준 경험의 범위에서는 앞의 후보를 유지해요. 처음부터 명식만으로 맞힌 것으로 세지는 않아요.'
    : status === 'contradicted'
      ? `말해 준 반대 경험을 반영해 앞의 ‘${decision.candidates.find(c => c.id === decision.selectedIds[0]).label}’ 후보를 낮춰요. ${decision.alternative}`
      : status === 'no-experience' ? '그 경험이 없으므로 앞의 후보를 개인에게 적용하는 판단은 보류해요. 경험 없음은 반대 경험이나 능력 부족과 달라요.'
        : '답하지 않은 상태로 남겨 둘게요. 앞의 후보는 확인되지 않았고, 동의하거나 반대한 것으로 처리하지 않아요.';
  return { status, before: { selectedIds: [...decision.selectedIds], interpretation: decision.interpretation },
    after: status === 'supported' ? 'retained-as-self-report' : status === 'contradicted' ? 'weakened' : 'withheld',
    text, probability: null, trainingEligible: false };
}
