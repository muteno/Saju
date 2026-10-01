// When an experience answer to the work question happened, compared with the 대운 periods read apart from the chart
// (daeunTiming.js). The natal revision is made from the answer alone (workFeedback.js); this layer only places the told
// time in a 대운 and says whether that period's luck condition explains it. A rootless stem shows only at times
// (2166 운에 따라 띄엄띄엄) and a root under 충 is used each time luck relieves it (2118 그때마다 사용), so the time
// of an experience is the information that tells the periods apart. References/assumptions:
// docs/knowledge-model/CONDITIONAL_WORK_READING.md (경험의 시기와 대운 대조).
// The period is placed only when the told age or year falls inside it for certain: one year on each side of a
// change (the existing 대운수 is a whole number and the change falls inside a year) and one year for the way the
// age is counted (만 나이·세는 나이) are left unknown. Nothing is stored, learned, scored or shown as a probability,
// and a period that matches a told time after the answer is not counted as a hit.
import { ROOTING_THEMES } from './rootingCandidates.js';

const STEM_PLACE = { year: '연간', month: '월간', hour: '시간' };
const GROUPS = ['비겁', '식상', '재성', '관성', '인성'];
const ROLES = ['자기 기준과 동료', '표현과 실행', '결과와 자원 관리', '규칙과 책임', '배움과 준비'];
const FINAL = '甲乙丙丁庚辛壬丑寅辰申戌';
const josa = (character, withFinal, without) => (FINAL.includes(character) ? withFinal : without);
const RULE_OF_MODE = { 'surface-only': 'rootless', 'season-surface': 'rootless', 'shaken-link': 'clashed', 'season-shaken': 'clashed' };

