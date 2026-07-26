import { memo } from 'react'
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
function MiniChart({
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
        // 오행 의미색은 그대로 계승하되 **살짝 투명**하게 — 꽉 찬 색 블록 8개가 나란히 서면
        // 그 자체가 카드처럼 보인다. 배경이 비쳐야 무대에 얹힌 표식으로 읽힌다.
        bgcolor: el ? `color-mix(in srgb, ${tokens.ohaeng[el].bg} 82%, transparent)` : 'transparent',
        color: el ? tokens.ohaeng[el].ink : tokens.color.inkFaint,
        border: el ? 'none' : `1px dashed ${tokens.color.border}`,
      }}
    >
      {text}
    </Box>
  )
  return (
    <Box
      sx={{
        // ⚠ 유리 카드로 감싸지 않는다(운영자 260727 "붕떠서 배경하고 이질감 있으면 안되고").
        // 테두리·반경이 있으면 인물 배경 위에 **카드 한 장이 얹힌 것**으로 읽힌다.
        // 대신 왼쪽에서 시작해 오른쪽으로 사라지는 그라데이션 띠 위에 글자만 얹어 배경에 녹인다.
        display: 'inline-flex',
        gap: '4px',
        pl: 2,
        pr: 5,
        py: '7px',
        ml: -2, // 화면 왼쪽 끝까지 띠가 닿게(잘린 카드처럼 안 보이도록)
        background:
          'linear-gradient(90deg, color-mix(in srgb, var(--c-page) 80%, transparent) 0%, color-mix(in srgb, var(--c-page) 62%, transparent) 46%, transparent 100%)',
      }}
    >
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

/**
 * `memo` — 타이프라이터가 부모(DosaChat)를 28ms마다 리렌더한다(초당 ~36회).
 * props가 안 바뀌면 여기서 끊는다(PixelDosa가 memo인 것과 같은 축).
 */
export default memo(MiniChart)
