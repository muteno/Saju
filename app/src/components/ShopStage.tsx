import { useState } from 'react'
import type { ReactNode } from 'react'
import { Box } from '@mui/material'
import { tokens } from '../theme'
import { faceUrl, type Chef } from '../data/chefs'

/**
 * 연식당 무대 — **간판 → 글래스 판 → 인물** 3층(운영자 260726 구술).
 *
 * > "연식당이 한자로 써진 간판이 뒤에 오버레이되면서 보이고 그 위에 글래스모피즘으로 겹치면서
 * >  그 위에 배경이 키잉된 인물이 등장한다던가"
 *
 * 왜 3층인가: 캐릭터를 전면배경(inset:0)으로 깔면 그 위 글자가 안 읽힌다(CharacterStage가 존재하는
 * 이유와 같은 축). 대신 **간판이 배경, 글래스가 중간, 키잉된 인물이 앞**이면 글자는 글래스 위에
 * 얹히고 인물은 그 앞에서 튀어나온다 — 미연시 스탠딩 문법 그대로다.
 *
 * 아트가 아직 0장이라 인물 층은 **폴백 실루엣**으로 뜬다(등장 연출·레이아웃은 지금도 다 산다).
 * 플레이트 파일이 들어오면 `<img>`가 그 자리를 그대로 채운다 — 코드 변경 0.
 *
 * 값은 전량 계승: 글래스 = `.glass`(index.css) · 색 = `tokens.color.*` · 반경 14 · 곡선 `--ease`.
 * 등장 안무 %값은 토큰 대상이 아니다(제1핵심명령 §⛔ 애니 키프레임 예외).
 */
export default function ShopStage({
  chef,
  /** 표정 컷 번호(FACE 상수) — 있으면 이걸 먼저 쓰고, 파일이 없으면 플레이트로 폴백한다 */
  face,
  /** 등장 방향 — 'right' = 오른쪽에서 촤르륵 밀고 들어옴(교체 난입) */
  enter = 'none',
  /** 무대 높이(px) */
  height = 236,
  /** 인물 앞에 얹을 것(대사창 등) */
  children,
}: {
  chef: Chef
  face?: number
  enter?: 'none' | 'right' | 'left'
  height?: number
  children?: ReactNode
}) {
  const [broken, setBroken] = useState(false)
  const [bgBroken, setBgBroken] = useState(false)
  // 표정 컷이 아직 안 들어온 캐릭터는 조용히 플레이트로 내려간다(에셋 유무로 화면이 안 깨진다)
  const [faceBroken, setFaceBroken] = useState(false)
  const src = face && !faceBroken ? faceUrl(chef.id, face) : chef.plate
  return (
    <Box sx={{ position: 'relative', minHeight: height, overflow: 'hidden' }}>
      {/* ⓪ 배경 — 벚꽃 흩날리는 목조 상담방(운영자 260726 무드 정본). 없으면 하늘 토큰 그라데이션으로
          폴백해 무대가 비지 않는다. 위에 유리·글자가 얹히므로 살짝 눌러(밝기·채도) 깐다. */}
      {!bgBroken ? (
        <Box
          component="img"
          src="/assets/shop-bg.jpg"
          alt=""
          aria-hidden
          onError={() => setBgBroken(true)}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(.85) brightness(1.06)' }}
        />
      ) : (
        <Box
          aria-hidden
          sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, var(--c-sky-top) 0%, var(--c-sky-mid) 55%, var(--c-sky-bot) 100%)', opacity: 0.5 }}
        />
      )}
      {/* ① 간판 — 「緣食堂」. 뒤에 눌러앉아 공간의 이름을 말한다(장식이라 aria-hidden) */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          pl: 3,
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            px: 2.5,
            py: 1,
            border: '3px solid',
            borderColor: tokens.color.primary,
            borderRadius: '6px',
            color: tokens.color.primary,
            opacity: 0.13,
            fontSize: 46,
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: '0.14em',
            textIndent: '0.14em', // 자간이 마지막 글자 뒤에도 붙어 생기는 우측 쏠림 보정(광학 보정 = 토큰 예외)
            whiteSpace: 'nowrap',
          }}
        >
          緣食堂
        </Box>
      </Box>

      {/* ② 글래스 판 — 간판과 인물 사이. 글자가 얹히는 표면은 언제나 이 층이다 */}
      <Box
        className="glass"
        aria-hidden
        sx={{ position: 'absolute', left: 14, right: 14, top: 18, bottom: 18, borderRadius: '14px' }}
      />

      {/* ③ 인물 — 키잉(배경 제거)된 스탠딩. 없으면 폴백 실루엣 */}
      <Box
        sx={{
          position: 'absolute',
          right: 10,
          bottom: 0,
          top: 10,
          width: '40%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          animation:
            enter === 'none' ? 'none' : `${enter === 'right' ? 'msd-barge-r' : 'msd-barge-l'} .42s var(--ease) both`,
        }}
      >
        {!broken ? (
          <Box
            component="img"
            key={src}
            src={src}
            alt=""
            onError={() => (face && !faceBroken ? setFaceBroken(true) : setBroken(true))}
            // 그림자 색도 토큰 계승(--line) — 키잉된 인물이 유리 판에서 떠 보이게만 하는 최소치
            sx={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', filter: 'drop-shadow(0 8px 18px var(--line))' }}
          />
        ) : (
          // 폴백 — 아트가 오기 전까지의 '자리 표시 실루엣'. 거짓 캐릭터를 그리지 않고 자리만 잡는다
          <Box
            sx={{
              width: '78%',
              height: '86%',
              borderRadius: '999px 999px 18px 18px',
              bgcolor: tokens.color.primarySoft,
              border: `1px dashed ${tokens.color.border}`,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              pb: 1.2,
            }}
            aria-hidden
          />
        )}
      </Box>

      {/* ④ 얹히는 것(대사창 등) — 인물보다 앞이되 좁게 */}
      {children && (
        <Box sx={{ position: 'relative', zIndex: 4, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {children}
        </Box>
      )}
    </Box>
  )
}
