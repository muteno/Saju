import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import MiniChart from './MiniChart'
import { Pict } from './MyeongShell'
import { tokens } from '../theme'
import type { OhaengKey } from '../theme'
import { TOPICS, TOPIC_INTROS, TOPIC_FOCUS, topicLines, chartSummaryOf } from '../data/dosaTopics'
import type { DosaLine, Topic } from '../data/dosaTopics'
import { dosaModel } from '../data/prefs'
import { chefForGender, counterpartChef, nextChef, bargeLineOf, voiceOf } from '../data/chefs'
import type { Chef } from '../data/chefs'
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
/**
 * 프레임 844에서 [상태바+표제 ~92]·[네비 76]·[입력창 ~60]을 빼면 약 616이 남고,
 * 그중 300을 대화가 쓰고 나머지 위쪽은 **배경 인물이 보이는 자리**로 비워 둔다.
 */
/**
 * 대화 구역 높이 — **화면 중앙부에서 시작해 아래로** 흐른다(운영자 260727:
 * "사람이 가려지면 안되네, 중앙부 부터 대화가 내려가게 하자").
 * 프레임 844에서 입력행(하단 ~80)을 빼고 역산하면 이 높이의 윗변이 대략 화면 절반이다 —
 * 인물의 **얼굴은 그 위**라 안 가린다. 상자 높이는 고정이라 대화는 위→아래로만 채워진다.
 */
const LOG_H = 330
/** 자유 질문 길이 상한 — 서버(functions/api/dosa.ts MAX_QUESTION)와 같은 값 */
const MAX_ASK = 300

/**
 * 기운 색 — 원국 여덟 자의 오행을 세어 **감싸는 색**을 고른다(운영자 260727).
 * · 한 기운이 뚜렷하면 그 색 하나로 감싼다
 * · 1·2위가 비슷하면(차이 1 이하) **두 색까지 섞는다** — 세 개 넘게 섞으면 그냥 무지개가 된다
 * 색은 오행 라벨 토큰(`--oh-label-*`) 계승 = 신규 색 0.
 */
const OH_VAR: Record<OhaengKey, string> = {
  목: 'var(--oh-label-mok)',
  화: 'var(--oh-label-hwa)',
  토: 'var(--oh-label-to)',
  금: 'var(--oh-label-geum)',
  수: 'var(--oh-label-su)',
}
function auraColors(pillars: Pillar[]): string[] {
  const n = new Map<OhaengKey, number>()
  for (const p of pillars) {
    for (const el of [p.ganE, p.jiE]) if (el) n.set(el, (n.get(el) ?? 0) + 1)
  }
  const rank = [...n.entries()].sort((a, b) => b[1] - a[1])
  if (!rank.length) return [OH_VAR.금]
  const top = rank[0]
  const second = rank[1]
  return second && top[1] - second[1] <= 1 ? [OH_VAR[top[0]], OH_VAR[second[0]]] : [OH_VAR[top[0]]]
}

/**
 * 채팅 표면 = **예타 값 그대로**(운영자 260727 "그냥 예타에 있는 값을 그대로 가져오는게 어때?").
 * 예타 실측: `.yb.ai` = `background: var(--glass-2)`(**완전 투명**) + `blur(--blur-m = 29px) saturate(1)`
 * + `1px solid var(--glass-line)`(= 흰색 알파 .08).
 * ⚠ 여기 알파는 **불투명도**다(투명도가 아니라 — 260727 운영자 주의). inset 림라이트는 **뺐다**(운영자 260727 "도형 위에도 하이라이트 준 거 같은데? 그럴 필요 있음?") —
 * 채움이 0인 유리에 흰 선을 두 겹(테두리+림) 두르면 그 자체가 밝은 판으로 읽힌다.
 * 알약(헤더·입력행) = `var(--glass)`(= 흰색 알파 .005) + `blur(--blur-l = 11px)`.
 *
 * ⚠ **값만 가져오면 안 된다** — 예타는 다크 테마라 글자가 흰색이다. 채움이 0인 유리에 우리 검정
 * 잉크를 얹으면 어두운 인물 컷 위에서 한 글자도 안 읽힌다. 그래서 **이 화면의 글자도 흰색**으로
 * 같이 가져온다(무대가 사진이라 이 화면만 다크로 읽히는 게 맞다).
 * rgba를 직접 쓰지 않고 `--c-card`(흰) color-mix 파생으로 적어 raw 증가 0.
 */
const YG = {
  // ⚠ 말풍선 채움은 **검정 베이스**다(운영자 260727 "대화창 자체의 불투명도를 검정색 베이스로
  // 만들어서 투명도를 올려봐"). 흰색에 알파를 주면 밝은 판이 되고, 흰 글자가 그 위에서 죽는다.
  // 검정 베이스면 뒤가 비치면서도 흰 글자가 뜬다 — 이게 예타 화면에서 보이는 그 결이다.
  bubbleBg: 'color-mix(in srgb, var(--c-ink) 22%, transparent)',
  pillBg: 'color-mix(in srgb, var(--c-ink) 18%, transparent)',
  line: 'color-mix(in srgb, var(--c-card) 8%, transparent)',
  // 스크롤 막대 — 말풍선과 같은 검정 베이스에서 한 단 더 내린 값(말풍선 22% → 12%).
  // "거의 투명해서 안 보이게"(운영자 260727)라 존재만 알리고 화면에선 물러난다.
  scroll: 'color-mix(in srgb, var(--c-ink) 12%, transparent)',
  blurBubble: 'blur(29px) saturate(1)',
  blurPill: 'blur(11px) saturate(1)',
  fg: 'var(--c-card)',
  fg2: 'color-mix(in srgb, var(--c-card) 90%, transparent)',
  mut: 'color-mix(in srgb, var(--c-card) 58%, transparent)',
} as const

/** 입력행 좌측 도크 = 상담을 뺀 나머지 메뉴(하단 알약 네비가 없으므로 여기가 이동 수단이다) */
const DOCK = [
  { to: '/result', label: '인트로', icon: Pict.chart(19) },
  { to: '/analysis', label: '분석', icon: Pict.taegeuk(19, true) },
  { to: '/fun', label: '재미', icon: Pict.heart(19) },
  { to: '/settings', label: '설정', icon: Pict.person(19) },
]

