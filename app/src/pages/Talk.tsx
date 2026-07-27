import { useRef, useState } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import StatusBar from '../components/StatusBar'
import MyeongShell from '../components/MyeongShell'
import DosaChat from '../components/DosaChat'
import StageBackdrop from '../components/StageBackdrop'
import { tokens } from '../theme'
import { HOST_NAME, chefForGender, taglineOf } from '../data/chefs'
import type { Chef } from '../data/chefs'
import { Pict } from '../components/MyeongShell'
import { useReport, stepPath } from '../data/useReport'
import { useReducedMotion } from '../components/Motion'
import { iljuNickname } from '../data/gapja'

/**
 * 3단계 · 상담 — 미연시 단독 화면(운영자 260726 재확정 + 병렬 연식당 파도 합류).
 *
 * 앱 문법(제목·부제·섹션·CTA)을 버리고 무대 문법만 쓴다: 중앙 한 줄 표제 아래
 * [연식당 무대(간판·인물) → 원국 상시 펼침 → 글라스 선택지 → 그라데이션 대화]가 화면 전부다.
 * 하단 「사주 분석 풀이 보기」 되돌아가기 칸도 같은 지시로 제거 — 이동은 탭·드로어가 담당한다.
 * 연출(타이프라이터·정곡 「…때문에 왔지?」 → [맞아/아니야] → 的中/난입 교체)은 DosaChat.
 */
