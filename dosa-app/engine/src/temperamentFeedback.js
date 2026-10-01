// Explicit revision of the basic temperament reading (temperamentCandidates.js) from a visible conversation.
// References/assumptions: docs/knowledge-model/CONDITIONAL_TEMPERAMENT_READING.md.
// Precision first: a short answer changes the reading only when every clause is one of a few whole-clause forms
// (yes, no, the opposite, at some times, not sure, rather not say). Other answers with a cue get one clarifying
// question; questions, other topics and cue-less text go to normal chat. Nothing is stored, learned or scored.
import { answerClauses, MAX_FEEDBACK_ANSWER } from './workFeedback.js';
import { TEMPERAMENT_NAMES, TEMPERAMENT_TRAITS } from './temperamentCandidates.js';

const norm = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const bare = text => norm(text).replace(/(?:^|\s)[ㅋㅎㅠㅜ]{2,}(?=\s|$)/gu, ' ').replace(/[.!。!~…]+$/u, '').trim();
const SENTENCE = /(?<=[.?!…])\s+/;

// ── Whole-clause forms. An optional lead adverb; the clause must end where the form ends.
const LEAD = '(?:(?:정말|진짜|완전|확실히|대체로|거의|꽤|좀|많이|조금|어느\\s*정도|대부분|보통|평소에?(?:도|는)?|저는|저도|제가)\\s*)?';
const whole = body => new RegExp(`^${LEAD}(?:${body})$`, 'u');
const FORMS = {
  decline: /^(?:말하고\s*싶지\s*않아요|말하기\s*싫어요?|답하지\s*않을래요|답하기\s*싫어요|대답하기\s*싫어요|패스(?:할게요|할래요|요)?|넘어갈게요|넘어갈래요|노코멘트|비밀이에요)$/u,
  unsure: /^(?:(?:잘\s*)?모르겠(?:어요|어|습니다|네요)|잘\s*모르겠는데요|(?:잘\s*)?몰라(?:요)?|모름|글쎄요|생각해\s*본\s*적(?:이)?\s*없어요|헷갈려요)$/u,
  partial: whole([
    '(?:때에?|상황에|경우에|사람에)\\s*따라(?:서)?\\s*(?:달라요|달랐어요|다르죠|다른\\s*것\\s*같아요|다르게\\s*나와요|그래요|요)?',
    '그때그때\\s*(?:달라요|다르죠|요)?', '반반(?:이에요|이요|요)?', '가끔(?:요|은요|\\s*그래요|은\\s*그래요)?', '어떤\\s*때는\\s*그래요',
  ].join('|')),
  reversed: /^(?:(?:오히려|완전)\s*)?반대(?:예요|에요|였어요|입니다|야|로요|인\s*것\s*같아요)$/u,
  negative: whole([
    '아니요|아니오|아뇨|아니|아니에요|아닌데요|아닌\\s*것\\s*같아요|아닙니다|안\\s*맞아요',
    '그렇지(?:는)?\\s*않아요|그렇진\\s*않아요|안\\s*그래요|잘\\s*안\\s*그래요|별로(?:요)?|별로\\s*(?:안\\s*그래요|그렇지\\s*않아요)|딱히(?:요)?|딱히\\s*안\\s*그래요',
    '(?:그런\\s*적(?:은|이)?\\s*)?없(?:어요|었어요|습니다)|그렇게\\s*안\\s*느껴요|그렇게\\s*느낀\\s*적(?:은|이)?\\s*없어요',
  ].join('|')),
  affirm: whole([
    '네|넵|예|응|맞아요|맞아|맞습니다|맞죠|맞는\\s*(?:것\\s*)?같아요',
    '그래요|그렇죠|그렇습니다|그랬어요|그런\\s*편이(?:에요|죠|예요|요)|그런\\s*편입니다|그런\\s*것\\s*같아요|그렇게\\s*느껴요|그렇게\\s*느꼈어요',
    '(?:그런\\s*적(?:이)?\\s*)?(?:있어요|있었어요|많아요|많았어요)|자주\\s*(?:그래요|있어요|있었어요)',
  ].join('|')),
  filler: /^(?:음+|흠+|글쎄|사실|솔직히|그러니까|제\s*생각엔)$/u,
};
const ASKING = /[?？]|까요|나요|어때|어떨|알려\s*주|알려줘|봐\s*주|봐줘|궁금|언제|어떻게|(?:^|\s)왜|뭐예요|뭔가요|인가요|건가요|무슨\s*뜻/u;
const OTHER_TOPIC = /연애|남편|아내|배우자|남친|여친|애인|건강|올해|내년|운세|재물|궁합|결혼|이직|알겠|감사|고마워|고맙|계속\s*해/u;
const CUE = /맞|아니|그래|그렇|반대|모르|편이|때|가끔|자주|느껴|느꼈|겉|속|드러|보여|보이|별로|딱히|없|있/u;
const TAGS = ['decline', 'unsure', 'partial', 'reversed', 'negative', 'affirm', 'filler'];
// A bare yes/no could answer the chat's menu line (‘또 궁금한 것이 있는가?’); ‘그런 편이에요’·‘별로요’ answer the question.
const BARE = /^(?:네|넵|예|응|맞아요|맞아|맞습니다|맞죠|그래요|아니요|아니오|아뇨|아니|아니에요|아닙니다|있어요|없어요)$/u;
// A leading hesitation word does not change the clause ('음 잘 모르겠어요').
const LEAD_FILLER = /^(?:음+|흠+|어+|아+|글쎄|사실|솔직히)\s+(?=\S)/u;
const tagOf = core => { const c = bare(core).replace(LEAD_FILLER, ''); return TAGS.find(t => FORMS[t].test(c)) ?? null; };

