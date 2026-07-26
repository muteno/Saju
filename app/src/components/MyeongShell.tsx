import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { useNavigate, Navigate } from 'react-router-dom'
import Screen from './Screen'
import { tokens } from '../theme'
import { activeProfile } from '../data/profiles'
import { entered } from '../data/session'

/** 리포트 3분할(260725) 이후의 탭 축 — 인트로 → 분석 → 상담 + 재미·설정 */
export type MenuKey = 'intro' | 'analysis' | 'talk' | 'fun' | 'settings'

/** 목업 v2 정본 픽토그램 — 전부 인라인 SVG(stroke 2, round cap/join) */
const svgProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
export const Pict = {
  calendar: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  chart: (s = 19) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
  taegeuk: (s = 19, dots = false) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 000 18c-2.5-2-2.5-7 0-9s2.5-7 0-9z" />
      {dots && <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />}
      {dots && <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />}
    </svg>
  ),
  heart: (s = 19) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <path d="M12 21s-7-4.6-9.5-9A5.5 5.5 0 0112 6.5 5.5 5.5 0 0121.5 12c-2.5 4.4-9.5 9-9.5 9z" />
    </svg>
  ),
  person: (s = 19) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  ),
  search: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  book: (s = 24) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20V4a2 2 0 00-2-2H6.5A2.5 2.5 0 004 4.5v15z" />
      <path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5" />
    </svg>
  ),
  // ↓ 아래 6종 = 문자 도형(↗ ✉ ✎ ✓ ‹ ▼) 대체분. 표지판성 도형은 폰트 글리프가 원·박스
  // 정중앙에서 편심돼 정렬이 깨진다(방식론 §2) — 대칭 viewBox path만 정중앙을 보장한다.
  share: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <path d="M8 16L16 8M16 8H9M16 8v7" />
    </svg>
  ),
  mail: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3.5 7.5L12 13l8.5-5.5" />
    </svg>
  ),
  pencil: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <path d="M4 20h4L20 8l-4-4L4 16v4z" />
      <path d="M14.5 5.5L18.5 9.5" />
    </svg>
  ),
  check: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  /**
   * 복채 주머니 — 상담 헤더 우측(운영자 260727 "전화·문자 없애고 복채 주머니 픽토그램 하나").
   * 지금은 **자리만** 잡는다. 뒤에 퀘스트/보상 축이 붙을 자리다.
   * 형태 = 주둥이를 끈으로 묶은 복주머니(둥근 몸통 + 목 + 매듭 끈).
   */
  pouch: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <path d="M9 7.5h6l2.2 3.1a6.2 6.2 0 0 1-5.2 9.6h0a6.2 6.2 0 0 1-5.2-9.6z" />
      <path d="M8.6 7.5c1.2-.9 5.6-.9 6.8 0" />
      <path d="M10.4 4.2c.6 1 .6 2.3 0 3.3M13.6 4.2c-.6 1-.6 2.3 0 3.3" />
    </svg>
  ),
  /** 전송 — 예타 `.yeta-send` 아이콘 그대로 계승(같은 종이비행기 패스) */
  send: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <path d="M22 2 11 13M22 2 15 22 11 13 2 9z" />
    </svg>
  ),
  chevronLeft: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <path d="M14.5 5.5L8 12l6.5 6.5" />
    </svg>
  ),
  chevronDown: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <path d="M5.5 9.5L12 16l6.5-6.5" />
    </svg>
  ),
  chevronRight: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <path d="M9.5 5.5L16 12l-6.5 6.5" />
    </svg>
  ),
  /** 상담 탭 — 말풍선(대칭 viewBox · 꼬리는 좌하단) */
  chat: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" {...svgProps}>
      <path d="M20 12a7.5 7.5 0 01-7.5 7.5H8l-4 2.5v-4.6A7.5 7.5 0 0112.5 4.5 7.5 7.5 0 0120 12z" />
    </svg>
  ),
}

/**
 * 상주 크롬 유리 — 스크롤 콘텐츠·캐릭터 아트 위에 떠 있으므로 '충분히 불투명 + 채도 차단'이다
 * (방식론 §3-c). 260725 실측: .28 + blur11은 뒤 본문이 그대로 읽혀 크롬이 아니라 얼룩으로 보였다.
 * blur는 유지 — 유리감은 목업 v2 정본.
 */
const chromeGlass = {
  background: 'rgba(255,255,255,.92)',
  border: '1px solid rgba(255,255,255,.95)',
  // 채도 0 = 뒤 '색'까지 차단(§3-c). .78에서는 본문 글자가 알약 안쪽에서도 읽혔다(260725 실렌더 재확인).
  backdropFilter: 'blur(11px) saturate(0)',
  WebkitBackdropFilter: 'blur(11px) saturate(0)',
} as const

