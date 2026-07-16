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
