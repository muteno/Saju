import type { ConditionValue, WorkCandidate } from './workCandidates.js';
import type { RootingSide, RootState } from './rootingCandidates.js';
export type BranchMode = 'branch-link' | 'branch-diverted' | 'direction-clash' | 'no-direction' | 'direction-unset' | 'mixed-direction'
  | 'season-grounded' | 'season-shaken' | 'season-separate' | 'season-surface' | 'season-link-withheld' | 'hidden-only';
export interface BranchEnvironment {
  position: 'year' | 'month' | 'day' | 'hour'; branch: number; branchCharacter: string; season: number;
  principal: { character: string; tenGod: string; group: string }; via: 'principal' | 'season';
}
export interface BranchPair {
  wealth: 'year' | 'month' | 'day' | 'hour'; authority: 'year' | 'month' | 'day' | 'hour';
  kind: 'season' | 'triad-authority' | 'triad-resource' | 'triad-wealth' | 'none';
  basis: 'same-branch' | 'same-season' | 'triad' | 'none'; triad?: string; element?: number; group?: string; withWang?: boolean;
}
export interface SeasonRootPlace {
  position: 'year' | 'month' | 'day' | 'hour'; branch: number; branchCharacter: string;
  sameStem: boolean; link: boolean; season: number | null; state: RootState;
}
export interface BranchDecision {
  policy: 'branch-season-v1'; scope: 'both-natal-branches' | 'one-side-stem-season-body'; side: RootingSide | null;
  assumption: string; sourceParagraphs: string[];
  features: Record<string, ConditionValue>; candidates: WorkCandidate[]; selectedIds: string[]; active: boolean; mode: BranchMode;
  environments: { wealth: BranchEnvironment[] | null; authority: BranchEnvironment[] | null };
  pairs: BranchPair[] | null; clashes: string[] | null;
  roots: { position: 'year' | 'month' | 'hour'; stem: number; character: string; tenGod: string; places: SeasonRootPlace[] }[] | null;
  facts: string; interpretation: string; reason: string; alternative: string; lines: string[];
  question: { id: string; prompt: string; clarifies: string } | null;
  beforeFeedback: true; probability: null; trainingEligible: false;
}
export const BRANCH_QUESTION: string;
export const BRANCH_SEASON_LIMIT: string;
export const SEASON_ROOTING_LIMIT: string;
export function compareBranchCandidates(features: Record<string, ConditionValue>): WorkCandidate[];
export function compareSeasonCandidates(features: Record<string, ConditionValue>, scope: string): WorkCandidate[];
export function branchEnvironments(pillarsIdx: { year: number; month: number; day: number; hour: number }, group: string): BranchEnvironment[];
export function branchPairKind(pillarsIdx: { year: number; month: number; day: number; hour: number }, w: BranchEnvironment, a: BranchEnvironment): Omit<BranchPair, 'wealth' | 'authority'>;
export function buildBranchSeasonDecision(chart: any, context: any): BranchDecision | null;
