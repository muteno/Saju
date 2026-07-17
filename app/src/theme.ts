import { createTheme } from '@mui/material/styles'

/**
 * 디자인 토큰. 색은 CSS 변수(index.css의 :root / [data-theme=dark])를 가리켜
 * 라이트/다크가 자동 전환된다. 오행 색은 의미색이라 모드 공통.
 * 강조색: 라이트=코발트+남색 딥블루, 다크=네온 레몬.
 */
export const tokens = {
  color: {
    page: 'var(--c-page)',
    card: 'var(--c-card)',
    elev: 'var(--glass)',
    accent: 'var(--accent)',
    ink: 'var(--c-ink)',
    inkSub: 'var(--c-ink-sub)',
    inkFaint: 'var(--c-ink-faint)',
    border: 'var(--c-border)',
    borderStrong: 'var(--c-border-strong)',
    primary: 'var(--c-primary)',
    primaryDark: 'var(--c-primary-dark)',
    primarySoft: 'var(--c-primary-soft)',
    onPrimary: 'var(--c-on-primary)',
    heading: 'var(--c-heading)',
    solar: 'var(--c-solar)',
    lunar: 'var(--c-lunar)',
    skyTop: 'var(--c-sky-top)',
    skyBot: 'var(--c-sky-bot)',
  },
  ohaeng: {
    목: { key: '목', hanja: '木', bg: '#8FBBA1', ink: '#284B39', label: '#3C7059' },
    화: { key: '화', hanja: '火', bg: '#E98D8D', ink: '#5F2323', label: '#C85B5B' },
    토: { key: '토', hanja: '土', bg: '#F1CE8C', ink: '#6A4C1C', label: '#B98A38' },
    금: { key: '금', hanja: '金', bg: '#DBDCE0', ink: '#3A3D45', label: '#7E7E86' },
    수: { key: '수', hanja: '水', bg: '#8FB0CC', ink: '#22364B', label: '#3F6B93' },
  },
  radius: { sm: 8, md: 12, lg: 18, pill: 100 },
  shadow: {
    card: '0 6px 20px rgba(20, 22, 40, 0.08)',
    float: '0 10px 34px rgba(20, 22, 40, 0.18)',
  },
} as const

export type OhaengKey = keyof typeof tokens.ohaeng
export type Mode = 'light' | 'dark'

const modeColors = {
  light: { primary: '#22409e', onPrimary: '#ffffff', page: '#f3f3f5', card: '#ffffff', ink: '#1b1b1f', sub: '#6b6b72', border: '#e7e7ec' },
  dark: { primary: '#3ad9c0', onPrimary: '#062019', page: '#141416', card: '#1f1f22', ink: '#f1f1f4', sub: '#a0a0a8', border: '#2e2e33' },
}

export function makeTheme(mode: Mode) {
  const m = modeColors[mode]
  return createTheme({
    palette: {
      mode,
      primary: { main: m.primary, contrastText: m.onPrimary },
      background: { default: m.page, paper: m.card },
      text: { primary: m.ink, secondary: m.sub },
      divider: m.border,
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: 'var(--pretendard)',
      fontWeightRegular: 500, // 기본 Medium
      allVariants: { letterSpacing: 'var(--tracking)' },
      h1: { fontSize: 26, fontWeight: 800 },
      h2: { fontSize: 22, fontWeight: 800 },
      h3: { fontSize: 18, fontWeight: 700 },
      body1: { fontSize: 15, fontWeight: 500, lineHeight: 1.55 },
      body2: { fontSize: 13, fontWeight: 500, lineHeight: 1.5 },
      button: { fontSize: 17, fontWeight: 700, textTransform: 'none' },
    },
    components: {
      // 버튼 단일 규격 — 앱 전반 모든 버튼이 같은 모양·크기·타이포(요구사항: "버튼 다 동일하게").
      // 변주는 variant(contained=주동작·outlined=보조)뿐, 형태는 한 값.
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 14,
            paddingTop: 14,
            paddingBottom: 14,
            paddingLeft: 20,
            paddingRight: 20,
            fontSize: 17,
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: 'var(--tracking)',
            textTransform: 'none',
            transition: 'transform .12s cubic-bezier(0.2,0.7,0.3,1), filter .2s',
            '&:active': { transform: 'scale(0.985)' },
          },
          outlined: { borderWidth: 1.5, '&:hover': { borderWidth: 1.5 } },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: 'var(--c-card)',
            fontSize: 15,
            '& fieldset': { borderColor: 'var(--c-border)' },
          },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    },
  })
}

const theme = makeTheme('light')
export default theme
