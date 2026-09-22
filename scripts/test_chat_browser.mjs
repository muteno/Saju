/** Local browser regression: build KB first; API is always mocked (no AI calls).
 * CHROMIUM_PATH=/path/to/chromium node scripts/test_chat_browser.mjs
 * QA_OUT=/path/to/screenshots controls temporary evidence output.
 */
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '../app/node_modules/playwright-core/index.mjs'
import { createServer } from '../app/node_modules/vite/dist/node/index.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const out = process.env.QA_OUT || '/tmp/saju-chat-browser'
const ref = JSON.parse(await readFile(`${root}app/src/engine/vendor/kb_ref.json`, 'utf8'))
const kb = JSON.parse(await readFile(`${root}app/public/${ref.file}`, 'utf8'))
assert.ok(Object.keys(kb.index || {}).length > 0, 'Browser QA requires populated KB; run npm run build:kb')
await mkdir(out, { recursive: true })
const server = await createServer({ root: `${root}app`, logLevel: 'silent', server: { host: '127.0.0.1', port: 0, watch: null } })
await server.listen()
const base = `http://127.0.0.1:${server.httpServer.address().port}`
let browser
const results = []
const run = async (name, fn) => {
  try { await fn(); results.push({ name, ok: true }); console.log(`PASS ${name}`) }
  catch (error) { results.push({ name, ok: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`) }
}
async function open(viewport = { width: 390, height: 844 }, { holdTopics = false } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' })
  await context.addInitScript(() => {
    window.__qaAborted = []
    window.__qaStarted = []
    const originalFetch = window.fetch.bind(window)
    window.fetch = (url, options) => {
      if (String(url).includes('/api/dosa') && options?.signal) {
        const body = JSON.parse(options.body)
        window.__qaStarted.push(body)
        options.signal.addEventListener('abort', () => window.__qaAborted.push(body), { once: true })
      }
      return originalFetch(url, options)
    }
  })
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
  const requests = [], held = new Map(), counts = new Map()
  await page.route('**/api/dosa', async route => {
    const body = route.request().postDataJSON()
    requests.push(body)
    if (!body.question) {
      if (holdTopics) { held.set(`topic:${body.chefId}:${body.topic}`, { route, body }); return }
      return route.fulfill({ status: 503, json: {} })
    }
    const n = (counts.get(body.question) || 0) + 1
    counts.set(body.question, n)
    if (body.question.startsWith('보류')) {
      held.set(body.question, route)
      return
    }
    if (body.question === '재시도 질문' && n === 1) return route.fulfill({ status: 503, json: {} })
    return route.fulfill({ status: 200, json: { text: `응답 확인: ${body.question}` } })
  })
  await page.goto(`${base}/talk?qa=1`)
  await page.getByRole('log').waitFor()
  await page.evaluate(() => document.fonts.ready)
  const coverage = await page.evaluate(async () => (await import('/src/engine/index.js')).kbCoverage)
  assert.ok(coverage.indexKeys > 0 && coverage.distilledKeys > 0, 'QA fallback must not be used')
  const input = page.getByRole('textbox', { name: '도사에게 직접 묻기' })
  const release = async question => {
    const route = held.get(question)
    assert.ok(route, `Request was not held: ${question}`)
    await route.fulfill({ status: 200, json: { text: `지연 응답 금지: ${question}` } }).catch(() => {})
  }
  const waitQuestion = question => page.waitForFunction(q => window.__qaAborted.some(x => x.question === q), question)
  return { page, context, input, requests, held, counts, release, waitQuestion }
}
async function advance(page) {
  await page.evaluate(() => document.activeElement?.blur())
  for (let i = 0; i < 30; i++) {
    const next = page.getByRole('button', { name: /^(다음 이야기|한 번에 보기)$/ })
    if (await next.count()) { await next.click(); continue }
    const yes = page.getByRole('button', { name: '그… 맞아', exact: true })
    if (await yes.count()) { await yes.click(); continue }
    break
  }
}
const box = locator => locator.evaluate(el => {
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
})
try {
  browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  await run('StrictMode retains initial speaker and opening', async () => {
    const { page, context } = await open()
    const expected = await page.evaluate(async () => (await import('/src/data/chefs.ts')).chefForGender('F').name)
    assert.match(await page.getByRole('button', { name: /도사 바꾸기/ }).getAttribute('aria-label'), new RegExp(expected))
    assert.doesNotMatch(await page.getByRole('log').innerText(), /자리를 물리자/)
    await context.close()
  })
  for (const [width, height] of [[390, 844], [320, 568], [390, 420]]) {
    await run(`Layout ${width}x${height}: choices, log, composer and focus`, async () => {
      const { page, context, input } = await open({ width, height })
      await advance(page)
      const choice = page.getByRole('button', { name: '내 성격이 궁금해', exact: true })
      await choice.waitFor()
      await page.waitForTimeout(800) // existing 700ms critical-hit overlay must finish before screenshots
      const choiceBox = await box(choice)
      const inputBox = await box(input.locator('..'))
      const logBox = await box(page.getByRole('log'))
      assert.ok(logBox.height > 0 && logBox.bottom <= choiceBox.y + 1, 'Log overlaps choices')
      assert.ok(choiceBox.bottom <= inputBox.y + 1, 'Choices overlap composer')
      assert.ok(inputBox.bottom <= height && inputBox.x >= 0 && inputBox.right <= width, 'Composer outside viewport')
      assert.ok(choiceBox.width < width - 32, 'Choice should size to content in horizontal scroll row')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, 'Page has horizontal overflow')
      await page.screenshot({ path: `${out}/after-menu-${width}x${height}.png` })
      await input.focus()
      await page.waitForTimeout(400) // existing dock collapse transition
      assert.equal(await choice.count(), 0, 'Choices remain while typing')
      const focusedBox = await box(input.locator('..'))
      assert.ok(Math.abs(focusedBox.y - inputBox.y) <= 1, 'Composer jumps when focus hides profile')
      await page.screenshot({ path: `${out}/after-focused-${width}x${height}.png` })
      await context.close()
    })
  }
  await run('Korean IME, Shift+Enter and double Enter send once', async () => {
    const { page, context, input, counts, release } = await open()
    const q = '보류 한글 질문'
    await input.fill(q)
    await input.dispatchEvent('compositionstart')
    await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229 })
    await input.dispatchEvent('compositionend')
    await input.dispatchEvent('keydown', { key: 'Enter', keyCode: 229 })
    await input.dispatchEvent('keydown', { key: 'Enter', shiftKey: true })
    assert.equal(counts.get(q) || 0, 0, 'Composition or Shift+Enter sent request')
    await input.evaluate(el => {
      for (let i = 0; i < 2; i++) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    await page.getByRole('status').waitFor()
    assert.equal(await input.getAttribute('readonly'), '', 'Input editable during send')
    await page.waitForTimeout(100)
    assert.equal(counts.get(q), 1, 'Duplicate request sent')
    await release(q)
    await page.getByRole('log').getByText(`지연 응답 금지: ${q}`, { exact: false }).waitFor()
    await context.close()
  })
  await run('Retry preserves one user bubble; returning to topics clears retry', async () => {
    const { page, context, input, counts } = await open()
    await input.fill('재시도 질문'); await input.press('Enter')
    const retry = page.getByRole('button', { name: '질문 다시 보내기', exact: true })
    await retry.waitFor(); await retry.click()
    await page.getByRole('log').getByText('응답 확인: 재시도 질문', { exact: false }).waitFor()
    assert.equal(counts.get('재시도 질문'), 2)
    assert.equal(((await page.getByRole('log').textContent()).match(/나: 재시도 질문/g) || []).length, 1, 'Retry duplicated user bubble')
    assert.equal(await retry.count(), 0)
    await context.close()
    const x = await open()
    await x.input.fill('재시도 질문'); await x.input.press('Enter')
    await x.page.getByRole('button', { name: '질문 다시 보내기', exact: true }).waitFor()
    await advance(x.page)
    await x.page.getByRole('button', { name: '내 성격이 궁금해', exact: true }).waitFor()
    assert.equal(await x.page.getByRole('button', { name: '질문 다시 보내기', exact: true }).count(), 0)
    await x.context.close()
  })
  await run('Character switch aborts question and ignores delayed reply', async () => {
    const { page, context, input, release, waitQuestion } = await open()
    const q = '보류 인물 전환'
    await input.fill(q); await input.press('Enter'); await page.getByRole('status').waitFor()
    await page.getByRole('button', { name: /도사 바꾸기/ }).click()
    await waitQuestion(q); await release(q); await advance(page)
    assert.doesNotMatch(await page.getByRole('log').innerText(), /지연 응답 금지/)
    assert.equal(await page.getByRole('status').count(), 0)
    await context.close()
  })
  await run('Profile switch aborts question, replaces log and ignores delayed reply', async () => {
    const { page, context, input, release, waitQuestion } = await open()
    const q = '보류 프로필 전환'
    await input.fill(q); await input.press('Enter'); await page.getByRole('status').waitFor()
    await page.evaluate(() => {
      history.pushState(null, '', '/talk?y=1993&mo=11&d=30&t=09:00&g=M&city=서울&n=새프로필')
      dispatchEvent(new PopStateEvent('popstate'))
    })
    await waitQuestion(q); await release(q)
    await page.getByText('새프로필', { exact: false }).waitFor()
    assert.doesNotMatch(await page.getByRole('log').innerText(), /지연 응답 금지|보류 프로필 전환/)
    await context.close()
  })
  await run('Topic prefetch aborts on character switch and route unmount; stale text ignored', async () => {
    for (const action of ['character', 'unmount']) {
      const { page, context, held } = await open(undefined, { holdTopics: true })
      await page.waitForFunction(() => window.__qaStarted.some(body => !body.question))
      await page.waitForTimeout(100) // allow the intercepted route to enter the hold map
      const entry = [...held.values()].find(value => value.body && !value.body.question)
      assert.ok(entry, 'No topic prefetch reached the mocked API')
      if (action === 'character') await page.getByRole('button', { name: /도사 바꾸기/ }).click()
      else await page.evaluate(() => {
        history.pushState(null, '', '/input')
        dispatchEvent(new PopStateEvent('popstate'))
      })
      await page.waitForFunction(body => window.__qaAborted.some(value => !value.question && value.chefId === body.chefId && value.topic === body.topic), entry.body)
      await entry.route.fulfill({ status: 200, json: { text: '취소된 주제 응답 금지' } }).catch(() => {})
      if (action === 'character') await advance(page)
      assert.doesNotMatch(await page.locator('body').innerText(), /취소된 주제 응답 금지/)
      await context.close()
    }
  })
  await run('KB failure: readable message and retry successfully reloads', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage(); page.setDefaultTimeout(8000)
    let fail = true
    await page.route('**/kb*.json', route => fail ? route.fulfill({ status: 503, json: {} }) : route.continue())
    await page.route('**/api/dosa', route => route.fulfill({ status: 503, json: {} }))
    await page.goto(`${base}/talk`)
    const alert = page.getByRole('alert'); await alert.waitFor()
    const colors = await alert.evaluate(el => ({ text: getComputedStyle(el).color, button: getComputedStyle(el.querySelector('button')).color }))
    assert.equal(colors.text, 'rgb(27, 27, 31)')
    assert.equal(colors.button, 'rgb(34, 64, 158)')
    await page.screenshot({ path: `${out}/after-kb-error-390.png` })
    fail = false
    await page.getByRole('button', { name: '다시 시도', exact: true }).click()
    await page.getByRole('log').waitFor()
    assert.equal(await alert.count(), 0)
    await context.close()
  })
} finally {
  if (browser) await browser.close()
  await server.close()
  await writeFile(`${out}/browser-results.json`, JSON.stringify({ kb: { file: ref.file, keys: Object.keys(kb.index).length }, results }, null, 2))
}
if (results.some(result => !result.ok)) process.exitCode = 1
console.log(`${results.filter(result => result.ok).length}/${results.length} browser checks passed; evidence: ${out}`)
