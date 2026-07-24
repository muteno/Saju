/**
 * [E13] QA 미리보기 — `?qa=1` = 로그인(입장) 없이 전 화면을 렌더하는 디자인 검수 경로.
 * 렌더-영수증 게이트가 요구하는 '대표 데이터(최악 케이스)'를 시드해 실데이터 픽셀을 재현한다:
 * 최장 이름(줄바꿈·오버플로) · 경계 시각 23:59(야자시 경계) · 연말 12/31.
 * 안전: 기존 프로필이 하나라도 있으면 시드하지 않는다(실사용자 데이터 무접촉).
 * 딥링크: `?qa=1&view=analysis` = 정적 호스팅(SPA 폴백 없음)에서도 해당 라우트로 진입.
 */
import { listProfiles, saveProfile, setActiveProfile } from './profiles'
import { setEntered } from './session'

const VIEWS = ['myday', 'analysis', 'fun', 'settings', 'input', 'loading', 'result', 'login', 'signup', 'find']

export function isQa(): boolean {
  try {
    return /(?:^|[?&])qa=(1|user|admin)(?:&|$)/.test(location.search)
  } catch {
    return false
  }
}

export function seedQa(): void {
  if (!isQa()) return
  try {
    setEntered()
    if (listProfiles().length === 0) {
      const p = saveProfile({
        name: '가나다라마바사아자차카타파하', // 최장 텍스트 = 줄바꿈·말줄임 재현
        gender: '여자',
        calendar: '양력',
        year: 1999,
        month: 12,
        day: 31, // 연말 경계
        hour: 23,
        minute: 59, // 야자시 경계 시각
        hourUnknown: false,
        city: '서울',
        marital: '미혼',
        solarCorrection: true,
        lateZi: false,
      })
      setActiveProfile(p.id)
    }
    const v = new URLSearchParams(location.search).get('view')
    if (v && VIEWS.includes(v) && location.pathname === '/') {
      history.replaceState(null, '', `/${v}${location.search}`)
    }
    console.log('[QA] saju preview seeded (대표데이터 · 무로그인)')
  } catch (e) {
    console.error('[QA] seed fail', e)
  }
}
