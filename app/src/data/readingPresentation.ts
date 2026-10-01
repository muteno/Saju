// Display policy only. Stored references and interpretation conditions remain intact.
export function displayReadingText(text: string): string {
  return text.replace('일주론 글모음의 갑인일주 본문 9–10문단은 남자·여자와 식상 유무를 나눠 직업을 설명해요.',
    '갑인일주의 직업 풀이는 성별과 식상 유무에 따라 갈려요.')
}

/** A legacy citation may share a line with an exception. Use the intact L3 fallback
 * instead of deleting/rewriting that answer and accidentally losing its conditions. */
export function withoutCitationLines(text: string): string {
  if (/(?:출처|근거줄|자료명|참고문헌)(?:\*\*)?\s*[:：]|[▸▶]\s*근거\s*[:：]/u.test(text)) return ''
  return displayReadingText(text).trim()
}