interface Msg {
  who: 'ai' | 'me'
  text: string
  /**
   * 지문 — **말이 아니라 하는 짓**(운영자 260727 "글자 위에 상황·생각·작업을 알려주는 걸
   * 대화창에서 실물로"). 미터줄이 한 줄로 요약해 주던 것을 대화 안에서 직접 보여준다.
   * 예타 `.yb i.yn` 문법 계승 = 같은 유리 말풍선에 **이탤릭 + 톤다운**.
   */
  narration?: true
}

/**
 * 시그니처 강조 — **한 말풍선에서 제일 중요한 한 구절**을 화자의 색으로 칠한다
 * (운영자 260727 "말 중에 제일 강조되는 말에 항상 그 인물의 시그니처 색을 넣어서 안 헷갈리게" ·
 * "밑줄친 부분이 시그니처 색으로 그 '사주를 보는 중입니다'처럼 나오게").
 *
 * 판정은 **결정론**이다(LLM에 마크업을 시키지 않는다 — 폴백 대사엔 마크업이 없어 두 경로가 갈린다).
 * 우선순위대로 첫 1건만 칠한다. 여러 군데를 칠하면 강조가 아니라 배경이 된다.
 *   ① 「」로 이미 묶인 말   ② 연도(20XX년)   ③ 사주 용어   ④ 없으면 **첫 문장**
 * ④가 있어서 용어 없는 대사("계산은 분명 그렇게 나와 있소")도 늘 한 구절은 칠해진다.
 */
const TERMS = [
  '비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인',
  '도화', '역마', '화개', '백호', '귀문', '공망', '원진', '천을귀인', '문창', '양인',
  '대운', '세운', '일주', '일간', '원국', '격국', '신강', '신약', '지장간', '삼합', '방합',
] as const
// 용어 뒤에 붙는 조사·꼬리 몇 자까지 함께 잡는다(「식신이」·「대운부터」) — 낱말이 잘려 보이지 않게
const TERM_RE = new RegExp(`(?:${TERMS.join('|')})[가-힣]{0,3}`)
const QUOTE_RE = /「[^」]{1,24}」/
const YEAR_RE = /\d{4}년[가-힣]{0,4}/
/** 첫 문장 — 뒤에 이어지는 말이 있을 때만 쓰는 폴백(아래 주석) */
const FIRST_RE = /^[^.?!…]{2,}[.?!…]/

function emphasisSpan(text: string): [number, number] | null {
  for (const re of [QUOTE_RE, YEAR_RE, TERM_RE]) {
    const m = re.exec(text)
    if (m && m[0].trim()) return [m.index, m.index + m[0].length]
  }
  /**
   * 용어가 하나도 없는 대사("계산은 분명 그렇게 나와 있소")도 한 구절은 칠해야 한다(운영자
   * 260727 밑줄 예시가 정확히 그런 문장이었다) → 첫 문장을 쓴다.
   * ⚠ 단 **뒤에 다른 문장이 남아 있을 때만**이다. 한 문장짜리 짧은 말까지 칠하면 260727 실측처럼
   * 말풍선 넷이 전부 색으로 덮여 "제일 강조되는 말"이 아니라 그냥 배경이 된다.
   */
  const m = FIRST_RE.exec(text)
  if (m && text.slice(m[0].length).trim().length >= 2) return [0, m[0].length]
  return null
}

/**
 * 강조 구간만 화자 색으로 갈아 끼운 조각들.
 * ⚠ 무대가 인물 **사진**이라 색 글자는 배경에 먹힌다(운영자 "뒷 배경에 안 가려지게") —
 * 미터줄과 같은 처리로 **어두운 그림자**를 깔아 대비를 세운다. 그림자 색도 잉크 토큰 파생이라 신규 색 0.
 */
const SIG_SHADOW = '0 1px 6px color-mix(in srgb, var(--c-ink) 72%, transparent)'
function withEmphasis(text: string, color: string): ReactNode {
  const span = emphasisSpan(text)
  if (!span) return text
  const [a, b] = span
  return (
    <>
      {text.slice(0, a)}
      {/* 미터줄과 **같은 빛 스윕**을 화자 색으로 훑는다(운영자 260727 "여기 있는 이 효과를 넣자") */}
      <Box
        component="span"
        className="msd-shim-sig"
        sx={{ '--shim-c': color, fontWeight: 800, textShadow: SIG_SHADOW }}
      >
        {text.slice(a, b)}
      </Box>
      {text.slice(b)}
    </>
  )
}

/** 지문 표기 — 이 접두가 붙은 줄은 말이 아니라 동작이다(큐를 통과해도 표시가 안 지워진다) */
const NAR = '\u200b' // 폭 0 문자라 화면엔 안 보이고 문자열에만 남는다
const nar = (t: string) => NAR + t
const isNar = (t: string) => t.startsWith(NAR)
const narText = (t: string) => t.slice(NAR.length)

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
  question?: string,
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
        ...(question ? { question } : {}),
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

/**
 * 말풍선 분해 — 운영자 "메세지 하나당 하나씩".
 *
 * ⚠ 문단(`\n{2,}`)으로만 자르면 **통짜 한 통**이 된다(검토자 260726 실측: LLM·L3 대사엔 빈 줄이
 * 거의 없어 두 문장이 한 말풍선에 들어갔다 — 운영자가 고치라고 한 게 정확히 그 "통으로"였다).
 * 그래서 문단을 먼저 자르고, 문장 경계(`.` `?` `!` `…`)로 한 번 더 쪼갠다.
 * 다만 **한 통 최대 2문장**으로 묶는다 — 한 문장씩 다 끊으면 짧은 토막이 우수수 쏟아져
 * 탭을 그만큼 더 해야 한다(메신저가 아니라 자막이 된다).
 */
const MAX_SENT = 2
const toMsgs = (text: string): string[] => {
  const out: string[] = []
  for (const para of text.split(/\n{2,}/)) {
    const body = para.trim()
    if (!body) continue
    // 문장 끝 부호 + 공백을 경계로 자른다(부호는 앞 문장에 남긴다)
    const sents = body.split(/(?<=[.?!…])\s+/).filter(Boolean)
    for (let i = 0; i < sents.length; i += MAX_SENT) out.push(sents.slice(i, i + MAX_SENT).join(' '))
  }
  return out
}