/**
 * 하단 글래스 플로팅 알약 네비 — 목업 v2(YETA .ynav 이식) 규격 계승.
 * 탭 = 드로어 메뉴와 1:1 5개이고, 앞 3칸이 **리포트 3단계 순서 그대로**다
 * (인트로 = 기본 원국+오늘 점수 → 분석 = 구체 풀이 → 상담 = 미연시. 운영자 260725 확정).
 * 5칸이 390px에 들어가도록 좌우 패딩만 17→12로 줄였다(높이·반경·색은 정본 그대로).
 */
function PillNav({ active, go }: { active: MenuKey; go: (to: string) => void }) {
  const tabs = [
    { key: 'intro', label: '인트로', to: '/result', icon: Pict.chart(20) },
    { key: 'analysis', label: '분석', to: '/analysis', icon: Pict.taegeuk(20, true) },
    { key: 'talk', label: '상담', to: '/talk', icon: Pict.chat(20) },
    { key: 'fun', label: '재미', to: '/fun', icon: Pict.heart(20) },
    { key: 'settings', label: '설정', to: '/settings', icon: Pict.person(20) },
  ] as const
  return (
    <Box
      sx={{
        position: 'absolute',
        left: '50%',
        bottom: 14,
        transform: 'translateX(-50%)',
        zIndex: 7,
        display: 'flex',
        gap: 0.75,
        p: '6px 10px',
        borderRadius: '999px',
        ...chromeGlass,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.75), var(--shadow-card)',
      }}
    >
      {tabs.map((t) => {
        const on = active === t.key
        return (
          <Box
            key={t.key}
            onClick={() => go(t.to)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                go(t.to)
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={t.label}
            aria-current={on ? 'page' : undefined}
            sx={{
              display: 'flex',
              alignItems: 'center',
              height: 40,
              px: '12px',
              borderRadius: '999px',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              transition: 'background .34s var(--ease), border-color .34s var(--ease), color .34s var(--ease)',
              bgcolor: on ? 'rgba(34,64,158,.14)' : 'transparent',
              border: `1px solid ${on ? 'rgba(34,64,158,.38)' : 'transparent'}`,
              // 비활성 탭 = inkFaint(유리 위 실측 2.5:1 = WCAG 비텍스트 3:1 미달) → inkSub(5.9:1) 근접 계승
              color: on ? tokens.color.primary : tokens.color.inkSub,
              boxShadow: on ? '0 0 18px rgba(34,64,158,.14)' : 'none',
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            {t.icon}
            {on && <span style={{ marginLeft: 6, whiteSpace: 'nowrap' }}>{t.label}</span>}
          </Box>
        )
      })}
    </Box>
  )
}

/**
 * 연식당 셸 — 로그인 후 5개 화면의 상주 크롬. 이제 **하단 알약 네비 하나뿐**이다.
 * 입장 전(플래그·프로필 모두 없음) = /login 게이트.
 *
 * 260726-b 운영자 지시로 **좌상단 햄버거와 드로어를 제거**했다 — 드로어 5행이 하단 탭 5칸과
 * 1:1 같은 축·같은 순서라 순수 중복이었고("아래에 메뉴들이 있어서"), 상단 44px 유틸이 차지하던
 * 만큼 모든 화면의 본문이 아래로 밀려 있었다. 같은 판정으로 우상단 프로필 팝오버가 먼저
 * 제거됐다(Q.37) — 상단 유틸은 이제 0개고, 화면 본문은 상태바 바로 아래에서 시작한다.
 *
 * ⚠ 되살릴 땐 각 화면의 상단 여백(현재 pt 0.5~1)도 함께 되돌려야 한다 — 크롬이 없다는 전제로 줄였다.
 */
export default function MyeongShell({
  active,
  gate = true,
  /**
   * 하단 알약 네비를 띄울지. **채팅 화면은 `false`** — 예타처럼 **입력행이 하단 바를 대신하고**
   * 그 좌측 버튼이 전 메뉴로 되돌린다(운영자 260727: "채팅 입력하는 게 네비랑 섞여 있다").
   * 네비와 입력행이 같은 자리에 둘 다 뜨면 손가락이 갈 곳을 잃는다.
   */
  nav: showNav = true,
  children,
}: {
  active: MenuKey
  gate?: boolean
  nav?: boolean
  children: ReactNode
}) {
  const nav = useNavigate()
  const profile = activeProfile()

  // gate=false = 공유 딥링크로 들어온 화면(리포트). 프로필 없는 수신자를 로그인으로 튕기면
  // 공유 루프가 끊긴다 — 크롬(네비)은 그대로 주고 입장 게이트만 면제한다.
  if (gate && !entered() && !profile) return <Navigate to="/login" replace />

  return (
    <Screen>
      {children}
      {showNav && <PillNav active={active} go={(to) => nav(to)} />}
    </Screen>
  )
}
