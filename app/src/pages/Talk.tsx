import { Box, Typography, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import StatusBar from '../components/StatusBar'
import MyeongShell from '../components/MyeongShell'
import DosaChat from '../components/DosaChat'
import { tokens } from '../theme'
import { HOST_NAME } from '../data/chefs'
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
      {/* overflowX hidden — 덜컹(translateX)이 가로 스크롤 흔적을 만들지 않게 */}
      <Box className="msd-fadein" sx={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ position: 'relative', px: 2.5 }}>
          <StatusBar />
          {/* 표제는 중앙 한 줄로 끝 — 제목+부제 2단은 그룹웨어 문법(운영자 260726 폐지) */}
          <Typography sx={{ mt: 0.5, textAlign: 'center', fontSize: 14.5, fontWeight: 700, color: tokens.color.ink, opacity: 0.82 }}>
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
          />
        </Box>
      </Box>
    </MyeongShell>
  )
}
