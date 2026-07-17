// verify 6번 게이트 — 실브라우저 스모크: 홈+/result 실렌더 + kb-<hash>.json 적재 확인.
// 근거: 260717 Q05에서 tsc·vite가 초록인데 실브라우저만 잡은 게이트 우회 버그(모듈 시점 kb 접근) 실증.
// 브라우저·의존성이 없는 환경(Windows 로컬·CF 빌드)에선 소프트 스킵(exit 0) — 게이트는 가능한 곳에서만 문다.
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname, normalize } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'app', 'dist')
const skip = (why) => { console.log(`  ↷ 스모크 스킵 — ${why}`); process.exit(0) }

if (!existsSync(join(dist, 'index.html'))) skip('app/dist 없음(앱 빌드 이후 단계에서만 실행)')
let chromium
try { ({ chromium } = createRequire(join(root, 'app', 'package.json'))('playwright-core')) }
catch { skip('playwright-core 미설치') }
const exe = process.env.SMOKE_CHROMIUM || '/opt/pw-browsers/chromium'
if (!existsSync(exe)) skip(`크로뮴 없음(${exe})`)

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' }
const server = createServer((req, res) => {
  let p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([.][.][/\\])+/, '')
  let fp = join(dist, p)
  if (!existsSync(fp) || fp.endsWith('/')) fp = join(dist, 'index.html') // SPA 폴백(_redirects 등가)
  res.setHeader('content-type', MIME[extname(fp)] || 'application/octet-stream')
  res.end(readFileSync(fp))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

const fails = []
const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-proxy-server'] })
try {
  const pg = await browser.newPage()
  const pageErrs = []
  pg.on('pageerror', (e) => pageErrs.push(e.message))
  const kbHits = []
  pg.on('response', (r) => { if (/\/kb-[0-9a-f]{8}\.json/.test(r.url())) kbHits.push(r.status()) })

  await pg.goto(`${base}/`, { waitUntil: 'networkidle', timeout: 30000 })
  await pg.waitForTimeout(600)
  const home = (await pg.textContent('body')) || ''
  if (!home.trim()) fails.push('홈 화면이 비어 있음(렌더 실패)')

  await pg.goto(`${base}/result`, { waitUntil: 'networkidle', timeout: 30000 })
  await pg.waitForTimeout(600)
  const result = (await pg.textContent('body')) || ''
  if (!result.includes('일원')) fails.push('/result에 원국 표(일원) 없음 — 리딩 조립 실패 의심')

  if (!kbHits.length) fails.push('kb-<hash>.json 요청 자체가 없음(로더 미동작)')
  else if (!kbHits.every((s) => s === 200)) fails.push(`kb 응답 비정상: ${kbHits}`)
  if (pageErrs.length) fails.push(`페이지 JS 에러 ${pageErrs.length}건: ${pageErrs[0]}`)
} finally {
  await browser.close()
  server.close()
}

if (fails.length) {
  console.log('❌ 스모크 실패:')
  for (const f of fails) console.log('  -', f)
  process.exit(1)
}
console.log('✅ 스모크 통과 — 홈·/result 실렌더 + kb 적재 정상.')
