import { useEffect, useState } from 'react'

/**
 * 모션 부품 — 값은 전부 기존 토큰 계승(`--ease`)이고 새 색·크기를 만들지 않는다.
 * CSS 층 강등은 `index.css`의 `@media (prefers-reduced-motion: reduce)`가 전역으로 처리하고,
 * 여기 훅은 **CSS가 못 잡는 JS 타이머**(타이프라이터 등)를 끄는 용도다.
 */

/** OS 「모션 줄이기」 상태. 설정을 바꾸면 즉시 반영된다(change 구독). */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(() => {
    if (typeof matchMedia !== 'function') return false
    return matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduce(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduce
}

/**
 * 자릿수 롤 — 0~9 기둥을 1글자 창 안에서 굴린다. 값이 바뀌면 그 자리만 다시 구른다.
 *
 * 카운트업(rAF로 숫자를 세는 방식) 대신 이걸 쓴 이유: 카운트업은 프레임마다 리렌더가 돌지만
 * 롤은 `transform` 하나라 합성만으로 끝난다 — 더 싸고 더 크게 보인다.
 * 기둥 높이를 `1em`으로 둔 건 점수가 `lineHeight: 1`이라 레이아웃이 그대로여야 해서다.
 */
export function DigitRoll({
  value,
  fontSize,
  fontWeight = 800,
  color,
}: {
  value: number
  fontSize: number
  fontWeight?: number
  color: string
}) {
  const reduce = useReducedMotion()
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    // 더블 rAF — 첫 페인트가 0 위치로 찍힌 뒤에 굴러야 '굴러 올라온 것'으로 보인다
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setArmed(true))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [])
  const digits = String(Math.round(value)).split('')
  const at = armed || reduce
  return (
    <span
      aria-label={String(value)}
      style={{ display: 'inline-flex', fontSize, fontWeight, color, lineHeight: 1, letterSpacing: 'var(--tracking)' }}
    >
      {digits.map((ch, i) => (
        <span
          // key = 자리값(1의 자리·10의 자리) — 값이 갱신돼도 0부터 다시 구르지 않는다
          key={digits.length - 1 - i}
          aria-hidden
          style={{ display: 'inline-block', overflow: 'hidden', height: '1em' }}
        >
          <span
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: `translateY(${at ? -Number(ch) : 0}em)`,
              transition: reduce ? 'none' : `transform .7s var(--ease) ${i * 0.04}s`,
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <span key={n} style={{ height: '1em' }}>
                {n}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  )
}

/**
 * 단어 리빌 — 문장을 단어로 쪼개 시차로 들어온다(CSS `.msd-wordin`).
 * `from`은 앞 줄에서 이어지는 누적 인덱스 — 2절 문안이 절을 넘어 한 파도로 이어지게 한다.
 * 단어를 `inline-block`으로 만들면 단어 중간에서 줄이 안 끊긴다(한국어에 유리).
 */
export function WordReveal({ text, from = 0 }: { text: string; from?: number }) {
  const words = text.split(' ')
  return (
    <span className="msd-wordin">
      {words.map((w, i) => (
        <span key={i} className="w" style={{ ['--i' as string]: from + i }}>
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  )
}

/** 문장 배열의 누적 단어 수 — WordReveal의 `from`을 이어 붙일 때 쓴다 */
export function wordOffsets(lines: string[]): number[] {
  let acc = 0
  return lines.map((l) => {
    const at = acc
    acc += l.split(' ').length
    return at
  })
}
