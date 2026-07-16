import { Box, Typography } from '@mui/material'
import { tokens } from '../theme'

type Item = { key: string; label: string; icon: string; dot?: boolean }

// 좌2 · 중앙(홈) · 우2 — Baby Billy식
const left: Item[] = [
  { key: 'today', label: '오늘', icon: '📅' },
  { key: 'analysis', label: '분석', icon: '☯' },
]
const right: Item[] = [
  { key: 'content', label: '콘텐츠', icon: '📖' },
  { key: 'my', label: '마이', icon: '👤', dot: true },
]

function Tab({ it, active, onTab }: { it: Item; active: boolean; onTab?: (k: string) => void }) {
  return (
    <Box
      onClick={() => onTab?.(it.key)}
      sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.4, cursor: 'pointer' }}
    >
      <Box sx={{ position: 'relative', fontSize: 20, lineHeight: 1, color: active ? tokens.color.primary : tokens.color.inkFaint }}>
        {it.icon}
        {it.dot && <Box sx={{ position: 'absolute', top: -1, right: -5, width: 6, height: 6, borderRadius: '50%', bgcolor: tokens.color.solar }} />}
      </Box>
      <Typography sx={{ fontSize: 11, fontWeight: active ? 800 : 500, color: active ? tokens.color.primary : tokens.color.inkFaint }}>
        {it.label}
      </Typography>
    </Box>
  )
}

/** 홈=중앙 플로팅 버튼(인트로), 좌:오늘/분석 · 우:콘텐츠/마이(설정) */
export default function BillyNav({ active = 'home', onTab }: { active?: string; onTab?: (k: string) => void }) {
  return (
    <Box sx={{ position: 'relative', bgcolor: tokens.color.card, borderTop: `1px solid ${tokens.color.border}`, pt: 1, pb: 1.4, display: 'flex', alignItems: 'flex-end' }}>
      {left.map((it) => (
        <Tab key={it.key} it={it} active={active === it.key} onTab={onTab} />
      ))}

      {/* 중앙 홈 플로팅 */}
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <Box
          onClick={() => onTab?.('home')}
          sx={{
            width: 56, height: 56, borderRadius: '50%', mt: -3.5, cursor: 'pointer',
            bgcolor: tokens.color.primary, color: tokens.color.onPrimary,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            boxShadow: `0 8px 20px color-mix(in srgb, ${tokens.color.primary} 55%, transparent)`,
            border: `4px solid ${tokens.color.card}`,
          }}
        >
          ⌂
        </Box>
      </Box>

      {right.map((it) => (
        <Tab key={it.key} it={it} active={active === it.key} onTab={onTab} />
      ))}
    </Box>
  )
}
