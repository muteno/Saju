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
  if (!result.includes('일원')) fails.push('/result(인트로)에 원국 표(일원) 없음 — 리딩 조립 실패 의심')

  // 3분할(260725) 이후 2·3단계도 실렌더 — 라우트 재편이 화면을 빈 셸로 만들지 않았는지
  await pg.goto(`${base}/analysis`, { waitUntil: 'networkidle', timeout: 30000 })
  await pg.waitForTimeout(600)
  if (!((await pg.textContent('body')) || '').includes('사주 분석')) fails.push('/analysis에 분석 제목 없음')

  await pg.goto(`${base}/talk`, { waitUntil: 'networkidle', timeout: 30000 })
  await pg.waitForTimeout(600)
  // 상담 화면 식별자 — 예전엔 하단 네비 탭 라벨('상담')을 봤는데, 채팅 화면은 네비 대신
  // 입력행이 하단을 맡게 바뀌어 그 글자가 사라졌다. 화면 고유의 것(입력행)으로 바꿔 본다.
  if (!(await pg.$('textarea[aria-label="도사에게 직접 묻기"]'))) fails.push('/talk에 상담 입력행 없음')

  // 차용 기틀 하한 감사(260725) — Apple HIG: 텍스트 11pt(Caption 2) · 탭 타깃 44x44pt.
  // 값 정본 = app/src/theme.ts tokens.minFont / minTap. 대표데이터(?qa=1) 3화면에서 검사.
  for (const view of ['result', 'analysis', 'talk']) {
    await pg.goto(`${base}/?qa=1&view=${view}`, { waitUntil: 'networkidle', timeout: 30000 })
    await pg.waitForTimeout(900)
    const bad = await pg.evaluate(() => {
      const small = new Set(), tiny = new Set()
      for (const e of document.querySelectorAll('*')) {
        const cs = getComputedStyle(e), r = e.getBoundingClientRect()
        if (!r.width || !r.height) continue
        // 시각적 숨김(sr-only/스킵링크) = 화면에 자리를 안 먹는 접근성 보조 경로다.
        // 포커스되면 규격대로 펼쳐지므로 하한 검사 대상이 아니다(clip으로 잘려 있으면 건너뛴다).
        if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)') continue
        const own = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join('')
        if (!own) continue
        if (parseFloat(cs.fontSize) < 11) small.add(`${parseFloat(cs.fontSize)}px "${own.slice(0, 12)}"`)
        // 탭 타깃: 자기 텍스트를 가진 클릭 요소만(부모가 타깃인 내부 텍스트는 제외)
        const clickable = e.getAttribute('role') === 'button' || e.tagName === 'BUTTON' || e.tagName === 'A'
        if (clickable && (r.width < 44 || r.height < 44)) tiny.add(`${Math.round(r.width)}x${Math.round(r.height)} "${own.slice(0, 12)}"`)
      }
      return { small: [...small], tiny: [...tiny] }
    })
    if (bad.small.length) fails.push(`[${view}] 11px 미만 텍스트 ${bad.small.length}건: ${bad.small.slice(0, 3).join(' / ')}`)
    if (bad.tiny.length) fails.push(`[${view}] 44px 미달 탭 타깃 ${bad.tiny.length}건: ${bad.tiny.slice(0, 3).join(' / ')}`)
  }

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
