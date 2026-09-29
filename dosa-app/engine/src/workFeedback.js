// Explicit revision of the day-master stem work candidates from a visible conversation.
// References/assumptions: docs/knowledge-model/CONDITIONAL_WORK_READING.md.
// Precision first: a free answer changes a candidate only when every clause fits
// a small whole-clause template. Other answers with feedback cues get at most one
// clarifying question; questions, other topics and cue-less text go to normal chat.
// Nothing is stored, learned, scored or shown as a probability.
import { WORK_QUESTIONS, EXPLICIT_ANSWERS } from './workCandidates.js';

const norm = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const bare = text => norm(text).replace(/(?:^|\s)[ㅋㅎㅠㅜ]{2,}(?=\s|$)/gu, ' ').replace(/[.!。!~…]+$/u, '').trim();
const SENTENCE = /(?<=[.?!…])\s+/;
export const MAX_FEEDBACK_ANSWER = 240;

// ── Clauses. Contrast endings/conjunctions mark the following clause.
const PIECES = /(?<!\d)[.。!！…]+(?!\d)\s*|[,，\n]+\s*/u;
const CONJUNCTION = /\s+(?=(?:그런데|근데|하지만|그러나|반면에?|그래도|그렇지만)\s)/u;
const CONTRAST_END = /(?<=(?:는데|은데|한데|인데|지만|는데도|으나|었다가|았다가|였다가|했다가|됐다가))\s+/u;
const ADDITIVE_END = /(?<=(?:었고|았고|였고|했고|됐고|났고|졌고|없고|않고))\s+/u;
const LEAD_CONTRAST = /^(?:그런데|근데|하지만|그러나|반면에?|그래도|그렇지만|다만)\s+/u;
const LEAD_WORD = /^(아니요|아니오|아뇨|아니|네|넵|예|응|맞아요|맞아|맞습니다)\s+/u;
// `text` keeps the user's words for quoting; `core` drops the joining ending for templates.
export function answerClauses(text) {
  const out = [];
  for (const sentence of norm(text).split(PIECES)) for (const piece of sentence.split(CONJUNCTION)) {
    let contrast = false;
    const parts = bare(piece).split(CONTRAST_END);
    parts.forEach((part, p) => {
      const clauses = part.split(ADDITIVE_END);
      clauses.forEach((raw, c) => {
        let clause = bare(raw);
        if (LEAD_CONTRAST.test(clause)) { clause = clause.replace(LEAD_CONTRAST, ''); contrast = true; }
        const lead = clause.match(LEAD_WORD);
        if (lead) { out.push({ text: lead[1], core: lead[1], contrast: false }); clause = clause.slice(lead[0].length); }
        let core = clause;
        if (c < clauses.length - 1) core = core.replace(/고$/u, '');
        else if (p < parts.length - 1) core = core.replace(/(?:는데도|는데|은데|한데|인데|지만|으나|다가)$/u, '');
        if (clause) out.push({ text: clause, core, contrast });
        contrast = false;
      });
      contrast = true; // the part after a contrastive ending
    });
  }
  return out;
}

