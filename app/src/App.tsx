import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Intro from './pages/Intro'
import Analysis from './pages/Analysis'
import Talk from './pages/Talk'
import Fun from './pages/Fun'
import Settings from './pages/Settings'
import InfoInput from './pages/InfoInput'
import Loading from './pages/Loading'
import { Login, Signup, Find } from './pages/Auth'

/** 구 라우트 → 신 라우트로 쿼리 보존 이동(공유 링크·저장 링크가 안 끊기게) */
function Keep({ to }: { to: string }) {
  const { search, hash } = useLocation()
  return <Navigate to={`${to}${search}${hash}`} replace />
}

/**
 * 리포트 3분할(260725) — 인트로 → 분석 → 상담.
 * `/result`가 인트로다: 기존 공유 링크가 전부 이 주소를 가리키고 있어 바꾸지 않는다.
 * `/`(앱 진입)와 구 `/myday`는 인트로로 합쳐졌다(운영자 확정: 오늘+원국 = 인트로 한 화면).
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Keep to="/result" />} />
      <Route path="/result" element={<Intro />} />
      <Route path="/analysis" element={<Analysis />} />
      <Route path="/talk" element={<Talk />} />
      <Route path="/fun" element={<Fun />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/find" element={<Find />} />
      <Route path="/input" element={<InfoInput />} />
      <Route path="/loading" element={<Loading />} />
      {/* 구 라우트 보존 */}
      <Route path="/myday" element={<Keep to="/result" />} />
      <Route path="*" element={<Navigate to="/result" replace />} />
    </Routes>
  )
}
