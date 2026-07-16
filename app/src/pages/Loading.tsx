import { useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import Screen from '../components/Screen'
import StatusBar from '../components/StatusBar'
import OhaengTile from '../components/OhaengTile'
import { tokens } from '../theme'

const tiles = [
  { main: '경', hanja: '庚', polarity: '+' as const, element: '금' as const },
  { main: '병', hanja: '丙', polarity: '+' as const, element: '화' as const },
  { main: '계', hanja: '癸', polarity: '-' as const, element: '수' as const },
  { main: '무', hanja: '戊', polarity: '+' as const, element: '토' as const },
]

export default function Loading() {
  const nav = useNavigate()
  useEffect(() => {
    // 스크린샷용: ?hold 파라미터가 있으면 자동 이동을 멈춘다
    if (new URLSearchParams(window.location.search).has('hold')) return
    const t = setTimeout(() => nav('/result'), 2400)
    return () => clearTimeout(t)
  }, [nav])

  return (
    <Screen bg={tokens.color.card}>
      <StatusBar time="9:00" />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 4, pb: 8 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, auto)',
            gap: 1.2,
            mb: 4,
            '@keyframes floaty': {
              '0%,100%': { transform: 'translateY(0) rotate(0deg)' },
              '50%': { transform: 'translateY(-7px) rotate(-2deg)' },
            },
          }}
        >
          {tiles.map((t, i) => (
            <Box key={i} sx={{ animation: `floaty 1.6s ease-in-out ${i * 0.18}s infinite` }}>
              <OhaengTile {...t} size={54} />
            </Box>
          ))}
        </Box>

        <Typography sx={{ fontSize: 20, fontWeight: 800, color: tokens.color.heading, textAlign: 'center', lineHeight: 1.45, letterSpacing: '-0.03em' }}>
          아이샤가 만세력을
          <br />
          정리 중이에요.
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: tokens.color.inkFaint, mt: 1.5, textAlign: 'center' }}>
          띠는 입춘(약 2월 3~4일)을 기준으로 바뀝니다.
        </Typography>
      </Box>
    </Screen>
  )
}
