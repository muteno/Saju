import { memo, useState } from 'react'
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
function ShopStage({
  chef,
  /** 표정 컷 번호(FACE 상수) — 있으면 이걸 먼저 쓰고, 파일이 없으면 플레이트로 폴백한다 */
  face,
  /** 등장 방향 — 'right' = 오른쪽에서 촤르륵 밀고 들어옴(교체 난입) */
  enter = 'none',
  /** 무대 높이(px) */
  height = 236,
  /**
   * 무대 껍데기를 벗는다(운영자 260726 "배경이 전역으로 깔려야된다") — 배경·간판·유리 판을
   * 전부 끄고 **인물만** 남긴다. 배경은 화면 전역(`StageBackdrop`)이 이미 깔고 있으므로
   * 여기서 또 깔면 사진 위에 사진, 판 위에 판이 되어 화면이 카드 나열로 읽힌다(=투박함의 정체).
   * 껍데기가 없으니 인물은 프레임 폭을 더 쓴다(가운데 정렬·크게).
   */
  bare = false,
  /**
   * 아트가 **자기 배경을 갖고 있나**. 'full' = 운영자 원본 레퍼런스(방·창·조명이 그려진 상반신 컷) →
   * 밴드를 꽉 채우고(cover) 가장자리를 녹여 무대에 스며들게 한다. 'keyed' = 배경이 지워진 스탠딩 →
   * 종전대로 통째로 보여준다(contain).
   */
  art = 'keyed',
  /** 인물 앞에 얹을 것(대사창 등) */
  children,
  /** 플레이트 부재 시 인물 자리에 세울 것(예: 도트 캐릭터) — 미지정이면 자리 표시 실루엣 */
  fallback,
}: {
  chef: Chef
  face?: number
  enter?: 'none' | 'right' | 'left'
  height?: number
  bare?: boolean
  art?: 'keyed' | 'full'
  children?: ReactNode
  fallback?: ReactNode
}) {
  const [broken, setBroken] = useState(false)
  const [bgBroken, setBgBroken] = useState(false)
  // 표정 컷이 아직 안 들어온 캐릭터는 조용히 플레이트로 내려간다(에셋 유무로 화면이 안 깨진다)
  const [faceBroken, setFaceBroken] = useState(false)
  /**
   * 캐릭터가 바뀌면 '깨짐' 기억을 버린다 — 이 컴포넌트는 교체(barge)에도 **언마운트되지 않아서**,
   * 앞 캐릭터에서 한 번 깨진 상태가 남으면 **다음 캐릭터는 시도조차 안 하게 된다**
   * (에셋이 전량 도착해도 영원히 폴백만 뜬다). 렌더 중 상태 조정 = 리액트 공식 패턴.
   *
   * ⚠ **표정(face)이 바뀔 때는 리셋하지 않는다.** 리셋하면 컷이 없는 캐릭터에서 매 감정 전이마다
   * 404를 다시 쏘고 그때마다 인물이 깜빡인다(검토자 260726 적발). 애초에 컷이 없는 캐릭터는
   * `faceUrl`이 null이라 여기까지 오지도 않는다.
   */
  const [seenChef, setSeenChef] = useState(chef.id)
  if (seenChef !== chef.id) {
    setSeenChef(chef.id)
    setFaceBroken(false)
    setBroken(false)
  }
  const cut = face ? faceUrl(chef.id, face) : null
  const src = cut && !faceBroken ? cut : chef.plate
  return (
    <Box sx={{ position: 'relative', minHeight: height, overflow: 'hidden' }}>
      {/* ⓪ 배경 — 벚꽃 흩날리는 목조 상담방(운영자 260726 무드 정본). 없으면 하늘 토큰 그라데이션으로
          폴백해 무대가 비지 않는다. 위에 유리·글자가 얹히므로 살짝 눌러(밝기·채도) 깐다.
          ⚠ bare 모드에선 전역 배경이 이미 있어 이 층을 통째로 건너뛴다. */}
      {bare ? null : !bgBroken ? (
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
      {/* ① 간판 — 「緣食堂」. 뒤에 눌러앉아 공간의 이름을 말한다(장식이라 aria-hidden).
          bare 모드에선 생략 — 진짜 가게 사진이 전역으로 깔려 있어 그린 간판은 군더더기다. */}
      {!bare && (
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
      )}

      {/* ② 글래스 판 — 간판과 인물 사이. 글자가 얹히는 표면은 언제나 이 층이다.
          bare 모드에선 생략 — 유리는 아래 콘텐츠(원국·대사창)가 각자 들고 있다. */}
      {!bare && (
        <Box
          className="glass"
          aria-hidden
          sx={{ position: 'absolute', left: 14, right: 14, top: 18, bottom: 18, borderRadius: '14px' }}
        />
      )}

      {/* ③ 인물 — 키잉(배경 제거)된 스탠딩. 없으면 폴백 실루엣.
          bare = 껍데기가 없으니 가운데에 크게 선다(판에 눌려 오른쪽 40%에 갇힐 이유가 사라진다) */}
      <Box
        sx={{
          position: 'absolute',
          ...(bare ? { left: 0, right: 0, bottom: 0, top: 0 } : { right: 10, bottom: 0, top: 10, width: '40%' }),
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
            src={src}
            alt=""
            // ⚠ `key={src}`를 걸지 않는다 — 걸면 표정이 바뀔 때마다 <img>가 새로 마운트돼
            // **새 그림이 도착할 때까지 무대가 빈다**. src만 갈면 브라우저가 새 그림을 다 받을 때까지
            // 옛 그림을 계속 띄운다(전환이 끊기지 않는다).
            // 컷이 깨지면 **한 단만** 내려간다(컷 → 플레이트 → 폴백 대역). 한 번에 폴백까지
            // 떨어뜨리면 컷 하나 빠졌다고 인물이 통째로 사라진다.
            onError={() => (cut && !faceBroken ? setFaceBroken(true) : setBroken(true))}
            // 그림자 색도 토큰 계승(--line) — 키잉된 인물이 유리 판에서 떠 보이게만 하는 최소치.
            // bare = 아래를 마스크로 녹인다: 유리 판이 인물을 덮는 경계가 '싹둑 잘림'이 아니라
            // '무대 안개로 스며듦'이 된다(미연시 스탠딩 관례 · 색 아닌 알파라 토큰 무관).
            sx={
              art === 'full'
                ? {
                    // 배경째 그려진 원본 컷(세로로 긴 상반신) — **통째로** 넣는다.
                    // cover로 밴드를 채우면 가로 밴드가 세로 그림을 잘라 상반신이 사라진다
                    // (운영자 260726 "캐릭터 크기 줄여서 저기에 넣고 상반신까지 다 보일텐데?").
                    // 사각형 경계가 그대로 보이면 '사진을 붙인 것'이 되므로 가장자리를 마스크로 녹인다.
                    height: '100%',
                    width: 'auto',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    borderRadius: '18px',
                    maskImage:
                      'linear-gradient(180deg, black 0%, black 78%, transparent 100%), linear-gradient(90deg, transparent 0%, black 9%, black 91%, transparent 100%)',
                    WebkitMaskImage:
                      'linear-gradient(180deg, black 0%, black 78%, transparent 100%), linear-gradient(90deg, transparent 0%, black 9%, black 91%, transparent 100%)',
                    maskComposite: 'intersect',
                    WebkitMaskComposite: 'source-in',
                  }
                : {
                    maxHeight: '100%',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 8px 18px var(--line))',
                    ...(bare && {
                      maskImage: 'linear-gradient(180deg, black 58%, transparent 96%)',
                      WebkitMaskImage: 'linear-gradient(180deg, black 58%, transparent 96%)',
                    }),
                  }
            }
          />
        ) : (
          // 폴백 — 호출부가 준 대역(도트 캐릭터 등)이 있으면 그가 무대를 지키고,
          // 없으면 '자리 표시 실루엣'(거짓 캐릭터를 그리지 않고 자리만 잡는다)
          (fallback ?? (
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
          ))
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

/**
 * `memo` — 타이프라이터가 부모(DosaChat)를 28ms마다 리렌더한다(초당 ~36회).
 * props가 안 바뀌면 여기서 끊는다(PixelDosa가 memo인 것과 같은 축).
 */
export default memo(ShopStage)
