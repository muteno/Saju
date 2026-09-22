// UI 데이터·상담 API 회귀 검사. 앱에 설치된 TypeScript + Node 기본 테스트 러너만 사용한다.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, registerHooks } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const require = createRequire(new URL('../app/package.json', import.meta.url))
const ts = require('typescript')
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL) {
      const url = new URL(specifier, context.parentURL)
      if (!/\.[cm]?[jt]sx?$/.test(url.pathname)) {
        for (const ext of ['.ts', '.tsx', '.js']) {
          const candidate = new URL(url)
          candidate.pathname += ext
          if (existsSync(fileURLToPath(candidate))) return next(candidate.href, context)
        }
      }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    if (/\.tsx?$/.test(new URL(url).pathname)) return {
      format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
      }).outputText,
    }
    return next(url, context)
  },
})

const { chartSummaryOf } = await import('../app/src/data/dosaTopics.ts')
const { requestDosaText, shouldSendOnEnter } = await import('../app/src/data/dosaClient.ts')
const { onRequestPost } = await import('../functions/api/dosa.ts')
const { computeChart } = await import('../app/src/engine/vendor/manseryeok.js')
const { chartToKeys } = await import('../app/src/engine/vendor/keyset.js')
const { buildReport } = await import('../app/src/engine/vendor/report.js')
const originalFetch = globalThis.fetch
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
after(() => {
  globalThis.fetch = originalFetch
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
  else delete globalThis.localStorage
})

let moduleId = 0
async function store(raw, rejectWrites = false) {
  let value = raw ?? null
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: () => value,
    setItem: (_, next) => { if (rejectWrites) throw Error('quota'); value = next },
  } })
  return import(`../app/src/data/profiles.ts?case=${++moduleId}`)
}
const profile = { name: '테스트', gender: '여자', calendar: '양력', year: 1990, month: 1, day: 1,
  hour: 12, minute: 0, hourUnknown: false, city: '서울', marital: '미혼' }
const stored = { ...profile, id: 'test', createdAt: 1 }
const report = { sections: [
  { id: 'wonguk', table: [{ pos: '년주', ganji: '기사' }, { pos: '월주', ganji: '병자' }, { pos: '일주', ganji: '병인' }, { pos: '시주', ganji: '갑오' }], meta: { dayMaster: '병' } },
  { id: 'judge', lines: ['신강 70/110'] },
] }

