// Natal basic temperament (성격 topic) read from the month branch pattern and the day branch, not the day pillar
// alone. Reference: 명리학탐구(중급1) 원국분석 101~107 — the day master, then the month branch (the pattern of its
// hidden stems: 정기, then 여기·중기, in the month stem first, then the other stems, else the month branch itself;
// 104·122), the pattern as the mind (104), a revealed hidden stem as the inner mind shown outward and acted on (104),
// the day branch as conduct and daily attitude with its ten-god character (106), then whether the day branch keeps
// to the pattern (104). The source states where the mind goes only for a strong 비견/겁재 pattern: to 식상·재성,
// away from the control of 관성 (103·104·106·125). References/assumptions:
// docs/knowledge-model/CONDITIONAL_TEMPERAMENT_READING.md. A hypothesis to check against experience: no verdict,
// good/bad character, strength degree or probability.
import { STEMS_HANJA, BRANCHES_HANJA, HIDDEN_STEMS, STEM_ELEMENT, TEN_GODS, tenGod, sexStem, sexBranch, sexName } from './tables.js';
import { strengthJudge } from './judge.js';
import { evaluateCondition } from './workCandidates.js';

const GROUPS = ['비겁', '식상', '재성', '관성', '인성'];
const STEM_PLACE = { year: '연간', month: '월간', hour: '시간' };
// Life-language paraphrases of the source's ten pattern characters (104 2.), used for the day branch as well (106 4.).
// Value words (고집·외골수·난폭 …) and outcomes (조직 적응 …) are left out.
export const TEMPERAMENT_TRAITS = Object.freeze({
  비견: '스스로 정하고 이끄는', // 고집·자존심, 모든 것을 자신이 주도, 간섭·통제를 꺼림
  겁재: '자기 기준을 지키며 주변을 살피는', // 비견과 비슷하나 유연성·융통성이 크고 조심성·경계심이 강함
  식신: '여유 있고 너그러운', // 여유, 선량
  상관: '틀보다 자기 뜻대로 표현하는', // 자유분방, 자신의 뜻대로, 즉흥, 제도·규율에 반발
  편재: '기회를 보면 빠르게 움직이는', // 경쟁의 투지·순발력, 영리, 자기 주도
  정재: '성실하게 쌓으며 안정을 챙기는', // 성실정직, 안정 우선
  편관: '원칙이 분명하고 결단이 빠른', // 고집·자존심, 판단력·결단력, 원칙·소신
  정관: '질서와 안정을 지키는', // 안정, 변화가 적음, 보수, 결단력은 다소 약함
  편인: '한 가지를 깊이 파고드는', // 자기중심, 외골수, 집념·끈기
  정인: '배운 것과 규칙을 존중하는', // 여유, 편견이 적음, 제도·규율 중시
});
export const TEMPERAMENT_LIMIT = '월지와 일지의 십성으로 기본 성향을 읽은 해석 가설이에요. 월간·시간·연주의 성향과 운의 시기는 아직 합치지 않았고, 성격을 좋고 나쁨으로 정하지 않아요.';
export const TEMPERAMENT_FOOTER = '답에 따라 이 풀이를 유지하거나 낮춰서 다시 읽어요. 답만으로 사주가 맞았다고 판단하지 않아요.';
export const TEMPERAMENT_NOTICE = '원국의 글자 자리로 읽은 성향 가설이에요. 실제 성격이나 좋고 나쁨을 확정하지 않으니 경험과 대조해서 읽어 주세요.';

// Particles follow the last syllable (hangul) or the reading of a hanja.
const HANJA_FINAL = '甲乙丙丁庚辛壬丑寅辰申戌';
const hasFinal = word => {
  const last = Array.from(String(word)).at(-1) ?? '';
  if (HANJA_FINAL.includes(last)) return true;
  const code = last.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
};
const rieul = word => { const code = (Array.from(String(word)).at(-1) ?? '').charCodeAt(0) - 0xac00; return code >= 0 && code % 28 === 8; };
export const j = (word, pair) => {
  const [a, b] = { 이: ['이', '가'], 은: ['은', '는'], 을: ['을', '를'], 과: ['과', '와'], 이에요: ['이에요', '예요'], 으로: ['으로', '로'] }[pair];
  if (pair === '으로') return `${word}${hasFinal(word) && !rieul(word) ? a : b}`;
  return `${word}${hasFinal(word) ? a : b}`;
};
// Only the particle; after 'X(십성)' it follows the hanja's reading, as elsewhere in the engine.
const pj = (word, pair) => j(word, pair).slice(String(word).length);
const look = god => `‘${TEMPERAMENT_TRAITS[god]} 모습’`;