export default function Talk() {
  const nav = useNavigate()
  const { resolved, chart, report, jeonggok } = useReport()
  /**
   * 전역 배경 = **지금 무대에 선 도사의 컷 그대로**(운영자 260726 "아예 저 이미지를 배경으로
   * 깔아버릴래?" · "키잉이라기보다는 그냥 캐릭터에 배경을 일단 깔게"). 인물을 따로 세우지 않으니
   * 교체(barge)가 일어나면 이 값이 바뀌며 배경이 통째로 갈린다 — 그래서 DosaChat이 알려 준다.
   */
  const [chef, setChef] = useState<Chef>(() => chefForGender(resolved.input.gender))
  /** 미터줄 문장 — 화자가 지금 뭘 하고 있나(DosaChat이 알려 준다) */
  const [beat, setBeat] = useState('당신의 사주를 봅니다')
  /**
   * 사람 바꾸기 — 헤더 버튼이 누를 때마다 1 올라가고 DosaChat이 그 변화를 읽어 교체 연출을 튼다
   * (운영자 260727 "누르면 사람 바뀌게 · 화면 흔들리면서 이미지 바뀌고 대사 나오면 됨").
   */
  const [switchSignal, setSwitchSignal] = useState(0)
  /** 복채 주머니 신호 — 퀘스트 축은 미정이라 지금은 열어 보는 한마디까지(운영자 260727) */
  const [pouchSignal, setPouchSignal] = useState(0)
  /**
   * 배경(인물 컷)도 같이 흔든다 — DosaChat의 덜컹은 대화 무대 안쪽만 잡는다. 배경은 스크롤
   * 컨테이너 **밖**에 따로 서 있어(25-ⓐ) 흔들리지 않으면 "화면이 흔들린다"가 반쪽이 된다.
   * ⚠ WAAPI는 전역 reduced-motion CSS 밖이라 여기서도 JS로 막는다(DosaChat과 같은 규칙).
   */
  const backdropRef = useRef<HTMLDivElement | null>(null)
  const reduceMotion = useReducedMotion()
  const shakeBackdrop = () => {
    if (reduceMotion) return
    backdropRef.current?.animate(
      [
        { transform: 'translate(0,0)', easing: 'step-end' },
        { transform: 'translate(-6px,3px)', easing: 'step-end' },
        { transform: 'translate(6px,-3px)', easing: 'step-end' },
        { transform: 'translate(-4px,2px)', easing: 'step-end' },
        { transform: 'translate(3px,-1px)', easing: 'step-end' },
        { transform: 'translate(0,0)' },
      ],
      { duration: 480 },
    )
  }

  if (!chart || !report) {
    return (
      <MyeongShell active="talk" gate={false}>
        <StatusBar />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, gap: 2 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: tokens.color.ink, textAlign: 'center', lineHeight: 1.6 }}>
            사주를 먼저 알려주면
            <br />
            {HOST_NAME}가 판을 보고 이야기를 시작해요.
          </Typography>
          <Button variant="contained" onClick={() => nav('/input')}>정보 입력하기</Button>
        </Box>
      </MyeongShell>
    )
  }

  /**
   * 좌상단 신원 두 줄(운영자 260727 예시 그대로):
   *   황세웅(초록토끼)
   *   1993. 11. 30. 진시.
   * 별명 = 일주 스티커와 **같은 축**(색=일간 오행 · 동물=일지)이라 그림·이름이 안 어긋난다.
   */
  const who = (() => {
    const ilju = chart.pillars.find((p) => p.title === '일')
    const nick = ilju ? iljuNickname(ilju.ganK, ilju.jiK) : null
    const hourPillar = chart.pillars.find((p) => p.title === '시')
    const hour = resolved.hourUnknown ? '시간 모름' : hourPillar ? `${hourPillar.jiK}시` : ''
    return {
      name: `${resolved.name || '손님'}${nick ? `(${nick})` : ''}`,
      born: `${resolved.input.year}. ${resolved.input.month}. ${resolved.input.day}.${hour ? ` ${hour}` : ''}`,
    }
  })()

  return (
    <MyeongShell active="talk" gate={false} nav={false}>
      {/* 전역 배경 — 프레임 전체(9:16)를 덮는다. 스크롤 컨테이너 **밖**에 두어야 대사를 따라
          같이 흐르지 않고 무대처럼 고정된다(운영자 260726 "배경이 전역으로 깔려야된다"). */}
      <Box ref={backdropRef} sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <StageBackdrop src={chef.plate} />
      </Box>
      {/* overflowX hidden — 덜컹(translateX)이 가로 스크롤 흔적을 만들지 않게 */}
      {/* 스크롤은 무대 구역이 자체로 갖는다(DosaChat) — 여기서 또 스크롤하면 대사창 붙박이가 풀린다 */}
      <Box className="msd-fadein" sx={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* ⚠ 여기에 px를 걸면 StatusBar가 자체 px를 또 먹어 시계만 24px 안쪽으로 밀린다
            (검토자 260726 실측 x=40 · 명식·말풍선·선택지는 전부 x=16). 좌측 레일을 하나로 둔다. */}
        <Box sx={{ position: 'relative', zIndex: 3 }}>
          {/* 배경이 인물 사진이라 검정 잉크는 안 보인다 — 무대 위 글자는 밝게 간다 */}
          <StatusBar dark />
          {/* ── 대화창 상단 nav ── 예타 `.yeta-h` 문법 그대로 계승(운영자 260727 "그 네비 그대로
              가져와볼래?"): **떠 있는 알약** [←뒤로][프사+이름]. 기하(top/left/right 10 · 알약 반경 ·
              inset 림라이트 · blur)는 예타 값을 옮기고, **색만 우리 라이트 토큰**으로 바꾼다
              (예타는 다크라 그대로 쓰면 화면이 안 맞는다). */}
          <Box
            sx={{
              mt: 0.5,
              mx: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              p: '7px 9px',
              borderRadius: '999px',
              // 예타 `.yeta-h` 값 그대로 — 채움 0.5% · 라인 8% · blur 11
              bgcolor: 'color-mix(in srgb, var(--c-ink) 18%, transparent)',
              border: '1px solid color-mix(in srgb, var(--c-card) 8%, transparent)',
              backdropFilter: 'blur(11px) saturate(1)',
              WebkitBackdropFilter: 'blur(11px) saturate(1)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <Box
              component="button"
              type="button"
              aria-label="뒤로 — 내 사주로"
              onClick={() => nav(-1)}
              sx={{
                flex: 'none',
                width: 32,
                height: 32,
                display: 'grid',
                placeItems: 'center',
                border: 'none',
                background: 'none',
                color: 'color-mix(in srgb, var(--c-card) 90%, transparent)',
                cursor: 'pointer',
                borderRadius: '50%',
                '&:active': { transform: 'scale(0.9)' },
              }}
            >
              {Pict.chevronLeft(20)}
            </Box>
            {/* 프사 = 지금 무대에 선 인물의 컷을 원형으로 잘라 쓴다(얼굴이 위쪽이라 18%에서 잡는다) */}
            <Box
              aria-hidden
              sx={{
                flex: 'none',
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundImage: `url(${chef.plate})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center 18%',
                border: '1px solid color-mix(in srgb, var(--c-card) 22%, transparent)',
              }}
            />
            <Typography sx={{ flex: 'none', fontSize: 15, fontWeight: 800, color: 'var(--c-card)', whiteSpace: 'nowrap' }}>
              {chef.name}
            </Typography>
            {/* 부제 = 예타 `.yh-tag`(상대 설명) 자리. **남는 공간만큼**만 보이고 넘치면 말줄임 —
                이름은 줄바꿈 없이 지키고 설명이 양보한다(예타와 같은 규칙). */}
            <Typography
              sx={{ minWidth: 0, flex: 1, fontSize: 11, color: 'color-mix(in srgb, var(--c-card) 62%, transparent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {taglineOf(chef)}
            </Typography>
            {/* 사람 바꾸기 — 복주머니 **좌측**(운영자 260727). 누르면 화면이 흔들리고 인물(=배경)이
                갈리며 들어온 사람이 한마디 던진다. 연출은 빗맞힘 교체와 같은 문법(DosaChat). */}
            <Box
              component="button"
              type="button"
              aria-label={`도사 바꾸기 — 지금은 ${chef.name}`}
              onClick={() => {
                shakeBackdrop()
                setSwitchSignal((n) => n + 1)
              }}
              sx={{
                flex: 'none',
                width: 32,
                height: 32,
                display: 'grid',
                placeItems: 'center',
                border: 'none',
                background: 'none',
                color: 'color-mix(in srgb, var(--c-card) 90%, transparent)',
                cursor: 'pointer',
                borderRadius: '50%',
                '&:active': { transform: 'scale(0.9)' },
              }}
            >
              {Pict.swap(19)}
            </Box>
            {/* 복채 주머니 — 전화·문자 대신(운영자 260727). 지금은 자리만, 뒤에 퀘스트가 붙는다 */}
            <Box
              component="button"
              type="button"
              aria-label="복채 주머니 열어 보기"
              onClick={() => setPouchSignal((n) => n + 1)}
              sx={{
                flex: 'none',
                width: 32,
                height: 32,
                display: 'grid',
                placeItems: 'center',
                border: 'none',
                background: 'none',
                color: 'color-mix(in srgb, var(--c-card) 90%, transparent)',
                cursor: 'pointer',
                borderRadius: '50%',
                '&:active': { transform: 'scale(0.9)' },
              }}
            >
              {Pict.pouch(19)}
            </Box>
          </Box>
          {/* 미터 자리 — 예타에선 「opus 4.8 00.0tok」이 뜨는 줄이다(운영자 260727 지시로 그 자리에
              상황 설명을 넣는다). 10px · mut 컬러 · 기울임 · 고정형. 여기까지가 대화창 상단 nav다. */}
          <Typography
            sx={{
              mt: 0.9, // 운영자 260727 "위에 간격 1.5배" — 0.6 → 0.9
              textAlign: 'center',
              fontSize: 11, // HIG 하한 = 11px(예타 미터는 10이지만 우리 게이트 하한이 11이다)
              fontStyle: 'italic',
              letterSpacing: '.02em',
            }}
          >
            {/* 빛이 글자를 한 번 훑고 지나간다 — 노뮤트에디터 `.nm-shim` 이식(픽토그램 제외).
                문장은 화자가 지금 하는 짓이라 국면마다 바뀐다(감정을 직접 말하지 않는다).
                ⚠ 이 줄만 유리 없이 사진 위에 맨몸으로 떠 있어 밝은 컷에선 통째로 묻혔다(260727 실측) —
                헤더 알약과 **같은 값**의 유리를 얇게 깔아 받친다(신규 색 0 · 계승). */}
            {/* ⚠ 유리는 **바깥 겹**이 든다 — `.msd-shim`은 `background-clip: text`라 같은 요소에
                배경을 주면 그 배경까지 글자 모양으로 잘려 알약이 아예 안 그려진다(260727 실측). */}
            <Box
              component="span"
              sx={{
                display: 'inline-block',
                px: '9px',
                py: '2px',
                borderRadius: '999px',
                bgcolor: 'color-mix(in srgb, var(--c-ink) 26%, transparent)',
                backdropFilter: 'blur(11px) saturate(1)',
                WebkitBackdropFilter: 'blur(11px) saturate(1)',
              }}
            >
              <Box component="span" className="msd-shim">
                {beat}…
              </Box>
            </Box>
          </Typography>
        </Box>

        <Box sx={{ position: 'relative', mt: 1.5, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <DosaChat
            report={report}
            pillars={chart.pillars}
            profileName={resolved.name || undefined}
            hourUnknown={resolved.hourUnknown}
            jeonggok={jeonggok}
            gender={resolved.input.gender}
            onChef={setChef}
            who={who}
            onBeat={setBeat}
            switchSignal={switchSignal}
            pouchSignal={pouchSignal}
            onNav={(to) => nav(to === '/result' ? stepPath('intro', resolved.search) : to === '/analysis' ? stepPath('analysis', resolved.search) : to)}
          />
        </Box>
      </Box>
    </MyeongShell>
  )
}
