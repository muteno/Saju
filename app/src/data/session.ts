/**
 * 입장(로그인 화면 통과) 플래그 — 기기 로컬. 계정 축은 로드맵(미구현·사용자 결정 대기)이라
 * 자격 검증 없이 "명식당에 들어왔다"는 상태만 기억한다(목업 v2 로그인 흐름의 실배선).
 * 프로필 보유자는 플래그 없이도 통과 — 기존 사용자 무파괴. fail-soft(스토리지 불가 = 메모리).
 */
const KEY = 'msd-entered-v1'
let memory = false

export function entered(): boolean {
  try {
    return localStorage.getItem(KEY) === '1' || memory
  } catch {
    return memory
  }
}

export function setEntered() {
  memory = true
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    /* fail-soft */
  }
}

export function clearEntered() {
  memory = false
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* fail-soft */
  }
}
