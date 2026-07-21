import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import StatusBar from '../components/StatusBar'
import MyeongShell, { Pict } from '../components/MyeongShell'
import { tokens } from '../theme'
import { computeChartUI, type UiChart } from '../engine'
import { todayInfo, myTodayFortune, toReading, type Reading } from '../data/saju'
import { activeProfile, profileToInput, profileToSearch } from '../data/profiles'

const PLATE = '/assets/dosa-plate.jpg'

function CircleBtn({ children, label, onClick }: { children: ReactNode; label?: string; onClick?: () => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box
        onClick={onClick}
        role={onClick ? 'button' : undefined}
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
          fontSize: 17,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'transform .12s var(--ease)',
          '&:active': onClick ? { transform: 'scale(0.98)' } : {},
        }}
      >
        {children}
      </Box>
      {label && (
        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: tokens.color.inkFaint, mt: 0.5, textAlign: 'center' }}>{label}</Typography>
      )}
    </Box>
  )
}

/** 중앙 세그먼트 [오늘|내 원국] — 목업 v2: w196 알약, 선택 = 솔리드 코발트, 가운데 정렬 */
export function HomeSegment({ tab, onMyday, onToday }: { tab: 'today' | 'myday'; onMyday?: () => void; onToday?: () => void }) {
  const seg = (on: boolean, label: string, onClick?: () => void) => (
    <Box
      onClick={on ? undefined : onClick}
      role={on ? undefined : 'button'}
      sx={{
        flex: 1,
        textAlign: 'center',
        py: '7px',
        borderRadius: '100px',
        bgcolor: on ? tokens.color.primary : 'transparent',
        color: on ? tokens.color.onPrimary : tokens.color.inkSub,
        fontSize: 12.5,
        fontWeight: on ? 800 : 700,
        cursor: on ? 'default' : 'pointer',
        transition: 'transform .12s var(--ease)',
        '&:active': on ? {} : { transform: 'scale(0.98)' },
      }}
    >
      {label}
    </Box>
  )
  return (
    <Box sx={{ display: 'flex', m: '10px auto 0', borderRadius: '100px', background: 'rgba(255,255,255,.5)', border: '1px solid rgba(255,255,255,.7)', p: '3px', width: 196 }}>
      {seg(tab === 'today', '오늘', onToday)}
      {seg(tab === 'myday', '내 원국', onMyday)}
    </Box>
  )
}

/** 바로가기 칩(가로 스크롤 행) — h36 글래스 알약 */
function QuickChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      role="button"
      sx={{
        flex: '0 0 auto',
        height: 36,
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.75,
        borderRadius: '100px',
        fontSize: 12.5,
        fontWeight: 700,
        color: tokens.color.primary,
        cursor: 'pointer',
        background: 'rgba(255,255,255,.5)',
        border: '1px solid rgba(255,255,255,.8)',
        backdropFilter: 'blur(11px)',
        WebkitBackdropFilter: 'blur(11px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.75)',
        transition: 'transform .12s var(--ease)',
        '&:active': { transform: 'scale(0.98)' },
      }}
    >
      {label}
    </Box>
  )
}

/** 캐릭터 원형 스테이지 — 플레이트 크롭(목업 v2: 230×170, 150% / 50% 22%) */
function CharacterCircle() {
  return (
    <Box sx={{ m: '8px auto 0', width: 230, height: 170, borderRadius: '50%', background: 'radial-gradient(circle at 50% 30%, var(--c-sky-bot), var(--c-sky-top))', position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', inset: 0, backgroundImage: `url('${PLATE}')`, backgroundSize: '150%', backgroundPosition: '50% 22%' }} />
    </Box>
  )
}

/** 보조 버튼 — h52 · r14 · 17/700 · 글래스 .5 + blur11(목업 v2 규격) */
export function GlassButton({ children, onClick, sx: sxOver }: { children: ReactNode; onClick: () => void; sx?: object }) {
  return (
    <Box
      onClick={onClick}
      role="button"
      sx={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,.8)',
        color: tokens.color.primary,
        fontSize: 17,
        fontWeight: 700,
        background: 'rgba(255,255,255,.5)',
        backdropFilter: 'blur(11px)',
        WebkitBackdropFilter: 'blur(11px)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.75)',
        cursor: 'pointer',
        transition: 'transform .12s var(--ease)',
        '&:active': { transform: 'scale(0.98)' },
        ...sxOver,
      }}
    >
      {children}
    </Box>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.color.ink, mb: 1.2, mt: 2.5 }}>{children}</Typography>
}

