import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ModeProvider } from './mode'
import ColorModeToggle from './components/ColorModeToggle'
import './index.css'
import App from './App.tsx'
import { loadKb } from './engine'

const root = createRoot(document.getElementById('root')!)

// KB(정적 /kb.json)를 먼저 적재하고 렌더 — 컴포넌트들의 동기 API(buildReading)가 그대로 성립.
loadKb()
  .then(() => {
    root.render(
      <StrictMode>
        <ModeProvider>
          <BrowserRouter>
            <ColorModeToggle />
            <App />
          </BrowserRouter>
        </ModeProvider>
      </StrictMode>,
    )
  })
  .catch((e) => {
    // fail-soft: 지식 파일을 못 받으면 새로고침 안내만 (기존 body 타이포 상속 — 신규 디자인 요소 없음)
    console.error('KB 로드 실패', e)
    root.render(<p style={{ padding: '2rem', textAlign: 'center' }}>지식 데이터를 불러오지 못했어요. 잠시 후 새로고침해 주세요.</p>)
  })
