import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { tokens } from '../theme'
import { Pict } from './MyeongShell'
import { HOST_NAME } from '../data/chefs'

/** 미연시 스타일 대화 박스 — 화자 이름표 + 본문 + 다음(아래꺾쇠) 인디케이터 */
export default function DialogueBox({
  speaker = HOST_NAME,
  children,
  next = true,
}: {
  speaker?: string
  children: ReactNode
  next?: boolean
}) {
  return (
    <Box sx={{ px: 1.75, pb: 2 }}>
      <Box sx={{ position: 'relative', ml: 0.5, mb: -1.1, zIndex: 2 }}>
        <Box
          sx={{
            display: 'inline-block',
            px: 1.6,
            py: 0.5,
            borderRadius: 100,
            bgcolor: tokens.color.primary,
            color: tokens.color.onPrimary,
            fontWeight: 800,
            fontSize: 13.5,
            letterSpacing: 'var(--tracking)',
            boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.35)',
          }}
        >
          {speaker}
        </Box>
      </Box>
      <Box
        className="glass"
        sx={{
          position: 'relative',
          borderRadius: '22px',
          p: 2,
          pt: 2.2,
          minHeight: 104,
        }}
      >
        <Typography component="div" sx={{ color: tokens.color.ink, fontSize: 15, lineHeight: 1.62 }}>
          {children}
        </Typography>
        {next && (
          <Box
            sx={{
              position: 'absolute',
              right: 12,
              bottom: 8,
              display: 'flex',
              color: tokens.color.primary,
              animation: 'bob 1.1s ease-in-out infinite',
              '@keyframes bob': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(3px)' } },
            }}
          >
            {Pict.chevronDown(16)}
          </Box>
        )}
      </Box>
    </Box>
  )
}
