import { Box } from '@mui/material'
import type { ReactNode } from 'react'
import { chefPlate } from '../data/chefs'

const PLATE = chefPlate()

/**
 * 셰프 스테이지 — 상단에 '담기는' 캐릭터 아트 판. 사주분석 화면(Analysis)이 쓰던 마크업을
 * 그대로 승격한 공용 부품이다(하늘 그라데이션 → 플레이트 cover/top → 하단 45% 페이지색 페이드).
 *
 * 왜 '담는가': 전면 배경(inset 0)으로 깔면 그 위의 원국표·본문이 사진 위에 얹혀 읽히지 않는다
 * (260725 실측 — 라이트 단일 테마에서 --stage-scrim이 transparent라 보호막이 없었다).
 * 스테이지는 높이를 가지고 끝나며, 아래 콘텐츠는 단색 --c-page 위에서 시작한다 =
 * 스크림 없이 가독이 성립하는 구조. 포스텔러 만세력도 콘텐츠 뒤에 사진을 깔지 않는다.
 *
 * 플레이트는 셰프단 레지스트리(chefs.ts) 단일 경유 — 화면마다 다른 캐릭터가 나오지 않는다.
 */
export default function CharacterStage({
  height = 380,
  children,
}: {
  /** 스테이지 판 높이(px). 화면별 변주는 이 값만 */
  height?: number
  /** 판 하단에 얹을 내용(타이틀 등) — 페이드 위, 아래 정렬 */
  children?: ReactNode
}) {
  return (
    <Box sx={{ position: 'relative', minHeight: height }}>
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--c-sky-top) 0%, var(--c-sky-mid) 55%, var(--c-sky-bot) 100%)' }} />
      <Box sx={{ position: 'absolute', inset: 0, backgroundImage: `url('${PLATE}')`, backgroundSize: 'cover', backgroundPosition: 'top center' }} />
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', background: 'linear-gradient(180deg, rgba(238,240,246,0) 0%, var(--c-page) 96%)' }} />
      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: height }}>{children}</Box>
    </Box>
  )
}
