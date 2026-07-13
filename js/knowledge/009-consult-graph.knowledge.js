// 009-consult-graph.knowledge.js — 상담 고리 컴파일러 + 진행 컨트롤러 (표현층 v1: 중립·가능성 화법)
// 정본 = docs/상담엔진_설계.md §2(고리)·§6-0(목소리)·§7(템포)·§8(시간미상).
// 계약: selectJeonggok(008)의 후보를 고리(훅→전개→[확인]→분기)로 컴파일하고,
//       createConsult()가 이벤트 스트림(say/confirm/step/end)으로 내보낸다. DOM은 유닛 몫.
// 문구 원칙(§5·§6-0): 계산=단정 / 해석=가능성 화법 / 사건=질문형. SOFT(흉계열)=활용·질문 순화.
//       모든 문구는 v1 중립 슬롯 — 후속 페르소나 팩이 이 함수들만 갈아끼우면 된다(도킹면).

import { STEMS } from '../../manse/js/knowledge/001-ganji.knowledge.js';
import { CHEONGAN_ARCHETYPE } from '../../manse/js/knowledge/011-cheongan-archetype.knowledge.js';
import { selectJeonggok } from './010-jeonggok.knowledge.js';

const STEP_TITLES = Object.freeze({
  1: '글자 — 타고난 판', 2: '관계 — 기운이 얽히는 법',
  3: '자리 — 삶의 어디서', 4: '종합 — 판의 성격', 5: '시간 — 언제',
});

// ── 후보 → 훅/전개 문구 (v1 중립 · 가능성 화법 · 페르소나 도킹 슬롯) ──
function hookText(c) {
  const k = c.key;
  if (k.startsWith('element_zero.')) return `여덟 글자에 ${c.facts.el} 기운이 하나도 없어. 이건 계산상 분명한 사실이야.`;
  if (k.startsWith('element_dominant.')) return `${c.facts.el} 기운이 ${c.facts.n}개 — 판을 한 기운이 거의 지배하고 있어. 드문 구조야.`;
  if (k.startsWith('element_excess.')) return `${c.facts.el} 기운이 ${c.facts.n}개로 뚜렷하게 쏠려 있어.`;
  if (k.startsWith('group_excess.')) return `${c.facts.group} 역할이 ${c.facts.n}개 — 한쪽으로 힘이 몰린 판이야.`;
  if (k.startsWith('group_void.')) return `${c.facts.group} 역할이 계산상 비어 있어. 없다는 건 못 쓴다는 게 아니라, 다르게 채운다는 뜻이야.`;
  if (k.startsWith('chung.')) return `${c.facts.pair} 충 — ${c.facts.palaces.join('과 ')}이 서로 미는 자리가 있어.`;
  if (k.startsWith('wonjin.')) return `${c.facts.pair} 원진이 걸려 있어 — 가까운데 자꾸 어긋나는 결이 있을 수 있어.`;
  if (k.startsWith('hyeong.')) return `${c.facts.pair} ${c.facts.type} — 조정하고 다듬는 기운이 판에 들어 있어.`;
  if (k.startsWith('gwimun.')) return `${c.label.split(' ')[0]} 귀문 — 남들보다 깊게 파고드는 예민한 촉이 있는 배치야.`;
  if (k === 'ganyeojidong') return `일간과 일지가 같은 기운 — 간여지동이라는 강한 자기중심 축이야.`;
  if (k.startsWith('samhap_full.')) return `${c.label} — 세 지지가 하나의 국으로 묶였어. 흔치 않은 결집이야.`;
  if (k.startsWith('role.')) return `${c.facts.palaces.join('·')}에 ${c.label.split(' ')[0]} 기질이 앉아 있어.`;
  if (k.startsWith('goegang.')) return `${c.label.split(' ')[0]} 괴강 — 60갑자 중 여섯 개뿐인 드문 조합이 ${c.facts.palace}에 있어.`;
  if (k.startsWith('baekho.')) return `${c.label.split(' ')[0]} 백호가 ${c.facts.palace}에 있어 — 세게 들어오는 기운인데, 쓰는 법이 있는 기운이야.`;
  if (k === 'yangin') return `양인 — 버티고 살아남는 힘이 유난히 단단한 배치야.`;
  if (k.startsWith('gongmang.')) return `${c.facts.palace}(${c.facts.domain})가 공망이야 — 결실이 늦게 차는 자리일 수 있어.`;
  if (k.startsWith('pattern.')) return `${c.label} — ${c.gloss}. 판이 이런 모양으로 짜여 있어.`;
  if (k === 'gyoungi') return `지금 ${c.facts.age}세 언저리 — 대운이 갈리는 교운기야. 판 자체가 바뀌는 시기.`;
  if (k.startsWith('daeun_충.') || k.startsWith('daeun_원진.')) return `지금 흐르는 대운이 네 ${c.facts.palace}를 건드리고 있어(${c.facts.type}).`;
  if (k.startsWith('daeun_hap.')) return `지금 대운이 네 ${c.facts.palace}와 결속하는 흐름이야(${c.facts.type}).`;
  return `${c.label} — 계산에 잡힌 특징이야.`;
}

