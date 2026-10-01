// Explicit revision of the close-relationship reading (relationCandidates.js) from a visible conversation.
// References/assumptions: docs/knowledge-model/CONDITIONAL_RELATION_READING.md.
// The same precision-first short answers as the temperament reading (temperamentFeedback.js), except that words about
// a relationship belong to these answers. One clarifying question at most; nothing is stored, learned or scored.
import { readShortAnswer, isBareMenuAnswer, quoted } from './temperamentFeedback.js';
import { RELATION_NAMES } from './relationCandidates.js';

const norm = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const SENTENCE = /(?<=[.?!…])\s+/;
// Other topics and closing words go to chat; relationship words (연애·배우자 …) do not.
const RELATION_OTHER_TOPIC = /건강|올해|내년|운세|재물|궁합|이직|직업|성격|알겠|감사|고마워|고맙|계속\s*해/u;
// Questions with a named opposite (‘반대예요’ = the other warmth reading).
const REVERSIBLE = new Set(['near-warm', 'near-firm', 'near-mixed']);

/** Reads one answer to the shown relationship question. Returns null for normal chat. */
export function readRelationAnswer(answer, { reversible = false } = {}) {
  return readShortAnswer(answer, { reversible, otherTopic: RELATION_OTHER_TOPIC });
}

const NOT_A_HIT = '경험을 들은 뒤 고친 풀이라 처음 풀이의 적중으로 세지 않아요.';
const OUTSIDE = '배우자 자리의 충, 배우자 별의 역할(덕), 운의 시기는 아직 이 비교에 합치지 않았어요. 궁금한 점을 직접 물어보면 이어서 볼게요.';
const FIRM_FIRST = '다정한 표현보다 각자의 기준과 역할이 먼저';

/** The question plan of a relationship reading: the shown question, and the complementary question asked once when
 * the first answer is no (the near readings only). */
export function relationPlan(decision) {
  if (!decision?.active || !decision.question) return null;
  const first = { id: decision.question.id, prompt: decision.question.prompt, candidate: decision.mode, name: RELATION_NAMES[decision.mode] };
  const followup = decision.followup ? { ...decision.followup, name: RELATION_NAMES[decision.followup.candidate] } : null;
  return { mode: decision.mode, first, followup };
}

/** Prompts this plan may ask; a provider reply must not re-ask them as its own. */
export function ownedRelationPrompts(decision) {
  const plan = relationPlan(decision);
  return plan ? [plan.first.prompt, ...(plan.followup ? [plan.followup.prompt] : [])] : [];
}

