import { Box, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import StatusBar from '../components/StatusBar'
import MyeongShell from '../components/MyeongShell'
import { SectionTitle } from './Home'
import { tokens } from '../theme'
import { activeProfile, listProfiles, setActiveProfile } from '../data/profiles'
import { clearEntered } from '../data/session'

const press = { transition: 'transform .12s var(--ease)', '&:active': { transform: 'scale(0.98)' } }

/** 비활성 토글(알림 인프라 미구현 — 준비 중 정직 표기) */
function ToggleOff() {
  return (
    <Box sx={{ width: 44, height: 26, borderRadius: '100px', bgcolor: 'var(--c-border-strong)', position: 'relative', opacity: 0.55 }}>
      <Box sx={{ position: 'absolute', top: 3, left: 3, width: 20, height: 20, borderRadius: '50%', bgcolor: '#fff' }} />
    </Box>
  )
}

export default function Settings() {
  const nav = useNavigate()
  const profile = activeProfile()
  const profiles = listProfiles()

  const onExport = () => {
    const kst = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(/[-: ]/g, '').slice(0, 14)
    const stamp = `${kst.slice(0, 8)}_${kst.slice(8)}`
    const blob = new Blob([JSON.stringify({ app: '명식당', exportedAt: new Date().toISOString(), profiles }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${stamp}_명식당프로필_v1.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const row = (label: string, opts: { color?: string; right?: React.ReactNode; onClick?: () => void; last?: boolean; soon?: boolean } = {}) => (
    <Box
      onClick={opts.onClick}
      role={opts.onClick ? 'button' : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 1.6,
        borderBottom: opts.last ? 'none' : '1px solid var(--c-page)',
        cursor: opts.onClick ? 'pointer' : 'default',
        opacity: opts.soon ? 0.55 : 1,
      }}
    >
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: opts.color ?? tokens.color.ink }}>
        {label}
        {opts.soon && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-ink-faint)', marginLeft: 6 }}>준비 중</span>}
      </Typography>
      {opts.right ?? <Typography sx={{ color: tokens.color.inkFaint }}>›</Typography>}
    </Box>
  )

  return (
    <MyeongShell active="settings">
      <Box className="msd-fadein" sx={{ flex: 1, overflowY: 'auto' }}>
        <Box sx={{ px: 2.5, pb: '120px' }}>
          <StatusBar />
          <Typography sx={{ mt: 7, fontSize: 25, fontWeight: 800, color: tokens.color.ink }}>내 설정</Typography>

          {/* 프로필 카드 */}
          <Box className="glass" sx={{ mt: 2, borderRadius: '18px', p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 52, height: 52, borderRadius: '50%', bgcolor: tokens.color.primary, color: tokens.color.onPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, flex: '0 0 auto' }}>
              {profile?.name?.[0] ?? '명'}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color: tokens.color.ink }}>{profile?.name ?? '프로필 없음'}</Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.color.inkSub }}>
                {profile
                  ? `양 ${profile.year}/${String(profile.month).padStart(2, '0')}/${String(profile.day).padStart(2, '0')} ${profile.hourUnknown ? '시간 모름' : `${String(profile.hour).padStart(2, '0')}:${String(profile.minute).padStart(2, '0')}`} · ${profile.city}`
                  : '사주를 입력해 주세요'}
              </Typography>
            </Box>
            <Box
              onClick={() => nav('/input')}
              role="button"
              sx={{ height: 36, display: 'inline-flex', alignItems: 'center', px: 1.6, borderRadius: '100px', border: '1px solid rgba(34,64,158,.4)', color: tokens.color.primary, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,.5)', backdropFilter: 'blur(11px)', WebkitBackdropFilter: 'blur(11px)', ...press }}
            >
              {profile ? '수정' : '입력'}
            </Box>
          </Box>

          <SectionTitle>저장된 사주</SectionTitle>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {profiles.map((p) => {
              const on = p.id === profile?.id
              return (
                <Box
                  key={p.id}
                  onClick={() => {
                    if (!on) {
                      setActiveProfile(p.id)
                      nav(0)
                    }
                  }}
                  role="button"
                  sx={{ height: 36, display: 'inline-flex', alignItems: 'center', px: 1.6, borderRadius: '100px', fontSize: 12.5, fontWeight: 700, cursor: on ? 'default' : 'pointer', bgcolor: on ? tokens.color.primarySoft : 'rgba(255,255,255,.55)', border: on ? `1px solid ${tokens.color.primary}` : '1px solid rgba(255,255,255,.8)', backdropFilter: 'blur(11px)', WebkitBackdropFilter: 'blur(11px)', color: on ? tokens.color.primary : tokens.color.inkSub, ...press }}
                >
                  {p.name} · {String(p.year).slice(2)}년생
                </Box>
              )
            })}
            <Box
              onClick={() => nav('/input')}
              role="button"
              sx={{ height: 36, display: 'inline-flex', alignItems: 'center', px: 1.6, borderRadius: '100px', fontSize: 12.5, fontWeight: 700, bgcolor: 'rgba(255,255,255,.4)', border: '1px dashed var(--c-border-strong)', color: tokens.color.inkFaint, cursor: 'pointer', ...press }}
            >
              + 추가
            </Box>
          </Box>

          <SectionTitle>알림</SectionTitle>
          <Box sx={{ borderRadius: '14px', background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.8)', backdropFilter: 'blur(11px)', WebkitBackdropFilter: 'blur(11px)', px: 2, py: 0.5 }}>
            {row('아침 운세 알림 (08:00)', { right: <ToggleOff />, soon: true })}
            {row('신년운세·이벤트 소식', { right: <ToggleOff />, soon: true, last: true })}
          </Box>

          <SectionTitle>계정</SectionTitle>
          <Box sx={{ borderRadius: '14px', background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.8)', backdropFilter: 'blur(11px)', WebkitBackdropFilter: 'blur(11px)', px: 2, py: 0.5 }}>
            {row('구매 내역', { soon: true })}
            {row('데이터 내보내기', { onClick: onExport })}
            {row('로그아웃', {
              color: tokens.color.solar,
              last: true,
              onClick: () => {
                clearEntered()
                nav('/login')
              },
            })}
          </Box>

          <Typography sx={{ textAlign: 'center', fontSize: 11, color: tokens.color.inkFaint, mt: 2.75 }}>
            명식당 v0.1 · 입력 정보는 이 기기에만 저장돼요
          </Typography>
        </Box>
      </Box>
    </MyeongShell>
  )
}
