import type { WorkDecision } from './workCandidates.js';
export type FeedbackKind = 'supported' | 'contradicted' | 'no-experience' | 'unanswered' | 'unsure' | 'mixed'
  | 'clarify:ambiguous-negative' | 'clarify:partial' | 'clarify:help-unanswered' | 'clarify:other-means' | 'clarify:unclear';
export interface FeedbackRead {
  kind: FeedbackKind; explicit: boolean; text: string;
  segments: { text: string; tag: string }[]; demandEvidence: 'up' | 'down' | null;
}
export interface FeedbackQuestion { id: string; prompt: string; kind: 'help' | 'duty' | 'demand'; candidate: string; label: string; means?: string; meansCue?: 'self' | 'others' }
export interface FeedbackPlan { mode: string; first: FeedbackQuestion; demand?: FeedbackQuestion }
export interface FeedbackState {
  pending: 'first' | 'demand' | null; clarified: boolean; demandEvidence: 'up' | 'down' | null;
  statuses: Record<string, string>; asked: string[];
}
export interface WorkFeedbackStep {
  action: 'revise' | 'clarify' | 'unresolved'; questionId: string; targetCandidateId: string; answer: FeedbackRead;
  before: { questionId: string; targetCandidateId: string; selectedIds: string[]; interpretation: string | null; statuses: Record<string, string> };
  beforeFeedback: { mode: string; selectedIds: string[]; interpretation: string | null };
  after: string; statuses?: Record<string, string>; revisedInterpretation: string | null;
  nextQuestion: { id: string; prompt: string; targetCandidateId: string } | null;
  text: string; state: FeedbackState; probability: null; trainingEligible: false;
}
export const MAX_FEEDBACK_ANSWER: number;
export function readFeedbackAnswer(answer: unknown, kind: 'help' | 'duty' | 'demand', means?: 'self' | 'others' | null): FeedbackRead | null;
export function feedbackPlan(decision: WorkDecision | null | undefined): FeedbackPlan | null;
export function advanceWorkFeedback(decision: WorkDecision, plan: FeedbackPlan, state: FeedbackState, answer: unknown): WorkFeedbackStep | null;
export function resolveWorkFeedback(input: { decision: WorkDecision | null | undefined; footer?: string; messages: { role: 'assistant' | 'user'; text: string }[]; answer: unknown }): WorkFeedbackStep | null;
