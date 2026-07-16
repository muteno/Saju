// 만세력 엔진 코어 — 생년월일시 → 사주 원국(4주)·지장간·십신·십이운성·대운.
// 순수 계산 모듈: I/O 없음. 절기표(solar_terms.json의 terms 배열)는 호출자가 주입한다.
//
// 검증 픽스처: 포스텔러 만세력 2.2 샘플 (forceteller-ref/snapshot_result.html)
//   양력 1990-01-01 12:00 여자 서울 → 기사년 병자월 병인일 갑오시, 대운수 2(첫 대운 정축, 순행)
//
// 시간 규약:
//   입력 벽시계(출생지 표준시) → IANA tz로 UTC 환산(서머타임·UTC+8:30 시기 자동 반영)
//   → 경도 보정(진태양시, 서울 -32분)한 '보정 지역시'로 일주 경계·시진 판정
//   → 연·월주는 절입 시각(UTC 절대시각) 비교로 판정.

import {
  STEMS, BRANCHES, STEMS_HANJA, BRANCHES_HANJA, HIDDEN_STEMS, TEN_GODS,
  TWELVE_STAGES, TERM_NAMES, K_IPCHUN, monthBranchOfTerm,
  tenGod, twelveStage, sexStem, sexBranch, sexName, sexIndex, stemYang,
} from './tables.js';

const DAY_MS = 86400000;

/** 벽시계(y,m,d,hh,mm) + IANA 타임존 → UTC epoch ms. 역사적 오프셋(서머타임, +8:30) 반영. */
export function zonedToUtc(y, m, d, hh, mm, timeZone = 'Asia/Seoul') {
  const want = Date.UTC(y, m - 1, d, hh, mm);
  let guess = want;
  for (let i = 0; i < 4; i++) {
    const p = wallClockOf(guess, timeZone);
    const diff = want - Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
    if (diff === 0) return guess;
    guess += diff;
  }
  return guess;
}

/** UTC epoch → 해당 타임존 벽시계 성분 */
function wallClockOf(epochMs, timeZone) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const o = {};
  for (const part of f.formatToParts(new Date(epochMs))) o[part.type] = part.value;
  return { y: +o.year, m: +o.month, d: +o.day, hh: +o.hour, mm: +o.minute, ss: +o.second };
}

/** 그레고리력 날짜 → 율리우스일수(JDN, 정수) */
export function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

/** 절기표에서 utcMs 이전(포함) 마지막 절(홀수 k) 찾기. 반환: [epochMs, k] */
function lastJeol(terms, utcMs) {
  let lo = 0, hi = terms.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (terms[mid][0] <= utcMs) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  for (let i = ans; i >= 0; i--) if (terms[i][1] % 2 === 1) return terms[i];
  throw new Error('절기표 범위 이전 시각');
}

/** utcMs 이후 첫 절(순행 대운용) / 이전 절(역행) */
function adjacentJeol(terms, utcMs, forward) {
  if (forward) {
    for (const t of terms) if (t[0] > utcMs && t[1] % 2 === 1) return t;
    throw new Error('절기표 범위 초과');
  }
  return lastJeol(terms, utcMs);
}

/**
 * 사주 계산.
 * @param {object} input { year, month, day, hour, minute, gender: 'M'|'F',
 *   timeZone?: 'Asia/Seoul', longitude?: 126.978 (출생지 동경, 진태양시 보정용),
 *   solarTimeCorrection?: true, lateZiRule?: 'midnight23' }
 *   lateZiRule: 'midnight23'(기본, 정자시 — 보정시 23시부터 다음날 일주) | 'keepDay'(야자시 — 일주 유지)
 * @param {Array<[number,number]>} terms solar_terms.json 의 terms
 */