function developText(c) {
  const k = c.key;
  if (k.startsWith('element_zero.')) return `빈 기운은 약점이 아니라 방향이야 — 그 기운이 맡는 일을 밖에서 빌려 오는 식으로 사는 경우가 많아. 이 자리는 뒤에서 처방으로 다시 돌아올게.`;
  if (k.startsWith('element_dominant.') || k.startsWith('element_excess.')) return `쏠림은 재능이자 과제야 — 그 기운 쪽 일에선 강하고, 반대편 일에선 힘이 덜 실릴 수 있어.`;
  if (k.startsWith('group_excess.')) return `이 역할이 삶에서 자주 앞으로 나온다는 뜻이야 — 잘 쓰면 전문성, 넘치면 피로가 되는 축.`;
  if (k.startsWith('group_void.')) return `이 역할은 애써 만드는 것보다, 그걸 가진 사람·환경과 붙는 쪽이 자연스러울 수 있어.`;
  if (k.startsWith('chung.')) return `충은 나쁜 게 아니라 움직임이야 — 이동·변화가 이 축을 타고 들어오는 편이야. 언제 움직이는지는 시간 단계에서 볼게.`;
  if (k.startsWith('wonjin.')) return `붙어 있을 때 애틋하고, 그래서 더 신경이 쓰이는 관계 결이야 — 거리 조절이 열쇠라고 봐.`;
  if (k.startsWith('hyeong.')) return `형은 다듬는 힘이야 — 사람·일을 조정하는 직업적 재능으로 쓰일 때 가장 빛나.`;
  if (k.startsWith('gwimun.')) return `몰입과 직관의 자원이야 — 예민함이 깊이가 되는 배치. 다만 혼자 오래 파고들 땐 환기가 필요해.`;
  if (k === 'ganyeojidong') return `내 기운이 내 자리에 그대로 앉은 모양 — 주관이 뚜렷하고, 스스로 일으키는 힘이 커.`;
  if (k.startsWith('samhap_full.')) return `이 국의 기운이 사회적으로 크게 발현되는 편이야 — 판의 주제색이라고 봐도 돼.`;
  if (k.startsWith('role.')) return c.gloss + ' — 이 기질이 어느 삶 영역에 앉았는지가 포인트야.';
  if (k.startsWith('goegang.')) return `주체성과 결단이 센 결로 읽혀 — 한번 정하면 밀고 가는 힘. 그만큼 꺾이는 걸 싫어하는 면도 같이 와.`;
  if (k.startsWith('baekho.')) return `강렬한 기운은 방향만 잡으면 전문성이 돼 — 책임지는 자리, 다루는 직업에서 오히려 빛나는 배치야.`;
  if (k === 'yangin') return `위기에서 버티는 근력이 남달라 — 전문 기술로 벼리면 무기가 되는 기운이야.`;
  if (k.startsWith('gongmang.')) return `이 자리는 채움이 늦을 뿐 안 오는 게 아니야 — 다른 자리가 먼저 차오르는 판이라고 읽는 게 맞아.`;
  if (k.startsWith('pattern.')) return `이건 글자 하나가 아니라 판 전체의 짜임이야 — 종합 판정의 뼈대가 되는 부분.`;
  if (k === 'gyoungi') return `교운기엔 환경·사람·일이 같이 재편되는 경우가 많아 — 흔들림이 아니라 갈아타는 구간이야.`;
  if (k.startsWith('daeun_충.') || k.startsWith('daeun_원진.')) return `이런 구간엔 그 자리 일이 표면으로 올라오는 편이야 — 미리 알면 대비가 되는 종류의 흐름이야.`;
  if (k.startsWith('daeun_hap.')) return `이 구간엔 그 자리 일이 잘 붙는 편이야 — 기회 프레임으로 써도 좋아.`;
  return c.gloss || '이 특징이 판에서 어떻게 쓰이는지는 다음 단계와 이어져.';
}

