import { Box } from '@mui/material'
import { tokens } from '../theme'

const items = [
  { label: '넘기기', icon: '▶▶' },
  { label: '자동 대화', icon: '▶' },
  { label: '지난 대화', icon: '↻' },
]

/** VN 스타일 상단 컨트롤 칩 (넘기기 / 자동 대화 / 지난 대화) */
export default function TopControls() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, px: 2, pt: 0.5 }}>
      {items.map((it) => (
        <Box
          key={it.label}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.6,
            px: 1.4,
            py: 0.7,
            borderRadius: 100,
            bgcolor: tokens.color.elev,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
            fontSize: 12.5,
            fontWeight: 700,
            color: tokens.color.ink,
            letterSpacing: 'var(--tracking)',
            whiteSpace: 'nowrap',
          }}
        >
          {it.label}
          <span style={{ fontSize: 10, opacity: 0.7 }}>{it.icon}</span>
        </Box>
      ))}
    </Box>
  )
}
