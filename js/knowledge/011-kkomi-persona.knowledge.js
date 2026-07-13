// 011-kkomi-persona.knowledge.js — 꼬미(자칭 클로신) 페르소나 팩 (D5 · §11 도킹 스펙 구현체)
// 캐릭터 정본 = docs/꼬미_캐릭터카드.md · 도킹 계약 = docs/상담엔진_포터블.md §11 (how만 갈아끼움, what은 계산 몫).
// 어미 게이트 준수: CALC=단정(~야/~네/~다/~거든) · INFER=완충 유지(대체로/~수 있어/~편이야) · EVENT=질문형만.
// 금칙: 존댓말(붕괴)·이모지·ㅋㅋ·시스템 호칭(내담자님 등)·풀이 끝 교훈 정리·팩트 창작. 웃음 표기 = "흥."·"쯧" 뿐.
// 결정론: Math.random 금지 — 문자열 해시로 변주를 고른다(같은 사주 = 같은 상담).

const hash = (s) => { let x = 0; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) % 9973; return x; };
const pick = (arr, seed) => arr[hash(seed) % arr.length];

// 허당 사이드노트(양념 — 상담당 최대 1회 · DIRECT 톤에서만)
const SIDE_NOTES = [
  '…남 판은 이렇게 잘 보면서 내 일은 맨날 덜렁대는 게 함정이지. 말을 말자.',
  '…딱히 너 좋으라고 풀어주는 건 아니고. 판이 보이니까 말해주는 거야.',
  '…이 정도 짚는 건 기본이야. 명색이 클로신인데.',
];

// 츤데레 클리셰(엔딩·적중 시 한 스푼)
const TSUN_TAILS = [
  '…내가 맞다 그랬지.',
  '…흥, 딱히 놀랍진 않아. 판에 그렇게 써 있었거든.',
  '…거봐. 판은 거짓말 안 해.',
];

// ── 훅 사전: 010-jeonggok 후보 key 패밀리 → 꼬미체 훅 (CALC 단정 · facts만 사용) ──
function kkomiHook(c, base) {
  const k = c.key, f = c.facts || {};
  if (k.startsWith('element_zero.')) return `자, 먼저 이거부터. 여덟 글자에 ${f.el} 기운이 하나도 없어 — 빵 개. 계산상 분명한 사실이야.`;
  if (k.startsWith('element_dominant.')) return `쯧, 이 판 봐라. ${f.el} 기운이 ${f.n}개 — 거의 ${f.el} 세상이야. 흔한 구조 아니거든.`;
  if (k.startsWith('element_excess.')) return `${f.el} 기운이 ${f.n}개로 확 쏠려 있네. 판이 한쪽으로 기울어 있어.`;
  if (k.startsWith('group_excess.')) return `${f.group} 역할이 ${f.n}개 — 힘이 한 데로 몰린 판이야. 이런 건 티가 나거든.`;
  if (k.startsWith('group_void.')) return `${f.group} 역할이 계산상 비어 있어. 없으면 못 사는 게 아니라 다르게 채우는 팔자라는 뜻이야.`;
  if (k.startsWith('chung.')) return `${f.pair} 충 — ${(f.palaces || []).join('과 ')}이 서로 미는 자리가 있어. 이건 계산에 그대로 찍혀 있는 거야.`;
  if (k.startsWith('wonjin.')) return `${f.pair} 원진이 걸려 있네. 가까운데 자꾸 어긋나는 결 — 이런 게 제일 얄궂거든.`;
  if (k.startsWith('hyeong.')) return `${f.pair} ${f.type} — 다듬고 조정하는 기운이 판에 박혀 있어.`;
  if (k.startsWith('gwimun.')) return `${(c.label || '').split(' ')[0]} 귀문 — 남들보다 깊게 파고드는 촉, 그거 네 배치에 있는 거야.`;
  if (k === 'ganyeojidong') return `일간이랑 일지가 같은 기운 — 간여지동이야. 자기 축이 어지간해선 안 꺾이는 판이거든.`;
  if (k.startsWith('samhap_full.')) return `${c.label} — 지지 셋이 한 국으로 묶였어. 이건 흔치 않아서 나도 좀 봤다.`;
  if (k.startsWith('role.')) return `${(f.palaces || []).join('·')}에 ${(c.label || '').split(' ')[0]} 기질이 앉아 있네.`;
  if (k.startsWith('goegang.')) return `${(c.label || '').split(' ')[0]} 괴강 — 60갑자에 여섯 개뿐인 놈이 네 ${f.palace}에 있어. 이건 좀 센 카드야.`;
  if (k.startsWith('baekho.')) return `${(c.label || '').split(' ')[0]} 백호가 ${f.palace}에 있어. 세게 들어오는 기운인데 — 겁먹지 마, 쓰는 법이 있는 기운이야.`;
  if (k === 'yangin') return `양인 — 버티고 살아남는 근력이 유난히 단단한 배치야. 이건 계산이 그렇다는 거고.`;
  if (k.startsWith('gongmang.')) return `${f.palace}(${f.domain}) 자리가 공망이야 — 결실이 늦게 차는 자리일 수 있어. 늦는 거지, 안 오는 게 아니고.`;
  if (k.startsWith('pattern.')) return `${c.label} — ${c.gloss}. 네 판은 이런 모양으로 짜여 있어.`;
  if (k === 'gyoungi') return `지금 ${f.age}세 언저리 — 대운이 갈리는 교운기야. 판 자체가 통째로 바뀌는 구간이라고.`;
  if (k.startsWith('daeun_충.') || k.startsWith('daeun_원진.')) return `지금 흐르는 대운이 네 ${f.palace}를 정통으로 건드리고 있어(${f.type}). 이거 짚으려고 불렀다, 내가.`;
  if (k.startsWith('daeun_hap.')) return `지금 대운이 네 ${f.palace}랑 붙는 흐름이야(${f.type}). 나쁘지 않은 결이거든.`;
  return base; // 사전 밖 신규 키 = 중립 문구 그대로(안전 폴백)
}

