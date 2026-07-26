import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import PixelDosa, { type DosaMood } from './PixelDosa'
import MiniChart from './MiniChart'
import ShopStage from './ShopStage'
import { Pict } from './MyeongShell'
import { tokens } from '../theme'
import { TOPICS, TOPIC_INTROS, TOPIC_FOCUS, topicLines, chartSummaryOf } from '../data/dosaTopics'
import type { DosaLine, Topic } from '../data/dosaTopics'
import { dosaModel } from '../data/prefs'
import { chefForGender, counterpartChef, BARGE_LINE, voiceOf } from '../data/chefs'
import type { JeonggokPick } from '../data/jeonggok'
import type { Pillar } from '../data/saju'
import type { ReportBundle } from '../engine'
import { useReducedMotion } from './Motion'

/**
 * 상담 = **메신저**(운영자 260726 · YETA 캐릭터챗 문법 계승).
 *
 * > "질문은 메세지 안에 통으로 들어가는게 아니라, 이름은 제외하고, 메세지 하나당 하나씩,
 * >  예타에 있는 캐릭터가 메세지 나한테 보내는 느낌으로 물어봐야 해. 그 다음에 내가 대답하는 거고."
 *
 * 그래서 대사창(한 상자에 전문) → **말풍선 로그**로 바꿨다. 한 말풍선 = 한 마디, 질문은 그 자체로
 * 하나의 메시지, 내가 고른 답은 내 말풍선으로 로그에 남는다(대화가 쌓이는 게 보인다).
 * 화자 이름표는 뗀다 — 무대에 인물이 서 있으니 누가 말하는지는 그림이 말한다.
 *
 * 값 계승: 말풍선 표면 = `.glass`(YETA `.yb.ai`가 글래스인 것과 같은 축) · 내 말풍선 = `--c-primary`
 * (YETA `--bubble-me` = 브랜드색과 동형) · 꼬리쪽 모서리만 각지게(YETA `border-top-*-radius:--r-s`).
 * 타이핑 28ms·的中 700ms 등 연출 값은 플레이그라운드 정본 그대로.
 */
const TYPE_MS = 28

interface Msg {
  who: 'ai' | 'me'
  text: string
}

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
  chefId: string,
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
        chefId, // 무대에 선 화자 — 서버가 chefs.ts PERSONA를 시스템 프롬프트에 합성
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

/** 문단 분해 — 한 문단 = 한 말풍선(운영자 "메세지 하나당 하나씩") */
const toMsgs = (text: string): string[] =>
  text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)

