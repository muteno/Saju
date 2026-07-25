import { Box } from '@mui/material'
import { tokens } from '../theme'
import type { OhaengKey } from '../theme'

/** 오행 색 타일 — 한글 대자 + 한자 + 극성/오행 라벨 */
export default function OhaengTile({
  main,
  hanja,
  polarity,
  element,
  size = 46,
  highlight = false,
  showPolarity = true,
}: {
  main: string
  hanja: string
  polarity: '+' | '-'
  element: OhaengKey
  size?: number
  highlight?: boolean
  /**
   * 극성+오행 첨자(+수) 표시. 기본 true — 배경색은 오행만 인코딩하고 **음양은 색으로 표현되지 않아**
   * 원국표에선 정보다. false = 작은 타일(대운 레일 38px)에서 끄기 위한 스위치: 하한(11px)을 지키면
   * 타일을 넘치고, 하한을 깨면 7.98px로 읽히지 않는다 — 둘 다 안 되면 그리지 않는 게 맞다.
   */
  showPolarity?: boolean
}) {
  const o = tokens.ohaeng[element]
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 1.5,
        bgcolor: o.bg,
        color: o.ink,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        position: 'relative',
        border: highlight ? `2.4px solid ${tokens.color.primary}` : '2.4px solid transparent',
        boxShadow: 'inset 0 -6px 10px rgba(0,0,0,0.06)',
      }}
    >
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: '2px' }}>
        <span style={{ fontSize: size * 0.42, fontWeight: 800, letterSpacing: 'var(--tracking)' }}>{main}</span>
        {/* 한자는 뜻이 있는 내용 → 하한(11px)까지만 줄인다. 46px 타일 = 11.04px로 원래 값과 사실상 동일 */}
        <span style={{ fontSize: Math.max(tokens.minFont, size * 0.24), fontWeight: 700 }}>{hanja}</span>
      </Box>
      {/*
        극성+오행(+수) 첨자 — 하한(11px)까지 clamp해서 표시한다.
        전엔 size*0.21이라 46px 원국표 타일에서 9.66px, 38px 대운 타일에서 **7.98px**로
        읽을 수 없는 글자를 그리고 있었다(260725 실측 · Apple HIG Caption2 = 11pt 하한).
        작은 타일은 호출부가 showPolarity={false}로 끈다 — 읽히지 않는 글자는 정보가 아니다.
      */}
      {showPolarity && (
        <span style={{ fontSize: Math.max(tokens.minFont, size * 0.21), fontWeight: 700, color: o.ink, marginTop: 2 }}>
          {polarity}
          {element}
        </span>
      )}
    </Box>
  )
}
