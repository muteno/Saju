// Explicit revision of the Jia stem work candidates from a visible conversation.
// References/assumptions: docs/knowledge-model/CONDITIONAL_WORK_READING.md.
// A small cue reader splits one free answer into parts. Unclear answers get at
// most one clarifying question; answers without cues go to the normal chat.
// Nothing is stored, learned, scored or shown as a probability.
import { WORK_QUESTIONS, EXPLICIT_ANSWERS } from './workCandidates.js';

const norm = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const bare = text => norm(text).replace(/[.!。!~]+$/u, '').trim();
const SENTENCE = /(?<=[.?!…])\s+/;
export const MAX_FEEDBACK_ANSWER = 240;

// ── Cue reader: one clause → at most one tag. Order matters (see CONDITIONAL_WORK_READING.md).
const CLAUSES = /(?<=는데|은데|지만|는데도|으나|다가)\s+|[,，.!。\n]+\s*|\s+(?:그런데|근데|하지만|그러나|반면에?)\s+/u;
const CUE = {
  decline: /말하고\s*싶지\s*않|말하기\s*싫|(?:대)?답하(?:지|기)\s*(?:않|싫)|(?:답|말)\s*안\s*할|넘어갈|패스|노코멘트/u,
  unsure: /모르겠|잘\s*모르|기억(?:이)?\s*안\s*나|기억나지\s*않|글쎄|(?:될|할|있을)\s*(?:것|거)\s*같|되겠|될지도/u,
  partial: /(?:때|적|경우)(?:도|가)\s*있|기도\s*하고|그때그때|상황에\s*따라|반반|었다\s+\S+었다\s*(?:했|하)/u,
  noIncrease: /(?:늘어난|늘어|많아진|커진)\s*적(?:이|은|도|는)?\s*(?:전혀\s*)?없/u,
  neverHelped: /도움(?:이|을|은)?\s*(?:된|받은|준)\s*(?:적|경험)(?:이|은|도|는)?\s*(?:전혀\s*)?없/u,
  none: /(?:그런|그러한|이런|비슷한)\s*(?:경험|적|일|상황)(?:이|은|도|는)?\s*(?:전혀\s*)?없|(?:해|겪어)\s*?본\s*적(?:이|은|도|는)?\s*(?:전혀\s*)?없|(?:^|\s)경험(?:이|은|도|는)?\s*(?:전혀\s*)?없/u,
  negative: /^(?:아니요|아니오|아뇨|아니|아니에요|아닌데요|아니었어요|아니야|아닙니다|없어요|없었어요|없어|없습니다|그렇지\s*않아요|안\s*그랬어요|아닌\s*(?:것|거)\s*같아요)$|안\s*맞|맞지\s*않|(?:아니에요|아니예요|아녜요|아니었어요|아니야|아닙니다)$/u,
  affirm: /^(?:네|넵|예|응|어|그래요|그래|그랬어요|그랬어|그랬죠|있어요|있었어요|있습니다|있었습니다)$|(?:^|\s)(?:대체로\s*|거의\s*)?맞(?:아|습니다|죠|지만|는데|았|네요)|맞는\s*(?:것|거)\s*같/u,
  helpNeg: /도움(?:이|은|도|는|을)?\s*(?:별로|전혀|그다지|딱히|크게|그렇게|많이)?\s*(?:안|못)\s*(?:됐|되었|됬|돼|되|받)|도움(?:이|은|도|는)?\s*(?:별로|전혀|그다지|딱히|크게|그렇게)?\s*되지\s*(?:않|못)|도움(?:이|은|도|는)?\s*없었|도움(?:이|은|도|는)?\s*(?:됐|되었)다기?\s*보다|(?:안|못)\s*(?:좋았|나았|괜찮았)|좋지\s*않았|나빠|(?:별\s*)?차이(?:가|는)?\s*없/u,
  helpPos: /도움(?:이|은|도|는|을)?\s*(?:많이|꽤|좀|조금|정말|확실히|분명히|크게|되게|엄청)?\s*(?:됐|되었|됬|돼요|돼서|되더|됨|되긴|받았)|도움(?:이|은|도|는)?\s*된\s*(?:것|거)\s*같|좋았|나았|좋아졌|나아졌|괜찮았|부담(?:이|은|도|는)?\s*(?:좀|많이|조금|꽤)?\s*(?:줄|덜)|수월해|편해졌|해결(?:했|됐|되었|이\s*됐)|효과(?:가|는)?\s*(?:있었|봤)/u,
  helpContra: /반대|오히려|역효과|방해|더\s*힘들|더\s*어려워|더\s*꼬|힘들어졌|어려워졌|버거워/u,
  increase: /(?:과제|일|요구|부담|책임|할\s*일|업무)(?:이|가|도|은|는|만)?\s*(?:더|많이|꽤|계속|확|훨씬)?\s*(?:늘|많아|커지|커졌|불어|쌓)/u,
  others: /팀원|동료|다른\s*사람|남(?:이|에게|한테)|같이\s*해|함께\s*해|나눠|맡겨|맡기|도와줘|도와주|협업|외주/u,
  self: /혼자|직접|제가\s*다|스스로|손수/u,
  demandContra: /반대/u,
  demandNeg: /(?:늘|많아지|커지|늘어나)(?:지|진|지는)\s*않|(?:별\s*)?차이(?:가|는)?\s*없|안\s*늘|줄었|줄어|그대로|변화(?:가|는)?\s*없|오히려\s*(?:편해|여유)/u,
  demandPos: /늘었|늘어났|늘어|많아졌|많아지|커졌|커지|불어났|더\s*바빠|쌓였/u,
};