// 확인 프롬프트(EVENT=질문형 · 그 외=성향 확인) — 답변지(보기) 미구현 v1은 3버튼 고정
function confirmPrompt(c) {
  if (c.key === 'gyoungi' || c.key.startsWith('daeun_')) return '요즘 실제로 흐름이 바뀌는 느낌, 있지 않아?';
  if (c.tone === 'SOFT') return '이런 결, 짚이는 데가 있어?';
  return '이런 편이야?';
}

const RECAL = `오케이, 그건 접을게 — 팔자에 있어도 겉으로 안 드러나는 자리가 있어. 억지로 맞다고 안 해.`;

// ── 판정 선언(통합 독법 · 260713 재설계) — ④종합 직전에 강약+축을 선언하고, 앞서 나온 정곡을 축에 묶는다.
// 어미 계약: 강약·용신 = INFER(완충 필수 "~쪽/~편이야"), 점수 = 계산 보고. 시간미상 = 호출 자체가 게이트됨(보류 정직).
function declareNeutral(fi, ctx, voiced) {
  if (!fi) return [];
  if (fi.jong) return [`이 판은 한 기운이 거의 지배하는 구조야 — 이런 판은 보통 잣대(강약)로 재지 않고 흐름을 따라 읽는 편이야. 정밀 판정(종격)은 참고로 보류할게.`];
  if (!fi.axis) return []; // 축 부재(중화+조후 없음) = 선언 스킵(감사 평결)
  const L1 = `여기서 판 전체 계산 — ${ctx.strength} 쪽으로 나와, 점수로는 ${ctx.score}/90.`;
  const axisWord = fi.axisSrc === 'johu' ? `계절 축(${fi.axis})` : `${fi.axis} 기운`;
  let L2 = voiced && voiced.length
    ? `아까 짚은 「${voiced[0]}」 — 따로 노는 얘기가 아니야. 이 판은 ${axisWord}을 축으로 보는 편이고, 지금부터는 그 축으로 묶여.`
    : `이 판은 ${axisWord}을 축으로 보는 편이야 — 유파 따라 갈리는 자리라 참고로.`;
  if (fi.conflict) L2 += ` 계절로는 ${ctx.yongsin?.johu}도 급한 판이라 그쪽은 참작하고.`;
  // 세로 고리의 백미: 축 오행이 원국에 0개 = "약이 비어 있는 판"(계산 사실) → 처방(보충)으로 이어지는 다리
  if (ctx.counts && ctx.counts[fi.axis] === 0) L2 += ` 그리고 이 축(${fi.axis})이 여덟 글자에 하나도 없어 — 그래서 밖에서 채우는 쪽이 처방이 되는 판이야.`;
  return [L1, L2];
}