// ── Whole-clause templates: allowed prefix words + core + ending. Partial matches never count.
const END = '(?:어요|아요|어|아|습니다|었어요|었어|었습니다|죠|네요|더라고요|더라구요|던데요|예요|에요|이에요|요)?';
const WORDS = '(?:(?:제가|저는|저도|직접|혼자|스스로|처음엔|처음에는|처음에|초반엔|초반에는|초기엔|나중엔|나중에는|나중에|결국|그땐|그때는|그때|확실히|정말|진짜|완전|많이|꽤|좀|아주|분명히|실제로|대체로|거의|오히려|딱히|별로|전혀|하나도|엄청|훨씬|너무|갈수록|점점)\\s*)';
const SELF_WAY = '(?:(?:직접|제가\\s*직접|제가\\s*다|혼자|혼자\\s*다)\\s*(?:해\\s*보니(?:까)?|해\\s*봤더니|하니(?:까)?|해서|했더니|하느라|만들어서|만들어\\s*보니(?:까)?|처리하니(?:까)?|처리해서)\\s*|(?:직접|제가)\\s*(?:만든|한|해\\s*본)\\s*(?:게|것이|건)\\s*)';
const OTHERS_WAY = '(?:(?:(?:팀원|동료|다른\\s*사람|사람들|남)(?:들)?(?:이랑|하고|과|와|한테)?\\s*)?(?:역할을\\s*)?(?:나눠서|나누니(?:까)?|나눴더니|같이\\s*해서|같이\\s*하니(?:까)?|맡기니(?:까)?|맡겨서|조율하니(?:까)?|조율해서|조율했더니)\\s*)';
const WHEN_WAY = '(?:(?:일|규모|과제|업무|회사|사업)(?:이|가)?\\s*(?:커지면서|커지니(?:까)?|많아지면서|많아지니(?:까)?|늘면서|늘어나면서|늘어나니(?:까)?)\\s*)';
const PREFIX = `(?:${WORDS}|${SELF_WAY}|${OTHERS_WAY}|${WHEN_WAY})*`;
const whole = core => new RegExp(`^${PREFIX}(?:${core})${END}$`, 'u');
const TASK = '(?:일|과제|요구|요청|부담|책임|업무|할\\s*일|챙길\\s*일)';
const T = {
  support: whole([
    '도움(?:이|은|도|을)?\\s*(?:많이|꽤|좀|정말|확실히|진짜|크게|엄청|되게)?\\s*(?:됐|되었|됬|받았|됨|돼)',
    '도움(?:이|을)?\\s*(?:된|받은)\\s*(?:적|경험)(?:이|은|도)?\\s*(?:많이\\s*)?있(?:었)?',
    '(?:(?:일|부담|과제|업무)(?:이|가|은|는)?\\s*)?(?:편했|편해졌|수월했|수월해졌|쉬웠|쉬워졌|나았|나아졌|좋았|좋아졌|괜찮았|빨리\\s*끝났|풀렸|좋아요|좋던데|좋더라)',
    '부담(?:이|은|도)?\\s*(?:좀|많이|조금|꽤|확)?\\s*(?:줄었|줄어들었|덜했|덜어졌)',
    '(?:잘\\s*)?해결(?:했|됐|되었|이\\s*됐)',
    '효과(?:가|는)?\\s*(?:있었|봤)',
    '(?:하는\\s*)?게\\s*(?:훨씬\\s*|더\\s*|속\\s*)?(?:낫더라(?:고요|구요)?|나았|낫던데|편했)',
  ].join('|')),
  contradict: whole([
    '도움(?:이|은|도)?\\s*(?:별로|전혀|하나도|그다지|딱히|크게|진짜|정말|그렇게|많이)?\\s*(?:안|못)\\s*(?:됐|되었|됬|돼|받았|됨)',
    '도움(?:이|은|도)?\\s*(?:별로|전혀|하나도|그다지|딱히|크게|그렇게)?\\s*되지\\s*(?:않았|못했)',
    // Task growth is the question's premise (kept as demand evidence), not a failure of the method:
    // only a burden or difficulty after 오히려/더 reads as the opposite experience.
    `(?:오히려|더|훨씬|갈수록|점점)\\s*(?:부담(?:이|가|도|만)?\\s*(?:더\\s*|많이\\s*|훨씬\\s*)?(?:늘었|늘어났|커졌|많아졌|쌓였)|(?:${TASK}(?:이|가|도|만)?\\s*)?(?:더\\s*|많이\\s*|훨씬\\s*)?(?:힘들었|힘들어졌|어려워졌|꼬였|버거웠|방해(?:가|만)?\\s*됐|방해됐))`,
    '(?:방해만\\s*됐|방해가\\s*됐|역효과(?:였|가\\s*났|만\\s*났)|버거웠|벅찼|감당이\\s*안\\s*됐|감당(?:이|을)?\\s*못\\s*했)',
    '(?:안|못)\\s*(?:좋았|나았|괜찮았)|좋지\\s*않았|나빠졌',
    '(?:별\\s*|큰\\s*)?차이(?:가|는)?\\s*(?:전혀\\s*|별로\\s*)?없었',
    '반대(?:예요|에요|였어요|였어|였죠|입니다|였습니다|야|였다)',
  ].join('|')),
  none: whole([
    '(?:그런|이런|비슷한)?\\s*(?:경험|적|일|상황)(?:이|은|도|는)?\\s*(?:전혀\\s*|한\\s*번도\\s*|아직\\s*)?없(?:었)?',
    '(?:(?:그렇게|그런\\s*식으로)\\s*)?(?:해|겪어)\\s*?본\\s*적(?:이|은|도)?\\s*(?:전혀\\s*|한\\s*번도\\s*)?없(?:었)?',
    '(?:그렇게\\s*)?(?:안|못)\\s*해\\s*봤',
    '(?:그럴|그런)\\s*기회(?:가|는|도)?\\s*(?:전혀\\s*)?없(?:었)?',
  ].join('|')),
  neverHelped: whole('도움(?:이|을|은)?\\s*(?:된|받은|됐던|받았던)\\s*(?:적|경험|기억)(?:이|은|도)?\\s*(?:전혀\\s*|한\\s*번도\\s*)?없(?:었)?'),
  demandSupport: whole([
    `(?:${TASK}(?:이|가|도|은|는|만)?\\s*)?(?:더|많이|꽤|계속|확|훨씬|너무|엄청|좀|정말|두\\s*배로?|세\\s*배로?)?\\s*(?:늘었|늘어났|많아졌|커졌|불어났|쌓였|폭증했)`,
    '(?:늘(?:린|어난)|많아진)\\s*(?:적|경험)(?:이|은)?\\s*있(?:었)?',
  ].join('|')),
  demandContradict: whole([
    `(?:${TASK}(?:이|가|도|은|는)?\\s*)?(?:딱히\\s*|별로\\s*|전혀\\s*|하나도\\s*|오히려\\s*)?(?:(?:늘|늘어나|많아지|커지)(?:지|진|지는|지도)\\s*않았|안\\s*늘었|줄었|줄어들었|그대로(?:였|이었)?|비슷했|변화(?:가|는)?\\s*없었)`,
    '(?:늘어난|많아진)\\s*(?:건|게|일은?)\\s*(?:딱히\\s*)?없(?:었)?',
    '반대(?:예요|에요|였어요|였어|였죠|입니다|였습니다|야|였다)',
  ].join('|')),
  demandNever: whole('(?:늘었던|늘어났던|많아졌던|늘어난)\\s*(?:적|기억)(?:이|은|도)?\\s*(?:전혀\\s*|한\\s*번도\\s*)?없(?:었)?'),
};
const EXACT = {
  negative: /^(?:아니요|아니오|아뇨|아니|아니에요|아닌데요|아니었어요|아니야|아닙니다|없어요|없었어요|없어|없습니다|안\s*그랬어요|그렇지\s*않았어요|그렇지\s*않아요|안\s*맞아요|안\s*맞았어요)$/u,
  affirm: /^(?:네|넵|예|응|맞아요|맞아|맞습니다|맞죠|그래요|그랬어요|그랬죠|있어요|있었어요|있습니다|있었습니다|그런\s*(?:적|경험)\s*있어요)$/u,
  decline: /^(?:말하고\s*싶지\s*않아요|말하기\s*싫어요?|답하지\s*않을래요|답하기\s*싫어요|대답하기\s*싫어요|패스(?:할게요|할래요|요)?|넘어갈게요|넘어갈래요|노코멘트|비밀이에요)$/u,
  unsure: /^(?:(?:잘\s*)?모르겠(?:어요|어|습니다|네요)|기억(?:이)?\s*(?:잘\s*)?안\s*나(?:요|네요)|글쎄요|(?:도움이\s*)?(?:됐는지|되었는지)\s*(?:잘\s*)?모르겠(?:어요|어|습니다)|(?:도움이\s*)?(?:될|됐을)\s*(?:것|거)\s*같아요|(?:아마\s*)?늘었을\s*(?:거예요|걸요)(?:\s*아마)?)$/u,
  partial: /(?:때|적|경우)(?:도|가)\s*있|기도\s*하고|그때그때|상황에\s*따라|반반|다\s+(?:안\s*)?\S+다\s*(?:했|하)/u,
  filler: /^(?:(?:직접\s*)?해\s*봤(?:는데|지만)?|했(?:는데)?|해\s*보니(?:까)?|음+|흠+|그러니까|사실|솔직히|제\s*경험상|특히\s*\S+)$/u,
};
// Ways of answering that are not the asked proposition.
const OTHERS = /팀원|동료|다른\s*사람|남(?:이|에게|한테)|같이|함께|나눠|맡겨|맡기|도와|협업|외주/u;
const OTHERS_NEGATED = /(?:팀원|동료|남|다른\s*사람)\S*\s*(?:도움\s*)?없이|맡긴\s*적(?:은|이)?\s*없|안\s*맡/u;
const SELF = /혼자|직접|제가\s*다|스스로|손수/u;
const RESOURCE = /매출|수입|수익|이익|돈|자원|성과|실적|규모|사업|고객|매장|연봉|월급/u;
const DUTY = /기준|책임|규칙|규정|의무/u;
const TASK_RE = new RegExp(TASK, 'u');
const INCREASE = new RegExp(`${TASK}(?:이|가|도|은|는|만)?\\s*(?:더|많이|꽤|계속|확|훨씬|너무|엄청|두\\s*배로?|세\\s*배로?)?\\s*(?:늘었|늘어났|많아졌|커졌|불어났|쌓였)`, 'u');
const NO_INCREASE = new RegExp(`${TASK}(?:이|가|도|은|는)?\\s*(?:딱히\\s*|별로\\s*)?(?:(?:늘|늘어나|많아지)(?:지|진|지는|지도)\\s*않|안\\s*늘|(?:늘어난|늘었던)\\s*(?:적|건|게)\\S*\\s*없)`, 'u');
const NEGATION_IN_CLAUSE = /않|없|(?:^|\s)(?:안|못)\s|(?:^|\s)안(?=[가-힣])|못(?=하|되|됐)|던|다고|기보다|커녕|으면|텐데/u;
// Asking something or talking about another topic is not an answer to the owned question.
const ASKING = /[?？]|까요|나요|어때|어떨|어떤가|알려\s*주|알려줘|봐\s*주|봐줘|해\s*주세요|해줘|궁금|언제|어떻게|(?:^|\s)왜|뭐예요|뭔가요|인가요|건가요|무슨\s*뜻/u;
const OTHER_TOPIC = /연애|남편|아내|배우자|남친|여친|애인|건강|올해|내년|운세|재물운|궁합|결혼|이직\s*시기|알겠|감사|고마워|고맙|계속\s*해/u;
const CUE_WORDS = /도움|좋|나았|나아|편|수월|쉬|힘들|어려|부담|늘|줄|많아|커|반대|오히려|경험|해결|효과|방해|차이|버거|맞|아니|없|않|별로|(?:^|\s)안\s|(?:^|\s)못\s|그대로|비슷|모르/u;

