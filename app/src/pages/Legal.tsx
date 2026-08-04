import { Box, Typography } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import Screen from '../components/Screen'
import StatusBar from '../components/StatusBar'
import { tokens } from '../theme'
import { TERMS, PRIVACY, LEGAL_VERSION, type LegalArticle } from '../data/legal'

const press = { transition: 'transform .12s var(--ease)', '&:active': { transform: 'scale(0.98)' } }

/** 뒤로 원형 버튼 — Auth.tsx BackCircle 동일 값 계승(페이지 로컬 헬퍼 관례) */
function BackCircle({ onClick }: { onClick: () => void }) {
  return (
    <Box onClick={onClick} role="button" aria-label="뒤로" sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: tokens.color.primarySoft, color: tokens.color.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, cursor: 'pointer', flex: '0 0 auto', ...press }}>
      ‹
    </Box>
  )
}

/**
 * 법무 문서 열람 — YETA 약관 시트(READ ONLY 열람) 문법의 이 레포판.
 * 골격 = 회원가입 화면 계승(Screen·StatusBar·BackCircle·글래스 카드) · 문서 정본 = data/legal.ts.
 * 진입 = 회원가입 동의 행 · 설정 「약관·정책」 · 직접 URL(/terms·/privacy).
 */
function LegalDoc({ title, tag, articles }: { title: string; tag: string; articles: LegalArticle[] }) {
  const nav = useNavigate()
  const loc = useLocation()
  /** 직접 URL 진입(첫 히스토리)이면 되돌아갈 화면이 없다 → 설정으로 */
  const back = () => (loc.key === 'default' ? nav('/settings') : nav(-1))
  return (
    <Screen>
      <Box className="msd-fadein" sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <StatusBar />
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, m: '8px 0 4px' }}>
            <BackCircle onClick={back} />
            <Typography sx={{ fontSize: 25, fontWeight: 800, color: tokens.color.ink }}>{title}</Typography>
          </Box>
          <Typography sx={{ fontSize: 13, color: tokens.color.inkSub, fontWeight: 600, m: '6px 0 18px' }}>{tag}</Typography>
          <Box className="glass" sx={{ borderRadius: '14px', px: 2, py: 0.5 }}>
            {articles.map(([t, b], i) => (
              <Box key={t} sx={{ py: 1.4, borderBottom: i === articles.length - 1 ? 'none' : '1px solid var(--c-page)' }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: tokens.color.ink }}>{t}</Typography>
                <Typography sx={{ mt: 0.6, fontSize: 12.5, fontWeight: 600, color: tokens.color.inkSub, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{b}</Typography>
              </Box>
            ))}
          </Box>
          <Typography sx={{ textAlign: 'center', fontSize: 11, color: tokens.color.inkFaint, m: '22px 0', lineHeight: 1.6 }}>
            {LEGAL_VERSION} · 열람 전용 — 개정은 이 화면 게시로 고지돼요
          </Typography>
        </Box>
      </Box>
    </Screen>
  )
}

export function Terms() {
  return <LegalDoc title="이용약관" tag="15개조 — 열람 전용" articles={TERMS} />
}

export function Privacy() {
  return <LegalDoc title="개인정보 처리방침" tag="개인정보 보호법 제30조에 따른 공개 — 기기 저장 우선 구조" articles={PRIVACY} />
}
