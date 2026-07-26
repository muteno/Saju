// 디자인 토큰 게이트 — 정본 = docs/디자인토큰_제1핵심명령.md §5
//
// T1 토큰 락   : index.css :root 토큰명 집합 vs design-tokens.lock (신토큰 무단 추가 차단)
// T2 거울 무손실: theme.ts의 MUI palette가 hex를 직접 들고 있으면 실패 (거울 드리프트 재발 차단)
// T3 raw 총량  : app/src의 raw hex·rgba 개수 vs baseline (값 창작 증가 차단)
//
// 락 갱신 = `npm run lock:tokens` (승인의 명시 행위 — lock diff가 PR에 남는다).
// 이 게이트가 못 잡는 것은 문서 §6에 정직하게 적혀 있다.
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const CSS = join(root, 'app', 'src', 'index.css')
const THEME = join(root, 'app', 'src', 'theme.ts')
const LOCK = join(root, 'design-tokens.lock')
const SRC = join(root, 'app', 'src')
const mode = process.argv[2] === 'lock' ? 'lock' : 'check'

const fails = []
const notes = []

// ── :root 토큰명 추출 (라이트 블록만 = 정본. 다크는 휴면이라 같은 이름 집합) ──
function rootTokenNames() {
  const css = readFileSync(CSS, 'utf8')
  const m = css.match(/^:root\s*\{([\s\S]*?)^\}/m)
  if (!m) throw new Error('index.css에서 :root 블록을 못 찾음')
  return [...m[1].matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((x) => x[1]).sort()
}

// ── app/src 재귀 순회 ──
function walk(dir) {
  const out = []
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) {
      if (f === 'vendor') continue // 생성물(D2-1 손대지 않는다)
      out.push(...walk(p))
    } else if (['.ts', '.tsx'].includes(extname(f))) out.push(p)
  }
  return out
}

const names = rootTokenNames()

// ── LOCK 모드 ──
if (mode === 'lock') {
  const files = walk(SRC)
  let hex = 0
  let rgba = 0
  for (const f of files) {
    const s = readFileSync(f, 'utf8')
    hex += (s.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).length
    rgba += (s.match(/rgba?\(\s*\d/g) || []).length
  }
  writeFileSync(LOCK, JSON.stringify({ tokens: names, baseline: { hex, rgba } }, null, 2) + '\n')
  console.log(`  🔒 락 갱신 — 토큰 ${names.length}개 · baseline hex ${hex} · rgba ${rgba}`)
  console.log(`     (${LOCK} — diff를 PR에 남겨 승인 흔적으로)`)
  process.exit(0)
}

// ── CHECK 모드 ──
if (!existsSync(LOCK)) {
  console.log('  ↷ 토큰 게이트 스킵 — design-tokens.lock 없음(최초 1회 `npm run lock:tokens`)')
  process.exit(0)
}
const lock = JSON.parse(readFileSync(LOCK, 'utf8'))

// T1 토큰 락
const added = names.filter((n) => !lock.tokens.includes(n))
const removed = lock.tokens.filter((n) => !names.includes(n))
if (added.length) fails.push(`T1 락에 없는 신토큰 ${added.length}개: ${added.join(' ')}\n     → 승인받았으면 \`npm run lock:tokens\``)
if (removed.length) fails.push(`T1 락에 있던 토큰이 사라짐 ${removed.length}개: ${removed.join(' ')}`)
if (!added.length && !removed.length) notes.push(`T1 토큰 ${names.length}개 락 일치`)

// T2 거울 무손실 — MUI palette가 hex를 직접 들고 있으면 CSS 토큰과 조용히 어긋난다(§3 실적발)
const theme = readFileSync(THEME, 'utf8')
const modeColors = theme.match(/const\s+modeColors\s*=\s*\{[\s\S]*?\n\}/)
if (modeColors) {
  const hexes = modeColors[0].match(/#[0-9a-fA-F]{3,8}\b/g) || []
  if (hexes.length) {
    fails.push(
      `T2 MUI palette가 hex를 직접 보유 ${hexes.length}개: ${[...new Set(hexes)].join(' ')}\n` +
        `     → palette도 var(--c-*)를 참조해야 거울이 무손실이 된다(문서 §3)`,
    )
  } else notes.push('T2 MUI palette = 무손실 거울(hex 0)')
} else notes.push('T2 modeColors 없음 — palette가 토큰을 직접 참조하는 형태')

// T3 raw 총량
const files = walk(SRC)
let hex = 0
let rgba = 0
const per = []
for (const f of files) {
  const s = readFileSync(f, 'utf8')
  const h = (s.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).length
  const r = (s.match(/rgba?\(\s*\d/g) || []).length
  hex += h
  rgba += r
  if (h + r > 0) per.push({ f: f.slice(root.length + 1), h, r })
}
const b = lock.baseline || { hex: Infinity, rgba: Infinity }
if (hex > b.hex || rgba > b.rgba) {
  per.sort((x, y) => y.h + y.r - (x.h + x.r))
  fails.push(
    `T3 raw 값 증가 — hex ${hex}(기준 ${b.hex}) · rgba ${rgba}(기준 ${b.rgba})\n` +
      `     상위: ${per.slice(0, 4).map((x) => `${x.f}(${x.h}h/${x.r}r)`).join(' ')}\n` +
      `     → 토큰 계승으로 바꾸거나, 정당한 예외면 사유 1줄과 함께 \`npm run lock:tokens\``,
  )
} else {
  const down = hex < b.hex || rgba < b.rgba
  notes.push(`T3 raw hex ${hex}/${b.hex} · rgba ${rgba}/${b.rgba}${down ? ' (감소 — 락 갱신 권장)' : ''}`)
}

for (const n of notes) console.log(`  · ${n}`)
if (fails.length) {
  console.error('\n  ❌ 토큰 게이트 실패')
  for (const f of fails) console.error(`   - ${f}`)
  console.error('\n  정본 = docs/디자인토큰_제1핵심명령.md')
  process.exit(1)
}
console.log('  ✅ 토큰 게이트 통과 — 계승/갱신 규율 유지')
