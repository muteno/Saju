import type { DaeunTiming, DaeunTimingPeriod } from './daeunTiming.js';
import type { FeedbackDecision } from './workFeedback.js';
export interface TimeSpan { unit: 'age' | 'year'; from: number; to: number; text: string; short?: boolean }
export interface TimedExperience { polarity: 'support' | 'contradict' | null; spans: TimeSpan[]; relative: string[] }
export interface TimingPlan {
  rule: 'rootless' | 'clashed'; themes: { stem: string; env: string; work: string; envTheme: string; grounded: string };
  stemText: string; stemLast: string; periods: DaeunTimingPeriod[]; explains: number[]; explainsLater: number; asOfYear: number | null;
  policy: DaeunTiming['policy']; candidates: DaeunTiming['candidates'];
}
export type SpanPlace =
  | { place: 'period'; period: DaeunTimingPeriod }
  | { place: 'boundary'; from: DaeunTimingPeriod | null; to: DaeunTimingPeriod | null }
  | { place: 'before-first'; first: DaeunTimingPeriod }
  | { place: 'future' } | { place: 'unplaced' };
export interface TimingRecord {
  text: string; unit: 'age' | 'year' | null; from: number | null; to: number | null; polarity: 'support' | 'contradict' | null;
  place: 'period' | 'boundary' | 'before-first' | 'future' | 'unplaced' | 'relative'; period: number | null;
  verdict: 'matched' | 'unexplained' | 'not-adopted' | 'weakened' | 'consistent' | null;
}
export interface TimingRead { kind: 'timed' | 'unsure' | 'unanswered' | 'unclear'; text: string; experiences: TimedExperience[] }
export const TIMING_SINGLE: string;
export const TIMING_SPLIT: string;
export const TIMING_CLOSING: string;
export const TIMING_UNPLACED: string;
export const TIMING_MARGIN: string;
export function leadingTimes(clause: string): { spans: TimeSpan[]; relative: string[]; rest: string };
export function isTimeOnly(rest: string): boolean;
export function sideOfRest(rest: string): 'support' | 'contradict' | null;
export function placeSpan(periods: DaeunTimingPeriod[], span: TimeSpan, asOfYear?: number | null): SpanPlace;
export function timingPlan(decision: FeedbackDecision | null | undefined, timing: DaeunTiming | null | undefined, options?: { asOfYear?: number | null }): TimingPlan | null;
export function timingWanted(plan: TimingPlan | null, kind: string): boolean;
export function noExplainingPeriod(plan: TimingPlan, kind: string): string;
export function compareTiming(plan: TimingPlan, experiences: TimedExperience[]): { lines: string[]; record: TimingRecord[]; feedback: Record<string, 'matched-as-self-report' | 'weakened'>; placed: boolean };
export function readTimingAnswer(answer: unknown, polarity: 'support' | null, clauses: (text: string) => { text: string; core: string; contrast: boolean }[]): TimingRead | null;
