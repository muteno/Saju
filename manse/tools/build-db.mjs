// build-db.mjs — 지식모듈(SSOT) → 정적 DB(JSON 테이블) 생성기
// 원칙: DB는 파생물. 손 편집 금지 — 규칙이 바뀌면 knowledge 모듈을 고치고 이 스크립트를 재실행한다.
// 실행: node manse/tools/build-db.mjs  (레포 루트 기준)

import { mkdir, writeFile } from 'node:fs/promises';
import { STEMS, BRANCHES, ELEMENTS, ganjiOf, MONTH_STEM_START, HOUR_STEM_START, MONTH_BRANCH_FROM_IPCHUN }
  from '../js/knowledge/001-ganji.knowledge.js';
import { JIJANGGAN, mainStemOf } from '../js/knowledge/002-jijanggan.knowledge.js';
import { sipsinOf, YUKCHIN, TEN_GODS } from '../js/knowledge/003-sipsin.knowledge.js';
import { unseongOf, sinsalOf, gongmangOf, UNSEONG_STAGES, SINSAL_ORDER }
  from '../js/knowledge/004-unseong-sinsal.knowledge.js';
import { STRENGTH_WEIGHTS, STRENGTH_THRESHOLDS } from '../js/knowledge/005-strength-yongsin.knowledge.js';
import { branchRelations, HAP_STRENGTH } from '../js/knowledge/008-hapchung.knowledge.js';
import { GUNGWI, GUNG_PAIR } from '../js/knowledge/007-gungwi.knowledge.js';
import { PATTERNS } from '../js/knowledge/009-pattern.knowledge.js';
import { CHEONGAN_ARCHETYPE, TOPIC_ROADMAP } from '../js/knowledge/011-cheongan-archetype.knowledge.js';
import { JIJI_ARCHETYPE, JIJI_ROLE } from '../js/knowledge/012-jiji-archetype.knowledge.js';
import { UNSEONG_MEANING } from '../js/knowledge/013-unseong-meaning.knowledge.js';
import { SIPSIN_KEYWORDS } from '../js/knowledge/006-sipsin-keywords.knowledge.js';
import { jieTime, JIE } from '../js/core/001-calendar.core.js';

const OUT = new URL('../db/', import.meta.url);
const VERSION = 1; // 스키마·내용이 바뀌면 올린다(생성 시각은 diff 소음이라 넣지 않음)

const meta = (name, note) => ({
  name, version: VERSION, source: 'manse/js/knowledge (SSOT) — 이 파일은 생성물, 손 편집 금지',
  generator: 'manse/tools/build-db.mjs', note,
});

const files = {};

// 1) 천간·지지 원표
files['stems.json'] = {
  meta: meta('천간', '연해자평 공통 원표'),
  data: STEMS.map((s, i) => ({ idx: i, ...s })),
};
files['branches.json'] = {
  meta: meta('지지', '시간대 라벨 포함'),
  data: BRANCHES.map((b, i) => ({ idx: i, ...b, jijanggan: JIJANGGAN[b.han].map((j) => j.stem).join('') })),
};

// 2) 60갑자 전표 (일진·연주·순중공망 룩업의 기본 키)
files['ganji60.json'] = {
  meta: meta('60갑자', 'idx 0=甲子. 공망은 해당 일주 기준 순중공망 지지 idx'),
  data: Array.from({ length: 60 }, (_, i) => {
    const g = ganjiOf(i);
    return {
      idx: i, han: STEMS[g.stem].han + BRANCHES[g.branch].han, kor: STEMS[g.stem].kor + BRANCHES[g.branch].kor,
      stem: g.stem, branch: g.branch, stemEl: STEMS[g.stem].el, branchEl: BRANCHES[g.branch].el,
      gongmang: gongmangOf(i),
    };
  }),
};

// 3) 지장간
files['jijanggan.json'] = {
  meta: meta('지장간', '월률분야 통설표. 본기 = 마지막 원소(계약)'),
  data: Object.fromEntries(Object.entries(JIJANGGAN).map(([b, list]) => [b, { hidden: list, main: mainStemOf(b) }])),
};

