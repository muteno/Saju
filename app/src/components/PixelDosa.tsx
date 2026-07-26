import { memo, useEffect, useState } from 'react'
import { Box } from '@mui/material'
import { useReducedMotion } from './Motion'

/**
 * 도트 도사 캐릭터 — 상담 무대의 화자(운영자 260726: "너가 벡터캐릭터를 구현해서…
 * 예전 BIT 게임 느낌"). 사진 플레이트(chefs.ts) 축과 별개의 **코드 그림**이라
 * 셰프 캐릭터가 확정되면 표정 컷과 교체·병존은 운영자 결정으로 정리한다.
 *
 * 도트 문법: 16×19 픽셀 맵을 rect로 찍는다(shapeRendering crispEdges = 도트 각 유지).
 * 색은 전부 기존 토큰 참조(신규 hex 0 — 게이트 T3): 갓·눈코입 = --c-ink,
 * 도포 = --c-primary(+dark 소매·soft 동정), 얼굴 = --c-card, 볼 = --c-solar 파생.
 * 움직임 문법: steps() 스냅 = 프레임이 뚝뚝 끊기는 8비트 감(부드러운 트윈 금지).
 */
export type DosaMood = 'idle' | 'shock' | 'happy' | 'hmm'

const PAL: Record<string, string> = {
  k: 'var(--c-ink)',
  w: 'var(--c-card)',
  p: 'var(--c-primary)',
  d: 'var(--c-primary-dark)',
  s: 'var(--c-primary-soft)',
}
const BLUSH = 'color-mix(in srgb, var(--c-solar) 38%, var(--c-card))'
const SWEAT = 'var(--c-lunar)'

/** 몸통 맵(눈·입·볼은 상태 오버레이로 따로 찍는다) — 16열 × 19행 */
const BODY = [
  '......kkkk......', // 갓 꼭지
  '.....kkkkkk.....',
  '.....kkkkkk.....',
  '..kkkkkkkkkkkk..', // 갓 챙
  '....wwwwwwww....', // 얼굴
  '....wwwwwwww....',
  '....wwwwwwww....',
  '....wwwwwwww....',
  '....wwwwwwww....',
  '....wwwwwwww....',
  '.....wwwwww.....', // 턱
  '......ssss......', // 동정(깃)
  '....pppppppp....', // 어깨
  '..dpppsssspppd..', // 도포 + 깃 V + 소매
  '.dpppppsspppppd.',
  '.dppppwwwwppppd.', // 소매에 모은 손
  '..pppppppppppp..',
  '..dddddddddddd..', // 도포 자락
  '....kk....kk....', // 신
]

type Px = [x: number, y: number, w: number, h: number, fill: string]

/** 행 안의 같은 색 연속 구간을 rect 하나로 합친다 — 노드 수 절약 */
function bodyRects(): Px[] {
  const out: Px[] = []
  BODY.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]
      if (c === '.') {
        x += 1
        continue
      }
      let end = x
      while (end + 1 < row.length && row[end + 1] === c) end += 1
      out.push([x, y, end - x + 1, 1, PAL[c]])
      x = end + 1
    }
  })
  return out
}
const BODY_RECTS = bodyRects()

/** 표정 오버레이 — 눈(6·9열)·볼(8행)·입(9행 중앙) */
function faceRects(mood: DosaMood, blink: boolean, mouthOpen: boolean): Px[] {
  const k = PAL.k
  const out: Px[] = [
    [4, 8, 2, 1, BLUSH],
    [10, 8, 2, 1, BLUSH],
  ]
  // 눈
  if (mood === 'happy') out.push([5, 7, 1, 1, k], [6, 6, 1, 1, k], [9, 6, 1, 1, k], [10, 7, 1, 1, k])
  else if (mood === 'shock') out.push([5, 6, 2, 2, k], [9, 6, 2, 2, k])
  else if (mood === 'hmm') out.push([5, 6, 2, 1, k], [9, 6, 2, 1, k], [6, 7, 1, 1, k], [9, 7, 1, 1, k])
  else if (blink) out.push([6, 7, 1, 1, k], [9, 7, 1, 1, k])
  else out.push([6, 6, 1, 2, k], [9, 6, 1, 2, k])
  // 입 — 말하는 중엔 표정과 무관하게 벌렸다 다문다
  if (mouthOpen) out.push([7, 9, 2, 2, k])
  else if (mood === 'happy') out.push([6, 9, 1, 1, k], [9, 9, 1, 1, k], [7, 10, 2, 1, k])
  else if (mood === 'shock') out.push([7, 9, 2, 2, k])
  else out.push([7, 9, 2, 1, k])
  // 식은땀 — 갸웃할 때만
  if (mood === 'hmm') out.push([3, 5, 1, 2, SWEAT])
  return out
}

