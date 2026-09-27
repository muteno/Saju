import type { ChartInput } from '../engine'
import { cityByName } from './cities'

/**
 * 프로필 저장소 — localStorage(기기 로컬). 재방문 시 재입력 없이 내 사주 홈 구성.
 * 계정 축은 레포 바인딩상 미구현('없음') — 로컬 우선 + (로드맵) 계정 동기화.
 * fail-soft: storage 불가(사파리 시크릿 등)여도 앱은 세션 메모리로 동작.
 */
export interface StoredProfile {
  id: string
  name: string
  gender: '여자' | '남자'
  calendar: '양력' // 음력 변환은 엔진 미지원(260718 실측) — 지원 시 확장
  year: number
  month: number
  day: number
  hour: number
  minute: number
  hourUnknown: boolean
  city: string
  marital: '미혼' | '기혼'
  /** 진태양시 보정(경도×4분) — 기본 켜짐(엔진 기본값과 동일) */
  solarCorrection?: boolean
  /** 야자시(23시대 일주 유지 = keepDay) — 기본 꺼짐(정자시) */
  lateZi?: boolean
  createdAt: number
}

interface Store {
  active: string | null
  list: StoredProfile[]
}

const KEY = 'saju-profiles-v1'
let memory: Store = { active: null, list: [] } // storage 불가 환경 폴백
let memoryOnly = false

function validProfile(value: unknown): value is StoredProfile {
  if (!value || typeof value !== 'object') return false
  const p = value as StoredProfile
  const date = new Date(Date.UTC(p.year, p.month - 1, p.day))
  return typeof p.id === 'string' && typeof p.name === 'string' &&
    (p.gender === '남자' || p.gender === '여자') && p.calendar === '양력' &&
    Number.isInteger(p.year) && p.year >= 1900 && p.year <= 2100 &&
    Number.isInteger(p.month) && p.month >= 1 && p.month <= 12 &&
    Number.isInteger(p.day) && p.day >= 1 && date.getUTCMonth() === p.month - 1 && date.getUTCDate() === p.day &&
    Number.isInteger(p.hour) && p.hour >= 0 && p.hour <= 23 &&
    Number.isInteger(p.minute) && p.minute >= 0 && p.minute <= 59 &&
    typeof p.hourUnknown === 'boolean' && typeof p.city === 'string' &&
    (p.marital === '미혼' || p.marital === '기혼') && Number.isFinite(p.createdAt) &&
    (p.solarCorrection === undefined || typeof p.solarCorrection === 'boolean') &&
    (p.lateZi === undefined || typeof p.lateZi === 'boolean')
}

function read(): Store {
  if (memoryOnly) return memory
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return memory
    const s = JSON.parse(raw)
    if (!s || !Array.isArray(s.list)) return memory
    const list = s.list.filter(validProfile)
    memory = { active: list.some((p: StoredProfile) => p.id === s.active) ? s.active : list[0]?.id ?? null, list }
    return memory
  } catch {
    return memory
  }
}

function write(s: Store) {
  memory = s
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // 쓰기만 차단된 환경에서 다음 read가 디스크의 예전 값으로 되돌리지 않게 한다.
    memoryOnly = true
  }
}

export function listProfiles(): StoredProfile[] {
  return read().list
}

export function activeProfile(): StoredProfile | null {
  const s = read()
  return s.list.find((p) => p.id === s.active) ?? s.list[0] ?? null
}