test('손상된 저장 목록은 건너뛰고 정상 프로필을 복원한다', async () => {
  const p = await store(JSON.stringify({ active: 'bad', list: [null, {}, { ...stored, id: 'bad', day: 32 }, stored] }))
  assert.deepEqual(p.listProfiles(), [stored])
  assert.equal(p.activeProfile().id, 'test')
})
test('저장 공간이 가득 차도 세션 내 수정·삭제를 유지한다', async () => {
  const p = await store(JSON.stringify({ active: 'test', list: [stored] }), true)
  const edited = p.saveProfile({ ...profile, name: '수정' }, 'test')
  assert.equal(p.activeProfile().name, '수정')
  p.removeProfile(edited.id)
  assert.equal(p.activeProfile(), null)
})
test('불러온 프로필 수정은 같은 ID로 저장하고 중복을 만들지 않는다', async () => {
  const p = await store(JSON.stringify({ active: 'test', list: [stored] }))
  assert.equal(p.saveProfile({ ...profile, hour: 8 }, 'test').id, 'test')
  assert.equal(p.listProfiles().length, 1)
  assert.throws(() => p.saveProfile({ ...profile, month: 2, day: 30 }))
})
test('공유 링크는 시각 형식을 엄격히 검사하고 정상 값은 왕복한다', async () => {
  const p = await store()
  const query = p.profileToSearch(stored)
  assert.equal(p.matchesShare(stored, p.parseShare(query)), true)
  for (const time of ['12:', ':00', '12:00:55', '24:00', '12:60']) {
    const q = new URLSearchParams(query); q.set('t', time)
    assert.equal(p.parseShare(q.toString()), null, time)
  }
})
test('이름·생일이 같아도 시간·성별·도시·보정·시간모름이 다르면 남의 사주다', async () => {
  const p = await store()
  for (const change of [{ hour: 8 }, { gender: '남자' }, { city: '부산' }, { solarCorrection: false }, { lateZi: true }, { hourUnknown: true }]) {
    assert.equal(p.matchesShare(stored, p.parseShare(p.profileToSearch({ ...stored, ...change }))), false)
  }
})
test('시간 모름 상담 요약에 임시 시주와 강약 수치를 보내지 않는다', () => {
  const summary = chartSummaryOf(report, true)
  assert.doesNotMatch(summary, /갑오|70\/110/)
  assert.match(summary, /출생 시간 모름/)
  assert.match(chartSummaryOf(report), /갑오/)
})
test('실제 엔진 리포트도 시간 모름이면 시주를 빼고 나머지 세 기둥을 유지한다', () => {
  const { terms } = JSON.parse(readFileSync(new URL('../app/src/engine/vendor/data/solar_terms.json', import.meta.url), 'utf8'))
  const chart = computeChart({ year: 1990, month: 1, day: 1, hour: 12, minute: 0, gender: 'F' }, terms)
  const engineReport = buildReport(chart, chartToKeys(chart), { aliases: {}, index: {}, bodies: {} })
  const rows = engineReport.sections.find((section) => section.id === 'wonguk').table
  const hour = rows.find((row) => row.pos === '시주')
  assert.ok(hour, 'production report must contain an hour pillar')
  const unknown = chartSummaryOf(engineReport, true)
  const known = chartSummaryOf(engineReport)
  assert.equal(unknown.includes(hour.ganji), false)
  assert.equal(known.includes(`${hour.pos} ${hour.ganji}`), true)
  for (const row of rows.filter((row) => row !== hour)) assert.equal(unknown.includes(`${row.pos} ${row.ganji}`), true)
  assert.doesNotMatch(unknown, /구조 판정:|\/110/)
  assert.match(known, /구조 판정:/)
})
test('한글 IME 확정과 Shift+Enter는 전송을 막는다', () => {
  assert.equal(shouldSendOnEnter({ key: 'Enter', shiftKey: false, isComposing: true }), false)
  assert.equal(shouldSendOnEnter({ key: 'Enter', shiftKey: false, keyCode: 229 }), false)
  assert.equal(shouldSendOnEnter({ key: 'Enter', shiftKey: true }), false)
  assert.equal(shouldSendOnEnter({ key: 'Enter', shiftKey: false }), true)
})
test('상담 클라이언트는 시간 모름 정보를 지키며 응답을 받는다', async () => {
  globalThis.fetch = async (_, init) => {
    const body = JSON.parse(init.body)
    assert.doesNotMatch(body.chartSummary, /갑오|70\/110/)
    return Response.json({ text: ' 응답입니다. ' })
  }
  assert.equal(await requestDosaText({ topic: '성격', report, lines: [], chefId: 'noona', model: 'sonnet', hourUnknown: true }), '응답입니다.')
})
test('상담 전송 취소·타임아웃 시 fetch를 중단한다', async () => {
  const ctrl = new AbortController()
  globalThis.fetch = (_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
  const options = { topic: '성격', report, lines: [], chefId: 'noona', model: 'sonnet' }
  const pending = requestDosaText({ ...options, signal: ctrl.signal })
  ctrl.abort()
  assert.equal(await pending, null)
  assert.equal(await requestDosaText({ ...options, timeoutMs: 5 }), null)
})
const api = (body, signal) => onRequestPost({ request: new Request('https://example.test/api/dosa', {
  method: 'POST', body: JSON.stringify(body), ...(signal ? { signal } : {}),
}), env: { ANTHROPIC_API_KEY: 'test-only' } })
test('API는 null·배열·원시 JSON을 예외 없이 400으로 거절한다', async () => {
  globalThis.fetch = () => { throw Error('must not call provider') }
  for (const body of [null, [], 'text', 1, true]) assert.equal((await api(body)).status, 400)
  assert.equal((await api({ topic: '성격', question: '가'.repeat(301) })).status, 400)
})
test('모델·페르소나 화이트리스트는 프로토타입 키를 허용하지 않는다', async () => {
  globalThis.fetch = async (_, init) => {
    const body = JSON.parse(init.body)
    assert.equal(body.model, 'claude-sonnet-5')
    assert.doesNotMatch(body.system[0].text, /\[native code\]/)
    return Response.json({ content: [{ type: 'text', text: '응답' }] })
  }
  assert.deepEqual(await (await api({ topic: '성격', model: 'toString', chefId: 'constructor' })).json(), { text: '응답' })
})
test('API의 잘못된 upstream 응답과 취소는 안전하게 폴백한다', async () => {
  globalThis.fetch = async () => Response.json({ content: {} })
  assert.equal((await api({ topic: '성격' })).status, 502)
  const ctrl = new AbortController(); ctrl.abort()
  globalThis.fetch = () => { throw Error('cancelled request must not call provider') }
  assert.equal((await api({ topic: '성격' }, ctrl.signal)).status, 502)
})
