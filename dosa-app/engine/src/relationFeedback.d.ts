import type { RelationReading, RelationMode } from './relationCandidates.js';
import type { TemperamentRead } from './temperamentFeedback.js';
export interface RelationQuestion { id: string; prompt: string; candidate: RelationMode; name: string }
export interface RelationPlan { mode: RelationMode; first: RelationQuestion; followup: RelationQuestion | null }
export type RelationStatus = 'retained-as-self-report' | 'weakened' | 'withheld' | 'scoped' | 'unconfirmed' | 'narrowed';
export interface RelationState {
  pending: 'first' | 'followup' | null; clarify: string | null;
  feedback: Record<string, RelationStatus>; reading: string | null; asked: string[];
}
export interface RelationFeedbackStep {
  action: 'revise' | 'clarify' | 'unresolved'; questionId: string; targetCandidateId: string; answer: TemperamentRead;
  before: { questionId: string; targetCandidateId: string; reading: string | null; feedback: Record<string, RelationStatus> };
  beforeFeedback: { policy: string; scope: string; mode: string; selectedIds: string[]; interpretation: string; candidates: { id: string; status: string }[] };
  after: RelationStatus | 'pending'; feedback: Record<string, RelationStatus>;
  revisedInterpretation: string | null; note: string | null;
  nextQuestion: { id: string; prompt: string; targetCandidateId: string } | null;
  text: string; state: RelationState; probability: null; trainingEligible: false;
}
export function readRelationAnswer(answer: unknown, options?: { reversible?: boolean }): TemperamentRead | null;
export function relationPlan(decision: RelationReading | null | undefined): RelationPlan | null;
export function ownedRelationPrompts(decision: RelationReading | null | undefined): string[];
export function advanceRelationFeedback(decision: RelationReading, plan: RelationPlan, state: RelationState, answer: unknown, options?: { afterMenu?: boolean }): RelationFeedbackStep | null;
export function resolveRelationFeedback(input: { decision: RelationReading | null | undefined; footer?: string; messages: { role: 'assistant' | 'user'; text: string }[]; answer: unknown; menuPrompts?: string[] }): RelationFeedbackStep | null;
