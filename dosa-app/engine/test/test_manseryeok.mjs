// 만세력 엔진 검증 — 실행: node test/test_manseryeok.mjs
// 픽스처 1: 포스텔러 만세력 2.2 샘플 (forceteller-ref/snapshot_result.html에서 추출)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { computeChart, zonedToUtc, jdn } from '../src/manseryeok.js';
import { twelveSinsal, auspicious, gongmang } from '../src/sinsal.js';
import { judgeStructure } from '../src/judge.js';
import { detectRelations } from '../src/relations.js';
import { BRANCHES } from '../src/tables.js';

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

// ── 신살·공망·합충 (포스텔러 픽스처 대조) ────────────────────
{
  const c = computeChart({ year: 1990, month: 1, day: 1, hour: 12, minute: 0, gender: 'F' }, terms);
  const p = c.pillarsIdx;

  // 12신살: 생년 망신살, 생월 육해살, 생일 겁살, 생시 년살
  const ts = twelveSinsal(p);
  assert.equal(ts.year, '망신살');
  assert.equal(ts.month, '육해살');
  assert.equal(ts.day, '겁살');
  assert.equal(ts.hour, '년살');
  ok('12신살: 망신·육해·겁살·년살 (포스텔러 일치)');

  // 길성 (broad 규칙 = 포스텔러): 자리별 정확 대조
  const au = auspicious(p, 'broad');
  const setEq = (got, want, label) => assert.deepEqual(new Set(got), new Set(want), label);
  setEq(au.hour.stem, ['현침살'], '시간(갑)');
  setEq(au.hour.branch, ['도화살', '현침살', '양인살'], '시지(오)');
  setEq(au.day.stem, [], '일간');
  setEq(au.day.branch, ['학당귀인', '문곡귀인', '홍염살', '역마살'], '일지(인)');
  setEq(au.month.stem, [], '월간');
  setEq(au.month.branch, ['도화살'], '월지(자)');
  setEq(au.year.stem, [], '년간');
  setEq(au.year.branch, ['천덕귀인', '정록', '역마살'], '년지(사)');
  ok('길성: 천덕·정록·역마·도화·학당·문곡·홍염·현침·양인 자리까지 일치');

  // 공망: 병인일 → 술해
  assert.deepEqual(gongmang(p.day).map((b) => BRANCHES[b]), ['술', '해']);
  ok('공망: 병인일 → 술해');

  // 합충: 갑기합(년간-시간), 자오충(월지-시지), 인오반합(화), 인사형·인사해(년지-일지)
  const r = detectRelations(p);
  assert.equal(r.stemHap.length, 1);
  assert.match(r.stemHap[0].name, /갑기합/);
  assert.deepEqual(new Set(r.stemHap[0].positions), new Set(['년', '시']));
  assert.equal(r.chung.length, 1);
  assert.match(r.chung[0].name, /자오충/);
  assert.equal(r.samhap.length, 1);
  assert.match(r.samhap[0].name, /인오반합\(화\)/);
  assert.equal(r.hyeong.length, 1);
  assert.match(r.hyeong[0].name, /인사형/);
  assert.equal(r.hae.length, 1);
  assert.match(r.hae[0].name, /인사해/);
  assert.equal(r.stemChung.length + r.yukhap.length + r.pa.length + r.wonjin.length + r.banghap.length, 0);
  assert.equal(r.gongmangHit.length, 0);
  ok('합충: 갑기합·자오충·인오반합·인사형·인사해 검출, 오검출 없음');
}

// 삼합·방합 완합 케이스 (합성 사주: 지지 신자진 + 자)
{
  // 2032-12-19 00:30 → 지지에 신자진 포함되는지 대신, 관계 검출만 단위 검증
  const fake = { year: 44 /*무신*/, month: 12 /*병자*/, day: 15 /*기묘*/, hour: 40 /*갑진*/ };
  const r = detectRelations(fake); // 지지: 신 자 묘 진
  assert.ok(r.samhap.some((x) => x.name.includes('신자진삼합')), '신자진 삼합 완합');
  assert.ok(r.hyeong.some((x) => x.name.includes('자묘')), '자묘형');
  assert.ok(r.pa.some((x) => x.name.includes('자유파')) === false);
  ok('합성 케이스: 신자진 완합·자묘형 검출');
}

// ── 구조 판정 (보드 110점제 — 포스텔러 '신강' 정답 대조) ──────
{
  const c = computeChart({ year: 1990, month: 1, day: 1, hour: 12, minute: 0, gender: 'F' }, terms);
  const j = judgeStructure(c);
  // 병인일주: 아신10+월간 병10+시간 갑10+년지 사15+일지 인15+시지 오10 = 70점
  assert.equal(j.strength.score, 70);
  assert.equal(j.strength.label, '신강'); // 포스텔러: "샘플님은 신강 한 사주입니다"
  assert.equal(j.strength.deukryeong, false); // 자월 정관 → 실령 (보드: 월령이 식/재/관)
  assert.equal(j.strength.deukji, true);      // 일지 인 편인
  assert.equal(j.strength.deuksi, true);      // 시지 오 겁재
  assert.equal(j.johu.season, '겨울');
  assert.equal(j.johu.need, '화');
  assert.equal(j.johu.satisfied, true);       // 화 4개 보유
  assert.deepEqual(j.profile.missing, ['금']);
  assert.ok(j.keys.includes('frame/신강'));
  assert.ok(j.keys.includes('frame/조후'));
  assert.ok(j.keys.includes('chain/관인상생')); // 관(자) + 인(갑·인)
  ok('구조 판정: 70/110 신강 (포스텔러 일치), 실령·득지·득시, 겨울생 조후, 금 부재');

  // 1993-11-30 08:00 남 순천 (계유·계해·을묘·경진): 인성3+비겁2 신강, 화 부재 → 무식상
  const c2 = computeChart({ year: 1993, month: 11, day: 30, hour: 8, minute: 0, gender: 'M', longitude: 127.4872 }, terms);
  const j2 = judgeStructure(c2);
  assert.equal(j2.strength.score, 75); // 아신10+년간10+월간10+월지 해30+일지 묘15
  assert.equal(j2.strength.label, '신강');
  assert.equal(j2.strength.deukryeong, true); // 해월 정인 → 득령
  assert.equal(j2.johu.satisfied, false);     // 겨울생인데 화 0
  assert.ok(j2.keys.includes('frame/무식상'));
  assert.ok(j2.keys.includes('chain/관인상생'));
  ok('구조 판정: 계유년 사주 75/110 신강·득령, 겨울생 화 부재(조후 미충족)·무식상');
}

console.log(`\n전체 ${n}개 검증 통과`);
