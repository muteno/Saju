import { Box, Typography } from '@mui/material'
import { tokens } from '../theme'
import type { Pillar } from '../data/saju'
import OhaengTile from './OhaengTile'

/** 시간 모름 자리 표시 타일 — 값을 날조하지 않고 '모름'을 그대로 보여준다 */
function UnknownTile({ size = 46 }: { size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 1.5,
        bgcolor: 'var(--c-card)',
        border: `1.5px dashed ${tokens.color.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: tokens.color.inkFaint,
        fontSize: size * 0.4,
        fontWeight: 800,
      }}
    >
      ?
    </Box>
  )
}

/**
 * 사주 원국표 카드 — 열=시/일/월/년, 행=십성·천간·지지·십성. unknownHour=시주 미상(값 미표시).
 * compact=지장간·운성·신살 행 생략(목업 v2 '내 원국' 화면 — 전체 7행은 리포트에서).
 */
export default function SajuTable({ pillars, unknownHour = false, compact = false }: { pillars: Pillar[]; unknownHour?: boolean; compact?: boolean }) {
  const star = (t: string) => (
    <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.color.inkSub, textAlign: 'center', letterSpacing: 'var(--tracking)' }}>
      {t}
    </Typography>
  )
  // 행 라벨 열 — 전체 7행 모드에서만. 없으면 지장간·12운성·12신살이 라벨 없는 값 더미로 보인다
  // (레퍼런스 실측: 포스텔러 만세력도 행 라벨을 표 왼쪽에 고정한다).
  // 높이는 각 행의 셀과 같은 리듬을 쓰되, 타일 행만 타일 높이(46)에 맞춰 중앙 정렬.
  const rowLabel = (t: string, h: number) => (
    <Box sx={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: tokens.color.inkFaint, letterSpacing: 'var(--tracking)', whiteSpace: 'nowrap' }}>{t}</Typography>
    </Box>
  )
  return (
    <Box
      className="glass"
      sx={{
        borderRadius: '18px',
        p: 1.5,
        display: 'inline-block',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1 }}>
        {!compact && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7, pr: 0.2 }}>
            {rowLabel('', 15)}
            {rowLabel('십성', 17)}
            {rowLabel('천간', 46)}
            {rowLabel('지지', 46)}
            {rowLabel('십성', 17)}
            {rowLabel('지장간', 17)}
            {rowLabel('12운성', 16)}
            {rowLabel('12신살', 16)}
          </Box>
        )}
        {pillars.map((p, i) =>
          unknownHour && p.title === '시' ? (
            <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.7 }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: tokens.color.inkFaint }}>시</Typography>
              {star('모름')}
              <UnknownTile size={compact ? 56 : 46} />
              <UnknownTile size={compact ? 56 : 46} />
              {star('─')}
              {!compact && star('─')}
              {!compact && <Typography sx={{ fontSize: 10.5, color: tokens.color.inkFaint, textAlign: 'center', fontWeight: 500 }}>─</Typography>}
              {!compact && <Typography sx={{ fontSize: 10.5, color: tokens.color.inkFaint, textAlign: 'center', fontWeight: 500 }}>─</Typography>}
            </Box>
          ) : (
            <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.7 }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: p.isDayMaster ? tokens.color.primary : tokens.color.inkFaint }}>
                {p.title}
              </Typography>
              {star(p.topStar)}
              <OhaengTile main={p.ganK} hanja={p.gan} polarity={p.ganPolarity} element={p.ganE} highlight={p.isDayMaster} size={compact ? 56 : undefined} />
              <OhaengTile main={p.jiK} hanja={p.ji} polarity={p.jiPolarity} element={p.jiE} size={compact ? 56 : undefined} />
              {star(p.botStar)}
              {!compact && star(p.hidden.join(''))}
              {!compact && <Typography sx={{ fontSize: 10.5, color: tokens.color.inkFaint, textAlign: 'center', fontWeight: 500 }}>{p.stage}</Typography>}
              {!compact && <Typography sx={{ fontSize: 10.5, color: tokens.color.inkFaint, textAlign: 'center', fontWeight: 500 }}>{p.sinsal}</Typography>}
            </Box>
          ),
        )}
      </Box>
    </Box>
  )
}
