import { useState } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import StatusBar from '../components/StatusBar'
import MyeongShell, { Pict } from '../components/MyeongShell'
import CharacterStage from '../components/CharacterStage'
import SajuTable from '../components/SajuTable'
import { OhaengStrip, SectionTitle, GlassButton } from '../components/ReportParts'
import { tokens } from '../theme'
import { ohaengWithoutHour, todayInfo, myTodayFortune, sampleProfileLabel } from '../data/saju'
import { HOST_NAME, hasChef } from '../data/chefs'
import { useReport, stepPath } from '../data/useReport'

/**
 * 1단계 · 인트로 — 「기본 원국 + 오늘 사주 점수」.
 *
 * 260725 3분할(운영자: "기본 개요, 상담하기 이런거는 아예 분리를 하고 / 맨 인트로에 기본 원국이랑
 * 오늘 사주 봐주는 점수 느낌으로. 그 다음에 구체적으로 사주 분석 풀이, 그 다음에는 미연시").
 * 전엔 이 셋이 /result 한 화면에 다 들어 있어 층위가 없었다.
 *
 * 여기서 끝내도 되는 화면이다 — 매일 들러 오늘 한 상 받고 나가는 게 브랜드 핵심 루프라
 * 원국·점수까지가 '기본상'이고, 더 파고들 사람만 [분석 → 상담]으로 내려간다.
 */
