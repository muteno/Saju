/**
 * 주제 아코디언(260726) — 분석 화면 재편의 껍데기. 접힘이 기본, 누르면 그 주제의 근거
 * (기존 ReportCard 원형 그대로)만 펼친다. 여러 주제 동시 펼침 허용 — 근거를 나란히 놓고
 * 견주는 화면이라, 하나 열면 하나 닫히는 배타식은 비교 독서를 방해해서 기각.
 *
 * 값 전량 계승(B1): 유리 판 = `.glass` + r18(ReportCard 카드) · 헤더 높이 52(GlassButton h52) ·
 * 제목 15/800(SectionTitle) · 배지 = ReportCard 칩 문법 · 화살표 = Pict.chevronDown(정본 픽토그램) ·
 * 눌림 = scale(0.98)+var(--ease) 공통 문법 · 등장 = .msd-fadein.
 */
import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { tokens } from '../theme'
import { Pict } from './MyeongShell'
import { ReportCard } from './ReportParts'
import { evidenceCount, type TopicGroup } from '../data/analysisGroups'

export default function TopicAccordion({ group, onFillHour }: { group: TopicGroup; onFillHour?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Box>
      <Box
        role="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="glass"
        sx={{
          minHeight: 52, // 탭 타깃 — GlassButton h52 계승(HIG 하한 44 위)
          mt: 1.2,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderRadius: '14px',
          cursor: 'pointer',
          transition: 'transform .12s var(--ease)',
          '&:active': { transform: 'scale(0.98)' },
        }}
      >
        <Typography sx={{ flex: 1, fontSize: 15, fontWeight: 800, color: tokens.color.ink }}>{group.title}</Typography>
        <Box
          sx={{
            px: 1.2,
            py: 0.4,
            borderRadius: 100,
            bgcolor: 'var(--c-card)',
            border: `1px solid ${tokens.color.border}`,
            fontSize: 11.5,
            fontWeight: 700,
            color: tokens.color.inkSub,
            flex: '0 0 auto',
          }}
        >
          근거 {evidenceCount(group)}
        </Box>
        <Box
          sx={{
            display: 'flex',
            color: tokens.color.inkSub,
            transition: 'transform .12s var(--ease)',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        >
          {Pict.chevronDown()}
        </Box>
      </Box>
      {open && (
        <Box className="msd-fadein">
          {group.cards.map((card) => (
            <ReportCard key={card.id} card={card} onFillHour={card.id === 'hour-unknown' ? onFillHour : undefined} />
          ))}
        </Box>
      )}
    </Box>
  )
}