function tagClause(clause, kind, means) {
  const c = bare(clause);
  if (!c) return null;
  // Two negations in one clause ("안 되진 않았어요") are not read as either side.
  if ((c.match(/(?:^|\s)(?:안|못)\s|않|아니/gu) ?? []).length >= 2) return 'conflict';
  if (CUE.decline.test(c)) return 'decline';
  if (CUE.unsure.test(c)) return 'unsure';
  if (CUE.partial.test(c)) return 'partial';
  const helpLike = kind === 'help' || kind === 'duty';
  if (CUE.neverHelped.test(c)) return helpLike ? 'negative' : null;
  if (CUE.noIncrease.test(c)) return kind === 'help' ? 'no-increase' : 'negative';
  if (CUE.none.test(c)) return 'none';
  if (CUE.negative.test(c)) return 'negative';
  if (CUE.affirm.test(c)) return 'affirm';
  if (helpLike) {
    // The food question asks about one's own execution and the peer question about
    // sharing roles; an answer about the other way does not answer the question.
    if (means === 'self' && CUE.others.test(c) && !CUE.self.test(c)) return 'other-means';
    if (means === 'others' && CUE.self.test(c) && !CUE.others.test(c)) return 'other-means';
    if (CUE.helpNeg.test(c)) return 'contradict';
    if (CUE.helpPos.test(c)) return 'support';
    if (CUE.helpContra.test(c)) return 'contradict';
    if (kind === 'help' && CUE.increase.test(c)) return 'increase';
    return null;
  }
  if (CUE.demandContra.test(c) || CUE.demandNeg.test(c)) return 'contradict';
  if (CUE.demandPos.test(c)) return 'support';
  return null;
}

/** Reads one answer for one question kind: 'help' (response with task increase),
 * 'duty' (help without task increase) or 'demand'. Returns null
 * when no feedback cue exists or the user asks something (normal chat path). */
export function readFeedbackAnswer(answer, kind, means = null) {
  if (typeof answer !== 'string' || !['help', 'duty', 'demand'].includes(kind)) return null;
  const text = norm(answer);
  if (!text || text.length > MAX_FEEDBACK_ANSWER || /[?？]/u.test(text)) return null;
  const explicit = EXPLICIT_ANSWERS.get(bare(text));
  if (explicit) return { kind: explicit, explicit: true, text, segments: [], demandEvidence: null };
  const segments = text.split(CLAUSES).map(bare).filter(Boolean)
    .map(clause => ({ text: clause, tag: tagClause(clause, kind, means) })).filter(s => s.tag);
  if (!segments.length) return null;
  const tags = new Set(segments.map(s => s.tag));
  // Task increase told inside a help answer is kept apart from the help polarity.
  const up = tags.has('increase'), down = tags.has('no-increase');
  const demandEvidence = up && !down ? 'up' : down && !up ? 'down' : null;
  const definite = [...new Set([...tags].map(t => (t === 'no-increase' ? 'none' : t)))]
    .filter(t => !['affirm', 'negative', 'increase'].includes(t));
  const result = k => ({ kind: k, explicit: false, text, segments, demandEvidence });
  if (tags.has('partial')) return result('clarify:partial');
  if (up && down) return result('clarify:unclear');
  if (tags.has('other-means')) return result('clarify:other-means');
  if (!definite.length) {
    if (tags.has('affirm') && tags.has('negative')) return result('clarify:unclear');
    if (tags.has('negative')) return result('clarify:ambiguous-negative');
    if (tags.has('affirm')) return result('supported');
    return result('clarify:help-unanswered');
  }
  if (definite.length === 1) {
    const [only] = definite;
    const consistent = only === 'support' ? !tags.has('negative')
      : ['contradict', 'none'].includes(only) ? !tags.has('affirm') : true;
    const kindOf = { support: 'supported', contradict: 'contradicted', none: 'no-experience', decline: 'unanswered', unsure: 'unsure' }[only];
    return result(consistent && kindOf ? kindOf : 'clarify:unclear');
  }
  if (definite.length === 2 && tags.has('support') && tags.has('contradict')) return result('mixed');
  return result('clarify:unclear');
}

