// Natal close-relationship reading (관계 topic) read from the spouse star, not the day pillar alone. Reference:
// 명리학탐구 — the spouse is the controlling relation (여명 관성, 남명 재성), whose bond (인연) needs the star to face
// the day master from the same pillar or right beside it (월간·일지·시간; 연간·연지·월지·시지 hardly face it), whose
// warmth (정) is the harmony of yin and yang with the day master (정관·정재, not 편관·편재), best when it combines
// with the day master (고급2 401·404·406·407, 고급1 314·315, 중급1 105·106); a 월간 편관 bridged by 인성 in the
// month or day branch protects the day master instead of pressing it (중급1 105·110, 고급1 315); hidden stems show
// the inner mind of a relation (고급2 404). When a woman's chart is the strong 비견/겁재 pattern whose mind is
// blocked by the 관성 in the day branch (the temperament reading's ‘부딪힘’), that 관성 is also her spouse star in the
// spouse palace: the source reads the same day branch as the partner who checks her own direction (중급1 104 예시2,
// 106 3.), so the relationship reading follows the same condition instead of contradicting it. Outcome sentences of
// the source (marriage, divorce, 덕, timing, infidelity, a missing star as a lack of bond) are never delivered.
// References/assumptions: docs/knowledge-model/CONDITIONAL_RELATION_READING.md. A hypothesis to check against
// experience: no verdict on a partner or relationship, no strength degree or probability.
import { STEMS_HANJA, BRANCHES_HANJA, HIDDEN_STEMS, TEN_GODS, tenGod, sexStem, sexBranch, sexName } from './tables.js';
import { evaluateCondition } from './workCandidates.js';
import { detectRelations } from './relations.js';
import { j, buildTemperamentReading } from './temperamentCandidates.js';

// Only the particle; after 'X(십성)' it follows the hanja's reading, as elsewhere in the engine.
const pj = (word, pair) => j(word, pair).slice(String(word).length);

const GROUPS = ['비겁', '식상', '재성', '관성', '인성'];
const groupOf = (day, stem) => GROUPS[Math.floor(tenGod(day, stem) / 2)];
export const SPOUSE_GROUP = Object.freeze({ F: '관성', M: '재성' });
const PLACE = { yearStem: '연간', monthStem: '월간', hourStem: '시간', yearBranch: '연지', monthBranch: '월지', dayBranch: '일지', hourBranch: '시지' };
// 고급2 407 223·401 62: the same pillar or right beside the day master faces it.
const FACING = ['monthStem', 'dayBranch', 'hourStem'];
const STEM_PILLAR = { yearStem: 'year', monthStem: 'month', hourStem: 'hour' };
const BRANCH_PILLAR = { yearBranch: 'year', monthBranch: 'month', dayBranch: 'day', hourBranch: 'hour' };
const STEM_HAP = [[0, 5], [1, 6], [2, 7], [3, 8], [4, 9]];
const combines = (a, b) => STEM_HAP.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

export const RELATION_LIMIT = '입력한 성별에 따라 전통 관법(여명은 관성, 남명은 재성)으로 배우자의 별을 정하고, 그 자리와 음양만 비교한 해석 가설이에요. 실제 상대가 어떤 사람인지, 연애·결혼의 여부와 시기·결과는 정하지 않아요.';
export const RELATION_FOOTER = '답에 따라 이 관계 풀이를 유지하거나 낮춰서 다시 읽어요. 답만으로 사주가 맞았다고 판단하지 않아요.';
export const RELATION_NOTICE = '원국에서 배우자의 별이 놓인 자리로 읽은 관계 방식 가설이에요. 실제 관계나 상대를 확정하지 않으니 경험과 대조해서 읽어 주세요.';