function tagClause(text, kind, means) {
  const c = bare(text);
  if (!c) return null;
  if (EXACT.decline.test(c)) return 'decline';
  if (EXACT.unsure.test(c)) return 'unsure';
  if (EXACT.partial.test(c)) return 'partial';
  if (EXACT.negative.test(c)) return 'negative';
  if (EXACT.affirm.test(c)) return 'affirm';
  if (EXACT.filler.test(c)) return 'filler';
  if (kind === 'demand') {
    if (RESOURCE.test(c) && !TASK_RE.test(c)) return 'filler'; // restates the premise (resources grew)
    if (T.demandNever.test(c)) return 'negative';
    if (T.none.test(c)) return 'none';
    if (T.demandContradict.test(c)) return 'contradict';
    if (T.demandSupport.test(c)) return 'support';
    return null;
  }
  // The duty question asks whether resources served a duty; help credited only to other people
  // (no resource or duty word) answers a different question, so the clause stays unread.
  if (kind === 'duty' && OTHERS.test(c) && !OTHERS_NEGATED.test(c) && !RESOURCE.test(c) && !DUTY.test(c)) return null;
  if (means === 'self' && OTHERS.test(c) && !OTHERS_NEGATED.test(c) && !SELF.test(c)) return 'other-means';
  if (means === 'others' && (SELF.test(c) || OTHERS_NEGATED.test(c)) && !(OTHERS.test(c) && !OTHERS_NEGATED.test(c))) return 'other-means';
  if (/보다/u.test(c) && OTHERS.test(c) && SELF.test(c)) return null;
  if (T.neverHelped.test(c)) return 'negative';
  if (kind === 'help' && NO_INCREASE.test(c) && !/도움/u.test(c)) return 'no-increase';
  if (T.none.test(c)) return 'none';
  if (T.contradict.test(c)) return 'contradict';
  if (T.support.test(c)) return 'support';
  if (kind === 'help' && INCREASE.test(c) && !NEGATION_IN_CLAUSE.test(c)) return 'increase';
  return null;
}

