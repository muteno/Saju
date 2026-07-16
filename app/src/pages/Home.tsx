import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import Screen from '../components/Screen'
import StatusBar from '../components/StatusBar'
import AppNav from '../components/AppNav'
import { tokens } from '../theme'
import { mockProfile } from '../data/saju'

function TopIcon({ children, dot }: { children: ReactNode; dot?: boolean }) {
  return (
    <Box sx={{ position: 'relative', fontSize: 21, color: '#20303A', lineHeight: 1 }}>
      {children}
      {dot && <Box sx={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: '50%', bgcolor: tokens.color.solar }} />}
    </Box>
  )
}

/** 띠 아바타(병인 → 붉은 호랑이) 플레이스홀더 — 초록 언덕 위 쿠션에 앉은 호랑이 */
function ZodiacScene() {
  return (
    <Box sx={{ position: 'relative', height: 190, mt: 1 }}>
      {/* 언덕 */}
      <Box sx={{ position: 'absolute', bottom: 0, left: -20, right: -20, height: 120 }}>
        <Box sx={{ position: 'absolute', bottom: 0, left: '2%', width: 150, height: 110, borderRadius: '50%', bgcolor: '#B7DBA6' }} />
        <Box sx={{ position: 'absolute', bottom: 0, right: '0%', width: 190, height: 130, borderRadius: '50%', bgcolor: '#A6D191' }} />
        <Box sx={{ position: 'absolute', bottom: -30, left: '28%', width: 220, height: 120, borderRadius: '50%', bgcolor: '#C7E4B6' }} />
      </Box>
      {/* 쿠션 + 호랑이 */}
      <Box sx={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-30%)' }}>
        <Box sx={{ width: 128, height: 40, borderRadius: '50%', bgcolor: '#F2A7B0', position: 'absolute', bottom: -6, left: -8 }} />
        <Box sx={{ fontSize: 96, lineHeight: 1, position: 'relative', filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.12))' }}>🐯</Box>
      </Box>
      {/* 반짝임 */}
      <Box sx={{ position: 'absolute', top: 20, left: '46%', fontSize: 16 }}>🎀</Box>
    </Box>
  )
}

export default function Home() {
  const nav = useNavigate()
  return (
    <Screen bg={tokens.color.page}>
      <Box sx={{ background: `linear-gradient(180deg, ${tokens.color.skyTop} 0%, #B6E0E9 60%, #D8ECE0 100%)`, position: 'relative' }}>
        <StatusBar time="9:41" />
        {/* 앱 상단바 */}
        <Box sx={{ px: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 0.5 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#20303A' }}>7/3 금</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TopIcon>🔍</TopIcon>
            <TopIcon dot>🪙</TopIcon>
            <TopIcon>🎉</TopIcon>
            <TopIcon>🗓️</TopIcon>
          </Box>
        </Box>

        {/* 개인화 인트로 */}
        <Box sx={{ px: 2.5, pt: 2, position: 'relative' }}>
          <Typography sx={{ fontSize: 21, fontWeight: 500, color: '#22323C', letterSpacing: '-0.03em' }}>
            {mockProfile.name}님,
          </Typography>
          <Typography sx={{ fontSize: 27, fontWeight: 800, color: '#16242C', letterSpacing: '-0.03em', lineHeight: 1.28, mt: 0.3 }}>
            당신이 돋보이는
            <br />
            최고의 날이에요.
          </Typography>
          <Typography
            onClick={() => nav('/loading')}
            sx={{ fontSize: 14, color: '#4E5C64', mt: 1.5, fontWeight: 600, cursor: 'pointer', display: 'inline-block' }}
          >
            자세히 보기 →
          </Typography>

          {/* 액막이 추가 카드 */}
          <Box
            sx={{
              position: 'absolute',
              right: 20,
              top: 84,
              width: 96,
              height: 74,
              borderRadius: '14px',
              border: '1.6px dashed #7FA9B6',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              color: '#3E6B7A',
            }}
          >
            <Box sx={{ fontSize: 24 }}>🐟</Box>
            <Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>액막이 추가</Typography>
          </Box>
        </Box>

        <ZodiacScene />
      </Box>

      {/* 스크롤 콘텐츠 */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pt: 2, position: 'relative' }}>
        {/* 프로모 카드 */}
        <Box sx={{ bgcolor: '#1C1D22', borderRadius: '20px', p: 2.2, color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <Typography sx={{ fontSize: 13, color: '#B9B9C0', fontWeight: 600 }}>사라지기 전에 확인하세요!</Typography>
          <Typography sx={{ fontSize: 19, fontWeight: 800, mt: 0.5, letterSpacing: '-0.02em' }}>🐣 신규 유저 전용 초특급PACK</Typography>
          <Box sx={{ mt: 1.5, display: 'inline-flex', alignItems: 'center', gap: 1, bgcolor: '#F4D935', color: '#1C1D22', px: 1.6, py: 0.7, borderRadius: 100, fontWeight: 800, fontSize: 13 }}>
            WELCOME · 지금 ONLY
          </Box>
        </Box>

        {/* 감정 기록 배너 */}
        <Box sx={{ mt: 1.5, mb: 2, bgcolor: '#26272E', borderRadius: 100, px: 2, py: 1.4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>지금 느끼는 감정은? 7월 한 달 기록하기 ›</Typography>
          <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#FBE3C7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#C06A2E' }}>82점</span>
            <span style={{ fontSize: 12 }}>☺️</span>
          </Box>
        </Box>
      </Box>

      <AppNav active="home" onTab={(k) => k === 'analysis' && nav('/loading')} />
    </Screen>
  )
}