/** 머리 위 감정 말풍선 도트 글리프 — !(놀람) · …(갸웃). 도트당 정수 px(우글거림 방지) */
function EmoteGlyph({ kind }: { kind: '!' | '…' }) {
  if (kind === '!')
    return (
      <svg width={12} height={21} viewBox="0 0 4 7" shapeRendering="crispEdges" aria-hidden>
        <rect x={1} y={0} width={2} height={4} style={{ fill: 'var(--c-solar)' }} />
        <rect x={1} y={5} width={2} height={2} style={{ fill: 'var(--c-solar)' }} />
      </svg>
    )
  return (
    <svg width={20} height={4} viewBox="0 0 10 2" shapeRendering="crispEdges" aria-hidden>
      {[0, 4, 8].map((x) => (
        <rect key={x} x={x} y={0} width={2} height={2} style={{ fill: 'var(--c-ink-faint)' }} />
      ))}
    </svg>
  )
}

function PixelDosa({
  mood = 'idle',
  talking = false,
  hopKey = 0,
  width = 128,
}: {
  mood?: DosaMood
  /** 타이프라이터 진행 중 = 입을 움직인다 */
  talking?: boolean
  /** 값이 바뀔 때마다 폴짝 한 번(주제 선택·的中) */
  hopKey?: number
  /** 도트가 우글거리지 않게 16의 배수만(도트당 정수 px — crispEdges 격자 스냅) */
  width?: number
}) {
  const reduce = useReducedMotion()
  const [blink, setBlink] = useState(false)
  const [mouthOpen, setMouthOpen] = useState(false)

  // 눈 깜빡임 — JS 타이머라 모션 감소를 직접 소비해야 한다(전역 CSS 블록이 못 잡는 축)
  useEffect(() => {
    if (reduce) return
    let alive = true
    let t: ReturnType<typeof setTimeout>
    const loop = () => {
      t = setTimeout(() => {
        if (!alive) return
        setBlink(true)
        setTimeout(() => alive && setBlink(false), 130)
        loop()
      }, 2600 + Math.random() * 1600)
    }
    loop()
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [reduce])

  // 말할 때 입 개폐 — 8비트식 두 프레임 교대
  useEffect(() => {
    if (!talking || reduce) {
      setMouthOpen(false)
      return
    }
    const iv = setInterval(() => setMouthOpen((v) => !v), 150)
    return () => {
      clearInterval(iv)
      setMouthOpen(false)
    }
  }, [talking, reduce])

  const h = Math.round((width * BODY.length) / 16)
  return (
    <Box sx={{ position: 'relative', width, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* 숨쉬기 — steps(1)로 두 프레임 스냅(도트 감성: 부드럽게 떠다니면 8비트가 아니다) */}
      <Box
        sx={{
          animation: 'px-bob 2.4s steps(1) infinite',
          '@keyframes px-bob': {
            '0%': { transform: 'translateY(0)' },
            '50%': { transform: 'translateY(-3px)' },
            '100%': { transform: 'translateY(0)' },
          },
        }}
      >
        {/* 폴짝 — hopKey 리마운트로 1회 재생 */}
        <Box
          key={hopKey}
          sx={{
            position: 'relative',
            transformOrigin: '50% 100%',
            ...(hopKey > 0 && {
              animation: 'px-hop .5s steps(4) both',
            }),
            '@keyframes px-hop': {
              '0%': { transform: 'translateY(0)' },
              '30%': { transform: 'translateY(-14px)' },
              '55%': { transform: 'translateY(0)' },
              '75%': { transform: 'translateY(0) scaleY(0.94)' },
              '100%': { transform: 'translateY(0)' },
            },
          }}
        >
          <svg width={width} height={h} viewBox={`0 0 16 ${BODY.length}`} shapeRendering="crispEdges" aria-hidden>
            {BODY_RECTS.map(([x, y, w2, h2, fill], i) => (
              <rect key={i} x={x} y={y} width={w2} height={h2} style={{ fill }} />
            ))}
            {faceRects(mood, blink, talking ? mouthOpen : false).map(([x, y, w2, h2, fill], i) => (
              <rect key={`f${i}`} x={x} y={y} width={w2} height={h2} style={{ fill }} />
            ))}
          </svg>
          {/* 감정 말풍선 — 머리 오른쪽 위 */}
          {(mood === 'shock' || mood === 'hmm') && (
            <Box className="msd-popin" sx={{ position: 'absolute', top: mood === 'shock' ? -6 : 2, right: -14 }}>
              <EmoteGlyph kind={mood === 'shock' ? '!' : '…'} />
            </Box>
          )}
        </Box>
      </Box>
      {/* 발밑 그림자 — 잉크 파생(신규 값 0) */}
      <Box sx={{ mt: '2px', width: '58%', height: 7, borderRadius: '50%', background: 'color-mix(in srgb, var(--c-ink) 13%, transparent)' }} />
    </Box>
  )
}

// 타이프라이터가 28ms마다 부모를 리렌더한다 — memo로 절단(내부 blink·입 타이머는 자체 state라 무관)
export default memo(PixelDosa)
