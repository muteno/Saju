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
  /** 지장간(한글 천간, 여기→본기 순) */
  hidden: string[]
  /** 12신살(주별) */
  sinsal: string
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
  jiE: OhaengKey
  jiPolarity: '+' | '-'
}

export interface UiChart {
  pillars: Pillar[]
  ohaeng: OhaengStat[]
  daeun: { su: number; forward: boolean; list: DaeunItem[] }
  dayMaster: { ganK: string; gan: string; element: OhaengKey }
  corrected: { hh: number; mm: number; minutes: number } | null
}

export interface ChartInput {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  gender: 'M' | 'F'
  /** 출생지 동경(진태양시 보정) — 생략 시 서울 126.978 */
  longitude?: number
  timeZone?: string
  solarTimeCorrection?: boolean
  lateZiRule?: 'midnight23' | 'keepDay'
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

export function todayKST(): { year: number; month: number; day: number }
export function currentUnseYearName(): string

export interface DayRelation {
  type: string
  name: string
  with: '년' | '월' | '일' | '시'
}
export interface TodayFortune {
  date: string
  iljin: string
  stemTenGod: string
  theme: string | null
  relations: DayRelation[]
  gongmangHit: boolean
  score: number
  oneLine: string
  basis: string[]
}
/** 오늘의 운세 — 엔진 diaryDayInfo(일진 vs 원국 관계) 기반. 점수=정책 매핑(근거 관계 병기 필수). */
export function todayFortune(input: ChartInput): TodayFortune

// ── 정곡 원자료(선별은 data/jeonggok.ts) ──
export interface JeonggokPillar {
  stem: string
  branch: string
  stage: string
  sinsal: string
  stemEl: OhaengKey
  branchEl: OhaengKey
}
export interface RelEntry {
  name: string
  positions: string[]
}
export interface JeonggokRaw {
  pillars: { 시: JeonggokPillar; 일: JeonggokPillar; 월: JeonggokPillar; 년: JeonggokPillar }
  relations: {
    stemHap: RelEntry[]
    stemChung: RelEntry[]
    yukhap: RelEntry[]
    samhap: RelEntry[]
    banghap: RelEntry[]
    chung: RelEntry[]
    hyeong: RelEntry[]
    pa: RelEntry[]
    hae: RelEntry[]
    wonjin: RelEntry[]
    gongmangHit: unknown[]
  }
  strength: { score: number; max: number; label: string; deukryeong: boolean; deukji: boolean; deuksi: boolean; deukse: boolean }
  elements: Record<string, number>
  missingGroups: string[]
  gongmang: string[]
  daeunHits: { age: number; name: string; relations: DayRelation[] }[]
  birthYear: number
  nowYear: number
}
export function jeonggokRaw(input: ChartInput): JeonggokRaw
