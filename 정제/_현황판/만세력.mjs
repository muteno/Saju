// 생년월일시 → 원국 8글자·대운. 앱 엔진(app/src/engine/vendor/manseryeok.js)을 그대로 부른다(계산을 따로 두지 않는다).
// 사용: node 만세력.mjs '{"year":1990,"month":5,"day":15,"hour":14,"minute":30,"gender":"M"}'
//   hour 가 null 이면 시주 없이 연·월·일만 낸다(생시 미상).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { computeChart } from '../../app/src/engine/vendor/manseryeok.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const terms = JSON.parse(fs.readFileSync(path.join(here, '../../app/src/engine/vendor/data/solar_terms.json'), 'utf8')).terms
const input = JSON.parse(process.argv[2])
const noHour = input.hour === null || input.hour === undefined
const c = computeChart({ ...input, hour: noHour ? 12 : input.hour, minute: noHour ? 0 : (input.minute ?? 0) }, terms)
const s = c.saju
const out = {
  기둥: [s.year.name, s.month.name, s.day.name, noHour ? null : s.hour.name],
  대운: { 수: c.daeun.su, 순행: c.daeun.forward, 목록: c.daeun.list.map((d) => ({ 나이: d.age, 간지: d.name })) },
}
process.stdout.write(JSON.stringify(out))