/** The month branch pattern by the source's procedure (104·122): the hidden stems in the order 정기, 여기, 중기; the
 * month stem first, then the year/hour stems (the day master is not a revealed stem), else the month branch's 정기
 * itself (unrevealed). Alternatives of other schools are recorded, never used to choose the reading. */
export function monthPattern(pillarsIdx) {
  const day = sexStem(pillarsIdx.day), branch = sexBranch(pillarsIdx.month);
  const hidden = HIDDEN_STEMS[branch];
  const role = i => (i === hidden.length - 1 ? '정기' : i === 0 ? '여기' : '중기');
  const order = [hidden.length - 1, ...hidden.map((_, i) => i).slice(0, -1)];
  const stems = { year: sexStem(pillarsIdx.year), month: sexStem(pillarsIdx.month), hour: sexStem(pillarsIdx.hour) };
  const make = (i, source, positions) => {
    const stem = hidden[i], god = TEN_GODS[tenGod(day, stem)];
    return { stem, character: STEMS_HANJA[stem], god, group: GROUPS[Math.floor(tenGod(day, stem) / 2)], role: role(i),
      source, positions, revealed: source !== 'month-branch', branch, branchCharacter: BRANCHES_HANJA[branch] };
  };
  const find = (skip, others = ['year', 'hour']) => {
    for (const i of order) if (!skip(i) && stems.month === hidden[i]) return make(i, 'month-stem', ['month']);
    for (const i of order) {
      if (skip(i)) continue;
      const positions = others.filter(p => stems[p] === hidden[i]);
      if (positions.length) return make(i, 'other-stem', positions);
    }
    return null;
  };
  const pattern = find(() => false) ?? make(hidden.length - 1, 'month-branch', []);
  const alternatives = [];
  // 팔정격 (122): 비견·겁재 are not patterns; the next revealed non-peer hidden stem is, else there is none.
  if (pattern.group === '비겁') {
    const eight = find(i => GROUPS[Math.floor(tenGod(day, hidden[i]) / 2)] === '비겁');
    alternatives.push({ view: 'eight-patterns', god: eight?.god ?? null, character: eight?.character ?? null });
  }
  // Some schools count a reveal only in a stem near the month branch (초코서당 용어사전): the hour stem is not near.
  if (pattern.source === 'other-stem' && pattern.positions.includes('hour')) {
    const near = find(() => false, ['year']) ?? make(hidden.length - 1, 'month-branch', []);
    alternatives.push({ view: 'near-reveal-only', god: near.god, character: near.character, source: near.source });
  }
  // 변격 투간 (초코서당 용어사전): a stem of the same element but the other polarity counts as revealed in some schools.
  if (!pattern.revealed) {
    for (const i of order) {
      const positions = ['month', 'year', 'hour'].filter(p => stems[p] !== hidden[i] && STEM_ELEMENT[stems[p]] === STEM_ELEMENT[hidden[i]]);
      if (positions.length) {
        alternatives.push({ view: 'variant-reveal', god: TEN_GODS[tenGod(day, stems[positions[0]])], character: STEMS_HANJA[stems[positions[0]]], positions, hiddenRole: role(i) });
        break;
      }
    }
  }
  return { ...pattern, alternatives };
}