/** Reads one answer for one question kind: 'help' (response with task increase),
 * 'duty' (help without task increase) or 'demand'. Returns null when the answer
 * asks something, talks about another topic, or has no feedback cue (normal chat). */
export function readFeedbackAnswer(answer, kind, means = null) {
  if (typeof answer !== 'string' || !['help', 'duty', 'demand'].includes(kind)) return null;
  const text = norm(answer);
  if (!text || text.length > MAX_FEEDBACK_ANSWER || ASKING.test(text) || OTHER_TOPIC.test(text)) return null;
  const explicit = EXPLICIT_ANSWERS.get(bare(text));
  if (explicit) return { kind: explicit, explicit: true, text, segments: [], demandEvidence: null };
  const segments = answerClauses(text).map(clause => {
    const tag = tagClause(clause.core, kind, means);
    // Task increase told inside a help answer is kept apart from the help polarity.
    const up = kind === 'help' && INCREASE.test(clause.core) && !NEGATION_IN_CLAUSE.test(clause.core);
    return { ...clause, tag, up, down: tag === 'no-increase' };
  });
  if (!segments.length) return null;
  const up = segments.some(s => s.up), down = segments.some(s => s.down);
  const result = (k, demandEvidence = up ? 'up' : down ? 'down' : null) => ({ kind: k, explicit: false, text, segments, demandEvidence });
  const tags = segments.map(s => s.tag), has = t => tags.includes(t);
  const unknown = segments.filter(s => s.tag === null);
  const definite = [...new Set(tags.map(t => (t === 'no-increase' ? 'none' : t)))]
    .filter(t => t && !['affirm', 'negative', 'increase', 'filler'].includes(t));
  if (!tags.some(t => t && t !== 'filler')) return unknown.some(s => CUE_WORDS.test(s.core)) ? result('clarify:unclear') : null;
  if (has('partial')) return result('clarify:partial');
  if (/\.{2,}|…/u.test(text) && !definite.length) return null; // hesitation, not an answer
  if (unknown.length) return result('clarify:unclear'); // an unread clause may reverse the rest
  if (has('other-means')) return result('clarify:other-means');
  if (up && down) return result('clarify:unclear', null);
  if (!definite.length) {
    if (has('affirm') && has('negative')) return result('clarify:unclear');
    if (has('negative')) return result('clarify:ambiguous-negative');
    if (has('affirm') && !up) return result('supported');
    return result('clarify:help-unanswered');
  }
  if (definite.length === 1) {
    const [only] = definite;
    const yes = segments.filter(s => s.tag === 'affirm').map(s => s.text);
    const consistent = only === 'support' ? !has('negative')
      : only === 'none' ? yes.every(w => ['네', '예', '넵', '응'].includes(w))
        : only === 'contradict' ? !has('affirm') : !has('affirm') && !has('negative');
    const kindOf = { support: 'supported', contradict: 'contradicted', none: 'no-experience', decline: 'unanswered', unsure: 'unsure' }[only];
    return consistent && kindOf ? result(kindOf) : result('clarify:unclear');
  }
  if (definite.length === 2 && definite.includes('support') && definite.includes('contradict') && !has('affirm') && !has('negative'))
    return result('mixed');
  return result('clarify:unclear');
}

