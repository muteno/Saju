/**
 * 계정·기억 계층 — "한 번 로그인하면 그 정보가 항상 기억되고, 다음엔 버튼 하나로 들어온다".
 *
 * 지금은 **기기 로컬**이다. 서버 계정(이메일+비번 + Cloudflare D1)은 이미 구현돼
 * `backup/app-deploy-accounts-260722` 브랜치에 보존돼 있지만, 되살리려면 D1 바인딩·비번 해싱·
 * 세션 쿠키 = 인프라 결정이 걸린 로드맵 항목(상용화 로드맵 「계정·동기화」)이라 세션이 임의로 켜지 않는다.
 *
 * 그래서 이 파일은 **서버가 붙을 자리를 미리 낸 모양**으로 짠다(D3-1 "알림·확인 UI는 설계 시점에 배선"):
 *   · 기억해야 하는 것은 전부 여기 한 곳을 지난다(화면이 localStorage를 직접 만지지 않는다)
 *   · `remember()` / `currentAccount()` / `markVisit()` 세 함수가 인터페이스다 —
 *     서버가 붙으면 이 함수들 **안에서만** fetch를 하고 로컬은 캐시로 남는다
 *   · 따라서 서버 전환 시 화면 코드는 한 줄도 안 바뀐다
 *
 * ⚠ 정직 표기: 지금은 자격 증명을 검증하지 않는다. 화면은 "이 기기에 기억됨"으로 쓰고
 *    "인증됨"이라고 말하지 않는다(거짓 액티브 금지 = 레포 관례).
 *
 * fail-soft: storage 불가(사파리 시크릿 등)여도 세션 메모리로 동작한다.
 */
import { todayKST } from '../engine'

export interface Account {
  /** 로그인에 쓴 식별자(아이디 또는 이메일) — 표시·자동 채움용 */
  loginId: string
  /** 마지막으로 들어온 날(KST, YYYY-MM-DD) */
  lastVisit: string
  /** 연속 방문 일수 — 어제 왔으면 +1, 건너뛰면 1로 리셋 */
  streak: number
  /** 누적 방문 일수(연속과 별개) */
  totalVisits: number
  /** 처음 기억된 시각 */
  since: number
}

const KEY = 'msd-account-v1'
let memory: Account | null = null

function read(): Account | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return memory
    const a = JSON.parse(raw)
    if (!a || typeof a.loginId !== 'string') return memory
    return a as Account
  } catch {
    return memory
  }
}

function write(a: Account | null) {
  memory = a
  try {
    if (a) localStorage.setItem(KEY, JSON.stringify(a))
    else localStorage.removeItem(KEY)
  } catch {
    /* fail-soft */
  }
}

/** 오늘 날짜(KST, YYYY-MM-DD) — 스트릭 판정의 유일한 시간 기준(D4: naive Date 금지) */
export function todayKey(): string {
  const t = todayKST()
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`
}

/** 어제 날짜 키 — 연속 판정용 */
function yesterdayKey(): string {
  const t = todayKST()
  const d = new Date(Date.UTC(t.year, t.month - 1, t.day))
  d.setUTCDate(d.getUTCDate() - 1)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** 지금 기억된 계정(없으면 null) */
export function currentAccount(): Account | null {
  return read()
}

/** 로그인한 적이 있나 = 원탭 재로그인을 보여줄지 */
export function hasRemembered(): boolean {
  return read() !== null
}

/**
 * 로그인 성공(=입장) 시 호출. 식별자를 기억하고 방문을 찍는다.
 * 이미 기억된 계정과 같은 식별자면 스트릭이 이어지고, 다른 사람이면 새로 시작한다.
 */
export function remember(loginId: string): Account {
  const prev = read()
  const id = loginId.trim() || prev?.loginId || '나'
  const base: Account =
    prev && prev.loginId === id
      ? prev
      : { loginId: id, lastVisit: '', streak: 0, totalVisits: 0, since: Date.now() }
  const next = applyVisit(base)
  write(next)
  return next
}

/** 방문 기록만 갱신(이미 로그인된 상태로 앱을 열었을 때) */
export function markVisit(): Account | null {
  const a = read()
  if (!a) return null
  if (a.lastVisit === todayKey()) return a // 하루 한 번만 센다
  const next = applyVisit(a)
  write(next)
  return next
}

function applyVisit(a: Account): Account {
  const today = todayKey()
  if (a.lastVisit === today) return a
  const streak = a.lastVisit === yesterdayKey() ? a.streak + 1 : 1
  return { ...a, lastVisit: today, streak, totalVisits: a.totalVisits + 1 }
}

/**
 * 로그아웃 — 입장 상태만 푼다. **기억은 지우지 않는다**(운영자 260725:
 * "로그인한적있으면 그 로그인 데이터 기억하고 그냥 로그인만 누르면 로그인되게").
 * 완전 삭제는 `forgetAccount()`.
 */
export function forgetAccount() {
  write(null)
}