const feature = name => ({ feature: name });
const RULES = [
  // Source examples (104 예시2·103 예시2·106 3.): 비견격 신강, 편관 in the day branch blocks the mind; 충 makes no difference (104).
  { id: 'peer-blocked', specific: true, condition: { all: ['peerPattern', 'strong', 'dayAuthority'].map(feature) } },
  // Source examples (104 예시1·103 예시1·107): the 식상 (or 재성) the strong 비견격 mind goes to sits in the day branch.
  { id: 'peer-flow', specific: true, condition: { all: ['peerPattern', 'strong', 'dayOutlet'].map(feature) } },
  { id: 'one-direction', condition: feature('sameGroup') },
  { id: 'shown-together', condition: { all: [feature('revealed'), { not: feature('sameGroup') }] } },
  // App assumption: the converse of 104's revealed case (the source states only the revealed case).
  { id: 'inner-outer', condition: { all: [{ not: feature('revealed') }, { not: feature('sameGroup') }] } },
];
const NAMES = {
  'peer-blocked': '스스로 정한 방향과 생활 속 기준·책임이 부딪힌다는 풀이',
  'peer-flow': '하고 싶은 것을 평소 생활에서 바로 펼친다는 풀이',
  'one-direction': '속으로 바라는 방향과 평소 사는 방식이 같다는 풀이',
  'shown-together': '두 모습이 함께 겉으로 드러난다는 풀이',
  'inner-outer': '겉으로는 일지의 모습이, 속으로는 월지의 바탕이 있다는 풀이',
};
export const TEMPERAMENT_NAMES = Object.freeze({ ...NAMES });

function completeChart(chart) {
  const { hour, minute, hourUnknown } = chart?.input ?? {};
  return chart?.birthTime?.status !== 'unknown' && hourUnknown !== true &&
    Number.isInteger(hour) && hour >= 0 && hour < 24 && Number.isInteger(minute) && minute >= 0 && minute < 60 &&
    ['year', 'month', 'day', 'hour'].every(p => Number.isInteger(chart?.pillarsIdx?.[p]) && chart.pillarsIdx[p] >= 0 && chart.pillarsIdx[p] < 60);
}

/** Candidate comparison: a specific source-example rule, when it holds, supersedes the generic reading that also
 * holds (an explicit precedence, not a score). Exactly one generic rule holds for every complete chart. */
export function compareTemperamentCandidates(features) {
  const evaluated = RULES.map(rule => ({ id: rule.id, specific: Boolean(rule.specific), condition: evaluateCondition(rule.condition, features) }));
  const specific = evaluated.find(c => c.specific && c.condition.value === 1);
  return evaluated.map(c => ({ ...c, name: NAMES[c.id],
    status: c.condition.value === null ? 'withheld' : c.condition.value === 0 ? 'inapplicable'
      : specific && !c.specific ? 'superseded' : 'selected' }));
}