// 답변지(설계 §4): EVENT 정곡이 꽂힌 순간, 계산된 삶-장면 보기를 버튼으로.
// 보기 근거 = 궁위론(007 GUNGWI domain)의 관장 영역 — 궁이 특정되면 그 궁의 장면을 앞세운다.
const PALACE_OPTIONS = Object.freeze({
  일주: ['관계·거처의 변화', '나 자신의 큰 결심'],
  월주: ['일·직장의 변화', '가까운 사람(부모·형제) 일'],
  년주: ['집안·환경의 변화', '기반이 흔들리는 일'],
  시주: ['자식·아랫사람 일', '장기 계획의 변경'],
});
const GENERIC_OPTIONS = Object.freeze(['일·소속의 변화', '관계·거처의 변화', '마음의 방향 전환']);

function answerSheetOf(c) {
  if (c.key === 'gyoungi') return [...GENERIC_OPTIONS];
  if (c.key.startsWith('daeun_') && c.facts.palace && PALACE_OPTIONS[c.facts.palace]) {
    const primary = PALACE_OPTIONS[c.facts.palace];
    const filler = GENERIC_OPTIONS.find((o) => !primary.includes(o));
    return [...primary, filler].filter(Boolean).slice(0, 3);
  }
  return null; // 답변지 미적용 → 3버튼(맞아/글쎄/아니야)
}