const feature = name => ({ feature: name });
const RULES = [
  // 중급1 104 예시2 (121~124·175~179)·106 3. (219~224): 여명, 비견격 신강 with 관성 in the day branch — the husband star
  // the strong mind does not go to checks the day master’s direction (the temperament reading’s ‘peer-blocked’); a 정관
  // there keeps its warmth beside the friction (고급1 315 347~349: 인연·정 있으나 지향점이 달라 갈등). First: the source
  // puts the mind’s direction before the star’s use (170·179); over a combination it is an app precedence (no source
  // example has both), so the combination is the next question.
  { id: 'near-checked', specific: true, condition: { all: ['facing', 'checked'].map(feature) } },
  // 고급1 314 322·315 344, 고급2 406 193·407 229, 고급1 315 346, 고급2 688: a 정재/정관 beside the day master that combines with it.
  { id: 'near-bonded', specific: true, condition: { all: ['facing', 'warmAll', 'bonded'].map(feature) } },
  // 중급1 105 200·110 317~318, 고급1 315 337~340: a 월간 편관 bridged by 인성 in the month or day branch.
  { id: 'near-bridged', specific: true, condition: { all: ['facing', 'firmAll', 'bridged'].map(feature) } },
  { id: 'near-warm', condition: { all: ['facing', 'warmAll'].map(feature) } },
  { id: 'near-firm', condition: { all: ['facing', 'firmAll'].map(feature) } },
  { id: 'near-mixed', condition: { all: ['facing', 'mixed'].map(feature) } },
  { id: 'far', condition: { all: [{ not: feature('facing') }, feature('visible')] } },
  { id: 'hidden', condition: { all: [{ not: feature('visible') }, feature('hiddenStar')] } },
  { id: 'absent', condition: { all: [{ not: feature('visible') }, { not: feature('hiddenStar') }] } },
];
const NAMES = {
  'near-checked': '가까운 사람이 내가 하려는 일에 제동을 거는 것처럼 느껴져 부딪히기 쉽다는 풀이',
  'near-bonded': '가까운 사람과 마음을 묶어 안정된 생활을 함께 꾸려 간다는 풀이',
  'near-bridged': '다정한 표현은 적어도 서로 맡은 역할을 믿고 기댄다는 풀이',
  'near-warm': '가까운 관계가 생활 가까이에 있고 다정한 마음이 오간다는 풀이',
  'near-firm': '가까운 관계가 생활 가까이에 있지만 다정한 표현보다 기준·역할이 먼저 선다는 풀이',
  'near-mixed': '가까운 관계에서 다정함과 기준이 함께 있다는 풀이',
  far: '가까운 관계를 생활과 조금 거리를 둔 채 이어 간다는 풀이',
  hidden: '가까운 관계에 대한 마음이 겉보다 속에 머문다는 풀이',
  absent: '배우자 자리인 일지의 모습을 가까운 사이에서도 그대로 보인다는 풀이',
};
export const RELATION_NAMES = Object.freeze({ ...NAMES });
// The complementary reading asked once after a first ‘no’ (warmth readings only).
export const RELATION_OPPOSITE = Object.freeze({ 'near-warm': 'near-firm', 'near-firm': 'near-warm', 'near-mixed': 'near-firm' });

function completeChart(chart) {
  const { hour, minute, hourUnknown, gender } = chart?.input ?? {};
  return chart?.birthTime?.status !== 'unknown' && hourUnknown !== true && (gender === 'M' || gender === 'F') &&
    Number.isInteger(hour) && hour >= 0 && hour < 24 && Number.isInteger(minute) && minute >= 0 && minute < 60 &&
    ['year', 'month', 'day', 'hour'].every(p => Number.isInteger(chart?.pillarsIdx?.[p]) && chart.pillarsIdx[p] >= 0 && chart.pillarsIdx[p] < 60);
}

/** The spouse stars of a chart by place: stems (the day master excluded) and branch 본기 are visible; 여기·중기 are
 * hidden (고급2 404 127). `warm` = 정 (the other polarity, 고급2 401 53). */
