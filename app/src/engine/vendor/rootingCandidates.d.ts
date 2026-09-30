import type { ConditionValue, WorkCandidate } from './workCandidates.js';
export type RootingSide = 'wealth' | 'authority';
export type RootingMode = 'grounded-link' | 'shaken-link' | 'separate-roots' | 'surface-only' | 'link-withheld' | 'hidden-only';
export interface RootState { value: ConditionValue; basis: 'none' | 'chung' | 'sasin-hyeong' | 'chung-with-hap' | 'other-hyeong'; names: string[] }
export interface RootPlace {
  position: 'year' | 'month' | 'day' | 'hour'; branch: number; branchCharacter: string;
  principal: { character: string; tenGod: string; group: string };
  sameStem: boolean; link: boolean; otherTable: 'kept' | 'lost'; state: RootState;
}
export interface StemRoots { position: 'year' | 'month' | 'hour'; stem: number; character: string; tenGod: string; places: RootPlace[] }
export interface RootingDecision {
  policy: 'stem-branch-rooting-v1'; scope: 'one-side-natal-stem-and-branches'; side: RootingSide; assumption: string; sourceParagraphs: string[];
  features: Record<string, ConditionValue>; candidates: WorkCandidate[]; selectedIds: string[]; active: boolean; mode: RootingMode;
  roots: StemRoots[]; facts: string; interpretation: string; reason: string; alternative: string; lines: string[];
  question: { id: string; prompt: string; clarifies: string } | null;
  beforeFeedback: true; probability: null; trainingEligible: false;
}
export const ROOTING_THEMES: Readonly<Record<RootingSide, { stem: string; env: string; work: string; envTheme: string; grounded: string }>>;
export const ROOTING_QUESTIONS: Readonly<Record<RootingSide, string>>;
export const ROOTING_LIMIT: string;
export function compareRootingCandidates(features: Record<string, ConditionValue>, scope: string): WorkCandidate[];
export function rootState(pillarsIdx: { year: number; month: number; day: number; hour: number }, position: 'year' | 'month' | 'day' | 'hour', relations?: unknown): RootState;
export function buildRootingDecision(chart: any, context: any): RootingDecision | null;
