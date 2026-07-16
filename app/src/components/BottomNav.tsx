import { Box, Typography } from '@mui/material'
import { tokens } from '../theme'

type Item = { label: string; icon: string; badge?: string; onClick?: () => void; active?: boolean }

/** 홈 하단 탭: 딜러 소개 / 타로 보기 / 사주 보기(신규) / 구매 내역 */
export default function BottomNav({ onSaju }: { onSaju?: () => void }) {
  const items: Item[] = [
    { label: '딜러 소개', icon: '🧑‍🎤' },
    { label: '타로 보기', icon: '🃏' },
    { label: '사주 보기', icon: '☯️', badge: '신규 출시', active: true, onClick: onSaju },
    { label: '구매 내역', icon: '🧾' },
  ]
  return (
    <Box
      sx={{
        mx: 1.5,
        mb: 1.5,
        px: 1,
        py: 1.1,
        borderRadius: 4,
        bgcolor: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(14px)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.16)',
        display: 'flex',
      }}
    >
      {items.map((it) => (
        <Box
          key={it.label}
          onClick={it.onClick}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
            position: 'relative',
            cursor: it.onClick ? 'pointer' : 'default',
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              bgcolor: it.active ? tokens.color.primary : tokens.color.primarySoft,
              boxShadow: it.active ? '0 6px 16px rgba(62,59,224,0.4)' : 'none',
            }}
          >
            {it.icon}
          </Box>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: it.active ? tokens.color.primary : tokens.color.inkSub }}>
            {it.label}
          </Typography>
          {it.badge && (
            <Box
              sx={{
                position: 'absolute',
                top: -8,
                left: '50%',
                transform: 'translateX(-30%)',
                px: 0.8,
                py: '2px',
                borderRadius: 100,
                bgcolor: tokens.color.solar,
                color: '#fff',
                fontSize: 8.5,
                fontWeight: 800,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(232,94,94,0.5)',
              }}
            >
              {it.badge}
            </Box>
          )}
        </Box>
      ))}
    </Box>
  )
}