// ── Times told in an answer. Ages are a range in 연 나이 (year − birth year) units after the conversion below;
// years stay years. Relative times (요즘, 첫 직장 때) are kept as told and never placed.
const NATIVE_TENS = { 열: 10, 스무: 20, 스물: 20, 서른: 30, 마흔: 40, 쉰: 50, 예순: 60, 일흔: 70, 여든: 80, 아흔: 90 };
const NATIVE_ONES = { 한: 1, 하나: 1, 두: 2, 둘: 2, 세: 3, 셋: 3, 네: 4, 넷: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9 };
const SINO_TENS = { 이십: 20, 삼십: 30, 사십: 40, 오십: 50, 육십: 60, 칠십: 70, 팔십: 80, 구십: 90 };
// Parts of a decade, widened by a year because people place them loosely.
const PART = { 초반: [0, 4], 초: [0, 4], 중반: [3, 7], 중: [3, 7], 후반: [6, 9], 말: [6, 9], 말기: [6, 9] };
const PART_RE = '(초반|중반|후반|초|중|말기|말)';
const AFTER_PART = '(?=$|\\s|[,.~]|에|엔|부터|까지|쯤|무렵|때|즈음|는|은|이|가|도)';
const NOT_A_YEAR = '(?!\\s*(?:동안|간|넘게|정도|째|이상|가량|전|후|뒤|만에|차|이나|씩|가까이|(?:쯤|정도)\\s*(?:전|후|뒤|동안|넘게)))';
const SPAN_PATTERNS = [
  // 1990년대 후반 / 90년대
  [new RegExp(`^((?:19|20)?\\d)0\\s*년대(?:\\s*${PART_RE}${AFTER_PART})?`, 'u'), m => {
    const d = m[1].length === 1 ? Number(m[1]) * 10 : Number(m[1]) * 10;
    const [a, b] = m[2] ? PART[m[2]] : [0, 9];
    return { unit: 'year', from: d + a, to: d + b, short: m[1].length === 1 };
  }],
  // 2003~2005년 / 2003년부터 2005년까지
  [/^((?:19|20)\d{2})\s*(?:년(?:도)?)?\s*(?:~|-|–|부터|에서)\s*((?:19|20)?\d{2})\s*년(?:도)?(?:\s*까지)?/u, m => {
    const from = Number(m[1]), to = m[2].length === 2 ? Math.floor(from / 100) * 100 + Number(m[2]) : Number(m[2]);
    return to >= from ? { unit: 'year', from, to } : null;
  }],
  // 2005년 / 05년
  [new RegExp(`^(?:['’])?((?:19|20)\\d{2}|\\d{2})\\s*년(?:도)?${NOT_A_YEAR}`, 'u'), m => ({ unit: 'year', from: Number(m[1]), to: Number(m[1]), short: m[1].length === 2 })],
  // 25~28살 / 25살부터 28살까지
  [/^(\d{1,2})\s*(?:살|세)?\s*(?:~|-|–|부터|에서)\s*(\d{1,2})\s*(?:살|세)(?:\s*까지)?/u, m => (Number(m[2]) >= Number(m[1]) ? { unit: 'age', from: Number(m[1]), to: Number(m[2]) } : null)],
  // 20대 후반 / 삼십대 초반
  [new RegExp(`^(?:([1-9])0|(이십|삼십|사십|오십|육십|칠십|팔십|구십))\\s*대(?:\\s*${PART_RE}${AFTER_PART})?`, 'u'), m => {
    const d = m[1] ? Number(m[1]) * 10 : SINO_TENS[m[2]], [a, b] = m[3] ? PART[m[3]] : [0, 9];
    return { unit: 'age', from: d + a, to: d + b };
  }],
  // 25살 / 만 25세
  [/^(?:만\s*)?(\d{1,2})\s*(?:살|세)(?!\s*(?:이상|이하|넘|미만))/u, m => ({ unit: 'age', from: Number(m[1]), to: Number(m[1]) })],
  // 스물다섯 살 / 서른 살
  [/^(열|스무|스물|서른|마흔|쉰|예순|일흔|여든|아흔)\s*(한|하나|두|둘|세|셋|네|넷|다섯|여섯|일곱|여덟|아홉)?\s*살/u, m => {
    const n = NATIVE_TENS[m[1]] + (m[2] ? NATIVE_ONES[m[2]] : 0);
    return { unit: 'age', from: n, to: n };
  }],
];
const RELATIVE = /^(?:요즘|최근|지금|현재|작년|재작년|올해|올초|몇\s*년\s*(?:쯤|정도)?\s*전|\d+\s*년\s*(?:쯤|정도)?\s*(?:전|후|뒤)|예전|옛날|어릴\s*(?:적|때)|어렸을\s*때|학생\s*때|학창\s*시절|대학\s*(?:때|시절)|군\s*(?:대|복무)\s*(?:때)?|첫\s*직장|신입\s*(?:때|시절)?|입사\s*(?:초|때|후)?|결혼\s*(?:전|후|하고)?|출산\s*(?:전|후)?|퇴사\s*(?:전|후)?|이직\s*(?:전|후)?|그\s*당시|한창\s*때|젊을\s*때|젊었을\s*때|초년|중년|말년)/u;
// Words that only mark a time ('무렵엔', '때는', 'and' between two times).
const TIME_TAIL = /^(?:\s*(?:쯤|무렵|즈음|경|전후|때|시절|당시|사이|동안|정도|안팎)(?=$|[\s,.~!?…]|에|엔|는|은|이|가|부터|까지|땐|도|요))*(?:\s*(?:에는|에도|에서|에|엔|는|은|이|가|부터|까지|땐|도)(?=$|[\s,.~!?…]))?/u;
const JOINER = /^\s*(?:이랑|하고|랑|과|와|및|그리고|,|또는|아니면)\s*/u;

// What may follow a time when the clause is only a time ('25살 때요', '2005년쯤이었어요').
const TIME_ONLY_REST = /^(?:이었|였)?(?:어요|어|요|이요|예요|이에요|에요|입니다|습니다|죠|이죠|었죠)?$/u;