export function computeChart(input, terms) {
  const {
    year, month, day, hour, minute = 0, gender,
    timeZone = 'Asia/Seoul', longitude = 126.978,
    solarTimeCorrection = true, lateZiRule = 'midnight23',
  } = input;
  if (gender !== 'M' && gender !== 'F') throw new Error("gender는 'M'|'F'");

  // 1) 벽시계 → UTC (역사적 표준시/서머타임 반영: 1954–61 UTC+8:30, 1948–60·87–88 DST 등)
  const utcMs = zonedToUtc(year, month, day, hour, minute, timeZone);
  const civilOffsetMin = (Date.UTC(year, month - 1, day, hour, minute) - utcMs) / 60000;

  // 2) 진태양시(지역 평균시): LMT = UTC + 경도×4분 — 출생 시대의 표준시 제도와 무관하게 성립.
  //    (서울 126.978°E → UTC+508분. KST(+540분) 시대엔 벽시계 대비 -32분, UTC+8:30 시대엔 -2분)
  //    보정 지역시로 일주 경계·시진을 판정한다.
  const lmtOffsetMin = Math.round(longitude * 4);
  const corrMin = solarTimeCorrection ? lmtOffsetMin - civilOffsetMin : 0;
  const lmt = solarTimeCorrection
    ? wallClockOf(utcMs + lmtOffsetMin * 60000, 'UTC')
    : { y: year, m: month, d: day, hh: hour, mm: minute, ss: 0 };

  // 3) 연주·월주: 절입 시각(절대시각) 기준
  const [jeolMs, jeolK] = lastJeol(terms, utcMs);
  const monthBranch = monthBranchOfTerm(jeolK);
  // 사주 연도: 입춘(k=21) 이후면 그 벽시계 연도... 가 아니라 '입춘 절입 횟수'로 산정:
  // 마지막 입춘의 '절기표상 연도'를 쓰면 연말(자·축월) 처리에서 안전하다.
  const ipchun = lastIpchun(terms, utcMs);
  const sajuYear = new Date(ipchun[0] + 9 * 3600000).getUTCFullYear(); // 입춘은 항상 2월 초(KST 기준 연도 안전)
  const yearIdx = ((sajuYear - 1984) % 60 + 60) % 60;
  const yearStem = sexStem(yearIdx);

  // 월간: 오호둔 — 연간별 인월 천간 (갑기→병, 을경→무, 병신→경, 정임→임, 무계→갑)
  const inStem = ((yearStem % 5) * 2 + 2) % 10;
  const monthOrdinal = (monthBranch - 2 + 12) % 12; // 인=0 … 축=11
  const monthStem = (inStem + monthOrdinal) % 10;
  const monthIdx = sexIndex(monthStem, monthBranch);

  // 4) 일주: 보정 지역시의 달력 날짜 기준, 정자시 규칙이면 23시부터 다음날로
  let dayY = lmt.y, dayM = lmt.m, dayD = lmt.d;
  let advanceDay = lateZiRule === 'midnight23' && lmt.hh >= 23;
  let j = jdn(dayY, dayM, dayD) + (advanceDay ? 1 : 0);
  const dayIdx = ((j + 49) % 60 + 60) % 60; // 검증: 1990-01-01 → 병인(2)
  const dayStem = sexStem(dayIdx);

  // 5) 시주: 보정 지역시로 시진 판정 (23시~01시 자시 … 11~13 오시)
  const totalMin = lmt.hh * 60 + lmt.mm;
  const hourBranch = Math.floor(((totalMin + 60) % 1440) / 120);
  // 시두법: 일간별 자시 천간 (갑기→갑, 을경→병, 병신→무, 정임→경, 무계→임)
  // 정자시 규칙에서 23시 이후는 일주가 이미 다음날로 넘어갔으므로 그 일간 기준 자시가 맞다.
  const ziStem = ((dayStem % 5) * 2) % 10;
  const hourStem = (ziStem + hourBranch) % 10;
  const hourIdx = sexIndex(hourStem, hourBranch);

  // 6) 파생: 십신·지장간·십이운성
  const pillars = { year: yearIdx, month: monthIdx, day: dayIdx, hour: hourIdx };
  const detail = {};
  for (const [pos, idx] of Object.entries(pillars)) {
    const s = sexStem(idx), b = sexBranch(idx);
    detail[pos] = {
      name: sexName(idx),
      hanja: STEMS_HANJA[s] + BRANCHES_HANJA[b],
      stem: STEMS[s], branch: BRANCHES[b],
      stemTenGod: pos === 'day' ? '일간' : TEN_GODS[tenGod(dayStem, s)],
      branchMainStem: STEMS[HIDDEN_STEMS[b][HIDDEN_STEMS[b].length - 1]],
      branchTenGod: TEN_GODS[tenGod(dayStem, HIDDEN_STEMS[b][HIDDEN_STEMS[b].length - 1])],
      hiddenStems: HIDDEN_STEMS[b].map((h) => STEMS[h]),
      twelveStage: TWELVE_STAGES[twelveStage(dayStem, b)],
    };
  }

  // 7) 대운: 양년남/음년여 순행, 음년남/양년여 역행. 대운수 = 절입까지 일수/3 (올림, 최소 1)
  const yang = stemYang(yearStem);
  const forward = (gender === 'M') === yang;
  const target = adjacentJeol(terms, utcMs, forward);
  const daysGap = Math.abs(target[0] - utcMs) / DAY_MS;
  const daeunSu = Math.max(1, Math.ceil(daysGap / 3)); // 포스텔러 대조(2) — 유파별 반올림 옵션은 추후
  const daeun = [];
  for (let i = 1; i <= 10; i++) {
    const gi = ((monthIdx + (forward ? i : -i)) % 60 + 60) % 60;
    daeun.push({
      age: daeunSu + (i - 1) * 10,
      name: sexName(gi),
      stemTenGod: TEN_GODS[tenGod(dayStem, sexStem(gi))],
      twelveStage: TWELVE_STAGES[twelveStage(dayStem, sexBranch(gi))],
    });
  }

  return {
    input: { ...input, timeZone, longitude, solarTimeCorrection, lateZiRule },
    utcMs,
    correctedLocal: { ...lmt, correctionMinutes: corrMin },
    saju: detail,
    pillarsIdx: pillars,
    dayMaster: STEMS[dayStem],
    monthTerm: { name: TERM_NAMES[jeolK], atUtcMs: jeolMs },
    daeun: { su: daeunSu, forward, list: daeun },
  };
}

function lastIpchun(terms, utcMs) {
  let ans = null;
  for (const t of terms) {
    if (t[0] > utcMs) break;
    if (t[1] === K_IPCHUN) ans = t;
  }
  if (!ans) throw new Error('절기표 범위 이전 시각');
  return ans;
}
