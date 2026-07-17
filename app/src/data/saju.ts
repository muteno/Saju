import { computeChartUI, buildReading, todayIljin as engineToday, type ChartInput } from '../engine'

/**
 * 화면 데이터 = dosa-app L1 만세력 엔진(computeChart)의 실제 계산 결과.
 * 지금은 샘플 프로필(1990/01/01 08:24 여, 서울)로 고정 호출.
 * 추후 InfoInput 폼 값으로 computeChartUI(input)를 그대로 호출하면 된다.
 */
export type { Pillar, OhaengStat, Verdict, DaeunItem } from '../engine'

export interface Profile {
  name: string
  gender: '여자' | '남자'
  calendar: '양력' | '음력' | '음력(윤달)'
  birth: string
  city: string
  marital: '미혼' | '기혼'
}

export const mockProfile: Profile = {
  name: 'uibowl',
  gender: '여자',
  calendar: '양력',
  birth: '1990/01/01 08:24',
  city: '충청남도 공주, 대한민국',
  marital: '미혼',
}

// 실제 엔진 계산 (기사·병자·병인·임진 / 일간 병火 / 대운수 2)
const chart = computeChartUI({ year: 1990, month: 1, day: 1, hour: 8, minute: 24, gender: 'F' })
export const mockPillars = chart.pillars
export const mockOhaeng = chart.ohaeng
export const mockDaeun = chart.daeun
export const dayMaster = chart.dayMaster

// 오늘의 일진 (엔진 산출) + 점수/문안은 서비스 정책값(placeholder)
const t = engineToday(2026, 7, 16)
export const todayIljin = {
  date: '7월 16일 목요일',
  yearName: t.yearName,
  monthName: t.monthName,
  dayName: t.dayName,
  dayHanja: t.dayHanja,
  score: 82,
  keyword: '차분한 정리의 날',
  oneLine: '들뜨기보다 하나를 매듭짓기 좋은 흐름이에요.',
}

/** 홈 간단 개요 — L3 조립기가 코퍼스 근거로 채울 자리(현재 요약 문안) */
export const homeSummary = {
  title: '병화(丙火) 일간, 태양처럼 뻗는 기운',
  lines: [
    '화(火)가 왕성하고 금(金)이 비어, 표현·추진력은 강하나 수렴과 마무리가 과제.',
    '올해 병오년은 비견 운 — 자기 주도와 경쟁이 함께 커지는 해.',
  ],
}

/** 결과 화면 풀이 — L3 근거 리포트(코퍼스 출처)에서 생성. 지어낸 문구 아님(절대 원칙 1). */
export interface ReadingSection { icon: string; label: string; lines: string[]; source?: string }
export interface Reading { headline: string; sections: ReadingSection[] }

const srcOf = (unit: any): string | undefined => {
  const s = unit?.sources?.[0]
  return s ? `${s.doc} · ${s.title}` : undefined
}

/** 엔진 근거 리포트 → 화면 리딩 (근거 있는 섹션만; 없으면 비움 = 소장 문헌 없음) */
export function toReading(input: ChartInput, unse = '병오'): Reading {
  const rep: any = buildReading(input, unse)
  const byId = (id: string) => rep.sections.find((s: any) => s.id === id)
  const out: ReadingSection[] = []
  let headline = '사주 풀이'

  const judge = byId('judge')
  if (judge?.lines?.length) out.push({ icon: '🧭', label: '원국 구조', lines: judge.lines })

  const d = byId('ilju')?.block?.distilled
  if (d) {
    headline = d.title ?? headline
    const seong: string[] = d.distilled?.성격?.slice(0, 3) ?? []
    const lines = [d.distilled?.핵심, ...seong].filter(Boolean) as string[]
    if (lines.length) out.push({ icon: '🎴', label: `${d.title} 특성`, lines, source: srcOf(d) })
    const juui: string[] = d.distilled?.주의?.slice(0, 2) ?? []
    if (juui.length) out.push({ icon: '⚠️', label: '주의할 점', lines: juui, source: srcOf(d) })
  }

  const unseSec = rep.sections.find((s: any) => s.id === 'unse' && s.block?.excerpts?.length)
  if (unseSec) {
    const ex = unseSec.block.excerpts[0]
    out.push({ icon: '🍀', label: unseSec.title.replace('올해의 운 — ', '올해 · '), lines: ex.paras.slice(0, 3), source: `${ex.source.doc} · ${ex.source.title}` })
  }
  return { headline, sections: out }
}

// 샘플 프로필의 실제 근거 리딩 (state로 input이 안 오면 폴백)
// 모듈 평가 시점 호출 금지 — KB는 main.tsx의 loadKb() 게이트 이후에만 존재한다(Q05 경량화).
let _grounded: Reading | null = null
export function groundedReading(): Reading {
  if (!_grounded) _grounded = toReading({ year: 1990, month: 1, day: 1, hour: 8, minute: 24, gender: 'F' })
  return _grounded
}
