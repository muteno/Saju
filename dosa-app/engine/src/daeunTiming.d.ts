import type { RootingSide } from './rootingCandidates.js';
export type DaeunStatus = 'root' | 'root-shaken' | 'root-tilted' | 'root-unknown' | 'root-elsewhere' | 'relieve' | 'relieve-unknown' | 'none' | 'no-rule';
export interface LuckRelation {
  position: 'year' | 'month' | 'day' | 'hour'; branch: number; branchCharacter: string; name: string;
  kind?: 'yukhap' | 'samhap'; element?: number;
}
export interface LuckBranchRelations { chung: LuckRelation[]; hap: LuckRelation[]; sasin: LuckRelation[]; hyeong: LuckRelation[] }
export interface LuckRootStatus {
  status: 'root' | 'root-shaken' | 'root-tilted' | 'root-unknown' | 'none';
  basis?: 'sasin-hyeong' | 'chung-with-hap' | 'chung' | 'other-hyeong' | 'hap' | 'hap-same-element' | 'none';
  relations: LuckRelation[];
}
export interface DaeunPeriod {
  order: number; age: number; startYear: number | null; idx: number; name: string; stem: number; branch: number; ganji: string;
}
export interface DaeunTimingPeriod extends DaeunPeriod {
  status: DaeunStatus; root: LuckRootStatus;
  relief: { status: 'relieve' | 'relieve-unknown'; relieves: ('year' | 'month' | 'day' | 'hour')[]; haps: LuckRelation[]; relations: LuckRelation[] } | null;
  principal: { character: string; tenGod: string; group: string }; envLink: boolean;
}
export interface DaeunTiming {
  policy: 'daeun-timing-v1'; scope: 'natal-decision-and-daeun-apart'; rule: 'rootless' | 'clashed';
  target: { policy: string; mode: string; side: RootingSide | null };
  applicable: boolean; element: number; clashed: ('year' | 'month' | 'day' | 'hour')[];
  daeun: { su: number; forward: boolean }; periods: DaeunTimingPeriod[];
  candidates: { order: number; age: number; ganji: string; status: 'root' | 'relieve'; envLink: boolean }[];
  active: boolean; lines: string[]; assumption: string; sourceLines: number[];
  natalDecisionUnchanged: true; beforeFeedback: true; probability: null; trainingEligible: false;
}
export const DAEUN_LIMIT: string;
export function daeunPillars(chart: any): DaeunPeriod[] | null;
export function luckBranchRelations(pillarsIdx: { year: number; month: number; day: number; hour: number }, branch: number): LuckBranchRelations;
export function luckRootStatus(pillarsIdx: { year: number; month: number; day: number; hour: number }, branch: number, element: number): LuckRootStatus;
export function buildDaeunTiming(chart: any, work: any): DaeunTiming | null;
