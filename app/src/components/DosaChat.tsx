import { useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import DialogueBox from './DialogueBox'
import { tokens } from '../theme'
import { TOPICS, TOPIC_INTROS, topicLines, chartSummaryOf } from '../data/dosaTopics'
import type { DosaLine, Topic } from '../data/dosaTopics'
import type { JeonggokPick } from '../data/jeonggok'
import type { ReportBundle } from '../engine'

/**
 * 미연시 대화 패널 — 아이샤가 주제 선택지 → 근거 대사 시퀀스를 타이프라이터로 출력.
 * 값 정본 = 머지된 플레이그라운드(public/reports/20260717_222938_dosa-talk-playground_v1.html):
 * 타이핑 28ms/자 · 본문 14.5px/1.62 · 선택지 gap 7px·padding 11px 14px·radius 12 · mini 9px · 누름 scale(0.98).
 * LLM(/api/dosa) 성공 시 그 텍스트를 대사로, 실패·미설정 시 조용히 L3 폴백(완결 동작 원칙).
 */
const TYPE_MS = 28
const CHOOSE_INTRO = '궁금한 걸 골라 보게.'

function useTypewriter(text: string, speedMs: number) {
  const [n, setN] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    setN(0)
    if (!text) return
    let i = 0
    timerRef.current = setInterval(() => {
      i += 1
      if (i >= text.length) {
        setN(text.length)
        if (timerRef.current) clearInterval(timerRef.current)
      } else {
        setN(i)
      }
    }, speedMs)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [text, speedMs])
  return {
    shown: text.slice(0, n),
    done: n >= text.length,
    // 스킵 = 타이머까지 사살 — 안 죽이면 다음 틱이 부분 텍스트로 되돌려 스킵이 무효(260718 실측 버그)
    skip: () => {
      if (timerRef.current) clearInterval(timerRef.current)
      setN(text.length)
    },
  }
}