/** Reads one short answer to a shown yes/no question. `reversible`: the question has a named opposite, so ‘반대예요’
 * is its own answer; elsewhere it means no. `otherTopic`: words that move the talk to another topic (the 관계 topic
 * reads relationship words as part of its answers). Returns null for normal chat. */
export function readShortAnswer(answer, { reversible = false, otherTopic = OTHER_TOPIC } = {}) {
  if (typeof answer !== 'string') return null;
  const text = norm(answer);
  if (!text || text.length > MAX_FEEDBACK_ANSWER || ASKING.test(text) || otherTopic.test(text)) return null;
  const segments = answerClauses(text).map(clause => ({ ...clause, tag: tagOf(clause.core) }));
  if (!segments.length) return null;
  const result = kind => ({ kind, text, segments });
  const tags = new Set(segments.map(s => s.tag));
  if (tags.has(null)) return CUE.test(text) ? result('clarify:unclear') : null;
  tags.delete('filler');
  if (!tags.size) return null;
  if (/\.{2,}|…/u.test(text) && !tags.has('decline') && !tags.has('unsure')) return null; // hesitation
  const only = [...tags];
  if (only.length === 1) return result({ decline: 'unanswered', unsure: 'unsure', partial: 'mixed', negative: 'contradicted', affirm: 'supported',
    reversed: reversible ? 'reversed' : 'contradicted' }[only[0]]);
  if (tags.has('partial') && only.every(t => ['partial', 'affirm', 'negative'].includes(t))) return result('mixed');
  if (tags.has('reversed') && only.every(t => ['reversed', 'negative'].includes(t))) return result(reversible ? 'reversed' : 'contradicted');
  return result('clarify:unclear');
}

/** Reads one answer to the shown temperament question; the inside/outside question is reversible. */
export function readTemperamentAnswer(answer, { reversible = false } = {}) {
  return readShortAnswer(answer, { reversible });
}

/** After the menu question a bare yes/no may answer the menu, not the owned question. */
export function isBareMenuAnswer(read) {
  return read.segments.every(s => s.tag === 'filler' || (['affirm', 'negative'].includes(s.tag) && BARE.test(bare(s.core).replace(LEAD_FILLER, ''))));
}

