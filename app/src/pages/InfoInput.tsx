import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography, OutlinedInput, Select, MenuItem, Button, Stack } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import Screen from '../components/Screen'
import StatusBar from '../components/StatusBar'
import { tokens } from '../theme'
import { computeChartUI } from '../engine'
import { CITIES } from '../data/cities'
import { listProfiles, saveProfile, setActiveProfile, profileToInput, profileToSearch, type StoredProfile } from '../data/profiles'

function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, mt: 2.5 }}>
      <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.color.ink, letterSpacing: 'var(--tracking)' }}>{children}</Typography>
      {hint}
    </Box>
  )
}

const selectSx = { bgcolor: 'var(--c-card)', borderRadius: '12px', fontSize: 15, '& fieldset': { borderColor: tokens.color.border } }
const numSx = { borderRadius: '12px', bgcolor: 'var(--c-card)', '& input': { textAlign: 'center' } }

/** 켬/끔 칩(정본 부품: ON/OFF=토글) — 눌러서 전환 */
function CorrectionChip({ text, on, onClick, disabled }: { text: string; on: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <Box
      onClick={disabled ? undefined : onClick}
      role="button"
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.6,
        py: 1.4,
        borderRadius: 100,
        bgcolor: on ? tokens.color.primarySoft : 'var(--c-card)',
        border: `1px solid ${on ? tokens.color.primary : tokens.color.border}`,
        color: on ? tokens.color.primary : tokens.color.inkSub,
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'transform .12s var(--ease)',
        '&:active': disabled ? {} : { transform: 'scale(0.98)' },
      }}
    >
      {on ? '✓' : ''} {text}
    </Box>
  )
}

const num = (s: string) => (/^\d+$/.test(s.trim()) ? parseInt(s.trim(), 10) : NaN)

