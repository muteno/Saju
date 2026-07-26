/**
 * 분석 화면 주제 재편(260726 운영자 지시) — 카드 축을 술사의 도구축(일주·십신·합충·신살…)에서
 * 독자의 관심축(성향·관계·일·주의·올해)으로 **재배치**한다.
 *
 * 원칙:
 * - 원문·출처·인용은 그대로 옮기기만 한다(문장 생성·요약 금지 — 근거 병기 신뢰축).
 * - 매핑 안 되는 카드는 '그 밖의 근거'로 모은다(정보 소실 0 — 여기 없는 신종 id도 etc 폴백).
 * - 주제가 섞인 카드는 일주 카드 하나뿐이라(핵심·성격·일과 재능·관계·주의 블록 혼재)
 *   그 카드만 블록 단위로 쪼개고, 나머지는 카드 통째로 배치한다.
 */
import type { Reading, ReadingCard, CardBlock } from './saju'

export interface TopicGroup {
  id: string
  title: string
  cards: ReadingCard[]
}

/** 주제 순서 — 나(성향) → 남(관계) → 일 → 주의 → 시간(올해) → 나머지 */
const GROUP_ORDER: { id: string; title: string }[] = [
  { id: 'temper', title: '성향과 기질' },
  { id: 'rel', title: '관계와 인연' },
  { id: 'work', title: '일과 재능' },
  { id: 'caution', title: '조심할 점' },
  { id: 'flow', title: '올해의 흐름' },
  { id: 'etc', title: '그 밖의 근거' },
]

/**
 * 카드 id → 주제(통째 배치).
 * - judge(신강신약·조후) = 내 에너지 구조 → 성향의 바탕
 * - sipsin(십신 세력) = 욕구·성향 유형론 → 성향 / ennea = 성향 보조 렌즈
 * - hapchung(끌리고 부딪히는 작용) → 관계 / unse → 올해
 * - sinsal(주제가 별마다 제각각)·hour-unknown(안내) → 그 밖의 근거
 */
const CARD_HOME: Record<string, string> = {
  judge: 'temper',
  sipsin: 'temper',
  ennea: 'temper',
  hapchung: 'rel',
  unse: 'flow',
  sinsal: 'etc',
  'hour-unknown': 'etc',
}

/** 일주 카드 블록 라벨 → 주제. 관점 차이 블록은 주제어로 배분, 모르면 성향(일주의 본진)에 둔다. */
const routeIljuBlock = (label?: string): string => {
  if (!label) return 'temper'
  if (label === '관계') return 'rel'
  if (label === '일과 재능') return 'work'
  if (label === '주의') return 'caution'
  if (label.startsWith('관점 차이')) {
    if (/관계|배우자|연애|궁합|부부|이성/.test(label)) return 'rel'
    if (/직업|재능|재물|사업|돈/.test(label)) return 'work'
    if (/주의|건강/.test(label)) return 'caution'
  }
  return 'temper' // 핵심·성격·물상 등
}

/** 일주 카드를 블록 단위로 주제별 조각 카드로 쪼갠다(원본 불변 — 캐시 공유 객체라 복제로만). */
const splitIlju = (card: ReadingCard): { home: string; card: ReadingCard }[] => {
  const src = card.blocks.map((b) => b.source).find(Boolean)
  const buckets = new Map<string, CardBlock[]>()
  for (const b of card.blocks) {
    const home = routeIljuBlock(b.label)
    const arr = buckets.get(home) ?? []
    arr.push({ ...b })
    buckets.set(home, arr)
  }
  return [...buckets.entries()].map(([home, blocks]) => {
    // 출처 계승 — 원 카드는 마지막 블록에만 출처가 달려 있어, 쪼개면 출처 잃는 조각이 생긴다.
    // 같은 출처 문자열을 조각 끝에 그대로 복사한다(새 문구 아님 · 출처 소실 방지).
    if (src && !blocks.some((b) => b.source)) blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], source: src }
    return { home, card: { ...card, id: home === 'temper' ? card.id : `${card.id}-${home}`, blocks } }
  })
}

/** 리딩 → 주제 그룹. 카드 0개인 주제는 만들지 않는다(빈 아코디언 금지). */
export function buildTopicGroups(reading: Reading): TopicGroup[] {
  const byHome = new Map<string, ReadingCard[]>()
  const push = (home: string, card: ReadingCard) => {
    const arr = byHome.get(home) ?? []
    arr.push(card)
    byHome.set(home, arr)
  }
  for (const card of reading.cards) {
    if (card.id === 'ilju') for (const f of splitIlju(card)) push(f.home, f.card)
    else push(CARD_HOME[card.id] ?? 'etc', card)
  }
  return GROUP_ORDER.map((g) => ({ ...g, cards: byHome.get(g.id) ?? [] })).filter((g) => g.cards.length > 0)
}

/** 아코디언 배지용 근거 개수 — 블록(발췌 단위) 합, 블록 없는(칩만 있는) 카드도 1로 센다. */
export const evidenceCount = (g: TopicGroup): number => g.cards.reduce((a, c) => a + Math.max(c.blocks.length, 1), 0)
