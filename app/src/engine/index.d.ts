import type { OhaengKey } from '../theme'

export interface Pillar {
  title: string
  topStar: string
  gan: string
  ganK: string
  ganE: OhaengKey
  ganPolarity: '+' | '-'
  ji: string
  jiK: string
  jiE: OhaengKey
  jiPolarity: '+' | '-'
  botStar: string
  stage: string
  isDayMaster?: boolean
}

export type Verdict = '부족' | '적정' | '발달' | '과다'
export interface OhaengStat {
  key: OhaengKey
  pct: number
  verdict: Verdict
}

export interface DaeunItem {
  age: number
  name: string
  stemTenGod: string
  twelveStage: string
}

export interface UiChart {
  pillars: Pillar[]
  ohaeng: OhaengStat[]
  daeun: { su: number; forward: boolean; list: DaeunItem[] }
  dayMaster: { ganK: string; gan: string; element: OhaengKey }
}

export interface ChartInput {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  gender: 'M' | 'F'
}

export function computeChartUI(input: ChartInput): UiChart

export interface TodayIljin {
  yearName: string
  monthName: string
  dayName: string
  dayHanja: string
}

export function todayIljin(year: number, month: number, day: number): TodayIljin

// L3 근거 리포트 (섹션 구조는 report.js 참조 — 앱은 필요한 필드만 골라 씀)
export interface ReportBundle {
  input: unknown
  sections: Array<{
    id: string
    title: string
    lines?: string[]
    block?: { distilled?: any; excerpts?: Array<{ paras: string[]; source: { doc: string; title: string }; totalParas: number }>; empty?: boolean }
    [k: string]: unknown
  }>
}
export function loadKb(): Promise<unknown>
export function buildReading(input: ChartInput, unseYearName?: string): ReportBundle
export const kbCoverage: { distilledKeys: number; indexKeys: number }