/** /api/dosa 시도 — 200 & {text}만 채택, 그 외(에러·비200·5초 타임아웃)는 null(조용한 폴백) */
async function fetchDosaText(
  topic: string,
  report: ReportBundle,
  lines: DosaLine[],
  profileName?: string,
): Promise<string | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  try {
    const res = await fetch('/api/dosa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        topic,
        chartSummary: chartSummaryOf(report),
        grounds: lines.map((l) => ({ text: l.text, grounds: l.grounds ?? [] })),
        ...(profileName ? { profileName } : {}),
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const data: unknown = await res.json()
    const text = (data as { text?: unknown } | null)?.text
    return typeof text === 'string' && text.trim() ? text : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export default function DosaChat({
  report,
  profileName,
  hourUnknown,
  jeonggok,
}: {
  report: ReportBundle
  profileName?: string
  hourUnknown?: boolean
  /** 정곡 오프닝 — 도사가 먼저 맞히는 단정(엔진 결정론 선별, data/jeonggok.ts) */
  jeonggok?: JeonggokPick | null
}) {
  const [phase, setPhase] = useState<'opening' | 'verdict' | 'choose' | 'play'>(jeonggok ? 'opening' : 'choose')
  const [verdictText, setVerdictText] = useState('')
  const [crit, setCrit] = useState(false) // 的中 크리티컬 연출(700ms — 플레이그라운드 D.critMs 정본)
  const [seq, setSeq] = useState<DosaLine[]>([])
  const [idx, setIdx] = useState(0)
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set())
  const topicRef = useRef<string | null>(null) // LLM 응답 도착 시 아직 같은 주제인지 검증
  const idxRef = useRef(0) // 인트로를 지나쳤으면 늦게 온 LLM 응답은 버림(대사 점프 방지)

  // 다른 사주(리포트)로 바뀌면 처음부터
  useEffect(() => {
    setPhase(jeonggok ? 'opening' : 'choose')
    setVerdictText('')
    setCrit(false)
    setSeq([])
    setIdx(0)
    idxRef.current = 0
    topicRef.current = null
    setSeen(new Set())
  }, [report, jeonggok])

  const openingText = jeonggok ? `잠깐 — 판을 보자마자 걸리는 게 하나 있군.\n\n${jeonggok.line}` : ''
  const line = phase === 'play' ? seq[idx] : undefined
  const tw = useTypewriter(
    phase === 'play' ? (line?.text ?? '') : phase === 'opening' ? openingText : phase === 'verdict' ? verdictText : CHOOSE_INTRO,
    TYPE_MS,
  )

  // 정곡 답 처리 — 的中은 크리티컬, 부정은 리커버리(계산은 안 굽히고, 시기 사건은 접는다 — 플레이그라운드 확정 문법)
  const onJeonggokAnswer = (hit: boolean) => {
    if (!jeonggok) return
    if (hit) {
      setCrit(true)
      setTimeout(() => setCrit(false), 700)
      setVerdictText('그럴 줄 알았지. 판에 그려진 걸 그대가 살아냈을 뿐이야.\n\n자, 이제 제대로 보자.')
    } else {
      setVerdictText(
        jeonggok.layer === 'EVENT'
          ? '흠 — 그럼 그 시기 이야긴 접어두지. 흐름은 사람마다 다르게 오니까.\n\n다른 데부터 보자.'
          : '흠 — 계산은 분명 그렇게 나와 있어. 아직 그 기운을 안 쓰고 살았거나, 다르게 눌러 담았을 수도 있지.\n\n이야기를 듣다 보면 알게 될 거야.',
      )
    }
    setPhase('verdict')
  }

  const selectTopic = (t: Topic) => {
    const fallback = topicLines(report, t.key, hourUnknown)
    const intro = TOPIC_INTROS[t.key]
    const base: DosaLine[] = intro ? [{ text: intro }, ...fallback] : fallback
    topicRef.current = t.key
    setSeq(base)
    setIdx(0)
    idxRef.current = 0
    setPhase('play')
    setSeen((prev) => new Set(prev).add(t.key))
    void fetchDosaText(t.key, report, fallback, profileName).then((text) => {
      if (!text || topicRef.current !== t.key || idxRef.current > 0) return
      const paras = text
        .split(/\n{2,}/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (!paras.length) return
      const llmLines: DosaLine[] = paras.map((p) => ({ text: p }))
      setSeq(intro ? [{ text: intro }, ...llmLines] : llmLines)
    })
  }

  const onTap = () => {
    if (!tw.done) {
      tw.skip() // 탭 = 즉시 전체 표시
      return
    }
    if (phase === 'verdict') {
      setPhase('choose') // 판정 대사 → 주제 선택
      return
    }
    if (phase !== 'play') return
    if (idx + 1 < seq.length) {
      idxRef.current = idx + 1
      setIdx(idx + 1)
    } else {
      topicRef.current = null
      setPhase('choose') // 시퀀스 끝 → 선택지 재노출
    }
  }

  return (
    <Box onClick={onTap} sx={{ cursor: 'pointer', position: 'relative' }}>
      {/* 的中 크리티컬 — 60px/900 #b0402b 스케일인 0.7s (플레이그라운드 정본 연출) */}
      {crit && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            fontSize: 60,
            fontWeight: 900,
            color: '#b0402b',
            textShadow: '0 2px 18px rgba(176,64,43,0.35)',
            animation: 'critIn .7s var(--ease) both',
            '@keyframes critIn': {
              '0%': { transform: 'scale(1.8)', opacity: 0 },
              '35%': { transform: 'scale(1)', opacity: 1 },
              '100%': { transform: 'scale(1)', opacity: 1 },
            },
          }}
        >
          的中
        </Box>
      )}
      <DialogueBox speaker="아이샤" next={(phase === 'play' || phase === 'verdict') && tw.done}>
        {/* 진행 표지 + 주제 복귀 — play 중에만 (mini 9px 토큰 계승) */}
        {phase === 'play' && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.2, mb: 0.4 }}>
            <Box
              component="span"
              onClick={(e) => {
                e.stopPropagation()
                topicRef.current = null
                setPhase('choose')
              }}
              sx={{ fontSize: 9, fontWeight: 700, color: tokens.color.inkFaint, cursor: 'pointer', py: 1, my: -1 }}
            >
              ‹ 주제로
            </Box>
            <Box component="span" sx={{ fontSize: 9, fontWeight: 700, color: tokens.color.inkFaint }}>
              {idx + 1}/{seq.length}
            </Box>
          </Box>
        )}
        {/* 본문 — 14.5px / 1.62 (플레이그라운드 .line 정본) */}
        <Box sx={{ fontSize: 14.5, lineHeight: 1.62, color: tokens.color.ink, whiteSpace: 'pre-line', minHeight: 66 }}>
          {tw.shown}
        </Box>

        {/* 정곡 답변지 — [맞아/아니야] (플레이그라운드 .choice 정본 규격) */}
        {phase === 'opening' && tw.done && jeonggok && (
          <Box sx={{ mt: 1.25, display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {[
              { label: '그… 맞아', mini: '的中?', hit: true },
              { label: '아니, 딱히?', mini: '분기', hit: false },
            ].map((c) => (
              <Box
                key={c.label}
                component="button"
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onJeonggokAnswer(c.hit)
                }}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  p: '11px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--c-border)',
                  bgcolor: 'var(--c-card)',
                  color: c.hit ? tokens.color.ink : tokens.color.inkSub,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: 'var(--tracking)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'border-color .15s, background .15s, transform .12s var(--ease)',
                  '&:hover': { borderColor: 'var(--accent)', bgcolor: 'color-mix(in srgb, var(--accent) 6%, var(--c-card))' },
                  '&:active': { transform: 'scale(0.98)' },
                }}
              >
                <span>{c.label}</span>
                <Box component="span" sx={{ fontSize: 9, fontWeight: 700, color: tokens.color.inkFaint, flex: '0 0 auto' }}>
                  {c.mini}
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {/* 정곡 근거 — 엔진 판정 명시(콜드리딩과 가르는 선) */}
        {(phase === 'opening' || phase === 'verdict') && tw.done && jeonggok && (
          <Box
            component="details"
            onClick={(e) => e.stopPropagation()}
            sx={{
              mt: 1,
              fontSize: 11,
              '& > summary': {
                cursor: 'pointer',
                color: tokens.color.inkFaint,
                fontWeight: 700,
                listStyle: 'none',
                minHeight: 24,
                display: 'flex',
                alignItems: 'center',
                '&::-webkit-details-marker': { display: 'none' },
                '&::before': { content: '"▸ "', color: tokens.color.accent },
              },
              '&[open] > summary::before': { content: '"▾ "' },
            }}
          >
            <Box component="summary">근거 보기</Box>
            <Box sx={{ mt: 0.75, p: '8px 10px', bgcolor: 'var(--c-page)', borderRadius: '8px', color: tokens.color.inkSub, lineHeight: 1.5 }}>
              — 엔진 판정: {jeonggok.evid} (임팩트 {jeonggok.impact})
            </Box>
          </Box>
        )}

        {/* 근거줄 — 기본 닫힘 <details> (플레이그라운드 .grounds 정본) */}
        {phase === 'play' && tw.done && !!line?.grounds?.length && (
          <Box
            component="details"
            onClick={(e) => e.stopPropagation()}
            sx={{
              mt: 1,
              mb: 0.25,
              fontSize: 11,
              '& > summary': {
                cursor: 'pointer',
                color: tokens.color.inkFaint,
                fontWeight: 700,
                listStyle: 'none',
                minHeight: 24,
                display: 'flex',
                alignItems: 'center',
                '&::-webkit-details-marker': { display: 'none' },
                '&::before': { content: '"▸ "', color: tokens.color.accent },
              },
              '&[open] > summary::before': { content: '"▾ "' },
            }}
          >
            <Box component="summary">근거 보기</Box>
            <Box
              sx={{
                mt: 0.75,
                p: '8px 10px',
                bgcolor: 'var(--c-page)',
                borderRadius: '8px',
                color: tokens.color.inkSub,
                lineHeight: 1.5,
              }}
            >
              {line.grounds.map((g, i) => (
                <Box key={i}>
                  — {g.doc} · {g.title}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* 주제 선택지 — 세로 리스트 (플레이그라운드 .choices/.choice 정본 · MUI Button 비사용) */}
        {phase === 'choose' && tw.done && (
          <Box sx={{ mt: 1.25, display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {TOPICS.map((t) => (
              <Box
                key={t.key}
                component="button"
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  selectTopic(t)
                }}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  p: '11px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--c-border)',
                  bgcolor: 'var(--c-card)',
                  color: tokens.color.ink,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: 'var(--tracking)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'border-color .15s, background .15s, transform .12s var(--ease)',
                  '&:hover': { borderColor: 'var(--accent)', bgcolor: 'color-mix(in srgb, var(--accent) 6%, var(--c-card))' },
                  '&:active': { transform: 'scale(0.98)' },
                }}
              >
                <span>{t.label}</span>
                <Box component="span" sx={{ fontSize: 9, fontWeight: 700, color: tokens.color.inkFaint, flex: '0 0 auto' }}>
                  {seen.has(t.key) ? '다시 보기' : t.mini}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </DialogueBox>
    </Box>
  )
}
