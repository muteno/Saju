import { Box } from '@mui/material'
import type { ReactNode } from 'react'

/** 모바일 디바이스 셸. 좁은 뷰포트에선 꽉 차고 넓은 화면에선 폰처럼 보임 */
export default function Screen({ children, bg }: { children: ReactNode; bg?: string }) {
  return (
    <div className="device" style={bg ? { background: bg } : undefined}>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    </div>
  )
}
