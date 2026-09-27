// Application boundary: an unknown birth time is never a noon observation.
// Until all candidates are validated in the browser, withhold personal chart claims.
export const UNKNOWN_BIRTH_TIME_NOTICE = '출생 시간 모름: 시간에 따라 일주가 달라지고 절입일에는 연·월주도 달라질 수 있어요. 출생 시간을 확인하기 전에는 개인 사주 풀이와 오늘의 운세를 보류해요.'

export function hasUnknownBirthTime(value, legacyFlag = false) {
  const input = value?.input ?? value
  return legacyFlag === true || value?.birthTime?.status === 'unknown' ||
    input?.hourUnknown === true || input?.hour === null || input?.minute === null
}

export function unknownBirthTime() {
  return { status: 'unknown', policy: 'withhold-unverified-v1' }
}
