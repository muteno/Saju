import { Box } from '@mui/material'
import { tokens } from '../theme'
import type { OhaengKey } from '../theme'

/** 오행 색 타일 — 한글 대자 + 한자 + 극성/오행 라벨 */
export default function OhaengTile({
  main,
  hanja,
  polarity,
  element,
  size = 46,
  highlight = false,
}: {
  main: string
  hanja: string
  polarity: '+' | '-'
  element: OhaengKey
  size?: number
  highlight?: boolean
}) {
  const o = tokens.ohaeng[element]
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 1.5,
        bgcolor: o.bg,
        color: o.ink,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        position: 'relative',
        border: highlight ? `2.4px solid ${tokens.color.ink}` : '2.4px solid transparent',
        boxShadow: 'inset 0 -6px 10px rgba(0,0,0,0.06)',
      }}
    >
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: '2px' }}>
        <span style={{ fontSize: size * 0.42, fontWeight: 800, letterSpacing: 'var(--tracking)' }}>{main}</span>
        <span style={{ fontSize: size * 0.24, fontWeight: 700, opacity: 0.65 }}>{hanja}</span>
      </Box>
      <span style={{ fontSize: size * 0.19, fontWeight: 700, color: o.label, marginTop: 2 }}>
        {polarity}
        {element}
      </span>
    </Box>
  )
}