export function saveProfile(p: Omit<StoredProfile, 'id' | 'createdAt'>, editId?: string): StoredProfile {
  const s = read()
  // 동일 인물(이름+생년월일시) 재제출 = 갱신 (중복 누적 방지)
  const dup = s.list.find((q) => q.id === editId) ?? s.list.find(
    (q) => q.name === p.name && q.year === p.year && q.month === p.month && q.day === p.day && q.hour === p.hour && q.minute === p.minute,
  )
  const id = dup?.id ?? (typeof globalThis.crypto?.randomUUID === 'function' ? crypto.randomUUID() : `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)
  const stored: StoredProfile = { ...p, id, createdAt: dup?.createdAt ?? Date.now() }
  if (!validProfile(stored)) throw new Error('잘못된 프로필 정보')
  const list = dup ? s.list.map((q) => (q.id === id ? stored : q)) : [...s.list, stored]
  write({ active: id, list })
  return stored
}

export function setActiveProfile(id: string) {
  const s = read()
  if (s.list.some((p) => p.id === id)) write({ ...s, active: id })
}

export function removeProfile(id: string) {
  const s = read()
  const list = s.list.filter((p) => p.id !== id)
  write({ active: s.active === id ? (list[0]?.id ?? null) : s.active, list })
}

/** 프로필 → 엔진 입력 (경도 포함). 시간 모름이면 정오 대입 — 일주 판정 안전 실증(260718 엔진 실측). */
export function profileToInput(p: Omit<StoredProfile, 'id' | 'createdAt'>): ChartInput {
  return {
    year: p.year,
    month: p.month,
    day: p.day,
    hour: p.hourUnknown ? 12 : p.hour,
    minute: p.hourUnknown ? 0 : p.minute,
    gender: p.gender === '남자' ? 'M' : 'F',
    longitude: cityByName(p.city).longitude,
    ...(p.solarCorrection === false ? { solarTimeCorrection: false } : {}),
    ...(p.lateZi ? { lateZiRule: 'keepDay' as const } : {}),
  }
}

/** 결과 화면 딥링크(공유·새로고침 안전) — 프로필을 URL 쿼리로 직렬화 */
export function profileToSearch(p: StoredProfile): string {
  const q = new URLSearchParams({
    y: String(p.year),
    mo: String(p.month),
    d: String(p.day),
    g: p.gender === '남자' ? 'M' : 'F',
    city: p.city,
  })
  if (p.hourUnknown) q.set('hu', '1')
  else q.set('t', `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`)
  if (p.name) q.set('n', p.name)
  if (p.solarCorrection === false) q.set('sc', '0')
  if (p.lateZi) q.set('lz', '1')
  return q.toString()
}

export interface ParsedShare {
  input: ChartInput
  name: string
  city: string
  hourUnknown: boolean
}

/** 이름만 같은 다른 사주에 내 기기의 보조 검사 결과를 붙이지 않는다. */
export function matchesShare(profile: StoredProfile, share: ParsedShare): boolean {
  if (profile.name !== share.name || profile.hourUnknown !== share.hourUnknown || profile.city !== share.city) return false
  const own = profileToInput(profile)
  const other = share.input
  return own.year === other.year && own.month === other.month && own.day === other.day &&
    own.hour === other.hour && own.minute === other.minute && own.gender === other.gender &&
    own.longitude === other.longitude && (own.solarTimeCorrection !== false) === (other.solarTimeCorrection !== false) &&
    (own.lateZiRule ?? 'midnight23') === (other.lateZiRule ?? 'midnight23')
}

/** 딥링크 쿼리 → 엔진 입력 (검증 포함 — 불량이면 null) */
export function parseShare(search: string): ParsedShare | null {
  try {
    const q = new URLSearchParams(search)
    const y = Number(q.get('y'))
    const mo = Number(q.get('mo'))
    const d = Number(q.get('d'))
    const g = q.get('g')
    const hourUnknown = q.get('hu') === '1'
    const t = q.get('t') ?? ''
    if (!hourUnknown && !/^\d{1,2}:\d{2}$/.test(t)) return null
    const [hh, mi] = t.split(':').map(Number)
    if (!Number.isInteger(y) || y < 1900 || y > 2100) return null
    if (!Number.isInteger(mo) || mo < 1 || mo > 12) return null
    if (!Number.isInteger(d) || d < 1 || d > 31) return null
    if (new Date(Date.UTC(y, mo - 1, d)).getUTCDate() !== d) return null // 2/31 등 실존하지 않는 날짜 차단
    if (g !== 'M' && g !== 'F') return null
    if (!hourUnknown && (!Number.isInteger(hh) || hh < 0 || hh > 23 || !Number.isInteger(mi) || mi < 0 || mi > 59)) return null
    const city = q.get('city') ?? '서울'
    return {
      input: {
        year: y,
        month: mo,
        day: d,
        hour: hourUnknown ? 12 : hh,
        minute: hourUnknown ? 0 : mi,
        gender: g,
        longitude: cityByName(city).longitude,
        ...(q.get('sc') === '0' ? { solarTimeCorrection: false } : {}),
        ...(q.get('lz') === '1' ? { lateZiRule: 'keepDay' as const } : {}),
      },
      name: q.get('n') ?? '',
      city,
      hourUnknown,
    }
  } catch {
    return null
  }
}
