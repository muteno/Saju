// 앱용 KB 번들 생성 — 결정론 조회에 필요한 색인·별칭·증류본·(경량)본문을 하나로 묶는다.
// 원본(dosa-app/kb)에서 생성하는 기계산출물 → app/public/kb.json (손편집 금지 · gitignore).
// 260717 경량화(Q05): JS 번들 인라인 → 정적 파일 런타임 fetch 분리(번들 파스 비용↓·독립 캐시).
// unit_bodies.json은 13.5MB라 통째 번들 불가 → 유닛당 앞 BODY_PARAS문단만 실어 웹 경량화.
//   npm run build:kb
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const KB = join(root, 'dosa-app/kb')
const PUB = join(root, 'app/public')
const REF = join(root, 'app/src/engine/vendor/kb_ref.json')
const BODY_PARAS = 8 // 유닛당 실어보내는 문단 수(발췌 렌더용)

const load = (p) => JSON.parse(readFileSync(p, 'utf-8'))
const index = load(join(KB, 'unit_index.json'))
const aliasesRaw = load(join(KB, 'aliases.json'))
const aliases = Object.fromEntries(Object.entries(aliasesRaw).filter(([k]) => !k.startsWith('_')))

if (!existsSync(join(KB, 'unit_bodies.json'))) {
  console.error('unit_bodies.json 없음 — 먼저 `python3 dosa-app/kb-tools/extract_bodies.py`'); process.exit(1)
}
const fullBodies = load(join(KB, 'unit_bodies.json'))
const bodies = {}
for (const [k, b] of Object.entries(fullBodies)) {
  bodies[k] = { title: b.title, paras: b.paras.slice(0, BODY_PARAS), totalParas: b.paras.length }
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

const bundle = { index, aliases, distilled, bodies, meta: { bodyParas: BODY_PARAS, distilledKeys: Object.keys(distilled).length } }
const payload = JSON.stringify(bundle)
// 콘텐츠 해시 파일명(kb-<hash8>.json) = JS처럼 불변 캐시 + 배포 간 JS↔KB 원자성(평의회 Q05 캐시스큐 지적)
const hash = createHash('sha256').update(payload).digest('hex').slice(0, 8)
const fname = `kb-${hash}.json`
for (const f of readdirSync(PUB)) if (/^kb-[0-9a-f]{8}\.json$/.test(f) && f !== fname) unlinkSync(join(PUB, f))
const OUT = join(PUB, fname)
writeFileSync(OUT, payload)
writeFileSync(REF, JSON.stringify({ file: fname }))
const mb = (Buffer.byteLength(payload) / 1e6).toFixed(2)
console.log(`KB 번들 생성: 색인 ${Object.keys(index).length}키 · 증류 ${Object.keys(distilled).length} · 본문 ${Object.keys(bodies).length}유닛(앞${BODY_PARAS}문단) → ${fname} ${mb}MB`)
