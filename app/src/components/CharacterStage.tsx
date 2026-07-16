import { Box } from '@mui/material'
import { tokens } from '../theme'

/**
 * 캐릭터 배경 스테이지. Figma 프레임에서 크롭한 아이샤 플레이트(/assets/aisha.png)를
 * 상단 정렬로 깔고, 하늘 그라데이션을 폴백으로 둔다. 하단은 페이드 처리.
 */
export default function CharacterStage({
  fadeColor = tokens.color.page,
  tint,
}: {
  fadeColor?: string
  tint?: string
}) {
  return (
    <Box sx={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
      {/* 하늘 폴백 */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, ${tokens.color.skyTop} 0%, #7fc4de 45%, ${tokens.color.skyBot} 100%)`,
        }}
      />
      {/* 캐릭터 플레이트 */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: "url('/assets/aisha.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      {tint && <Box sx={{ position: 'absolute', inset: 0, background: tint, mixBlendMode: 'soft-light' }} />}
      {/* 하단 페이드 */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '38%',
          background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${fadeColor} 96%)`,
        }}
      />
    </Box>
  )
}
