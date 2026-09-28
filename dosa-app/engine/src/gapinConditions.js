// Necessary source scopes and separately named symbol observations. No personal prediction.
import records from './gapinSentenceData.js';
import { HIDDEN_STEMS, TEN_GODS, tenGod, sexStem, sexBranch } from './tables.js';

const positions = ['year', 'month', 'day', 'hour'];
const copy = value => JSON.parse(JSON.stringify(value));
const valid = value => Number.isInteger(value) && value >= 0 && value < 60;
const status = (value, expected) => value === null ? 'unknown' : value === expected ? 'met' : 'unmet';
const unknown = (id, reason) => ({ id, status: 'unknown', reason });

/** M/F are the existing input encoding for the source's 남자/여자, not outcome evidence. */
export function evaluateGapinConditions(chart) {
  const hour = chart?.input?.hour, minute = chart?.input?.minute;
  const withheldTime = chart?.birthTime?.status === 'unknown' || chart?.input?.hourUnknown === true ||
    !Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59;
  const p = chart?.pillarsIdx;
  const day = !withheldTime && valid(p?.day) ? p.day : null;
  const complete = !withheldTime && positions.every(q => valid(p?.[q]));
  const gender = ['M', 'F'].includes(chart?.input?.gender) ? chart.input.gender : null;
  const dayStem = day === null ? null : sexStem(day);
  const markers = complete ? positions.flatMap(position => {
    const stem = sexStem(p[position]), hidden = HIDDEN_STEMS[sexBranch(p[position])];
    const rows = [ ...(position === 'day' ? [] : [{ position, part: 'stem', stem }]),
      ...hidden.map((stem, index) => ({ position, part: 'hidden_stem', stem, principal: index === hidden.length - 1 })) ];
    return rows.filter(row => ['식신', '상관'].includes(TEN_GODS[tenGod(dayStem, row.stem)]));
  }) : null;
  const observations = {
    policy: 'existing-tables-stems-and-hidden-v1',
    // These two scopes deliberately differ; the author did not choose either.
    stemsAndPrincipal: markers === null ? null : markers.filter(m => m.part === 'stem' || m.principal),
    stemsAndAllHidden: markers,
    sourcePresenceCondition: 'unknown',
  };
  const items = [['GI09', 'M'], ['GI10', 'F']].map(([id, expected]) => {
    const record = records.find(r => r.id === id);
    const scopes = [{ id: 'gapin_day_pillar', status: status(day, 50), observed: day, expected: 50 },
      { id: 'source_gender_scope', status: status(gender, expected), observed: gender, expected }];
    const presence = unknown('siksang_presence', '원문은 식상의 표면·본기·전체 지장간 범위를 확정하지 않는다. 관찰값을 조건 충족으로 대체하지 않는다.');
    const branches = [
      { id: 'siksang_present', conditions: [presence], status: 'unknown' },
      { id: 'siksang_absent', conditions: [unknown('siksang_absence', presence.reason)], status: 'unknown' },
      ...(id === 'GI09' ? [{ id: 'metal_official_strong_alternative', conditions: [unknown('metal_official_strength', '튼튼함의 판정 기준이 없으며 사업 분기의 공통 필수조건이 아닌 직장 대안이다.')], status: 'unknown' }] : []),
    ];
    return { id, scopes, branches,
      status: scopes.some(s => s.status === 'unmet') ? 'unmet' : 'unknown',
      review: copy(record.review), sources: copy(record.sources),
      sourceParagraph: { unit: '일주론 글모음#0002', body: id === 'GI09' ? 9 : 10, xml: id === 'GI09' ? 257 : 258 },
      personalApplication: 'withheld', trainingEligible: false, probability: null };
  });
  return { policy: 'gapin-source-conditions-v1', observations, items, personalApplication: 'withheld', probability: null };
}

export function gapinConditionLines(assessment) {
  if (assessment?.policy !== 'gapin-source-conditions-v1') return [];
  const matched = assessment.items.find(item => item.scopes.every(scope => scope.status === 'met'));
  const inputScope = matched ? `입력은 원문의 ${matched.id === 'GI09' ? '남자' : '여자'}·갑인 구분과 일치해요. 이 일치는 직업 적성의 확인을 뜻하지 않아요.`
    : '입력만으로 원문의 대상 범위와 일치하는지 확인하지 못했어요.';
  return [
    '일주론 글모음의 갑인일주 본문 9–10문단은 남자·여자와 식상 유무를 나눠 직업을 설명해요.',
    inputScope,
    '식상을 어디까지 세는지 원문에서 확정하지 못했어요. 글자가 있다는 것만으로 직업 적성을 정하지 않아요.',
    '입력과 문헌의 조건을 대조 중이라 갑인 일주만으로 성격·관계·직업의 결과를 말하는 문장은 보류해요.',
  ];
}
