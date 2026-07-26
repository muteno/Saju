/**
 * 리포트 3화면(인트로·분석·상담)이 나눠 쓰는 표시 부품.
 * 260725 3분할 때 Result.tsx에서 그대로 옮겼다 — 값·마크업 변경 0(§B1 계승).
 */
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { tokens } from '../theme'
import { todayKST, type UiChart } from '../engine'
import type { OhaengStat, ReadingCard } from '../data/saju'
import { gapjaByGanji } from '../data/gapja'
import OhaengTile from './OhaengTile'

const verdictColor = { 부족: tokens.color.inkSub, 적정: 'var(--oh-label-mok)', 발달: tokens.color.primary, 과다: tokens.color.solar }
const OH_LABEL: Record<string, string> = {
  목: 'var(--oh-label-mok)', 화: 'var(--oh-label-hwa)', 토: 'var(--oh-label-to)', 금: 'var(--oh-label-geum)', 수: 'var(--oh-label-su)',
}

export function SectionTitle({ children, align }: { children: ReactNode; align?: 'left' | 'center' }) {
  return <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.color.ink, mb: 1.2, mt: 2.5, textAlign: align ?? 'left' }}>{children}</Typography>
}

/**
 * 보조 버튼 — h52 · r14 · 17/700 · 글래스(목업 v2 규격). 주동작(코발트 contained)의 형제.
 * 3분할로 Home.tsx가 없어지면서 여기로 옮겼다 — 마크업·값 변경 0.
 */
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

/**
 * 오행 세그먼트 바 — 한 줄을 **개수 비율대로 분할**해 편중을 한눈에 보인다(운영자 260726 레퍼런스 = 경로 카드 문법).
 *
 * 왜 바꿨나: 기존 `OhaengStrip`은 5칸 **균등 폭**이라 화 0개와 수 3개가 같은 넓이를 차지했다 —
 * 정작 사주에서 제일 중요한 '편중'이 안 보였다.
 *
 * 0개 처리(F2안): 0인 오행도 **빗금 최소 조각으로 바에 남긴다**. 목화토금수 순서가 항상 고정돼
 * 매일 보는 화면에서 위치가 학습되고, 결핍이 '빠진 것'이 아니라 '비어 있는 자리'로 읽힌다.
 * (0을 빼는 안은 비율이 정직한 대신 오행 순서가 사람마다 달라져 기각.)
 *
 * 색은 전량 오행 의미색 계승 — 채움 = `tokens.ohaeng[].bg`, 글자 = `.ink`, 빈 칸 = 중립 토큰.
 */
export function OhaengSegBar({ ohaeng, total }: { ohaeng: OhaengStat[]; total: number }) {
  const counts = ohaeng.map((o) => ({ ...o, n: Math.round((o.pct * total) / 100) }))
  const empty = counts.filter((o) => o.n === 0)
  return (
    <Box>
      <Box sx={{ display: 'flex', height: 40, borderRadius: 100, overflow: 'hidden', boxShadow: 'inset 0 1px 2px var(--line)' }}>
        {counts.map((o) => {
          const zero = o.n === 0
          return (
            <Box
              key={o.key}
              // 0칸도 자리를 갖되(순서 학습) 가장 좁게 — 1개짜리의 약 절반
              sx={{
                flex: zero ? 0.55 : o.n,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.4,
                fontSize: 12,
                fontWeight: 800,
                color: zero ? tokens.color.inkFaint : tokens.ohaeng[o.key].ink,
                background: zero
                  ? `repeating-linear-gradient(45deg, var(--c-border) 0 4px, var(--c-page) 4px 8px)`
                  : tokens.ohaeng[o.key].bg,
                '& + &': { boxShadow: 'inset 1.5px 0 0 var(--c-card)' },
              }}
            >
              {zero ? (
                <span>0</span>
              ) : (
                <>
                  {o.key}
                  <span style={{ opacity: 0.85, fontSize: 11, fontWeight: 700 }}>{o.n}</span>
                </>
              )}
            </Box>
          )
        })}
      </Box>
      {/* 판정(과다·부족)은 바 안에 못 넣는다 — 좁은 칸에서 잘린다. 특이 판정만 아래 한 줄로 */}
      <Box sx={{ display: 'flex', gap: 1.2, mt: 0.9, flexWrap: 'wrap' }}>
        {empty.map((o) => (
          <Typography key={o.key} sx={{ fontSize: 11, fontWeight: 700, color: OH_LABEL[o.key] }}>
            {o.key} 없음
          </Typography>
        ))}
        {counts
          .filter((o) => o.verdict === '과다')
          .map((o) => (
            <Typography key={o.key} sx={{ fontSize: 11, fontWeight: 700, color: tokens.color.solar }}>
              {o.key} {o.n}개 · 과다
            </Typography>
          ))}
      </Box>
    </Box>
  )
}