// 4) 십신 매트릭스 10×10 (+ 지지 본기 환산 10×12)
files['sipsin.json'] = {
  meta: meta('십신', 'rows=일간 idx, cols=대상 천간 idx. branch_matrix는 지지 본기 환산'),
  names: TEN_GODS,
  yukchin: YUKCHIN,
  stem_matrix: STEMS.map((_, d) => STEMS.map((_, t) => sipsinOf(d, t))),
  branch_matrix: STEMS.map((_, d) => BRANCHES.map((b) => sipsinOf(d, STEMS.findIndex((s) => s.han === mainStemOf(b.han))))),
};

// 5) 십이운성 매트릭스 10×12
files['unseong.json'] = {
  meta: meta('십이운성', '양간 순행·음간 역행(양생음사). rows=천간 idx, cols=지지 idx'),
  stages: UNSEONG_STAGES,
  matrix: STEMS.map((_, s) => BRANCHES.map((_, b) => unseongOf(s, b))),
};

// 6) 십이신살 매트릭스 12×12
files['sinsal.json'] = {
  meta: meta('십이신살', '삼합 겁살 기점. rows=기준지(년지/일지) idx, cols=대상지 idx'),
  order: SINSAL_ORDER,
  matrix: BRANCHES.map((_, base) => BRANCHES.map((_, t) => sinsalOf(base, t))),
};

// 7) 기두법(월두·시두) + 월지 순서
files['gidubeop.json'] = {
  meta: meta('기두법', '오호둔(연간→월간 기점)·오서둔(일간→시간 기점)·입춘 기점 월지 순서'),
  month_stem_start: MONTH_STEM_START, hour_stem_start: HOUR_STEM_START,
  month_branch_from_ipchun: MONTH_BRANCH_FROM_IPCHUN,
};

// 8) 신강약 가중치(명시적 휴리스틱 — 정본 아님 라벨)
files['strength.json'] = {
  meta: meta('신강약 가중치', '참고용 휴리스틱. 유파 합의 없음 — 정본 행세 금지'),
  weights: STRENGTH_WEIGHTS, thresholds: STRENGTH_THRESHOLDS, total: 90,
};

// 9) 출생지 경도(진태양시 보정 입력)
files['cities.json'] = {
  meta: meta('출생지 경도', '표준자오선 135°E(1954-08-10~1961-08-09는 127.5°E) 대비 분 보정 = (lon-기준)×4'),
  data: { 서울: 126.98, 부산: 129.08, 대구: 128.60, 인천: 126.71, 광주: 126.85, 대전: 127.38, 강릉: 128.90, 제주: 126.53 },
};

// 10) 절기 시각 사전계산 1900~2050 (12절 = 월 경계용) — 만세력 DB의 핵심 테이블
const jieqi = [];
for (let y = 1900; y <= 2050; y++) {
  for (const j of JIE) {
    const t = jieTime(y, j);
    jieqi.push({ y, name: j.name, deg: j.deg, utc: new Date(t).toISOString().slice(0, 16) + 'Z' });
  }
}
files['jieqi_1900_2050.json'] = {
  meta: meta('절기(12節) 시각', 'NOAA 저정밀 근사 ±수 분. 분 단위 절삭. 연도 y의 소한은 이듬해 1월에 위치'),
  count: jieqi.length,
  data: jieqi,
};

// 11) 지지 관계 매트릭스 12×12 (합충형파해원진) — FigJam 접목분
files['hapchung.json'] = {
  meta: meta('지지 관계', '삼합·방합·육합·충·형·파·해·원진 전조합. FigJam 강도서열 계승'),
  strength: HAP_STRENGTH,
  matrix: BRANCHES.map((_, a) => BRANCHES.map((_, b) => (a === b ? [] : branchRelations(a, b).map((r) => r.type + (r.el ? `(${r.el})` : ''))))),
};

// 12) 궁위론 + 십신 조합 패턴 (구조/트리거만)
files['gungwi.json'] = { meta: meta('궁위론', '근묘화실·궁성 구조 라벨(FigJam 계승)'), palaces: GUNGWI, pairs: GUNG_PAIR };
files['patterns.json'] = {
  meta: meta('십신 패턴', '트리거 조건은 함수라 직렬화 불가 → key/gloss만. 판정은 009 모듈 detectPatterns 사용'),
  data: PATTERNS.map((p) => ({ key: p.key, gloss: p.gloss })),
};

