import { Box, Typography } from '@mui/material'
import StatusBar from '../components/StatusBar'
import MyeongShell, { Pict } from '../components/MyeongShell'
import { SectionTitle } from './Home'
import { tokens } from '../theme'
import type { ReactNode } from 'react'

/**
 * 사주 재미 — 목업 v2 구성. 실배선은 에니어그램(사주 심리 테스트)뿐이라
 * 나머지는 '준비 중' 정직 표기(거짓 액티브 금지 — 레포 관례).
 */
const CONTENTS: { icon: ReactNode; title: string; sub: string; href?: string }[] = [
  { icon: Pict.heart(24), title: '연예인과 사주 궁합 보기', sub: '내 최애와 나, 일주 관계로 보는 케미' },
  { icon: Pict.search(24), title: '내 일주 동물 찾기', sub: '60갑자 지신 캐릭터 — 나는 무슨 동물일까?' },
  { icon: Pict.book(24), title: '사주 심리 테스트', sub: '십신 성향으로 보는 나의 일·연애 스타일', href: '/enneagram/' },
  { icon: Pict.person(24), title: '사주 페르소나', sub: '내 원국을 한 장의 캐릭터 카드로' },
]

const RANKING = [
  { no: 1, catch: '별빛으로 그려내는 운명 프로필', title: '병오년 하반기 재물 흐름 보고서' },
  { no: 2, catch: '당신에게 끌리는 진짜 이유', title: '일주로 보는 인연의 온도' },
  { no: 3, catch: '묘하게 통하는 그 사람', title: '나에게 마음이 있을까?' },
]

function ContentCard({ item }: { item: (typeof CONTENTS)[number] }) {
  const inner = (
    <Box
      className="glass"
      role={item.href ? 'button' : undefined}
      sx={{
        borderRadius: '18px',
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1.75,
        cursor: item.href ? 'pointer' : 'default',
        transition: 'transform .12s var(--ease)',
        ...(item.href ? { '&:active': { transform: 'scale(0.98)' } } : {}),
      }}
    >
      <Box sx={{ width: 48, height: 48, borderRadius: '14px', bgcolor: tokens.color.primarySoft, color: tokens.color.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
        {item.icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.color.ink }}>{item.title}</Typography>
        <Typography sx={{ fontSize: 12.5, color: tokens.color.inkSub, fontWeight: 600, mt: 0.3 }}>{item.sub}</Typography>
      </Box>
      {item.href ? (
        <Typography sx={{ color: tokens.color.inkFaint, fontWeight: 800 }}>›</Typography>
      ) : (
        <Typography sx={{ fontSize: 11, color: tokens.color.inkFaint, fontWeight: 700 }}>준비 중</Typography>
      )}
    </Box>
  )
  return item.href ? (
    <a href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
      {inner}
    </a>
  ) : (
    inner
  )
}

export default function Fun() {
  return (
    <MyeongShell active="fun">
      <Box className="msd-fadein" sx={{ flex: 1, overflowY: 'auto' }}>
        <Box sx={{ px: 2.5, pb: '120px' }}>
          <StatusBar />
          <Typography sx={{ mt: 7, fontSize: 25, fontWeight: 800, color: tokens.color.ink }}>사주 재미</Typography>
          <Typography sx={{ fontSize: 13, color: tokens.color.inkSub, fontWeight: 600, mt: 0.5 }}>가볍게 즐기는 사주 콘텐츠 모음</Typography>

          {/* 검색바 — 콘텐츠 검색은 준비 중(시각 자리) */}
          <Box sx={{ mt: 2, borderRadius: '14px', background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.8)', backdropFilter: 'blur(11px)', WebkitBackdropFilter: 'blur(11px)', p: '13px 16px', display: 'flex', alignItems: 'center', gap: 1.2, color: tokens.color.inkFaint }}>
            {Pict.search(18)}
            <Typography sx={{ fontSize: 14, color: tokens.color.inkFaint, fontWeight: 600 }}>연예인 이름·일주 동물 검색 (준비 중)</Typography>
          </Box>

          <SectionTitle>인기 콘텐츠</SectionTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            {CONTENTS.map((c) => (
              <ContentCard key={c.title} item={c} />
            ))}
          </Box>

          <SectionTitle>실시간 인기 메뉴 — 준비 중</SectionTitle>
          <Box className="glass" sx={{ borderRadius: '18px', p: '6px 16px' }}>
            {RANKING.map((r, i) => (
              <Box key={r.no} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.4, borderBottom: i < RANKING.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.color.primary, fontStyle: 'italic', width: 14 }}>{r.no}</Typography>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: tokens.color.inkFaint }}>{r.catch}</Typography>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: tokens.color.ink }}>{r.title}</Typography>
                </Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.color.inkFaint }}>준비 중</Typography>
              </Box>
            ))}
          </Box>

          <SectionTitle>친구와 함께</SectionTitle>
          <Box sx={{ borderRadius: '18px', p: 2, bgcolor: tokens.color.primarySoft, border: '1px solid rgba(34,64,158,.2)' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: tokens.color.primary }}>궁합 리포트 공유하기</Typography>
            <Typography sx={{ fontSize: 12.5, color: tokens.color.inkSub, fontWeight: 600, mt: 0.4, lineHeight: 1.55 }}>
              친구의 생년월일만 알면 둘의 궁합 리포트를 만들어 보낼 수 있어요. (준비 중)
            </Typography>
          </Box>
        </Box>
      </Box>
    </MyeongShell>
  )
}
