import { Box } from '@mui/material'

/** iOS 스타일 가짜 상태바 (모바일 프레임 상단) */
export default function StatusBar({ dark = false, time = '8:58' }: { dark?: boolean; time?: string }) {
  const c = dark ? '#fff' : '#1B1B1F'
  return (
    <Box
      sx={{
        height: 44,
        px: 2.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: c,
        fontWeight: 700,
        fontSize: 15,
        letterSpacing: '-0.02em',
        userSelect: 'none',
        position: 'relative',
        zIndex: 5,
      }}
    >
      <span>{time}</span>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
        {/* signal */}
        <svg width="18" height="12" viewBox="0 0 18 12" fill={c} aria-hidden>
          <rect x="0" y="8" width="3" height="4" rx="1" />
          <rect x="5" y="5" width="3" height="7" rx="1" />
          <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" opacity="0.35" />
        </svg>
        {/* wifi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden>
          <path d="M8 10.5l2-2.4a3 3 0 00-4 0l2 2.4z" fill={c} />
          <path d="M3.4 5.9a7 7 0 019.2 0" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M5.4 8.1a4 4 0 015.2 0" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {/* battery */}
        <svg width="26" height="13" viewBox="0 0 26 13" fill="none" aria-hidden>
          <rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke={c} opacity="0.5" />
          <rect x="2" y="2" width="16" height="9" rx="2" fill={c} />
          <rect x="24" y="4" width="2" height="5" rx="1" fill={c} opacity="0.5" />
        </svg>
      </Box>
    </Box>
  )
}