// 13) 천간 아키타입(통설 키워드) + 주제 로드맵
files['cheongan_archetype.json'] = {
  meta: meta('천간 아키타입', '통설 물상·성정 키워드(공개 사실 재정리). 유료 게시판 본문 미인용'),
  data: CHEONGAN_ARCHETYPE, roadmap: TOPIC_ROADMAP,
};

// 14) 지지 아키타입 + 생왕고 분류
files['jiji_archetype.json'] = {
  meta: meta('지지 아키타입', '통설 물상·성정 + 생지/왕지/고지(역마·도화·화개) 분류'),
  data: JIJI_ARCHETYPE, roles: JIJI_ROLE,
};

// 15) 십이운성 의미 태그
files['unseong_meaning.json'] = {
  meta: meta('십이운성 의미', '단계별 상징 의미 태그(판정은 unseong.json)'),
  data: UNSEONG_MEANING,
};

// 16) 십신 키워드(미약/과다) 10종
files['sipsin_keywords.json'] = {
  meta: meta('십신 키워드', '십신별 미약/과다/관계 키워드 10종(통설 재정리)'),
  data: SIPSIN_KEYWORDS,
};

// ── 검증(앵커) 후 기록 ──
const assert = (name, cond) => { if (!cond) throw new Error(`DB 검증 실패: ${name}`); console.log(`ok  ${name}`); };
assert('60갑자 0=甲子', files['ganji60.json'].data[0].han === '甲子');
assert('甲子 공망=戌亥(10,11)', files['ganji60.json'].data[0].gongmang.join(',') === '10,11');
assert('십신 [갑][경]=편관', files['sipsin.json'].stem_matrix[0][6] === '편관');
assert('운성 [갑][해]=장생', files['unseong.json'].matrix[0][11] === '장생');
assert('신살 [자][유]=년살', files['sinsal.json'].matrix[0][9] === '년살');
assert('절기 행수 151×12', jieqi.length === 151 * 12);
const ip2000 = jieqi.find((r) => r.y === 2000 && r.name === '입춘');
assert('입춘2000 = 2월 3~5일', /^2000-02-0[345]/.test(ip2000.utc));
assert('지지관계 子(0)午(6)=충', files['hapchung.json'].matrix[0][6].includes('충'));
assert('지지관계 寅(2)午(6)=반합(화)', files['hapchung.json'].matrix[2][6].some((s) => s.startsWith('반합') && s.includes('화')));
const oo = branchRelations(6, 6).map((r) => r.type);
assert('午午=자형만(삼합 아님)', oo.includes('자형') && !oo.some((t) => t.includes('삼합') || t.includes('반합')));
assert('천간 아키타입 10천간', Object.keys(files['cheongan_archetype.json'].data).length === 10);
assert('甲=목·큰 나무', files['cheongan_archetype.json'].data.甲.el === '목');
assert('지지 아키타입 12지지', Object.keys(files['jiji_archetype.json'].data).length === 12);
assert('子=왕지', files['jiji_archetype.json'].data.子.자리 === '왕지');
assert('생지=寅申巳亥', files['jiji_archetype.json'].roles.생지.branches.join('') === '寅申巳亥');
assert('십이운성 의미 12단계', Object.keys(files['unseong_meaning.json'].data).length === 12);
assert('십신 키워드 10종', Object.keys(files['sipsin_keywords.json'].data).length === 10);
assert('지지관계 子(0)丑(1)=육합(토)', files['hapchung.json'].matrix[0][1].includes('육합(토)'));

await mkdir(OUT, { recursive: true });
let total = 0;
const manifest = [];
for (const [fname, obj] of Object.entries(files)) {
  const body = JSON.stringify(obj, null, 1);
  await writeFile(new URL(fname, OUT), body);
  total += body.length;
  manifest.push({ file: fname, bytes: body.length, name: obj.meta.name });
  console.log(`write ${fname} ${(body.length / 1024).toFixed(1)}KB`);
}
await writeFile(new URL('manifest.json', OUT), JSON.stringify({ meta: meta('DB 목록', 'db/ 전체 색인'), files: manifest }, null, 1));
console.log(`TOTAL ${(total / 1024).toFixed(1)}KB / ${Object.keys(files).length} tables + manifest`);
