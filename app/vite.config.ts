import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 상위 폴더의 dosa-app/engine(L1 만세력 엔진)을 import 하기 위해 접근 허용
  server: { fs: { allow: ['..'] } },
})
