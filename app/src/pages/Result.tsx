import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import Screen from '../components/Screen'
import StatusBar from '../components/StatusBar'
import CharacterStage from '../components/CharacterStage'
import SajuTable from '../components/SajuTable'
import DialogueBox from '../components/DialogueBox'
import GapjaSticker from '../components/GapjaSticker'
import DosaChat from '../components/DosaChat'
import { tokens } from '../theme'
import { computeChartUI, buildReading, jeonggokRaw, todayKST, type UiChart, type ReportBundle } from '../engine'
import { selectJeonggok, type JeonggokPick } from '../data/jeonggok'
import { toReading, ohaengWithoutHour, SAMPLE_INPUT, sampleProfileLabel, type Reading, type OhaengStat, type ReadingCard } from '../data/saju'
import { gapjaByGanji } from '../data/gapja'
import { activeProfile, parseShare, profileToInput, profileToSearch } from '../data/profiles'
import OhaengTile from '../components/OhaengTile'

// 판정어 색 — 전부 정본 팔레트 경유(하드코딩 아웃라이어 정렬, 260718 실측 수선)
const verdictColor = { 부족: tokens.color.inkSub, 적정: 'var(--oh-label-mok)', 발달: tokens.color.primary, 과다: tokens.color.solar }
const OH_LABEL: Record<string, string> = {
  목: 'var(--oh-label-mok)', 화: 'var(--oh-label-hwa)', 토: 'var(--oh-label-to)', 금: 'var(--oh-label-geum)', 수: 'var(--oh-label-su)',
}

