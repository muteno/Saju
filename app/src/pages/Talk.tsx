import { useState } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import StatusBar from '../components/StatusBar'
import MyeongShell from '../components/MyeongShell'
import DosaChat from '../components/DosaChat'
import StageBackdrop from '../components/StageBackdrop'
import { tokens } from '../theme'
import { HOST_NAME, chefForGender } from '../data/chefs'
import { useReport } from '../data/useReport'

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
  const [bg, setBg] = useState(() => chefForGender(resolved.input.gender).plate)

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

  return (
    <MyeongShell active="talk" gate={false}>
      {/* 전역 배경 — 프레임 전체(9:16)를 덮는다. 스크롤 컨테이너 **밖**에 두어야 대사를 따라
          같이 흐르지 않고 무대처럼 고정된다(운영자 260726 "배경이 전역으로 깔려야된다"). */}
      <StageBackdrop src={bg} />
      {/* overflowX hidden — 덜컹(translateX)이 가로 스크롤 흔적을 만들지 않게 */}
      {/* 스크롤은 무대 구역이 자체로 갖는다(DosaChat) — 여기서 또 스크롤하면 대사창 붙박이가 풀린다 */}
      <Box className="msd-fadein" sx={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* ⚠ 여기에 px를 걸면 StatusBar가 자체 px를 또 먹어 시계만 24px 안쪽으로 밀린다
            (검토자 260726 실측 x=40 · 명식·말풍선·선택지는 전부 x=16). 좌측 레일을 하나로 둔다. */}
        <Box sx={{ position: 'relative' }}>
          <StatusBar />
          {/* 표제 뒤 얇은 스크림 — 전역 배경이 사진이라 표제가 맨살로 앉으면 어두운 처마 위에서
              대비가 1.87:1까지 떨어진다(검토자 260726 실측 · WCAG AA 4.5:1 미달).
              색은 `--c-page` color-mix 파생이라 신규 색 0. */}
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: -28,
              pointerEvents: 'none',
              // ⚠ 그라데이션 정지점은 **표제가 앉는 위치**에 맞춘다 — 앞서 55%에서 흐려지게 뒀더니
              // 표제(컨테이너의 68~100% 구간)가 이미 거의 투명한 자리에 앉아 어두운 갓 위에서
              // 대비 1.28:1까지 떨어졌다(260726 실측 · AA 4.5:1 미달). 표제 아래까지 꽉 채우고 뺀다.
              background:
                'linear-gradient(180deg, var(--c-page) 0%, var(--c-page) 62%, color-mix(in srgb, var(--c-page) 78%, transparent) 84%, transparent 100%)',
            }}
          />
          {/* 표제는 중앙 한 줄로 끝 — 제목+부제 2단은 그룹웨어 문법(운영자 260726 폐지) */}
          <Typography
            sx={{ position: 'relative', mt: 0.5, textAlign: 'center', fontSize: 14.5, fontWeight: 700, color: tokens.color.ink, opacity: 0.82 }}
          >
            당신의 사주팔자를 들여다봅니다
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
            onChef={setBg}
          />
        </Box>
      </Box>
    </MyeongShell>
  )
}
