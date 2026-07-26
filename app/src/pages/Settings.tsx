import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import StatusBar from '../components/StatusBar'
import MyeongShell from '../components/MyeongShell'
import { SectionTitle } from '../components/ReportParts'
import { tokens } from '../theme'
import { activeProfile, listProfiles, setActiveProfile } from '../data/profiles'
import { clearEntered } from '../data/session'
import { currentAccount, forgetAccount } from '../data/account'
import { DOSA_MODELS, dosaModel, setDosaModel } from '../data/prefs'

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
  const account = currentAccount()
  const [model, setModel] = useState(dosaModel())

  const onExport = () => {
    const kst = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(/[-: ]/g, '').slice(0, 14)
    const stamp = `${kst.slice(0, 8)}_${kst.slice(8)}`
    const blob = new Blob([JSON.stringify({ app: '연식당', exportedAt: new Date().toISOString(), profiles }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${stamp}_연식당프로필_v1.json`
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
          {/* 260726-b: 상단 햄버거 제거로 피할 크롬이 없다 → 7(=56px, 크롬 회피분)을 1.5로 되돌림 */}
          <Typography sx={{ mt: 1.5, fontSize: 25, fontWeight: 800, color: tokens.color.ink }}>내 설정</Typography>

          {/* 프로필 카드 */}
          <Box className="glass" sx={{ mt: 2, borderRadius: '14px', p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 52, height: 52, borderRadius: '50%', bgcolor: tokens.color.primary, color: tokens.color.onPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, flex: '0 0 auto' }}>
              {profile?.name?.[0] ?? '명'}
            </Box>
            {/* minWidth 0 + 말줄임 = 최장 이름이 카드를 밀어 '수정' 버튼과 세로 중앙을 어긋내던 것 해소
                (260725 실측: 이름 중심Y 197 vs 수정 206 = 9px · [E8] 기준 1px) */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 16, fontWeight: 800, color: tokens.color.ink }}>{profile?.name ?? '프로필 없음'}</Typography>
              <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, color: tokens.color.inkSub }}>
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
                  // maxWidth = 최장 이름에서 칩이 행을 다 먹고 '+ 추가'를 밀어내던 것 방어(여유 2자였다)
                  sx={{ height: 36, maxWidth: 230, display: 'inline-flex', alignItems: 'center', px: 1.6, borderRadius: '100px', fontSize: 12.5, fontWeight: 700, cursor: on ? 'default' : 'pointer', bgcolor: on ? tokens.color.primarySoft : 'rgba(255,255,255,.55)', border: on ? `1px solid ${tokens.color.primary}` : '1px solid rgba(255,255,255,.8)', backdropFilter: 'blur(11px)', WebkitBackdropFilter: 'blur(11px)', color: on ? tokens.color.primary : tokens.color.inkSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...press }}
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

          {/* 상담 — 연리 응답 모델(운영자 260726: 소넷5/오퍼스5 빠름 2종, 설정에서 전환) */}
          <SectionTitle>상담</SectionTitle>
          <Box sx={{ borderRadius: '14px', background: 'var(--glass)', border: '1px solid var(--glass-line)', backdropFilter: 'blur(11px)', WebkitBackdropFilter: 'blur(11px)', px: 2, py: 1.6 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.color.ink }}>{`연리 응답 모델`}</Typography>
            <Box sx={{ mt: 1.2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {DOSA_MODELS.map((m) => {
                const on = model === m.key
                return (
                  <Box
                    key={m.key}
                    onClick={() => {
                      setDosaModel(m.key)
                      setModel(m.key)
                    }}
                    role="button"
                    aria-pressed={on}
                    // 칩 규격 = 저장된 사주 칩 계승(h36 알약 · primarySoft 선택 문법)
                    sx={{ height: 36, display: 'inline-flex', alignItems: 'center', px: 1.6, borderRadius: '100px', fontSize: 12.5, fontWeight: 700, cursor: on ? 'default' : 'pointer', bgcolor: on ? tokens.color.primarySoft : 'var(--glass)', border: on ? `1px solid ${tokens.color.primary}` : '1px solid var(--glass-line)', color: on ? tokens.color.primary : tokens.color.inkSub, whiteSpace: 'nowrap', ...press }}
                  >
                    {m.label}
                  </Box>
                )
              })}
            </Box>
            <Typography sx={{ mt: 1, fontSize: 11.5, fontWeight: 600, color: tokens.color.inkFaint }}>
              {DOSA_MODELS.find((m) => m.key === model)?.desc}
            </Typography>
          </Box>

          <SectionTitle>알림</SectionTitle>
          <Box sx={{ borderRadius: '14px', background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.8)', backdropFilter: 'blur(11px)', WebkitBackdropFilter: 'blur(11px)', px: 2, py: 0.5 }}>
            {row('아침 운세 알림 (08:00)', { right: <ToggleOff />, soon: true })}
            {row('신년운세·이벤트 소식', { right: <ToggleOff />, soon: true, last: true })}
          </Box>

          <SectionTitle>계정</SectionTitle>
          <Box sx={{ borderRadius: '14px', background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.8)', backdropFilter: 'blur(11px)', WebkitBackdropFilter: 'blur(11px)', px: 2, py: 0.5 }}>
            {account &&
              row(`로그인 계정 · ${account.loginId}`, {
                right: (
                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.color.inkSub }}>
                    {account.streak > 1 ? `${account.streak}일 연속` : `${account.totalVisits}일째`}
                  </Typography>
                ),
              })}
            {row('구매 내역', { soon: true })}
            {row('데이터 내보내기', { onClick: onExport })}
            {/* 로그아웃 = 입장만 해제. 기억(아이디·스트릭)은 남겨 다음에 버튼 하나로 돌아온다 */}
            {row('로그아웃', {
              onClick: () => {
                clearEntered()
                nav('/login')
              },
            })}
            {/* 기억 삭제는 별도 행 — 되돌릴 수 없으니 로그아웃과 섞지 않는다 */}
            {row('이 기기에서 기억 지우기', {
              color: tokens.color.solar,
              last: true,
              onClick: () => {
                forgetAccount()
                clearEntered()
                nav('/login')
              },
            })}
          </Box>

          <Typography sx={{ textAlign: 'center', fontSize: 11, color: tokens.color.inkFaint, mt: 2.75 }}>
            연식당 v0.1 · 입력 정보는 이 기기에만 저장돼요
          </Typography>
        </Box>
      </Box>
    </MyeongShell>
  )
}