/** 오행 스트립 — 불투명 카드(스테이지 위 가독) + 바 길이 = 비율 인코딩 + 개수·판정 결합 */
function OhaengStrip({ ohaeng, total }: { ohaeng: OhaengStat[]; total: number }) {
  return (
    <Box sx={{ mx: 2, mb: 1, px: 1.5, py: 1, borderRadius: '16px', display: 'flex', gap: 0.75, bgcolor: tokens.color.card, boxShadow: 'var(--shadow-card)' }}>
      {ohaeng.map((o) => {
        const count = Math.round((o.pct * total) / 100)
        return (
          <Box key={o.key} sx={{ flex: 1, textAlign: 'center' }}>
            <Box sx={{ height: 5, borderRadius: 3, bgcolor: tokens.color.border, mb: 0.6, overflow: 'hidden' }}>
              <Box sx={{ width: `${Math.min(100, o.pct * 2)}%`, height: '100%', borderRadius: 3, bgcolor: tokens.ohaeng[o.key].bg }} />
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: OH_LABEL[o.key], lineHeight: 1 }}>{o.key}</Typography>
            <Typography sx={{ fontSize: 10.5, color: verdictColor[o.verdict], fontWeight: 700 }}>
              {count}개 · {o.verdict}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.color.ink, mb: 1.2, mt: 2.5 }}>{children}</Typography>
}

/** 대운 흐름 가로 레일 — 간·지 모두 OhaengTile(원국표와 같은 계층=같은 문법), 현재 대운 하이라이트 */
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
      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.color.inkSub, mb: 0.3 }}>
        대운수 {daeun.su} — 10년마다 바뀌는 큰 흐름
        {activeIdx >= 0 ? ` · 지금 ${daeun.list[activeIdx].name} 대운` : ' · 아직 첫 대운 전'}
      </Typography>
      <Typography sx={{ fontSize: 10.5, color: tokens.color.inkSub, mb: 1 }}>
        간지가 {daeun.forward ? '순서대로 도는 순행' : '거꾸로 도는 역행'} · 좌우로 넘겨 보세요
      </Typography>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          pb: 0.5,
          maskImage: 'linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)',
        }}
      >
        {daeun.list.map((it, i) => {
          const g = gapjaByGanji(it.name)
          const active = i === activeIdx
          return (
            <Box
              key={it.age}
              ref={active ? activeRef : undefined}
              sx={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}
            >
              <Typography sx={{ fontSize: 10.5, fontWeight: active ? 800 : 600, color: active ? tokens.color.primary : tokens.color.inkSub }}>
                {it.age}세 · {birthYear + it.age}
              </Typography>
              <OhaengTile main={it.name[0]} hanja={g?.hanja[0] ?? ''} polarity={g && !g.yin ? '+' : '-'} element={g?.element ?? '토'} size={38} highlight={active} />
              <OhaengTile main={it.name[1]} hanja={g?.hanja[1] ?? ''} polarity={it.jiPolarity} element={it.jiE} size={38} highlight={active} />
              <Typography sx={{ fontSize: 10.5, color: active ? tokens.color.inkSub : tokens.color.inkFaint, lineHeight: 1.2, textAlign: 'center' }}>
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

/** 리포트 카드 — 출처는 카드 푸터 1줄 집약, 긴 카드(일주)는 접기, 산문/불릿 자동 판별 */
function ReportCard({ card, onFillHour }: { card: ReadingCard; onFillHour?: () => void }) {
  const [open, setOpen] = useState(false)
  const collapsible = card.blocks.length > 4
  const blocks = collapsible && !open ? card.blocks.slice(0, 2) : card.blocks
  const docs = [...new Set(card.blocks.map((b) => b.source?.split(' · ')[0]).filter(Boolean))] as string[]
  return (
    <Box>
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
        {blocks.map((b, i) => {
          const prose = b.lines.length <= 2 || card.id === 'unse' || card.id === 'judge'
          return (
            <Box key={i} sx={{ mb: i < blocks.length - 1 ? 1.4 : 0 }}>
              {b.label && <Typography sx={{ fontSize: 13, fontWeight: 800, color: tokens.color.primary, mb: 0.6 }}>{b.label}</Typography>}
              {b.lines.map((l, j) => (
                <Typography key={j} sx={{ fontSize: 13.5, color: tokens.color.inkSub, lineHeight: prose ? 1.7 : 1.55, mb: prose ? 0.8 : 0.3 }}>
                  {prose ? l : `· ${l}`}
                </Typography>
              ))}
            </Box>
          )
        })}
        {collapsible && (
          <Box
            onClick={() => setOpen((v) => !v)}
            sx={{
              display: 'inline-block',
              mt: 1.2,
              px: 1.2,
              py: 0.4,
              borderRadius: 100,
              border: `1px solid ${tokens.color.border}`,
              fontSize: 11.5,
              fontWeight: 700,
              color: tokens.color.primary,
              cursor: 'pointer',
              transition: 'transform .12s var(--ease)',
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            {open ? '접기 ▴' : `더 보기 (+${card.blocks.length - 2}) ▾`}
          </Box>
        )}
        {card.note && <Typography sx={{ fontSize: 11.5, color: tokens.color.inkSub, mt: 1.2 }}>{card.note}</Typography>}
        {card.id === 'hour-unknown' && onFillHour && (
          <Button variant="outlined" size="small" onClick={onFillHour} sx={{ mt: 1.2, py: 1, fontSize: 14 }}>
            출생 시간 입력하러 가기
          </Button>
        )}
        {card.id === 'ennea' && (
          <Button variant="outlined" size="small" component="a" href="/enneagram/" target="_blank" rel="noopener" sx={{ mt: 1.2, py: 1, fontSize: 14 }}>
            에니어그램 테스트로 검증하러 가기
          </Button>
        )}
        {docs.length > 0 && (
          <Typography sx={{ fontSize: 10.5, color: tokens.color.inkFaint, mt: 1.4 }}>— 출처: {docs.join(' · ')}</Typography>
        )}
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
    if (shared) {
      // 이 링크가 내 저장 프로필과 같으면 '내 것', 다르면 '공유받은 사주'
      const mine = activeProfile()
      const isMine =
        !!mine && mine.year === shared.input.year && mine.month === shared.input.month && mine.day === shared.input.day && mine.name === shared.name
      return { ...shared, sample: false, shared: !isMine && !!shared.name, search: loc.search.replace(/^\?/, ''), broken: false }
    }
    const hasParams = /(^|[?&])y=/.test(loc.search)
    if (hasParams) return { input: SAMPLE_INPUT, name: '', city: '서울', hourUnknown: false, sample: false, shared: false, search: '', broken: true }
    const p = activeProfile()
    if (p && Number.isInteger(p.year) && p.year >= 1900 && p.year <= 2100)
      return { input: profileToInput(p), name: p.name, city: p.city, hourUnknown: p.hourUnknown, sample: false, shared: false, search: profileToSearch(p), broken: false }
    return { input: SAMPLE_INPUT, name: '', city: '서울', hourUnknown: false, sample: true, shared: false, search: '', broken: false }
  }, [loc.search])

  const chart = useMemo<UiChart | null>(() => {
    if (resolved.broken) return null
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
  // 정곡 오프닝 — 시간 모름이면 스킵(시주 오염 산출물 배제 = 근거 원칙)
  const jeonggok = useMemo<JeonggokPick | null>(() => {
    if (!chart || resolved.hourUnknown) return null
    try {
      return selectJeonggok(jeonggokRaw(resolved.input))
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
      setTimeout(() => setCopied(false), 2500)
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
      </Screen>
    )
  }

  const pillars = chart.pillars
  const ohaeng = resolved.hourUnknown ? ohaengWithoutHour(pillars) : chart.ohaeng
  const ohaengTotal = resolved.hourUnknown ? 6 : 8
  const ilju = pillars.find((p) => p.isDayMaster)
  const iljuGanji = ilju ? ilju.ganK + ilju.jiK : undefined
  const showCorrected = chart.corrected && resolved.input.solarTimeCorrection !== false && !resolved.hourUnknown
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

  return (
    <Screen>
      <Box sx={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* 첫 화면(VN) — 스테이지 + 원국표 + 오행 + 도사 한마디. 시트 48px 픽 노출 = 스크롤 어포던스 */}
        <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 'calc(100% - 48px)' }}>
          <CharacterStage tint="linear-gradient(180deg,#bfe0b8,#e8dfa0)" />
          <StatusBar />
          <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* 상단 유틸 행 — 홈 복귀(인앱 이동 수단) */}
            <Box sx={{ display: 'flex', px: 2, pt: 0.5 }}>
              <Box
                className="glass-soft"
                onClick={() => nav('/')}
                role="button"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  px: 1.6,
                  py: 1,
                  borderRadius: 100,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: tokens.color.ink,
                  cursor: 'pointer',
                  transition: 'transform .12s var(--ease)',
                  '&:active': { transform: 'scale(0.98)' },
                }}
              >
                ‹ 홈
              </Box>
            </Box>
            {resolved.sample && (
              /* 샘플 모드 배너 — 남의 샘플을 내 사주로 오인하지 않게 명시 */
              <Box
                onClick={() => nav('/input')}
                sx={{
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
                }}
              >
                지금 보는 건 {sampleProfileLabel} — 내 사주 입력하기 ›
              </Box>
            )}
            {resolved.shared && (
              /* ⚠신규: 공유 수신 배너 — 남의 리포트임을 명시 + 전환 진입점(샘플 배너 문법 계승) */
              <Box
                onClick={() => nav('/input')}
                sx={{
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
                }}
              >
                공유받은 사주 — {resolved.name}님의 리포트 · 내 사주도 보기 ›
              </Box>
            )}
            <Box sx={{ flex: 1 }} />

            <Box sx={{ px: 2, mb: 0.5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <SajuTable pillars={pillars} unknownHour={resolved.hourUnknown} />
              {showCorrected && (
                <Typography sx={captionSx}>
                  진태양시 {String(chart.corrected!.hh).padStart(2, '0')}:{String(chart.corrected!.mm).padStart(2, '0')} (보정 {chart.corrected!.minutes}분 · {resolved.city})
                </Typography>
              )}
              {resolved.hourUnknown && <Typography sx={captionSx}>시간 모름 — 시주 없이 세 기둥으로 풀이</Typography>}
            </Box>

            <OhaengStrip ohaeng={ohaeng} total={ohaengTotal} />

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
                {!resolved.sample && (
                  /* 공유 2차 진입점 — CircleBtn 규격(44px 승급) 계승 */
                  <Box
                    onClick={onShare}
                    role="button"
                    aria-label="리포트 공유"
                    sx={{
                      ml: 'auto',
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      bgcolor: tokens.color.primarySoft,
                      color: tokens.color.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 17,
                      cursor: 'pointer',
                      flex: '0 0 auto',
                      transition: 'transform .12s var(--ease)',
                      '&:active': { transform: 'scale(0.98)' },
                    }}
                  >
                    {copied ? '✓' : '↗'}
                  </Box>
                )}
              </Box>
              {reading.dialogue.map((s) => (
                <Box key={s.label} sx={{ mb: 0.9 }}>
                  <Typography component="div" sx={{ fontSize: 13.5, color: tokens.color.ink, lineHeight: 1.5 }}>
                    <b>
                      {s.icon} {s.label}:
                    </b>{' '}
                    {s.lines.map((l, i) => (
                      <span key={i}>
                        {l}
                        {i < s.lines.length - 1 ? ' ' : ''}
                      </span>
                    ))}
                  </Typography>
                  {s.source && (
                    <Typography sx={{ fontSize: 10.5, color: tokens.color.inkFaint, mt: 0.3 }}>— 출처: {s.source.split(' · ')[0]}</Typography>
                  )}
                </Box>
              ))}
            </DialogueBox>
          </Box>
        </Box>

        {/* 리포트 시트 — 홈 콘텐츠 문법(SectionTitle + glass 카드) 계승 */}
        <Box sx={{ position: 'relative', zIndex: 3, bgcolor: 'var(--c-page)', px: 2.5, pb: 1 }}>
          {reading.cards.map((card) => (
            <ReportCard key={card.id} card={card} onFillHour={card.id === 'hour-unknown' ? () => nav('/input') : undefined} />
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
          {report && <DosaChat report={report} profileName={resolved.name || undefined} hourUnknown={resolved.hourUnknown} jeonggok={jeonggok} />}
        </Box>

        <Box sx={{ position: 'relative', zIndex: 3, bgcolor: 'var(--c-page)', px: 2.5, pb: 4 }}>
          {resolved.shared && (
            /* 공유 수신자 전환 CTA — 성장 루프의 끝단 */
            <Button fullWidth variant="contained" onClick={() => nav('/input')} sx={{ mt: 1, mb: 1 }}>
              내 사주도 풀어보기
            </Button>
          )}
          {!resolved.sample && (
            <Button fullWidth variant="outlined" onClick={onShare} sx={{ mt: resolved.shared ? 0 : 1 }}>
              {copied ? '링크를 복사했어요 ✓ — 카톡에 붙여넣기' : '리포트 공유하기'}
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