// ── 컨설트 컨트롤러 ──
// createConsult(saju, {timeKnown, nowYear, persona}) → { next(), answer(), trust, fallback, context }
// next(): {kind:'step'|'say'|'confirm'|'end', ...} | null(확인 대기 중) | undefined(종료 후)
// persona(선택) = §11 페르소나 팩(011-kkomi-persona 등). 문구(how)만 갈아끼우고
// 선별·랭킹·게이팅·3단 어조·prune 로직(what)은 불변 — 미지정 시 v1 중립 문구 그대로.
export function createConsult(saju, opts = {}) {
  const sel = selectJeonggok(saju, opts);
  const timeKnown = opts.timeKnown !== false;
  const P = opts.persona || null;
  const t = { // 문구 라우터: 페르소나 슬롯 → 없으면 중립(v1)
    hook: (c) => (P?.hook ? P.hook(c, hookText(c)) : hookText(c)),
    develop: (c) => (P?.develop ? P.develop(c, developText(c)) : developText(c)),
    confirm: (c) => (P?.confirm ? P.confirm(c, confirmPrompt(c)) : confirmPrompt(c)),
    recal: () => (P?.recal ? P.recal(RECAL) : RECAL),
    tease: (n) => (P?.tease ? P.tease(n) : `더 깊은 결도 계산엔 ${n}자리 있어 — 오늘은 여기까지 보고, 다음에 이어볼게.`),
    // 프레임 커넥터(훅 출력에 후합성 — 페르소나 훅 사전이 base를 재작성해도 유실 없음 · 감사2-b)
    frame: (c) => (P?.frame ? P.frame(c) : (c.frame?.rel === '희' ? `이 판의 축 기운(${c.frame.el}) 쪽 얘기야 — ` : `이건 잘 다뤄야 하는 쪽인데 — `)),
    declare: (fi, ctx2, voiced) => (P?.declare ? P.declare(fi, ctx2, voiced) : declareNeutral(fi, ctx2, voiced)),
  };
  // 해금 게이트(012 관계 리듀서 연동 · 가산형): relLV 미지정 = 게이트 없음(기존 그대로).
  // LV0(첫 만남) = 아픈 깊은 정곡(SOFT·impact≥3.6)을 표면 후보로 대체하고 예고만 남긴다(포터블 ①§5-b·c).
  const relLV = Number.isInteger(opts.relLV) ? opts.relLV : null;
  let heldDeep = 0;

  // 고리 컴파일: 스텝 1→5, 스텝당 대표 1 + (확인 예산 내) 보강
  const queue = [];
  const day = STEMS[saju.pillars.일주.stem];
  const arch = CHEONGAN_ARCHETYPE[day.han];
  const month = sel.context.frameInfo?.month || null;
  const introLines = P?.intro ? P.intro(day, arch, month) : [
    `${day.han}(${day.kor}) 일간${month?.season ? ` · ${month.season}에 난 판` : ''} — 다 세워뒀어. 눈에 걸리는 것부터 하나씩 짚을게.`,
    arch ? `${day.han}은 ${arch.물상}의 결이야 — ${arch.성정서사[0]}. 이게 이 판의 중심 기질이라고 볼 수 있어.` : null,
  ];
  introLines.filter(Boolean).forEach((text) => queue.push({ kind: 'say', text }));

  let asksLeft = 3; // 템포: 확인 버튼 총예산(§7)
  let firstAsked = false;
  const stepsUsed = [1, 2, 3, 4, 5].filter((s) => sel.main[s]);
  // 판정 선언 위치: ④(종합)가 정위치, 없으면 ⑤(시간) 직전 — 관찰(①~③ 특이점 훅) 뒤에 판정(정통 간명 순서 + 화술 '특이점 선행' 동시 충족)
  const fi = sel.context.frameInfo;
  const declareAt = timeKnown ? (stepsUsed.includes(4) ? 4 : (stepsUsed.includes(5) ? 5 : null)) : null;
  let declared = false;
  const voicedAxis = []; // ①~③에서 발화된 축(희) 정곡 라벨 — 선언이 회수 연결
  const emitDeclare = () => {
    t.declare(fi, sel.context, voicedAxis).filter(Boolean).forEach((text) => queue.push({ kind: 'say', text }));
    declared = true;
  };

  stepsUsed.forEach((s, idx) => {
    let c = sel.main[s];
    if (relLV === 0 && c.tone === 'SOFT' && c.impact >= 3.6) {
      const alt = (sel.byStep[s] || []).find((x) => x !== c && !(x.tone === 'SOFT' && x.impact >= 3.6));
      if (alt) { heldDeep++; c = alt; } // 대체 후보가 있을 때만 보류(빈 스텝 방지)
    }
    if (s === declareAt) emitDeclare(); // 해당 스텝 제목 앞에서 판정 선언
    queue.push({ kind: 'step', step: s, title: STEP_TITLES[s] });
    // 커넥터 = 큰 정곡(≥3.6)·비SOFT·프레임 有 에만(반복 기계 냄새·흉계열 불안 조장 방지 — 감사3-b·d)
    const conn = c.frame && c.tone !== 'SOFT' && c.impact >= 3.6 ? t.frame(c) : '';
    if (c.frame?.rel === '희' && !declared) voicedAxis.push(c.label);
    queue.push({ kind: 'say', text: conn + t.hook(c), tone: c.tone, big: c.impact >= 3.6 });
    queue.push({ kind: 'say', text: t.develop(c), tone: c.tone });
    const isEvent = c.key === 'gyoungi' || c.key.startsWith('daeun_');
    const ask = asksLeft > 0 && (!firstAsked || isEvent || c.impact >= 3.6);
    if (ask) {
      asksLeft--; firstAsked = true;
      const options = isEvent ? answerSheetOf(c) : null; // EVENT = 답변지(계산된 보기), 그 외 = 3버튼
      const backup = (sel.byStep[s] || []).find((x) => x !== c) || null; // 게이트 대체 시 자기 자신 중복 방지
      queue.push({ kind: 'confirm', prompt: t.confirm(c), ring: c, backup, options });
    }
    if (idx === stepsUsed.length - 1) queue.push({ kind: 'sep' });
  });
  if (timeKnown && !declared && declareAt === null) emitDeclare(); // ④·⑤ 둘 다 없던 판 — 마무리 직전 폴백
  if (heldDeep > 0) queue.push({ kind: 'say', text: t.tease(heldDeep) }); // 해금 예고(마무리 직전)

  // 엔딩 3종(§6-0: 처방 + 시기 + 격려) — 시간미상은 보류 정직 안내 포함
  const ctx = sel.context;
  let prescription;
  if (timeKnown && ctx.yongsin?.eokbu) prescription = `균형 처방은 ${ctx.yongsin.eokbu} — 이 기운을 살리는 선택(일·환경·습관)이 판을 고르게 하는 쪽이야.`;
  else if (ctx.yongsin?.johu) prescription = `계절 처방은 ${ctx.yongsin.johu} — 태어난 계절의 치우침을 덜어 주는 쪽으로 봐.`;
  else prescription = `이 판은 균형이 좋은 편이야 — 특정 처방보다 지금 결을 지키는 게 처방이야.`;
  const timing = sel.main[5] ? `시간축에선 「${sel.main[5].label}」 — 이 구간을 기억해 둬.` : `큰 전환 신호는 지금 구간엔 뚜렷하지 않아 — 흐름은 완만해.`;
  const heldNote = !timeKnown ? `그리고 정직하게 — 태어난 시(時)를 몰라서 ${ctx.held.join('·')}은 보류했어. 시를 알게 되면 그때 마저 볼게.` : null;

  const endingParts = { prescription, timing, held: heldNote, cheer: `정해진 건 없어 — 계산은 지도고, 길을 고르는 건 언제나 너야.` };
  queue.push({ kind: 'end', ending: P?.ending ? P.ending(endingParts) : endingParts });

  // ── 진행 상태 ──
  let pending = null; // 확인 대기 중인 confirm 이벤트
  const api = {
    trust: 0,
    fallback: sel.fallback,
    context: ctx,
    next() {
      if (pending) return null;            // 답변 대기
      const ev = queue.shift();
      if (ev && ev.kind === 'confirm') pending = ev;
      return ev;
    },
    answer(choice) {                        // 답변지 보기 | '맞아' | '글쎄' | '아니야'
      if (!pending) return;
      const { ring, backup, options } = pending;
      pending = null;
      if (options && options.includes(choice)) {   // 답변지 적중 — 고른 장면을 받아쳐 파고들기(§4)
        api.trust += 2;
        const pickLine = P?.affirmPick ? P.affirmPick(choice, ring)
          : `그래 — ${choice}. ${ring.facts?.palace ? `${ring.facts.palace}가 맡는 자리 일이 그렇게 온 거야.` : `그 흐름이 이 시기의 결이야.`}`;
        queue.unshift({ kind: 'say', text: pickLine });
        if (backup) queue.unshift({ kind: 'say', text: `이어서 보면 — ${backup.label}도 같은 결로 붙어 있어.`, tone: backup.tone });
      } else if (choice === '맞아') {
        api.trust += 2;
        if (backup) queue.unshift({ kind: 'say', text: P?.affirmYes ? P.affirmYes(backup) : `역시. 조금 더 파면 — ${backup.label}도 같은 결로 붙어 있어.`, tone: backup.tone });
        else if (P?.affirmYes) queue.unshift({ kind: 'say', text: P.affirmYes(null) });
      } else if (choice === '아니야' || choice === '그런 일 없었어') {
        api.trust -= 1;
        const lines = [{ kind: 'say', text: t.recal() }];
        if (backup) lines.push({ kind: 'say', text: P?.denyAlt ? P.denyAlt(backup) : `대신 이건 계산에 분명히 있어 — ${backup.label}. 이쪽 결일 수 있어.`, tone: backup.tone });
        queue.unshift(...lines);
      }
      // '글쎄' 및 그 외 = 그대로 진행(soften)
    },
  };
  return api;
}
