import { useMode } from '../mode'

/** PC에서 설정하는 라이트/다크 토글 (디바이스 바깥, 뷰포트 우상단 고정) */
export default function ColorModeToggle() {
  const { mode, toggle } = useMode()
  const dark = mode === 'dark'
  return (
    <button
      onClick={toggle}
      aria-label="라이트/다크 전환"
      className="mode-toggle"
      style={{
        position: 'fixed',
        top: 18,
        right: 18,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 100,
        border: '1px solid rgba(255,255,255,0.18)',
        background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.28)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: 'var(--tracking)',
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
      }}
    >
      <span style={{ fontSize: 15 }}>{dark ? '🌙' : '☀️'}</span>
      {dark ? 'Dark' : 'Light'}
    </button>
  )
}