const NOT_A_HIT = '경험을 들은 뒤 고친 풀이라 처음 풀이의 적중으로 세지 않아요.';
const OUTSIDE = '월간·시간·연주와 운의 시기는 아직 이 비교에 합치지 않았어요. 궁금한 점을 직접 물어보면 이어서 볼게요.';
const look = god => `‘${TEMPERAMENT_TRAITS[god]} 모습’`;
const flat = text => bare(text).replace(/[.?!…。！？]+\s+/gu, ', ');
const clip = text => { const chars = Array.from(flat(text)); return chars.length > 60 ? `${chars.slice(0, 59).join('')}…` : chars.join(''); };
const lastHasFinal = text => { const code = (Array.from(bare(text).replace(/[’'"”)\]]+$/u, '')).at(-1) ?? '').charCodeAt(0) - 0xac00; return code >= 0 && code <= 11171 && code % 28 !== 0; };
export const quoted = text => { const shown = clip(text); return `‘${shown}’${lastHasFinal(shown) ? '이라는' : '라는'}`; };

/** The question plan of a temperament reading: the shown question, and the complementary question asked once
 * when the first answer is no (inside/outside readings only). */
export function temperamentPlan(decision) {
  if (!decision?.active || !decision.question) return null;
  const A = look(decision.pattern.god), B = look(decision.dayMain.god);
  const first = { id: decision.question.id, prompt: decision.question.prompt, candidate: decision.mode, name: TEMPERAMENT_NAMES[decision.mode] };
  const followup = decision.followup ? { ...decision.followup, name: TEMPERAMENT_NAMES[decision.followup.candidate] } : null;
  return { mode: decision.mode, A, B, first, followup };
}

/** Prompts this plan may ask; a provider reply must not re-ask them as its own. */
export function ownedTemperamentPrompts(decision) {
  const plan = temperamentPlan(decision);
  return plan ? [plan.first.prompt, ...(plan.followup ? [plan.followup.prompt] : [])] : [];
}

const WITHHELD = {
  unsure: name => `확실하지 않다면 ${name}는 확인되지 않은 가설로 둘게요.`,
  unanswered: name => `답하지 않은 상태로 남겨 둘게요. ${name}는 확인되지 않은 가설로 두고, 동의하거나 반대한 것으로 처리하지 않아요.`,
};
const SCOPED = name => `고친 풀이: ${name}가 맞는 때와 맞지 않는 때가 함께 있다고 좁혀 읽어요. 두 경우를 가르는 조건은 명식이 아니라 말해 준 경험에서 왔어요.`;

/** What one applied answer does: feedback statuses, the status line, the revised reading and whether to ask the
 * complementary question next. */
function revision(plan, pending, kind) {
  const { mode, A, B } = plan, question = pending === 'first' ? plan.first : plan.followup;
  const name = `‘${question.name}’`;
  if (WITHHELD[kind]) return { feedback: { [question.candidate]: 'withheld' }, status: WITHHELD[kind](name), core: null };
  if (kind === 'mixed') return { feedback: { [question.candidate]: 'scoped' }, status: `때에 따라 달랐다는 답으로 볼게요. 맞는 때에는 ${name}를 유지하고, 그렇지 않은 때에는 낮춰요.`, core: SCOPED(name) };
  if (pending === 'first') {
    if (kind === 'supported') return { feedback: { [mode]: 'retained-as-self-report' }, status: `말해 준 경험 범위에서 ${name}를 유지해요. 처음부터 명식만으로 맞힌 것으로 세지는 않아요.`, core: null };
    const status = `말해 준 답을 반영해 ${name}를 낮춰요.`;
    if (kind === 'reversed') return { feedback: { [mode]: 'weakened', 'pattern-outward': 'retained-as-self-report' }, status,
      core: `고친 풀이: 오히려 ${A}이 겉으로 보이고 ${B}이 속에 있다고 했어요. 월지의 바탕을 속마음에만 둔 가정을 낮추고, 바탕이 겉으로도 드러나는 쪽으로 고쳐 읽어요. 일지를 생활 태도로 읽은 부분이 맞는지는 이 답만으로 정하지 못해요. ${NOT_A_HIT}` };
    if (plan.followup) return { feedback: { [mode]: 'weakened' }, status, core: null, ask: true,
      note: mode === 'inner-outer' ? '월지의 바탕도 겉으로 보였는지 하나만 물을게요.' : '둘 중 어느 쪽이 겉으로 보였는지 하나만 물을게요.' };
    const core = {
      'peer-blocked': `고친 풀이: 스스로 정한 방향이 생활 속 기준·책임과 자주 부딪히지는 않았다고 했어요. 비겁 바탕과 일지의 관성을 부딪힘으로 읽은 부분을 낮추고, 두 자리는 원국 관찰로만 남겨요. 기준·책임이 오히려 방향을 잡아 줬는지, 부딪힐 일이 적었는지는 이 답만으로 정하지 못해요. ${OUTSIDE}`,
      'peer-flow': `고친 풀이: 하고 싶은 것이 평소 생활에서 바로 이어지지는 않았다고 했어요. 비겁 바탕이 일지의 표현·결과 쪽으로 이어진다는 부분을 낮추고, 두 자리는 원국 관찰로만 남겨요. 왜 이어지지 않았는지는 이 비교로 정하지 못해요. ${OUTSIDE}`,
      'one-direction': `고친 풀이: 속으로 바라는 것과 평소 사는 방식이 다르다고 했어요. 같은 계열이라 한 방향이라는 부분을 낮춰요. 어느 쪽이 겉이고 어느 쪽이 속인지는 월지·일지 비교만으로 정하지 못해요. ${OUTSIDE}`,
    }[mode];
    return { feedback: { [mode]: 'weakened' }, status, core };
  }
  // The complementary question (inside/outside readings).
  if (mode === 'inner-outer') return kind === 'supported'
    ? { feedback: { 'shown-together': 'retained-as-self-report' }, status: null,
      core: `고친 풀이: 월지의 바탕이 천간에 드러나지 않았는데도 ${A}이 겉으로도 보인다고 했어요. 드러났는지로 속과 겉을 나눈 가정을 낮추고, ${A}과 ${B}이 함께 보이는 쪽으로 고쳐 읽어요. ${NOT_A_HIT}` }
    : { feedback: { 'shown-together': 'weakened', 'month-pattern': 'weakened' }, status: null,
      core: `고친 풀이: ${A}은 속마음으로도 겉으로도 크게 느껴지지 않았다고 했어요. 월지의 바탕을 그렇게 읽은 부분을 낮추고, 일지의 ${B}인 생활 태도만 남겨요. 왜 그런지는 아직 합치지 않은 자리까지 봐야 해서 이 비교로는 정하지 못해요. ${OUTSIDE}` };
  return kind === 'supported'
    ? { feedback: { 'inner-outer': 'retained-as-self-report' }, status: null,
      core: `고친 풀이: 바탕이 천간에 드러나 있어도 ${A}은 속마음 쪽이고 겉으로는 ${B}이 주로 보인다고 했어요. 드러나면 곧 겉으로 보인다고 읽은 부분을 낮추고, 속과 겉을 나눠 읽는 쪽으로 고쳐요. ${NOT_A_HIT}` }
    : { feedback: { 'inner-outer': 'weakened' }, status: null,
      core: `고친 풀이: 두 모습이 함께 겉으로 드러난다는 풀이도, ${A}이 속에만 있다는 풀이도 맞지 않았다고 했어요. 겉으로 한쪽만 보이는지, 둘 다 잘 느껴지지 않는지는 이 비교로 정하지 못해요. ${OUTSIDE}` };
}

function clarifyText(read, plan, pending) {
  const reverse = plan.mode === 'inner-outer' && pending === 'first' ? ` 반대로 겉으로는 ${plan.A}, 속으로는 ${plan.B}이라면 ‘반대예요’라고 해도 돼요.` : '';
  return `${quoted(read.text)} 답은 한 방향으로 정확히 읽기 어려워요. 그렇다면 ‘맞아요’, 아니라면 ‘아니에요’, 때에 따라 달랐다면 ‘때에 따라 달라요’라고 답해 주세요.${reverse}`;
}

const beforeOf = decision => ({ policy: decision.policy, scope: decision.scope, mode: decision.mode, selectedIds: [...decision.selectedIds],
  interpretation: decision.interpretation, candidates: decision.candidates.map(c => ({ id: c.id, status: c.status })) });
const result = (base, feedback, fields) => ({ ...base, ...fields, feedback: { ...feedback }, probability: null, trainingEligible: false });
const OFFERED = ['supported', 'contradicted', 'mixed', 'unsure', 'unanswered', 'reversed'];

/** Applies one answer to the pending question. Pure; returns the next state. */
export function advanceTemperamentFeedback(decision, plan, state, answer, { afterMenu = false } = {}) {
  const question = state.pending === 'first' ? plan.first : state.pending === 'followup' ? plan.followup : null;
  if (!question) return null;
  let read = readTemperamentAnswer(answer, { reversible: plan.mode === 'inner-outer' && state.pending === 'first' });
  if (!read) return null;
  // After the menu question a bare yes/no may answer the menu, not the owned question.
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
    : read.kind === 'reversed' ? `${quoted(read.text)} 답은 겉과 속이 앞의 풀이와 반대라는 뜻으로 읽었어요.` : null;
  const text = [heard, status, core, next ? note : null, next?.prompt].filter(Boolean).join('\n\n');
  const after = feedback[question.candidate] ?? 'withheld';
  return result(base, feedback, { action: 'revise', after, revisedInterpretation: core, note: next ? note : null,
    nextQuestion: next ? { id: next.id, prompt: next.prompt, targetCandidateId: next.candidate } : null, text,
    state: { ...state, pending: next ? 'followup' : null, clarify: null, feedback, reading: core ?? state.reading,
      asked: next ? [...state.asked, next.id] : state.asked } });
}

/** Replays the visible conversation from the latest shown temperament question. Every earlier answer must have
 * been answered locally and shown completely; any other assistant text leaves the answer to chat. The menu prompt
 * may sit between a shown question and its answer; a bare yes/no after it is chat. */
export function resolveTemperamentFeedback({ decision, footer = '', messages, answer, menuPrompts = [] }) {
  const plan = temperamentPlan(decision);
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
    const next = advanceTemperamentFeedback(decision, plan, state, messages[i].text, { afterMenu });
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
  return advanceTemperamentFeedback(decision, plan, state, answer, { afterMenu });
}