/** Times at the start of a clause; returns the spans, the relative times and the rest. */
export function leadingTimes(clause) {
  let rest = String(clause ?? '').trim();
  const spans = [], relative = [];
  for (let guard = 0; guard < 6 && rest; guard++) {
    let hit = null;
    for (const [re, make] of SPAN_PATTERNS) {
      const m = rest.match(re);
      if (m) { const span = make(m); if (span) { hit = { ...span, length: m[0].length }; break; } }
    }
    const rel = hit ? null : rest.match(RELATIVE);
    if (!hit && !rel) break;
    const length = hit ? hit.length : rel[0].length;
    const tail = rest.slice(length).match(TIME_TAIL)[0];
    const after = rest.slice(length + tail.length), join = after.match(JOINER);
    // A time ends at a space, a mark, a joiner or the end ('20대표' is not a time).
    if (after && !join && !/^[\s,.~!?…]/u.test(after) && !TIME_ONLY_REST.test(after)) break;
    const text = rest.slice(0, length + tail.length).trim().replace(/(?:에는|에도|에서|에|엔|는|은|이|가|땐|도|부터|까지)$/u, '').trim();
    if (hit) { const { length: _, ...span } = hit; spans.push({ ...span, text }); } else relative.push(text);
    rest = (join ? after.slice(join[0].length) : after).trim();
  }
  return { spans, relative, rest };
}

export const isTimeOnly = rest => TIME_ONLY_REST.test(String(rest ?? '').trim());

/** A told two-digit year becomes the year inside the life (birth year .. +99). */
function fullYear(span, birthYear) {
  if (!span.short) return span;
  if (birthYear === null) return null;
  const base = Math.floor(birthYear / 100) * 100;
  const shift = y => (y < birthYear ? y + 100 : y);
  return { ...span, from: shift(base + (span.from % 100)), to: shift(base + (span.to % 100)) };
}

/** 연 나이 range of a span: a told age N may be 만 나이 (N or N+1) or 세는 나이 (N−1). */
function ageRange(span, birthYear) {
  if (span.unit === 'age') return [span.from - 1, span.to + 1];
  const full = fullYear(span, birthYear);
  return full && birthYear !== null ? [full.from - birthYear, full.to - birthYear] : null;
}

const birthYearOf = periods => { const p = periods.find(x => x.startYear !== null); return p ? p.startYear - p.age : null; };

/** Where a told span falls among the ten periods: one period for certain, a change between periods, before the
 * first period, not yet come (only when the current year is given), or not placeable. */
export function placeSpan(periods, span, asOfYear = null) {
  const birthYear = birthYearOf(periods);
  const r = ageRange(span, birthYear);
  if (!r || r[0] < 0) return { place: 'unplaced' };
  if (Number.isInteger(asOfYear) && birthYear !== null && birthYear + r[0] > asOfYear) return { place: 'future' };
  const ages = periods.map(p => p.age), last = ages.length - 1;
  if (r[1] <= ages[0] - 2) return { place: 'before-first', first: periods[0] };
  if (r[0] >= ages[last] + 10) return { place: 'unplaced' };
  for (let k = 0; k <= last; k++) {
    const lo = ages[k] + 1, hi = (k < last ? ages[k + 1] : ages[k] + 10) - 2;
    if (r[0] >= lo && r[1] <= hi) return { place: 'period', period: periods[k] };
  }
  // The change(s) it touches: the first and the last period overlapping the range.
  const within = periods.filter((p, k) => r[1] >= ages[k] - 1 && r[0] <= (k < last ? ages[k + 1] : ages[k] + 10) - 1);
  const touched = r[0] < ages[0] - 1 ? [null, ...within] : within;
  return { place: 'boundary', from: touched[0] ?? null, to: touched.at(-1) ?? null };
}

// ── Plan: which periods could explain the asked link at a told time.
const label = x => `${x.age}세${x.startYear === null ? '' : `(${x.startYear}년)`} ${x.ganji}`;
const BRANCH_OF = x => x.ganji[1];

/** The timing comparison for a shown rooting/branch decision, or null when the 대운 layer is not shown for it.
 * With the current year (the app's today) a period that has not begun cannot explain a past experience. */
