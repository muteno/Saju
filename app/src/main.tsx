import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ModeProvider } from './mode'
import ColorModeToggle from './components/ColorModeToggle'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModeProvider>
      <BrowserRouter>
        <ColorModeToggle />
        <App />
      </BrowserRouter>
    </ModeProvider>
  </StrictMode>,
)
