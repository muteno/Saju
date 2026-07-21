import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { makeTheme } from './theme'
import type { Mode } from './theme'

const ModeCtx = createContext<{ mode: Mode; setMode: (m: Mode) => void; toggle: () => void }>({
  mode: 'light',
  setMode: () => {},
  toggle: () => {},
})

export const useMode = () => useContext(ModeCtx)

// 명식당 목업 v2(260721): 라이트 단일 테마 — 다크 모드 폐지(저장값 무시, 토글 UI 미노출).
// Mode 타입·프로바이더 골격은 유지(소비 코드 무파괴 · 되살릴 땐 이 함수만 복원).
function initialMode(): Mode {
  return 'light'
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(initialMode)

  useEffect(() => {
    document.documentElement.dataset.theme = mode
    // 브라우저 크롬(주소창) 색을 앱 내 수동 토글과 동조 — 미디어 분기 메타는 초기 폴백
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', mode === 'dark' ? '#131315' : '#22409e'))
    try {
      localStorage.setItem('saju-mode', mode)
    } catch {
      /* noop */
    }
  }, [mode])

  const value = useMemo(
    () => ({ mode, setMode, toggle: () => setMode(mode === 'light' ? 'dark' : 'light') }),
    [mode],
  )
  const theme = useMemo(() => makeTheme(mode), [mode])

  return (
    <ModeCtx.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ModeCtx.Provider>
  )
}