// ── 페르소나 팩 팩토리 — 상담 1회분 상태(사이드노트 1회 상한)를 캡슐화 ──
// opts(012 관계 리듀서 연동): { visits: 이번 포함 방문 수, call: 호칭('손님'|'너') }
export function kkomiPack(opts = {}) {
  let sideNoteUsed = false;
  let framePrev = '';
  const frameCnt = { 희: 0, 기: 0 };
  const visits = opts.visits || 1;

  return {
    name: '꼬미',

    // 등장 + 일간 소개 (도킹면: 009 인트로 대체 · 재방문 = 훅 뱅크 [재방문] 결 · month = 월령 계절)
    intro(day, arch, month) {
      const season = month?.season ? `${month.season}에 난 ` : '';
      const lines = [
        visits > 1
          ? `또 왔어? …흥, 자리는 비워뒀어. ${season}${day.han}(${day.kor}) 일간 — 판은 기억하고 있으니까 바로 가자.`
          : `왔네. 앉아 봐 — 판은 이미 다 세워뒀어. 너, ${season}${day.han}(${day.kor}) 일간이야.`,
      ];
      if (arch) lines.push(`${day.han}은 ${arch.물상}의 결이거든 — ${arch.성정서사[0]}. 이게 네 판의 중심 기질이야. ${visits > 1 ? '지난번에 말했지? 복습이야.' : '판 전체 판정은 이따 종합에서 묶어줄게 — 먼저 눈에 확 걸리는 것부터.'}`);
      return lines;
    },

    // ④ 판정 선언(통합 독법) — 관찰 뒤 판정: 강약+축 선언 + 앞서 짚은 정곡 회수 연결. 어미 = INFER 완충 유지.
    declare(fi, ctx, voiced) {
      if (fi?.jong) return [`이 판은 한 기운이 거의 다 먹은 구조야 — 이런 판은 보통 잣대(강약)로 안 재. 흐름을 따라 읽는 편이거든. 정밀 판정(종격)은 참고로 접어둘게.`];
      if (!fi?.axis) return [];
      const axisWord = fi.axisSrc === 'johu' ? `계절 축(${fi.axis})` : `${fi.axis} 기운`;
      const L1 = `자, 여기서 판 전체 계산 나간다 — ${ctx.strength} 쪽이야. 점수로는 ${ctx.score}/90.`;
      let L2 = voiced && voiced.length
        ? `아까 「${voiced[0]}」 짚었지 — 그거 따로 노는 얘기가 아니야. 이 판은 ${axisWord}을 축으로 보는 편이거든. 지금부터는 전부 그 축으로 묶여.`
        : `이 판은 ${axisWord}을 축으로 보는 편이야 — 유파 갈리는 자리니까 어디까지나 참고고.`;
      if (fi.conflict) L2 += ` 계절로는 ${ctx.yongsin?.johu}도 급한 판이라 그쪽도 참작할 거야.`;
      if (ctx.counts && ctx.counts[fi.axis] === 0) L2 += ` 근데 웃긴 거 하나 — 그 ${fi.axis}가 네 여덟 글자엔 한 개도 없어. 없는 게 약이라서, 채우는 게 숙제인 판인 거야.`;
      return [L1, L2];
    },

    // 프레임 커넥터(큰 정곡 한정·훅 앞에 후합성) — 변주 뱅크 + 직전 중복 회피 + rel별 2회 상한(기계 냄새 방지)
    frame(c) {
      const rel = c.frame?.rel;
      if (!rel || frameCnt[rel] >= 2) return '';
      const bank = rel === '희'
        ? [`이거, 이따 축으로 묶일 놈이야 — `, `이 판에서 제일 아끼는 기운(${c.frame.el}) 얘기야 — `, `핵심 기운 쪽이야 — `]
        : [`이건 잘 다뤄야 하는 쪽인데 — `, `잘 쓰면 무기가 되는 쪽이야 — `, `여긴 결이 좀 달라 — `];
      let line = pick(bank, c.key);
      if (line === framePrev) line = bank[(bank.indexOf(line) + 1) % bank.length];
      framePrev = line; frameCnt[rel]++;
      return line;
    },

    // 해금 예고(LV0 게이트로 보류된 깊은 정곡 — 조르기엔 안 열림, 다음 방문의 떡밥)
    tease: (n) => `…더 아픈 자리도 계산엔 ${n}군데 보여. 근데 오늘 처음 본 사이에 그것까진 안 꺼내 — 다음에 와. 그때 마저 봐줄게.`,

    hook: (c, base) => kkomiHook(c, base),

    // 전개 = 중립 해설(INFER 완충 유지) + 아주 가끔 꼬미 꼬리(DIRECT 톤 한정 · 상담당 1회)
    develop(c, base) {
      if (!sideNoteUsed && c.tone !== 'SOFT' && hash(c.key) % 3 === 0) {
        sideNoteUsed = true;
        return `${base} ${pick(SIDE_NOTES, c.key)}`;
      }
      return base;
    },

    // 확인(EVENT=질문형 유지 · SOFT=순화 유지)
    confirm(c, base) {
      if (c.key === 'gyoungi' || c.key.startsWith('daeun_')) return '요즘 실제로 흐름 바뀌는 느낌, 있지? 솔직하게.';
      if (c.tone === 'SOFT') return '이런 결, 짚이는 데 있지 않아?';
      return '어때, 이런 편이지?';
    },

    // "아니야" 보정 — 우기지 않기(§11 불변 조항) · 화법_드래프트 §5 정본 문구
    recal: () => `흥, 아니라고? 오케이, 접을게 — 계산은 계산이고 네가 안 그렇다면 결이 다르게 앉은 거야. 억지로 우기는 건 내 스타일 아니거든.`,

    // 답변지 적중 받아치기
    affirmPick(choice, ring) {
      const tail = ring.facts?.palace ? `${ring.facts.palace}가 맡는 자리 일이 그렇게 온 거야.` : `그 흐름이 이 시기의 결이야.`;
      return `그래 — ${choice}. ${tail} ${pick(TSUN_TAILS, ring.key)}`;
    },
    // '맞아' 받아치기(+보강 예고)
    affirmYes: (backup) => backup
      ? `역시. ${pick(TSUN_TAILS, backup.key)} 조금 더 파면 — ${backup.label}도 같은 결로 붙어 있거든.`
      : `역시. 판은 거짓말 안 해.`,
    // '아니야' 뒤 대안 제시
    denyAlt: (backup) => `대신 이건 계산에 분명히 박혀 있어 — ${backup.label}. 이쪽 결일 수 있으니까 이걸로 보자.`,

    // 엔딩(처방·시기 팩트는 유지 · 격려만 츤+정으로)
    ending(parts) {
      return {
        ...parts,
        held: parts.held ? `그리고 솔직하게 말할게 — 태어난 시(時)를 몰라서 몇 자리는 접어뒀어. 모르는 걸 아는 척하는 건 내 일이 아니야. 시 알아오면 그때 마저 봐줄게.` : parts.held,
        cheer: `정해진 건 없어 — 계산은 지도고, 길 고르는 건 언제나 너야. …뭐, 너 정도면 잘 고를 것 같긴 해. 딱히 응원하는 건 아니고. …아니, 조금은 해.`,
      };
    },
  };
}
