// 010-jeonggok.knowledge.js — 정곡(적중 포인트) 선별기 (상담 엔진의 탄약고)
// 계약: buildSaju(manse 엔진) 반환을 받아, "계산이 참인 특징"만 후보로 올리고
//       임팩트(희소 R×.35 + 체감 F×.40 + 안전 S×.25)로 랭킹해 5스텝에 배치한다.
// 정본 = docs/상담엔진_설계.md §2·§3·§8(시간미상 게이팅). 문구는 label/gloss 슬롯만(표현층이 입힘).
// 원칙: 없는 특징은 후보 자체가 안 됨(발화 금지) · 흉계열 tone='SOFT'(활용형·질문형 순화 대상).

import { STEMS, BRANCHES, ELEMENTS } from '../../manse/js/knowledge/001-ganji.knowledge.js';
import { JIJI_ARCHETYPE, JIJI_ROLE } from '../../manse/js/knowledge/012-jiji-archetype.knowledge.js';
import { SAMHAP, branchRelations } from '../../manse/js/knowledge/008-hapchung.knowledge.js';
import { isGoegang, isBaekho, yanginBranchOf, gwimunPairsIn } from '../../manse/js/knowledge/014-special-sinsal.knowledge.js';

// 엔진 relations의 자리 규약(002 엔진 L125와 동일 순서)
export const PALACES = Object.freeze(['시주', '일주', '월주', '년주']);
const PALACE_DOMAIN = Object.freeze({ 년주: '초년·뿌리', 월주: '사회·일', 일주: '나·배우자', 시주: '자식·말년' });

const GROUPS = Object.freeze({
  비겁: ['비견', '겁재'], 식상: ['식신', '상관'], 재성: ['편재', '정재'],
  관성: ['편관', '정관'], 인성: ['편인', '정인'],
});

const impactOf = (R, F, S) => Math.round((R * 0.35 + F * 0.40 + S * 0.25) * 100) / 100;

// ── ctx: 시간미상이면 시주를 뺀 정직한 뷰를 만든다(설계 §8 게이팅) ──
function buildCtx(saju, timeKnown) {
  const keys = timeKnown ? PALACES : PALACES.slice(1); // 시주 제외
  const branches = keys.map((k) => saju.pillars[k].branch);

  // 오행 분포 — 시간미상이면 3기둥 재집계(엔진 counts는 시주 포함이라 사용 불가)
  let counts = saju.counts;
  if (!timeKnown) {
    counts = Object.fromEntries(ELEMENTS.map((e) => [e, 0]));
    for (const k of keys) {
      counts[STEMS[saju.pillars[k].stem].el]++;
      counts[BRANCHES[saju.pillars[k].branch].el]++; // 지지 본기 오행 = 지지 자체 오행(전 12지 일치 검증됨)
    }
  }

  // 십신 그룹 카운트 — 엔진 규약 미러: 천간(일주 제외) + 지지 본기(전 기둥), 시간미상이면 시주분 제외
  const g = Object.fromEntries(Object.keys(GROUPS).map((k) => [k, 0]));
  const addSipsin = (name) => {
    for (const [grp, members] of Object.entries(GROUPS)) if (members.includes(name)) g[grp]++;
  };
  for (const k of keys) {
    if (k !== '일주') addSipsin(saju.pillars[k].stemSipsin);
    addSipsin(saju.pillars[k].branchSipsin);
  }

  // 지지 관계 — 시간미상이면 시주(자리 0)가 낀 쌍 제거
  const relations = timeKnown ? saju.relations : saju.relations.filter((r) => r.i !== 0 && r.j !== 0);

  return { keys, branches, counts, groups: g, relations };
}

