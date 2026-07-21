import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import { useNavigate, Navigate } from 'react-router-dom'
import StatusBar from '../components/StatusBar'
import MyeongShell from '../components/MyeongShell'
import SajuTable from '../components/SajuTable'
import { HomeSegment, GlassButton, SectionTitle } from './Home'
import { tokens } from '../theme'
import { computeChartUI, type UiChart } from '../engine'
import { todayInfo, myTodayFortune, ohaengWithoutHour, type OhaengStat } from '../data/saju'
import { activeProfile, profileToInput } from '../data/profiles'
import { gapjaByGanji } from '../data/gapja'

const OH_LABEL: Record<string, string> = {
  목: 'var(--oh-label-mok)', 화: 'var(--oh-label-hwa)', 토: 'var(--oh-label-to)', 금: 'var(--oh-label-geum)', 수: 'var(--oh-label-su)',
}

function OhaengMini({ ohaeng, total }: { ohaeng: OhaengStat[]; total: number }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.6, mt: 1.5 }}>
      {ohaeng.map((o) => (
        <Box key={o.key} sx={{ flex: 1, textAlign: 'center' }}>
          <Box sx={{ height: 5, borderRadius: 3, bgcolor: tokens.color.border, mb: 0.5, overflow: 'hidden' }}>
            <Box sx={{ width: `${Math.min(100, o.pct * 2)}%`, height: '100%', borderRadius: 3, bgcolor: tokens.ohaeng[o.key].bg }} />
          </Box>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: OH_LABEL[o.key], lineHeight: 1.1 }}>{o.key}</Typography>
          <Typography sx={{ fontSize: 10.5, color: tokens.color.inkSub, fontWeight: 700 }}>
            {Math.round((o.pct * total) / 100)}개
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

/** 메인 2 — 내 원국 + 오늘 해석(매일 반찬). 전부 엔진 실계산. */
export default function Myday() {
  const nav = useNavigate()
  const profile = activeProfile()
  const today = todayInfo()

  const data = useMemo(() => {
    if (!profile) return null
    try {
      const input = profileToInput(profile)
      const chart: UiChart = computeChartUI(input)
      const fortune = myTodayFortune(input)
      return { chart, fortune }
    } catch {
      return null
    }
  }, [profile])

  if (!profile || !data) return <Navigate to="/" replace />
  const { chart, fortune } = data
  const ohaeng = profile.hourUnknown ? ohaengWithoutHour(chart.pillars) : chart.ohaeng
  const timeLabel = profile.hourUnknown ? '시간 모름' : `${String(profile.hour).padStart(2, '0')}:${String(profile.minute).padStart(2, '0')}`
  const corrected = !profile.hourUnknown && chart.corrected
    ? ` · 진태양시 ${String(chart.corrected.hh).padStart(2, '0')}:${String(chart.corrected.mm).padStart(2, '0')} 보정`
    : ''
  const iljinGapja = gapjaByGanji(today.dayName)
  const tileOh = iljinGapja ? tokens.ohaeng[iljinGapja.element] : tokens.ohaeng.토
  const bullets = (fortune?.basis?.length ? fortune.basis : fortune ? [fortune.oneLine] : []).slice(0, 3)

  return (
    <MyeongShell active="myday">
      <Box className="msd-fadein" sx={{ flex: 1, overflowY: 'auto' }}>
        <Box sx={{ background: 'linear-gradient(180deg,#e7eeff 0%, var(--c-page) 70%)', px: 2.5, pb: '120px' }}>
          <StatusBar />
          <HomeSegment tab="myday" onToday={() => nav('/')} />

          <Typography sx={{ mt: 2.2, fontSize: 22, fontWeight: 800, color: tokens.color.ink }}>{profile.name}님의 사주 원국</Typography>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: tokens.color.inkSub, mt: 0.4 }}>
            양 {profile.year}/{String(profile.month).padStart(2, '0')}/{String(profile.day).padStart(2, '0')} {timeLabel} · {profile.city}
            {corrected}
          </Typography>

          {/* 원국표 — 목업 v2 = 열 라벨·십성·천간·지지·십성 컴팩트(전체 7행은 리포트) */}
          <Box sx={{ mt: 1.75, display: 'flex', justifyContent: 'center' }}>
            <SajuTable pillars={chart.pillars} unknownHour={profile.hourUnknown} compact />
          </Box>

          <OhaengMini ohaeng={ohaeng} total={profile.hourUnknown ? 6 : 8} />

          <SectionTitle>매일 반찬 — 오늘의 일진</SectionTitle>
          <Box className="glass" sx={{ borderRadius: '18px', p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1.2 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '11px', bgcolor: tileOh.bg, color: tileOh.ink, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flex: '0 0 auto' }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{today.dayName}</span>
                {iljinGapja && <span style={{ fontSize: 10, fontWeight: 700, marginTop: 2 }}>{iljinGapja.yin ? '-' : '+'}{iljinGapja.element}</span>}
              </Box>
              <Box>
                <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: tokens.color.primary }}>
                  오늘의 일진 — {today.dayName}({today.dayHanja})일
                </Typography>
                {fortune && (
                  <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: tokens.color.inkSub }}>
                    내 일간 {chart.dayMaster.ganK}{chart.dayMaster.element}에게 {fortune.stemTenGod}
                    {fortune.theme ? ` — ${fortune.theme}` : ''}
                  </Typography>
                )}
              </Box>
            </Box>
            {bullets.map((b, i) => (
              <Typography key={i} sx={{ fontSize: 13.5, color: tokens.color.inkSub, lineHeight: 1.6, mb: 0.4 }}>· {b}</Typography>
            ))}
            {fortune && (
              <Typography sx={{ fontSize: 10.5, color: tokens.color.inkFaint, mt: 1 }}>— 엔진 일진 관계 산출({fortune.score}점 · 근거 병기)</Typography>
            )}
          </Box>

          <GlassButton onClick={() => nav('/analysis')} sx={{ mt: 1.75 }}>
            전체 사주분석 보기
          </GlassButton>
        </Box>
      </Box>
    </MyeongShell>
  )
}
