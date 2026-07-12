// 002-saju-engine.core.js — 사주 조립 엔진 (원국·대운·세운·오늘 + 자기검증)
// 지식모듈(001~005 knowledge)의 표·규칙만 소비한다. 여기엔 해석 지식을 두지 않는다(계층 계약).

import { STEMS, BRANCHES, ELEMENTS, ganjiOf, MONTH_BRANCH_FROM_IPCHUN, MONTH_STEM_START, HOUR_STEM_START, elIdx }
  from '../knowledge/001-ganji.knowledge.js';
import { JIJANGGAN, mainStemOf } from '../knowledge/002-jijanggan.knowledge.js';
import { sipsinOf } from '../knowledge/003-sipsin.knowledge.js';
import { unseongOf, sinsalOf, gongmangOf } from '../knowledge/004-unseong-sinsal.knowledge.js';
import { STRENGTH_WEIGHTS, STRENGTH_THRESHOLDS, isHelper, eokbuHint, johuHint, gyeokgukOf }
  from '../knowledge/005-strength-yongsin.knowledge.js';
import { pillarBranchRelations } from '../knowledge/008-hapchung.knowledge.js';
import { detectPatterns, isGanyeojidong } from '../knowledge/009-pattern.knowledge.js';
import { jdn, dayGanjiIdx, monthContext, trueSolarMinutes, jieTime, JIE } from './001-calendar.core.js';

const stemIdxOfHan = (han) => STEMS.findIndex((s) => s.han === han);

