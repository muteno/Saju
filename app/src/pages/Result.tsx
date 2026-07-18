import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import Screen from '../components/Screen'
import StatusBar from '../components/StatusBar'
import CharacterStage from '../components/CharacterStage'
import TopControls from '../components/TopControls'
import SajuTable from '../components/SajuTable'
import DialogueBox from '../components/DialogueBox'
import GapjaSticker from '../components/GapjaSticker'
import { tokens } from '../theme'
import { computeChartUI, buildReading, todayKST, type UiChart, type ReportBundle } from '../engine'
import DosaChat from '../components/DosaChat'
import { toReading, ohaengWithoutHour, SAMPLE_INPUT, sampleProfileLabel, type Reading, type OhaengStat } from '../data/saju'
import { gapjaByGanji } from '../data/gapja'
import { activeProfile, parseShare, profileToInput, profileToSearch } from '../data/profiles'
import OhaengTile from '../components/OhaengTile'

const verdictColor = { 부족: '#B8B2AC', 적정: '#5AA06E', 발달: tokens.color.primary, 과다: tokens.color.solar }

function OhaengStrip({ ohaeng }: { ohaeng: OhaengStat[] }) {
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

function SectionTitle({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.color.ink, mb: 1.2, mt: 2.5 }}>{children}</Typography>
}

