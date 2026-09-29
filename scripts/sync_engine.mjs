// 엔진 vendor 동기화 — dosa-app/engine/src(정본) → app/src/engine/vendor(앱 사본).
// 앱은 자립형 빌드를 위해 엔진을 벤더링한다. 사본은 '기계산출물(거울)'이라 손편집 금지 —
// 원본을 고치고 이 스크립트로 재생성한다(세션 간 드리프트 0 보장).
//   npm run sync:engine          → 복사(재생성)
//   node scripts/sync_engine.mjs --check → 원본과 다르면 비-0 종료 (verify에서 게이트)
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'dosa-app/engine/src')
const VENDOR = join(root, 'app/src/engine/vendor')
const FILES = ['tables.js', 'manseryeok.js', 'sinsal.js', 'relations.js', 'judge.js', 'keyset.js', 'report.js', 'unse.js', 'basicSentences.js', 'basicSentenceData.js', 'basicSentences.d.ts', 'gapinConditions.js', 'gapinSentenceData.js', 'gapinStructure.js', 'gapinStructureData.js', 'contextReading.js', 'contextReading.d.ts', 'workCandidates.js', 'workCandidates.d.ts']
const DATA = ['solar_terms.json']

const check = process.argv.includes('--check')
let drift = 0
mkdirSync(join(VENDOR, 'data'), { recursive: true })

for (const f of FILES) {
  const s = readFileSync(join(SRC, f), 'utf-8')
  const dst = join(VENDOR, f)
  const cur = existsSync(dst) ? readFileSync(dst, 'utf-8') : null
  if (cur !== s) {
    if (check) { console.error(`drift: vendor/${f}`); drift++ }
    else writeFileSync(dst, s)
  }
}
for (const f of DATA) {
  const s = readFileSync(join(SRC, '../data', f), 'utf-8')
  const dst = join(VENDOR, 'data', f)
  const cur = existsSync(dst) ? readFileSync(dst, 'utf-8') : null
  if (cur !== s) {
    if (check) { console.error(`drift: vendor/data/${f}`); drift++ }
    else writeFileSync(dst, s)
  }
}
if (check) process.exit(drift ? 1 : 0)
console.log(`엔진 vendor 동기화 완료 (${FILES.length}개 + 절기표)`)