export default function InfoInput() {
  const nav = useNavigate()
  const saved = listProfiles()
  const [loadedId, setLoadedId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [gender, setGender] = useState<'여자' | '남자'>('여자')
  const [cal, setCal] = useState<'양력' | '음력' | '음력(윤달)'>('양력')
  const [y, setY] = useState('')
  const [mo, setMo] = useState('')
  const [d, setD] = useState('')
  const [hh, setHh] = useState('')
  const [mi, setMi] = useState('')
  const [hourUnknown, setHourUnknown] = useState(false)
  const [city, setCity] = useState('서울')
  const [marital, setMarital] = useState<'미혼' | '기혼'>('미혼')
  const [solarCorr, setSolarCorr] = useState(true)
  const [lateZi, setLateZi] = useState(false)
  const [error, setError] = useState('')
  const [errField, setErrField] = useState('')

  // 숫자 필드 자동 포커스 체인(년 4자리 → 월 → 일 → 시 → 분) — 타이핑 피커화
  const moRef = useRef<HTMLInputElement | null>(null)
  const dRef = useRef<HTMLInputElement | null>(null)
  const hhRef = useRef<HTMLInputElement | null>(null)
  const miRef = useRef<HTMLInputElement | null>(null)
  const numChange = (set: (v: string) => void, max: number, next?: React.RefObject<HTMLInputElement | null>) => (e: { target: { value: string } }) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, max)
    set(v)
    if (v.length === max) next?.current?.focus()
  }
  const fail = (field: string, msg: string) => {
    setErrField(field)
    setError(msg)
  }

  const loadProfile = (p: StoredProfile) => {
    setLoadedId(p.id)
    setName(p.name)
    setGender(p.gender)
    setCal('양력')
    setY(String(p.year))
    setMo(String(p.month))
    setD(String(p.day))
    setHh(p.hourUnknown ? '' : String(p.hour).padStart(2, '0'))
    setMi(p.hourUnknown ? '' : String(p.minute).padStart(2, '0'))
    setHourUnknown(p.hourUnknown)
    setCity(p.city)
    setMarital(p.marital)
    setSolarCorr(p.solarCorrection !== false)
    setLateZi(!!p.lateZi)
    setError('')
  }

  const onSubmit = () => {
    const year = num(y)
    const month = num(mo)
    const day = num(d)
    const hour = hourUnknown ? 12 : num(hh)
    const minute = hourUnknown ? 0 : mi.trim() === '' ? 0 : num(mi)

    setErrField('')
    if (!name.trim()) return fail('name', '이름(별명도 좋아요)을 입력해 주세요.')
    if (!Number.isInteger(year) || year < 1900 || year > 2100) return fail('y', '출생 연도는 1900~2100년만 지원해요.')
    if (!Number.isInteger(month) || month < 1 || month > 12) return fail('mo', '월은 1~12 사이로 입력해 주세요.')
    const dt = new Date(Date.UTC(year, month - 1, day))
    if (!Number.isInteger(day) || day < 1 || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day)
      return fail('d', '실제로 있는 날짜인지 확인해 주세요.')
    if (!hourUnknown) {
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) return fail('hh', '시각은 0~23시로 입력해 주세요. 모르면 「시간 모름」을 켜세요.')
      if (!Number.isInteger(minute) || minute < 0 || minute > 59) return fail('mi', '분은 0~59로 입력해 주세요.')
    }

    const profile = saveProfile({
      name: name.trim(),
      gender,
      calendar: '양력',
      year,
      month,
      day,
      hour,
      minute,
      hourUnknown,
      city,
      marital,
      solarCorrection: solarCorr,
      lateZi,
    })
    setActiveProfile(profile.id)

    try {
      const input = profileToInput(profile)
      const chart = computeChartUI(input)
      nav(`/loading?${profileToSearch(profile)}`, { state: { chart, input, profile } })
    } catch {
      fail('y', '만세력 계산 범위를 벗어났어요. 날짜를 다시 확인해 주세요.')
    }
  }

  return (
    <Screen>
      <StatusBar />
      {/* pb 40 = 스크롤 끝에서 마지막 섹션(보정값)이 고정 CTA에 붙어 잘려 보이던 것 해소(260725 실측) */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, pb: 5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mt: 1, mb: 0.5 }}>
          {/* 뒤로가기 — 인앱 이탈 수단(CircleBtn 규격 계승) */}
          <Box
            onClick={() => (window.history.length <= 1 ? nav('/') : nav(-1))}
            role="button"
            aria-label="뒤로"
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              bgcolor: tokens.color.primarySoft,
              color: tokens.color.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 17,
              cursor: 'pointer',
              flex: '0 0 auto',
              transition: 'transform .12s var(--ease)',
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            ‹
          </Box>
          <Typography sx={{ fontSize: 25, fontWeight: 800, letterSpacing: 'var(--tracking)' }}>정보를 입력해 주세요.</Typography>
        </Box>

        {saved.length > 0 && (
          <>
            {/* ⚠신규: 저장된 프로필 불러오기 칩 행(가로 스크롤) — 재방문 재입력 제거 */}
            <Label>저장된 사주</Label>
            <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
              {saved.map((p) => (
                <Box
                  key={p.id}
                  onClick={() => loadProfile(p)}
                  role="button"
                  sx={{
                    flex: '0 0 auto',
                    px: 1.6,
                    py: 1.3,
                    borderRadius: 100,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    bgcolor: loadedId === p.id ? tokens.color.primarySoft : 'var(--c-card)',
                    border: `1px solid ${loadedId === p.id ? tokens.color.primary : tokens.color.border}`,
                    color: loadedId === p.id ? tokens.color.primary : tokens.color.inkSub,
                    transition: 'transform .12s var(--ease)',
                    '&:active': { transform: 'scale(0.98)' },
                  }}
                >
                  {p.name} · {String(p.year).slice(2)}년생
                </Box>
              ))}
            </Box>
          </>
        )}

        <Label>이름과 성별</Label>
        <Stack direction="row" spacing={1}>
          <OutlinedInput
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="별명도 좋아요"
            error={errField === 'name'}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputProps={{ 'aria-label': '이름' }}
            sx={{ borderRadius: '12px', bgcolor: 'var(--c-card)' }}
          />
          <Select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)} aria-label="성별" sx={{ ...selectSx, width: 104 }}>
            <MenuItem value="여자">여자</MenuItem>
            <MenuItem value="남자">남자</MenuItem>
          </Select>
        </Stack>

        <Label>생년월일</Label>
        <Stack direction="row" spacing={1}>
          <Select value={cal} onChange={(e) => setCal(e.target.value as typeof cal)} aria-label="달력 종류" sx={{ ...selectSx, width: 118 }}>
            <MenuItem value="양력">양력</MenuItem>
            <MenuItem value="음력" disabled>음력 (준비 중)</MenuItem>
            <MenuItem value="음력(윤달)" disabled>음력(윤달) (준비 중)</MenuItem>
          </Select>
          <OutlinedInput
            value={y}
            onChange={numChange(setY, 4, moRef)}
            placeholder="1990"
            error={errField === 'y'}
            endAdornment={<span style={{ fontSize: 12.5, color: 'var(--c-ink-sub)' }}>년</span>}
            inputProps={{ 'aria-label': '출생 연도', inputMode: 'numeric' }}
            sx={{ ...numSx, flex: 1.3 }}
          />
          <OutlinedInput
            value={mo}
            onChange={numChange(setMo, 2, dRef)}
            inputRef={moRef}
            placeholder="01"
            error={errField === 'mo'}
            endAdornment={<span style={{ fontSize: 12.5, color: 'var(--c-ink-sub)' }}>월</span>}
            inputProps={{ 'aria-label': '출생 월', inputMode: 'numeric' }}
            sx={{ ...numSx, flex: 1 }}
          />
          <OutlinedInput
            value={d}
            onChange={numChange(setD, 2, hhRef)}
            inputRef={dRef}
            placeholder="01"
            error={errField === 'd'}
            endAdornment={<span style={{ fontSize: 12.5, color: 'var(--c-ink-sub)' }}>일</span>}
            inputProps={{ 'aria-label': '출생 일', inputMode: 'numeric' }}
            sx={{ ...numSx, flex: 1 }}
          />
        </Stack>

        <Label
          hint={
            <Typography
              onClick={() => setHourUnknown((v) => !v)}
              role="button"
              sx={{
                fontSize: 12.5,
                color: hourUnknown ? tokens.color.primary : tokens.color.inkSub,
                fontWeight: 700,
                cursor: 'pointer',
                userSelect: 'none',
                py: 1.5,
                my: -1.5,
                px: 1,
                mx: -1,
              }}
            >
              {hourUnknown ? '☑' : '◻'} 시간 모름
            </Typography>
          }
        >
          태어난 시간
        </Label>
        <Stack direction="row" spacing={1} sx={{ opacity: hourUnknown ? 0.45 : 1 }}>
          <OutlinedInput
            value={hh}
            onChange={numChange(setHh, 2, miRef)}
            inputRef={hhRef}
            placeholder="08"
            error={errField === 'hh'}
            disabled={hourUnknown}
            endAdornment={<span style={{ fontSize: 12.5, color: 'var(--c-ink-sub)' }}>시</span>}
            inputProps={{ 'aria-label': '출생 시', inputMode: 'numeric' }}
            sx={{ ...numSx, flex: 1 }}
          />
          <Box sx={{ alignSelf: 'center', fontWeight: 800, color: tokens.color.inkFaint }}>:</Box>
          <OutlinedInput
            value={mi}
            onChange={numChange(setMi, 2)}
            inputRef={miRef}
            placeholder="00"
            error={errField === 'mi'}
            disabled={hourUnknown}
            endAdornment={<span style={{ fontSize: 12.5, color: 'var(--c-ink-sub)' }}>분</span>}
            inputProps={{ 'aria-label': '출생 분', inputMode: 'numeric' }}
            sx={{ ...numSx, flex: 1 }}
          />
        </Stack>

        <Label>태어난 도시</Label>
        <Select fullWidth value={city} onChange={(e) => setCity(e.target.value)} aria-label="태어난 도시" sx={selectSx} MenuProps={{ slotProps: { paper: { sx: { maxHeight: 300 } } } }}>
          {CITIES.map((c) => (
            <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
          ))}
        </Select>

        <Label hint={<Typography sx={{ fontSize: 12.5, color: tokens.color.inkSub, fontWeight: 700 }}>선택 · 풀이 말투에만 참고</Typography>}>
          혼인 여부
        </Label>
        <Select value={marital} onChange={(e) => setMarital(e.target.value as typeof marital)} aria-label="혼인 여부" sx={{ ...selectSx, width: 148 }}>
          <MenuItem value="미혼">미혼</MenuItem>
          <MenuItem value="기혼">기혼</MenuItem>
        </Select>

        <Label>보정값 적용</Label>
        <Stack direction="row" spacing={1}>
          <CorrectionChip text="진태양시 보정" on={solarCorr} onClick={() => setSolarCorr((v) => !v)} />
          <CorrectionChip text="야자시 적용" on={lateZi} onClick={() => setLateZi((v) => !v)} disabled={hourUnknown} />
        </Stack>
        <Typography sx={{ fontSize: 11.5, color: tokens.color.inkSub, mt: 0.8, lineHeight: 1.5 }}>
          진태양시 = 출생지 경도로 시간을 바로잡는 보정 · 야자시 = 밤 11시대를 당일로 볼지의 유파 선택
        </Typography>
      </Box>

      <Box sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
        {/* 에러는 고정 푸터(제출 버튼 위) — 스크롤 폴드 아래로 숨지 않게(260718 실측 수선) */}
        {error && (
          <Typography sx={{ fontSize: 13, color: tokens.color.solar, fontWeight: 700, pb: 1.2, textAlign: 'center' }}>{error}</Typography>
        )}
        <Button fullWidth variant="contained" onClick={onSubmit}>
          사주 풀이하기
        </Button>
      </Box>
    </Screen>
  )
}
