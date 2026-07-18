import { useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'
import DialogueBox from './DialogueBox'
import { tokens } from '../theme'
import { TOPICS, TOPIC_INTROS, topicLines, chartSummaryOf } from '../data/dosaTopics'
import type { DosaLine, Topic } from '../data/dosaTopics'
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
  useEffect(() => {
    setN(0)
    if (!text) return
    let i = 0
    const timer = setInterval(() => {
      i += 1
      if (i >= text.length) {
        setN(text.length)
        clearInterval(timer)
      } else {
        setN(i)
      }
    }, speedMs)
    return () => clearInterval(timer)
  }, [text, speedMs])
  return {
    shown: text.slice(0, n),
    done: n >= text.length,
    skip: () => setN(text.length),
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
}: {
  report: ReportBundle
  profileName?: string
  hourUnknown?: boolean
}) {
  const [phase, setPhase] = useState<'choose' | 'play'>('choose')
  const [seq, setSeq] = useState<DosaLine[]>([])
  const [idx, setIdx] = useState(0)
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set())
  const topicRef = useRef<string | null>(null) // LLM 응답 도착 시 아직 같은 주제인지 검증
  const idxRef = useRef(0) // 인트로를 지나쳤으면 늦게 온 LLM 응답은 버림(대사 점프 방지)

  // 다른 사주(리포트)로 바뀌면 처음부터
  useEffect(() => {
    setPhase('choose')
    setSeq([])
    setIdx(0)
    idxRef.current = 0
    topicRef.current = null
    setSeen(new Set())
  }, [report])

  const line = phase === 'play' ? seq[idx] : undefined
  const tw = useTypewriter(phase === 'play' ? (line?.text ?? '') : CHOOSE_INTRO, TYPE_MS)

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
    <Box onClick={onTap} sx={{ cursor: 'pointer' }}>
      <DialogueBox speaker="아이샤" next={phase === 'play' && tw.done}>
        {/* 본문 — 14.5px / 1.62 (플레이그라운드 .line 정본) */}
        <Box sx={{ fontSize: 14.5, lineHeight: 1.62, color: tokens.color.ink, whiteSpace: 'pre-line', minHeight: 66 }}>
          {tw.shown}
        </Box>

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
                  transition: 'border-color .15s, background .15s, transform .15s',
                  '&:hover': { borderColor: 'var(--accent)' },
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