/** The basic temperament reading of a complete chart, or null (unknown birth time keeps the null contract). */
export function buildTemperamentReading(chart) {
  if (!completeChart(chart)) return null;
  const p = chart.pillarsIdx, day = sexStem(p.day), dayBranch = sexBranch(p.day);
  const pattern = monthPattern(p);
  const dayHidden = HIDDEN_STEMS[dayBranch], dayStemMain = dayHidden[dayHidden.length - 1];
  const dayGod = TEN_GODS[tenGod(day, dayStemMain)], dayGroup = GROUPS[Math.floor(tenGod(day, dayStemMain) / 2)];
  const dayMain = { stem: dayStemMain, character: STEMS_HANJA[dayStemMain], god: dayGod, group: dayGroup, branch: dayBranch, branchCharacter: BRANCHES_HANJA[dayBranch] };
  const strength = strengthJudge(chart);
  const band = ['신강', '극신강'].includes(strength.label) ? 'strong' : ['신약', '극신약'].includes(strength.label) ? 'weak' : 'balanced';
  const features = { revealed: +pattern.revealed, sameGroup: +(pattern.group === dayGroup), sameGod: +(pattern.god === dayGod),
    peerPattern: +(pattern.group === '비겁'), strong: +(band === 'strong'),
    dayAuthority: +(dayGroup === '관성'), dayOutlet: +['식상', '재성'].includes(dayGroup) };
  const candidates = compareTemperamentCandidates(features);
  const selectedIds = candidates.filter(c => c.status === 'selected').map(c => c.id);
  const mode = selectedIds[0];
  const A = look(pattern.god), B = look(dayGod);
  const where = pattern.positions.map(q => STEM_PLACE[q]).join('·');
  const facts = (pattern.source === 'month-stem'
    ? `월지 ${pattern.branchCharacter}의 지장간 가운데 ${pattern.role} ${pattern.character}(${pattern.god})${pj(pattern.character, '이')} 월간에 드러나, 바탕 성향을 ${j(pattern.god, '으로')} 읽어요.`
    : pattern.source === 'other-stem'
      ? `월지 ${pattern.branchCharacter}의 지장간 가운데 ${pattern.role} ${pattern.character}(${pattern.god})${pj(pattern.character, '이')} 월간이 아니라 ${where}에 드러나, 바탕 성향을 ${j(pattern.god, '으로')} 읽어요.`
      : `월지 ${pattern.branchCharacter}의 지장간은 일간 밖의 천간에 드러나지 않아, 월지 본기 ${pattern.character}(${pattern.god})${pj(pattern.character, '을')} 바탕 성향으로 읽어요.`) +
    ` 일지 ${dayMain.branchCharacter}의 본기 ${dayMain.character}(${dayGod})${pj(dayMain.character, '은')} 평소 생활 태도로 읽어요.` +
    (mode.startsWith('peer-') ? ` 원국 강약은 앱의 잠정 기준으로 ${j(strength.label, '이에요')}.` : '');
  const outlet = dayGroup === '식상';
  let interpretation, reason, alternative, prompt, followup = null;
  if (mode === 'peer-blocked') {
    interpretation = `스스로 정해 밀고 가려는 바탕(${pattern.god})이 큰데, 생활 태도의 자리인 일지에 기준·책임을 뜻하는 ${j(dayGod, '이')} 있어, 그 마음과 생활 속 기준·책임이 자주 부딪힌다고 읽어요.`;
    reason = `월지 바탕이 비겁이고 원국이 ${strength.label}이면 남의 간섭·통제는 꺼리고 표현·결과 쪽을 향한다고 보는데, 일지가 그 반대인 관성이라 다른 읽기보다 이 판단을 먼저 골랐어요.`;
    alternative = '부딪힌다는 말은 갈등의 크기나 결과를 정한 것이 아니에요. 기준·책임이 오히려 방향을 잡아 줬다면 이 판단을 낮춰야 해요. 월지·일지 사이에 충이 있는지는 이 판단을 바꾸지 않아요.';
    prompt = '스스로 정해서 밀고 가고 싶은데, 생활 속에서 지켜야 하는 기준·책임에 막혀 답답했던 적이 자주 있나요?';
  } else if (mode === 'peer-flow') {
    interpretation = `스스로 정해 밀고 가려는 바탕(${pattern.god})이 크고, 생활 태도의 자리인 일지에 ${outlet ? '표현·실행' : '결과·자원'}을 뜻하는 ${j(dayGod, '이')} 있어, 하고 싶은 것을 평소 생활에서 바로 ${outlet ? '표현하고 실행하는' : '결과로 만들어 가는'} 쪽으로 이어진다고 읽어요.`;
    reason = `월지 바탕이 비겁이고 원국이 ${strength.label}이면 마음이 표현·결과 쪽을 향한다고 보는데, 그 자리가 일지에 있어 다른 읽기보다 이 판단을 먼저 골랐어요.`;
    alternative = '이어진다는 말은 성공이나 성과를 정한 것이 아니에요. 하고 싶은 것과 실제 생활이 따로 움직였다면 이 판단을 낮춰야 해요.';
    prompt = `하고 싶은 것이 생기면 평소 생활에서 바로 ${outlet ? '표현하거나 실행하는' : '결과로 만들어 가는'} 편인가요?`;
  } else if (mode === 'one-direction') {
    interpretation = pattern.god === dayGod
      ? `월지의 바탕과 일지의 생활 태도가 같은 ${dayGod}${hasFinal(dayGod) ? '이라' : '라'}, 속으로 바라는 방향과 평소 사는 방식이 ${A}으로 한 방향이라고 읽어요.`
      : `월지의 바탕(${pattern.god})과 일지의 생활 태도(${dayGod})가 같은 ${dayGroup} 계열이라 한 방향으로 읽되, ${A}과 ${B}처럼 결은 조금 달라요.`;
    reason = `두 자리가 같은 계열이라 속과 겉을 나눠 읽는 판단보다 한 방향 판단을 골랐어요.${pattern.revealed ? ` 바탕이 ${where}에도 드러나 있어요.` : ''}`;
    alternative = '같은 계열이라고 그 성향이 더 세다는 뜻은 아니에요. 속으로 바라는 것과 평소 모습이 다르다고 느꼈다면 이 판단을 낮춰야 해요.';
    prompt = pattern.god === dayGod
      ? `속으로 바라는 것과 평소 사는 방식이 둘 다 ${A}에 가까운 편인가요?`
      : `속으로 바라는 것과 평소 사는 방식이 둘 다 ${A}이나 ${B}처럼 한 방향에 가까운 편인가요?`;
  } else if (mode === 'shown-together') {
    interpretation = `월지의 바탕(${pattern.god})이 ${where}에 드러나 있어, ${A}이 일지의 생활 태도인 ${B}과 함께 평소에도 겉으로 보인다고 읽어요.`;
    reason = '월지 지장간이 천간에 드러나면 속마음이 밖으로 나와 행동으로 옮긴다고 보는 관점을 따라, 바탕을 속마음에만 두는 판단보다 이 판단을 골랐어요.';
    alternative = '두 모습 중 어느 쪽이 먼저 나오는지는 상황에 따라 다를 수 있어요. 겉으로는 한쪽만 보인다고 느꼈다면 이 판단을 낮춰야 해요.';
    prompt = `${A}과 ${B}이 둘 다 평소에 겉으로 드러나는 편인가요?`;
    followup = { id: 'temperament-shown-inner', prompt: `그렇다면 겉으로는 ${B}이 주로 보이고, ${A}은 속으로만 바라는 편인가요?`, candidate: 'inner-outer' };
  } else {
    interpretation = `월지의 바탕(${pattern.god})은 천간에 드러나지 않아, 겉으로는 일지의 ${B}이 먼저 보이고 ${A}은 속마음 쪽에 있다고 읽어요.`;
    reason = '월지 지장간이 천간에 드러나면 속마음이 밖으로 나온다는 관점의 반대 경우를 앱이 가정해 고른 판단이에요. 드러나지 않은 경우를 원문이 직접 말하지는 않았어요.';
    alternative = `드러나지 않았다고 그 바탕이 약하다는 뜻은 아니에요. ${A}도 겉으로 자주 보인다면 이 판단을 낮춰야 해요.`;
    prompt = `주변에서는 ${B}으로 보는데, 속으로는 ${A}에 더 가깝다고 느낀 적이 있나요?`;
    followup = { id: 'temperament-inner-shown', prompt: `그렇다면 ${A}도 평소에 겉으로 드러나는 편인가요?`, candidate: 'shown-together' };
  }
  const question = { id: `temperament-${mode}`, prompt, clarifies: '선택한 성향 가설의 자기보고 일치·불일치·반대·때에 따라·모름; 자기보고는 독립 적중률이 아님' };
  const lines = [interpretation, facts, reason, alternative, TEMPERAMENT_LIMIT];
  return { policy: 'natal-temperament-v1', kind: 'conditional_temperament_reading', scope: 'month-pattern-day-branch-strength',
    assumption: '104·122 pattern procedure and ten pattern characters paraphrased; 106 day branch as conduct; the strong 비견/겁재 examples (103·104·106·107·125) moved to other day masters by ten-god relation; the unrevealed case is the converse of 104 (app assumption); not verified personal effects',
    dayPillar: sexName(p.day), pattern, dayMain, strength: { label: strength.label, score: strength.score, max: strength.max, band },
    features, candidates, selectedIds, active: true, mode, name: NAMES[mode],
    facts, interpretation, reason, alternative, lines, question, followup, footer: TEMPERAMENT_FOOTER,
    blocks: [{ label: '같은 일주여도 달라지는 부분', lines: [facts] },
      { label: '함께 읽으면', lines: [interpretation, reason, alternative, TEMPERAMENT_LIMIT] },
      { label: '경험으로 확인할 부분', lines: [prompt, TEMPERAMENT_FOOTER] }],
    note: TEMPERAMENT_NOTICE, beforeFeedback: true, predictionEnabled: false, probability: null, trainingEligible: false };
}