export function spouseStars(pillarsIdx, gender) {
  const day = sexStem(pillarsIdx.day), want = SPOUSE_GROUP[gender];
  const star = (place, stem, extra = {}) => ({ place, placeName: PLACE[place], stem, character: STEMS_HANJA[stem],
    god: TEN_GODS[tenGod(day, stem)], warm: tenGod(day, stem) % 2 === 1, facing: FACING.includes(place), ...extra });
  const visible = [], hidden = [];
  for (const [place, pillar] of Object.entries(STEM_PILLAR)) {
    const stem = sexStem(pillarsIdx[pillar]);
    if (groupOf(day, stem) === want) visible.push(star(place, stem));
  }
  for (const [place, pillar] of Object.entries(BRANCH_PILLAR)) {
    const branch = sexBranch(pillarsIdx[pillar]), stems = HIDDEN_STEMS[branch];
    const main = stems[stems.length - 1], branchCharacter = BRANCHES_HANJA[branch];
    if (groupOf(day, main) === want) visible.push(star(place, main, { branch, branchCharacter, role: '본기' }));
    for (const stem of stems.slice(0, -1)) if (groupOf(day, stem) === want)
      hidden.push(star(place, stem, { branch, branchCharacter, role: stems.length === 3 && stem === stems[1] ? '중기' : '여기', facing: false }));
  }
  return { group: want, visible, hidden, facing: visible.filter(s => s.facing), far: visible.filter(s => !s.facing) };
}

/** Candidate comparison: the first specific source rule that holds (in the order of RULES) supersedes every other
 * rule that also holds, generic or specific (an explicit precedence, not a score). Exactly one generic rule holds for
 * every complete chart. */
export function compareRelationCandidates(features) {
  const evaluated = RULES.map(rule => ({ id: rule.id, specific: Boolean(rule.specific), condition: evaluateCondition(rule.condition, features) }));
  const specific = evaluated.find(c => c.specific && c.condition.value === 1);
  return evaluated.map(c => ({ ...c, name: NAMES[c.id],
    status: c.condition.value === null ? 'withheld' : c.condition.value === 0 ? 'inapplicable'
      : specific && c.id !== specific.id ? 'superseded' : 'selected' }));
}

const label = s => s.role ? `${s.placeName} ${s.branchCharacter}의 ${s.role === '본기' ? '본기' : '지장간'} ${s.character}(${s.god})` : `${s.placeName} ${s.character}(${s.god})`;
const list = stars => stars.map(label).join(', ');
const places = stars => [...new Set(stars.map(s => s.placeName))].join('·');

