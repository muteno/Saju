import { useEffect, useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import Screen from '../components/Screen'
import StatusBar from '../components/StatusBar'
import { tokens, type OhaengKey } from '../theme'
import { computeChartUI } from '../engine'
import { parseShare } from '../data/profiles'
import type { Pillar } from '../data/saju'

interface Tile {
  ch: string | null // null = ✦ 필러
  el: OhaengKey
}

// 입장 연출 폴백(원국 없음) — 목업 v2의 4자(庚丙亥戌). 필러 색도 정본 오행 팔레트만 사용.
const fallbackTiles: Tile[] = [
  { ch: '庚', el: '금' },
  { ch: null, el: '토' },
  { ch: null, el: '화' },
  { ch: '丙', el: '화' },
  { ch: null, el: '수' },
  { ch: '亥', el: '수' },
  { ch: '戌', el: '토' },
  { ch: null, el: '금' },
]

/** 원국 8자 → 2×4 타일(실자 4 + 오행 틴트 ✦ 4 — 목업 v2 배치, 연출도 실데이터) */
function tilesFromPillars(p: Pillar[]): Tile[] {
  if (p.length < 4) return fallbackTiles
  return [
    { ch: p[0].gan, el: p[0].ganE },
    { ch: null, el: p[2].ganE },
    { ch: null, el: p[3].ganE },
    { ch: p[1].gan, el: p[1].ganE },
    { ch: null, el: p[0].jiE },
    { ch: p[2].ji, el: p[2].jiE },
    { ch: p[3].ji, el: p[3].jiE },
    { ch: null, el: p[1].jiE },
  ]
}

/**
 * 로딩(범용) — 목업 v2: 2×4 한자 타일 floaty + 컨텍스트 문구.
 * flow=enter → 홈 입장 연출(1.5s) · 기본 = 만세력 계산 → 결과(1.2s 유지).
 */
export default function Loading() {
  const nav = useNavigate()
  const loc = useLocation()
  const flow = new URLSearchParams(loc.search).get('flow')

  useEffect(() => {
    if (new URLSearchParams(loc.search).has('hold')) return // 스크린샷용 정지
    const t = setTimeout(
      () => {
        if (flow === 'enter') nav('/', { replace: true })
        else nav(`/result${loc.search}`, { state: loc.state, replace: true })
      },
      flow === 'enter' ? 1500 : 1200,
    )
    return () => clearTimeout(t)
  }, [nav, loc.search, loc.state, flow])

  const tiles = useMemo(() => {
    let pillars = (loc.state as { chart?: { pillars: Pillar[] } } | null)?.chart?.pillars
    if (!pillars?.length && flow !== 'enter') {
      const shared = parseShare(loc.search)
      if (shared) {
        try {
          pillars = computeChartUI(shared.input).pillars
        } catch {
          /* 폴백 유지 */
        }
      }
    }
    return pillars?.length ? tilesFromPillars(pillars) : fallbackTiles
  }, [loc.state, loc.search, flow])

  return (
    <Screen>
      <StatusBar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pb: 8 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 64px)',
            gap: 1,
            '@keyframes floaty': {
              '0%,100%': { transform: 'translateY(0) rotate(0deg)' },
              '50%': { transform: 'translateY(-7px) rotate(-2deg)' },
            },
          }}
        >
          {tiles.map((t, i) => {
            const oh = tokens.ohaeng[t.el]
            return (
              <Box
                key={i}
                sx={{
                  animation: `floaty 1.6s ease-in-out ${(i * 0.18) % 1.6}s infinite`,
                  height: 64,
                  borderRadius: '16px',
                  bgcolor: oh.bg,
                  color: oh.ink,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: t.ch ? 30 : 16,
                  fontWeight: 800,
                }}
              >
                {t.ch ?? '✦'}
              </Box>
            )
          })}
        </Box>

        <Typography sx={{ mt: 7, fontSize: 22, fontWeight: 800, color: tokens.color.primary, textAlign: 'center', lineHeight: 1.45, letterSpacing: 'var(--tracking)' }}>
          연리가 만세력을
          <br />
          정리 중이에요.
        </Typography>
        <Typography sx={{ mt: 1.75, fontSize: 13, color: tokens.color.inkFaint, textAlign: 'center', fontWeight: 600 }}>
          띠는 입춘(약 2월 3~4일)을 기준으로 바뀐답니다.
        </Typography>
      </Box>
    </Screen>
  )
}