/** 말풍선 — 캐릭터(좌·글래스) / 나(우·강조색). 이름표 없음(무대의 인물이 화자다) */
function Bubble({
  who,
  narration,
  sig,
  lead,
  children,
  'aria-hidden': ariaHidden,
}: {
  who: 'ai' | 'me'
  /** 지문 = 말이 아니라 동작 — 예타 `.yb i.yn`(이탤릭 + 톤다운) 문법 계승 */
  narration?: true
  /** 지금 말하는 인물의 시그니처 색 */
  sig?: string
  /**
   * **전경째 시그니처 색**으로 칠하는 말풍선(운영자 260727 "심리상태 표기나, 핵심되는 마지막
   * 말풍선에 시그니처 색으로 전경을 칠하게"). 발동 = ①지문(심리·상황 표기) ②지금 말줄기의 끝말.
   * 나머지 말풍선은 흰 본문에 **한 구절만** 색이 들어간다(`withEmphasis`).
   */
  lead?: boolean
  children: ReactNode
  'aria-hidden'?: true
}) {
  const me = who === 'me'
  /** 기운 링을 두르는 말풍선인가 — 두르면 정렬·폭은 **바깥 링**이 맡는다 */
  const ringed = !me && lead && !!sig
  const bubble = (
    <Box
      className="msd-popin"
      sx={{
        // ⚠ 링을 두르면 **`position: relative`가 필수**다 — 링 두 겹이 absolute라, 정적 배치인
        // 말풍선은 그 아래로 깔려 화면엔 링 선만 남는다(260727 실측: 말풍선이 선 한 줄로 보였다).
        ...(ringed
          ? { maxWidth: '100%', position: 'relative', zIndex: 1 }
          : { alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '82%' }),
        p: '10px 13px',
        borderRadius: '14px',
        ...(me
          ? { borderTopRightRadius: '6px', bgcolor: tokens.color.primary, color: tokens.color.onPrimary }
          : {
              borderTopLeftRadius: '6px',
              // ⚠ 이 화면만 **글자가 흰색**이다 — 무대가 어두운 인물 사진이고 유리가 검정 베이스라
              // 검정 잉크는 한 글자도 안 읽힌다(260727 실측: 색이 잉크값 그대로 남아 있었다).
              color: YG.fg,
              // 예타 `.yb.ai` 값 그대로(YG 참조) — 채움 0 · 블러가 전부 · 라인 8% · inset 림.
              bgcolor: YG.bubbleBg,
              border: `1px solid ${YG.line}`,
              backdropFilter: YG.blurBubble,
              WebkitBackdropFilter: YG.blurBubble,
            }),
        fontSize: 14.5,
        lineHeight: 1.62,
        letterSpacing: 'var(--tracking)',
        whiteSpace: 'pre-line',
        wordBreak: 'break-word',
        // 지문은 여전히 기울임이되 **톤다운은 걷었다** — 이 줄이 곧 심리·상황 표기라
        // 시그니처 색으로 칠해질 자리다(흐려 놓으면 그 색이 안 보인다).
        ...(narration && { fontStyle: 'italic', color: YG.fg2, opacity: 0.92 }),
        // 전경 칠 — 사진 위라 색 글자는 그림자로 대비를 세운다(미터줄과 같은 처리)
        ...(!me && lead && sig && { fontWeight: 700, textShadow: SIG_SHADOW }),
      }}
      aria-hidden={ariaHidden}
    >
      {/* 화자 표지는 **낭독 전용** — 화면엔 이름표를 안 띄운다(운영자 "이름은 제외")지만,
          좌/우 정렬은 스크린리더에 전달되지 않아 도사 말과 내 답이 한 줄기로 섞여 읽힌다. */}
      <Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {me ? '나: ' : narration ? '(지문) ' : '도사: '}
      </Box>
      {/* ⚠ 스윕은 **안쪽 겹**이 든다 — `background-clip: text`를 말풍선 상자에 직접 걸면
          유리 채움까지 글자 모양으로 잘려 상자가 사라진다(미터줄에서 겪은 그 함정). */}
      {ringed ? (
        <Box component="span" className="msd-shim-sig" sx={{ '--shim-c': sig }}>
          {children}
        </Box>
      ) : (
        children
      )}
    </Box>
  )
  if (!ringed) return bubble
  /**
   * 기운 링 — **신원 도형(원국)에 두른 그 라인 그대로**를 말풍선에 옮긴 것
   * (운영자 260727 "맨 마지막 메세지에는 그 초록토끼 같이 겉에 강조 라인 들어가잖아 액션,
   *  그거 들어가게 해줄래? 근데 그거를 그 사주 풀어주는 사람의 강조색으로").
   * 구조도 같다: 1px 여백만 남긴 껍데기 → 색 밭(`.msd-aura`, 안 돈다) → 도는 빛(`.msd-sheen`) → 유리.
   * ⚠ 원국 링의 빛은 흰색이지만 여기선 **화자 색을 밝힌 것**으로 돈다 — 그게 이 지시의 요지다.
   */
  return (
    <Box
      sx={{
        alignSelf: 'flex-start',
        maxWidth: '82%',
        position: 'relative',
        borderRadius: '14px',
        borderTopLeftRadius: '6px',
        p: '1px', // 링 두께 = 이 여백만큼만 드러난다
        overflow: 'hidden',
        isolation: 'isolate',
      }}
    >
      <Box
        className="msd-aura"
        aria-hidden
        sx={{
          position: 'absolute',
          inset: '-60%',
          background: `conic-gradient(from 0deg, ${sig} 0deg, color-mix(in srgb, ${sig} 34%, transparent) 180deg, ${sig} 360deg)`,
          animation: 'msd-breathe 8s var(--ease) infinite',
        }}
      />
      <Box
        className="msd-sheen"
        aria-hidden
        sx={{
          position: 'absolute',
          inset: '-60%',
          background: `conic-gradient(from 0deg, transparent 0deg, transparent 56deg, color-mix(in srgb, ${sig} 22%, transparent) 73deg, color-mix(in srgb, var(--c-card) 45%, ${sig}) 90deg, color-mix(in srgb, ${sig} 22%, transparent) 107deg, transparent 124deg, transparent 360deg)`,
          animation: 'msd-orbit 5s linear infinite reverse',
        }}
      />
      {bubble}
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
        // 말풍선과 같은 유리 = 예타 값 그대로(YG).
        bgcolor: YG.bubbleBg,
        border: `1px solid ${YG.line}`,
        backdropFilter: YG.blurBubble,
        WebkitBackdropFilter: YG.blurBubble,
        color: seen ? YG.mut : YG.fg,
        fontFamily: 'inherit',
        fontSize: 14.5,
        fontWeight: 700,
        lineHeight: 1.25,
        letterSpacing: 'var(--tracking)',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'border-color .15s, transform .12s var(--ease)',
        '&:hover': { borderColor: YG.fg2 },
        '&:active': { transform: 'scale(0.98)' },
      }}
    >
      <span>{label}</span>
      {seen && (
        <Box component="span" aria-label="이미 들은 이야기" sx={{ display: 'flex', color: YG.mut, flex: '0 0 auto' }}>
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
  onChef,
  who,
  onNav,
  onBeat,
  switchSignal = 0,
  pouchSignal = 0,
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
  /** 화자가 정해지거나 바뀔 때 알린다 — 호출부가 배경(인물 컷)과 상단 헤더(이름·프사)를 갈아 끼운다 */
  onChef?: (chef: Chef) => void
  /** 좌상단 신원 두 줄 — 이름(별명) / 생년월일·시주 */
  who?: { name: string; born: string }
  /**
   * 지금 화자가 **무얼 하고 있나**를 한 줄로 알린다(운영자 260727 "행위자의 감정이나 열중하는
   * 작업 이런 것들이 간접적으로 나타나게"). 상단 미터줄이 이 문장을 빛 스윕으로 흘린다.
   */
  onBeat?: (text: string) => void
  /** 입력행 좌측 도크의 메뉴 이동(예타 `.ydock` 문법 — 하단 바가 곧 입력행이라 여기가 유일한 출구) */
  onNav?: (to: string) => void
  /**
   * 사람 바꾸기 신호 — 헤더 교체 버튼이 누를 때마다 1씩 올린다(운영자 260727 "누르면 사람
   * 바뀌게 · 화면 흔들리면서 이미지 바뀌고 대사 나오면 됨"). 값 자체는 뜻이 없고 **변한다는 것**만 읽는다.
   * 헤더는 이 컴포넌트 밖(Talk)에 있어 콜백을 거꾸로 받을 수 없다 — 그래서 신호를 내려받는다.
   */
  switchSignal?: number
  /**
   * 복채 주머니 신호 — 헤더 주머니 버튼(운영자 260727). **퀘스트 축은 아직 고민 중**이라
   * 지금은 화자가 주머니를 열어 보고 한마디 하는 것까지다("둘 다 그대로 동작").
   * 보상·퀘스트가 정해지면 이 자리에 얹으면 된다 — 버튼·배선·말자리는 이미 서 있다.
   */
  pouchSignal?: number
}) {
  const [chef, setChef] = useState(() => chefForGender(gender))
  /** 대화 로그 — 위에서 아래로 쌓인다(질문이 위에 남는다) */
  const [log, setLog] = useState<Msg[]>([])
  /** 아직 안 뜬 캐릭터 메시지 — 탭할 때마다 하나씩 로그로 내려온다 */
  const [queue, setQueue] = useState<string[]>([])
  /** 지금 무엇을 물을 차례인가 — 정곡 답변지 / 주제 메뉴 / 이야기 재생 */
  const [stage, setStage] = useState<'jeonggok' | 'menu' | 'play'>(jeonggok ? 'jeonggok' : 'menu')
  const [crit, setCrit] = useState(false) // 的中 크리티컬 연출(700ms — 플레이그라운드 D.critMs 정본)
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set())
  const [topicKey, setTopicKey] = useState<string | null>(null)
  const topicRef = useRef<string | null>(null)
  const readRef = useRef(0) // 지금 주제에서 이미 읽어 내린 말풍선 수(늦게 온 LLM 응답을 이어 붙일 지점)
  const [draft, setDraft] = useState('') // 입력창에 쓰는 중인 말
  const [asking, setAsking] = useState(false) // 자유 질문 왕복 중
  const stageRef = useRef<HTMLDivElement | null>(null) // 덜컹 연출 대상
  const logRef = useRef<HTMLDivElement | null>(null) // 로그 스크롤러
  const llmCache = useRef<Map<string, { promise: Promise<string | null>; text?: string | null }>>(new Map())
  const reduceMotion = useReducedMotion()

  /** 캐릭터 메시지 묶음을 흘려보낸다 — 첫 줄은 바로 뜨고 나머지는 탭을 기다린다 */
  const say = (msgs: string[]) => {
    if (!msgs.length) return
    setLog((l) => [...l, { who: 'ai', text: msgs[0], ...(isNar(msgs[0]) ? { narration: true as const } : {}) }])
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
    setCrit(false)
    setSeen(new Set())
    setTopicKey(null)
    topicRef.current = null
    llmCache.current = new Map()
    setStage(jeonggok ? 'jeonggok' : 'menu')
    onChef?.(c)
    const v = voiceOf(c.id)
    const first = jeonggok
      ? [nar('판을 펼쳐 손끝으로 짚어 내려간다.'), v.opening, jeonggok.line, jeonggok.ask]
      : [nar('찻잔을 내려놓고 고개를 든다.'), '뭐가 궁금해서 오셨는가?']
    setLog([{ who: 'ai', text: first[0], ...(isNar(first[0]) ? { narration: true as const } : {}) }])
    setQueue(first.slice(1))
    rumble('jolt')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, jeonggok, gender])

  const last = log[log.length - 1]
  const typing = last?.who === 'ai' ? last.text : ''
  const tw = useTypewriter(typing, reduceMotion ? 0 : TYPE_MS)
  const idle = tw.done && queue.length === 0 // 말이 끝났고 남은 메시지도 없다 = 내 차례

  /**
   * 새 말풍선을 따라 로그가 아래로 흐른다(메신저 관례).
   *
   * ⚠ 260727 운영자 지적: "말하다가 말이 계속 위에 했던 말로 포커싱이 튈 때가 있는데 항상
   * 포커싱은 마지막으로 가게 해줘." 원인 = 따라가는 조건이 「바닥에서 60px 안」 하나뿐이라,
   * **긴 말풍선 한 통이 들어오면 그 순간 60px을 넘겨** 그 뒤로는 영영 안 따라갔다(화면은 옛 말에
   * 멈춰 있고 새 말은 아래에서 혼자 쌓인다). 그래서 축을 둘로 나눈다:
   *   · **말풍선이 하나 늘었다** = 무조건 끝으로 간다(새 말이 곧 지금 봐야 할 것)
   *   · **같은 말풍선이 타이핑 중** = 바닥 근처일 때만(되읽으려 올려 둔 화면을 28ms마다
   *     도로 끌어내리지 않는다 — 검토자 260726이 잡은 그 축은 그대로 지킨다)
   */
  const logLenRef = useRef(0)
  useEffect(() => {
    const el = logRef.current
    if (!el) return
    const grew = log.length !== logLenRef.current
    logLenRef.current = log.length
    if (grew || el.scrollHeight - el.scrollTop - el.clientHeight < 60) el.scrollTop = el.scrollHeight
  }, [log, tw.shown, stage])

  /**
   * 선반응 프리페치 — 미본 주제를 미리 생성해 둔다(250ms 시차).
   * ⚠ 게이트가 `menu && idle`이던 때는 **정곡 국면 내내 한 건도 안 나갔다**(검토자 260726 적발):
   * 오프닝 3통을 다 탭해 메뉴가 뜨는 그 순간에야 발사되니 첫 주제는 거의 항상 폴백이었다.
   * 지금은 화면에 들어온 순간부터 굽는다 — 사용자가 정곡을 읽는 몇 초가 곧 생성 시간이다.
   * 풀이 중에는 안 건다(그때 필요한 건 이미 손에 있다).
   */
  useEffect(() => {
    if (stage === 'play') return
    const timers = TOPICS.filter((t) => !llmCache.current.has(`${dosaModel()}:${chef.id}:${t.key}`)).map((t, i) =>
      setTimeout(() => ensureLlm(t.key), i * 250),
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, chef.id])

  /**
   * 사람 바꾸기 — 헤더 교체 버튼(운영자 260727). 빗맞힘 교체와 **같은 문법**을 쓴다:
   * 흔들림 → 인물(=배경) 교체 → 지문 + 들어온 사람의 난입 대사. 사과나 설명 자막은 없다.
   * ⚠ 첫 렌더에는 안 돈다(신호 초기값) — 안 그러면 화면에 들어오자마자 사람이 바뀐다.
   */
  const firstSignal = useRef(true)
  useEffect(() => {
    if (firstSignal.current) {
      firstSignal.current = false
      return
    }
    const next = nextChef(chef.id)
    setChef(next)
    onChef?.(next)
    rumble('shake')
    readRef.current = 0
    topicRef.current = null
    setTopicKey(null)
    /**
     * ⚠ 연달아 누르면 **지문만 세 줄 쌓인다**(260727 실측): `say`는 첫 통만 로그에 넣고 나머지를
     * 큐로 미루는데, 큐를 비우기 전에 또 누르면 앞 사람의 난입 대사가 통째로 덮인다.
     * 그래서 **직전 줄이 같은 지문이면 지문을 건너뛴다** — 자리가 바뀌는 그림은 이미 봤으니까.
     */
    const ENTER = '자리를 물리자 다른 이가 판 앞에 앉는다.'
    const lastText = log[log.length - 1]?.text
    const head = lastText === nar(ENTER) ? [] : [nar(ENTER)]
    // 정곡을 아직 안 물었으면 그 국면을 지킨다(질문만 새 화자가 다시 던진다).
    // 풀이 중이었다면 앞 화자의 남은 말은 버리고 메뉴로 돌아간다 — 화자가 갈렸으니 그 풀이도 끝난 것.
    if (stage === 'jeonggok' && jeonggok) {
      say([...head, bargeLineOf(next.id), jeonggok.ask])
    } else {
      setStage('menu')
      say([...head, bargeLineOf(next.id), '그래서, 뭐가 궁금한가?'])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [switchSignal])

  /**
   * 복채 주머니 — 지금은 **열어 보는 것까지**다(퀘스트 미정). 말이 흐르는 중이면 끼어들지 않는다.
   * 국면(`stage`)은 건드리지 않는다 — 주머니는 곁가지라 대화 줄기를 끊으면 안 된다.
   */
  const firstPouch = useRef(true)
  useEffect(() => {
    if (firstPouch.current) {
      firstPouch.current = false
      return
    }
    say([nar('복채 주머니를 열어 보지만, 아직 든 것이 없다.'), '셈은 나중에 하지. 지금은 판이 먼저다.'])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pouchSignal])

  const onJeonggokAnswer = (hit: boolean, label: string) => {
    if (!jeonggok) return
    answer(label)
    if (hit) {
      setCrit(true)
      setTimeout(() => setCrit(false), 700)
      rumble('shake')
      setStage('menu')
      say([nar('입꼬리를 살짝 올린다.'), ...toMsgs(voiceOf(chef.id).hit), '그래서, 뭐가 궁금한가?'])
    } else {
      // 빗맞힘 = 사과가 아니라 **교체**(운영자 260726) — 맞은편 도사가 밀고 들어와 판을 받아 간다
      const next = counterpartChef(chef.id)
      setChef(next)
      onChef?.(next)
      setStage('menu')
      say([nar('자리를 물리자 다른 이가 판 앞에 앉는다.'), bargeLineOf(next.id), ...toMsgs(voiceOf(next.id).miss), '그래서, 뭐가 궁금한가?'])
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
    setSeen((prev) => new Set(prev).add(t.key))
    // 프리페치 적중 = LLM 대사로 바로, 미도착 = L3 조립 대사로 먼저 시작(완결 동작 원칙).
    // ⚠ **정제 안 된 발췌(raw)는 뺀다** — 그대로 읽으면 문서 제목이나 유튜브 채널 인사가
    // 도사 대사가 된다(260726 버그체킹 실측: "乙(을목)이란?", "…도화도르입니다").
    // 정제된 줄이 하나도 없으면 아는 척하지 않고 그렇게 말한다.
    const spoken = fallback.filter((l) => !l.raw).map((l) => l.text)
    say([
      nar('붓을 들어 판 위에 한 획을 긋는다.'),
      ...(intro ? [intro] : []),
      ...(ready ?? (spoken.length ? spoken : ['이 대목은 아직 내가 제대로 풀어 둔 게 없군. 분석 탭의 근거를 직접 보게.'])),
    ])
    readRef.current = 0
    if (!ready)
      void entry.promise.then((text) => {
        if (!text || topicRef.current !== t.key) return
        // ⚠ 앞서는 `slice(-남은개수)`로 **꼬리만** 갈아 끼웠는데, 그러면 LLM 문단이 남은 큐보다
        // 많을 때 **서두가 통째로 잘려 결론만** 남는다(검토자 260726 적발 — 폴백 2통 + 맥락 없는
        // LLM 결론 1통을 읽게 된다). 그래서 **읽은 개수만큼만** 건너뛰고 이어 붙인다.
        // 이미 LLM 분량보다 많이 읽었으면 갈아치우지 않는다(중간에 말이 되감기지 않게).
        const msgs = toMsgs(text)
        if (readRef.current >= msgs.length) return
        setQueue(msgs.slice(readRef.current))
      })
  }

  /**
   * 자유 질문 — 선택지 말고 **직접 쓴 말**을 보낸다(운영자 260726 "대화 쓸수있는 장소도 있어야함").
   * 내 말풍선을 먼저 찍고(보낸 게 눈에 보여야 한다), 답이 오면 말풍선으로 이어 붙인다.
   * LLM이 꺼져 있거나 실패하면 **조용히 실패로 두지 않고** 그 사실을 도사 입으로 말한다.
   */
  const askFree = async () => {
    const q = draft.trim()
    if (!q || asking) return
    setDraft('')
    setAsking(true)
    answer(q)
    setStage('play')
    setTopicKey(null)
    topicRef.current = null
    readRef.current = 0
    try {
      const text = await fetchDosaText(
        '성격', // 화이트리스트 자리채움 — 서버는 question이 있으면 그걸 먼저 읽는다
        report,
        topicLines(report, '성격', hourUnknown),
        chef.id,
        profileName,
        25000,
        q,
      )
      if (text) say(toMsgs(text))
      else say(['…지금은 판을 더 못 읽겠군. 잠시 뒤에 다시 물어보게.'])
    } finally {
      setAsking(false)
    }
  }

  /**
   * 상황 한 줄 — **직접 감정을 말하지 않고** 하는 짓으로 비춘다(간접 표현).
   * 정곡을 던지는 중 = 판을 짚는 손 · 답을 기다림 = 눈을 들어 봄 · 풀이 중 = 붓을 놀림 ·
   * 자유 질문 대기 = 판을 다시 들여다봄.
   */
  const beat = asking
    ? '판을 다시 들여다봅니다'
    : // ⚠ 정곡은 **타이핑 판정보다 먼저** 본다 — 이 국면은 늘 말이 흐르는 중이라
      // 뒤에 두면 「판을 짚어 내려갑니다」가 한 번도 안 뜬다(260727 실측).
      stage === 'jeonggok'
      ? '판을 짚어 내려갑니다'
      : queue.length || !tw.done
        ? '천천히 말을 고릅니다'
        : stage === 'play'
          ? '풀이를 이어갑니다'
          : '당신의 사주를 봅니다'
  useEffect(() => {
    onBeat?.(beat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat])

  const onTap = () => {
    if (!tw.done) {
      tw.skip()
      return
    }
    if (queue.length) {
      setLog((l) => [...l, { who: 'ai', text: queue[0], ...(isNar(queue[0]) ? { narration: true as const } : {}) }])
      setQueue((q) => q.slice(1))
      if (stage === 'play') readRef.current += 1
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

  /**
   * 미니 명식 포커스 — 지금 말하는 내용이 짚는 기둥.
   * `useMemo`로 identity를 고정한다 — 안 하면 타이프라이터가 28ms마다 새 배열을 만들어
   * MiniChart의 `memo`가 매번 뚫린다(검토자 260726 지적).
   */
  const focus: string[] = useMemo(
    () =>
      stage === 'jeonggok' ? (jeonggok?.focus ?? []) : stage === 'play' && topicKey ? (TOPIC_FOCUS[topicKey] ?? []) : [],
    [stage, jeonggok, topicKey],
  )

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

  /** 감싸는 기운 색 — 원국이 바뀌지 않으면 다시 세지 않는다 */
  const aura = useMemo(() => auraColors(pillars), [pillars])
  const a0 = `color-mix(in srgb, ${aura[0]} 78%, transparent)`
  const a1 = `color-mix(in srgb, ${aura[1] ?? aura[0]} 78%, transparent)`

  /** 다음 메시지가 남아 있나 — 진행 버튼을 띄울지 가른다 */
  const hasNext = !tw.done || queue.length > 0 || stage === 'play'

  return (
    <Box
      onClick={onTap}
      sx={{ cursor: 'pointer', position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
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
            // 창작색이던 것을 토큰 계승으로 되돌린다(제1핵심명령 ① 가장 가까운 토큰 자동 계승).
            // 그림자는 같은 토큰에서 color-mix로 파생 — 신규 색 0.
            color: 'var(--oh-label-hwa)',
            textShadow: '0 2px 18px color-mix(in srgb, var(--oh-label-hwa) 35%, transparent)',
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
        {/* 배경이 보이는 구역 — 인물은 **배경 그 자체**라 여기엔 아무것도 안 세운다.
            화면 위쪽은 통째로 인물 몫이고, 원국만 그 좌상단에 얹힌다. */}
        <Box sx={{ position: 'relative', flex: '1 1 auto', minHeight: 0 }}>
          {/* 신원 + 원국 = **한 유리 도형 안에 붙여서**(운영자 260727 "둘의 간격이 아주 멀어 거의
              둘이 붙어있게 · 글래스로 그 두개를 감싸줘 도형으로"). 좌우 끝에 떨어뜨려 놓으니
              두 개의 딴 물건으로 읽혔다 — 하나로 묶으면 「누구의 어떤 판인가」 한 덩어리가 된다.
              표면은 말풍선과 같은 유리(검정 베이스 + blur) · 낭독 대상에서는 뺀다. */}
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              right: 16, // 운영자 260727 — 도형 자체를 우측 정렬
              bottom: 30,
              zIndex: 2,
              borderRadius: '14px',
              p: '1px', // 테두리 두께 = 이 여백만큼만 기운 색이 드러난다
              overflow: 'hidden',
              isolation: 'isolate',
            }}
          >
            {/* 기운 테두리 — 원국 오행이 섞인 원뿔 그라데이션이 **시계 반대**로 돈다.
                흰색을 한 스톱 섞어 은은하게 디밍되고, 안쪽 유리 판이 가운데를 덮어 1px 링만 남는다. */}
            <Box
              className="msd-aura"
              sx={{
                position: 'absolute',
                inset: '-60%',
                // ⚠ **흰 스톱을 넣지 않는다** — 넣었더니 그게 두 번째 빛으로 읽혀 화면에서
                // 「빛이 여러 개로 쪼개져 움직인다」로 보였다(운영자 260727). 기운 링은 **색 밭**이고,
                // 도는 빛은 아래 `.msd-sheen` **하나뿐**이다.
                // 색이 둘이면 양쪽에서 만나 부드럽게 섞이도록 4스톱으로 순환시킨다(경계선 0).
                background:
                  aura.length > 1
                    ? `conic-gradient(from 0deg, ${a0} 0deg, ${a1} 120deg, ${a0} 240deg, ${a1} 300deg, ${a0} 360deg)`
                    : `conic-gradient(from 0deg, ${a0} 0deg, color-mix(in srgb, ${aura[0]} 34%, transparent) 180deg, ${a0} 360deg)`,
                // ⚠ **기운 링은 돌지 않는다.** 색 밭과 빛이 각각 다른 속도로 돌면 밝은 지점이 둘이 되어
                // 「빛이 여러 개로 쪼개져 움직인다」가 된다(운영자 260727 실사용 지적).
                // 기운은 그 사람의 판이라 제자리에 있는 게 맞고, 도는 건 아래 빛 **하나뿐**이다.
                animation: 'msd-breathe 8s var(--ease) infinite',   // 운영자 260727 플레이그라운드 채택값
              }}
            />
            {/* 겉 라인 빛 — 좁은 흰 호 하나가 링을 따라 돈다. 기운 링(16s reverse)과 **다른 속도·방향**
                이라 둘이 스칠 때만 잠깐 밝아진다(같은 속도면 두 겹이 붙어 다녀 굵은 링이 된다). */}
            <Box
              className="msd-sheen"
              sx={{
                position: 'absolute',
                inset: '-60%',
                // 빛은 **하나**다. 가장자리를 여러 단으로 떨어뜨려(56→76→90→104→124) 점이 아니라
                // 한 덩어리 glow로 읽히게 한다 — 딱 끊으면 조각처럼 보인다.
                // 운영자 260727 플레이그라운드 채택값 — 흰색 100% · 호 폭 ±34deg.
                // 가장자리는 폭의 절반 지점(±17deg)에서 한 단 떨어뜨려 한 덩어리 glow로 읽히게 한다.
                background:
                  'conic-gradient(from 0deg, transparent 0deg, transparent 56deg, color-mix(in srgb, var(--c-card) 22%, transparent) 73deg, var(--c-card) 90deg, color-mix(in srgb, var(--c-card) 22%, transparent) 107deg, transparent 124deg, transparent 360deg)',
                // 반시계(운영자 지시) — 이 화면에서 도는 유일한 것이다.
                animation: 'msd-orbit 5s linear infinite reverse',   // 운영자 260727 채택값
              }}
            />
            <Box
              sx={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                p: '8px 12px',
                borderRadius: '13px',
                bgcolor: YG.bubbleBg,
                backdropFilter: YG.blurBubble,
                WebkitBackdropFilter: YG.blurBubble,
              }}
            >
            {who && (
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 800, color: YG.fg, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                  {who.name}
                </Typography>
                <Typography sx={{ mt: 0.2, fontSize: 11.5, color: YG.fg2, opacity: 0.9, lineHeight: 1.35, whiteSpace: 'nowrap' }}>
                  {who.born}
                </Typography>
              </Box>
            )}
              <MiniChart pillars={pillars} unknownHour={hourUnknown} focus={focus} />
            </Box>
          </Box>
        </Box>

        {/* ── 하단 묶음 = [블라인더] 위에 [대화 → 선택지 → 입력창] ──
            ⚠ 처음엔 하단을 띠 하나로 덮었는데(블라인더), 레퍼런스(예타)엔 **그런 층이 없다** —
            유리는 **말풍선이 각자** 든다. 띠로 덮으면 인물이 통째로 뿌예지고 '판 한 장'이 된다
            (운영자 260727 "블러 처리만 하면되는데, 글래스모피즘 수준차이가 엄청나"). */}
        <Box sx={{ position: 'relative', flex: '0 0 auto', pb: '68px' }}>
        {/* 대화 로그 — 위에서 아래로 쌓이고, 넘치면 아래로 흐른다 */}
        <Box
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label="상담 대화"
          sx={{
            position: 'relative',
            zIndex: 1,
            // ⚠ **고정 높이**다. `maxHeight`로 두면 내용이 늘 때 상자가 **아래에서 위로 자라
            // 대화가 밑에서 솟는 것처럼** 보인다(운영자 260727 지적). 높이를 못 박아야
            // 위에서부터 아래로 채워지고, 넘치면 그 안에서 스크롤된다.
            flex: `0 0 ${LOG_H}px`,
            height: LOG_H,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            /**
             * 스크롤바 = **대화창과 같은 결**(운영자 260727 "스크롤 옆에 대화창이랑 분위기를
             * 동일하게 · 거의 투명해서 안 보이게"). 기본 스크롤바는 회색 트랙 + 화살표 두 개라
             * 무대 위에 OS 부품이 하나 얹힌 꼴이었다(260727 실측 스크린샷).
             * 값은 말풍선 토큰 계승 — 막대는 `YG.scroll`(잉크 베이스 12%), 트랙은 아예 없다.
             * ⚠ **접두 먼저·표준 나중**(22-ⓙ 함정): 크로뮴 121+는 표준 `scrollbar-*`가 이기고
             * 그 아래 버전·사파리는 `::-webkit-*`를 읽는다. 둘 다 적어야 어디서든 얇고 투명하다.
             */
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: YG.scroll, borderRadius: '999px' },
            '&::-webkit-scrollbar-button': { display: 'none', width: 0, height: 0 },
            scrollbarWidth: 'thin',
            scrollbarColor: `${YG.scroll} transparent`,
            px: 2,
            pt: 1.5,
            display: 'flex',
            flexDirection: 'column',
            // ⚠ **위에서부터 아래로** 쌓인다(운영자 260726 "대화 아래서부터 올라오는거 아냐,
            // 위에서부터 내려가지"). 앞서 하단 앵커를 썼다가 되돌린 자리다 —
            // 이제 대화 구역 자체가 중하단에 고정돼 있어 상단 정렬이어도 화면이 안 빈다.
            justifyContent: 'flex-start',
            gap: '8px',
          }}
        >
          {log.map((m, i) => {
            const typing = i === log.length - 1 && m.who === 'ai' && !tw.done
            const shown = typing ? tw.shown : m.text
            const body = isNar(shown) ? narText(shown) : shown
            /**
             * 전경째 칠하는 줄 = **지문**(심리·상황 표기) 또는 **지금 말줄기의 끝말**.
             * 끝말 판정은 「로그의 마지막 AI 말풍선이고 뒤에 남은 큐가 없다」 —
             * 운영자 "꼭 마지막 아니여도 돼. 마지막 말 하고, 상황 표기를 할 수도 있으니까".
             */
            const lastAi = i === log.length - 1 && m.who === 'ai' && queue.length === 0
            const lead = m.narration || lastAi
            return (
              // ⚠ 타이핑 중인 말풍선은 낭독에서 뺀다 — 라이브 리전 안에서 28ms마다 글자가 갈리면
              // 스크린리더가 부분 문장을 초 36회 되읽는다(검토자 260726). 완성된 뒤에 읽힌다.
              <Bubble key={i} who={m.who} narration={m.narration} sig={chef.sig} lead={lead} aria-hidden={typing || undefined}>
                {/* 전경째 칠하는 줄은 구절 강조를 겹치지 않는다(이미 전부 그 색이다) */}
                {m.who === 'ai' && !lead ? withEmphasis(body, chef.sig) : body}
              </Bubble>
            )
          })}
          {/* 아직 할 말이 남았다 = 다음 메시지 대기(탭하면 온다) */}
          {tw.done && queue.length > 0 && (
            <Box aria-hidden sx={{ alignSelf: 'flex-start', color: YG.mut, display: 'flex', animation: 'bob 1.1s ease-in-out infinite', '@keyframes bob': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(3px)' } } }}>
              {Pict.chevronDown(18)}
            </Box>
          )}
        </Box>

        {/* 진행 — 큐가 남아 있는 동안엔 선택지가 안 뜨므로, 이게 없으면 키보드·스크린리더
          사용자는 오프닝 세 통에서 영구히 멈춘다(검토자 260726 적발). 화면상으로는 어디를
          눌러도 진행되니 이건 **보조 경로**라 자리를 안 먹는다(포커스될 때만 나타난다).
          ⚠ 로그 스크롤러 **밖**에 둔다 — 안에 두면 스크롤과 함께 화면 밖으로 밀린다(실측). */}
        {hasNext && (
          <Box
            component="button"
            type="button"
            onClick={(e: { stopPropagation: () => void }) => {
              e.stopPropagation()
              onTap()
            }}
            sx={{
              // ⚠ MUI sx에서 숫자 `1`은 **100%**다(px 아님) — 앞서 `width: 1`로 적어 이 숨김 버튼이
              // 대화 구역을 통째로 덮고 있었다(260726 실측 rect 390×762). 반드시 단위를 붙인다.
              position: 'absolute',
              width: '1px',
              height: '1px',
              p: 0,
              m: '-1px',
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
              border: 0,
              '&:focus-visible': {
                position: 'static',
                width: 'auto',
                height: 'auto',
                clip: 'auto',
                m: 0,
                p: '8px 12px',
                minHeight: 44,
                borderRadius: '12px',
                bgcolor: YG.pillBg,
                border: `1px solid ${YG.line}`,
                color: YG.fg,
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: 700,
              },
            }}
          >
            다음 이야기 듣기
          </Box>
        )}
        {/* 내 차례 — 답을 고른다(고른 답은 내 말풍선으로 로그에 남는다) */}
        {choices.length > 0 && (
          <Box sx={{ position: 'relative', zIndex: 1, px: 2, pt: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

        {/* 입력행 = 예타 `.yeta-in` **실측값 그대로**(운영자 260727 "예타꺼 거의 그대로 가져온다고
            생각해줘"): 떠 있는 알약 · bottom 12 · 좌우 10 · 반경 999 · padding 5/6 · gap 4 ·
            `blur(11px) saturate(1)` · 유리 표면 + 1px 라인. 색만 우리 라이트 토큰이다.
            좌측 `.ydock` = 메뉴(운영자 "대화 창 겸 메뉴만 보존") — **입력을 시작하면 접힌다**
            (예타 `.yeta-in:focus-within .ydock { max-width:0 }` 그대로). */}
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: 'absolute',
            left: '10px',
            right: '10px',
            bottom: '12px',
            zIndex: 4,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            p: '5px 6px',
            borderRadius: '999px',
            bgcolor: YG.pillBg,
            border: `1px solid ${YG.line}`,
            backdropFilter: YG.blurPill,
            WebkitBackdropFilter: YG.blurPill,
            boxShadow: 'var(--shadow-card)',
            '&:focus-within .msd-dock': { maxWidth: 0, opacity: 0 },
          }}
        >
          <Box
            className="msd-dock"
            sx={{
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              maxWidth: '150px',
              overflow: 'hidden',
              transition: 'max-width .34s var(--ease), opacity .25s var(--ease)',
            }}
          >
            {DOCK.map((d) => (
              <Box
                key={d.to}
                component="button"
                type="button"
                aria-label={d.label}
                onClick={() => onNav?.(d.to)}
                sx={{
                  flex: 'none',
                  width: 34,
                  height: 44,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'none',
                  border: 'none',
                  color: YG.mut,
                  cursor: 'pointer',
                  transition: 'transform .28s var(--ease)',
                  '&:active': { transform: 'scale(0.9)' },
                }}
              >
                {d.icon}
              </Box>
            ))}
          </Box>
          <Box
            component="textarea"
            rows={1}
            value={draft}
            placeholder={asking ? '판을 보는 중…' : '메시지'}
            disabled={asking}
            aria-label="도사에게 직접 묻기"
            onChange={(e: { target: { value: string } }) => setDraft(e.target.value.slice(0, MAX_ASK))}
            onKeyDown={(e: { key: string; shiftKey: boolean; preventDefault: () => void }) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void askFree()
              }
            }}
            sx={{
              flex: 1,
              minWidth: 0,
              resize: 'none',
              background: 'none',
              border: 'none',
              outline: 'none',
              color: YG.fg,
              fontFamily: 'inherit',
              fontSize: 14.5,
              lineHeight: 1.5,
              letterSpacing: 'var(--tracking)',
              py: '11px',
              px: '4px',
              maxHeight: 88,
              '&::placeholder': { color: YG.mut },
            }}
          />
          <Box
            component="button"
            type="button"
            aria-label="보내기"
            disabled={asking || !draft.trim()}
            onClick={() => void askFree()}
            sx={{
              flex: 'none',
              width: 44,
              height: 44,
              display: 'grid',
              placeItems: 'center',
              border: 'none',
              background: 'none',
              color: tokens.color.primary,
              cursor: 'pointer',
              borderRadius: '50%',
              transition: 'transform .12s var(--ease)',
              '&:active': { transform: 'scale(0.9)' },
              '&:disabled': { opacity: 0.4, pointerEvents: 'none' },
            }}
          >
            {Pict.send(22)}
          </Box>
        </Box>
        </Box>
      </Box>
    </Box>
  )
}
