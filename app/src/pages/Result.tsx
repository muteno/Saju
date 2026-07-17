import { Box, Typography } from '@mui/material'
import { useLocation } from 'react-router-dom'
import Screen from '../components/Screen'
import StatusBar from '../components/StatusBar'
import CharacterStage from '../components/CharacterStage'
import TopControls from '../components/TopControls'
import SajuTable from '../components/SajuTable'
import DialogueBox from '../components/DialogueBox'
import GapjaSticker from '../components/GapjaSticker'
import { tokens } from '../theme'
import { mockPillars, mockOhaeng, groundedReading, toReading } from '../data/saju'
import type { ChartInput } from '../engine'

const verdictColor = { 부족: '#B8B2AC', 적정: '#5AA06E', 발달: tokens.color.primary, 과다: tokens.color.solar }

function OhaengStrip({ ohaeng }: { ohaeng: typeof mockOhaeng }) {
  return (
    <Box className="glass" sx={{ mx: 2, mb: 1, px: 1.5, py: 1, borderRadius: '16px', display: 'flex', gap: 0.75 }}>
      {ohaeng.map((o) => (
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
  // InfoInput에서 계산한 차트를 전달받고, 없으면 샘플로 폴백
  const loc = useLocation()
  const state = loc.state as { chart?: { pillars: typeof mockPillars; ohaeng: typeof mockOhaeng }; input?: ChartInput } | null
  const pillars = state?.chart?.pillars ?? mockPillars
  const ohaeng = state?.chart?.ohaeng ?? mockOhaeng
  const reading = state?.input ? toReading(state.input) : groundedReading
  // 일주 = 일간+일지 (그 사람의 60갑자). 지신 스티커로 표시.
  const ilju = pillars.find((p) => p.isDayMaster)
  const iljuGanji = ilju ? ilju.ganK + ilju.jiK : undefined

  return (
    <Screen>
      <CharacterStage tint="linear-gradient(180deg,#bfe0b8,#e8dfa0)" />
      <StatusBar dark time="9:04" />
      <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <TopControls />
        <Box sx={{ flex: 1 }} />

        {/* 사주 원국표 (좌측 정렬) */}
        <Box sx={{ pl: 2, pr: 2, mb: 1.5 }}>
          <SajuTable pillars={pillars} />
        </Box>

        <OhaengStrip ohaeng={ohaeng} />

        {/* 아이샤의 사주 풀이 */}
        <DialogueBox speaker="아이샤">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {iljuGanji && <GapjaSticker ganji={iljuGanji} size={44} showLabel={false} />}
            <Box sx={{ lineHeight: 1.2 }}>
              <Typography component="span" sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.color.inkSub, letterSpacing: 'var(--tracking)' }}>
                일주 {iljuGanji ?? ''}
              </Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.color.primary, letterSpacing: 'var(--tracking)' }}>
                {reading.headline}
              </Typography>
            </Box>
          </Box>
          {reading.sections.map((s) => (
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
              {s.source && (
                <Typography sx={{ fontSize: 10.5, color: tokens.color.inkFaint, mt: 0.3 }}>— 출처: {s.source}</Typography>
              )}
            </Box>
          ))}
        </DialogueBox>
      </Box>
    </Screen>
  )
}