export default function Intro() {
  const nav = useNavigate()
  const { resolved, chart, reading } = useReport()
  const today = todayInfo()
  const [copied, setCopied] = useState(false)

  const onShare = async () => {
    const url = `${location.origin}${stepPath('intro', resolved.search)}`
    try {
      if (navigator.share) {
        await navigator.share({ title: `${HOST_NAME} · AI 사주 상담`, text: `${resolved.name || '내'} 사주 — ${reading?.headline ?? ''}`, url })
        return
      }
    } catch {
      /* 공유 시트 취소 등 — 클립보드 폴백 */
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      /* noop */
    }
  }

  if (!chart || !reading) {
    return (
      <MyeongShell active="intro" gate={false}>
        <StatusBar />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, gap: 2 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: tokens.color.ink, textAlign: 'center', lineHeight: 1.6 }}>
            {resolved.broken ? (
              <>
                공유 링크가 잘못됐어요.
                <br />
                보낸 분께 다시 요청하거나, 내 사주를 직접 입력해 보세요.
              </>
            ) : (
              <>
                사주를 불러오지 못했어요.
                <br />
                생년월일시를 다시 확인해 주세요.
              </>
            )}
          </Typography>
          <Button variant="contained" onClick={() => nav('/input')}>정보 입력하기</Button>
        </Box>
      </MyeongShell>
    )
  }

  const pillars = chart.pillars
  const ohaeng = resolved.hourUnknown ? ohaengWithoutHour(pillars) : chart.ohaeng
  const ohaengTotal = resolved.hourUnknown ? 6 : 8
  const showCorrected = chart.corrected && resolved.input.solarTimeCorrection !== false && !resolved.hourUnknown
  const fortune = (() => {
    try {
      return myTodayFortune(resolved.input)
    } catch {
      return null
    }
  })()
  const captionSx = {
    fontSize: 11.5,
    bgcolor: tokens.color.card,
    color: tokens.color.inkSub,
    px: 1.2,
    py: 0.4,
    borderRadius: 100,
    display: 'inline-block',
    mt: 0.6,
    fontWeight: 600,
  } as const
  const bannerSx = {
    alignSelf: 'center',
    mt: 1,
    px: 1.6,
    py: 0.9,
    borderRadius: 100,
    bgcolor: tokens.color.primarySoft,
    border: `1px solid ${tokens.color.primary}`,
    color: tokens.color.primary,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'transform .12s var(--ease)',
    '&:active': { transform: 'scale(0.98)' },
  } as const

  return (
    <MyeongShell active="intro" gate={false}>
      <Box className="msd-fadein" sx={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <CharacterStage height={300}>
          <StatusBar dark={hasChef()} />
          {hasChef() && <Box sx={{ flex: 1 }} />}
          <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column' }}>
            {resolved.sample && (
              <Box onClick={() => nav('/input')} sx={bannerSx}>
                지금 보는 건 {sampleProfileLabel} — 내 사주 입력하기
              </Box>
            )}
            {resolved.shared && (
              <Box onClick={() => nav('/input')} sx={bannerSx}>
                공유받은 사주 — {resolved.name}님의 리포트 · 내 사주도 보기
              </Box>
            )}
          </Box>
        </CharacterStage>

        {/* 기본 원국 — 캐릭터 미배정이면 본문이 상주 크롬 아래로 직접 내려간다 */}
        <Box sx={{ position: 'relative', zIndex: 3, bgcolor: 'var(--c-page)' }}>
          <Box sx={{ px: 2, pt: hasChef() ? 1 : 6.5, mb: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <SajuTable pillars={pillars} unknownHour={resolved.hourUnknown} />
            {showCorrected && (
              <Typography sx={captionSx}>
                진태양시 {String(chart.corrected!.hh).padStart(2, '0')}:{String(chart.corrected!.mm).padStart(2, '0')} (보정 {chart.corrected!.minutes}분 · {resolved.city})
              </Typography>
            )}
            {resolved.hourUnknown && <Typography sx={captionSx}>시간 모름 — 시주 없이 세 기둥으로 풀이</Typography>}
          </Box>

          <OhaengStrip ohaeng={ohaeng} total={ohaengTotal} />
        </Box>

        {/* 오늘 사주 점수 — 엔진 일진 관계(합충형파해·공망)의 결정론 정책 점수 + 근거 병기 */}
        <Box sx={{ position: 'relative', zIndex: 3, bgcolor: 'var(--c-page)', px: 2.5 }}>
          <SectionTitle>
            오늘 · {today.month}월 {today.day}일 {today.dayName}일
          </SectionTitle>
          <Box className="glass" sx={{ borderRadius: '18px', p: 2 }}>
            {fortune ? (
              <>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.color.inkSub }}>
                      오늘의 운세{fortune.theme ? ` · ${fortune.theme}` : ''}
                    </Typography>
                    <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: tokens.color.primary, mt: 0.4, maxWidth: 230, lineHeight: 1.45 }}>
                      {fortune.oneLine}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.4, flex: '0 0 auto' }}>
                    <span style={{ fontSize: 44, fontWeight: 800, color: 'var(--c-ink)', lineHeight: 1, letterSpacing: 'var(--tracking)' }}>{fortune.score}</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-ink-sub)', paddingBottom: 4 }}>점</span>
                  </Box>
                </Box>
                {fortune.basis.length > 0 && (
                  <Typography sx={{ fontSize: 11.5, color: tokens.color.inkSub, fontWeight: 600, mt: 1 }}>
                    — 근거: {fortune.basis.join(' · ')}
                  </Typography>
                )}
              </>
            ) : (
              <Typography sx={{ fontSize: 13.5, color: tokens.color.inkSub }}>오늘 일진 계산에 필요한 값이 부족해요.</Typography>
            )}
          </Box>

          {/* 다음 단계 — 여기서 끝내도 되고, 파고들 사람만 내려간다 */}
          <SectionTitle>더 파고들기</SectionTitle>
          <Button fullWidth variant="contained" onClick={() => nav(stepPath('analysis', resolved.search))}>
            사주 분석 풀이 보기
          </Button>
          <GlassButton onClick={() => nav(stepPath('talk', resolved.search))} sx={{ mt: 1.2 }}>
            {HOST_NAME}와 상담하기
          </GlassButton>
        </Box>

        {/* 액션 — 공유·정보수정 */}
        <Box sx={{ position: 'relative', zIndex: 3, bgcolor: 'var(--c-page)', px: 2.5, pt: 2, pb: '120px', display: 'flex', gap: 1.5, justifyContent: 'center' }}>
          {!resolved.sample && (
            <ActionCircle label={copied ? '복사됨' : '공유'} onClick={onShare}>
              {copied ? Pict.check(19) : Pict.mail(19)}
            </ActionCircle>
          )}
          <ActionCircle label="정보수정" onClick={() => nav('/input')}>
            {Pict.pencil(19)}
          </ActionCircle>
        </Box>
      </Box>
    </MyeongShell>
  )
}

/** 원형 액션 — 홈 CircleBtn 규격(44px·primarySoft) 계승 */
function ActionCircle({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box
        onClick={onClick}
        role="button"
        aria-label={label}
        sx={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          bgcolor: tokens.color.primarySoft,
          color: tokens.color.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'transform .12s var(--ease)',
          '&:active': { transform: 'scale(0.98)' },
        }}
      >
        {children}
      </Box>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.color.inkFaint, mt: 0.5 }}>{label}</Typography>
    </Box>
  )
}