export function timingPlan(decision, timing, { asOfYear = null } = {}) {
  const rule = RULE_OF_MODE[decision?.mode];
  if (!rule || !timing?.active || timing.rule !== rule || timing.target?.mode !== decision.mode || timing.target?.policy !== decision.policy) return null;
  if (!Array.isArray(timing.periods) || !timing.periods.length || !Array.isArray(decision.roots) || !decision.roots.length) return null;
  const t = ROOTING_THEMES[decision.side], roots = decision.roots.filter((r, i, xs) => xs.findIndex(y => y.position === r.position) === i);
  const stemText = roots.map(r => `${STEM_PLACE[r.position]} ${r.character}`).join(', ');
  // Periods whose luck condition predicts the asked link (the other group's environment helping the visible side).
  const explainsAll = timing.periods.filter(x => (rule === 'rootless' ? x.status === 'root' && x.envLink : x.status === 'root' || x.status === 'relieve'));
  const year = Number.isInteger(asOfYear) ? asOfYear : null;
  const explains = year === null ? explainsAll : explainsAll.filter(x => x.startYear !== null && x.startYear <= year);
  return { rule, themes: t, stemText, stemLast: roots.at(-1).character, periods: timing.periods, explains: explains.map(x => x.order),
    explainsLater: explainsAll.length - explains.length, asOfYear: year, policy: timing.policy, candidates: timing.candidates };
}

export const TIMING_SINGLE = '그 도움이 있었던 때가 몇 살 무렵(또는 몇 년)이었는지 알려 주면, 원국 풀이와 따로 대운의 시기와 맞춰 볼게요. 기억나지 않으면 모른다고 해도 돼요.';
export const TIMING_SPLIT = '도움이 된 때와 그렇지 않았던 때가 각각 몇 살 무렵(또는 몇 년)이었는지 ‘25살 무렵엔 도움이 됐고 40살 무렵엔 아니었어요’처럼 나눠 말해 주면, 원국 풀이와 따로 대운의 시기와 맞춰 볼게요.';
export const TIMING_CLOSING = '말해 준 시기를 대운에 맞춰 본 것이라 대운 시기 후보의 적중으로 세지 않아요. 원국 풀이는 이 대조로 바꾸지 않았고, 세운·월운은 넣지 않았어요.';
export const TIMING_UNPLACED = '대운과 맞춰 볼 수 있는 시기와 경험이 없어 대운 대조는 미상으로 둘게요.';
export const TIMING_MARGIN = '대운이 바뀌는 해의 앞뒤 한 해와, 만 나이·세는 나이의 한 살 차이에 걸리는 때는 어느 대운인지 정하지 않아요.';

/** Whether an answer of this kind (natal revision already made) should be compared with the periods at all, and
 * whether any period could explain it. Rootless: a help that the chart does not explain (supported, mixed);
 * clashed: help at some times and not at others (mixed). Other answers are compared only when they tell a time. */
export function timingWanted(plan, kind) {
  if (!plan) return false;
  return plan.rule === 'rootless' ? ['supported', 'mixed', 'clarify:partial'].includes(kind) : ['mixed', 'clarify:partial'].includes(kind);
}

/** The line said when no period could explain the told help, so the time is not asked. */
export function noExplainingPeriod(plan, kind) {
  const { envTheme } = plan.themes, among = plan.explainsLater ? '지금까지 시작한 대운 가운데' : '열 개 대운 가운데';
  return plan.rule === 'rootless'
    ? `${among} ${envTheme} 환경을 근거로 ${plan.stemText}${josa(plan.stemLast, '이', '가')} 뿌리를 얻는 대운도 없어, ${kind === 'mixed' ? '도움이 된 때를' : '이 도움을'} 대운으로도 설명하지 못해요. ${TIMING_CLOSING.split('. ').at(-1)}`
    : `${among} 충을 풀어 주거나 ${envTheme} 환경으로 새 뿌리가 되는 대운이 없어, 도움이 된 때와 아니었던 때를 대운으로 가르지 못해요. ${TIMING_CLOSING.split('. ').at(-1)}`;
}

