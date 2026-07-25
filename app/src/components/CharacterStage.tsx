import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { chefPlate } from '../data/chefs'

const PLATE = chefPlate()

/**
 * 셰프 스테이지 — 캐릭터 아트를 '담는' 상단 판.
 *
 * 캐릭터 미배정(`chefs.ts`의 `ACTIVE_CHEF_ID = null`)이면 **판 자체를 만들지 않고**
 * children만 흘린다 — 그림이 없는데 하늘 그라데이션 띠만 남으면 화면 위쪽이 빈 여백이 되고,
 * 그만큼 본문이 아래로 밀린다. 그라데이션·페이드는 이미지를 얹기 위한 장치라서 함께 잠든다.
 *
 * 캐릭터가 확정돼 `ACTIVE_CHEF_ID`를 켜면 아래 판이 그대로 되살아난다(높이는 화면별 height prop).
 * 판을 쓰는 이유: 전면 배경(inset:0)으로 깔면 그 위 원국표·본문이 사진 위에 얹혀 읽히지 않는다
 * — 스테이지는 높이를 갖고 끝나고, 아래 콘텐츠는 단색 --c-page 위에서 시작한다.
 */
export default function CharacterStage({
  height = 380,
  children,
}: {
  /** 스테이지 판 높이(px). 캐릭터 미배정이면 무시된다 */
  height?: number
  /** 판 하단에 얹을 내용(타이틀 등) */
  children?: ReactNode
}) {
  if (!PLATE) return <>{children}</>

  return (
    <Box sx={{ position: 'relative', minHeight: height }}>
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--c-sky-top) 0%, var(--c-sky-mid) 55%, var(--c-sky-bot) 100%)' }} />
      <Box sx={{ position: 'absolute', inset: 0, backgroundImage: `url('${PLATE}')`, backgroundSize: 'cover', backgroundPosition: 'top center' }} />
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', background: 'linear-gradient(180deg, rgba(238,240,246,0) 0%, var(--c-page) 96%)' }} />
      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: height }}>{children}</Box>
    </Box>
  )
}
