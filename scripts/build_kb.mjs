// 앱용 KB 번들 생성 — 결정론 조회에 필요한 색인·별칭·증류본·(경량)본문을 하나로 묶는다.
// 원본(dosa-app/kb)에서 생성하는 기계산출물 → app/public/kb.json (손편집 금지 · gitignore).
// 260717 경량화(Q05): JS 번들 인라인 → 정적 파일 런타임 fetch 분리(번들 파스 비용↓·독립 캐시).
// unit_bodies.json은 13.5MB라 통째 번들 불가 → 유닛당 앞 BODY_PARAS문단만 실어 웹 경량화.
//   npm run build:kb
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const KB = join(root, 'dosa-app/kb')
const PUB = join(root, 'app/public')
const REF = join(root, 'app/src/engine/vendor/kb_ref.json')
const BODY_PARAS = 8 // 유닛당 실어보내는 문단 수(발췌 렌더용)
// 세운(unse) 문서는 앞부분이 인사말+목차(≈12문단)라 8문단 절단 시 목차만 남는다(260718 실측).
// → 올해(입춘 기준)·내년 유닛만 본문 시작점부터 넓게 싣는다. 과년도는 8문단 유지(번들 비대 방지).
const UNSE_PARAS = 56

const load = (p) => JSON.parse(readFileSync(p, 'utf-8'))
const index = load(join(KB, 'unit_index.json'))
const aliasesRaw = load(join(KB, 'aliases.json'))
const aliases = Object.fromEntries(Object.entries(aliasesRaw).filter(([k]) => !k.startsWith('_')))

if (!existsSync(join(KB, 'unit_bodies.json'))) {
  console.error('unit_bodies.json 없음 — 먼저 `python3 dosa-app/kb-tools/extract_bodies.py`'); process.exit(1)
}
const fullBodies = load(join(KB, 'unit_bodies.json'))

// 현재 세운 연도명(입춘 경계 = 엔진 연주 판정) + 이듬해 — 입춘 부근 배포도 양쪽을 커버.
const { computeChart } = await import(pathToFileURL(join(root, 'dosa-app/engine/src/manseryeok.js')).href)
const terms = load(join(root, 'dosa-app/engine/data/solar_terms.json')).terms
const [ty, tm, td] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()).split('-').map(Number)
const yearNameAt = (y) => computeChart({ year: y, month: tm, day: td, hour: 12, minute: 0, gender: 'F' }, terms).saju.year.name
const unseYears = [...new Set([yearNameAt(ty), yearNameAt(ty + 1)])]
const wideUnits = new Set()
for (const [key, refs] of Object.entries(index))
  if (unseYears.some((yn) => key.startsWith(`unse/${yn}/`))) for (const r of refs) wideUnits.add(r.key)

// 본문 시작점: "글의 차례" 목차 블록이 있으면 첫 목차 항목이 본문 제목으로 재등장하는 지점부터.
const contentStart = (paras) => {
  const toc = paras.findIndex((p) => /글의\s*차례/.test(p))
  if (toc < 0 || toc + 1 >= paras.length) return 0
  const firstItem = paras[toc + 1]
  for (let i = toc + 2; i < paras.length; i++) if (paras[i] === firstItem) return i
  return 0
}

const bodies = {}
for (const [k, b] of Object.entries(fullBodies)) {
  if (wideUnits.has(k)) {
    const s = contentStart(b.paras)
    bodies[k] = { title: b.title, paras: b.paras.slice(s, s + UNSE_PARAS), totalParas: b.paras.length }
  } else {
    bodies[k] = { title: b.title, paras: b.paras.slice(0, BODY_PARAS), totalParas: b.paras.length }
  }
}

const distilled = {}
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (f.endsWith('.json')) { const u = load(p); distilled[u.key] = u }
  }
}
walk(join(KB, 'distilled'))

const bundle = { index, aliases, distilled, bodies, meta: { bodyParas: BODY_PARAS, unseParas: UNSE_PARAS, unseYears, distilledKeys: Object.keys(distilled).length } }
const payload = JSON.stringify(bundle)
// 콘텐츠 해시 파일명(kb-<hash8>.json) = JS처럼 불변 캐시 + 배포 간 JS↔KB 원자성(평의회 Q05 캐시스큐 지적)
const hash = createHash('sha256').update(payload).digest('hex').slice(0, 8)
const fname = `kb-${hash}.json`
for (const f of readdirSync(PUB)) if (/^kb-[0-9a-f]{8}\.json$/.test(f) && f !== fname) unlinkSync(join(PUB, f))
const OUT = join(PUB, fname)
writeFileSync(OUT, payload)
writeFileSync(REF, JSON.stringify({ file: fname }))
const mb = (Buffer.byteLength(payload) / 1e6).toFixed(2)
console.log(`KB 번들 생성: 색인 ${Object.keys(index).length}키 · 증류 ${Object.keys(distilled).length} · 본문 ${Object.keys(bodies).length}유닛(앞${BODY_PARAS}문단 · 세운 ${unseYears.join('/')} ${wideUnits.size}유닛=본문부 ${UNSE_PARAS}문단) → ${fname} ${mb}MB`)
