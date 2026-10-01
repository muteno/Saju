export type TemperamentMode = 'peer-blocked' | 'peer-flow' | 'one-direction' | 'shown-together' | 'inner-outer';
export interface MonthPattern {
  stem: number; character: string; god: string; group: string; role: '정기' | '여기' | '중기';
  source: 'month-stem' | 'other-stem' | 'month-branch'; positions: ('year' | 'month' | 'hour')[]; revealed: boolean;
  branch: number; branchCharacter: string;
  alternatives: ({ view: 'eight-patterns'; god: string | null; character: string | null }
    | { view: 'near-reveal-only'; god: string; character: string; source: 'month-stem' | 'other-stem' | 'month-branch' }
    | { view: 'variant-reveal'; god: string; character: string; positions: ('year' | 'month' | 'hour')[]; hiddenRole: string })[];
}
export interface TemperamentCandidate {
  id: TemperamentMode; specific: boolean; name: string;
  condition: { value: 0 | 1 | null; unknownFeatures: string[] };
  status: 'selected' | 'superseded' | 'inapplicable' | 'withheld';
}
export interface TemperamentReading {
  policy: 'natal-temperament-v1'; kind: 'conditional_temperament_reading'; scope: 'month-pattern-day-branch-strength'; assumption: string;
  dayPillar: string; pattern: MonthPattern;
  dayMain: { stem: number; character: string; god: string; group: string; branch: number; branchCharacter: string };
  strength: { label: string; score: number; max: number; band: 'strong' | 'weak' | 'balanced' };
  features: Record<string, 0 | 1>; candidates: TemperamentCandidate[]; selectedIds: TemperamentMode[];
  active: true; mode: TemperamentMode; name: string;
  facts: string; interpretation: string; reason: string; alternative: string; lines: string[];
  question: { id: string; prompt: string; clarifies: string };
  followup: { id: string; prompt: string; candidate: TemperamentMode } | null;
  footer: string; blocks: { label: string; lines: string[] }[]; note: string;
  beforeFeedback: true; predictionEnabled: false; probability: null; trainingEligible: false;
}
export const TEMPERAMENT_TRAITS: Readonly<Record<string, string>>;
export const TEMPERAMENT_NAMES: Readonly<Record<TemperamentMode, string>>;
export const TEMPERAMENT_LIMIT: string;
export const TEMPERAMENT_FOOTER: string;
export const TEMPERAMENT_NOTICE: string;
export function j(word: string, pair: '이' | '은' | '을' | '과' | '이에요' | '으로'): string;
export function monthPattern(pillarsIdx: { year: number; month: number; day: number; hour: number }): MonthPattern;
export function compareTemperamentCandidates(features: Record<string, 0 | 1 | null>): TemperamentCandidate[];
export function buildTemperamentReading(chart: unknown): TemperamentReading | null;
