import { tokens, type OhaengKey } from '../theme'

/**
 * 60갑자(六十甲子) — 십간(천간)×십이지(지지)의 60조합.
 * 스티커 규칙: 동물 = 지지, 색 = 천간의 오행. 같은 오행에 각 동물이 정확히 1회씩 등장 →
 * 12 동물 × 5 오행 = 60 (파일명 유니크). 색은 반드시 정본 팔레트(theme.ts tokens.ohaeng)만 사용.
 */

// 10 천간 — 오행·음양
const STEMS: { ko: string; ch: string; el: OhaengKey; yin: boolean }[] = [
  { ko: '갑', ch: '甲', el: '목', yin: false },
  { ko: '을', ch: '乙', el: '목', yin: true },
  { ko: '병', ch: '丙', el: '화', yin: false },
  { ko: '정', ch: '丁', el: '화', yin: true },
  { ko: '무', ch: '戊', el: '토', yin: false },
  { ko: '기', ch: '己', el: '토', yin: true },
  { ko: '경', ch: '庚', el: '금', yin: false },
  { ko: '신', ch: '辛', el: '금', yin: true },
  { ko: '임', ch: '壬', el: '수', yin: false },
  { ko: '계', ch: '癸', el: '수', yin: true },
]

// 12 지지 — 동물·계절오행(방합)·대표 소품
const BRANCHES: { ko: string; ch: string; animal: string; en: string; emoji: string; season: OhaengKey; item: string; itemEn: string }[] = [
  { ko: '자', ch: '子', animal: '쥐', en: 'rat', emoji: '🐭', season: '수', item: '빛나는 씨앗', itemEn: 'a glowing seed' },
  { ko: '축', ch: '丑', animal: '소', en: 'ox', emoji: '🐮', season: '토', item: '놋쇠 방울', itemEn: 'a small brass bell' },
  { ko: '인', ch: '寅', animal: '범', en: 'tiger', emoji: '🐯', season: '목', item: '대나무', itemEn: 'a bamboo stalk' },
  { ko: '묘', ch: '卯', animal: '토끼', en: 'rabbit', emoji: '🐰', season: '목', item: '네잎클로버', itemEn: 'a four-leaf clover' },
  { ko: '진', ch: '辰', animal: '용', en: 'dragon', emoji: '🐲', season: '토', item: '여의주', itemEn: 'a glowing wish orb' },
  { ko: '사', ch: '巳', animal: '뱀', en: 'snake', emoji: '🐍', season: '화', item: '반짝임', itemEn: 'sparkles' },
  { ko: '오', ch: '午', animal: '말', en: 'horse', emoji: '🐴', season: '화', item: '리본', itemEn: 'a flowing ribbon' },
  { ko: '미', ch: '未', animal: '양', en: 'goat', emoji: '🐑', season: '토', item: '붓', itemEn: 'a paintbrush' },
  { ko: '신', ch: '申', animal: '원숭이', en: 'monkey', emoji: '🐵', season: '금', item: '복숭아', itemEn: 'a peach' },
  { ko: '유', ch: '酉', animal: '닭', en: 'rooster', emoji: '🐔', season: '금', item: '회중시계', itemEn: 'a pocket watch' },
  { ko: '술', ch: '戌', animal: '개', en: 'dog', emoji: '🐶', season: '토', item: '등불', itemEn: 'a glowing lantern' },
  { ko: '해', ch: '亥', animal: '돼지', en: 'pig', emoji: '🐷', season: '수', item: '복주머니', itemEn: 'a lucky pouch' },
]

const ELEMENT_EN: Record<OhaengKey, string> = { 목: 'wood', 화: 'fire', 토: 'earth', 금: 'metal', 수: 'water' }

export interface Gapja {
  idx: number // 1..60
  ganji: string // '갑자'
  hanja: string // '甲子'
  stem: string
  branch: string
  element: OhaengKey // 천간 오행 = 색 기준
  elementEn: string
  yin: boolean // 음양(천간)
  animal: string
  animalEn: string
  emoji: string
  item: string
  itemEn: string
  img: string // 'rat-wood.png'
}

export const GAPJA: Gapja[] = Array.from({ length: 60 }, (_, i) => {
  const s = STEMS[i % 10]
  const b = BRANCHES[i % 12]
  return {
    idx: i + 1,
    ganji: s.ko + b.ko,
    hanja: s.ch + b.ch,
    stem: s.ko,
    branch: b.ko,
    element: s.el,
    elementEn: ELEMENT_EN[s.el],
    yin: s.yin,
    animal: b.animal,
    animalEn: b.en,
    emoji: b.emoji,
    item: b.item,
    itemEn: b.itemEn,
    img: `${b.en}-${ELEMENT_EN[s.el]}.png`,
  }
})

const BY_GANJI = new Map(GAPJA.map((g) => [g.ganji, g]))
export const gapjaByGanji = (ganji: string): Gapja | undefined => BY_GANJI.get(ganji)
export const gapjaOf = (stemKo: string, branchKo: string): Gapja | undefined => BY_GANJI.get(stemKo + branchKo)

/** 오행 색 = 정본 팔레트(theme.ts). 하드코딩 금지([14]). */
export const elementColor = (el: OhaengKey) => tokens.ohaeng[el]

export const IMAGE_BASE = '/assets/gapja'
export const imgUrl = (g: Gapja) => `${IMAGE_BASE}/${g.img}`

// 파일명 계약: {animalEn}-{elementEn}.png (12×5=60 유니크)
export const ANIMALS_EN = BRANCHES.map((b) => b.en)
export const ELEMENTS_EN = ['wood', 'fire', 'earth', 'metal', 'water'] as const
