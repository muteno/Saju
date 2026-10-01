// Display policy for the unreviewed day-pillar draft lists only. Stored drafts remain intact.

// Draft items addressed to one gender start with its label; the other gender's items are not this person's reading
// (a woman read ‘남명: 아내가 …’). Items for both (‘남녀 모두 …’) and a gender named mid-sentence stay.
const OTHER_GENDER_ITEM: Record<string, RegExp> = { F: /^\s*(?:남명|남자|남성)\s*[:：]/u, M: /^\s*(?:여명|여자|여성)\s*[:：]/u }
export function forEnteredGender(items: string[] | undefined, gender: unknown): string[] {
  const other = typeof gender === 'string' ? OTHER_GENDER_ITEM[gender] : undefined
  return (items ?? []).filter(item => !other?.test(item))
}