export function buildSaju(input, opts) {
  // input: {y,mo,d,h,mi,sex(1남/2여)}, opts: {trueSolar,eot,apply1954,lon,jasiMode,daeunRound,sinsalBase,daeunCount,seunCount}
  const ts = trueSolarMinutes(input, opts.lon, opts);
  const solar = { ...input };
  // 보정 후 시각으로 시지 판정. 날짜 넘김은 일진에 반영.
  let effJdn = jdn(input.y, input.mo, input.d) + ts.dayShift;
  const hm = ts.minutes;
  const hourBranch = Math.floor(((hm + 60) % 1440) / 120);
  // 자시 처리: 정자시 = 23시대 출생이면 일진 +1, 야자시 = 일진 유지(시지만 子)
  if (hm >= 23 * 60 && opts.jasiMode === '정자시') effJdn += 1;

  const dayIdx = dayGanjiIdx(effJdn);
  const day = ganjiOf(dayIdx);

  // 연주·월주: 절입(진태양시 보정된 UTC 시각) 기준
  const utc = ts.utcMs;
  const mc = monthContext(utc);
  const ipchun = jieTime(new Date(utc).getUTCFullYear(), JIE[0]);
  let sajuYear = new Date(utc).getUTCFullYear();
  if (utc < ipchun) sajuYear -= 1;
  const year = { stem: ((sajuYear - 4) % 10 + 10) % 10, branch: ((sajuYear - 4) % 12 + 12) % 12 };

  const monthOffset = mc.cur.i; // 입춘=0 … 소한=11
  const month = {
    stem: (MONTH_STEM_START[year.stem % 5] + monthOffset) % 10,
    branch: MONTH_BRANCH_FROM_IPCHUN[monthOffset],
  };
  const hour = { stem: (HOUR_STEM_START[day.stem % 5] + hourBranch) % 10, branch: hourBranch };

  const pillars = { 시주: hour, 일주: day, 월주: month, 년주: year };

  // 부가 분석 — 전부 지식모듈 규칙 호출
  const dayStem = day.stem;
  const per = {};
  for (const [k, p] of Object.entries(pillars)) {
    const bHan = BRANCHES[p.branch].han;
    per[k] = {
      ...p,
      stemSipsin: k === '일주' ? '일간(我)' : sipsinOf(dayStem, p.stem),
      branchMain: mainStemOf(bHan),
      branchSipsin: sipsinOf(dayStem, stemIdxOfHan(mainStemOf(bHan))),
      jijanggan: JIJANGGAN[bHan],
      unseong: unseongOf(dayStem, p.branch),
    };
  }
  // 신살(기준 선택) · 공망
  const baseBranch = opts.sinsalBase === '일지' ? day.branch : year.branch;
  for (const k of Object.keys(per)) per[k].sinsal = sinsalOf(baseBranch, per[k].branch);
  const gongmang = gongmangOf(dayIdx);

  // 오행 분포(천간 4 + 지지 본기 4)
  const counts = Object.fromEntries(ELEMENTS.map((e) => [e, 0]));
  for (const p of Object.values(pillars)) {
    counts[STEMS[p.stem].el]++;
    counts[STEMS[stemIdxOfHan(mainStemOf(BRANCHES[p.branch].han))].el]++;
  }

  // 신강신약(간이) — 가중치는 지식모듈 명시 휴리스틱
  const dayEl = STEMS[dayStem].el;
  let score = 0;
  const helperAt = (el, w) => { if (isHelper(dayEl, el)) score += w; };
  helperAt(STEMS[stemIdxOfHan(per.월주.branchMain)].el, STRENGTH_WEIGHTS.월지);
  helperAt(STEMS[stemIdxOfHan(per.일주.branchMain)].el, STRENGTH_WEIGHTS.일지);
  helperAt(STEMS[stemIdxOfHan(per.시주.branchMain)].el, STRENGTH_WEIGHTS.시지);
  helperAt(STEMS[stemIdxOfHan(per.년주.branchMain)].el, STRENGTH_WEIGHTS.년지);
  helperAt(STEMS[year.stem].el, STRENGTH_WEIGHTS.년간);
  helperAt(STEMS[month.stem].el, STRENGTH_WEIGHTS.월간);
  helperAt(STEMS[hour.stem].el, STRENGTH_WEIGHTS.시간);
  const strength = score >= STRENGTH_THRESHOLDS.신강 ? '신강' : score >= STRENGTH_THRESHOLDS.중화 ? '중화' : '신약';

  const yongsin = {
    eokbu: eokbuHint(strength, elIdx(dayEl), counts, ELEMENTS),
    johu: johuHint(month.branch),
    gyeokguk: gyeokgukOf(per.월주.branchSipsin, STEMS[dayStem].yang),
  };

  // 대운: 방향 = (연간 양 XOR 여성) — 양간 남명/음간 여명 순행
  const male = input.sex === 1;
  const forward = STEMS[year.stem].yang === male;
  const boundary = forward ? mc.next.t : mc.prev.t;
  const days = Math.abs(boundary - utc) / 86400000;
  const rawSu = days / 3;
  const su = Math.max(1, opts.daeunRound === '올림' ? Math.ceil(rawSu) : opts.daeunRound === '버림' ? Math.floor(rawSu) || 1 : Math.round(rawSu));
  const monthIdx60 = findIdx60(month.stem, month.branch);
  const daeun = Array.from({ length: opts.daeunCount }, (_, k) => {
    const g = ganjiOf(monthIdx60 + (forward ? 1 : -1) * (k + 1));
    return { age: su + 10 * k, ...g, stemSipsin: sipsinOf(dayStem, g.stem), branchSipsin: sipsinOf(dayStem, stemIdxOfHan(mainStemOf(BRANCHES[g.branch].han))) };
  });

  // 세운: 올해 기준 앞뒤로
  const nowY = new Date().getFullYear();
  const seun = Array.from({ length: opts.seunCount }, (_, k) => {
    const yy = nowY - 1 + k;
    const gg = ganjiOf((yy - 4) % 60); // ganjiOf가 음수 mod 정규화
    return { year: yy, ...gg, stemSipsin: sipsinOf(dayStem, gg.stem) };
  });

  // 오늘(일운·월운·년운 스트립)
  const t = new Date();
  const todayCtx = monthContext(Date.now());
  const todayIpchun = jieTime(t.getFullYear(), JIE[0]);
  let ty = t.getFullYear(); if (Date.now() < todayIpchun) ty -= 1;
  const tYear = ganjiOf((ty - 4) % 60);
  const tMonth = { stem: (MONTH_STEM_START[(((ty - 4) % 10 + 10) % 10) % 5] + todayCtx.cur.i) % 10, branch: MONTH_BRANCH_FROM_IPCHUN[todayCtx.cur.i] };
  const tDay = ganjiOf(dayGanjiIdx(jdn(t.getFullYear(), t.getMonth() + 1, t.getDate())));
  const today = { year: tYear, month: tMonth, day: tDay };

  // 지지 관계(원국 4지지) + 십신 패턴 — FigJam 접목분
  const relations = pillarBranchRelations(['시주', '일주', '월주', '년주'].map((k) => pillars[k].branch));
  const sipsinCounts = {};
  for (const k of Object.keys(per)) {
    if (k !== '일주') sipsinCounts[per[k].stemSipsin] = (sipsinCounts[per[k].stemSipsin] || 0) + 1;
    sipsinCounts[per[k].branchSipsin] = (sipsinCounts[per[k].branchSipsin] || 0) + 1;
  }
  const patterns = detectPatterns(sipsinCounts, { strength });
  if (isGanyeojidong(STEMS[dayStem].el, STEMS[stemIdxOfHan(per.일주.branchMain)].el)) patterns.push({ key: '간여지동', gloss: '일간=일지 오행: 강한 자기중심' });

  return { input, opts, ts, pillars: per, dayIdx, gongmang, counts, score, strength, yongsin, daeun, daeunSu: su, forward, seun, today, solar, relations, sipsinCounts, patterns };
}

