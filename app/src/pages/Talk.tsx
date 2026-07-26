import { Box, Typography, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import StatusBar from '../components/StatusBar'
import MyeongShell from '../components/MyeongShell'
import DosaChat from '../components/DosaChat'
import { GlassButton, SectionTitle } from '../components/ReportParts'
import { tokens } from '../theme'
import { HOST_NAME } from '../data/chefs'
import { useReport, stepPath } from '../data/useReport'

/**
 * 3단계 · 상담 — 미연시 단독 화면.
 *
 * 260725 3분할의 마지막 칸. 전엔 리포트 7섹션과 대운 레일을 다 지나야 대화가 나왔고
 * 그 전엔 리포트 안에 섞여 있었다 — 이제 탭 하나가 통째로 대화다.
 * 연출(타이프라이터·정곡 단정 → [맞아/아니야] 분기 → 的中 크리티컬/리커버리)은
 * DosaChat 정본 그대로 — 이 화면은 그걸 담는 그릇만 만든다.
 */
export default function Talk() {
  const nav = useNavigate()
  const { resolved, chart, report, jeonggok } = useReport()

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
      {/* flex column = 대화가 화면의 주인. 대화 영역이 남는 높이를 먹고 CTA는 아래로 밀린다
          (미연시 단독 화면인데 대화 카드만 위에 뜨고 하단이 400px 비는 걸 막는다) */}
      <Box className="msd-fadein" sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ px: 2.5 }}>
          <StatusBar />
          {/* 260726-b: 상단 햄버거가 사라져 피할 크롬이 없다 → 6.5(=52px)를 1.5로 되돌림 */}
          <Typography sx={{ mt: 1.5, fontSize: 22, fontWeight: 800, color: tokens.color.ink }}>{HOST_NAME}와 상담하기</Typography>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: tokens.color.inkSub, mt: 0.4 }}>
            {resolved.name ? `${resolved.name}님의 판을 보고 이야기해요` : '판을 보고 이야기해요'}
          </Typography>
        </Box>

        <Box sx={{ mt: 1.5, flex: 1 }}>
          <DosaChat report={report} profileName={resolved.name || undefined} hourUnknown={resolved.hourUnknown} jeonggok={jeonggok} />
        </Box>

        {/* 되돌아가기 — 상담이 마지막 칸이라 앞 단계로 가는 길을 남긴다 */}
        <Box sx={{ px: 2.5, pb: '120px' }}>
          <SectionTitle>근거 확인</SectionTitle>
          <GlassButton onClick={() => nav(stepPath('analysis', resolved.search))}>사주 분석 풀이 보기</GlassButton>
        </Box>
      </Box>
    </MyeongShell>
  )
}
