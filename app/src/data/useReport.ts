/**
 * 리포트 3화면(인트로·분석·상담)이 공유하는 데이터 해소 훅.
 *
 * 260725 3분할(운영자: "기본 개요, 상담하기 이런거는 아예 분리")로 한 화면이 세 화면이 되면서
 * 데이터 소스 해소 로직이 3중 복제될 위험이 생겼다 — 여기 한 곳에만 둔다.
 * 소스 우선순위(기존 Result.tsx 정본 그대로): URL 파라미터(공유·새로고침 안전) → 저장 프로필 → 샘플.
 */
import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { computeChartUI, buildReading, jeonggokRaw, type UiChart, type ReportBundle } from '../engine'
import { selectJeonggok, type JeonggokPick } from './jeonggok'
import { toReading, SAMPLE_INPUT, type Reading } from './saju'
import { activeProfile, matchesShare, parseShare, profileToInput, profileToSearch } from './profiles'

export interface ResolvedSource {
  input: ReturnType<typeof profileToInput>
  name: string
  city: string
  hourUnknown: boolean
  /** 저장 프로필도 파라미터도 없어 샘플로 보여주는 중 */
  sample: boolean
  /** 남의 사주를 공유 링크로 받아 보는 중 */
  shared: boolean
  /** 3화면 사이를 넘어갈 때 그대로 실어 보낼 쿼리(물음표 없음) */
  search: string
  /** 파라미터가 있는데 파싱 실패 = 잘못된 공유 링크 */
  broken: boolean
}

export interface ReportData {
  resolved: ResolvedSource
  chart: UiChart | null
  reading: Reading | null
  /** L4 대화용 원본 번들(주제 결정론 매핑의 근거 소스) */
  report: ReportBundle | null
  jeonggok: JeonggokPick | null
}

export function useReport(): ReportData {
  const loc = useLocation()

  const resolved = useMemo<ResolvedSource>(() => {
    const shared = parseShare(loc.search)
    if (shared) {
      // 이 링크가 내 저장 프로필과 같으면 '내 것', 다르면 '공유받은 사주'
      const mine = activeProfile()
      const isMine = !!mine && matchesShare(mine, shared)
      return { ...shared, sample: false, shared: !isMine, search: loc.search.replace(/^\?/, ''), broken: false }
    }
    const hasParams = /(^|[?&])y=/.test(loc.search)
    if (hasParams) return { input: SAMPLE_INPUT, name: '', city: '서울', hourUnknown: false, sample: false, shared: false, search: '', broken: true }
    const p = activeProfile()
    if (p && Number.isInteger(p.year) && p.year >= 1900 && p.year <= 2100)
      return { input: profileToInput(p), name: p.name, city: p.city, hourUnknown: p.hourUnknown, sample: false, shared: false, search: profileToSearch(p), broken: false }
    return { input: SAMPLE_INPUT, name: '', city: '서울', hourUnknown: false, sample: true, shared: false, search: '', broken: false }
  }, [loc.search])

  const chart = useMemo<UiChart | null>(() => {
    if (resolved.broken) return null
    try {
      return computeChartUI(resolved.input)
    } catch {
      return null
    }
  }, [resolved])

  const reading = useMemo<Reading | null>(() => {
    if (!chart) return null
    try {
      // 공유받은 리포트엔 profileName 미전달 — 수신자 기기 툴킷 데이터가 공유자 이름에
      // 오귀속되는 것 차단(평의회 260719 위원3)
      return toReading(resolved.input, { hourUnknown: resolved.hourUnknown, profileName: resolved.shared ? undefined : resolved.name || undefined })
    } catch {
      return null
    }
  }, [chart, resolved])

  const report = useMemo<ReportBundle | null>(() => {
    if (!chart) return null
    try {
      return buildReading(resolved.input)
    } catch {
      return null
    }
  }, [chart, resolved])

  // 정곡 오프닝 — 시간 모름이면 스킵(시주 오염 산출물 배제 = 근거 원칙)
  const jeonggok = useMemo<JeonggokPick | null>(() => {
    if (!chart || resolved.hourUnknown) return null
    try {
      return selectJeonggok(jeonggokRaw(resolved.input))
    } catch {
      return null
    }
  }, [chart, resolved])

  return { resolved, chart, reading, report, jeonggok }
}

/** 3화면 사이 이동 경로 — 쿼리를 잃지 않게 항상 이 함수로 만든다 */
export function stepPath(to: 'intro' | 'analysis' | 'talk', search: string): string {
  const q = search ? `?${search}` : ''
  return `/${to === 'intro' ? 'result' : to}${q}`
}
