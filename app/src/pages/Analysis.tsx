import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import { useNavigate, Navigate } from 'react-router-dom'
import StatusBar from '../components/StatusBar'
import MyeongShell from '../components/MyeongShell'
import { GlassButton, SectionTitle } from './Home'
import { tokens } from '../theme'
import { computeChartUI, jeonggokRaw, type UiChart } from '../engine'
import { toReading, type Reading } from '../data/saju'
import { activeProfile, profileToInput, profileToSearch } from '../data/profiles'
import { chefPlate } from '../data/chefs'

const PLATE = chefPlate()

function GlassChip({ label }: { label: string }) {
  return (
    <Box sx={{ px: 1.25, py: 0.5, borderRadius: '100px', background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.8)', backdropFilter: 'blur(11px)', WebkitBackdropFilter: 'blur(11px)', fontSize: 11.5, fontWeight: 700, color: tokens.color.inkSub }}>
      {label}
    </Box>
  )
}

/**
 * 사주분석 — 목업 v2 스테이지 + 카드. 전부 엔진·증류 실산출(총운 점수·월운 차트는
 * 엔진 미지원이라 비노출 — 고정 목업 금지 원칙, 지원 시 열림).
 */
export default function Analysis() {
  const nav = useNavigate()
  const profile = activeProfile()

  const data = useMemo(() => {
    if (!profile) return null
    try {
      const input = profileToInput(profile)
      const chart: UiChart = computeChartUI(input)
      const reading: Reading = toReading(input, { hourUnknown: profile.hourUnknown })
      let strength: string | null = null
      if (!profile.hourUnknown) {
        try {
          strength = jeonggokRaw(input).strength.label
        } catch {
          strength = null
        }
      }
      return { chart, reading, strength }
    } catch {
      return null
    }
  }, [profile])

  if (!profile || !data) return <Navigate to="/" replace />
  const { chart, reading, strength } = data
  const search = profileToSearch(profile)

  const day = chart.pillars.find((p) => p.title === '일')
  const ilju = day ? `${day.ganK}${day.jiK}` : ''
  const subline = [`일주 ${ilju}`, strength, profile.hourUnknown ? '시간 모름' : null].filter(Boolean).join(' · ')

  const traitSec = reading.dialogue.find((s) => s.label.includes('특성'))
  const sipsinTop = reading.cards.find((c) => c.id === 'sipsin')?.chips?.[0]
  const sinsalFirst = (() => {
    const c = reading.cards.find((x) => x.id === 'sinsal')
    return c?.blocks?.[0]?.label ?? c?.chips?.[0]
  })()
  const chips = [strength, sipsinTop, sinsalFirst].filter(Boolean) as string[]
  const unseCard = reading.cards.find((c) => c.id === 'unse')

  return (
    <MyeongShell active="analysis">
      <Box className="msd-fadein" sx={{ flex: 1, overflowY: 'auto' }}>
        {/* 스테이지 — 하늘 그라데이션 + 캐릭터 플레이트 + 하단 페이드 */}
        <Box sx={{ position: 'relative', minHeight: 380 }}>
          <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--c-sky-top) 0%, var(--c-sky-mid) 55%, var(--c-sky-bot) 100%)' }} />
          <Box sx={{ position: 'absolute', inset: 0, backgroundImage: `url('${PLATE}')`, backgroundSize: 'cover', backgroundPosition: 'top center' }} />
          <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', background: 'linear-gradient(180deg, rgba(238,240,246,0) 0%, var(--c-page) 96%)' }} />
          <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 380 }}>
            <StatusBar dark />
            <Box sx={{ flex: 1 }} />
            <Box sx={{ px: 2.5, pb: 1.75, textAlign: 'center' }}>
              <Box sx={{ display: 'inline-block', px: 1.6, py: 0.5, borderRadius: '100px', bgcolor: tokens.color.primary, color: tokens.color.onPrimary, fontWeight: 800, fontSize: 13.5, boxShadow: '0 4px 12px rgba(34,64,158,.35)' }}>
                {profile.name}님의 사주분석
              </Box>
              <Typography sx={{ mt: 1.2, fontSize: 26, fontWeight: 800, color: tokens.color.ink }}>{reading.headline}</Typography>
              <Typography sx={{ mt: 0.5, fontSize: 13, fontWeight: 700, color: tokens.color.inkSub }}>{subline}</Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ px: 2.5, pb: '120px' }}>
          <SectionTitle>타고난 특성</SectionTitle>
          <Box className="glass" sx={{ borderRadius: '18px', p: 2 }}>
            {chips.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.2 }}>
                {chips.map((c) => (
                  <GlassChip key={c} label={c} />
                ))}
              </Box>
            )}
            {(traitSec?.lines ?? []).map((l, i) => (
              <Typography key={i} sx={{ fontSize: 13.5, color: tokens.color.inkSub, lineHeight: 1.6, mb: 0.7 }}>· {l}</Typography>
            ))}
            {traitSec?.source && (
              <Typography sx={{ fontSize: 10.5, color: tokens.color.inkFaint, mt: 1.5 }}>— 출처: {traitSec.source}</Typography>
            )}
          </Box>

          {unseCard && (
            <>
              <SectionTitle>올해의 흐름</SectionTitle>
              <Box className="glass" sx={{ borderRadius: '18px', p: 2 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: tokens.color.primary, mb: 0.8 }}>{reading.unseYear}년의 환경 변화</Typography>
                {(unseCard.blocks[0]?.lines ?? []).slice(0, 2).map((l, i) => (
                  <Typography key={i} sx={{ fontSize: 13.5, color: tokens.color.inkSub, lineHeight: 1.6, mb: 0.7 }}>{l}</Typography>
                ))}
                {unseCard.blocks[0]?.source && (
                  <Typography sx={{ fontSize: 10.5, color: tokens.color.inkFaint, mt: 1.5 }}>— 출처: {unseCard.blocks[0].source}</Typography>
                )}
              </Box>
            </>
          )}

          {/* 전체 리포트(7섹션·대운 레일·AI 상담) 진입 — 기존 결과 화면 보존 배선 */}
          <GlassButton onClick={() => nav(`/result?${search}`)} sx={{ mt: 1.75 }}>
            전체 상세 리포트 · AI 상담 보기
          </GlassButton>
        </Box>
      </Box>
    </MyeongShell>
  )
}