const WITHHELD = {
  unsure: name => `확실하지 않다면 ${name}는 확인되지 않은 가설로 둘게요.`,
  unanswered: name => `답하지 않은 상태로 남겨 둘게요. ${name}는 확인되지 않은 가설로 두고, 동의하거나 반대한 것으로 처리하지 않아요.`,
};
const SCOPED = name => `고친 풀이: ${name}가 맞는 때와 맞지 않는 때가 함께 있다고 좁혀 읽어요. 두 경우를 가르는 조건은 명식이 아니라 말해 준 경험에서 왔어요.`;
const ASK_NOTE = {
  'near-bonded': '다정한 마음은 오가는지 하나만 물을게요.',
  'near-bridged': '그 반대 경우인지 하나만 물을게요.',
  'near-warm': '다정함 대신 기준과 역할이 먼저인지 하나만 물을게요.',
  'near-firm': '그 반대인지 하나만 물을게요.',
  'near-mixed': '다정함 대신 기준과 역할이 먼저인지 하나만 물을게요.',
};
// What the shown answer turns into: the other warmth reading (first ‘반대예요’ or a ‘yes’ to the complementary question).
const SWITCHED = {
  'near-warm': `고친 풀이: ${FIRM_FIRST}라고 했어요. 음양이 조화되는 별로 다정함을 읽은 가정을 낮추고, 기준과 역할이 먼저 서는 쪽으로 고쳐 읽어요. 가까운 자리에 있다는 부분은 이 답만으로 정하지 못해요. ${NOT_A_HIT}`,
  'near-firm': `고친 풀이: 다정한 말과 마음 표현이 자연스럽게 오간다고 했어요. 음양이 같은 별이라 다정함이 덜하다고 읽은 가정을 낮추고, 다정함이 오가는 쪽으로 고쳐 읽어요. ${NOT_A_HIT}`,
  'near-mixed': `고친 풀이: ${FIRM_FIRST}라고 했어요. 곁에 있는 두 별 가운데 일간과 음양이 같은 별 쪽으로 좁혀 읽어요. ${NOT_A_HIT}`,
  'near-bonded': `고친 풀이: 마음을 묶어 함께 꾸려 가는 것까지는 아니어도 다정한 마음은 오간다고 했어요. 합으로 묶인다고 읽은 부분을 낮추고, 다정함이 오가는 쪽으로만 읽어요. ${NOT_A_HIT}`,
  'near-bridged': `고친 풀이: 가까운 사람의 말과 행동에 예민하게 부딪히는 일이 잦다고 했어요. 인성이 편관과 일간 사이를 이어 준다고 본 가정을 낮추고, 편관의 압박이 그대로 느껴지는 쪽으로 고쳐 읽어요. ${NOT_A_HIT}`,
};
const NEITHER = {
  'near-warm': `고친 풀이: 다정함이 자연스럽게 오가지도, 기준과 역할이 먼저 서지도 않는다고 했어요. 배우자 별의 음양으로 관계의 온도를 읽은 부분을 낮춰요. 어떤 방식인지는 이 비교로 정하지 못해요. ${OUTSIDE}`,
  'near-firm': `고친 풀이: 기준과 역할이 먼저 서지도, 다정함이 자연스럽게 오가지도 않는다고 했어요. 배우자 별의 음양으로 관계의 온도를 읽은 부분을 낮춰요. 어떤 방식인지는 이 비교로 정하지 못해요. ${OUTSIDE}`,
  'near-mixed': `고친 풀이: 다정함이 먼저도, 기준과 역할이 먼저도 아니라고 했어요. 곁에 있는 두 별의 음양으로 관계의 온도를 읽은 부분을 낮춰요. 어떤 방식인지는 이 비교로 정하지 못해요. ${OUTSIDE}`,
  'near-bonded': `고친 풀이: 마음을 묶어 함께 꾸려 가지도, 다정한 표현이 자연스럽게 오가지도 않는다고 했어요. 곁에서 합하는 별로 가까움과 온도를 읽은 부분을 낮춰요. 왜 그런지는 이 비교로 정하지 못해요. ${OUTSIDE}`,
  'near-bridged': `고친 풀이: 서로 믿고 기대지도, 예민하게 자주 부딪히지도 않는다고 했어요. 월간 편관과 인성으로 관계를 읽은 부분을 낮춰요. 어떤 방식인지는 이 비교로 정하지 못해요. ${OUTSIDE}`,
};
const LOWERED = {
  far: `고친 풀이: 가까운 사람과 생활을 붙여 지낸다고 했어요. 배우자의 별이 먼 자리에만 있다는 것으로 거리를 읽은 부분을 낮춰요. 왜 가깝게 이어졌는지는 이 비교로 정하지 못해요. ${OUTSIDE}`,
  hidden: `고친 풀이: 가까운 관계에 대한 마음을 겉으로 표현한다고 했어요. 지장간 속 별로 속마음에 머문다고 읽은 부분을 낮춰요. 왜 그런지는 이 비교로 정하지 못해요. ${OUTSIDE}`,
  absent: `고친 풀이: 가까운 사람 앞에서는 평소와 다른 모습이 된다고 했어요. 배우자 자리인 일지의 모습을 그대로 보인다고 읽은 부분을 낮춰요. 어떤 모습인지는 이 비교로 정하지 못해요. ${OUTSIDE}`,
};

/** What one applied answer does: feedback statuses, the status line, the revised reading and whether to ask the
 * complementary question next. */