// ── Wording (Korean particles follow the last syllable of the quoted answer).
const lastSyllable = text => [...bare(text).replace(/[’'"”)\]]+$/u, '')].at(-1) ?? '';
const batchim = text => { const code = lastSyllable(text).charCodeAt(0) - 0xac00; return code >= 0 && code <= 11171 && code % 28 !== 0; };
const clip = text => (text.length > 60 ? `${text.slice(0, 59)}…` : text);
const quoted = text => { const shown = clip(bare(text)); return `‘${shown}’${batchim(shown) ? '이라는' : '라는'}`; };
const q = text => `‘${clip(bare(text))}’`;

const MEANS = { 'food-response': '직접 만들거나 실행하는 방식', 'peer-response': '다른 사람과 역할을 조율하는 방식' };
const MEANS_CUE = { 'food-response': 'self', 'peer-response': 'others' };
const PHRASE = {
  help: { support: '도움이 된 경험', contradict: '도움이 되지 않았거나 오히려 부담이 늘어난 경험' },
  duty: { support: '도움이 된 경험', contradict: '도움이 되지 않았거나 따로 움직인 경험' },
  demand: { support: '과제가 함께 늘어난 경험', contradict: '과제가 늘지 않았거나 오히려 줄어든 경험' },
};
const WHEN = {
  help: ['도움이 됐고', '도움이 되지 않았거나 오히려 부담이 늘었는지'],
  duty: ['도움이 됐고', '도움이 되지 않았거나 따로 움직였는지'],
  demand: ['과제가 함께 늘었고', '늘지 않았거나 줄었는지'],
};
const READ = { 'no-experience': '그런 경험이 없다는 답', unanswered: '답하지 않겠다는 뜻', unsure: '확실하지 않다는 답' };
const NOT_A_HIT = '경험을 들은 뒤 고친 풀이라 처음 풀이의 적중으로 세지 않아요.';
const OUTSIDE = '지지·지장간·강약·운의 시기 같은 다른 조건은 아직 이 비교에 넣지 않았어요.';

/** Question plan for a revisable decision: the first owned question and follow-ups. */
export function feedbackPlan(decision) {
  if (!decision?.active || !decision.question) return null;
  const label = id => decision.candidates.find(c => c.id === id)?.label ?? '';
  const demand = { id: 'work-candidate-resource-demand', prompt: WORK_QUESTIONS['resource-demand'], kind: 'demand', candidate: 'resource-demand', label: label('resource-demand') };
  const mode = decision.mode;
  if (mode === 'food-response' || mode === 'peer-response')
    return { mode, first: { id: decision.question.id, prompt: decision.question.prompt, kind: 'help', candidate: mode, label: label(mode), means: MEANS[mode], meansCue: MEANS_CUE[mode] }, demand };
  if (mode === 'resource-duty')
    return { mode, first: { id: decision.question.id, prompt: decision.question.prompt, kind: 'duty', candidate: mode, label: label(mode) } };
  if (mode === 'resource-demand') return { mode, first: { ...demand, id: decision.question.id, prompt: decision.question.prompt } };
  return null; // competing/scope-withheld: choice answers are not revised here.
}

function initialState(decision, plan) {
  return { pending: 'first', clarified: false, demandEvidence: null,
    statuses: Object.fromEntries(decision.candidates.map(c => [c.id, c.status])), asked: [plan.first.id] };
}

function understanding(read, question) {
  if (read.explicit) return null;
  if (read.kind === 'mixed') {
    const parts = read.segments.filter(s => ['support', 'contradict'].includes(s.tag))
      .map(s => `${q(s.text)} 부분은 ${PHRASE[question.kind][s.tag === 'support' ? 'support' : 'contradict']}`);
    return `${parts.join(', ')}으로 나눠 읽었어요.`;
  }
  const phrase = read.kind === 'supported' ? PHRASE[question.kind].support
    : read.kind === 'contradicted' ? PHRASE[question.kind].contradict : READ[read.kind];
  let line = `${quoted(read.text)} 답은 ${phrase}${batchim(phrase) ? '으로' : '로'} 읽었어요.`;
  if (read.demandEvidence === 'up') line += ' 과제가 늘어난 경험도 함께 들었어요.';
  if (read.demandEvidence === 'down' && read.kind !== 'no-experience') line += ' 과제가 늘어난 적이 없다는 말도 함께 들었어요.';
  return line;
}

function clarifyText(read, question) {
  const opts = question.kind === 'demand'
    ? { yes: '과제가 함께 늘었다면', no: '성과·자원을 늘렸는데도 과제가 늘지 않았다면', none: '비슷한 일을 겪어 보지 않았다면' }
    : { yes: '도움이 됐다면', no: '해 봤지만 도움이 되지 않았거나 반대였다면', none: '그런 경험 자체가 없었다면' };
  if (read.kind === 'clarify:ambiguous-negative')
    return `${q(read.text)}만으로는 두 가지로 읽혀요. ${opts.none} ‘경험이 없어요’, ${opts.no} ‘반대예요’라고 답해 주세요.`;
  if (read.kind === 'clarify:partial')
    return `${quoted(read.text)} 답은 때에 따라 달랐다는 뜻으로 읽혀요. 어떤 때 ${WHEN[question.kind][0]} 어떤 때 ${WHEN[question.kind][1]} 나눠 말해 주면, 두 경우를 따로 반영할게요.`;
  if (read.kind === 'clarify:other-means')
    return `${quoted(read.text)} 답은 질문한 방식과 다른 방식으로 다룬 경험으로 읽혀요. ${question.means}이 그 과제를 다루는 데 도움이 됐는지는 아직 답이 없어요. ${opts.yes} ‘맞아요’, ${opts.no} ‘반대예요’, ${opts.none} ‘경험이 없어요’라고 답해 주세요.`;
  if (read.kind === 'clarify:help-unanswered')
    return `${quoted(read.text)} 답은 과제가 늘어난 경험으로 읽었어요. ${question.means ? `${question.means}이 ` : ''}그 과제를 다루는 데 도움이 됐는지는 아직 답이 없어요. ${opts.yes} ‘맞아요’, ${opts.no} ‘반대예요’, ${opts.none} ‘경험이 없어요’라고 답해 주세요.`;
  return `${quoted(read.text)} 답은 한 방향으로 정리하기 어려워요. ${opts.yes} ‘맞아요’, ${opts.no} ‘반대예요’, ${opts.none} ‘경험이 없어요’, 답하고 싶지 않다면 ‘말하고 싶지 않아요’라고 답해 주세요.`;
}

const STATUS_TEXT = {
  supported: label => `말해 준 경험의 범위에서는 ‘${label}’ 후보를 유지해요. 처음부터 명식만으로 맞힌 것으로 세지는 않아요.`,
  contradicted: label => `말해 준 반대 경험을 반영해 앞의 ‘${label}’ 후보를 낮춰요.`,
  'no-experience': label => `그 경험이 없으므로 ‘${label}’ 후보를 개인에게 적용하는 판단은 보류해요. 경험 없음은 반대 경험이나 능력 부족과 달라요.`,
  unanswered: () => '답하지 않은 상태로 남겨 둘게요. 앞의 후보는 확인되지 않았고, 동의하거나 반대한 것으로 처리하지 않아요.',
  unsure: () => '확실하지 않다는 답이므로 앞의 후보는 확인되지 않은 상태로 둬요. 동의나 반대, 경험 없음으로 바꾸지 않아요.',
  mixed: (label, kind) => kind === 'demand'
    ? `두 경험을 하나의 답으로 합치지 않아요. 과제가 늘어난 쪽의 범위에서는 ‘${label}’ 후보를 유지하고, 늘지 않은 쪽의 범위에서는 낮춰요.`
    : `두 경험을 하나의 답으로 합치지 않아요. 도움이 된 쪽의 범위에서는 ‘${label}’ 후보를 유지하고, 그렇지 않았던 쪽의 범위에서는 낮춰요.`,
};
const AFTER = { supported: 'retained-as-self-report', contradicted: 'weakened', 'no-experience': 'withheld', unanswered: 'withheld', unsure: 'withheld', mixed: 'scoped' };

/** The revised core reading after an answer, from the plan and statuses. */
function revisedCore(plan, question, kind, state, evidence) {
  const first = plan.first;
  if (question === first && first.kind === 'help' && first.means) {
    if (kind === 'contradicted') return evidence === 'up'
      ? `고친 풀이: ${first.means}으로 늘어난 과제를 줄인다는 부분은 낮추고, 성과·자원을 늘리는 일이 과제도 함께 늘린다는 쪽으로 풀이를 좁혀요. ${NOT_A_HIT}`
      : evidence === 'down'
        ? `고친 풀이: ${first.means}으로 늘어난 과제를 줄인다는 부분을 낮춰요. 과제가 늘어난 적도 없었다면 이 천간 비교로는 말해 준 경험을 설명하지 못해요. ${OUTSIDE}`
        : `고친 풀이: ${first.means}으로 늘어난 과제를 줄인다는 부분은 낮추고, 성과·자원을 늘리는 일이 과제도 함께 늘릴 수 있다는 가설만 남겨요. 이 가설은 아직 경험으로 확인하지 않았어요.`;
    if (kind === 'no-experience') return `고친 풀이: ${first.means}으로 대응한 부분은 개인 풀이에서 보류해요.${evidence ? '' : ' 과제가 늘어난 적이 없어서인지, 늘었지만 그렇게 대응해 본 적이 없어서인지 나눠 볼게요.'}`;
    if (kind === 'mixed') return `고친 풀이: ${first.means}이 과제를 다루는 데 도움이 된 범위와 그렇지 않은 범위가 함께 있다고 좁혀 읽어요. 두 범위를 가르는 조건은 명식이 아니라 말해 준 경험에서 왔어요. ${NOT_A_HIT}`;
    return null;
  }
  if (question === first && plan.mode === 'resource-duty') {
    if (kind === 'contradicted') return `고친 풀이: 성과·자원 관리와 기준·책임이 서로 이어지기보다 따로 움직였을 가능성을 먼저 둬요. ${NOT_A_HIT}`;
    if (kind === 'mixed') return `고친 풀이: 성과·자원 관리가 기준·책임 수행에 도움이 된 범위와 그렇지 않은 범위가 함께 있다고 좁혀 읽어요. ${NOT_A_HIT}`;
    return null;
  }
  // Demand question: first question in resource-demand mode, or the follow-up.
  const prior = plan.first.kind === 'help' && question !== first ? state.statuses[plan.first.candidate] : null;
  const priorLine = prior === 'weakened' ? ` 앞에서 낮춘 ‘${plan.first.label}’ 후보는 그대로 낮춘 상태예요.`
    : prior === 'withheld' ? ` 앞의 ‘${plan.first.label}’ 후보는 경험이 없어 보류한 상태 그대로예요.` : '';
  if (kind === 'supported') return prior ? `고친 풀이: 성과·자원을 늘리는 일이 과제도 함께 늘렸다는 부분은 말해 준 경험 범위에서 유지해요.${priorLine}` : null;
  if (kind === 'contradicted') return `고친 풀이: ${prior === 'weakened' ? '앞의 대응 후보와 과제 증가 후보가 모두 낮아져, ' : '성과·자원 확대가 과제를 늘린다는 가설을 낮추고, '}이 천간 비교로는 말해 준 경험을 설명하지 못해요.${prior === 'withheld' ? priorLine : ''} ${OUTSIDE}`;
  if (kind === 'mixed') return `고친 풀이: 성과·자원을 늘린 일이 과제를 늘린 범위와 그렇지 않은 범위가 함께 있다고 좁혀 읽어요.${priorLine} ${NOT_A_HIT}`;
  if (priorLine && ['no-experience', 'unanswered', 'unsure'].includes(kind)) return priorLine.trim();
  return null;
}

/** Applies one answer to the pending question. Pure; returns the next state. */
export function advanceWorkFeedback(decision, plan, state, answer) {
  const question = state.pending === 'first' ? plan.first : state.pending === 'demand' ? plan.demand : null;
  if (!question) return null;
  const read = readFeedbackAnswer(answer, question.kind, question.meansCue ?? null);
  if (!read) return null;
  const before = { questionId: question.id, targetCandidateId: question.candidate, selectedIds: [...decision.selectedIds],
    interpretation: decision.interpretation, statuses: { ...state.statuses } };
  const base = { questionId: question.id, targetCandidateId: question.candidate, answer: read, before,
    beforeFeedback: { mode: decision.mode, selectedIds: [...decision.selectedIds], interpretation: decision.interpretation },
    probability: null, trainingEligible: false };
  if (read.kind.startsWith('clarify:')) {
    if (state.clarified) {
      const statuses = { ...state.statuses, [question.candidate]: 'unconfirmed' };
      return { ...base, action: 'unresolved', after: 'unconfirmed', nextQuestion: null, revisedInterpretation: null,
        text: `구분할 수 있는 답을 얻지 못해 앞의 ‘${question.label}’ 후보는 확인되지 않은 상태로 둘게요. 같은 질문은 다시 묻지 않아요.`,
        state: { ...state, pending: null, statuses } };
    }
    const heard = question.kind === 'help' && plan.demand ? read.demandEvidence : null;
    return { ...base, action: 'clarify', after: 'pending', nextQuestion: null, revisedInterpretation: null,
      text: clarifyText(read, question), state: { ...state, clarified: true, demandEvidence: state.demandEvidence ?? heard } };
  }
  const statuses = { ...state.statuses, [question.candidate]: AFTER[read.kind] };
  const evidence = question.kind === 'help' && plan.demand ? read.demandEvidence : null;
  const demandEvidence = state.demandEvidence ?? evidence;
  if (demandEvidence && question.kind === 'help') statuses[plan.demand.candidate] = demandEvidence === 'up' ? 'retained-as-self-report' : 'weakened';
  const core = revisedCore(plan, question, read.kind, state, demandEvidence);
  const askDemand = plan.demand && question === plan.first && ['contradicted', 'no-experience'].includes(read.kind);
  let next = null, reportedLine = null;
  if (askDemand && !state.asked.includes(plan.demand.id)) {
    if (demandEvidence === 'up') reportedLine = '과제가 늘어난 경험은 이미 말해 줘서 같은 내용을 다시 묻지 않을게요. 과제 증가 부분은 말해 준 경험 범위에서 유지해요.';
    else if (demandEvidence === 'down') reportedLine = '과제가 늘어난 적이 없다고 이미 말해 줘서 같은 내용을 다시 묻지 않을게요. 과제 증가 부분도 말해 준 경험 범위에서 낮춰요.';
    else next = plan.demand;
  }
  const paragraphs = [understanding(read, question), STATUS_TEXT[read.kind](question.label, question.kind), core, reportedLine, next?.prompt].filter(Boolean);
  return { ...base, action: 'revise', after: AFTER[read.kind], statuses,
    revisedInterpretation: core, nextQuestion: next ? { id: next.id, prompt: next.prompt, targetCandidateId: next.candidate } : null,
    text: paragraphs.join('\n\n'),
    state: { ...state, pending: next ? 'demand' : null, clarified: false, demandEvidence, statuses, asked: next ? [...state.asked, next.id] : state.asked } };
}

/** Replays the visible conversation from the latest shown owned question. Every
 * earlier answer must have been answered locally and shown completely; any other
 * assistant text (menu, provider reply, partial reply) leaves the answer to chat. */
export function resolveWorkFeedback({ decision, footer = '', messages, answer }) {
  const plan = feedbackPlan(decision);
  if (!plan || !Array.isArray(messages) || typeof answer !== 'string') return null;
  const start = messages.findLastIndex(m => m?.role === 'assistant' && norm(m.text) === norm(plan.first.prompt));
  if (start < 0) return null;
  const owned = new Set([footer, ...String(footer).split(SENTENCE)].map(norm).filter(Boolean));
  let i = start + 1;
  while (i < messages.length && messages[i].role === 'assistant' && owned.has(norm(messages[i].text))) i++;
  let state = initialState(decision, plan);
  while (i < messages.length) {
    if (messages[i].role !== 'user' || !state.pending) return null;
    const step = advanceWorkFeedback(decision, plan, state, messages[i].text);
    if (!step) return null;
    let j = i + 1;
    const shown = [];
    while (j < messages.length && messages[j].role === 'assistant') shown.push(messages[j++].text);
    if (norm(shown.join(' ')) !== norm(step.text)) return null;
    state = step.state;
    i = j;
  }
  if (!state.pending) return null;
  return advanceWorkFeedback(decision, plan, state, answer);
}
