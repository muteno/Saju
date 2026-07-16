import { createTheme } from '@mui/material/styles'

/**
 * 디자인 토큰 — Figma "uibowl" AI 상담 화면 + 포스텔러 만세력 레퍼런스 종합.
 * 크롬(UI)은 라이트 뉴트럴 + 인디고 액센트, 채도 높은 색은 오행(五行) 코딩에만 사용.
 */
export const tokens = {
  color: {
    page: '#F3F3F5',
    card: '#FFFFFF',
    ink: '#1B1B1F', // 본문/제목
    inkSub: '#6B6B72', // 보조 텍스트
    inkFaint: '#A2A2A9', // 플레이스홀더/캡션
    border: '#E7E7EC',
    borderStrong: '#D6D6DC',
    primary: '#3E3BE0', // 주 버튼 인디고
    primaryDark: '#2E2BC0',
    primarySoft: '#EEEEFC',
    heading: '#3A57D6', // "아이샤가 …" 강조 블루
    solar: '#E85E5E', // 양력 red
    lunar: '#428BFF', // 음력 blue
    skyTop: '#A9DCED',
    skyBot: '#CFE8EF',
  },
  /** 오행(五行) — 타일 배경 + 텍스트 */
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

const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: { main: tokens.color.primary, dark: tokens.color.primaryDark, contrastText: '#fff' },
    background: { default: tokens.color.page, paper: tokens.color.card },
    text: { primary: tokens.color.ink, secondary: tokens.color.inkSub },
    divider: tokens.color.border,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'var(--pretendard)',
    h1: { fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' },
    h2: { fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' },
    h3: { fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' },
    body1: { fontSize: 15, letterSpacing: '-0.02em', lineHeight: 1.55 },
    body2: { fontSize: 13, letterSpacing: '-0.02em', lineHeight: 1.5 },
    button: { fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', textTransform: 'none' },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 14, paddingTop: 14, paddingBottom: 14 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: '#fff',
          fontSize: 15,
          '& fieldset': { borderColor: tokens.color.border },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
})

export default theme
