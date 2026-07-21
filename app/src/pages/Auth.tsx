import { Box, Typography, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import Screen from '../components/Screen'
import StatusBar from '../components/StatusBar'
import { tokens } from '../theme'
import { setEntered } from '../data/session'
import { chefPlate } from '../data/chefs'

const PLATE = chefPlate()
const press = { transition: 'transform .12s var(--ease)', '&:active': { transform: 'scale(0.98)' } }

/** 글래스 입력(목업 v2: h50·r14 / 폼 필드 r12, blur 11) */
const inputStyle: React.CSSProperties = {
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,.7)',
  background: 'rgba(255,255,255,.5)',
  backdropFilter: 'blur(11px)',
  WebkitBackdropFilter: 'blur(11px)',
  padding: '15px 16px',
  fontFamily: 'inherit',
  fontSize: 15,
  color: 'var(--c-ink)',
  outline: 'none',
  letterSpacing: 'var(--tracking)',
  width: '100%',
  boxSizing: 'border-box',
}
const fieldStyle: React.CSSProperties = { ...inputStyle, borderRadius: 12, border: '1px solid rgba(255,255,255,.8)', background: 'rgba(255,255,255,.55)', padding: 14 }

function FieldLabel({ children, first = false }: { children: string; first?: boolean }) {
  return <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.color.ink, mt: first ? 0 : 2.2, mb: 1 }}>{children}</Typography>
}

function BackCircle({ onClick }: { onClick: () => void }) {
  return (
    <Box onClick={onClick} role="button" aria-label="뒤로" sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: tokens.color.primarySoft, color: tokens.color.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, cursor: 'pointer', flex: '0 0 auto', ...press }}>
      ‹
    </Box>
  )
}

/** 보조 액션 필 버튼(이메일 인증·인증번호 — 백엔드 미구현 = 준비 중 정직 비활성) */
function SoonPill({ label }: { label: string }) {
  return (
    <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', px: 2, borderRadius: '14px', border: '1px solid rgba(34,64,158,.4)', background: 'rgba(255,255,255,.5)', backdropFilter: 'blur(11px)', WebkitBackdropFilter: 'blur(11px)', color: tokens.color.primary, fontSize: 13, fontWeight: 700, opacity: 0.55 }}>
      {label}
    </Box>
  )
}

/**
 * 로그인 — 목업 v2. 계정 서버는 로드맵(미구현)이라 자격 검증 없이 기기 로컬 입장만 기록
 * ("입력 정보는 이 기기에만 저장돼요"). 프로필 보유 재방문자는 이 화면을 거치지 않는다.
 */
export function Login() {
  const nav = useNavigate()
  const enter = () => {
    setEntered()
    nav('/loading?flow=enter', { replace: true })
  }
  return (
    <Screen>
      <Box className="msd-fadein" sx={{ position: 'absolute', inset: 0 }}>
        <Box sx={{ position: 'absolute', inset: 0, backgroundImage: `url('${PLATE}')`, backgroundSize: 'cover', backgroundPosition: 'top center', opacity: 0.18 }} />
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(238,240,246,.3) 0%, rgba(238,240,246,.92) 60%)' }} />
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', px: 3.5 }}>
          <StatusBar />
          <Box sx={{ mt: 12, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: tokens.color.inkSub }}>당신의 운명을 위한 오늘의 한 상</Typography>
            <Typography sx={{ fontSize: 44, fontWeight: 800, color: tokens.color.primary, mt: 1 }}>명식당</Typography>
          </Box>
          <Box sx={{ mt: 7, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            <input placeholder="아이디 또는 이메일" style={inputStyle} aria-label="아이디 또는 이메일" />
            <input type="password" placeholder="비밀번호" style={inputStyle} aria-label="비밀번호" />
            <Button fullWidth variant="contained" onClick={enter} sx={{ mt: 0.5 }}>
              로그인
            </Button>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.75, mt: 2, fontSize: 13, fontWeight: 700, color: tokens.color.inkSub }}>
            <Typography onClick={() => nav('/signup')} role="button" sx={{ fontSize: 13, fontWeight: 700, cursor: 'pointer', color: tokens.color.primary }}>회원가입</Typography>
            <Typography sx={{ fontSize: 13, color: 'var(--c-border-strong)' }}>|</Typography>
            <Typography onClick={() => nav('/find')} role="button" sx={{ fontSize: 13, fontWeight: 700, cursor: 'pointer', color: tokens.color.inkSub }}>아이디·비밀번호 찾기</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mt: 3.5 }}>
            <Box sx={{ flex: 1, height: '1px', background: 'rgba(20,24,45,.1)' }} />
            <Typography sx={{ fontSize: 11.5, color: tokens.color.inkFaint, fontWeight: 700 }}>간편 로그인</Typography>
            <Box sx={{ flex: 1, height: '1px', background: 'rgba(20,24,45,.1)' }} />
          </Box>
          <Box sx={{ mt: 1.75, p: '13px 16px', borderRadius: '14px', border: '1px dashed var(--c-border-strong)', textAlign: 'center', fontSize: 12.5, fontWeight: 600, color: tokens.color.inkFaint }}>
            소셜 로그인 준비 중
          </Box>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ textAlign: 'center', fontSize: 11, color: tokens.color.inkFaint, pb: 2.75, lineHeight: 1.6 }}>
            입력 정보는 이 기기에만 저장돼요
          </Typography>
        </Box>
      </Box>
    </Screen>
  )
}