const hasFinal = text => { const c = Array.from(String(text)).at(-1)?.charCodeAt(0) - 0xac00; return c >= 0 && c <= 11171 && c % 28 !== 0; };
const topic = text => `‘${text}’${hasFinal(text) ? '은' : '는'}`;
const role = x => `‘${ROLES[GROUPS.indexOf(x.principal.group)]}’`;

/** One told experience at one placed period: the verdict and its sentence. */
function verdictOf(plan, polarity, period) {
  const { envTheme } = plan.themes, s = period.status, b = BRANCH_OF(period);
  const lowered = s === 'root-shaken' ? '뿌리가 되지만 원국 지지와 충이라 흔들리는 쪽으로 낮춰 본 때'
    : s === 'root-tilted' ? '뿌리가 되지만 원국 지지와 다른 기운으로 합해 약하게 본 때'
      : s === 'root-unknown' || s === 'relieve-unknown' ? '원국 지지와 충·합·형이 겹쳐 정하지 않은 때' : null;
  if (plan.rule === 'rootless') {
    const explains = s === 'root' && period.envLink;
    if (polarity === 'support') {
      if (explains) return { verdict: 'matched', text: `이 대운은 뿌리가 없던 ${plan.stemText}${josa(plan.stemLast, '이', '가')} ${b}에서 뿌리를 얻고 그 본기가 ${envTheme} 쪽이라, 그 환경을 근거로 드러나기 쉬운 시기 후보로 읽은 때예요. 원국 비교로는 설명하지 못한 도움을 이 대운으로 설명하는 후보로 둬요.` };
      if (lowered) return { verdict: 'not-adopted', text: `이 대운은 ${lowered}라, 그 도움의 설명으로 쓰지 않아요.` };
      if (s === 'root') return { verdict: 'unexplained', text: `이 대운에도 ${plan.stemText}${josa(plan.stemLast, '이', '가')} ${b}에서 뿌리를 얻지만 그 본기는 ${role(period)} 쪽이라, ${envTheme} 환경의 도움은 이 대운으로도 설명하지 못해요.` };
      return { verdict: 'unexplained', text: `이 대운의 ${b}에는 ${plan.stemText}의 뿌리가 없어, 그 도움은 대운으로도 설명하지 못해요.` };
    }
    if (explains) return { verdict: 'weakened', text: `이 대운은 ${envTheme} 환경을 근거로 드러나기 쉬운 시기 후보로 읽은 때인데 도움이 되지 않았다면, 이 대운 후보를 낮춰요.` };
    if (lowered) return { verdict: 'not-adopted', text: `이 대운은 ${lowered}라 대조에 쓰지 않아요.` };
    return { verdict: 'consistent', text: `이 대운은 ${envTheme} 환경을 근거로 뿌리를 얻는 때가 아니라, 도움이 되지 않았던 경험과 어긋나지 않아요.` };
  }
  const relief = s === 'relieve', root = s === 'root';
  const why = relief ? `${period.relief.haps.map(h => h.name).join('·')}으로 충을 풀어 줘 ${envTheme} 환경에 둔 원래 뿌리를 쓰기 쉬운 때`
    : `${b}이 ${envTheme} 환경으로 새 뿌리가 돼 근거를 다시 얻는 때`;
  if (polarity === 'support') {
    if (relief || root) return { verdict: 'matched', text: `이 대운은 ${why}로 읽은 대운이라, 그때 도움이 된 경험과 같은 방향이에요.` };
    if (lowered) return { verdict: 'not-adopted', text: `이 대운은 ${lowered}라, 그 도움의 설명으로 쓰지 않아요.` };
    return { verdict: 'unexplained', text: `이 대운은 충을 풀어 주지도 ${envTheme} 환경으로 새 뿌리가 되지도 않는 때라, 그때 도움이 된 까닭은 대운으로 설명하지 못해요. 흔들린다는 원국 풀이가 늘 도움이 안 된다는 뜻은 아니에요.` };
  }
  if (relief || root) return { verdict: 'weakened', text: `이 대운은 ${why}로 읽은 대운인데 도움이 되지 않았다면, 이 대운 후보를 낮춰요.` };
  if (lowered) return { verdict: 'not-adopted', text: `이 대운은 ${lowered}라 대조에 쓰지 않아요.` };
  return { verdict: 'consistent', text: '이 대운은 충을 풀어 주지도 새 뿌리가 되지도 않는 때라, 흔들린다는 원국 풀이와 같은 방향이에요.' };
}

