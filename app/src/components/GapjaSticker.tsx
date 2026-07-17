import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { tokens } from '../theme'
import { gapjaByGanji, gapjaOf, imgUrl, type Gapja } from '../data/gapja'

/**
 * 60갑자 지신 캐릭터 스티커.
 * 이미지(`/assets/gapja/{animal}-{element}.png`)가 있으면 표시, 없으면 오행색 폴백
 * (정본 팔레트 tokens.ohaeng + 이모지). 4분할 중앙 정렬·동일 마진([13]).
 */
export default function GapjaSticker({
  ganji,
  stem,
  branch,
  size = 96,
  showLabel = true,
}: {
  ganji?: string
  stem?: string
  branch?: string
  size?: number
  showLabel?: boolean
}) {
  const g: Gapja | undefined = ganji ? gapjaByGanji(ganji) : stem && branch ? gapjaOf(stem, branch) : undefined
  const [broken, setBroken] = useState(false)
  if (!g) return null
  const c = tokens.ohaeng[g.element] // 정본 오행 색

  return (
    <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 0.6 }}>
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: c.bg,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {!broken ? (
          <Box
            component="img"
            src={imgUrl(g)}
            alt={`${g.ganji} ${g.animal}`}
            onError={() => setBroken(true)}
            sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <span role="img" aria-label={g.animal} style={{ fontSize: size * 0.5, lineHeight: 1 }}>
            {g.emoji}
          </span>
        )}
      </Box>
      {showLabel && (
        <Box sx={{ textAlign: 'center', lineHeight: 1.15 }}>
          <Typography sx={{ fontSize: Math.max(11, size * 0.16), fontWeight: 800, color: c.label, letterSpacing: 'var(--tracking)' }}>
            {g.ganji}
          </Typography>
          <Typography sx={{ fontSize: Math.max(9, size * 0.12), fontWeight: 600, color: tokens.color.inkFaint, letterSpacing: 'var(--tracking)' }}>
            {g.hanja} · {g.animal}
          </Typography>
        </Box>
      )}
    </Box>
  )
}
