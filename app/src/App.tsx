import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Myday from './pages/Myday'
import Analysis from './pages/Analysis'
import Fun from './pages/Fun'
import Settings from './pages/Settings'
import InfoInput from './pages/InfoInput'
import Loading from './pages/Loading'
import Result from './pages/Result'
import { Login, Signup, Find } from './pages/Auth'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/myday" element={<Myday />} />
      <Route path="/analysis" element={<Analysis />} />
      <Route path="/fun" element={<Fun />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/find" element={<Find />} />
      <Route path="/input" element={<InfoInput />} />
      <Route path="/loading" element={<Loading />} />
      <Route path="/result" element={<Result />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