function findIdx60(stem, branch) { for (let i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return i; return 0; }

// ── 자기검증(앵커 사실 + 규칙 스팟체크) — UI 푸터와 헤드리스 검증이 함께 씀 ──
export function runSelfTest() {
  const T = [];
  const eq = (name, got, want) => T.push({ name, got: String(got), want: String(want), pass: String(got) === String(want) });
  eq('일진 앵커 2000-01-01=戊午', (() => { const g = ganjiOf(dayGanjiIdx(jdn(2000, 1, 1))); return STEMS[g.stem].han + BRANCHES[g.branch].han; })(), '戊午');
  eq('60갑자 0=甲子', (() => { const g = ganjiOf(0); return STEMS[g.stem].han + BRANCHES[g.branch].han; })(), '甲子');
  eq('십신 甲→庚=편관', sipsinOf(0, 6), '편관');
  eq('십신 甲→乙=겁재', sipsinOf(0, 1), '겁재');
  eq('운성 甲+亥=장생', unseongOf(0, 11), '장생');
  eq('운성 乙+午=장생', unseongOf(1, 6), '장생');
  eq('신살 子기준 酉=년살', sinsalOf(0, 9), '년살');
  eq('신살 子기준 寅=역마살', sinsalOf(0, 2), '역마살');
  eq('공망 甲子일=戌亥', gongmangOf(0).map((i) => BRANCHES[i].han).join(''), '戌亥');
  eq('입춘2000 2/3~2/5', (() => { const d = new Date(jieTime(2000, JIE[0])); return d.getUTCMonth() === 1 && d.getUTCDate() >= 3 && d.getUTCDate() <= 5; })(), 'true');
  eq('지장간 寅 본기=甲', mainStemOf('寅'), '甲');
  // 종합: 1990-05-15 12:30 서울 남 → 庚午년 辛巳월 (월두법 검증)
  const s = buildSaju({ y: 1990, mo: 5, d: 15, h: 12, mi: 30, sex: 1 }, { trueSolar: false, eot: false, apply1954: true, lon: 126.98, jasiMode: '야자시', daeunRound: '반올림', sinsalBase: '년지', daeunCount: 8, seunCount: 12 });
  eq('1990-05-15 년주=庚午', STEMS[s.pillars.년주.stem].han + BRANCHES[s.pillars.년주.branch].han, '庚午');
  eq('1990-05-15 월주=辛巳', STEMS[s.pillars.월주.stem].han + BRANCHES[s.pillars.월주.branch].han, '辛巳');
  // FigJam 접목: 지지관계·패턴 배선 확인
  eq('지지관계 배열 존재', Array.isArray(s.relations), 'true');
  eq('십신카운트 합=7(일간 제외 8자)', Object.values(s.sipsinCounts).reduce((a, b) => a + b, 0), '7');
  return T;
}
