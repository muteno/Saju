import type { WorkDecision } from './workCandidates.js';
import type { RootingDecision } from './rootingCandidates.js';
export type FeedbackDecision = WorkDecision | RootingDecision;
export type FeedbackKind = 'supported' | 'contradicted' | 'no-experience' | 'unanswered' | 'unsure' | 'mixed'
  | 'clarify:ambiguous-negative' | 'clarify:partial' | 'clarify:help-unanswered' | 'clarify:other-means' | 'clarify:unclear';
export interface AnswerClause { text: string; core: string; contrast: boolean }
export interface FeedbackRead {
  kind: FeedbackKind; explicit: boolean; text: string;
  segments: (AnswerClause & { tag: string | null; up: boolean; down: boolean })[]; demandEvidence: 'up' | 'down' | null;
}
export interface FeedbackQuestion { id: string; prompt: string; kind: 'help' | 'duty' | 'demand'; candidate: string; name: string; means?: string; meansCue?: 'self' | 'others';
  effects?: Partial<Record<FeedbackKind, 'retain' | 'retain-link' | 'weaken' | 'scope' | 'scope-reversed'>>; themes?: { stem: string; env: string; work: string; envTheme: string; grounded: string } }
export interface FeedbackPlan { mode: string; outside: string; first: FeedbackQuestion; demand?: FeedbackQuestion }
export type FeedbackStatus = 'retained-as-self-report' | 'weakened' | 'withheld' | 'scoped' | 'unconfirmed';
export interface FeedbackState {
  pending: 'first' | 'demand' | null; clarify: FeedbackKind | null; evidence: 'up' | 'down' | 'conflict' | null;
  feedback: Record<string, FeedbackStatus>; reading: string | null; asked: string[];
}
export interface WorkFeedbackStep {
  action: 'revise' | 'clarify' | 'unresolved'; questionId: string; targetCandidateId: string; answer: FeedbackRead;
  before: { questionId: string; targetCandidateId: string; reading: string | null; feedback: Record<string, FeedbackStatus> };
  beforeFeedback: { policy: string; scope: string; mode: string; selectedIds: string[]; interpretation: string | null; candidates: { id: string; status: string }[] };
  after: FeedbackStatus | 'pending'; feedback: Record<string, FeedbackStatus>;
  revisedInterpretation: string | null; note: string | null;
  nextQuestion: { id: string; prompt: string; targetCandidateId: string } | null;
  text: string; state: FeedbackState; probability: null; trainingEligible: false;
}
export const MAX_FEEDBACK_ANSWER: number;
export function answerClauses(text: string): AnswerClause[];
export function readFeedbackAnswer(answer: unknown, kind: 'help' | 'duty' | 'demand', means?: 'self' | 'others' | null): FeedbackRead | null;
export function feedbackPlan(decision: FeedbackDecision | null | undefined): FeedbackPlan | null;
export function ownedFeedbackPrompts(decision: FeedbackDecision | null | undefined): string[];
export function advanceWorkFeedback(decision: FeedbackDecision, plan: FeedbackPlan, state: FeedbackState, answer: unknown, options?: { afterMenu?: boolean }): WorkFeedbackStep | null;
export function resolveWorkFeedback(input: { decision: FeedbackDecision | null | undefined; footer?: string; messages: { role: 'assistant' | 'user'; text: string }[]; answer: unknown; menuPrompts?: string[] }): WorkFeedbackStep | null;
