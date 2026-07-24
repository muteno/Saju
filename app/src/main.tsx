import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ModeProvider } from './mode'
import './index.css'
import App from './App.tsx'
import { loadKb, useEmptyKb } from './engine'
import { seedQa, isQa } from './data/qa'

seedQa() // [E13] ?qa=1 = 무로그인 미리보기(대표데이터 시드 · 실사용 흐름 무변경)

const root = createRoot(document.getElementById('root')!)

const renderApp = () =>
  root.render(
    <StrictMode>
      <ModeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ModeProvider>
    </StrictMode>,
  )

// KB(정적 /kb.json)를 먼저 적재하고 렌더 — 컴포넌트들의 동기 API(buildReading)가 그대로 성립.
loadKb()
  .then(renderApp)
  .catch((e) => {
    // [E13] QA 미리보기 = KB 없이도 화면 골격(만세력 차트·레이아웃)을 렌더(빈 KB 주입 · 풀이 텍스트만 빔).
    // KB 파일은 .gitignore 산출물이라 fresh clone엔 없다 — 디자인 검수는 이 경로로 성립시킨다.
    if (isQa()) {
      console.warn('[QA] KB 미로드 — 빈 KB로 화면만 렌더', e)
      useEmptyKb()
      renderApp()
      return
    }
    // fail-soft: 지식 파일을 못 받으면 안내 + 재시도 (기존 body 타이포 상속 — 신규 디자인 요소 최소)
    console.error('KB 로드 실패', e)
    root.render(
      <div style={{ padding: '2rem', textAlign: 'center', color: '#f1f1f4' }}>
        <p>지식 데이터를 불러오지 못했어요.</p>
        <button
          onClick={() => location.reload()}
          style={{
            marginTop: 12,
            padding: '12px 24px',
            borderRadius: 14,
            border: '1.5px solid #3ad9c0',
            background: 'transparent',
            color: '#3ad9c0',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          다시 시도
        </button>
      </div>,
    )
  })