/** 대운 흐름 가로 레일 — 타일=OhaengTile 재사용, 현재 대운=하이라이트(선택 보더 2.4px 문법) */
function DaeunRail({ daeun, birthYear }: { daeun: UiChart['daeun']; birthYear: number }) {
  const nowYear = todayKST().year
  const curAge = nowYear - birthYear
  const activeIdx = daeun.list.reduce((acc, it, i) => (it.age <= curAge ? i : acc), -1)
  const activeRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    // 가로 레일만 현재 대운으로 스크롤 — scrollIntoView는 페이지 세로 스크롤까지 끌어서 금지
    const el = activeRef.current
    const rail = el?.parentElement
    if (el && rail) rail.scrollLeft = el.offsetLeft - rail.clientWidth / 2 + el.clientWidth / 2
  }, [])
  return (
    <Box className="glass" sx={{ borderRadius: '18px', p: 1.5 }}>
      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.color.inkSub, mb: 1 }}>
        {daeun.forward ? '순행' : '역행'} · 대운수 {daeun.su} — 10년마다 바뀌는 큰 흐름
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
        {daeun.list.map((it, i) => {
          const g = gapjaByGanji(it.name)
          const active = i === activeIdx
          return (
            <Box
              key={it.age}
              ref={active ? activeRef : undefined}
              sx={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}
            >
              <Typography sx={{ fontSize: 10.5, fontWeight: active ? 800 : 600, color: active ? tokens.color.primary : tokens.color.inkFaint }}>
                {it.age}세 · {birthYear + it.age}
              </Typography>
              <OhaengTile main={it.name[0]} hanja={g?.hanja[0] ?? ''} polarity={g && !g.yin ? '+' : '-'} element={g?.element ?? '토'} size={38} highlight={active} />
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: tokens.color.inkSub, lineHeight: 1 }}>{it.name[1]}</Typography>
              <Typography sx={{ fontSize: 10, color: tokens.color.inkFaint, lineHeight: 1.2, textAlign: 'center' }}>
                {it.stemTenGod}
                <br />
                {it.twelveStage}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

export default function Result() {
  const loc = useLocation()
  const nav = useNavigate()

  // 데이터 소스 우선순위: URL 파라미터(공유·새로고침 안전) → 저장 프로필 → 샘플(명시 라벨)
  const resolved = useMemo(() => {
    const shared = parseShare(loc.search)
    if (shared) return { ...shared, sample: false, search: loc.search.replace(/^\?/, '') }
    const p = activeProfile()
    if (p)
      return { input: profileToInput(p), name: p.name, city: p.city, hourUnknown: p.hourUnknown, sample: false, search: profileToSearch(p) }
    return { input: SAMPLE_INPUT, name: '', city: '서울', hourUnknown: false, sample: true, search: '' }
  }, [loc.search])

  const chart = useMemo<UiChart | null>(() => {
    try {
      return computeChartUI(resolved.input)
    } catch {
      return null
    }
  }, [resolved])
  const reading = useMemo<Reading | null>(() => {
    if (!chart) return null
    try {
      return toReading(resolved.input, { hourUnknown: resolved.hourUnknown })
    } catch {
      return null
    }
  }, [chart, resolved])
  // L4 대화용 원본 리포트 번들(주제 결정론 매핑의 근거 소스)
  const report = useMemo<ReportBundle | null>(() => {
    if (!chart) return null
    try {
      return buildReading(resolved.input)
    } catch {
      return null
    }
  }, [chart, resolved])

  const [copied, setCopied] = useState(false)
  const onShare = async () => {
    const url = `${location.origin}/result?${resolved.search}`
    const title = '아이샤 · AI 사주 리포트'
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${resolved.name || '내'} 사주 — ${reading?.headline ?? ''}`, url })
        return
      }
    } catch {
      /* 공유 시트 취소 등 — 클립보드 폴백 */
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* noop */
    }
  }

  if (!chart || !reading) {
    return (
      <Screen>
        <StatusBar />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, gap: 2 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: tokens.color.ink, textAlign: 'center', lineHeight: 1.6 }}>
            사주를 불러오지 못했어요.
            <br />
            생년월일시를 다시 확인해 주세요.
          </Typography>
          <Button variant="contained" onClick={() => nav('/input')}>정보 입력하기</Button>
        </Box>
      </Screen>
    )
  }

  const pillars = chart.pillars
  const ohaeng = resolved.hourUnknown ? ohaengWithoutHour(pillars) : chart.ohaeng
  const ilju = pillars.find((p) => p.isDayMaster)
  const iljuGanji = ilju ? ilju.ganK + ilju.jiK : undefined
  const showCorrected = chart.corrected && resolved.input.solarTimeCorrection !== false && !resolved.hourUnknown

  return (
    <Screen>
      <Box sx={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* 첫 화면(VN) — 기존 구성 계승: 스테이지 + 원국표 + 오행 + 도사 한마디 */}
        <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
          <CharacterStage tint="linear-gradient(180deg,#bfe0b8,#e8dfa0)" />
          <StatusBar dark />
          <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <TopControls />
            {resolved.sample && (
              /* ⚠신규: 샘플 모드 배너 — 남의 샘플을 내 사주로 오인하지 않게 명시 */
              <Box
                onClick={() => nav('/input')}
                sx={{
                  alignSelf: 'center',
                  mt: 1,
                  px: 1.6,
                  py: 0.7,
                  borderRadius: 100,
                  bgcolor: tokens.color.primarySoft,
                  border: `1px solid ${tokens.color.primary}`,
                  color: tokens.color.primary,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                지금 보는 건 {sampleProfileLabel} — 내 사주 입력하기 ›
              </Box>
            )}
            <Box sx={{ flex: 1 }} />

            <Box sx={{ pl: 2, pr: 2, mb: 0.5 }}>
              <SajuTable pillars={pillars} unknownHour={resolved.hourUnknown} />
              {showCorrected && (
                <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.85)', mt: 0.5, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                  진태양시 {String(chart.corrected!.hh).padStart(2, '0')}:{String(chart.corrected!.mm).padStart(2, '0')} (보정 {chart.corrected!.minutes}분 · {resolved.city})
                </Typography>
              )}
              {resolved.hourUnknown && (
                <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.85)', mt: 0.5, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                  시간 모름 — 시주 없이 세 기둥으로 풀이
                </Typography>
              )}
            </Box>

            <OhaengStrip ohaeng={ohaeng} />

            <DialogueBox speaker="아이샤">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {iljuGanji && <GapjaSticker ganji={iljuGanji} size={44} showLabel={false} />}
                <Box sx={{ lineHeight: 1.2 }}>
                  <Typography component="span" sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.color.inkSub, letterSpacing: 'var(--tracking)' }}>
                    {resolved.name ? `${resolved.name} · ` : ''}일주 {iljuGanji ?? ''}
                  </Typography>
                  <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.color.primary, letterSpacing: 'var(--tracking)' }}>
                    {reading.headline}
                  </Typography>
                </Box>
              </Box>
              {reading.dialogue.map((s) => (
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
        </Box>

        {/* 리포트 시트 — 홈 콘텐츠 문법(SectionTitle + glass 카드) 계승 */}
        <Box sx={{ position: 'relative', zIndex: 3, bgcolor: 'var(--c-page)', px: 2.5, pb: 4 }}>
          {reading.cards.map((card) => (
            <Box key={card.id}>
              <SectionTitle>{card.title}</SectionTitle>
              <Box className="glass" sx={{ borderRadius: '18px', p: 2 }}>
                {card.chips && card.chips.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7, mb: card.blocks.length ? 1.2 : 0 }}>
                    {card.chips.map((c) => (
                      <Box
                        key={c}
                        sx={{
                          px: 1.2,
                          py: 0.4,
                          borderRadius: 100,
                          bgcolor: 'var(--c-card)',
                          border: `1px solid ${tokens.color.border}`,
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: tokens.color.inkSub,
                        }}
                      >
                        {c}
                      </Box>
                    ))}
                  </Box>
                )}
                {card.blocks.map((b, i) => (
                  <Box key={i} sx={{ mb: i < card.blocks.length - 1 ? 1.4 : 0 }}>
                    {b.label && (
                      <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: tokens.color.primary, mb: 0.5 }}>{b.label}</Typography>
                    )}
                    {b.lines.map((l, j) => (
                      <Typography key={j} sx={{ fontSize: 13.5, color: tokens.color.inkSub, lineHeight: 1.55, mb: 0.3 }}>
                        · {l}
                      </Typography>
                    ))}
                    {b.source && (
                      <Typography sx={{ fontSize: 10.5, color: tokens.color.inkFaint, mt: 0.4 }}>— 출처: {b.source}</Typography>
                    )}
                  </Box>
                ))}
                {card.note && (
                  <Typography sx={{ fontSize: 11.5, color: tokens.color.inkFaint, mt: 1.2 }}>{card.note}</Typography>
                )}
              </Box>
            </Box>
          ))}

          {!resolved.hourUnknown && (
            <>
              <SectionTitle>대운 흐름</SectionTitle>
              <DaeunRail daeun={chart.daeun} birthYear={resolved.input.year} />
            </>
          )}

          <SectionTitle>아이샤에게 물어보기</SectionTitle>
        </Box>

        {/* L4 도사 대화 — 주제 선택지 → 근거 대사(타이프라이터). LLM 미설정 시 L3 폴백 완결 동작 */}
        <Box sx={{ position: 'relative', zIndex: 3, bgcolor: 'var(--c-page)', pb: 1 }}>
          {report && <DosaChat report={report} profileName={resolved.name || undefined} hourUnknown={resolved.hourUnknown} />}
        </Box>

        <Box sx={{ position: 'relative', zIndex: 3, bgcolor: 'var(--c-page)', px: 2.5, pb: 4 }}>
          {!resolved.sample && (
            /* ⚠신규: 결과 공유 — URL로 같은 리포트 재현 */
            <Button fullWidth variant="outlined" onClick={onShare} sx={{ mt: 1 }}>
              {copied ? '링크를 복사했어요 ✓' : '리포트 공유하기'}
            </Button>
          )}
          {resolved.sample && (
            <Button fullWidth variant="contained" onClick={() => nav('/input')} sx={{ mt: 1 }}>
              내 사주 입력하기
            </Button>
          )}
        </Box>
      </Box>
    </Screen>
  )
}
