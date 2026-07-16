import { computeChartUI, todayIljin as engineToday } from '../engine'

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

/** 결과 화면 대화(아이샤가 읽어주는 사주 풀이) — 추후 L3/L4 리포트로 대체 */
export const mockReading = {
  headline: '정리와 절제',
  sections: [
    { icon: '🧘', label: '태도 가이드', lines: ['하루 할 일을 3개로 줄이기', '길어진 관계와 약속을 잘라내기'] },
    { icon: '🍀', label: '환경 설정', lines: ['흰색·은색 소품 곁에 두기', '수납이 쉬운 정리 도구 사용'] },
    { icon: '⚠️', label: '주의 사항', lines: ['즉흥적으로 말하고 즉흥적으로 결정하는 상황을 피하세요.'] },
  ],
}
