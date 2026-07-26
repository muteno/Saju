import { useEffect, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import DialogueBox from './DialogueBox'
import PixelDosa, { type DosaMood } from './PixelDosa'
import OhaengTile from './OhaengTile'
import { Pict } from './MyeongShell'
import { tokens } from '../theme'
import { TOPICS, TOPIC_INTROS, TOPIC_FOCUS, topicLines, chartSummaryOf } from '../data/dosaTopics'
import type { DosaLine, Topic } from '../data/dosaTopics'
import { dosaModel } from '../data/prefs'
import type { JeonggokPick } from '../data/jeonggok'
import type { Pillar } from '../data/saju'
import type { ReportBundle } from '../engine'
import { useReducedMotion } from './Motion'

/**
 * 미연시 상담 무대 — 위에서부터 [도트 캐릭터 → 원국(항상 펼침) → 글라스 선택지 → 대사 상자].
 * 운영자 260726 확정 문법: 캐릭터가 있고 그 아래 사주원국이 펼쳐져 있고, 그 아래 대화가
 * 그라데이션으로 이어진다. 설명 중 관련 기둥은 살짝 들려 올라온다(focus).
 * 선택지는 분류 키워드(일주론 따위) 없이 질문만 — 진입도 메뉴판이 아니라
 * 정곡이 있으면 「…때문에 왔지?」, 없으면 「뭐가 궁금해서 오셨는가?」로 연다.
 *
 * 연출 값 정본 = 머지된 플레이그라운드(public/reports/20260717_222938_dosa-talk-playground_v1.html):
 * 타이핑 28ms/자 · 본문 14.5px/1.62 · 선택지 gap·padding·radius · 누름 scale(0.98) · 的中 700ms.
 * LLM(/api/dosa) 성공 시 그 텍스트를 대사로, 실패·미설정 시 조용히 L3 폴백(완결 동작 원칙).
 */
const TYPE_MS = 28

function useTypewriter(text: string, speedMs: number) {
  const [n, setN] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    setN(0)
    if (!text) return
    // 모션 감소 = 한 글자씩 찍는 연출 자체를 건너뛴다(setInterval은 CSS 미디어쿼리가 못 잡는다)
    if (speedMs <= 0) {
      setN(text.length)
      return
    }
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

/**
 * /api/dosa 시도 — 200 & {text}만 채택, 그 외(에러·비200·타임아웃)는 null(조용한 폴백).
 * 프리페치(사용자 대기 없음)는 타임아웃을 길게 잡는다 — 선택 시점엔 이미 도착해 있는 게 목적.
 */
async function fetchDosaText(
  topic: string,
  report: ReportBundle,
  lines: DosaLine[],
  profileName?: string,
  timeoutMs = 5000,
): Promise<string | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch('/api/dosa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        topic,
        model: dosaModel(), // 설정에서 고른 응답 모델(소넷5/오퍼스5 빠름 — data/prefs.ts)
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

/** 시간 모름 자리 — 값을 날조하지 않는다(SajuTable UnknownTile 문법 계승, 46 타일) */
function UnknownMini() {
  return (
    <Box
      sx={{
        width: 46,
        height: 46,
        borderRadius: 1.5,
        bgcolor: 'var(--c-card)',
        border: `1.5px dashed ${tokens.color.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: tokens.color.inkFaint,
        fontSize: 18,
        fontWeight: 800,
      }}
    >
      ?
    </Box>
  )
}

/**
 * 무대 원국 — 년월일시 여덟 자를 항상 펼쳐 둔다(운영자: "말할 때 사주원국이 위에 떠 있어야").
 * 십성 행은 싣지 않는다 — 전문용어 나열이 싫다는 같은 지시의 축, 근거는 근거 보기에 있다.
 * focus 열은 살짝 들려 올라온다("관련 있는 부분이 조금 툭 튀어나오는 느낌").
 */
function VnChart({ pillars, unknownHour, focus }: { pillars: Pillar[]; unknownHour?: boolean; focus: string[] }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1.5, px: 2.5 }}>
      {pillars.map((p) => {
        const on = focus.includes(p.title)
        const unknown = unknownHour && p.title === '시'
        return (
          <Box
            key={p.title}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.7,
              transition: 'transform .3s var(--ease), filter .3s var(--ease)',
              ...(on && {
                // scale로 이웃과 겹칠 때 뒤 열(DOM 뒤쪽)이 위에 그려지는 것 방지
                position: 'relative',
                zIndex: 1,
                transform: 'translateY(-5px) scale(1.07)',
                filter: 'drop-shadow(0 8px 12px color-mix(in srgb, var(--c-primary) 28%, transparent))',
                animation: 'vn-popcol .32s var(--ease)',
              }),
              '@keyframes vn-popcol': {
                '0%': { transform: 'none' },
                '60%': { transform: 'translateY(-8px) scale(1.1)' },
                '100%': { transform: 'translateY(-5px) scale(1.07)' },
              },
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: on || p.isDayMaster ? tokens.color.primary : tokens.color.inkFaint }}>
              {p.title}
            </Typography>
            {unknown ? (
              <>
                <UnknownMini />
                <UnknownMini />
              </>
            ) : (
              <>
                <OhaengTile main={p.ganK} hanja={p.gan} polarity={p.ganPolarity} element={p.ganE} highlight={p.isDayMaster} size={46} />
                <OhaengTile main={p.jiK} hanja={p.ji} polarity={p.jiPolarity} element={p.jiE} size={46} />
              </>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

/** 글라스 선택지 — 분류 키워드 없이 질문만(운영자 260726). seen = 우측에 체크 픽토그램 */
function VnChoice({
  label,
  seen = false,
  delay,
  onClick,
}: {
  label: string
  seen?: boolean
  delay: number
  onClick: (e: { stopPropagation: () => void }) => void
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      className="msd-popin"
      style={{ animationDelay: `${delay}ms` }}
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        minHeight: 46,
        p: '12px 16px',
        borderRadius: '14px',
        // 유리 표면값만 계승하고 blur는 안 건다 — 선택지 5개가 각자 backdrop-filter를 들면
        // 화면에 유리 표면 7장(＋대사·네비)이라 모바일 컴포짓이 무겁다. 뒤가 그라데 배경이라
        // 채움+보더+인셋 하이라이트만으로 유리로 읽힌다(검토자 260726 지적 반영).
        bgcolor: 'var(--glass)',
        border: '1px solid var(--glass-line)',
        boxShadow: 'inset 0 1px 0 var(--glass-inset)',
        color: seen ? tokens.color.inkSub : tokens.color.ink,
        fontFamily: 'inherit',
        fontSize: 14.5,
        fontWeight: 700,
        lineHeight: 1.25,
        letterSpacing: 'var(--tracking)',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'border-color .15s, transform .12s var(--ease)',
        '&:hover': { borderColor: 'var(--accent)' },
        '&:active': { transform: 'scale(0.98)' },
      }}
    >
      <span>{label}</span>
      {seen && (
        <Box component="span" aria-label="이미 들은 이야기" sx={{ display: 'flex', color: tokens.color.inkFaint, flex: '0 0 auto' }}>
          {Pict.check(14)}
        </Box>
      )}
    </Box>
  )
}

export default function DosaChat({
  report,
  pillars,
  profileName,
  hourUnknown,
  jeonggok,
}: {
  report: ReportBundle
  /** 무대에 항상 펼쳐 둘 원국(UiChart.pillars — 시일월년 순 = SajuTable과 동일) */
  pillars: Pillar[]
  profileName?: string
  hourUnknown?: boolean
  /** 정곡 오프닝 — 도사가 먼저 맞히는 단정(엔진 결정론 선별, data/jeonggok.ts) */
  jeonggok?: JeonggokPick | null
}) {
  const [phase, setPhase] = useState<'opening' | 'verdict' | 'choose' | 'play'>(jeonggok ? 'opening' : 'choose')
  const [verdictText, setVerdictText] = useState('')
  const [verdictHit, setVerdictHit] = useState(false)
  const [crit, setCrit] = useState(false) // 的中 크리티컬 연출(700ms — 플레이그라운드 D.critMs 정본)
  const [seq, setSeq] = useState<DosaLine[]>([])
  const [idx, setIdx] = useState(0)
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set())
  const [topicKey, setTopicKey] = useState<string | null>(null) // 무대 포커스(관련 기둥)용
  const [hop, setHop] = useState(0) // 캐릭터 폴짝
  const topicRef = useRef<string | null>(null) // LLM 응답 도착 시 아직 같은 주제인지 검증
  const idxRef = useRef(0) // 인트로를 지나쳤으면 늦게 온 LLM 응답은 버림(대사 점프 방지)
  const stageRef = useRef<HTMLDivElement | null>(null) // 덜컹 연출 대상
  // 선반응 캐시(운영자 260726 "다음 말 뉘앙스를 반쯤 생각") — 주제별 LLM 응답을 미리 받아 둔다.
  // 값: 진행 중 promise + 완료 시 text(성공 문자열/실패 null). 리포트가 바뀌면 통째로 리셋.
  const llmCache = useRef<Map<string, { promise: Promise<string | null>; text?: string | null }>>(new Map())
  const reduceMotion = useReducedMotion()

  /** 주제 응답을 캐시에서 얻거나 지금 발사(1회만) — 프리페치·실선택이 같은 경로를 쓴다.
   *  키에 모델을 포함 = 설정에서 모델을 바꾼 직후 옛 모델 응답을 주지 않는다. */
  const ensureLlm = (topicKey: string) => {
    const key = `${dosaModel()}:${topicKey}`
    const hit = llmCache.current.get(key)
    if (hit) return hit
    const fallback = topicLines(report, topicKey, hourUnknown)
    const entry: { promise: Promise<string | null>; text?: string | null } = {
      promise: fetchDosaText(topicKey, report, fallback, profileName, 20000).then((text) => {
        entry.text = text
        return text
      }),
    }
    llmCache.current.set(key, entry)
    return entry
  }

  /**
   * 화면 덜컹 — key 리마운트가 아니라 WAAPI로 튼다(리마운트는 근거 <details> 접힘·연출
   * 재생성 부작용, 검토자 260726 지적). step-end 이징 = 프레임이 뚝뚝 끊기는 8비트 감.
   * ⚠ WAAPI는 전역 reduced-motion CSS 블록 밖이라 JS 가드를 직접 건다.
   */
  const rumble = (kind: 'jolt' | 'shake') => {
    if (reduceMotion) return
    const amp = kind === 'shake' ? [-6, 3, 6, -3, -4, 2, 3, -1] : [-4, 2, 4, -2, -2, 1, 0, 0]
    stageRef.current?.animate(
      [
        { transform: 'translate(0,0)', easing: 'step-end' },
        { transform: `translate(${amp[0]}px,${amp[1]}px)`, easing: 'step-end' },
        { transform: `translate(${amp[2]}px,${amp[3]}px)`, easing: 'step-end' },
        { transform: `translate(${amp[4]}px,${amp[5]}px)`, easing: 'step-end' },
        { transform: `translate(${amp[6]}px,${amp[7]}px)`, easing: 'step-end' },
        { transform: 'translate(0,0)' },
      ],
      { duration: kind === 'shake' ? 480 : 320 },
    )
  }

  // 다른 사주(리포트)로 바뀌면 처음부터
  useEffect(() => {
    setPhase(jeonggok ? 'opening' : 'choose')
    setVerdictText('')
    setVerdictHit(false)
    setCrit(false)
    setSeq([])
    setIdx(0)
    idxRef.current = 0
    topicRef.current = null
    setTopicKey(null)
    setSeen(new Set())
    setHop(0)
    llmCache.current = new Map()
  }, [report, jeonggok])

  // 정곡 단정이 착지하는 순간 화면이 한 번 덜컹 — "잠깐 —"의 무게
  useEffect(() => {
    if (phase === 'opening') rumble('jolt')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // 선반응 프리페치 — 선택지가 뜨는 순간(사용자가 읽고 고르는 동안) 미본 주제의 응답을
  // 미리 생성해 둔다(250ms 시차 = 동시 폭주 방지). 탭 시점엔 대개 이미 도착 = 즉답.
  useEffect(() => {
    if (phase !== 'choose') return
    const timers = TOPICS.filter((t) => !llmCache.current.has(`${dosaModel()}:${t.key}`)).map((t, i) =>
      setTimeout(() => ensureLlm(t.key), i * 250),
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const openingText = jeonggok ? `잠깐 — 판을 보자마자 걸리는 게 하나 있군.\n\n${jeonggok.line}\n\n${jeonggok.ask}` : ''
  // 메뉴판 화법 금지(운영자 260726) — 첫 진입은 용건을 묻고, 한 바퀴 돈 뒤엔 다음 궁금증을 묻는다.
  // 정곡 문답을 이미 거쳤으면 초면 인사("오셨는가")를 되풀이하지 않는다(검토자 지적).
  const chooseText = seen.size ? '또 궁금한 것이 있는가?' : jeonggok ? '뭐가 궁금한가?' : '뭐가 궁금해서 오셨는가?'
  const line = phase === 'play' ? seq[idx] : undefined
  // 모션 감소면 속도 0 = 타이핑 연출을 건너뛰고 전문을 즉시 보여준다
  const tw = useTypewriter(
    phase === 'play' ? (line?.text ?? '') : phase === 'opening' ? openingText : phase === 'verdict' ? verdictText : chooseText,
    reduceMotion ? 0 : TYPE_MS,
  )

  // 정곡 답 처리 — 的中은 크리티컬, 부정은 리커버리(계산은 안 굽히고, 시기 사건은 접는다 — 플레이그라운드 확정 문법)
  const onJeonggokAnswer = (hit: boolean) => {
    if (!jeonggok) return
    setVerdictHit(hit)
    if (hit) {
      setCrit(true)
      setTimeout(() => setCrit(false), 700)
      rumble('shake')
      setHop((h) => h + 1)
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

  const toLlmLines = (text: string): DosaLine[] =>
    text
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => ({ text: p }))

  const selectTopic = (t: Topic) => {
    const fallback = topicLines(report, t.key, hourUnknown)
    const intro = TOPIC_INTROS[t.key]
    const entry = ensureLlm(t.key)
    // 프리페치가 이미 끝났으면 LLM 대사로 바로 시작(선반응 적중 = 대기 0),
    // 아니면 L3 조립 대사로 먼저 시작하고 도착 시 교체(기존 문법 그대로)
    const llmReady = typeof entry.text === 'string' && entry.text ? toLlmLines(entry.text) : null
    const base: DosaLine[] = llmReady ?? fallback
    const seqInit = intro ? [{ text: intro }, ...base] : base
    topicRef.current = t.key
    setTopicKey(t.key)
    setSeq(seqInit)
    setIdx(0)
    idxRef.current = 0
    setPhase('play')
    setHop((h) => h + 1)
    setSeen((prev) => new Set(prev).add(t.key))
    if (!llmReady)
      void entry.promise.then((text) => {
        if (!text || topicRef.current !== t.key || idxRef.current > 0) return
        const llmLines = toLlmLines(text)
        if (!llmLines.length) return
        setSeq(intro ? [{ text: intro }, ...llmLines] : llmLines)
      })
  }

  const onTap = () => {
    if (!tw.done) {
      tw.skip() // 탭 = 즉시 전체 표시
      return
    }
    if (phase === 'verdict') {
      setPhase('choose') // 판정 대사 → 용건 묻기
      return
    }
    if (phase !== 'play') return
    if (idx + 1 < seq.length) {
      idxRef.current = idx + 1
      setIdx(idx + 1)
    } else {
      topicRef.current = null
      setTopicKey(null)
      setPhase('choose') // 시퀀스 끝 → 다음 궁금증 묻기
    }
  }

  // 무대 포커스 — 말하는 내용과 관련된 기둥만 들어 올린다
  const focus: string[] =
    phase === 'opening' || phase === 'verdict'
      ? (jeonggok?.focus ?? [])
      : phase === 'play' && topicKey
        ? (TOPIC_FOCUS[topicKey] ?? [])
        : []

  const mood: DosaMood = crit
    ? 'happy'
    : phase === 'opening'
      ? 'shock'
      : phase === 'verdict'
        ? verdictHit
          ? 'happy'
          : 'hmm'
        : 'idle'
  const talking = !tw.done

  const choices =
    phase === 'opening' && tw.done && jeonggok
      ? [
          { key: 'yes', label: '그… 맞아', seen: false, onPick: () => onJeonggokAnswer(true) },
          { key: 'no', label: '아니, 딱히?', seen: false, onPick: () => onJeonggokAnswer(false) },
        ]
      : phase === 'choose' && tw.done
        ? TOPICS.map((t) => ({ key: t.key, label: t.label, seen: seen.has(t.key), onPick: () => selectTopic(t) }))
        : []

  return (
    <Box onClick={onTap} sx={{ cursor: 'pointer', position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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

      {/* 무대 전체가 덜컹 — WAAPI 1회 재생(오프닝 착지 jolt · 的中 shake), DOM은 그대로 */}
      <Box
        ref={stageRef}
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 캐릭터 — 무대 중앙 */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.5 }}>
          <PixelDosa mood={mood} talking={talking} hopKey={hop} />
        </Box>

        {/* 원국 — 캐릭터 아래 항상 펼침, 관련 기둥은 살짝 부상 */}
        <VnChart pillars={pillars} unknownHour={hourUnknown} focus={focus} />

        {/* 선택지 — 원국 아래 글라스(운영자: "사주 봐주는 사람 아래로 글라스 느낌으로 선택지") */}
        {choices.length > 0 && (
          <Box sx={{ px: 2.5, mt: 2, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {choices.map((c, i) => (
              <VnChoice
                key={c.key}
                label={c.label}
                seen={c.seen}
                delay={i * 45}
                onClick={(e) => {
                  e.stopPropagation()
                  c.onPick()
                }}
              />
            ))}
          </Box>
        )}

        {/* 대화 — 그라데이션 바닥에서 피어오른다(운영자: "그 아래에 대화가 그라데이션으로") */}
        <Box
          sx={{
            mt: 'auto',
            pt: 5,
            pb: '76px', // 하단 알약 네비(bottom 14 + h52) 회피
            background:
              'linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--c-primary-soft) 55%, transparent) 30%, var(--c-primary-soft) 100%)',
          }}
        >
          <DialogueBox next={(phase === 'play' || phase === 'verdict') && tw.done}>
            {/* 진행 표지 + 주제 복귀 — play 중에만 (mini 11px 하한) */}
            {phase === 'play' && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.2, mb: 0.4 }}>
                <Box
                  component="span"
                  onClick={(e) => {
                    e.stopPropagation()
                    topicRef.current = null
                    setTopicKey(null)
                    setPhase('choose')
                  }}
                  sx={{ fontSize: 11, fontWeight: 700, color: tokens.color.inkFaint, cursor: 'pointer', py: 1, my: -1 }}
                >
                  다른 이야기
                </Box>
                <Box component="span" sx={{ fontSize: 11, fontWeight: 700, color: tokens.color.inkFaint }}>
                  {idx + 1}/{seq.length}
                </Box>
              </Box>
            )}
            {/* 본문 — 14.5px / 1.62 (플레이그라운드 .line 정본) */}
            <Box sx={{ fontSize: 14.5, lineHeight: 1.62, color: tokens.color.ink, whiteSpace: 'pre-line', minHeight: 66 }}>{tw.shown}</Box>

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
          </DialogueBox>
        </Box>
      </Box>
    </Box>
  )
}
