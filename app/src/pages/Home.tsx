import type { ReactNode } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import Screen from '../components/Screen'
import StatusBar from '../components/StatusBar'
import BillyNav from '../components/BillyNav'
import SajuTable from '../components/SajuTable'
import { tokens } from '../theme'
import { useMode } from '../mode'
import { mockProfile, mockPillars, mockOhaeng, todayIljin, homeSummary } from '../data/saju'

function CircleBtn({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ width: 42, height: 42, borderRadius: '50%', bgcolor: tokens.color.primarySoft, color: tokens.color.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>
      {children}
    </Box>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.color.ink, mb: 1.2, mt: 2.5 }}>{children}</Typography>
}

function OhaengMini() {
  return (
    <Box sx={{ display: 'flex', gap: 0.6, mt: 1.2 }}>
      {mockOhaeng.map((o) => (
        <Box key={o.key} sx={{ flex: 1, textAlign: 'center' }}>
          <Box sx={{ height: 5, borderRadius: 3, bgcolor: tokens.ohaeng[o.key].bg, mb: 0.5 }} />
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.ohaeng[o.key].label, lineHeight: 1.1 }}>{o.key}</Typography>
          <Typography sx={{ fontSize: 9.5, color: tokens.color.inkFaint, fontWeight: 500 }}>{o.pct}%</Typography>
        </Box>
      ))}
    </Box>
  )
}

export default function Home() {
  const nav = useNavigate()
  const { mode } = useMode()
  const dark = mode === 'dark'
  const heroBg = dark
    ? 'linear-gradient(180deg,#2a2a31 0%, #232329 55%, var(--c-page) 100%)'
    : 'linear-gradient(180deg,#fce7db 0%, #fbeee7 55%, var(--c-page) 100%)'
  const meadow = dark ? 'radial-gradient(circle at 50% 40%, #33422f, #2a3329)' : 'radial-gradient(circle at 50% 40%, #d9ecc4, #c4e0ac)'

  return (
    <Screen>
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {/* 히어로 */}
        <Box sx={{ background: heroBg, px: 2.5, pb: 2 }}>
          <StatusBar time="9:41" />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 0.5 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: tokens.color.primary, letterSpacing: 'var(--tracking)' }}>아이샤</Typography>
            <Box sx={{ display: 'flex', gap: 1.8, fontSize: 19, color: tokens.color.ink }}>
              <span>🔍</span>
              <span>📮</span>
            </Box>
          </Box>

          {/* 이름 + 날짜 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.2, mt: 2 }}>
            <Box sx={{ lineHeight: 1.05 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: tokens.color.inkFaint }}>JUL</Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 800, color: tokens.color.inkSub }}>16</Typography>
            </Box>
            <Typography sx={{ fontSize: 32, fontWeight: 800, color: tokens.color.ink, letterSpacing: 'var(--tracking)' }}>{mockProfile.name}</Typography>
          </Box>

          {/* 말풍선 */}
          <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
            <Box sx={{ position: 'relative', maxWidth: '78%', bgcolor: tokens.color.primary, color: tokens.color.onPrimary, px: 2, py: 1.3, borderRadius: '18px' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>
                오늘 일진은 <b>{todayIljin.dayName}</b>일, {todayIljin.oneLine}
              </Typography>
              <Box sx={{ position: 'absolute', bottom: -7, left: 30, width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: `9px solid ${tokens.color.primary}` }} />
            </Box>
          </Box>

          {/* 캐릭터 */}
          <Box sx={{ mt: 1, mx: 'auto', width: 210, height: 150, borderRadius: '50%', background: meadow, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <span style={{ fontSize: 84, filter: 'drop-shadow(0 8px 10px rgba(0,0,0,0.15))' }}>🐴</span>
            <span style={{ position: 'absolute', top: 18, right: 34, fontSize: 15 }}>✨</span>
          </Box>

          {/* 액션 + 오늘의 운세 점수 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mt: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <CircleBtn>↗</CircleBtn>
              <CircleBtn>📮</CircleBtn>
              <CircleBtn>✎</CircleBtn>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.color.inkSub }}>오늘의 운세</Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.4, justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 44, fontWeight: 800, color: 'var(--c-ink)', lineHeight: 1, letterSpacing: 'var(--tracking)' }}>{todayIljin.score}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-ink-sub)', paddingBottom: 4 }}>점</span>
              </Box>
            </Box>
          </Box>

          {/* 분석 진입 — 단일 버튼 규격(outlined=보조 동작) */}
          <Button fullWidth variant="outlined" onClick={() => nav('/loading')} sx={{ mt: 1.5 }}>
            아이샤에게 자세히 물어볼까요?
          </Button>
        </Box>

        {/* 콘텐츠: 사주 원국 + 개요 */}
        <Box sx={{ px: 2.5, pb: 3 }}>
          <SectionTitle>나의 사주 원국</SectionTitle>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <SajuTable pillars={mockPillars} />
          </Box>
          <OhaengMini />

          <SectionTitle>한눈에 보기</SectionTitle>
          <Box className="glass" sx={{ borderRadius: '18px', p: 2 }}>
            <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: tokens.color.primary, mb: 0.8 }}>{homeSummary.title}</Typography>
            {homeSummary.lines.map((l, i) => (
              <Typography key={i} sx={{ fontSize: 13.5, color: tokens.color.inkSub, lineHeight: 1.55, mb: 0.3 }}>· {l}</Typography>
            ))}
          </Box>

          {/* 프로모 */}
          <Box className="glass" sx={{ mt: 1.5, borderRadius: '18px', p: 1.8, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ fontSize: 28 }}>🎁</Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: tokens.color.solar }}>NEW</Typography>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: tokens.color.ink }}>첫 사주 리포트, 지금 무료로 받아보세요 ›</Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <BillyNav active="home" onTab={(k) => (k === 'analysis' || k === 'today') && nav('/loading')} />
    </Screen>
  )
}
