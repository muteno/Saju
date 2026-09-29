import type { WorkDecision } from './workCandidates.js';
export type FeedbackKind = 'supported' | 'contradicted' | 'no-experience' | 'unanswered' | 'unsure' | 'mixed'
  | 'clarify:ambiguous-negative' | 'clarify:partial' | 'clarify:help-unanswered' | 'clarify:other-means' | 'clarify:unclear';
export interface AnswerClause { text: string; core: string; contrast: boolean }
export interface FeedbackRead {
  kind: FeedbackKind; explicit: boolean; text: string;
  segments: (AnswerClause & { tag: string | null; up: boolean; down: boolean })[]; demandEvidence: 'up' | 'down' | null;
}
export interface FeedbackQuestion { id: string; prompt: string; kind: 'help' | 'duty' | 'demand'; candidate: string; name: string; means?: string; meansCue?: 'self' | 'others' }
export interface FeedbackPlan { mode: string; first: FeedbackQuestion; demand?: FeedbackQuestion }
export type FeedbackStatus = 'retained-as-self-report' | 'weakened' | 'withheld' | 'scoped' | 'unconfirmed';
export interface FeedbackState {
  pending: 'first' | 'demand' | null; clarify: FeedbackKind | null; evidence: 'up' | 'down' | 'conflict' | null;
  feedback: Record<string, FeedbackStatus>; reading: string | null; asked: string[];
}
export interface WorkFeedbackStep {
  action: 'revise' | 'clarify' | 'unresolved'; questionId: string; targetCandidateId: string; answer: FeedbackRead;
  before: { questionId: string; targetCandidateId: string; reading: string | null; feedback: Record<string, FeedbackStatus> };
  beforeFeedback: { mode: string; selectedIds: string[]; interpretation: string | null; candidates: { id: string; status: string }[] };
  after: FeedbackStatus | 'pending'; feedback: Record<string, FeedbackStatus>;
  revisedInterpretation: string | null; note: string | null;
  nextQuestion: { id: string; prompt: string; targetCandidateId: string } | null;
  text: string; state: FeedbackState; probability: null; trainingEligible: false;
}
export const MAX_FEEDBACK_ANSWER: number;
export function answerClauses(text: string): AnswerClause[];
export function readFeedbackAnswer(answer: unknown, kind: 'help' | 'duty' | 'demand', means?: 'self' | 'others' | null): FeedbackRead | null;
export function feedbackPlan(decision: WorkDecision | null | undefined): FeedbackPlan | null;
export function ownedFeedbackPrompts(decision: WorkDecision | null | undefined): string[];
export function advanceWorkFeedback(decision: WorkDecision, plan: FeedbackPlan, state: FeedbackState, answer: unknown, options?: { afterMenu?: boolean }): WorkFeedbackStep | null;
export function resolveWorkFeedback(input: { decision: WorkDecision | null | undefined; footer?: string; messages: { role: 'assistant' | 'user'; text: string }[]; answer: unknown; menuPrompts?: string[] }): WorkFeedbackStep | null;