// ── 후보 생성기들: 참인 것만 push ──
function collect(saju, ctx, { timeKnown, nowYear }) {
  const out = [];
  const add = (c) => out.push({ ...c, impact: impactOf(c.R, c.F, c.S) });
  const palaceOfRel = (idx) => PALACES[idx]; // relations i/j → 궁 이름(엔진 순서)

  // A군 — 오행 분포 (스텝①)
  for (const el of ELEMENTS) {
    if (ctx.counts[el] === 0)
      add({ key: `element_zero.${el}`, step: 1, tone: 'DIRECT', R: 3, F: 3, S: 4,
        label: `${el} 0개`, gloss: '비어 있는 기운 — 결핍은 보완법과 세트로만 서술', facts: { el } });
    else if (ctx.counts[el] >= 5)
      add({ key: `element_dominant.${el}`, step: 1, tone: 'DIRECT', R: 5, F: 3, S: 3,
        label: `${el} ${ctx.counts[el]}개 편중`, gloss: '한 기운이 판을 지배(종격 후보 — 참고 라벨)', facts: { el, n: ctx.counts[el] } });
    else if (ctx.counts[el] >= 4)
      add({ key: `element_excess.${el}`, step: 1, tone: 'DIRECT', R: 4, F: 3, S: 4,
        label: `${el} ${ctx.counts[el]}개 과다`, gloss: '기운 쏠림 — 성향 경향으로 서술', facts: { el, n: ctx.counts[el] } });
  }

  // A군 — 십신 그룹 (스텝②)
  for (const [grp, n] of Object.entries(ctx.groups)) {
    if (n >= 3)
      add({ key: `group_excess.${grp}`, step: 2, tone: 'DIRECT', R: 3, F: 3, S: 4,
        label: `${grp} ${n}개 과다`, gloss: '역할 쏠림 — 삶 장면 태그와 연결', facts: { group: grp, n } });
  }
  for (const grp of ['재성', '관성']) {
    if (ctx.groups[grp] === 0)
      add({ key: `group_void.${grp}`, step: 2, tone: 'DIRECT', R: 2, F: 3, S: 3,
        label: `${grp} 없음`, gloss: '역할 부재 — 부정 서사 금지, 활용 경로로 연결', facts: { group: grp } });
  }

  // B군 — 지지 관계 (스텝②)
  for (const r of ctx.relations) {
    const pal = [palaceOfRel(r.i), palaceOfRel(r.j)];
    const pair = `${BRANCHES[r.a].han}${BRANCHES[r.b].han}`;
    for (const rel of r.rel) {
      if (rel.type === '충')
        add({ key: `chung.${pair}`, step: 2, tone: 'SOFT', R: 3, F: pal.includes('일주') ? 5 : 4, S: 3,
          label: `${pair} 충 (${pal.join('·')})`, gloss: '움직임·변동의 축 — 시기(⑤)로 세로 연결', facts: { palaces: pal, pair } });
      else if (rel.type === '원진')
        add({ key: `wonjin.${pair}`, step: 2, tone: 'SOFT', R: 3, F: 4, S: 2,
          label: `${pair} 원진 (${pal.join('·')})`, gloss: '애증 공존 — 관계 결로만, 단정 금지', facts: { palaces: pal, pair } });
      else if (rel.type.startsWith('형') || rel.type === '자형')
        add({ key: `hyeong.${pair}`, step: 2, tone: 'SOFT', R: 3, F: 3, S: 2,
          label: `${pair} ${rel.type} (${pal.join('·')})`, gloss: '조정·마찰의 기운 — 직업적 활용 프레임', facts: { palaces: pal, pair, type: rel.type } });
    }
  }
  // 삼합 완성(3지 전부 — 엔진은 쌍 단위라 여기서 판정)
  for (const s of SAMHAP) {
    if (s.branches.every((b) => ctx.branches.includes(b)))
      add({ key: `samhap_full.${s.el}`, step: 2, tone: 'DIRECT', R: 5, F: 3, S: 4,
        label: `${s.branches.map((b) => BRANCHES[b].han).join('')} 삼합국(${s.el})`, gloss: '세 지지가 한 국으로 결집 — 강한 사회적 발현(희소)', facts: { el: s.el } });
  }
  // 귀문(014)
  for (const p of gwimunPairsIn(ctx.branches)) {
    const pal = [ctx.keys[p.i], ctx.keys[p.j]];
    add({ key: `gwimun.${BRANCHES[p.a].han}${BRANCHES[p.b].han}`, step: 2, tone: 'SOFT', R: 3, F: 4, S: 2,
      label: `${BRANCHES[p.a].han}${BRANCHES[p.b].han} 귀문 (${pal.join('·')})`, gloss: '예민·몰입·직관 — 병리 단정 금지, 자원으로 서술', facts: { palaces: pal } });
  }
  // 간여지동(일간=일지 — 시간 무관, 엔진 patterns에서)
  if ((saju.patterns || []).some((p) => p.key === '간여지동'))
    add({ key: 'ganyeojidong', step: 2, tone: 'DIRECT', R: 3, F: 3, S: 4,
      label: '간여지동(일간=일지)', gloss: '강한 자기중심 축 — 주체성·사업 프레임', facts: {} });

  // C군 — 생왕고·특수신살 (스텝①·③)
  const roleHits = { 생지: [], 왕지: [], 고지: [] };
  ctx.keys.forEach((k) => {
    const arch = JIJI_ARCHETYPE[BRANCHES[saju.pillars[k].branch].han];
    if (arch) roleHits[arch.자리].push(k);
  });
  for (const [자리, palaces] of Object.entries(roleHits)) {
    if (!palaces.length) continue;
    const role = JIJI_ROLE[자리];
    add({ key: `role.${자리}`, step: 3, tone: 'DIRECT', R: 2, F: 3, S: 5,
      label: `${role.sinsal} 기질 ×${palaces.length} (${palaces.join('·')})`, gloss: role.gloss, facts: { 자리, palaces } });
  }
  for (const k of ctx.keys) {
    const p = saju.pillars[k];
    if (isGoegang(p.stem, p.branch))
      add({ key: `goegang.${k}`, step: 1, tone: 'DIRECT', R: 4, F: k === '일주' ? 4 : 3, S: 4,
        label: `${STEMS[p.stem].han}${BRANCHES[p.branch].han} 괴강 (${k})`, gloss: '주체성·결단의 간지(60갑자 중 6) — 매력 프레임', facts: { palace: k } });
    if (isBaekho(p.stem, p.branch))
      add({ key: `baekho.${k}`, step: 3, tone: 'SOFT', R: 4, F: 3, S: 2,
        label: `${STEMS[p.stem].han}${BRANCHES[p.branch].han} 백호 (${k})`, gloss: '강렬·돌발의 기운 — 반드시 전문성·책임 활용형으로', facts: { palace: k } });
  }
  const yin = yanginBranchOf(saju.pillars.일주.stem);
  if (yin != null && ctx.branches.includes(yin))
    add({ key: 'yangin', step: 3, tone: 'DIRECT', R: 4, F: 3, S: 3,
      label: `양인(${BRANCHES[yin].han})`, gloss: '불굴·생존력 — 칼 쓰는 전문성 프레임', facts: { branch: yin } });

  // D군 — 공망 궁 (스텝③)
  for (const k of ctx.keys) {
    if ((saju.gongmang || []).includes(saju.pillars[k].branch))
      add({ key: `gongmang.${k}`, step: 3, tone: 'SOFT', R: 3, F: 3, S: 3,
        label: `${k} 공망 (${PALACE_DOMAIN[k]})`, gloss: '결실 지연의 자리 — 막힘이 아니라 다른 채움으로 서술', facts: { palace: k, domain: PALACE_DOMAIN[k] } });
  }

  // E군 — 패턴 (스텝④ · 신강약 의존이라 시간 알 때만)
  if (timeKnown) {
    const PSCORE = {
      재다신약: [3, 4, 3, 'DIRECT'], 관살혼잡: [3, 3, 2, 'SOFT'], 상관견관: [3, 3, 3, 'DIRECT'],
      군겁쟁재: [3, 3, 3, 'SOFT'], 관인상생: [3, 3, 5, 'DIRECT'], 살인상생: [3, 3, 4, 'DIRECT'], 식상생재: [3, 3, 5, 'DIRECT'],
    };
    for (const p of saju.patterns || []) {
      if (p.key === '간여지동') continue; // 위에서 처리(시간 무관)
      const sc = PSCORE[p.key];
      if (sc) add({ key: `pattern.${p.key}`, step: 4, tone: sc[3], R: sc[0], F: sc[1], S: sc[2],
        label: p.key, gloss: p.gloss, facts: {} });
    }
  }

  // E군 — 시간축 (스텝⑤ · 대운은 시(時) 무관이라 시간미상에도 유효)
  if (nowYear && saju.input?.y && Array.isArray(saju.daeun) && saju.daeun.length) {
    const ageKr = nowYear - saju.input.y + 1; // 세는나이 근사(±1 관용)
    const turning = saju.daeun.find((d) => Math.abs(ageKr - d.age) <= 1);
    if (turning)
      add({ key: 'gyoungi', step: 5, tone: 'DIRECT', R: 2, F: 5, S: 4,
        label: `${turning.age}세 교운기(지금)`, gloss: '대운이 갈리는 시기 — 전환의 서사, 단정 아닌 확인', facts: { age: turning.age } });
    const cur = saju.daeun.find((d) => ageKr >= d.age && ageKr < d.age + 10)
      || (ageKr < saju.daeun[0].age ? { ...saju.daeun[0], upcoming: true } : null);
    if (cur) {
      for (let i = 0; i < ctx.branches.length; i++) {
        for (const rel of branchRelations(cur.branch, ctx.branches[i])) {
          if (rel.type === '충' || rel.type === '원진')
            add({ key: `daeun_${rel.type}.${ctx.keys[i]}`, step: 5, tone: 'SOFT', R: 4, F: 5, S: 3,
              label: `현 대운 ${STEMS[cur.stem].han}${BRANCHES[cur.branch].han} ↔ ${ctx.keys[i]} ${rel.type}`,
              gloss: '운이 원국을 건드리는 시기 — EVENT 질문형 전용', facts: { palace: ctx.keys[i], type: rel.type, upcoming: !!cur.upcoming } });
          else if (rel.type === '육합' || rel.type.startsWith('반합') || rel.type === '방합')
            add({ key: `daeun_hap.${ctx.keys[i]}`, step: 5, tone: 'DIRECT', R: 3, F: 4, S: 4,
              label: `현 대운 ${STEMS[cur.stem].han}${BRANCHES[cur.branch].han} ↔ ${ctx.keys[i]} ${rel.type}`,
              gloss: '운이 원국과 결속하는 시기 — 기회 프레임', facts: { palace: ctx.keys[i], type: rel.type, upcoming: !!cur.upcoming } });
        }
      }
    }
  }

  return out;
}

