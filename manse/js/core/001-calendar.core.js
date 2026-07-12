// 001-calendar.core.js — 역법 계산 코어 (JDN 일진 · 태양황경 절기 · 진태양시 보정)
// 근거: 일진 = JDN(율리우스일수) mod 60, 앵커 검증 2000-01-01 = 戊午日(공지 사실).
//       절기 = 태양 시황경 근사식(저정밀 천문 근사, 오차 ±수 분) — 경계 초접전 출생은 각주로 안내.
//       진태양시 = (출생지 경도 − 표준자오선) × 4분 + 균시차(EoT). 1954-08-10~1961-08-09 한국 UTC+8:30 반영.

export function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
    - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}
export const dayGanjiIdx = (jdnVal) => ((jdnVal + 49) % 60 + 60) % 60; // 0 = 甲子

// ── 태양 시황경 근사 (NOAA 저정밀식) ──────────────────────────────
const DEG = Math.PI / 180;
export function sunLongitude(jdms) { // jdms = UTC ms
  const n = jdms / 86400000 + 2440587.5 - 2451545.0; // J2000 기준 일수
  const L = (280.460 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG;
  return ((L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) % 360 + 360) % 360;
}

// 12절(節) — 월 경계용. [황경, 대략 월/일(탐색 시드)]
export const JIE = Object.freeze([
  { name: '입춘', deg: 315, m: 2, d: 4 },  { name: '경칩', deg: 345, m: 3, d: 6 },
  { name: '청명', deg: 15,  m: 4, d: 5 },  { name: '입하', deg: 45,  m: 5, d: 6 },
  { name: '망종', deg: 75,  m: 6, d: 6 },  { name: '소서', deg: 105, m: 7, d: 7 },
  { name: '입추', deg: 135, m: 8, d: 8 },  { name: '백로', deg: 165, m: 9, d: 8 },
  { name: '한로', deg: 195, m: 10, d: 8 }, { name: '입동', deg: 225, m: 11, d: 7 },
  { name: '대설', deg: 255, m: 12, d: 7 }, { name: '소한', deg: 285, m: 1, d: 6 },
]);

function angleDiff(a, b) { let d = (a - b) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; }

// 특정 연도의 절 시각(UTC ms) — 시드 ±6일 이분 탐색
export function jieTime(year, jie) {
  const seedY = jie.m === 1 ? year + 1 : year; // 소한은 이듬해 1월
  let lo = Date.UTC(seedY, jie.m - 1, jie.d - 6), hi = Date.UTC(seedY, jie.m - 1, jie.d + 6);
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (angleDiff(sunLongitude(mid), jie.deg) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// 출생 시각(UTC ms) 기준: 직전 절 idx(입춘=0…소한=11)와 그 연도, 전·후 절 시각
export function monthContext(utcMs) {
  const list = [];
  const y0 = new Date(utcMs).getUTCFullYear();
  for (let y = y0 - 1; y <= y0 + 1; y++) JIE.forEach((j, i) => list.push({ i, y, t: jieTime(y, j) }));
  list.sort((a, b) => a.t - b.t);
  let k = 0;
  while (k + 1 < list.length && list[k + 1].t <= utcMs) k++;
  return { cur: list[k], next: list[k + 1], prev: list[k] };
}

// ── 균시차(분) — 9.87식(B = 81일 기점) 근사, 검증 앵커: 5월 중순 ≈ +3.7분 / 11월 초 ≈ +16분 ──
export function equationOfTime(utcMs) {
  const d = new Date(utcMs);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const N = (utcMs - start) / 86400000;
  const B = 2 * Math.PI * (N - 81) / 364;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

// ── 한국 표준시 이력: 1954-08-10 ~ 1961-08-09 = UTC+8:30 (그 외 근현대 +9) ──
export function koreaUtcOffsetMin(y, m, d, apply1954) {
  if (!apply1954) return 540;
  const v = y * 10000 + m * 100 + d;
  return (v >= 19540810 && v <= 19610809) ? 510 : 540;
}

// 벽시계 출생시각 → 보정된 지역 진태양시 분(0~1439) + 자정 넘김 일수(-1/0/+1)
export function trueSolarMinutes({ y, mo, d, h, mi }, lonDeg, opts) {
  const offset = koreaUtcOffsetMin(y, mo, d, opts.apply1954);
  const stdMeridian = offset / 4; // 540분→135°, 510분→127.5°
  let corr = 0;
  if (opts.trueSolar) corr += (lonDeg - stdMeridian) * 4;
  const utcMs = Date.UTC(y, mo - 1, d, h, mi) - offset * 60000;
  if (opts.trueSolar && opts.eot) corr += equationOfTime(utcMs);
  let total = h * 60 + mi + corr;
  let dayShift = 0;
  if (total < 0) { total += 1440; dayShift = -1; }
  if (total >= 1440) { total -= 1440; dayShift = 1; }
  return { minutes: total, dayShift, corrMin: corr, utcMs };
}
