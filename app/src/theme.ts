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
  /**
   * 차용 기틀의 하한값 — 우리가 만든 값이 아니라 외부 정본에서 가져온 바닥선이다(260725).
   * · minFont 11 = Apple HIG 최소 텍스트 스타일(Caption 2 = 11pt). 이보다 작으면 렌더하지 말고
   *   생략한다(읽을 수 없는 글자를 그리는 건 정보가 아니라 노이즈 — "content leads").
   * · minTap 44 = Apple HIG 최소 탭 타깃 44×44pt (Material 3는 48dp — 둘 중 낮은 쪽을 하한으로).
   * 이 두 값은 게이트로 검사한다(scripts/smoke.mjs).
   */
  minFont: 11,
  minTap: 44,
  radius: { sm: 8, md: 12, lg: 18, pill: 100 },
  shadow: {
    card: '0 6px 20px rgba(20, 22, 40, 0.08)',
    float: '0 10px 34px rgba(20, 22, 40, 0.18)',
  },
} as const

export type OhaengKey = keyof typeof tokens.ohaeng
export type Mode = 'light' | 'dark'

/**
 * MUI palette — **CSS 토큰을 그대로 참조한다**(거울 = 무손실).
 *
 * 260726 이전엔 여기에 hex 복사본(`modeColors`)이 있었고, `index.css`가 갱신돼도 조용히 옛 값을
 * 유지해 **같은 화면에 두 팔레트가 공존**했다 — 실렌더 적발: body 배경이 palette의 `#f3f3f5`로
 * 칠해지는데 `--c-page`는 `#eef0f6`였다(다른 값). `text.secondary` `#6b6b72` vs `--c-ink-sub`
 * `#5b6070`, `divider` `#e7e7ec` vs `--c-border` `#e2e4ee`도 같은 축.
 * 값을 맞추는 대신 **참조로 바꿔** 드리프트가 재발할 자리 자체를 없앴다(게이트 T2가 감시한다).
 *
 * 라이트/다크 전환은 CSS 변수(`:root` / `[data-theme='dark']`)가 담당하므로 mode별 분기가 없다.
 * ⚠ MUI가 색 연산(`alpha()`·`lighten()`)을 돌리는 경로에는 CSS 변수를 못 넘긴다 — 그런 자리가
 * 생기면 토큰을 새로 파생시키고 게이트 락을 갱신할 것(값 복사 금지).
 */
/**
 * CSS 토큰 실값 읽기 — palette는 `var(--x)` 문자열을 못 받는다(MUI가 alpha·darken을 계산해야 해서
 * 파싱에 실패한다: 260726 실렌더에서 error #9로 앱이 통째로 죽었다). 그래서 **문자열 참조 대신
 * 읽어서 채운다** — 값의 출처는 여전히 `index.css :root` 하나뿐이라 거울은 무손실로 유지된다.
 * 못 읽으면 `undefined`를 돌려 MUI 기본값으로 두고, hex 복사본은 두지 않는다(그게 드리프트의 씨앗).
 */
function cssToken(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return /^(#|rgb|hsl|color\()/.test(v) ? v : undefined
}

export function makeTheme(mode: Mode) {
  // ⚠ 다크를 되살릴 땐 호출 시점에 `data-theme`가 이미 붙어 있어야 한다(현재는 라이트 단일이라 무관)
  const t = cssToken
  const primary = t('--c-primary')
  const divider = t('--c-border')
  return createTheme({
    // 못 읽은 축은 키 자체를 넘기지 않는다 = MUI 기본값 유지(hex 복사본을 두지 않기 위함)
    palette: {
      mode,
      ...(primary ? { primary: { main: primary, contrastText: t('--c-on-primary') } } : {}),
      background: { default: t('--c-page'), paper: t('--c-card') },
      text: { primary: t('--c-ink'), secondary: t('--c-ink-sub') },
      ...(divider ? { divider } : {}),
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
            transition: 'transform .12s var(--ease), filter .2s',
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
