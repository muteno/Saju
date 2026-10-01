export type RelationMode = 'near-bonded' | 'near-bridged' | 'near-warm' | 'near-firm' | 'near-mixed' | 'far' | 'hidden' | 'absent';
export interface SpouseStar {
  place: 'yearStem' | 'monthStem' | 'hourStem' | 'yearBranch' | 'monthBranch' | 'dayBranch' | 'hourBranch';
  placeName: string; stem: number; character: string; god: string; warm: boolean; facing: boolean;
  branch?: number; branchCharacter?: string; role?: '본기' | '중기' | '여기';
}
export interface SpouseStars { group: '관성' | '재성'; visible: SpouseStar[]; hidden: SpouseStar[]; facing: SpouseStar[]; far: SpouseStar[] }
export interface RelationCandidate {
  id: RelationMode; specific: boolean; name: string;
  condition: { value: 0 | 1 | null; unknownFeatures: string[] };
  status: 'selected' | 'superseded' | 'inapplicable' | 'withheld';
}
export interface RelationReading {
  policy: 'natal-relation-v1'; kind: 'conditional_relation_reading'; scope: 'spouse-star-place-polarity'; assumption: string;
  dayPillar: string; gender: 'M' | 'F'; spouseGroup: '관성' | '재성'; stars: SpouseStars; bonded: SpouseStar | null;
  bridge: 'month' | 'day' | null; palaceClash: string[];
  features: Record<string, 0 | 1>; candidates: RelationCandidate[]; selectedIds: RelationMode[];
  active: true; mode: RelationMode; name: string;
  facts: string; interpretation: string; reason: string; alternative: string; lines: string[];
  question: { id: string; prompt: string; clarifies: string };
  followup: { id: string; prompt: string; candidate: RelationMode } | null;
  footer: string; blocks: { label: string; lines: string[] }[]; note: string;
  beforeFeedback: true; predictionEnabled: false; probability: null; trainingEligible: false;
}
export const SPOUSE_GROUP: Readonly<{ F: '관성'; M: '재성' }>;
export const RELATION_NAMES: Readonly<Record<RelationMode, string>>;
export const RELATION_OPPOSITE: Readonly<Partial<Record<RelationMode, RelationMode>>>;
export const RELATION_LIMIT: string;
export const RELATION_FOOTER: string;
export const RELATION_NOTICE: string;
export function spouseStars(pillarsIdx: { year: number; month: number; day: number; hour: number }, gender: 'M' | 'F'): SpouseStars;
export function compareRelationCandidates(features: Record<string, 0 | 1 | null>): RelationCandidate[];
export function buildRelationReading(chart: unknown): RelationReading | null;