/** 회원가입 — 목업 v2(약관 카드 포함). 가입 처리 = 로컬 입장(계정 서버 준비 중). */
export function Signup() {
  const nav = useNavigate()
  const enter = () => {
    setEntered()
    nav('/loading?flow=enter', { replace: true })
  }
  const agree = (label: string, on: boolean, last = false) => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.3, borderBottom: last ? 'none' : '1px solid var(--c-page)' }}>
      <Typography sx={{ fontSize: label === '전체 동의' ? 13.5 : 12.5, fontWeight: label === '전체 동의' ? 700 : 600, color: label === '전체 동의' ? tokens.color.ink : tokens.color.inkSub }}>{label}</Typography>
      <Typography sx={{ color: on ? tokens.color.primary : 'var(--c-border-strong)', fontWeight: 800 }}>✓</Typography>
    </Box>
  )
  return (
    <Screen>
      <Box className="msd-fadein" sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <StatusBar />
        <Box sx={{ flex: 1, overflowY: 'auto', px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, m: '8px 0 4px' }}>
            <BackCircle onClick={() => nav('/login')} />
            <Typography sx={{ fontSize: 25, fontWeight: 800, color: tokens.color.ink }}>회원가입</Typography>
          </Box>
          <Typography sx={{ fontSize: 13, color: tokens.color.inkSub, fontWeight: 600, m: '6px 0 22px' }}>사주 프로필은 가입 후 언제든 추가할 수 있어요.</Typography>
          <FieldLabel first>이메일</FieldLabel>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <input placeholder="you@example.com" style={{ ...fieldStyle, flex: 1, minWidth: 0 }} aria-label="이메일" />
            <SoonPill label="인증" />
          </Box>
          <FieldLabel>비밀번호</FieldLabel>
          <input type="password" placeholder="8자 이상, 영문+숫자" style={fieldStyle} aria-label="비밀번호" />
          <FieldLabel>비밀번호 확인</FieldLabel>
          <input type="password" placeholder="한 번 더 입력" style={fieldStyle} aria-label="비밀번호 확인" />
          <FieldLabel>닉네임</FieldLabel>
          <input placeholder="별명도 좋아요" style={fieldStyle} aria-label="닉네임" />
          <Box sx={{ mt: 2.75, borderRadius: '14px', background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.8)', backdropFilter: 'blur(11px)', WebkitBackdropFilter: 'blur(11px)', px: 1.75, py: 0.5 }}>
            {agree('전체 동의', true)}
            {agree('[필수] 서비스 이용약관', true)}
            {agree('[필수] 개인정보 처리방침', true)}
            {agree('[선택] 운세 알림 받기', false, true)}
          </Box>
        </Box>
        <Box sx={{ p: '10px 24px 22px' }}>
          <Button fullWidth variant="contained" onClick={enter}>
            가입하고 시작하기
          </Button>
        </Box>
      </Box>
    </Screen>
  )
}

/** 아이디·비밀번호 찾기 — 목업 v2. 문자 인증 서버는 준비 중(정직 비활성). */
export function Find() {
  const nav = useNavigate()
  return (
    <Screen>
      <Box className="msd-fadein" sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        <StatusBar />
        <Box sx={{ flex: 1, px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, m: '8px 0 4px' }}>
            <BackCircle onClick={() => nav('/login')} />
            <Typography sx={{ fontSize: 25, fontWeight: 800, color: tokens.color.ink }}>아이디·비밀번호 찾기</Typography>
          </Box>
          <Box sx={{ display: 'flex', m: '20px 0 22px', borderRadius: '100px', background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.8)', backdropFilter: 'blur(11px)', WebkitBackdropFilter: 'blur(11px)', p: '4px' }}>
            <Box sx={{ flex: 1, textAlign: 'center', py: 1.25, borderRadius: '100px', bgcolor: tokens.color.primarySoft, border: `1px solid ${tokens.color.primary}`, color: tokens.color.primary, fontSize: 13, fontWeight: 800 }}>아이디 찾기</Box>
            <Box sx={{ flex: 1, textAlign: 'center', py: 1.25, borderRadius: '100px', color: tokens.color.inkSub, fontSize: 13, fontWeight: 700, opacity: 0.55 }}>비밀번호 재설정</Box>
          </Box>
          <Typography sx={{ fontSize: 14, color: tokens.color.inkSub, fontWeight: 600, lineHeight: 1.6 }}>
            가입할 때 사용한 휴대폰 번호를 입력하면
            <br />
            아이디를 문자로 알려드려요.
          </Typography>
          <FieldLabel>휴대폰 번호</FieldLabel>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <input placeholder="010-0000-0000" style={{ ...fieldStyle, flex: 1, minWidth: 0 }} aria-label="휴대폰 번호" />
            <SoonPill label="인증번호 받기" />
          </Box>
          <FieldLabel>인증번호</FieldLabel>
          <input placeholder="6자리 입력" style={fieldStyle} aria-label="인증번호" />
          <Box sx={{ mt: 1.75, borderRadius: '14px', bgcolor: tokens.color.primarySoft, border: '1px solid rgba(34,64,158,.2)', p: '12px 14px' }}>
            <Typography sx={{ fontSize: 12.5, color: tokens.color.primary, fontWeight: 600, lineHeight: 1.55 }}>
              ✦ 계정 서비스는 준비 중이에요. 지금은 로그인 없이도 이 기기에 사주를 저장해 쓸 수 있어요.
            </Typography>
          </Box>
        </Box>
        <Box sx={{ p: '10px 24px 22px' }}>
          <Button fullWidth variant="contained" onClick={() => nav('/login')}>
            확인
          </Button>
        </Box>
      </Box>
    </Screen>
  )
}