function revision(plan, pending, kind) {
  const { mode } = plan, question = pending === 'first' ? plan.first : plan.followup;
  const name = `‘${question.name}’`;
  if (WITHHELD[kind]) return { feedback: { [question.candidate]: 'withheld' }, status: WITHHELD[kind](name), core: null };
  if (kind === 'mixed') return { feedback: { [question.candidate]: 'scoped' }, status: `때에 따라 달랐다는 답으로 볼게요. 맞는 때에는 ${name}를 유지하고, 그렇지 않은 때에는 낮춰요.`, core: SCOPED(name) };
  if (pending === 'first' && mode === 'near-mixed') {
    // The mixed reading chose neither warmth: the first answer narrows it to one side instead of keeping or lowering it.
    if (kind === 'supported') return { feedback: { [mode]: 'narrowed', 'near-warm': 'retained-as-self-report' }, status: null,
      core: `고친 풀이: 다정한 말과 마음 표현이 먼저 오간다고 했어요. 곁에 있는 두 별 가운데 일간과 음양이 조화되는 별 쪽으로 좁혀 읽어요. ${NOT_A_HIT}` };
    const status = '말해 준 답을 반영해 다정함이 먼저라는 쪽은 낮춰요.';
    if (kind === 'reversed') return { feedback: { [mode]: 'narrowed', 'near-warm': 'weakened', 'near-firm': 'retained-as-self-report' }, status, core: SWITCHED[mode] };
    return { feedback: { [mode]: 'narrowed', 'near-warm': 'weakened' }, status, core: null, ask: true, note: ASK_NOTE[mode] };
  }
  if (pending === 'first') {
    if (kind === 'supported') return { feedback: { [mode]: 'retained-as-self-report' }, status: `말해 준 경험 범위에서 ${name}를 유지해요. 처음부터 명식만으로 맞힌 것으로 세지는 않아요.`, core: null };
    const status = `말해 준 답을 반영해 ${name}를 낮춰요.`;
    if (kind === 'reversed') return { feedback: { [mode]: 'weakened', [plan.followup.candidate]: 'retained-as-self-report' }, status, core: SWITCHED[mode] };
    if (plan.followup) return { feedback: { [mode]: 'weakened' }, status, core: null, ask: true, note: ASK_NOTE[mode] };
    return { feedback: { [mode]: 'weakened' }, status, core: LOWERED[mode] };
  }
  return kind === 'supported'
    ? { feedback: { [question.candidate]: 'retained-as-self-report' }, status: null, core: SWITCHED[mode] }
    : { feedback: { [question.candidate]: 'weakened' }, status: null, core: NEITHER[mode] };
}

function clarifyText(read, plan, pending) {
  const reverse = pending !== 'first' || !REVERSIBLE.has(plan.mode) ? ''
    : plan.mode === 'near-firm' ? ' 반대로 다정한 표현이 자연스럽게 오간다면 ‘반대예요’라고 해도 돼요.'
      : ` 반대로 ${FIRM_FIRST}라면 ‘반대예요’라고 해도 돼요.`;
  return `${quoted(read.text)} 답은 한 방향으로 정확히 읽기 어려워요. 그렇다면 ‘맞아요’, 아니라면 ‘아니에요’, 때에 따라 달랐다면 ‘때에 따라 달라요’라고 답해 주세요.${reverse}`;
}

const beforeOf = decision => ({ policy: decision.policy, scope: decision.scope, mode: decision.mode, selectedIds: [...decision.selectedIds],
  interpretation: decision.interpretation, candidates: decision.candidates.map(c => ({ id: c.id, status: c.status })) });
const result = (base, feedback, fields) => ({ ...base, ...fields, feedback: { ...feedback }, probability: null, trainingEligible: false });
const OFFERED = ['supported', 'contradicted', 'mixed', 'unsure', 'unanswered', 'reversed'];