/** The close-relationship reading of a complete chart, or null (unknown birth time and a missing gender). */
export function buildRelationReading(chart) {
  if (!completeChart(chart)) return null;
  const p = chart.pillarsIdx, gender = chart.input.gender, day = sexStem(p.day), dayBranch = sexBranch(p.day);
  const stars = spouseStars(p, gender);
  const { facing } = stars;
  const warm = facing.filter(s => s.warm), firm = facing.filter(s => !s.warm);
  const bondedStar = warm.find(s => combines(day, s.stem)) ?? null;
  // The source examples bridge a 월간 편관 only (중급1 105·110, 고급1 315): 인성 본기 in the month or day branch.
  const bridgeBranch = ['month', 'day'].find(q => groupOf(day, HIDDEN_STEMS[sexBranch(p[q])].at(-1)) === '인성') ?? null;
  const bridged = gender === 'F' && facing.length > 0 && facing.every(s => s.place === 'monthStem' && !s.warm) && bridgeBranch !== null;
  // The same condition as the temperament reading’s ‘peer-blocked’ (one source of truth): for a woman its 일지 관성 is
  // the spouse star in the spouse palace. For a man that 관성 is not the spouse star (104 178 reads it as work).
  const temperament = buildTemperamentReading(chart);
  const palaceStar = facing.find(s => s.place === 'dayBranch') ?? null;
  const checked = gender === 'F' && temperament?.mode === 'peer-blocked' && palaceStar !== null;
  const features = { facing: +(facing.length > 0), visible: +(stars.visible.length > 0), hiddenStar: +(stars.hidden.length > 0),
    warmAll: +(facing.length > 0 && firm.length === 0), firmAll: +(facing.length > 0 && warm.length === 0),
    mixed: +(warm.length > 0 && firm.length > 0), bonded: +(bondedStar !== null), bridged: +bridged, checked: +checked };
  const candidates = compareRelationCandidates(features);
  const selectedIds = candidates.filter(c => c.status === 'selected').map(c => c.id);
  const mode = selectedIds[0];
  const relations = detectRelations(p);
  // Recorded, not used to choose (고급2 401 48·407 215 judge a clashed spouse palace; its effect is stated as an outcome).
  const palaceClash = relations.chung.filter(r => r.positions.includes('일')).map(r => r.name);
  const star = `배우자의 별인 ${stars.group}`;
  const hanjaDay = STEMS_HANJA[day];
  const where = (mode.startsWith('near-') ? `${star}${pj(stars.group, '이')} 일간 바로 곁인 ${list(facing)}에 있어요.`
    : mode === 'far' ? `${star}${pj(stars.group, '이')} 일간 곁(월간·일지·시간)이 아니라 ${list(stars.far)}에만 있어요.`
      : mode === 'hidden' ? `${star}${pj(stars.group, '이')} 천간과 지지 본기에는 없고 ${list(stars.hidden)}에만 있어요.`
        : `${star}${pj(stars.group, '이')} 천간·지지 본기·지장간 어디에도 보이지 않아요.`) +
    (bondedStar && ['near-bonded', 'near-mixed', 'near-checked'].includes(mode)
      ? ` ${facing.length > 1 ? `그중 ${label(bondedStar)}` : `이 ${bondedStar.character}(${bondedStar.god})`}${pj(bondedStar.character, '은')} 일간 ${hanjaDay}${pj(hanjaDay, '과')} ${bondedStar.role ? '명암합' : '합'}을 이뤄요.` : '') +
    (mode === 'near-bridged' ? ` 월간 편관과 일간 사이를 ${bridgeBranch === 'month' ? '월지' : '일지'} ${BRANCHES_HANJA[sexBranch(p[bridgeBranch])]}의 본기 인성이 이어 줘요.` : '') +
    (mode.startsWith('near-') && stars.far.length ? ` 그 밖에 ${list(stars.far)}에도 있어요.` : '') +
    (mode === 'near-checked' ? ` 월지 바탕은 ${temperament.pattern.god}이고, 원국 강약은 앱의 잠정 기준으로 ${j(temperament.strength.label, '이에요')}.` : '');
  const groupWord = stars.group === '관성' ? '원칙과 기준' : '현실의 일과 역할';
  let interpretation, reason, alternative, prompt, followup = null;
  if (mode === 'near-checked') {
    // The warmth of the star (정) is kept apart from the check on the day master’s direction (106 220~224 judge 인연,
    // 정 and the check separately).
    const tone = palaceStar.warm ? '다만 일간과 음양이 조화되는 별이라 다정한 마음은 오갈 수 있어요.'
      : '일간과 음양이 같은 별이라 다정한 표현보다 서로의 기준이 앞서는 쪽이에요.';
    interpretation = `배우자의 별인 ${palaceStar.god}${pj(palaceStar.god, '이')} 배우자 자리인 일지에 있어 가까운 관계가 생활 한가운데에 있는데, 스스로 정해 밀고 가려는 바탕이 큰 원국이라 가까운 사람이 내가 하려는 일에 제동을 거는 것처럼 느껴져 부딪히기 쉽다고 읽어요. ${tone}`;
    // The reading it replaces, named by the candidate it superseded (a combination first, else the generic one).
    const over = { 'near-bonded': '합으로 묶어 꾸려 간다고만', 'near-warm': '다정함만', 'near-firm': '기준이 먼저 선다고만', 'near-mixed': '다정함과 기준이 함께 있다고만' };
    const replaced = ['near-bonded', 'near-warm', 'near-firm', 'near-mixed'].find(id => candidates.some(c => c.id === id && c.status === 'superseded'));
    reason = `월지 바탕이 비겁이고 원국이 ${temperament.strength.label}이면 마음이 표현·결과 쪽을 향해 관성의 간섭·통제를 꺼린다고 보는데(성격 풀이의 ‘부딪힘’과 같은 조건이에요), 여명에게 그 일지의 관성은 배우자의 별이라 ${over[replaced]} 읽는 판단보다 이 판단을 먼저 골랐어요.`;
    alternative = '부딪히기 쉽다는 말은 사이가 나쁘다거나 관계의 결과를 정한 것이 아니에요. 가까운 사람이 오히려 내가 하려는 일의 방향을 잡아 주거나 힘이 됐다면 이 판단을 낮춰야 해요.';
    prompt = '가까운 사람이 내가 스스로 정해 밀고 가려는 일에 제동을 거는 것처럼 느껴져 부딪힌 적이 자주 있나요?';
    // The next question is the reading it superseded: a combination (no source example decides between the two; the
    // answer does), else the warmth of the day-branch star.
    followup = replaced === 'near-bonded'
      ? { id: 'relation-checked-bonded', prompt: '그렇다면 가까운 사람과 마음을 묶어 안정된 생활을 함께 꾸려 가는 편인가요?', candidate: 'near-bonded' }
      : palaceStar.warm
        ? { id: 'relation-checked-warm', prompt: '그렇다면 가까운 사람과는 다정한 말과 마음 표현이 자연스럽게 오가는 편인가요?', candidate: 'near-warm' }
        : { id: 'relation-checked-firm', prompt: '그렇다면 가까운 사람과는 다정한 표현보다 각자의 원칙과 기준을 먼저 세우는 편인가요?', candidate: 'near-firm' };
  } else if (mode === 'near-bonded') {
    interpretation = `일간과 음양이 조화되는 ${bondedStar.god}${pj(bondedStar.god, '이')} 바로 곁에서 일간과 합을 이뤄, 가까운 사람과 마음을 묶어 안정된 생활을 함께 꾸려 가려는 쪽으로 읽어요.`;
    reason = '배우자의 별이 바로 곁에서 일간과 합하고 음양이 조화되면, 현실적이고 안정된 삶을 함께 추구한다고 보는 관점을 따라 다정함만 읽는 판단보다 이 판단을 먼저 골랐어요.';
    alternative = '안정을 함께 꾸린다는 말은 관계가 오래 간다거나 결혼한다는 뜻이 아니에요. 가까운 사람과도 각자 따로 움직이는 편이라면 이 판단을 낮춰야 해요.';
    prompt = '가까운 관계가 생기면 마음을 묶어 안정된 생활을 함께 꾸려 가려는 편인가요?';
    followup = { id: 'relation-bonded-warm', prompt: '그렇다면 묶어 가는 것까지는 아니어도, 가까운 사람과 다정한 말과 마음 표현은 자연스럽게 오가는 편인가요?', candidate: 'near-warm' };
  } else if (mode === 'near-bridged') {
    interpretation = '배우자의 별인 월간 편관은 일간과 음양이 조화되지 않지만 인성이 둘 사이를 이어 줘, 다정한 표현은 많지 않아도 서로 맡은 역할을 믿고 기대는 쪽으로 읽어요.';
    reason = '월간 편관은 예민함과 부딪힘으로 읽기 쉽지만, 편관과 일간 사이를 인성이 이어 주면 일간을 지키는 쪽으로 바뀐다고 보는 관점을 따라 기준이 먼저 서는 판단보다 이 판단을 먼저 골랐어요.';
    alternative = '믿고 기댄다는 말은 관계의 결과를 정한 것이 아니에요. 가까운 사람의 말과 행동에 예민하게 부딪히는 일이 잦았다면 이 판단을 낮춰야 해요.';
    prompt = '가까운 사람과 다정한 표현은 많지 않아도, 서로 맡은 역할을 믿고 기대는 편인가요?';
    followup = { id: 'relation-bridged-pressed', prompt: '그렇다면 가까운 사람의 말과 행동에 예민하게 반응해 부딪히는 일이 잦은 편인가요?', candidate: 'near-firm' };
  } else if (mode === 'near-warm') {
    interpretation = `배우자의 별(${[...new Set(warm.map(s => s.god))].join('·')})이 일간 바로 곁에 있고 일간과 음양이 조화돼, 가까운 관계가 생활 가까이에 있고 다정한 마음도 자연스럽게 오간다고 읽어요.`;
    reason = '배우자의 별이 일간과 같은 기둥이나 바로 옆에서 서로 향하면 가깝게 이어지고, 음양이 다르면 정이 있다고 보는 관점을 따라 거리를 두거나 기준이 먼저 서는 판단보다 이 판단을 골랐어요.';
    alternative = '다정함이 오간다는 말은 관계가 늘 순탄하다는 뜻이 아니에요. 가까운 사이에서도 다정한 표현보다 각자의 기준과 역할이 먼저 선다면 이 판단을 낮춰야 해요.';
    prompt = '가까운 사람과는 다정한 말과 마음 표현이 자연스럽게 오가는 편인가요?';
    followup = { id: 'relation-warm-firm', prompt: '그렇다면 가까운 사이에서도 다정한 표현보다 각자의 기준과 역할을 먼저 챙기는 편인가요?', candidate: 'near-firm' };
  } else if (mode === 'near-firm') {
    interpretation = `배우자의 별(${[...new Set(firm.map(s => s.god))].join('·')})이 일간 바로 곁에 있어 가까운 관계가 생활 가까이에 있지만, 일간과 음양이 같아 다정한 표현보다 ${groupWord}${pj(groupWord, '이')} 먼저 선다고 읽어요.`;
    reason = `가까운 자리라 생활 가까이에 있다고 보되, 배우자의 별이 일간과 음양이 같으면 다정한 면은 덜하다고 보는 관점을 따라 이 판단을 골랐어요.${firm.some(s => s.place === 'monthStem') && stars.group === '관성' ? ' 월간 편관과 일간 사이를 이어 주는 인성은 월지·일지에 없어요.' : ''}`;
    alternative = `${stars.group === '관성' ? '기준' : '역할'}이 먼저 선다는 말은 사이가 나쁘다는 뜻이 아니에요. 다정한 말과 마음 표현이 자연스럽게 오간다면 이 판단을 낮춰야 해요.`;
    prompt = stars.group === '관성' ? '가까운 사람과는 다정한 표현보다 각자의 원칙과 기준을 먼저 세우는 편인가요?'
      : '가까운 사람과는 다정한 표현보다 현실의 일과 역할을 함께 챙기는 쪽으로 지내는 편인가요?';
    followup = { id: 'relation-firm-warm', prompt: '그렇다면 가까운 사람과는 다정한 말과 마음 표현이 자연스럽게 오가는 편인가요?', candidate: 'near-warm' };
  } else if (mode === 'near-mixed') {
    interpretation = `일간 곁에 음양이 조화되는 별(${[...new Set(warm.map(s => s.god))].join('·')})과 조화되지 않는 별(${[...new Set(firm.map(s => s.god))].join('·')})이 함께 있어, 가까운 관계는 생활 가까이에 있지만 다정함이 먼저인지 기준이 먼저인지는 원국만으로 정하지 않아요.`;
    reason = '가까운 자리라 생활 가까이에 있다고 보되, 곁에 있는 두 별의 음양이 서로 달라 한쪽으로 고르지 않고 경험으로 확인하기로 했어요.';
    alternative = '두 별이 함께 있다는 것을 관계의 수나 결과로 읽지 않아요. 가까운 사람과 생활을 떨어뜨려 지내는 편이라면 가깝다는 부분부터 낮춰야 해요.';
    prompt = '가까운 사람과는 다정한 말과 마음 표현이 먼저 오가는 편인가요?';
    followup = { id: 'relation-mixed-firm', prompt: '그렇다면 다정한 표현보다 각자의 기준과 역할을 먼저 챙기는 편인가요?', candidate: 'near-firm' };
  } else if (mode === 'far') {
    interpretation = `${star}${pj(stars.group, '이')} 일간 곁이 아니라 ${places(stars.far)}에만 있어, 가까운 관계를 생활 한가운데에 두기보다 조금 거리를 둔 채 이어 간다고 읽어요.`;
    reason = '배우자의 별은 일간과 같은 기둥이나 바로 옆에 있어야 서로 향한다고 보고, 그 밖의 자리는 직접 향하기 어렵다고 보는 관점을 따라 가까이 붙어 지낸다는 판단보다 이 판단을 골랐어요.';
    alternative = '거리를 둔다는 말은 연애나 결혼을 하고 못 하고를 정한 것이 아니에요. 가까운 사람과 생활을 붙여 지내는 편이라면 이 판단을 낮춰야 해요.';
    prompt = '가까운 관계라도 매일 붙어 지내기보다, 각자의 생활을 두고 거리를 둔 채 이어 가는 편인가요?';
  } else if (mode === 'hidden') {
    interpretation = `${star}${pj(stars.group, '이')} 겉으로 드러난 글자에는 없고 지지 속 지장간에만 있어, 가까운 관계에 대한 마음이 겉으로 드러나기보다 속에 머문다고 읽어요.`;
    reason = '지지 속 지장간은 그 관계의 속마음으로 본다는 관점을 따라, 드러난 별로 거리와 온도를 읽는 판단 대신 이 판단을 골랐어요.';
    alternative = '속에 머문다는 말은 관계가 없다거나 늦다는 뜻이 아니에요. 가까운 관계에 대한 마음을 겉으로 잘 표현한다면 이 판단을 낮춰야 해요.';
    prompt = '가까운 관계에 대한 마음을 겉으로 잘 드러내지 않고 속으로 두는 편인가요?';
  } else {
    const dayMain = HIDDEN_STEMS[dayBranch].at(-1), dayGod = TEN_GODS[tenGod(day, dayMain)];
    interpretation = `배우자의 별이 원국에 보이지 않아 거리와 온도는 이 비교로 정하지 않고, 배우자 자리인 일지 ${BRANCHES_HANJA[dayBranch]}(${dayGod})의 모습을 가까운 사이에서도 그대로 보인다고만 읽어요.`;
    reason = '배우자의 별이 없을 때의 참고 자료 설명은 관계의 결과를 정하는 말이라 쓰지 않고, 일지가 일간 자신이자 배우자 자리라는 관점만 남겼어요.';
    alternative = '별이 보이지 않는다고 관계가 없다거나 어렵다는 뜻이 아니에요. 가까운 사람 앞에서는 평소와 다른 모습이 된다면 이 판단을 낮춰야 해요.';
    prompt = '가까운 사람에게도 평소 생활하는 모습 그대로 대하는 편인가요?';
  }
  const question = { id: `relation-${mode}`, prompt, clarifies: '선택한 관계 방식 가설의 자기보고 일치·불일치·반대·때에 따라·모름; 자기보고는 독립 적중률이 아님' };
  const lines = [interpretation, where, reason, alternative, RELATION_LIMIT];
  return { policy: 'natal-relation-v2', kind: 'conditional_relation_reading', scope: 'spouse-star-place-polarity',
    assumption: '여명 관성·남명 재성 as the spouse star by the entered gender; facing places 월간·일지·시간 and 정/편 warmth (고급2 401·407); combination and the 월간 편관 bridged by 인성 as specific rules; for a woman, the temperament reading’s 비견/겁재-pattern 신강 chart with 관성 in the day branch reads that spouse star as checking her direction (중급1 104 예시2·106, the strong mind moved to other day masters and 정관 by the temperament assumption); hidden stems as the inner mind (고급2 404); outcomes, 덕, timing and a missing star as a lack of bond are not delivered; not verified personal effects',
    dayPillar: sexName(p.day), gender, spouseGroup: stars.group, stars, bonded: bondedStar, bridge: bridged ? bridgeBranch : null, palaceClash,
    checked: checked ? { place: palaceStar.place, character: palaceStar.character, god: palaceStar.god, warm: palaceStar.warm,
      pattern: temperament.pattern.god, strength: temperament.strength.label, temperamentMode: temperament.mode } : null,
    features, candidates, selectedIds, active: true, mode, name: NAMES[mode],
    facts: where, interpretation, reason, alternative, lines, question, followup, footer: RELATION_FOOTER,
    blocks: [{ label: '같은 일주여도 달라지는 부분', lines: [where] },
      { label: '함께 읽으면', lines: [interpretation, reason, alternative, RELATION_LIMIT] },
      { label: '경험으로 확인할 부분', lines: [prompt, RELATION_FOOTER] }],
    note: RELATION_NOTICE, beforeFeedback: true, predictionEnabled: false, probability: null, trainingEligible: false };
}
