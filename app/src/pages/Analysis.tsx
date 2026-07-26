import { Box, Typography, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import StatusBar from '../components/StatusBar'
import MyeongShell from '../components/MyeongShell'
import CharacterStage from '../components/CharacterStage'
import { DaeunRail, SectionTitle, GlassButton } from '../components/ReportParts'
import TopicAccordion from '../components/TopicAccordion'

import { tokens } from '../theme'
import { jeonggokRaw } from '../engine'
import { HOST_NAME, hasChef } from '../data/chefs'
import { buildTopicGroups } from '../data/analysisGroups'
import { useReport, stepPath } from '../data/useReport'

/**
 * 2단계 · 분석 — 「구체적으로 사주 분석 풀이」.
 *
 * 260725 3분할의 가운데 칸. 인트로(원국+오늘 점수)에서 더 파고든 사람이 오는 곳이고,
 * 여기서 근거를 다 본 사람이 상담(3단계)으로 간다.
 * 내용 = 리포트 전 섹션(구조판정·일주·십신·합충·신살·세운·에니어그램 보조지표) + 대운 레일.
 * 전엔 이게 /result 긴 스크롤의 뒷부분이었고, 이 화면은 요약 2섹션만 보여주는 중복 화면이었다.
 *
 * 260726 재편: 카드를 술사의 도구축 그대로 나열하던 것을 독자의 관심축(성향·관계·일·주의·올해)
 * 아코디언으로 묶었다 — 주제를 누르면 그 주제의 근거(기존 ReportCard 원형)만 펼쳐진다.
 * 매핑 = data/analysisGroups.ts(원문·출처 재배치 전용 · 남는 카드는 '그 밖의 근거'로 수렴).
 */
export default function Analysis() {
  const nav = useNavigate()
  const { resolved, chart, reading } = useReport()

  if (!chart || !reading) {
    return (
      <MyeongShell active="analysis" gate={false}>
        <StatusBar />
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, gap: 2 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: tokens.color.ink, textAlign: 'center', lineHeight: 1.6 }}>
            사주를 불러오지 못했어요.
            <br />
            생년월일시를 다시 확인해 주세요.
          </Typography>
          <Button variant="contained" onClick={() => nav('/input')}>정보 입력하기</Button>
        </Box>
      </MyeongShell>
    )
  }

  const day = chart.pillars.find((p) => p.title === '일')
  const ilju = day ? `${day.ganK}${day.jiK}` : ''
  const strength = (() => {
    if (resolved.hourUnknown) return null
    try {
      return jeonggokRaw(resolved.input).strength.label
    } catch {
      return null
    }
  })()
  const subline = [`일주 ${ilju}`, strength, resolved.hourUnknown ? '시간 모름' : null].filter(Boolean).join(' · ')

  return (
    <MyeongShell active="analysis" gate={false}>
      <Box className="msd-fadein" sx={{ flex: 1, overflowY: 'auto' }}>
        <CharacterStage>
          <StatusBar dark={hasChef()} />
          {hasChef() && <Box sx={{ flex: 1 }} />}
          {/* 260726-b: 상단 햄버거 제거로 피할 크롬이 없다 → 6.5(=52px, 크롬 회피분)를 1.5로 되돌림 */}
          <Box sx={{ px: 2.5, pb: hasChef() ? 1.75 : 0, pt: hasChef() ? 0 : 1.5, textAlign: hasChef() ? 'center' : 'left' }}>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: tokens.color.ink }}>
              {resolved.name ? `${resolved.name}님의 사주 분석` : '사주 분석'}
            </Typography>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: tokens.color.inkSub, mt: 0.4 }}>
              {reading.headline} · {subline}
            </Typography>
          </Box>
        </CharacterStage>

        <Box sx={{ px: 2.5, pb: '120px' }}>
          {/* 근거 리포트 — 독자 관심축 주제 아코디언(접힘 기본 · 누르면 그 주제의 근거만) */}
          {buildTopicGroups(reading).map((group) => (
            <TopicAccordion key={group.id} group={group} onFillHour={() => nav('/input')} />
          ))}

          {!resolved.hourUnknown && (
            <>
              <SectionTitle>대운 흐름</SectionTitle>
              <DaeunRail daeun={chart.daeun} birthYear={resolved.input.year} />
            </>
          )}

          {/* 다음 단계 = 3단계 상담 */}
          <SectionTitle>더 물어보기</SectionTitle>
          <GlassButton onClick={() => nav(stepPath('talk', resolved.search))}>{HOST_NAME}와 상담하기</GlassButton>
        </Box>
      </Box>
    </MyeongShell>
  )
}
