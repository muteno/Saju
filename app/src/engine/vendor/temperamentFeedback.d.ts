import type { TemperamentReading, TemperamentMode } from './temperamentCandidates.js';
import type { AnswerClause } from './workFeedback.js';
export type TemperamentAnswerKind = 'supported' | 'contradicted' | 'reversed' | 'mixed' | 'unsure' | 'unanswered' | 'clarify:unclear';
export interface TemperamentRead { kind: TemperamentAnswerKind; text: string; segments: (AnswerClause & { tag: string | null })[] }
export interface TemperamentQuestion { id: string; prompt: string; candidate: TemperamentMode; name: string }
export interface TemperamentPlan { mode: TemperamentMode; A: string; B: string; first: TemperamentQuestion; followup: TemperamentQuestion | null }
export type TemperamentStatus = 'retained-as-self-report' | 'weakened' | 'withheld' | 'scoped' | 'unconfirmed';
export interface TemperamentState {
  pending: 'first' | 'followup' | null; clarify: TemperamentAnswerKind | null;
  feedback: Record<string, TemperamentStatus>; reading: string | null; asked: string[];
}
export interface TemperamentFeedbackStep {
  action: 'revise' | 'clarify' | 'unresolved'; questionId: string; targetCandidateId: string; answer: TemperamentRead;
  before: { questionId: string; targetCandidateId: string; reading: string | null; feedback: Record<string, TemperamentStatus> };
  beforeFeedback: { policy: string; scope: string; mode: string; selectedIds: string[]; interpretation: string; candidates: { id: string; status: string }[] };
  after: TemperamentStatus | 'pending'; feedback: Record<string, TemperamentStatus>;
  revisedInterpretation: string | null; note: string | null;
  nextQuestion: { id: string; prompt: string; targetCandidateId: string } | null;
  text: string; state: TemperamentState; probability: null; trainingEligible: false;
}
export function readTemperamentAnswer(answer: unknown, options?: { reversible?: boolean }): TemperamentRead | null;
export function temperamentPlan(decision: TemperamentReading | null | undefined): TemperamentPlan | null;
export function ownedTemperamentPrompts(decision: TemperamentReading | null | undefined): string[];
export function advanceTemperamentFeedback(decision: TemperamentReading, plan: TemperamentPlan, state: TemperamentState, answer: unknown, options?: { afterMenu?: boolean }): TemperamentFeedbackStep | null;
export function resolveTemperamentFeedback(input: { decision: TemperamentReading | null | undefined; footer?: string; messages: { role: 'assistant' | 'user'; text: string }[]; answer: unknown; menuPrompts?: string[] }): TemperamentFeedbackStep | null;