// ── Wording. Particles follow the last syllable; a quote stays one sentence.
const lastSyllable = text => Array.from(bare(text).replace(/[’'"”)\]]+$/u, '')).at(-1) ?? '';
const batchim = text => { const code = lastSyllable(text).charCodeAt(0) - 0xac00; return code >= 0 && code <= 11171 && code % 28 !== 0; };
const flat = text => bare(text).replace(/[.?!…。！？]+\s+/gu, ', ');
const clip = text => { const chars = Array.from(flat(text)); return chars.length > 60 ? `${chars.slice(0, 59).join('')}…` : chars.join(''); };
const quoted = text => { const shown = clip(text); return `‘${shown}’${batchim(shown) ? '이라는' : '라는'}`; };
const q = text => `‘${clip(text)}’`;

// User-facing names; the internal candidate labels are never shown in the chat.
const NAMES = {
  'food-response': '직접 만들고 실행해서 늘어난 일을 다룬다는 풀이',
  'peer-response': '다른 사람과 역할을 나눠 늘어난 일을 다룬다는 풀이',
  'resource-demand': '성과·자원을 늘리면 해결할 일도 함께 늘어난다는 풀이',
  'resource-duty': '성과·자원 관리가 정해진 기준·책임 수행으로 이어진다는 풀이',
};
const MEANS = { 'food-response': '직접 만들고 실행하는 방식', 'peer-response': '다른 사람과 역할을 나누는 방식' };
const MEANS_CUE = { 'food-response': 'self', 'peer-response': 'others' };
const PHRASE = {
  help: { support: '도움이 된 경험', contradict: '도움이 되지 않았거나 오히려 부담이 늘어난 경험' },
  duty: { support: '도움이 된 경험', contradict: '이어지지 않았거나 오히려 부딪힌 경험' },
  demand: { support: '해결할 일이 함께 늘어난 경험', contradict: '해결할 일이 늘지 않았거나 오히려 줄어든 경험' },
};
const NOT_A_HIT = '경험을 들은 뒤 고친 풀이라 처음 풀이의 적중으로 세지 않아요.';
const OUTSIDE = '앞에서 본 강약·지장간·지지 관계 관찰과, 식신·겁재 합 밖의 다른 천간 관계(인성·상관 등)·운의 시기는 아직 이 비교에 합치지 않았어요. 궁금한 점을 직접 물어보면 이어서 볼게요.';
// Other day masters compared 식신 and any 편관 stem combination (its partner is 상관 for a yin day master).
const OUTSIDE_STEM = '앞에서 본 강약·지장간·지지 관계 관찰과, 식신과 편관 천간합 밖의 다른 천간 관계(인성, 편관과 합하지 않은 상관 등)·운의 시기는 아직 이 비교에 합치지 않았어요. 궁금한 점을 직접 물어보면 이어서 볼게요.';
const FEEDBACK_KINDS = ['supported', 'contradicted', 'no-experience', 'unanswered', 'unsure', 'mixed'];
const OFFERED = {
  'clarify:ambiguous-negative': ['no-experience', 'contradicted', 'unanswered', 'unsure'],
  'clarify:partial': FEEDBACK_KINDS, 'clarify:help-unanswered': FEEDBACK_KINDS,
  'clarify:other-means': FEEDBACK_KINDS, 'clarify:unclear': FEEDBACK_KINDS,
};
const AFTER = { supported: 'retained-as-self-report', contradicted: 'weakened', 'no-experience': 'withheld', unanswered: 'withheld', unsure: 'withheld', mixed: 'scoped' };
const mergeEvidence = (prev, next) => (prev == null ? next : next == null || next === prev ? prev : 'conflict');

/** Question plan for a revisable decision: the first owned question and follow-ups. */
export function feedbackPlan(decision) {
  if (!decision?.active || !decision.question) return null;
  const demand = { id: 'work-candidate-resource-demand', prompt: WORK_QUESTIONS['resource-demand'], kind: 'demand', candidate: 'resource-demand', name: NAMES['resource-demand'] };
  const mode = decision.mode, own = { id: decision.question.id, prompt: decision.question.prompt, candidate: mode, name: NAMES[mode] };
  const outside = decision.policy === 'stem-resource-authority-v1' ? OUTSIDE_STEM : OUTSIDE;
  if (mode === 'food-response' || mode === 'peer-response')
    return { mode, outside, first: { ...own, kind: 'help', means: MEANS[mode], meansCue: MEANS_CUE[mode] }, demand };
  if (mode === 'resource-duty') return { mode, outside, first: { ...own, kind: 'duty' } };
  if (mode === 'resource-demand') return { mode, outside, first: { ...demand, id: own.id, prompt: own.prompt } };
  return null; // competing/scope-withheld: choice answers are not revised here.
}

/** Prompts this plan may ask; a provider reply must not re-ask them as its own. */
export function ownedFeedbackPrompts(decision) {
  const plan = feedbackPlan(decision);
  return plan ? [plan.first.prompt, ...(plan.demand ? [plan.demand.prompt] : [])] : [];
}

function understanding(read, question) {
  if (read.explicit || !['supported', 'contradicted', 'mixed'].includes(read.kind)) return null;
  const phrase = PHRASE[question.kind];
  if (read.kind === 'mixed') {
    const parts = read.segments.filter(s => ['support', 'contradict'].includes(s.tag)).map(s => `${q(s.text)} 부분은 ${phrase[s.tag]}`);
    return `${parts.join(', ')}으로 나눠 읽었어요.`;
  }
  return `${quoted(read.text)} 답은 ${phrase[read.kind === 'supported' ? 'support' : 'contradict']}으로 읽었어요.`;
}

function clarifyText(read, question) {
  const opts = question.kind === 'demand'
    ? { yes: '해결할 일이 함께 늘었다면', no: '성과·자원을 늘렸는데도 일이 늘지 않았다면', none: '비슷한 일을 겪어 보지 않았다면' }
    : question.kind === 'duty'
      ? { yes: '도움이 됐다면', no: '이어지지 않았거나 오히려 부딪혔다면', none: '그런 경험 자체가 없었다면' }
      : { yes: '도움이 됐다면', no: '해 봤지만 도움이 되지 않았거나 반대였다면', none: '그런 경험 자체가 없었다면' };
  if (read.kind === 'clarify:ambiguous-negative')
    return `${q(read.text)}만으로는 두 가지로 읽혀요. ${opts.none} ‘경험이 없어요’, ${opts.no} ‘반대예요’라고 답해 주세요.`;
  if (read.kind === 'clarify:partial')
    return `${quoted(read.text)} 답은 때에 따라 달랐다는 뜻으로 읽혀요. 어떤 때 그랬고 어떤 때 아니었는지 나눠 말해 주면, 두 경우를 따로 반영할게요.`;
  const options = `${opts.yes} ‘맞아요’, ${opts.no} ‘반대예요’, ${opts.none} ‘경험이 없어요’라고 답해 주세요.`;
  if (read.kind === 'clarify:help-unanswered')
    return `${quoted(read.text)} 답에서 일이 늘어난 경험은 들었어요. ${question.means}이 그 일을 다루는 데 도움이 됐는지는 아직 답이 없어요. ${options}`;
  if (read.kind === 'clarify:other-means')
    return `${quoted(read.text)} 답은 질문한 방식과 다른 방식으로 다룬 경험으로 읽혀요. ${question.means}이 도움이 됐는지는 아직 답이 없어요. ${options}`;
  return `${quoted(read.text)} 답은 한 방향으로 정확히 읽기 어려워요. ${options} 둘 다였다면 어떤 때 그랬고 어떤 때 아니었는지 나눠 말해 주세요.`;
}

/** Status sentence, revised core and note for one applied answer. */
function revision(plan, question, kind, state, evidence) {
  const name = `‘${question.name}’`, first = plan.first, isFirst = question.id === first.id;
  const prior = !isFirst && first.kind === 'help' ? state.feedback[first.candidate] : null;
  const priorNote = prior === 'weakened' ? `앞에서 낮춘 ‘${first.name}’는 그대로 낮춘 상태예요.`
    : prior === 'withheld' ? `앞의 ‘${first.name}’는 경험이 없어 보류한 상태 그대로예요.` : null;
  let status = {
    supported: `말해 준 경험 범위에서 ${name}를 유지해요. 처음부터 명식만으로 맞힌 것으로 세지는 않아요.`,
    contradicted: `말해 준 반대 경험을 반영해 ${name}를 낮춰요.`,
    'no-experience': `그 경험이 없으므로 ${name}를 개인에게 적용하는 판단은 보류해요. 경험 없음은 반대 경험이나 능력 부족과 달라요.`,
    unanswered: `답하지 않은 상태로 남겨 둘게요. ${name}는 확인되지 않은 가설로 두고, 동의하거나 반대한 것으로 처리하지 않아요.`,
    unsure: `확실하지 않다면 ${name}는 확인되지 않은 가설로 둘게요.`,
    mixed: `경험을 나눠서 볼게요. ${question.kind === 'demand' ? '일이 늘어난' : '도움이 된'} 쪽에서는 ${name}를 유지하고, 그렇지 않았던 쪽에서는 낮춰요.`,
  }[kind];
  let core = null, note = null;
  if (isFirst && first.means) {
    if (kind === 'contradicted') core = evidence === 'up'
      ? `고친 풀이: 일이 늘어난 경험은 말해 준 범위에서 받아들이고, ${first.means}으로 그 일을 줄였다는 부분은 빼요. ${NOT_A_HIT}`
      : `고친 풀이: ${first.means}으로 늘어난 일을 줄였다는 부분은 빼고, 성과·자원을 늘리면 해결할 일도 함께 늘어날 수 있다는 가설만 남겨요. 이 가설은 아직 확인하지 않았어요.`;
    if (kind === 'mixed') core = `고친 풀이: ${first.means}이 늘어난 일을 다루는 데 도움이 된 범위와 그렇지 않은 범위가 함께 있다고 좁혀 읽어요. 두 범위를 가르는 조건은 명식이 아니라 말해 준 경험에서 왔어요.`;
    if (['contradicted', 'no-experience'].includes(kind) && evidence !== 'up') note = evidence === 'down'
      ? '일이 늘어난 적이 없다는 말이 성과·자원을 늘린 적이 없어서인지, 늘렸는데도 일이 늘지 않아서인지 하나만 물을게요.'
      : evidence === 'conflict' ? '앞뒤 답에서 일이 늘었는지가 서로 달라서 하나만 물을게요.'
        : kind === 'no-experience' ? '일이 늘어난 적이 없어서인지, 늘었지만 그렇게 대응해 본 적이 없어서인지 하나만 물을게요.' : null;
  } else if (isFirst && plan.mode === 'resource-duty') {
    if (kind === 'contradicted') core = `고친 풀이: 성과·자원 관리와 기준·책임이 서로 이어지기보다 따로 움직였거나 오히려 부딪혔을 가능성을 먼저 둬요. 어느 쪽이었는지는 아직 몰라요. ${NOT_A_HIT}`;
    if (kind === 'mixed') core = '고친 풀이: 성과·자원 관리가 기준·책임 수행에 도움이 된 범위와 그렇지 않은 범위가 함께 있다고 좁혀 읽어요. 두 범위를 가르는 조건은 명식이 아니라 말해 준 경험에서 왔어요.';
  } else {
    // Demand question: first in resource-demand mode, or the follow-up question.
    if (kind === 'supported' && prior) {
      status = null;
      core = `고친 풀이: 성과·자원을 늘리며 해결할 일도 함께 늘었다는 부분은 말해 준 경험 범위에서 받아들여요. ${priorNote} ${NOT_A_HIT}`;
    }
    if (kind === 'contradicted') core = prior === 'weakened'
      ? `고친 풀이: 앞의 대응 풀이와 이 풀이가 모두 낮아져, 이 천간 비교로는 말해 준 경험을 설명하지 못해요. ${plan.outside}`
      : `고친 풀이: 이 천간 비교로는 말해 준 경험을 설명하지 못해요.${prior === 'withheld' ? ` ${priorNote}` : ''} ${plan.outside}`;
    if (kind === 'mixed') core = '고친 풀이: 성과·자원을 늘린 일이 해결할 일도 늘린 범위와 그렇지 않은 범위가 함께 있다고 좁혀 읽어요. 두 범위를 가르는 조건은 명식이 아니라 말해 준 경험에서 왔어요.';
    if (!core && priorNote) note = priorNote;
  }
  return { status, core, note };
}

const result = (base, feedback, fields) => ({ ...base, ...fields, feedback: { ...feedback }, probability: null, trainingEligible: false });

/** Applies one answer to the pending question. Pure; returns the next state. */
export function advanceWorkFeedback(decision, plan, state, answer, { afterMenu = false } = {}) {
  const question = state.pending === 'first' ? plan.first : state.pending === 'demand' ? plan.demand : null;
  if (!question) return null;
  let read = readFeedbackAnswer(answer, question.kind, question.meansCue ?? null);
  if (!read) return null;
  // After the menu question a bare yes/no may answer the menu, not the owned question.
  if (afterMenu && (read.explicit ? read.kind === 'supported' : read.segments.every(s => ['affirm', 'negative', 'filler'].includes(s.tag)))) return null;
  const base = { questionId: question.id, targetCandidateId: question.candidate, answer: read,
    before: { questionId: question.id, targetCandidateId: question.candidate, reading: state.reading, feedback: { ...state.feedback } },
    beforeFeedback: { policy: decision.policy, scope: decision.scope, mode: decision.mode, selectedIds: [...decision.selectedIds], interpretation: decision.interpretation,
      candidates: decision.candidates.map(c => ({ id: c.id, status: c.status })) } };
  const heard = question.kind === 'help' && plan.demand ? read.demandEvidence : null;
  const evidence = mergeEvidence(state.evidence, heard);
  if (state.clarify && !read.kind.startsWith('clarify:') && !OFFERED[state.clarify].includes(read.kind))
    read = { ...read, kind: 'clarify:unclear' }; // only the options just offered are accepted
  if (read.kind.startsWith('clarify:')) {
    if (state.clarify) {
      const feedback = { ...state.feedback, [question.candidate]: 'unconfirmed' };
      let text = `구분할 수 있는 답을 얻지 못해 ‘${question.name}’는 확인되지 않은 상태로 둘게요. 같은 질문은 다시 묻지 않아요.`;
      if (evidence === 'up' && question.kind === 'help' && plan.demand) {
        feedback[plan.demand.candidate] = 'retained-as-self-report';
        text += '\n\n일이 늘었다는 말은 들었으니 그 부분은 말해 준 경험 범위에서 받아들여요.';
      }
      return result(base, feedback, { action: 'unresolved', after: 'unconfirmed', nextQuestion: null, revisedInterpretation: null, note: null, text,
        state: { ...state, pending: null, clarify: null, evidence, feedback } });
    }
    return result(base, state.feedback, { action: 'clarify', after: 'pending', nextQuestion: null, revisedInterpretation: null, note: null,
      text: clarifyText(read, question), state: { ...state, clarify: read.kind, evidence } });
  }
  const feedback = { ...state.feedback, [question.candidate]: AFTER[read.kind] };
  const { status, core, note } = revision(plan, question, read.kind, state, evidence);
  let evidenceLine = null;
  if (question.kind === 'help' && plan.demand && evidence === 'up' && feedback[plan.demand.candidate] !== 'retained-as-self-report') {
    feedback[plan.demand.candidate] = 'retained-as-self-report';
    if (read.kind !== 'contradicted') evidenceLine = '일이 늘었다는 말도 들었으니 그 부분은 말해 준 경험 범위에서 받아들여요.';
  }
  const askDemand = plan.demand && question.id === plan.first.id && ['contradicted', 'no-experience'].includes(read.kind)
    && evidence !== 'up' && !state.asked.includes(plan.demand.id);
  const next = askDemand ? plan.demand : null;
  const text = [understanding(read, question), status, evidenceLine, core, next ? note : null, next?.prompt,
    !next && note && !core ? note : null].filter(Boolean).join('\n\n');
  return result(base, feedback, { action: 'revise', after: AFTER[read.kind], revisedInterpretation: core, note,
    nextQuestion: next ? { id: next.id, prompt: next.prompt, targetCandidateId: next.candidate } : null, text,
    state: { ...state, pending: next ? 'demand' : null, clarify: null, evidence, feedback,
      reading: core ?? state.reading, asked: next ? [...state.asked, next.id] : state.asked } });
}

/** Replays the visible conversation from the latest shown owned question. Every
 * earlier answer must have been answered locally and shown completely; any other
 * assistant text (provider reply, partial reply) leaves the answer to chat. The menu
 * prompt may sit between a shown question and its answer; bare yes/no after it is chat. */
export function resolveWorkFeedback({ decision, footer = '', messages, answer, menuPrompts = [] }) {
  const plan = feedbackPlan(decision);
  if (!plan || !Array.isArray(messages) || typeof answer !== 'string') return null;
  const start = messages.findLastIndex(m => m?.role === 'assistant' && norm(m.text) === norm(plan.first.prompt));
  if (start < 0) return null;
  const owned = new Set([footer, ...String(footer).split(SENTENCE)].map(norm).filter(Boolean));
  const menus = new Set(menuPrompts.map(norm));
  let i = start + 1, afterMenu = false;
  while (i < messages.length && messages[i].role === 'assistant' && owned.has(norm(messages[i].text))) i++;
  const skipMenu = () => { while (i < messages.length && messages[i].role === 'assistant' && menus.has(norm(messages[i].text))) { afterMenu = true; i++; } };
  skipMenu();
  let state = { pending: 'first', clarify: null, evidence: null, feedback: {}, reading: decision.interpretation, asked: [decision.question.id] };
  while (i < messages.length) {
    if (messages[i].role !== 'user' || !state.pending) return null;
    const next = advanceWorkFeedback(decision, plan, state, messages[i].text, { afterMenu });
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
  return advanceWorkFeedback(decision, plan, state, answer, { afterMenu });
}
