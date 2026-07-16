import type { OhaengKey } from '../theme'

/**
 * 목업 사주 데이터. 실제 만세력 계산/AI 지식 연결은 별도(사용자 설계).
 * Figma 결과 화면(1990/01/01 08:24, 여자) 값을 그대로 재현.
 */
export interface Profile {
  name: string
  gender: '여자' | '남자'
  calendar: '양력' | '음력' | '음력(윤달)'
  birth: string // YYYY/MM/DD HH:mm
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
  topStar: string // 상단 십성
  gan: string // 천간(한자)
  ganK: string // 천간(한글)
  ganE: OhaengKey
  ganPolarity: '+' | '-'
  ji: string // 지지(한자)
  jiK: string // 지지(한글)
  jiE: OhaengKey
  jiPolarity: '+' | '-'
  botStar: string // 하단 십성
  isDayMaster?: boolean
}

/** 왼→오른: 시주 · 일주 · 월주 · 년주 */
export const mockPillars: Pillar[] = [
  { title: '시', topStar: '편관', gan: '壬', ganK: '임', ganE: '수', ganPolarity: '+', ji: '辰', jiK: '진', jiE: '토', jiPolarity: '+', botStar: '식신' },
  { title: '일', topStar: '비견', gan: '丙', ganK: '병', ganE: '화', ganPolarity: '+', ji: '寅', jiK: '인', jiE: '목', jiPolarity: '+', botStar: '편인', isDayMaster: true },
  { title: '월', topStar: '비견', gan: '丙', ganK: '병', ganE: '화', ganPolarity: '+', ji: '子', jiK: '자', jiE: '수', jiPolarity: '-', botStar: '정관' },
  { title: '년', topStar: '상관', gan: '己', ganK: '기', ganE: '토', ganPolarity: '-', ji: '巳', jiK: '사', jiE: '화', jiPolarity: '+', botStar: '비견' },
]

export type Verdict = '부족' | '적정' | '발달' | '과다'
export interface OhaengStat {
  key: OhaengKey
  pct: number
  verdict: Verdict
}

export const mockOhaeng: OhaengStat[] = [
  { key: '목', pct: 25.0, verdict: '발달' },
  { key: '화', pct: 50.0, verdict: '과다' },
  { key: '토', pct: 12.5, verdict: '적정' },
  { key: '금', pct: 0.0, verdict: '부족' },
  { key: '수', pct: 12.5, verdict: '적정' },
]

/** 결과 화면 대화(아이샤가 읽어주는 사주 풀이) */
export const mockReading = {
  headline: '정리와 절제',
  sections: [
    { icon: '🧘', label: '태도 가이드', lines: ['하루 할 일을 3개로 줄이기', '길어진 관계와 약속을 잘라내기'] },
    { icon: '🍀', label: '환경 설정', lines: ['흰색·은색 소품 곁에 두기', '수납이 쉬운 정리 도구 사용'] },
    { icon: '⚠️', label: '주의 사항', lines: ['즉흥적으로 말하고 즉흥적으로 결정하는 상황을 피하세요.'] },
  ],
}
