import type { OhaengKey } from '../theme'

/**
 * 샘플 데이터 — dosa-app/engine(computeChart)의 실제 출력값을 그대로 반영.
 * 입력: 1990/01/01 08:24, 여자, 서울 진태양시 보정(-32분) → 07:52.
 * 원국: 기사년 병자월 병인일 임진시 (일간 병火). 대운수 2 순행.
 * ── 실 서비스에선 engine.computeChart()를 그대로 호출해 이 구조를 채운다.
 */
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

export interface Pillar {
  title: string // 시/일/월/년
  topStar: string // 천간 십신
  gan: string // 천간(한자)
  ganK: string // 천간(한글)
  ganE: OhaengKey
  ganPolarity: '+' | '-'
  ji: string // 지지(한자)
  jiK: string // 지지(한글)
  jiE: OhaengKey
  jiPolarity: '+' | '-'
  botStar: string // 지지 십신
  stage: string // 십이운성
  isDayMaster?: boolean
}

/** 왼→오른: 시주 · 일주 · 월주 · 년주 (engine.saju 출력 순서 재배열) */
export const mockPillars: Pillar[] = [
  { title: '시', topStar: '편관', gan: '壬', ganK: '임', ganE: '수', ganPolarity: '+', ji: '辰', jiK: '진', jiE: '토', jiPolarity: '+', botStar: '식신', stage: '관대' },
  { title: '일', topStar: '일원', gan: '丙', ganK: '병', ganE: '화', ganPolarity: '+', ji: '寅', jiK: '인', jiE: '목', jiPolarity: '+', botStar: '편인', stage: '장생', isDayMaster: true },
  { title: '월', topStar: '비견', gan: '丙', ganK: '병', ganE: '화', ganPolarity: '+', ji: '子', jiK: '자', jiE: '수', jiPolarity: '-', botStar: '정관', stage: '태' },
  { title: '년', topStar: '상관', gan: '己', ganK: '기', ganE: '토', ganPolarity: '-', ji: '巳', jiK: '사', jiE: '화', jiPolarity: '+', botStar: '비견', stage: '건록' },
]

export const dayMaster = { ganK: '병', gan: '丙', element: '화' as OhaengKey }

export type Verdict = '부족' | '적정' | '발달' | '과다'
export interface OhaengStat {
  key: OhaengKey
  pct: number
  verdict: Verdict
}

/** 8자 오행 분포 (목1·화3·토2·금0·수2 = 12.5/37.5/25/0/25) */
export const mockOhaeng: OhaengStat[] = [
  { key: '목', pct: 12.5, verdict: '적정' },
  { key: '화', pct: 37.5, verdict: '과다' },
  { key: '토', pct: 25.0, verdict: '발달' },
  { key: '금', pct: 0.0, verdict: '부족' },
  { key: '수', pct: 25.0, verdict: '발달' },
]

/** 오늘의 일진 — engine.computeChart(오늘)에서 산출. 점수는 서비스 정책값(placeholder) */
export const todayIljin = {
  date: '7월 16일 목요일',
  yearName: '병오',
  monthName: '을미',
  dayName: '신묘',
  dayHanja: '辛卯',
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

/** 결과 화면 대화(아이샤가 읽어주는 사주 풀이) — Figma 결과 케이스 재현 */
export const mockReading = {
  headline: '정리와 절제',
  sections: [
    { icon: '🧘', label: '태도 가이드', lines: ['하루 할 일을 3개로 줄이기', '길어진 관계와 약속을 잘라내기'] },
    { icon: '🍀', label: '환경 설정', lines: ['흰색·은색 소품 곁에 두기', '수납이 쉬운 정리 도구 사용'] },
    { icon: '⚠️', label: '주의 사항', lines: ['즉흥적으로 말하고 즉흥적으로 결정하는 상황을 피하세요.'] },
  ],
}
