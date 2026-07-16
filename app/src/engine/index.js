// dosa-app L1 만세력 엔진(computeChart) → UI용 데이터로 매핑하는 얇은 어댑터.
// 엔진은 순수 ESM(브라우저 안전). 절기표는 정적 JSON을 주입.
import { computeChart } from '../../../dosa-app/engine/src/manseryeok.js'
import solarTerms from '../../../dosa-app/engine/data/solar_terms.json'

const terms = solarTerms.terms

// 천간 → [오행, 음양]
const STEM = {
  갑: ['목', '+'], 을: ['목', '-'], 병: ['화', '+'], 정: ['화', '-'], 무: ['토', '+'],
  기: ['토', '-'], 경: ['금', '+'], 신: ['금', '-'], 임: ['수', '+'], 계: ['수', '-'],
}
// 지지 → [오행, 음양(양지/음지)]
const BRANCH = {
  자: ['수', '+'], 축: ['토', '-'], 인: ['목', '+'], 묘: ['목', '-'], 진: ['토', '+'], 사: ['화', '-'],
  오: ['화', '+'], 미: ['토', '-'], 신: ['금', '+'], 유: ['금', '-'], 술: ['토', '+'], 해: ['수', '-'],
}

function pillarUI(title, p, isDay) {
  const [ganE, ganPolarity] = STEM[p.stem]
  const [jiE, jiPolarity] = BRANCH[p.branch]
  return {
    title,
    topStar: isDay ? '일원' : p.stemTenGod,
    gan: p.hanja[0], ganK: p.stem, ganE, ganPolarity,
    ji: p.hanja[1], jiK: p.branch, jiE, jiPolarity,
    botStar: p.branchTenGod, stage: p.twelveStage,
    isDayMaster: isDay || undefined,
  }
}

function ohaengDist(pillars) {
  const count = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 }
  for (const p of pillars) {
    count[p.ganE]++
    count[p.jiE]++
  }
  return ['목', '화', '토', '금', '수'].map((key) => {
    const pct = (count[key] / 8) * 100
    let verdict = '적정'
    if (pct === 0) verdict = '부족'
    else if (pct <= 12.5) verdict = '적정'
    else if (pct <= 25) verdict = '발달'
    else verdict = '과다'
    return { key, pct: Math.round(pct * 10) / 10, verdict }
  })
}

export function computeChartUI(input) {
  const c = computeChart(input, terms)
  const s = c.saju
  const pillars = [
    pillarUI('시', s.hour, false),
    pillarUI('일', s.day, true),
    pillarUI('월', s.month, false),
    pillarUI('년', s.year, false),
  ]
  return {
    pillars,
    ohaeng: ohaengDist(pillars),
    daeun: c.daeun,
    dayMaster: { ganK: s.day.stem, gan: s.day.hanja[0], element: STEM[s.day.stem][0] },
  }
}

export function todayIljin(year, month, day) {
  const c = computeChart({ year, month, day, hour: 12, minute: 0, gender: 'F' }, terms)
  return {
    yearName: c.saju.year.name,
    monthName: c.saju.month.name,
    dayName: c.saju.day.name,
    dayHanja: c.saju.day.hanja,
  }
}
