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
 *
 * fluid=**바깥 카드 없이 부모 폭을 다 쓰는 모드**(260726 운영자: "창을 넓게 지금 다른 창처럼
 * 최대한 다 쓰게" + "목화토금수랑 얘랑 같은 창으로 합쳐도 될듯"). 형제 카드가 좌우 20px 여백을
 * 쓰는데 이 표만 55px였다(390 화면 실측 279.59 vs 350) — 열을 flex로 펴서 폭을 맞춘다.
 * 타일 크기 56은 compact 모드가 이미 쓰던 값 계승(새 값 창작 아님).
 */
export default function SajuTable({
  pillars,
  unknownHour = false,
  compact = false,
  fluid = false,
}: {
  pillars: Pillar[]
  unknownHour?: boolean
  compact?: boolean
  /** 카드 껍데기를 벗고 부모 폭을 채운다 — 상위 카드에 다른 부품과 함께 담을 때 */
  fluid?: boolean
}) {
  const tile = compact || fluid ? 56 : undefined
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
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.color.inkFaint, letterSpacing: 'var(--tracking)', whiteSpace: 'nowrap' }}>{t}</Typography>
    </Box>
  )
  // 열 = 고정 나열(inline) → fluid에선 flex:1로 펴서 남는 폭을 열들이 균등히 나눠 갖는다
  const colSx = fluid
    ? ({ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.7 } as const)
    : ({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.7 } as const)
  const body = (
    <Box sx={{ display: 'flex', gap: 1, ...(fluid ? { width: '100%' } : null) }}>
      {!compact && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.7, pr: 0.2, flex: '0 0 auto' }}>
          {rowLabel('', 15)}
          {rowLabel('십성', 17)}
          {rowLabel('천간', tile ?? 46)}
          {rowLabel('지지', tile ?? 46)}
          {rowLabel('십성', 17)}
          {rowLabel('지장간', 17)}
          {rowLabel('12운성', 16)}
          {rowLabel('12신살', 16)}
        </Box>
      )}
      {pillars.map((p, i) =>
        unknownHour && p.title === '시' ? (
          <Box key={i} sx={colSx}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: tokens.color.inkFaint }}>시</Typography>
            {star('모름')}
            <UnknownTile size={tile ?? 46} />
            <UnknownTile size={tile ?? 46} />
            {star('─')}
            {!compact && star('─')}
            {!compact && <Typography sx={{ fontSize: 11, color: tokens.color.inkFaint, textAlign: 'center', fontWeight: 500 }}>─</Typography>}
            {!compact && <Typography sx={{ fontSize: 11, color: tokens.color.inkFaint, textAlign: 'center', fontWeight: 500 }}>─</Typography>}
          </Box>
        ) : (
          <Box key={i} sx={colSx}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: p.isDayMaster ? tokens.color.primary : tokens.color.inkFaint }}>
              {p.title}
            </Typography>
            {star(p.topStar)}
            <OhaengTile main={p.ganK} hanja={p.gan} polarity={p.ganPolarity} element={p.ganE} highlight={p.isDayMaster} size={tile} />
            <OhaengTile main={p.jiK} hanja={p.ji} polarity={p.jiPolarity} element={p.jiE} size={tile} />
            {star(p.botStar)}
            {!compact && star(p.hidden.join(''))}
            {!compact && <Typography sx={{ fontSize: 11, color: tokens.color.inkFaint, textAlign: 'center', fontWeight: 500 }}>{p.stage}</Typography>}
            {!compact && <Typography sx={{ fontSize: 11, color: tokens.color.inkFaint, textAlign: 'center', fontWeight: 500 }}>{p.sinsal}</Typography>}
          </Box>
        ),
      )}
    </Box>
  )
  if (fluid) return body
  return (
    <Box
      className="glass"
      sx={{
        borderRadius: '14px',
        p: 1.5,
        display: 'inline-block',
      }}
    >
      {body}
    </Box>
  )
}
