// 만세력 엔진 검증 — 실행: node test/test_manseryeok.mjs
// 픽스처 1: 포스텔러 만세력 2.2 샘플 (forceteller-ref/snapshot_result.html에서 추출)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { computeChart, zonedToUtc, jdn } from '../src/manseryeok.js';

const here = dirname(fileURLToPath(import.meta.url));
const { terms } = JSON.parse(readFileSync(join(here, '..', 'data', 'solar_terms.json'), 'utf-8'));

let n = 0;
const ok = (name) => console.log(`ok ${++n} - ${name}`);

// ── 기반 검증 ────────────────────────────────────────────────
assert.equal(jdn(2000, 1, 1), 2451545, 'JDN 기준점');
ok('JDN: 2000-01-01 = 2451545');

// IANA 역사 오프셋: 1988 서머타임(+10h), 1955 UTC+8:30
{
  const dst88 = (Date.UTC(1988, 5, 1, 12, 0) - zonedToUtc(1988, 6, 1, 12, 0)) / 3600000;
  assert.equal(dst88, 10, '1988-06-01 서울은 UTC+10(서머타임)');
  ok('타임존: 1988 서머타임 +10h 반영');
  const y55 = (Date.UTC(1955, 0, 1, 12, 0) - zonedToUtc(1955, 1, 1, 12, 0)) / 3600000;
  assert.equal(y55, 8.5, '1955-01-01 서울은 UTC+8:30');
  ok('타임존: 1954–61 UTC+8:30 반영');
}

// ── 픽스처 1: 포스텔러 샘플 — 1990-01-01 12:00 여자 서울 ──────
{
  const c = computeChart({ year: 1990, month: 1, day: 1, hour: 12, minute: 0, gender: 'F' }, terms);

  // 보정 지역시 11:28 (포스텔러 표기 "지역시 -32분" 과 일치)
  assert.equal(c.correctedLocal.correctionMinutes, -32);
  assert.equal(`${c.correctedLocal.hh}:${c.correctedLocal.mm}`, '11:28');
  ok('진태양시: 12:00 → 11:28 (-32분)');

  assert.equal(c.saju.year.name, '기사');
  assert.equal(c.saju.month.name, '병자');
  assert.equal(c.saju.day.name, '병인');
  assert.equal(c.saju.hour.name, '갑오');
  ok('사주팔자: 기사년 병자월 병인일 갑오시');

  assert.equal(c.dayMaster, '병');
  assert.equal(c.saju.hour.stemTenGod, '편인');   // 갑
  assert.equal(c.saju.month.stemTenGod, '비견');  // 병
  assert.equal(c.saju.year.stemTenGod, '상관');   // 기
  assert.equal(c.saju.hour.branchTenGod, '겁재'); // 오(정)
  assert.equal(c.saju.day.branchTenGod, '편인');  // 인(갑)
  assert.equal(c.saju.month.branchTenGod, '정관');// 자(계)
  assert.equal(c.saju.year.branchTenGod, '비견'); // 사(병)
  ok('십신: 천간·지지(본기) 8자 전부 일치');

  assert.deepEqual(c.saju.hour.hiddenStems, ['병', '기', '정']);  // 오
  assert.deepEqual(c.saju.day.hiddenStems, ['무', '병', '갑']);   // 인
  assert.deepEqual(c.saju.month.hiddenStems, ['임', '계']);       // 자
  assert.deepEqual(c.saju.year.hiddenStems, ['무', '경', '병']);  // 사
  ok('지장간: 4지지 전부 일치');

  assert.equal(c.saju.hour.twelveStage, '제왕');  // 오
  assert.equal(c.saju.day.twelveStage, '장생');   // 인
  assert.equal(c.saju.month.twelveStage, '태');   // 자
  assert.equal(c.saju.year.twelveStage, '건록');  // 사
  ok('십이운성: 제왕·장생·태·건록 일치');

  // 대운: 음년(기) 여자 → 순행, 대운수 2, 첫 대운 정축
  assert.equal(c.daeun.forward, true);
  assert.equal(c.daeun.su, 2);
  assert.equal(c.daeun.list[0].name, '정축');
  assert.equal(c.daeun.list[0].age, 2);
  assert.equal(c.daeun.list[1].name, '무인');
  assert.equal(c.daeun.list[9].name, '병술');
  ok('대운: 순행·대운수 2·정축부터 (포스텔러 일치)');
}

// ── 경계 동작 확인 ───────────────────────────────────────────
{
  // 입춘 직전·직후 (2024 입춘 = 2024-02-04 17:27 KST)
  const before = computeChart({ year: 2024, month: 2, day: 4, hour: 17, minute: 0, gender: 'M', solarTimeCorrection: false }, terms);
  const after = computeChart({ year: 2024, month: 2, day: 4, hour: 17, minute: 30, gender: 'M', solarTimeCorrection: false }, terms);
  assert.equal(before.saju.year.name, '계묘'); // 2023
  assert.equal(after.saju.year.name, '갑진');  // 2024
  assert.equal(before.saju.month.name, '을축');
  assert.equal(after.saju.month.name, '병인');
  ok('입춘 경계: 17:00 계묘년 축월 / 17:30 갑진년 인월');

  // 정자시 규칙: 보정시 23시 이후 일주가 다음날로
  const lateNight = computeChart({ year: 1990, month: 1, day: 1, hour: 23, minute: 40, gender: 'M', solarTimeCorrection: false }, terms);
  assert.equal(lateNight.saju.day.name, '정묘'); // 병인 다음날
  assert.equal(lateNight.saju.hour.branch, '자');
  assert.equal(lateNight.saju.hour.name, '경자'); // 정일 → 경자시
  const keepDay = computeChart({ year: 1990, month: 1, day: 1, hour: 23, minute: 40, gender: 'M', solarTimeCorrection: false, lateZiRule: 'keepDay' }, terms);
  assert.equal(keepDay.saju.day.name, '병인'); // 야자시: 일주 유지
  ok('자시 규칙: 정자시(기본)·야자시 옵션 동작');
}

console.log(`\n전체 ${n}개 검증 통과`);
