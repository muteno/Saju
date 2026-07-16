import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://localhost:4180'
const OUT = process.env.OUT_DIR || '/tmp/claude-0/-home-user-Saju/33f1e65d-b4cf-55d9-a605-4abf630967f8/scratchpad/shots'
mkdirSync(OUT, { recursive: true })

const routes = [
  { path: '/', name: '1-home' },
  { path: '/input', name: '2-input' },
  { path: '/loading?hold=1', name: '3-loading' },
  { path: '/result', name: '4-result' },
]

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
})
const page = await ctx.newPage()

for (const r of routes) {
  await page.goto(BASE + r.path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${r.name}.png` })
  console.log('shot', r.name)
}

await browser.close()
console.log('DONE')
