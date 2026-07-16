import { Box, Typography } from '@mui/material'
import { tokens } from '../theme'
import type { Pillar } from '../data/saju'
import OhaengTile from './OhaengTile'

/** 사주 원국표 카드 — 열=시/일/월/년, 행=십성·천간·지지·십성 */
export default function SajuTable({ pillars }: { pillars: Pillar[] }) {
  const star = (t: string) => (
    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.color.inkSub, textAlign: 'center', letterSpacing: '-0.02em' }}>
      {t}
    </Typography>
  )
  return (
    <Box
      sx={{
        bgcolor: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        borderRadius: '18px',
        p: 1.5,
        boxShadow: tokens.shadow.float,
        display: 'inline-block',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1 }}>
        {pillars.map((p, i) => (
          <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.7 }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: p.isDayMaster ? tokens.color.primary : tokens.color.inkFaint }}>
              {p.title}
            </Typography>
            {star(p.topStar)}
            <OhaengTile main={p.ganK} hanja={p.gan} polarity={p.ganPolarity} element={p.ganE} highlight={p.isDayMaster} />
            <OhaengTile main={p.jiK} hanja={p.ji} polarity={p.jiPolarity} element={p.jiE} />
            {star(p.botStar)}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
