// Browser-safe structural references. Kept outside personal statements and LLM grounds.
import records from './gapinStructureData.js';
import { HIDDEN_STEMS, TEN_GODS, TWELVE_STAGES, tenGod, twelveStage, sexStem, sexBranch } from './tables.js';

export const GAPIN_STRUCTURE_NOTICE = '문헌에서 쓰는 구성과 분류를 설명해요. 개인의 성격·직업·미래에 대한 판단은 보류해요.';

export function gapinStructureReference(chart) {
  const { hour, minute, hourUnknown } = chart?.input ?? {};
  if (chart?.birthTime?.status === 'unknown' || hourUnknown === true ||
      !Number.isInteger(hour) || hour < 0 || hour > 23 ||
      !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  const pillars = chart?.pillarsIdx;
  if (!['year', 'month', 'day', 'hour'].every(p => Number.isInteger(pillars?.[p]) && pillars[p] >= 0 && pillars[p] < 60) ||
      pillars.day !== 50) return null;
  const stem = sexStem(pillars.day), branch = sexBranch(pillars.day);
  const hidden = HIDDEN_STEMS[branch];
  const observation = {
    dayIndex: pillars.day, dayStem: stem, dayBranch: branch,
    principalTenGod: TEN_GODS[tenGod(stem, hidden.at(-1))],
    hidden: hidden.map(value => ({ stem: value, tenGod: TEN_GODS[tenGod(stem, value)] })),
    stage: TWELVE_STAGES[twelveStage(stem, branch)],
  };
  return { policy: 'gapin-structure-reference-v1', kind: 'literature_reference_only',
    observation, items: JSON.parse(JSON.stringify(records)), note: GAPIN_STRUCTURE_NOTICE,
    sourcePresenceCondition: 'unknown', personalApplication: 'withheld', trainingEligible: false, probability: null };
}
