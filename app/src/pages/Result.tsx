import { Box, Typography } from '@mui/material'
import Screen from '../components/Screen'
import StatusBar from '../components/StatusBar'
import CharacterStage from '../components/CharacterStage'
import TopControls from '../components/TopControls'
import SajuTable from '../components/SajuTable'
import DialogueBox from '../components/DialogueBox'
import { tokens } from '../theme'
import { mockPillars, mockOhaeng, mockReading } from '../data/saju'

const verdictColor = { 부족: '#B8B2AC', 적정: '#5AA06E', 발달: tokens.color.primary, 과다: tokens.color.solar }

function OhaengStrip() {
  return (
    <Box
      sx={{
        mx: 2,
        mb: 1,
        px: 1.5,
        py: 1,
        borderRadius: '16px',
        bgcolor: tokens.color.elev,
        backdropFilter: 'blur(8px)',
        boxShadow: tokens.shadow.card,
        display: 'flex',
        gap: 0.75,
      }}
    >
      {mockOhaeng.map((o) => (
        <Box key={o.key} sx={{ flex: 1, textAlign: 'center' }}>
          <Box sx={{ height: 5, borderRadius: 3, bgcolor: tokens.ohaeng[o.key].bg, mb: 0.6 }} />
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: tokens.ohaeng[o.key].label, lineHeight: 1 }}>{o.key}</Typography>
          <Typography sx={{ fontSize: 9.5, color: verdictColor[o.verdict], fontWeight: 700 }}>{o.verdict}</Typography>
        </Box>
      ))}
    </Box>
  )
}

export default function Result() {
  return (
    <Screen>
      <CharacterStage tint="linear-gradient(180deg,#bfe0b8,#e8dfa0)" />
      <StatusBar dark time="9:04" />
      <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <TopControls />
        <Box sx={{ flex: 1 }} />

        {/* 사주 원국표 (좌측 정렬) */}
        <Box sx={{ pl: 2, pr: 2, mb: 1.5 }}>
          <SajuTable pillars={mockPillars} />
        </Box>

        <OhaengStrip />

        {/* 아이샤의 사주 풀이 */}
        <DialogueBox speaker="아이샤">
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.7, mb: 1 }}>
            <span style={{ fontSize: 14 }}>🔍</span>
            <span style={{ fontWeight: 700 }}>한 줄 요약:</span>
            <span style={{ fontWeight: 800, color: tokens.color.primary }}>{mockReading.headline}</span>
          </Box>
          {mockReading.sections.map((s) => (
            <Box key={s.label} sx={{ mb: 0.9 }}>
              <Typography component="div" sx={{ fontSize: 13.5, color: tokens.color.ink, lineHeight: 1.5 }}>
                <b>
                  {s.icon} {s.label}:
                </b>{' '}
                {s.lines.map((l, i) => (
                  <span key={i}>
                    {s.lines.length > 1 ? `${i + 1}) ` : ''}
                    {l}
                    {i < s.lines.length - 1 ? ' ' : ''}
                  </span>
                ))}
              </Typography>
            </Box>
          ))}
        </DialogueBox>
      </Box>
    </Screen>
  )
}