/** 말풍선 — 캐릭터(좌·글래스) / 나(우·강조색). 이름표 없음(무대의 인물이 화자다) */
function Bubble({ who, children }: { who: 'ai' | 'me'; children: ReactNode }) {
  const me = who === 'me'
  return (
    <Box
      className={me ? 'msd-popin' : 'glass msd-popin'}
      sx={{
        alignSelf: me ? 'flex-end' : 'flex-start',
        maxWidth: '82%',
        p: '10px 13px',
        borderRadius: '16px',
        ...(me
          ? { borderTopRightRadius: '6px', bgcolor: tokens.color.primary, color: tokens.color.onPrimary }
          : { borderTopLeftRadius: '6px', color: tokens.color.ink }),
        fontSize: 14.5,
        lineHeight: 1.62,
        letterSpacing: 'var(--tracking)',
        whiteSpace: 'pre-line',
        wordBreak: 'break-word',
      }}
    >
      {children}
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
        // 유리 표면값만 계승하고 blur는 안 건다 — 선택지가 각자 backdrop-filter를 들면 화면에
        // 유리 표면이 여러 장이라 모바일 컴포짓이 무겁다(검토자 260726 지적 반영).
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
  gender,
}: {
  report: ReportBundle
  /** 좌상단 미니 명식에 박히는 원국(UiChart.pillars — 시일월년 순) */
  pillars: Pillar[]
  profileName?: string
  hourUnknown?: boolean
  /** 정곡 오프닝 — 도사가 먼저 맞히는 단정(엔진 결정론 선별, data/jeonggok.ts) */
  jeonggok?: JeonggokPick | null
  /** 상담 상대의 성별 — 무대에 서는 도사를 가른다(운영자 260726) */
  gender?: 'M' | 'F'
}) {
  const [chef, setChef] = useState(() => chefForGender(gender))
  const [barge, setBarge] = useState(false) // 난입 연출 1회(등장 애니 트리거)
  /** 대화 로그 — 위에서 아래로 쌓인다(질문이 위에 남는다) */
  const [log, setLog] = useState<Msg[]>([])
  /** 아직 안 뜬 캐릭터 메시지 — 탭할 때마다 하나씩 로그로 내려온다 */
  const [queue, setQueue] = useState<string[]>([])
  /** 지금 무엇을 물을 차례인가 — 정곡 답변지 / 주제 메뉴 / 이야기 재생 */
  const [stage, setStage] = useState<'jeonggok' | 'menu' | 'play'>(jeonggok ? 'jeonggok' : 'menu')
  const [crit, setCrit] = useState(false) // 的中 크리티컬 연출(700ms — 플레이그라운드 D.critMs 정본)
  const [mood, setMood] = useState<DosaMood>('idle')
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set())
  const [topicKey, setTopicKey] = useState<string | null>(null)
  const [hop, setHop] = useState(0) // 캐릭터 폴짝
  const topicRef = useRef<string | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null) // 덜컹 연출 대상
  const logRef = useRef<HTMLDivElement | null>(null) // 로그 스크롤러
  const llmCache = useRef<Map<string, { promise: Promise<string | null>; text?: string | null }>>(new Map())
  const reduceMotion = useReducedMotion()

  /** 캐릭터 메시지 묶음을 흘려보낸다 — 첫 줄은 바로 뜨고 나머지는 탭을 기다린다 */
  const say = (msgs: string[]) => {
    if (!msgs.length) return
    setLog((l) => [...l, { who: 'ai', text: msgs[0] }])
    setQueue(msgs.slice(1))
  }
  const answer = (text: string) => setLog((l) => [...l, { who: 'me', text }])

  /** 주제 응답을 캐시에서 얻거나 지금 발사(1회만) — 키 = 모델:화자:주제 */
  const ensureLlm = (key2: string) => {
    const key = `${dosaModel()}:${chef.id}:${key2}`
    const hit = llmCache.current.get(key)
    if (hit) return hit
    const fallback = topicLines(report, key2, hourUnknown)
    const entry: { promise: Promise<string | null>; text?: string | null } = {
      promise: fetchDosaText(key2, report, fallback, chef.id, profileName, 20000).then((text) => {
        entry.text = text
        return text
      }),
    }
    llmCache.current.set(key, entry)
    return entry
  }

  /**
   * 화면 덜컹 — WAAPI로 튼다(key 리마운트는 로그·접힘 상태를 날린다). step-end = 8비트 스냅.
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

  // 첫 대사 — 정곡이 있으면 [화자 인사 → 단정 → 질문] 세 통, 없으면 용건 묻기 한 통
  useEffect(() => {
    const c = chefForGender(gender)
    setChef(c)
    setBarge(false)
    setCrit(false)
    setMood(jeonggok ? 'shock' : 'idle')
    setSeen(new Set())
    setTopicKey(null)
    topicRef.current = null
    llmCache.current = new Map()
    setStage(jeonggok ? 'jeonggok' : 'menu')
    const v = voiceOf(c.id)
    const first = jeonggok ? [v.opening, jeonggok.line, jeonggok.ask] : ['뭐가 궁금해서 오셨는가?']
    setLog([{ who: 'ai', text: first[0] }])
    setQueue(first.slice(1))
    rumble('jolt')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, jeonggok, gender])

  const last = log[log.length - 1]
  const typing = last?.who === 'ai' ? last.text : ''
  const tw = useTypewriter(typing, reduceMotion ? 0 : TYPE_MS)
  const idle = tw.done && queue.length === 0 // 말이 끝났고 남은 메시지도 없다 = 내 차례

  // 새 말풍선·타이핑을 따라 로그가 아래로 흐른다(메신저 관례)
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log, tw.shown, stage])

  // 선반응 프리페치 — 내 차례(메뉴)일 때 미본 주제를 미리 생성해 둔다(250ms 시차)
  useEffect(() => {
    if (stage !== 'menu' || !idle) return
    const timers = TOPICS.filter((t) => !llmCache.current.has(`${dosaModel()}:${chef.id}:${t.key}`)).map((t, i) =>
      setTimeout(() => ensureLlm(t.key), i * 250),
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, idle, chef.id])

  const onJeonggokAnswer = (hit: boolean, label: string) => {
    if (!jeonggok) return
    answer(label)
    if (hit) {
      setCrit(true)
      setMood('happy')
      setTimeout(() => setCrit(false), 700)
      rumble('shake')
      setHop((h) => h + 1)
      setStage('menu')
      say([...toMsgs(voiceOf(chef.id).hit), '그래서, 뭐가 궁금한가?'])
    } else {
      // 빗맞힘 = 사과가 아니라 **교체**(운영자 260726) — 맞은편 도사가 밀고 들어와 판을 받아 간다
      const next = counterpartChef(chef.id)
      setChef(next)
      setBarge(true)
      setMood('hmm')
      setStage('menu')
      say([BARGE_LINE[next.id], ...toMsgs(voiceOf(next.id).miss), '그래서, 뭐가 궁금한가?'])
    }
  }

  const selectTopic = (t: Topic) => {
    const fallback = topicLines(report, t.key, hourUnknown)
    const intro = TOPIC_INTROS[t.key]
    const entry = ensureLlm(t.key)
    const ready = typeof entry.text === 'string' && entry.text ? toMsgs(entry.text) : null
    answer(t.label)
    topicRef.current = t.key
    setTopicKey(t.key)
    setStage('play')
    setMood('idle')
    setBarge(false)
    setHop((h) => h + 1)
    setSeen((prev) => new Set(prev).add(t.key))
    // 프리페치 적중 = LLM 대사로 바로, 미도착 = L3 조립 대사로 먼저 시작(완결 동작 원칙)
    say([...(intro ? [intro] : []), ...(ready ?? fallback.map((l) => l.text))])
    if (!ready)
      void entry.promise.then((text) => {
        if (!text || topicRef.current !== t.key) return
        // 늦게 온 LLM 응답은 **남은 분량만** 교체한다(이미 읽은 말풍선은 건드리지 않는다)
        setQueue((q) => (q.length ? toMsgs(text).slice(-q.length) : q))
      })
  }

  const onTap = () => {
    if (!tw.done) {
      tw.skip()
      return
    }
    if (queue.length) {
      setLog((l) => [...l, { who: 'ai', text: queue[0] }])
      setQueue((q) => q.slice(1))
      return
    }
    // 이야기 한 바퀴가 끝나면 다시 메뉴로 — 질문도 한 통의 메시지다
    if (stage === 'play') {
      setStage('menu')
      setTopicKey(null)
      topicRef.current = null
      say(['또 궁금한 것이 있는가?'])
    }
  }

  // 미니 명식 포커스 — 지금 말하는 내용이 짚는 기둥
  const focus: string[] =
    stage === 'jeonggok' ? (jeonggok?.focus ?? []) : stage === 'play' && topicKey ? (TOPIC_FOCUS[topicKey] ?? []) : []

  const choices =
    !idle
      ? []
      : stage === 'jeonggok' && jeonggok
        ? [
            { key: 'yes', label: '그… 맞아', seen: false, onPick: () => onJeonggokAnswer(true, '그… 맞아') },
            { key: 'no', label: '아니, 딱히?', seen: false, onPick: () => onJeonggokAnswer(false, '아니, 딱히?') },
          ]
        : stage === 'menu'
          ? TOPICS.map((t) => ({ key: t.key, label: t.label, seen: seen.has(t.key), onPick: () => selectTopic(t) }))
          : []

  return (
    <Box onClick={onTap} sx={{ cursor: 'pointer', position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* 的中 크리티컬 — 60px/900 스케일인 0.7s (플레이그라운드 정본 연출) */}
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

      <Box ref={stageRef} sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* 인물 — 흐름 밖 절대 레이어. 말풍선이 그 앞을 흐른다(유리라 실루엣이 비친다) */}
        <Box aria-hidden sx={{ position: 'absolute', left: 0, right: 0, top: 0, height: 300, pointerEvents: 'none', zIndex: 0 }}>
          <ShopStage
            chef={chef}
            enter={barge ? 'right' : 'none'}
            height={300}
            bare
            fallback={<PixelDosa mood={mood} talking={!tw.done} hopKey={hop} width={112} />}
          />
        </Box>

        {/* 미니 명식 — 좌측 상단 표식(운영자: 사용자는 사실 볼 필요 없게) */}
        <Box sx={{ position: 'relative', zIndex: 1, px: 2, pt: 0.5 }}>
          <MiniChart pillars={pillars} unknownHour={hourUnknown} focus={focus} />
        </Box>

        {/* 대화 로그 — 위에서 아래로 쌓이고, 넘치면 아래로 흐른다 */}
        <Box
          ref={logRef}
          sx={{
            position: 'relative',
            zIndex: 1,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            px: 2,
            pt: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {log.map((m, i) => (
            <Bubble key={i} who={m.who}>
              {i === log.length - 1 && m.who === 'ai' ? tw.shown : m.text}
            </Bubble>
          ))}
          {/* 아직 할 말이 남았다 = 다음 메시지 대기(탭하면 온다) */}
          {tw.done && queue.length > 0 && (
            <Box aria-hidden sx={{ alignSelf: 'flex-start', color: tokens.color.inkFaint, display: 'flex', animation: 'bob 1.1s ease-in-out infinite', '@keyframes bob': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(3px)' } } }}>
              {Pict.chevronDown(18)}
            </Box>
          )}
        </Box>

        {/* 내 차례 — 답을 고른다(고른 답은 내 말풍선으로 로그에 남는다) */}
        {choices.length > 0 && (
          <Box sx={{ position: 'relative', zIndex: 1, px: 2, pt: 1, pb: '76px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
        {choices.length === 0 && <Box sx={{ flex: '0 0 auto', height: 76 }} />}
      </Box>
    </Box>
  )
}
