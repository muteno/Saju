import { useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { useNavigate, Navigate } from 'react-router-dom'
import Screen from './Screen'
import { tokens } from '../theme'
import { activeProfile } from '../data/profiles'
import { entered } from '../data/session'
import { HOST_NAME } from '../data/chefs'

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

const press = { transition: 'transform .12s var(--ease)', '&:active': { transform: 'scale(0.98)' } }

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

/** 좌 드로어 메뉴 행 */
function DrawerItem({ icon, label, on, onClick }: { icon: ReactNode; label: string; on: boolean; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      role="button"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.2,
        py: 1.5,
        borderRadius: '12px',
        cursor: 'pointer',
        bgcolor: on ? tokens.color.primarySoft : 'transparent',
        color: on ? tokens.color.primary : tokens.color.ink,
        fontSize: 14.5,
        fontWeight: on ? 800 : 700,
        ...press,
      }}
    >
      {icon}
      {label}
    </Box>
  )
}

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
            role="button"
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
              color: on ? tokens.color.primary : tokens.color.inkFaint,
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
 * 명식당 셸 — 로그인 후 5개 화면의 상주 크롬(좌 햄버거 드로어 + 하단 알약 네비).
 * 오버레이는 스크림 탭으로 닫힌다. 입장 전(플래그·프로필 모두 없음) = /login 게이트.
 *
 * 260726 운영자 지시로 **우상단 프로필 아바타·팝오버를 제거**했다 — 팝오버가 담던 4기능
 * (프로필 전환·내 설정·구매 내역·로그아웃)이 이미 '내 설정' 화면(탭 5번)에 전부 실재해
 * 상단 유틸이 순수 중복이었다. 계정 축 진입점 = 설정 한 곳(§5 통일).
 */
export default function MyeongShell({ active, gate = true, children }: { active: MenuKey; gate?: boolean; children: ReactNode }) {
  const nav = useNavigate()
  const [drawer, setDrawer] = useState(false)
  const profile = activeProfile()

  // gate=false = 공유 딥링크로 들어온 화면(리포트). 프로필 없는 수신자를 로그인으로 튕기면
  // 공유 루프가 끊긴다 — 크롬(드로어·네비)은 그대로 주고 입장 게이트만 면제한다.
  if (gate && !entered() && !profile) return <Navigate to="/login" replace />

  const go = (to: string) => {
    setDrawer(false)
    nav(to)
  }
  // 드로어 = 하단 탭과 1:1(같은 5축·같은 순서). 라벨만 길게 써서 무엇인지 설명한다
  const menu = [
    { key: 'intro', label: '내 원국 · 오늘 운세', to: '/result', icon: Pict.chart(19) },
    { key: 'analysis', label: '사주 분석 풀이', to: '/analysis', icon: Pict.taegeuk(19) },
    { key: 'talk', label: `${HOST_NAME}와 상담하기`, to: '/talk', icon: Pict.chat(19) },
    { key: 'fun', label: '사주 재미', to: '/fun', icon: Pict.heart(19) },
    { key: 'settings', label: '내 설정', to: '/settings', icon: Pict.person(19) },
  ] as const

  return (
    <Screen>
      {children}

      {/* 상단 유틸 — 햄버거(좌) */}
      <Box sx={{ position: 'absolute', top: 50, left: 16, zIndex: 8 }}>
        <Box
          onClick={() => setDrawer((v) => !v)}
          role="button"
          aria-label="메뉴"
          sx={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            ...chromeGlass,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.75)',
            color: tokens.color.ink,
            ...press,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </Box>
      </Box>

      {/* 드로어 */}
      {drawer && (
        <>
          <Box onClick={() => setDrawer(false)} sx={{ position: 'absolute', inset: 0, zIndex: 9, background: 'rgba(13,14,20,.35)' }} />
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: 280,
              zIndex: 10,
              animation: 'msd-slidein .25s var(--ease)',
              background: 'rgba(255,255,255,.85)',
              borderRight: '1px solid rgba(255,255,255,.9)',
              backdropFilter: 'blur(26px) saturate(1.3)',
              WebkitBackdropFilter: 'blur(26px) saturate(1.3)',
              boxShadow: '20px 0 50px rgba(28,38,78,.2)',
              p: '60px 20px 20px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: tokens.color.primary }}>명식당</Typography>
            <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: tokens.color.inkFaint, mt: 0.3 }}>운명을 차려내는 식당 · 주인 연리</Typography>
            <Box sx={{ mt: 2.7, display: 'flex', flexDirection: 'column', gap: 0.3 }}>
              {menu.map((m) => (
                <DrawerItem key={m.key} icon={m.icon} label={m.label} on={active === m.key} onClick={() => go(m.to)} />
              ))}
            </Box>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ borderTop: '1px solid rgba(20,24,45,.08)', pt: 1.8, fontSize: 12, color: tokens.color.inkFaint, fontWeight: 600, lineHeight: 1.6 }}>
              근거 문헌 2,504편 기반
              <br />
              명식당 v0.1
            </Typography>
          </Box>
        </>
      )}

      <PillNav active={active} go={go} />
    </Screen>
  )
}
