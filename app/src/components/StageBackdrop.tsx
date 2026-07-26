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
 * ⚠ 260727 운영자: "이미지가 위에 까지 이어지면서 아래까지 보여야함 · 그라데이션 오버레이를 좀 더
 * 투명하게 하고 **블러로 대체**해서 글래스모피즘을 살려야함" → 스크림은 **바닥 끝 살짝만** 남기고
 * 가시성은 대화 뒤 블라인더의 `backdrop-filter`가 맡는다. 색으로 덮으면 사진이 죽고,
 * 블러로 눌러야 유리 너머로 무대가 비친다.
 *
 * 값은 전량 계승 — 색은 `--c-page`/하늘 토큰의 파생(color-mix)만 쓴다(신규 색 0).
 * 사진이 없으면 하늘 그라데이션으로 폴백해 화면이 비지 않는다.
 */
export default function StageBackdrop({
  src = '/assets/shop-bg.jpg',
  /** 스크림 시작 위치(%) — 이 아래부터 페이지색이 올라온다 */
  scrimFrom = 44,   // 대화 라인(y446 ≈ 53%) 바로 위에서 시작해 그 지점에 20%가 오게 잡는다
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
          // ⚠ **검정** 그라데이션이다(운영자 260727 지시값 그대로): 대화 라인에서 **20%**,
          // 맨 아래에서 **50%**. 이 화면은 글자가 흰색이라 페이지색(밝은 회색)으로 깔면 거꾸로
          // 안 읽힌다. 배경 위에 검정 오버레이가 없던 게 결함이었다.
          background: `linear-gradient(180deg, transparent 0%, transparent ${scrimFrom}%, color-mix(in srgb, var(--c-ink) 20%, transparent) 53%, color-mix(in srgb, var(--c-ink) 50%, transparent) 100%)`,
        }}
      />
    </Box>
  )
}