const heroBg = 'linear-gradient(180deg,#fce7db 0%, #fbeee7 55%, var(--c-page) 100%)'

export default function Home() {
  const nav = useNavigate()
  const profile = activeProfile()
  const today = todayInfo()

  const data = useMemo(() => {
    if (!profile) return null
    try {
      const input = profileToInput(profile)
      const chart: UiChart = computeChartUI(input)
      const reading: Reading = toReading(input, { hourUnknown: profile.hourUnknown })
      const fortune = myTodayFortune(input)
      return { input, chart, reading, fortune }
    } catch {
      return null
    }
  }, [profile])

  const search = profile ? profileToSearch(profile) : ''

  // 오늘의 운세 공유 — 점수+한줄 (죽어 있던 슬롯의 실기능, 기존 배선 유지)
  const [sharedToday, setSharedToday] = useState(false)
  const onShareToday = async () => {
    const f = data?.fortune
    const url = `${location.origin}/result?${search}`
    const text = f ? `오늘의 운세 ${f.score}점 — ${f.oneLine}` : '내 사주 리포트'
    try {
      if (navigator.share) {
        await navigator.share({ title: '명식당 · 오늘의 운세', text, url })
        return
      }
    } catch {
      return
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setSharedToday(true)
      setTimeout(() => setSharedToday(false), 2500)
    } catch {
      /* noop */
    }
  }

  // ── 온보딩(프로필 없음) — 목업·가짜 수치 없이 시작 안내만 ──
  if (!profile || !data) {
    return (
      <MyeongShell active="home">
        <Box className="msd-fadein" sx={{ flex: 1, overflowY: 'auto' }}>
          <Box sx={{ background: heroBg, px: 2.5, pb: 3, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
            <StatusBar />
            <HomeSegment tab="today" onMyday={() => nav('/myday')} />
            <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.2, mt: 2 }}>
              <Box sx={{ lineHeight: 1.05 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: tokens.color.inkFaint }}>{today.month}월</Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: tokens.color.inkSub }}>{today.day}</Typography>
              </Box>
              <Typography sx={{ fontSize: 32, fontWeight: 800, color: tokens.color.ink }}>어서 오세요</Typography>
            </Box>
            <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
              <Box sx={{ position: 'relative', maxWidth: '78%', bgcolor: tokens.color.primary, color: tokens.color.onPrimary, px: 2, py: 1.3, borderRadius: '18px' }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>
                  오늘 일진은 <b>{today.dayName}</b>일. 생년월일시를 알려주면 그대 사주로 오늘을 차려드리지.
                </Typography>
                <Box sx={{ position: 'absolute', bottom: -7, left: 30, width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: `9px solid ${tokens.color.primary}` }} />
              </Box>
            </Box>
            <CharacterCircle />
            <Box sx={{ flex: 1 }} />
            <Button fullWidth variant="contained" onClick={() => nav('/input')} sx={{ mt: 2 }}>
              내 사주 입력하고 시작하기
            </Button>
            <Typography sx={{ textAlign: 'center', fontSize: 11.5, color: tokens.color.inkFaint, mt: 1.2, mb: 9, lineHeight: 1.5 }}>
              입력 정보는 이 기기에만 저장돼요 · 근거 문헌 2,504편 기반 풀이
            </Typography>
          </Box>
        </Box>
      </MyeongShell>
    )
  }

  // ── 메인 1 — 오늘(목업 v2) : 전부 실계산 ──
  const { reading, fortune } = data
  const traitLine = reading.dialogue.find((s) => s.label.includes('특성'))?.lines[0]
  const yearLine = reading.dialogue.find((s) => s.label.startsWith('올해'))?.lines[0]

  return (
    <MyeongShell active="home">
      <Box className="msd-fadein" sx={{ flex: 1, overflowY: 'auto' }}>
        {/* 히어로 */}
        <Box sx={{ background: heroBg, px: 2.5, pb: 2 }}>
          <StatusBar />
          <HomeSegment tab="today" onMyday={() => nav('/myday')} />

          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.2, mt: 2 }}>
            <Box sx={{ lineHeight: 1.05 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: tokens.color.inkFaint }}>{today.month}월</Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 800, color: tokens.color.inkSub }}>{today.day}</Typography>
            </Box>
            <Typography sx={{ fontSize: 32, fontWeight: 800, color: tokens.color.ink }}>{profile.name}</Typography>
          </Box>

          {/* 말풍선 — 오늘 일진 실계산 */}
          <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
            <Box sx={{ position: 'relative', maxWidth: '78%', bgcolor: tokens.color.primary, color: tokens.color.onPrimary, px: 2, py: 1.3, borderRadius: '18px' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>
                오늘 일진은 <b>{today.dayName}</b>일. {fortune?.oneLine ?? ''}
              </Typography>
              <Box sx={{ position: 'absolute', bottom: -7, left: 30, width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: `9px solid ${tokens.color.primary}` }} />
            </Box>
          </Box>

          <CharacterCircle />

          {/* 액션 서클 + 오늘의 운세 점수(엔진 관계 기반 정책 점수) */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mt: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <CircleBtn label="리포트" onClick={() => nav(`/result?${search}`)}>↗</CircleBtn>
              <CircleBtn label="공유" onClick={onShareToday}>{sharedToday ? '✓' : '✉'}</CircleBtn>
              <CircleBtn label="정보수정" onClick={() => nav('/input')}>✎</CircleBtn>
            </Box>
            {fortune && (
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.color.inkSub }}>
                  오늘의 운세{fortune.theme ? ` · ${fortune.theme}` : ''}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.4, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 44, fontWeight: 800, color: 'var(--c-ink)', lineHeight: 1, letterSpacing: 'var(--tracking)' }}>{fortune.score}</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-ink-sub)', paddingBottom: 4 }}>점</span>
                </Box>
                {fortune.basis.length > 0 && (
                  <Typography sx={{ fontSize: 11.5, color: tokens.color.inkSub, fontWeight: 600 }}>{fortune.basis.slice(0, 2).join(' · ')}</Typography>
                )}
              </Box>
            )}
          </Box>

          <GlassButton onClick={() => nav('/analysis')} sx={{ mt: 1.5 }}>
            연리에게 자세히 물어볼까요?
          </GlassButton>
        </Box>

        {/* 콘텐츠 */}
        <Box sx={{ px: 2.5, pb: '120px' }}>
          {/* 바로가기 칩 행 */}
          <Box sx={{ display: 'flex', gap: 1, mt: 1.75, overflowX: 'auto' }}>
            <QuickChip label="AI 상담" onClick={() => nav(`/result?${search}`)} />
            <QuickChip label="만세력" onClick={() => nav('/myday')} />
            <QuickChip label="연예인 궁합" onClick={() => nav('/fun')} />
            <QuickChip label="신년운세" onClick={() => nav('/fun')} />
          </Box>

          <SectionTitle>오늘의 한 상 — 한눈에 보기</SectionTitle>
          <Box className="glass" sx={{ borderRadius: '18px', p: 2 }}>
            <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: tokens.color.primary, mb: 0.8 }}>{reading.headline}</Typography>
            {[traitLine, yearLine].filter(Boolean).map((l, i) => (
              <Typography key={i} sx={{ fontSize: 13.5, color: tokens.color.inkSub, lineHeight: 1.55, mb: 0.3 }}>· {l}</Typography>
            ))}
          </Box>

          {/* 프로모 카드 → 사주 재미 */}
          <Box
            className="glass"
            onClick={() => nav('/fun')}
            role="button"
            sx={{ mt: 1.5, borderRadius: '18px', p: '14px 16px', display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', color: tokens.color.primary, transition: 'transform .12s var(--ease)', '&:active': { transform: 'scale(0.98)' } }}
          >
            {Pict.heart(28)}
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: tokens.color.solar }}>사주 재미</Typography>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: tokens.color.ink }}>연예인 궁합 · 일주 동물 검색 해보기 ›</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </MyeongShell>
  )
}