/**
 * 정곡 선별 — saju: buildSaju 반환, opts: { timeKnown=true, nowYear=null }
 * 반환: { ranked, byStep, main, fallback, context }
 *  - ranked: 임팩트 내림차순 후보 전부(계산이 참인 것만)
 *  - main: 스텝당 대표 1발 (설계 §3 '스텝당 1발 원칙')
 *  - fallback: 정곡이 빈약(중화·균형)해 골격 투어로 가야 하는지
 *  - context: 본식(신강약·용신) — 시간미상이면 조후·격국만(설계 §8)
 */
export function selectJeonggok(saju, { timeKnown = true, nowYear = null } = {}) {
  const ctx = buildCtx(saju, timeKnown);
  const ranked = collect(saju, ctx, { timeKnown, nowYear }).sort((a, b) => b.impact - a.impact);

  const byStep = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const c of ranked) byStep[c.step].push(c);
  const main = {};
  for (const s of [1, 2, 3, 4, 5]) if (byStep[s].length) main[s] = byStep[s][0];

  const fallback = ranked.length < 3 || (ranked[0]?.impact ?? 0) < 3.3;

  const context = timeKnown
    ? { strength: saju.strength, score: saju.score, yongsin: saju.yongsin, counts: ctx.counts, groups: ctx.groups }
    : { yongsin: { johu: saju.yongsin?.johu ?? null, gyeokguk: saju.yongsin?.gyeokguk ?? null }, // 월지 기반 = 시 무관
        counts: ctx.counts, groups: ctx.groups, held: ['신강약', '억부용신', '시주 십신'] };       // 정직 보류 목록

  return { ranked, byStep, main, fallback, context };
}
