// Display policy only. Stored references and interpretation conditions remain intact.
export function displayReadingText(text: string): string {
  return text.replace('일주론 글모음의 갑인일주 본문 9–10문단은 남자·여자와 식상 유무를 나눠 직업을 설명해요.',
    '갑인일주의 직업 풀이는 성별과 식상 유무에 따라 갈려요.')
}

// Unreviewed day-pillar draft items addressed to one gender start with its label; the other gender's items are not
// this person's reading (a woman read ‘남명: 아내가 …’). Items for both (‘남녀 모두 …’) stay.
const OTHER_GENDER_ITEM: Record<string, RegExp> = { F: /^\s*(?:남명|남자|남성)\s*[:：]/u, M: /^\s*(?:여명|여자|여성)\s*[:：]/u }
export function forEnteredGender(items: string[] | undefined, gender: unknown): string[] {
  const other = typeof gender === 'string' ? OTHER_GENDER_ITEM[gender] : undefined
  return (items ?? []).filter(item => !other?.test(item))
}

/** A legacy citation may share a line with an exception. Use the intact L3 fallback
 * instead of deleting/rewriting that answer and accidentally losing its conditions. */
export function withoutCitationLines(text: string): string {
  if (/(?:출처|근거줄|자료명|참고문헌)(?:\*\*)?\s*[:：]|[▸▶]\s*근거\s*[:：]/u.test(text)) return ''
  return displayReadingText(text).trim()
}