/**
 * 오행 스트립(구안) — 불투명 카드 + 바 길이 = 비율 인코딩 + 개수·판정 결합.
 * bare=카드 껍데기(배경·그림자·바깥 여백) 없이 상위 카드 안에 담기는 모드(260726 원국 카드 통합).
 * ※ 인트로는 `OhaengSegBar`로 옮겼다. 이 부품은 분석 화면 등 5축 판정을 다 보여야 하는 자리용으로 남긴다.
 */
export function OhaengStrip({ ohaeng, total, bare = false }: { ohaeng: OhaengStat[]; total: number; bare?: boolean }) {
  return (
    <Box
      sx={
        bare
          ? { display: 'flex', gap: 0.75 }
          : { mx: 2.5, mb: 1, px: 1.5, py: 1, borderRadius: '16px', display: 'flex', gap: 0.75, bgcolor: tokens.color.card, boxShadow: 'var(--shadow-card)' }
      }
    >
      {ohaeng.map((o) => {
        const count = Math.round((o.pct * total) / 100)
        return (
          <Box key={o.key} sx={{ flex: 1, textAlign: 'center' }}>
            <Box sx={{ height: 5, borderRadius: 3, bgcolor: tokens.color.border, mb: 0.6, overflow: 'hidden' }}>
              <Box sx={{ width: `${Math.min(100, o.pct * 2)}%`, height: '100%', borderRadius: 3, bgcolor: tokens.ohaeng[o.key].bg }} />
            </Box>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: OH_LABEL[o.key], lineHeight: 1 }}>{o.key}</Typography>
            <Typography sx={{ fontSize: 11, color: verdictColor[o.verdict], fontWeight: 700 }}>
              {count}개 · {o.verdict}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

/** 대운 흐름 가로 레일 — 간·지 모두 OhaengTile(원국표와 같은 계층=같은 문법), 현재 대운 하이라이트 */
export function DaeunRail({ daeun, birthYear }: { daeun: UiChart['daeun']; birthYear: number }) {
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
      <Typography sx={{ fontSize: 11, color: tokens.color.inkSub, mb: 1 }}>
        간지가 {daeun.forward ? '순서대로 도는 순행' : '거꾸로 도는 역행'} · 좌우로 넘겨 보세요
      </Typography>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          pb: 0.5,
          // 페이드 28px — 14px은 너무 좁아 첫·마지막 타일이 '반쪽으로 잘린 것'처럼 보였다(260725 실측).
          maskImage: 'linear-gradient(90deg, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%)',
          WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%)',
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
              <Typography sx={{ fontSize: 11, fontWeight: active ? 800 : 600, color: active ? tokens.color.primary : tokens.color.inkSub }}>
                {it.age}세 · {birthYear + it.age}
              </Typography>
              <OhaengTile main={it.name[0]} hanja={g?.hanja[0] ?? ''} polarity={g && !g.yin ? '+' : '-'} element={g?.element ?? '토'} size={38} highlight={active} showPolarity={false} />
              <OhaengTile main={it.name[1]} hanja={g?.hanja[1] ?? ''} polarity={it.jiPolarity} element={it.jiE} size={38} highlight={active} showPolarity={false} />
              <Typography sx={{ fontSize: 11, color: active ? tokens.color.inkSub : tokens.color.inkFaint, lineHeight: 1.2, textAlign: 'center' }}>
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
export function ReportCard({ card, onFillHour }: { card: ReadingCard; onFillHour?: () => void }) {
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
              // HIG 탭 타깃 하한 44 — 전엔 26px였다(260725 실측)
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: tokens.minTap,
              mt: 1.2,
              px: 1.6,
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
            {open ? '접기' : `더 보기 (+${card.blocks.length - 2})`}
          </Box>
        )}
        {card.note && <Typography sx={{ fontSize: 11.5, color: tokens.color.inkSub, mt: 1.2 }}>{card.note}</Typography>}
        {card.id === 'hour-unknown' && onFillHour && (
          <Button variant="outlined" size="small" onClick={onFillHour} sx={{ mt: 1.2, py: 1, minHeight: tokens.minTap, fontSize: 14 }}>
            출생 시간 입력하러 가기
          </Button>
        )}
        {card.id === 'ennea' && (
          <Button variant="outlined" size="small" component="a" href="/enneagram/" target="_blank" rel="noopener" sx={{ mt: 1.2, py: 1, minHeight: tokens.minTap, fontSize: 14 }}>
            에니어그램 테스트로 검증하러 가기
          </Button>
        )}
        {docs.length > 0 && (
          <Typography sx={{ fontSize: 11, color: tokens.color.inkFaint, mt: 1.4 }}>— 출처: {docs.join(' · ')}</Typography>
        )}
      </Box>
    </Box>
  )
}
