import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://localhost:4181'
const OUT = process.env.OUT_DIR || '/tmp/claude-0/-home-user-Saju/33f1e65d-b4cf-55d9-a605-4abf630967f8/scratchpad/shots'
mkdirSync(OUT, { recursive: true })

// [route, name, modes]
const jobs = [
  { path: '/', name: 'home', modes: ['light', 'dark'] },
  { path: '/result', name: 'result', modes: ['light', 'dark'] },
  { path: '/input', name: 'input', modes: ['dark'] },
  { path: '/loading?hold=1', name: 'loading', modes: ['dark'] },
]

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
})

for (const job of jobs) {
  for (const mode of job.modes) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })
    await ctx.addInitScript((m) => localStorage.setItem('saju-mode', m), mode)
    const page = await ctx.newPage()
    await page.goto(BASE + job.path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${OUT}/${job.name}-${mode}.png` })
    console.log('shot', job.name, mode)
    await ctx.close()
  }
}

await browser.close()
console.log('DONE')
