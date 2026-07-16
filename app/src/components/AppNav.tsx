import { Box, Typography } from '@mui/material'
import { tokens } from '../theme'

type Tab = { key: string; label: string; icon: string; dot?: boolean }

const tabs: Tab[] = [
  { key: 'home', label: '홈', icon: '⌂' }, // 1) 인트로
  { key: 'analysis', label: '분석', icon: '☯' }, // 2) 주요 메뉴 — 사주 분석
  { key: 'premium', label: '프리미엄', icon: '♛' }, // 3) 미정(placeholder)
  { key: 'settings', label: '설정', icon: '⚙', dot: true }, // 4) 설정
]

/** 앱 셸 하단 네비: 홈(인트로) / 분석(주요 메뉴) / 프리미엄(미정) / 설정 */
export default function AppNav({ active = 'home', onTab }: { active?: string; onTab?: (k: string) => void }) {
  return (
    <Box
      sx={{
        display: 'flex',
        borderTop: `1px solid ${tokens.color.border}`,
        bgcolor: '#fff',
        pt: 1,
        pb: 1.5,
      }}
    >
      {tabs.map((t) => {
        const on = t.key === active
        return (
          <Box
            key={t.key}
            onClick={() => onTab?.(t.key)}
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.4,
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <Box sx={{ position: 'relative', fontSize: 22, lineHeight: 1, color: on ? tokens.color.ink : tokens.color.inkFaint }}>
              {t.icon}
              {t.dot && (
                <Box sx={{ position: 'absolute', top: -1, right: -5, width: 6, height: 6, borderRadius: '50%', bgcolor: tokens.color.solar }} />
              )}
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: on ? 800 : 600, color: on ? tokens.color.ink : tokens.color.inkFaint }}>
              {t.label}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}
