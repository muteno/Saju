import { useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Typography, OutlinedInput, Select, MenuItem, Button, Stack } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import Screen from '../components/Screen'
import StatusBar from '../components/StatusBar'
import { tokens } from '../theme'
import { mockProfile } from '../data/saju'

function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, mt: 2.5 }}>
      <Typography sx={{ fontSize: 15, fontWeight: 800, color: tokens.color.ink, letterSpacing: 'var(--tracking)' }}>{children}</Typography>
      {hint}
    </Box>
  )
}

const selectSx = { bgcolor: 'var(--c-card)', borderRadius: '12px', fontSize: 15, '& fieldset': { borderColor: tokens.color.border } }

function CorrectionChip({ text, on }: { text: string; on: boolean }) {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.6,
        py: 1.1,
        borderRadius: 100,
        bgcolor: on ? tokens.color.primarySoft : 'var(--c-card)',
        border: `1px solid ${on ? tokens.color.primary : tokens.color.border}`,
        color: on ? tokens.color.primary : tokens.color.inkSub,
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {on ? '✓' : ''} {text}
    </Box>
  )
}

export default function InfoInput() {
  const nav = useNavigate()
  const [gender, setGender] = useState(mockProfile.gender)
  const [cal, setCal] = useState(mockProfile.calendar)
  const [marital, setMarital] = useState(mockProfile.marital)
  const [name, setName] = useState(mockProfile.name)

  return (
    <Screen bg={tokens.color.page}>
      <StatusBar time="8:58" />
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, pb: 2 }}>
        <Typography sx={{ fontSize: 25, fontWeight: 800, letterSpacing: 'var(--tracking)', mt: 1, mb: 0.5 }}>
          정보를 입력해 주세요.
        </Typography>

        <Label>이름과 성별</Label>
        <Stack direction="row" spacing={1}>
          <OutlinedInput fullWidth value={name} onChange={(e) => setName(e.target.value)} sx={{ borderRadius: '12px', bgcolor: 'var(--c-card)' }} />
          <Select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)} sx={{ ...selectSx, width: 104 }}>
            <MenuItem value="여자">여자</MenuItem>
            <MenuItem value="남자">남자</MenuItem>
          </Select>
        </Stack>

        <Label hint={<Typography sx={{ fontSize: 12.5, color: tokens.color.inkFaint, fontWeight: 600 }}>◻ 시간 모름</Typography>}>
          생년월일시
        </Label>
        <Stack direction="row" spacing={1}>
          <Select value={cal} onChange={(e) => setCal(e.target.value as typeof cal)} sx={{ ...selectSx, width: 118 }}>
            <MenuItem value="양력">양력</MenuItem>
            <MenuItem value="음력">음력</MenuItem>
            <MenuItem value="음력(윤달)">음력(윤달)</MenuItem>
          </Select>
          <OutlinedInput fullWidth value={mockProfile.birth} readOnly sx={{ borderRadius: '12px', bgcolor: 'var(--c-card)', color: tokens.color.ink }} />
        </Stack>

        <Label>태어난 도시</Label>
        <OutlinedInput fullWidth value={mockProfile.city} readOnly startAdornment={<span style={{ marginRight: 8, opacity: 0.5 }}>🔍</span>} sx={{ borderRadius: '12px', bgcolor: 'var(--c-card)' }} />

        <Label>혼인 여부</Label>
        <Select value={marital} onChange={(e) => setMarital(e.target.value as typeof marital)} sx={{ ...selectSx, width: 148 }}>
          <MenuItem value="미혼">미혼</MenuItem>
          <MenuItem value="기혼">기혼</MenuItem>
        </Select>

        <Label hint={<Typography sx={{ fontSize: 13, color: tokens.color.inkFaint }}>❔</Typography>}>보정값 적용</Label>
        <Stack direction="row" spacing={1}>
          <CorrectionChip text="조후와 궁성 보정" on />
          <CorrectionChip text="합에 따른 오행 변화" on />
        </Stack>
      </Box>

      <Box sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
        <Typography sx={{ textAlign: 'center', fontSize: 13, color: tokens.color.inkFaint, mb: 1.2, fontWeight: 600 }}>
          ↻ 다른 사람 정보 입력하기
        </Typography>
        <Button fullWidth variant="contained" onClick={() => nav('/loading')} sx={{ py: 1.7, fontSize: 17, borderRadius: '14px' }}>
          사주 풀이하기
        </Button>
      </Box>
    </Screen>
  )
}
