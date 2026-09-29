export type ConditionValue = 0 | 1 | null;
export type ConditionExpression = { feature: string } | { all: ConditionExpression[] } | { any: ConditionExpression[] } | { not: ConditionExpression };
export interface ConditionTrace { value: ConditionValue; feature?: string; operator?: string; children?: ConditionTrace[]; unknownFeatures: string[] }
export interface WorkCandidate { id: string; label: string; status: 'inapplicable' | 'withheld' | 'weakened' | 'selected'; condition: ConditionTrace; counter: ConditionTrace | null }
export type WorkMode = 'resource-duty' | 'resource-demand' | 'food-response' | 'peer-response' | 'competing' | 'scope-withheld' | 'condition-withheld' | 'outside-bundle';
export interface WorkDecision {
  policy: 'jia-stem-resource-authority-v1' | 'stem-resource-authority-v1'; scope: 'jia-day-natal-stems' | 'day-stem-natal-stems'; assumption: string; sourceClaimIds: string[];
  features: Record<string, ConditionValue>; candidates: WorkCandidate[]; selectedIds: string[]; active: boolean; mode: WorkMode;
  facts: string; interpretation: string | null; reason: string | null; alternative: string | null; lines: string[];
  question: { id: string; prompt: string; clarifies: string } | null;
  beforeFeedback: true; probability: null; trainingEligible: false;
}
export interface WorkRevision {
  status: 'supported' | 'contradicted' | 'no-experience' | 'unanswered';
  before: { selectedIds: string[]; interpretation: string | null }; after: 'retained-as-self-report' | 'weakened' | 'withheld';
  text: string; probability: null; trainingEligible: false;
}
export const WORK_CANDIDATE_LIMIT: string;
export const WORK_QUESTIONS: Readonly<Record<'scope-withheld' | 'food-response' | 'peer-response' | 'competing' | 'resource-duty' | 'resource-demand', string>>;
export const EXPLICIT_ANSWERS: Map<string, WorkRevision['status']>;
export function evaluateCondition(expression: ConditionExpression, features: Record<string, ConditionValue>, depth?: number): ConditionTrace;
export function compareWorkCandidates(features: Record<string, ConditionValue>, scope?: 'jiaDay' | 'stemScope'): WorkCandidate[];
export function stemCandidateLimit(stem: number): string;
export function buildWorkDecision(chart: any, context: any): WorkDecision;
export function reviseWorkDecision(decision: WorkDecision | null | undefined, answer: unknown): WorkRevision | null;