/** Compares told experiences [{ polarity: 'support'|'contradict'|null, spans, relative }] with the periods.
 * Returns the sentences and a record per span; `placed` is false when no span could be placed in one period. */
export function compareTiming(plan, experiences) {
  const lines = [], record = [], feedback = {};
  let margin = false;
  for (const e of experiences) {
    for (const span of e.spans) {
      const where = placeSpan(plan.periods, span, plan.asOfYear);
      const row = { text: span.text, unit: span.unit, from: span.from, to: span.to, polarity: e.polarity, place: where.place, period: where.period?.order ?? null, verdict: null };
      if (where.place === 'period' && e.polarity) {
        const v = verdictOf(plan, e.polarity, where.period);
        row.verdict = v.verdict;
        lines.push(`${topic(span.text)} ${label(where.period)} 대운 안으로 읽었어요. ${v.text}`);
        if (v.verdict === 'matched') feedback[`daeun-${where.period.order}`] = 'matched-as-self-report';
        if (v.verdict === 'weakened') feedback[`daeun-${where.period.order}`] = 'weakened';
      } else if (where.place === 'period') {
        lines.push(`${topic(span.text)} ${label(where.period)} 대운 안이지만, 그때 도움이 됐는지 아니었는지가 나뉘지 않아 대조하지 않아요.`);
      } else if (where.place === 'boundary') {
        margin = true;
        lines.push(where.from && where.to && where.from !== where.to
          ? `${topic(span.text)} ${label(where.from)} 대운과 ${label(where.to)} 대운이 바뀌는 무렵에 걸쳐 어느 대운인지 정하지 않아요.`
          : `${topic(span.text)} ${where.to ? `첫 대운(${label(where.to)})이 시작하는` : '대운이 바뀌는'} 무렵에 걸쳐 어느 대운인지 정하지 않아요.`);
      } else if (where.place === 'future') {
        lines.push(`${topic(span.text)} 아직 오지 않은 때라 대운과 맞추지 않아요.`);
      } else if (where.place === 'before-first') {
        lines.push(`${topic(span.text)} 첫 대운(${label(where.first)})이 시작하기 전이라 대운과 맞추지 않아요.`);
      } else {
        lines.push(`${topic(span.text)} 나이나 연도로 정할 수 없어 대운과 맞추지 않아요.`);
      }
      record.push(row);
    }
    for (const text of e.relative) {
      lines.push(`${topic(text)} 나이나 연도로 정할 수 없어 대운과 맞추지 않아요.`);
      record.push({ text, unit: null, from: null, to: null, polarity: e.polarity, place: 'relative', period: null, verdict: null });
    }
  }
  const verdicts = record.map(r => r.verdict);
  const helpMatched = record.some(r => r.verdict === 'matched' && r.polarity === 'support');
  const noHelpApart = record.some(r => r.verdict === 'consistent' && r.polarity === 'contradict');
  if (helpMatched && noHelpApart) lines.push('도움이 된 때와 아니었던 때를 가르는 조건을 원국이 아니라 대운에서 찾은 후보로 둬요.');
  if (margin) lines.push(TIMING_MARGIN);
  const placed = verdicts.some(Boolean);
  lines.push(placed ? TIMING_CLOSING : TIMING_UNPLACED);
  return { lines, record, feedback, placed };
}

