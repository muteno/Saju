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
// createConsult(saju, {timeKnown, nowYear}) → { next(), answer(), trust, fallback, context }
// next(): {kind:'step'|'say'|'confirm'|'end', ...} | null(확인 대기 중) | undefined(종료 후)
export function createConsult(saju, opts = {}) {
  const sel = selectJeonggok(saju, opts);
  const timeKnown = opts.timeKnown !== false;

  // 고리 컴파일: 스텝 1→5, 스텝당 대표 1 + (확인 예산 내) 보강
  const queue = [];
  const day = STEMS[saju.pillars.일주.stem];
  const arch = CHEONGAN_ARCHETYPE[day.han];
  queue.push({ kind: 'say', text: `${day.han}(${day.kor}) 일간 — 판은 다 세워뒀어. 위에서부터 하나씩 짚을게.` });
  if (arch) queue.push({ kind: 'say', text: `${day.han}은 ${arch.물상}의 결이야 — ${arch.성정서사[0]}. 이게 이 판의 중심 기질이라고 볼 수 있어.` });

  let asksLeft = 3; // 템포: 확인 버튼 총예산(§7)
  let firstAsked = false;
  const stepsUsed = [1, 2, 3, 4, 5].filter((s) => sel.main[s]);
  stepsUsed.forEach((s, idx) => {
    const c = sel.main[s];
    queue.push({ kind: 'step', step: s, title: STEP_TITLES[s] });
    queue.push({ kind: 'say', text: hookText(c), tone: c.tone, big: c.impact >= 3.6 });
    queue.push({ kind: 'say', text: developText(c), tone: c.tone });
    const isEvent = c.key === 'gyoungi' || c.key.startsWith('daeun_');
    const ask = asksLeft > 0 && (!firstAsked || isEvent || c.impact >= 3.6);
    if (ask) {
      asksLeft--; firstAsked = true;
      const options = isEvent ? answerSheetOf(c) : null; // EVENT = 답변지(계산된 보기), 그 외 = 3버튼
      queue.push({ kind: 'confirm', prompt: confirmPrompt(c), ring: c, backup: sel.byStep[s][1] || null, options });
    }
    if (idx === stepsUsed.length - 1) queue.push({ kind: 'sep' });
  });

  // 엔딩 3종(§6-0: 처방 + 시기 + 격려) — 시간미상은 보류 정직 안내 포함
  const ctx = sel.context;
  let prescription;
  if (timeKnown && ctx.yongsin?.eokbu) prescription = `균형 처방은 ${ctx.yongsin.eokbu} — 이 기운을 살리는 선택(일·환경·습관)이 판을 고르게 해.`;
  else if (ctx.yongsin?.johu) prescription = `계절 처방은 ${ctx.yongsin.johu} — 태어난 계절의 치우침을 덜어 주는 기운이야.`;
  else prescription = `이 판은 균형이 좋은 편이야 — 특정 처방보다 지금 결을 지키는 게 처방이야.`;
  const timing = sel.main[5] ? `시간축에선 「${sel.main[5].label}」 — 이 구간을 기억해 둬.` : `큰 전환 신호는 지금 구간엔 뚜렷하지 않아 — 흐름은 완만해.`;
  const heldNote = !timeKnown ? `그리고 정직하게 — 태어난 시(時)를 몰라서 ${ctx.held.join('·')}은 보류했어. 시를 알게 되면 그때 마저 볼게.` : null;

  queue.push({ kind: 'end', ending: { prescription, timing, held: heldNote, cheer: `정해진 건 없어 — 계산은 지도고, 길을 고르는 건 언제나 너야.` } });

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
        queue.unshift({ kind: 'say', text: `그래 — ${choice}. ${ring.facts?.palace ? `${ring.facts.palace}가 맡는 자리 일이 그렇게 온 거야.` : `그 흐름이 이 시기의 결이야.`}` });
        if (backup) queue.unshift({ kind: 'say', text: `이어서 보면 — ${backup.label}도 같은 결로 붙어 있어.`, tone: backup.tone });
      } else if (choice === '맞아') {
        api.trust += 2;
        if (backup) queue.unshift({ kind: 'say', text: `역시. 조금 더 파면 — ${backup.label}도 같은 결로 붙어 있어.`, tone: backup.tone });
      } else if (choice === '아니야' || choice === '그런 일 없었어') {
        api.trust -= 1;
        const lines = [{ kind: 'say', text: RECAL }];
        if (backup) lines.push({ kind: 'say', text: `대신 이건 계산에 분명히 있어 — ${backup.label}. 이쪽 결일 수 있어.`, tone: backup.tone });
        queue.unshift(...lines);
      }
      // '글쎄' 및 그 외 = 그대로 진행(soften)
    },
  };
  return api;
}
