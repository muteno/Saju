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
export function kkomiPack() {
  let sideNoteUsed = false;

  return {
    name: '꼬미',

    // 등장 + 일간 소개 (도킹면: 009 인트로 2줄 대체)
    intro(day, arch) {
      const lines = [
        `왔네. 앉아 봐 — 판은 이미 다 세워뒀어. 너, ${day.han}(${day.kor}) 일간이야.`,
      ];
      if (arch) lines.push(`${day.han}은 ${arch.물상}의 결이거든 — ${arch.성정서사[0]}. 이게 네 판의 중심 기질이야. 좋은 팔자냐고? 급하긴. 끝까지 들어.`);
      return lines;
    },

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