// ── The answer to the asked time question. Every clause must be a time, a polarity for the times, or a filler.
const SUPPORT_REST = /^(?:그때|그\s*때|그\s*무렵|그\s*시기)?\s*(?:(?:도움(?:이|을|은)?\s*(?:많이|좀|꽤|크게|제일|가장)?\s*(?:됐|되었|됬|받았)|좋았|나았|편했|수월했|그랬)(?:어요|어|습니다|죠|었어요|더라고요|던\s*것\s*같아요)?|도움이\s*된\s*(?:건|게|것은|때는|때가))$/u;
const CONTRA_REST = /^(?:그때|그\s*때|그\s*무렵|그\s*시기)?\s*(?:(?:도움(?:이|은|도)?\s*(?:별로|전혀|하나도|그다지|딱히)?\s*(?:안|못)\s*(?:됐|되었|됬|받았)|도움(?:이|은|도)?\s*되지\s*(?:않았|못했)|아니었|아녔|안\s*그랬|별로였|힘들었|부딪혔)(?:어요|어|습니다|죠|더라고요)?|아니(?:에요|었어요|었죠|요)?|도움이\s*안\s*된\s*(?:건|게|것은|때는|때가))$/u;
/** The side a short rest after a time tells ('아니었', '도움이 됐'), or null. */
export const sideOfRest = rest => { const r = String(rest ?? '').trim(); return SUPPORT_REST.test(r) ? 'support' : CONTRA_REST.test(r) ? 'contradict' : null; };
const FILLER_REST = /^(?:네|예|음+|아마|아마도|대략|대충|한|그러니까|정확히는|기억으로는|제\s*기억엔|그게)?$/u;
const UNSURE = /^(?:(?:잘\s*)?모르겠(?:어요|어|습니다|네요)|몰라요|기억(?:이)?\s*(?:잘\s*)?안\s*나(?:요|네요)|기억이\s*안\s*나요|글쎄요|정확히는\s*모르겠어요|언제였는지\s*(?:잘\s*)?모르겠어요)$/u;
const DECLINE = /^(?:말하고\s*싶지\s*않아요|말하기\s*싫어요?|답하지\s*않을래요|답하기\s*싫어요|패스(?:할게요|할래요|요)?|넘어갈게요|넘어갈래요|노코멘트|비밀이에요)$/u;
const ASKING = /[?？]|까요|나요|어때|알려\s*주세요|알려줘|궁금/u;
const TIME_CUE = /\d|살|세|년|대|때|무렵|쯤|요즘|최근|지금|작년|예전|옛날|초반|중반|후반|시절|직장|입사|학교|당시/u;

/** Reads the answer to the asked time question. `polarity` is the told side when only one side was asked
 * ('support'), or null when both sides were asked. Returns null for questions and text without a time cue. */
export function readTimingAnswer(answer, polarity, clauses) {
  const text = String(answer ?? '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 240 || ASKING.test(text)) return null;
  const bare = text.replace(/[.!。!~…]+$/u, '').trim();
  if (UNSURE.test(bare)) return { kind: 'unsure', text, experiences: [] };
  if (DECLINE.test(bare)) return { kind: 'unanswered', text, experiences: [] };
  if (!TIME_CUE.test(text)) return null;
  const experiences = [];
  let waiting = null, unclear = false;
  for (const clause of clauses(text)) {
    const { spans, relative, rest } = leadingTimes(clause.core);
    const r = rest.replace(/[.!。!~…]+$/u, '').trim();
    const side = SUPPORT_REST.test(r) ? 'support' : CONTRA_REST.test(r) ? 'contradict' : (isTimeOnly(r) || FILLER_REST.test(r)) ? null : 'unread';
    if (side === 'unread') { unclear = true; break; }
    if (spans.length || relative.length) {
      const e = { polarity: side, spans, relative };
      experiences.push(e);
      waiting = side ? null : e;
    } else if (side && waiting) { waiting.polarity = side; waiting = null; }
    else if (side && !experiences.length) { /* a polarity before any time: wait for the time */ waiting = null; }
  }
  if (unclear || !experiences.length) return { kind: 'unclear', text, experiences: [] };
  for (const e of experiences) if (!e.polarity && polarity) e.polarity = polarity;
  return { kind: 'timed', text, experiences };
}