/** Applies one answer to the pending question. Pure; returns the next state. */
export function advanceRelationFeedback(decision, plan, state, answer, { afterMenu = false } = {}) {
  const question = state.pending === 'first' ? plan.first : state.pending === 'followup' ? plan.followup : null;
  if (!question) return null;
  let read = readRelationAnswer(answer, { reversible: REVERSIBLE.has(plan.mode) && state.pending === 'first' });
  if (!read) return null;
  if (afterMenu && isBareMenuAnswer(read)) return null;
  if (state.clarify && !OFFERED.includes(read.kind)) read = { ...read, kind: 'clarify:unclear' };
  const base = { questionId: question.id, targetCandidateId: question.candidate, answer: read,
    before: { questionId: question.id, targetCandidateId: question.candidate, reading: state.reading, feedback: { ...state.feedback } },
    beforeFeedback: beforeOf(decision) };
  if (read.kind.startsWith('clarify:')) {
    if (state.clarify) {
      const feedback = { ...state.feedback, [question.candidate]: 'unconfirmed' };
      return result(base, feedback, { action: 'unresolved', after: 'unconfirmed', nextQuestion: null, revisedInterpretation: null, note: null,
        text: `구분할 수 있는 답을 얻지 못해 ‘${question.name}’는 확인되지 않은 상태로 둘게요. 같은 질문은 다시 묻지 않아요.`,
        state: { ...state, pending: null, clarify: null, feedback } });
    }
    return result(base, state.feedback, { action: 'clarify', after: 'pending', nextQuestion: null, revisedInterpretation: null, note: null,
      text: clarifyText(read, plan, state.pending), state: { ...state, clarify: read.kind } });
  }
  const { feedback: gained, status, core, ask, note } = revision(plan, state.pending, read.kind);
  const feedback = { ...state.feedback, ...gained };
  const next = ask ? plan.followup : null; // only the first question asks it, once per shown question
  const heard = read.kind === 'mixed' ? `${quoted(read.text)} 답은 때에 따라 달랐다는 뜻으로 읽었어요.`
    : read.kind === 'reversed' ? `${quoted(read.text)} 답은 앞의 풀이와 반대라는 뜻으로 읽었어요.` : null;
  const text = [heard, status, core, next ? note : null, next?.prompt].filter(Boolean).join('\n\n');
  const after = feedback[question.candidate] ?? 'withheld';
  return result(base, feedback, { action: 'revise', after, revisedInterpretation: core, note: next ? note : null,
    nextQuestion: next ? { id: next.id, prompt: next.prompt, targetCandidateId: next.candidate } : null, text,
    state: { ...state, pending: next ? 'followup' : null, clarify: null, feedback, reading: core ?? state.reading,
      asked: next ? [...state.asked, next.id] : state.asked } });
}

/** Replays the visible conversation from the latest shown relationship question (the temperament replay contract):
 * every earlier answer must have been answered locally and shown completely; any other assistant text leaves the
 * answer to chat. The menu prompt may sit between a shown question and its answer; a bare yes/no after it is chat. */
export function resolveRelationFeedback({ decision, footer = '', messages, answer, menuPrompts = [] }) {
  const plan = relationPlan(decision);
  if (!plan || !Array.isArray(messages) || typeof answer !== 'string') return null;
  const start = messages.findLastIndex(m => m?.role === 'assistant' && norm(m.text) === norm(plan.first.prompt));
  if (start < 0) return null;
  const owned = new Set([footer, ...String(footer).split(SENTENCE)].map(norm).filter(Boolean));
  const menus = new Set(menuPrompts.map(norm));
  let i = start + 1, afterMenu = false;
  while (i < messages.length && messages[i].role === 'assistant' && owned.has(norm(messages[i].text))) i++;
  const skipMenu = () => { while (i < messages.length && messages[i].role === 'assistant' && menus.has(norm(messages[i].text))) { afterMenu = true; i++; } };
  skipMenu();
  let state = { pending: 'first', clarify: null, feedback: {}, reading: decision.interpretation, asked: [decision.question.id] };
  while (i < messages.length) {
    if (messages[i].role !== 'user' || !state.pending) return null;
    const next = advanceRelationFeedback(decision, plan, state, messages[i].text, { afterMenu });
    if (!next) return null;
    let j = i + 1;
    const shown = [];
    while (j < messages.length && messages[j].role === 'assistant' && !menus.has(norm(messages[j].text))) shown.push(messages[j++].text);
    if (norm(shown.join(' ')) !== norm(next.text)) return null;
    state = next.state;
    i = j;
    afterMenu = false;
    skipMenu();
  }
  if (!state.pending) return null;
  return advanceRelationFeedback(decision, plan, state, answer, { afterMenu });
}
