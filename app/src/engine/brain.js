// ★두뇌 어댑터 — 정제 지도(개념·관계·조견표·판정절차)를 앱 엔진에 물린다.
//
// 왜 있나 (운영자 260727): *"일단 지금 지식을 앱에 탑재해줄래? **앱에 뇌를 달아주셈**"*
//
// 기존 `kb.json`은 «키 → 원문 유닛» 색인이라 **«어느 글을 보여줄까»**만 안다.
// 이 팩은 **«왜 그런가»**를 안다 — 관계·조건·부호·근거·«왜» 판정이 붙어 있다.
//
// ⚠절대원칙(계승): **검색(RAG) 금지 — 계산된 키셋의 결정론 조회.**
//   그래서 이 모듈은 질의를 받지 않는다. `keyset.js`가 만든 키만 받는다.
//
// 생성기 = `2. 정제작업/_현황판/build_brain.py` → `data/앱두뇌.json`
//   ⛔이 파일을 손으로 고치지 마라. 지도를 고치고 다시 내보내라.

let brain = null
let brainPromise = null

async function fetchBrain() {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}brain.json`, { signal: ctrl.signal })
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json'))
      throw new Error(`두뇌 로드 실패: HTTP ${res.status}`) // SPA 폴백 HTML 위장 차단
    const d = await res.json()
    if (!d?.노드 || !d?.관계 || !d?.키매핑) throw new Error('두뇌 스키마 불일치')
    brain = d
    return d
  } finally { clearTimeout(timer) }
}

export function loadBrain() {
  return (brainPromise ??= fetchBrain().catch((e) => { brainPromise = null; throw e }))
}

/** 앱 키(cheongan/갑) → 우리 노드명(갑목(甲)). 못 맞추면 null — 조용히 비우지 않는다. */
export function keyToNode(key) {
  return brain?.키매핑?.[key] ?? null
}

/** 노드 카드 — 정의·계층·근거량. «무슨 뜻인가»가 아니라 «망에서 어떻게 생겨먹었나»의 입구. */
export function nodeCard(node) {
  return brain?.노드?.[node] ?? null
}

// 관계 색인은 첫 호출에 만든다(팩이 3.5MB라 매번 filter 하면 느리다).
let relIndex = null
function ensureRelIndex() {
  if (relIndex || !brain) return relIndex
  relIndex = new Map()
  for (const r of brain.관계) {
    for (const n of [r.a, r.b]) {
      if (!relIndex.has(n)) relIndex.set(n, [])
      relIndex.get(n).push(r)
    }
  }
  return relIndex
}

/**
 * 한 노드에 붙은 관계.
 * @param opts.이유있는것만  true면 «왜»를 댈 수 있는 것만(낭설후보 제외)
 * @param opts.층            'L1결정론' 등으로 좁히기
 *
 * ⚠기본값은 **전부 준다.** 낭설후보를 숨기면 앱이 그걸 근거처럼 쓴다 —
 *   운영자 축자: *"자미원진이 애증관계예요? 왜요? > 몰라요 > (실패)"*
 */
export function relationsOf(node, opts = {}) {
  const idx = ensureRelIndex()
  let rs = idx?.get(node) ?? []
  if (opts.층) rs = rs.filter((r) => String(r.층 || '').startsWith(opts.층))
  if (opts.이유있는것만) rs = rs.filter((r) => r.왜 && r.왜 !== '낭설후보')
  return rs
}

/** 조견표(입력→글자) — 앱이 계산에 바로 쓰는 층. 「어느 일간일 때 이 자리가 천을귀인인가」. */
export function jogyeonOf(node) {
  return (brain?.조견표 ?? []).filter((e) => e.a === node || e.b === node)
}

/** 판정 절차 — 강약 110점제 · 득령득지 · 용신 취용. ⚠`stance`에 판본 갈림이 적혀 있다. */
export function procedures() {
  return brain?.판정절차 ?? []
}

/**
 * ★역추론 — 「이 일이 있었다 → 원국의 무엇일 수 있나」.
 * 운영자 해석 철학 4원칙의 ④(역추론)와 P4 시험의 입구다.
 * ⚠**숫자를 주지 않는다.** 필연/경향/희박 세 단계뿐 —
 *   코퍼스가 확률을 못 주는데 숫자를 붙이면 없는 정밀도를 주장하게 된다(운영자: *"99%는 100%가 아님"*).
 */
export function reverseOf(발현) {
  return (brain?.역추론 ?? []).find((r) => r.발현 === 발현 || r.b === 발현) ?? null
}

/**
 * 계산된 키셋 전체 → 두뇌 조회 결과.
 * `chartToKeys(chart).keys`를 그대로 넣는다.
 */
export function readChart(keys, opts = {}) {
  const out = { 노드: [], 관계: [], 조견표: [], 못맞춘키: [] }
  const seen = new Set()
  for (const k of keys) {
    const n = keyToNode(k)
    if (!n) { out.못맞춘키.push(k); continue }   // ⚠조용히 버리지 않는다
    if (seen.has(n)) continue
    seen.add(n)
    out.노드.push({ 키: k, 노드: n, ...nodeCard(n) })
  }
  for (const n of seen) {
    out.관계.push(...relationsOf(n, opts))
    out.조견표.push(...jogyeonOf(n))
  }
  // 같은 관계가 양쪽 노드에서 두 번 들어온다 — 접는다
  const key = (r) => `${r.a}${r.관계}${r.b}`
  const m = new Map()
  for (const r of out.관계) m.set(key(r), r)
  out.관계 = [...m.values()]
  return out
}

/** 팩 상태 — 화면에 «뇌가 얼마나 달렸나»를 정직하게 띄우기 위한 것. */
export function brainMeta() {
  return brain?.meta ?? null
}
