import { Box } from '@mui/material'
import { tokens } from '../theme'
import type { Pillar } from '../data/saju'

/**
 * 미니 명식 — 좌측 상단에 박히는 **여덟 자**(운영자 260726: "사주명식은 좌측상단에 거의 25%로
 * 줄여서 딱 사주명식 8자 크기로만 박아. 사용자는 사실 볼 필요 없게").
 *
 * 큰 원국표를 화면 한복판에 깔면 대화가 밀리고 인물이 가려진다 — 여기서 명식은 **주인공이 아니라
 * 표식**이다. 그래서 라벨(시·일·월·년)·십성·극성 첨자를 전부 떼고 간지 한자 8자만 남긴다.
 * 근거가 필요한 사람은 분석 탭이 따로 있다.
 *
 * 폭 = 4열 × 20 + 간격 = 약 99px ≈ 프레임(390)의 25%. 글자 12px(HIG 하한 11 이상).
 * 말하는 내용과 관련된 기둥은 살짝 들린다(focus — 대화가 어디를 짚는지 눈으로 잇는 유일한 끈).
 */
export default function MiniChart({
  pillars,
  unknownHour,
  focus,
}: {
  pillars: Pillar[]
  unknownHour?: boolean
  focus: string[]
}) {
  const chip = (text: string, el: keyof typeof tokens.ohaeng | null) => (
    <Box
      sx={{
        width: 20,
        height: 20,
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1,
        bgcolor: el ? tokens.ohaeng[el].bg : 'var(--c-card)',
        color: el ? tokens.ohaeng[el].ink : tokens.color.inkFaint,
        border: el ? 'none' : `1px dashed ${tokens.color.border}`,
      }}
    >
      {text}
    </Box>
  )
  return (
    <Box className="glass" sx={{ display: 'inline-flex', gap: '3px', p: '5px', borderRadius: '10px' }}>
      {pillars.map((p) => {
        const on = focus.includes(p.title)
        const unknown = unknownHour && p.title === '시'
        return (
          <Box
            key={p.title}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              transition: 'transform .3s var(--ease), filter .3s var(--ease)',
              ...(on && {
                transform: 'translateY(-2px) scale(1.12)',
                filter: 'drop-shadow(0 4px 8px color-mix(in srgb, var(--c-primary) 34%, transparent))',
              }),
            }}
          >
            {unknown ? (
              <>
                {chip('?', null)}
                {chip('?', null)}
              </>
            ) : (
              <>
                {chip(p.gan, p.ganE)}
                {chip(p.ji, p.jiE)}
              </>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
