import { useState } from 'react'
import { Box } from '@mui/material'

/**
 * 전역 배경 — 화면 전체(9:16 세로 프레임)를 덮는 무대 사진 한 장.
 *
 * 운영자 260726: "배경이 전역으로 깔려야된다 9대16으로, 그리고 그 위에 글래스모피즘으로
 * 명식·대화창 이런게 다 올라와야해." → 배경을 **부품 안에 가둔 박스**(둥근 모서리 무대 카드)로
 * 쓰면 화면이 카드의 나열로 읽혀 투박하다. 사진은 프레임 전체를 채우고, 그 위에 유리 판만 뜬다.
 *
 * ⚠ 260726 운영자: "아예 저 이미지를 배경으로 깔아버릴래?" + "키잉이라기보다는 그냥 캐릭터에
 * 배경을 일단 깔게 — 키잉해도 어색할거야" → **인물 컷을 배경째 그대로** 전역에 깐다.
 * 인물을 따로 세우는 층(ShopStage)이 사라지고 배경 한 장이 곧 무대다.
 *
 * 구조: ⓪사진(cover) → ①스크림(아래로 갈수록 페이지색) → 그 위에 호출부의 콘텐츠.
 * 스크림이 필요한 이유: 사진 위에 바로 글자를 얹으면 밝은 하늘·창틀에서 대비가 무너진다.
 * 위쪽은 비워 두고(무대가 보여야 한다) 대사·선택지가 앉는 아래쪽만 페이지색으로 눌러 깐다.
 *
 * 값은 전량 계승 — 색은 `--c-page`/하늘 토큰의 파생(color-mix)만 쓴다(신규 색 0).
 * 사진이 없으면 하늘 그라데이션으로 폴백해 화면이 비지 않는다.
 */
export default function StageBackdrop({
  src = '/assets/shop-bg.jpg',
  /** 스크림 시작 위치(%) — 이 아래부터 페이지색이 올라온다 */
  scrimFrom = 46,
}: {
  src?: string
  scrimFrom?: number
}) {
  const [broken, setBroken] = useState(false)
  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {!broken ? (
        <Box
          component="img"
          src={src}
          alt=""
          onError={() => setBroken(true)}
          // cover = 세로 원본을 프레임에 맞춰 채운다. 인물 컷일 때 얼굴이 상단에 오게 top 정렬.
          // 채도·밝기를 살짝 눌러 유리 판이 앞으로 나오게 한다(사진이 주인공이 아니라 무대라서).
          // 교체(barge)로 src가 바뀌면 크로스페이드 — 그림이 툭 바뀌면 화면이 깜빡인 것처럼 보인다.
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', filter: 'saturate(.9) brightness(1.04)', transition: 'opacity .38s var(--ease)' }}
        />
      ) : (
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--c-sky-top) 0%, var(--c-sky-mid) 55%, var(--c-sky-bot) 100%)' }} />
      )}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, transparent 0%, transparent ${scrimFrom}%, color-mix(in srgb, var(--c-page) 62%, transparent) ${scrimFrom + 22}%, color-mix(in srgb, var(--c-page) 92%, transparent) 100%)`,
        }}
      />
    </Box>
  )
}
