// Display policy for the unreviewed day-pillar draft lists only. Stored drafts remain intact.

// Draft items addressed to one gender start with its label; the other gender's items are not this person's reading
// (a woman read ‘남명: 아내가 …’). Items for both (‘남녀 모두 …’) and a gender named mid-sentence stay.
const OTHER_GENDER_ITEM: Record<string, RegExp> = { F: /^\s*(?:남명|남자|남성)\s*[:：]/u, M: /^\s*(?:여명|여자|여성)\s*[:：]/u }
export function forEnteredGender(items: string[] | undefined, gender: unknown): string[] {
  const other = typeof gender === 'string' ? OTHER_GENDER_ITEM[gender] : undefined
  return (items ?? []).filter(item => !other?.test(item))
}

// 원문96 (ⓐ): a topic with its own chart reading (성격·관계) leaves the same-day-pillar draft out of its chat, where
// it said the opposite of that reading (10/28 in the reading bundle); the analysis card keeps the draft.
export const ILJU_DRAFT_IN_CARD_NOTICE = '같은 일주에 두루 쓰는 문헌 초안은 이 원국 풀이와 섞지 않고 분석 탭의 ‘일주 이야기’ 카드에 따로 두었어요.'
