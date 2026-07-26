/**
 * 상담(연리) 응답 모델 선택 — 로컬 단일 출처(D3-1 설계: 서버 동기화가 생기면 이 모듈 안에서만 fetch로 바꾼다).
 * 운영자 260726: "오퍼스5.0 빠름하고 소넷5 빠름 둘 다 붙일 수 있고 설정에서 변경할 수 있게".
 *
 * ⚠ API 실측(claude-api 정본 260726): `speed:"fast"`(빠름 모드)는 **Opus 5/4.8 전용 연구 프리뷰**라
 * 소넷5엔 빠름 스위치 자체가 없다 — 소넷5는 표준 호출이 곧 빠른 축(그래서 라벨을 '빠른 응답'으로 정직 표기).
 * 서버 화이트리스트(functions/api/dosa.ts MODELS)와 키를 동기할 것.
 */
export type DosaModelKey = 'sonnet' | 'opus-fast'

export const DOSA_MODELS: { key: DosaModelKey; label: string; desc: string }[] = [
  { key: 'sonnet', label: '소넷 5', desc: '빠른 응답 · 기본 — 상담 속도 우선' },
  { key: 'opus-fast', label: '오퍼스 5 빠름', desc: '더 깊은 풀이를 빠름 모드로' },
]

const KEY = 'msd-dosa-model-v1'

export function dosaModel(): DosaModelKey {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'sonnet' || v === 'opus-fast') return v
  } catch {
    /* 프라이빗 모드 등 — 기본값 */
  }
  return 'sonnet'
}

export function setDosaModel(k: DosaModelKey): void {
  try {
    localStorage.setItem(KEY, k)
  } catch {
    /* 저장 불가 = 세션 한정 기본값 */
  }
}
