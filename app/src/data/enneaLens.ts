// 성향 확장 렌즈 — 사주 원국 십신 세력 → 에니어그램 후보 유형 교차 (결정론 조회).
// 절대 원칙 정합(dosa-app/README.md): 후보 산출 = 엔진 L3 sipsin.distribution(만세력 결정론 산출)이
// 키가 되는 고정 가중표 조회 — 검색·LLM 판단 없음. 문구 = 고정 틀만(dosaTopics 커넥터 허용 범위와 동일 축).
// ⚠ 두 체계는 기원이 다른 렌즈라 1:1 등가가 아니다 — 산출물은 '가설'이며 카드가 항상 이를 고지하고,
//    검증 동선은 /enneagram/ 테스트(자기보고)로 넘긴다(사주 = 가설 제시 · 에니어그램 = 본인 검증).
// 매핑 근거 축: 십신 성정 통설(코퍼스 십성 문헌 계열) × 에니어그램 툴킷 TYPES 동기·강점
// (app/public/enneagram/enneagram_analyzer.html — 강의 50편 증류 · 유형명은 툴킷 표기 그대로).
// 위계(운영자 260719 확정): 메인 = 사주 원국 해석 · 에니어그램 = 보조지표(곁에서 견주는 검증 참고).
// 보조지표가 원국 풀이를 '판정'하는 프레임 금지 — 일치 = 뒷받침 신호, 불일치 = "참고일 뿐, 중심은 원국".
import type { ReadingCard, CardBlock } from './saju'

/** 툴킷 TYPES 정본 명칭 (enneagram_analyzer.html n:1~9 — 표기 변경 금지) */
const ENNEA_NAME: Record<number, string> = {
  1: '개혁가', 2: '조력가', 3: '성취자', 4: '개인주의자', 5: '탐구자',
  6: '충성가', 7: '열정가', 8: '도전자', 9: '평화주의자',
}

interface Cand { t: number; w: number; why: string }

// 설계 노트(평의회 260719): 카드 블록은 4개 이하 유지 — Result.tsx 접힘 규칙(blocks>4 = collapsible)이
// 발동하면 '읽는 법'의 가설 고지가 접혀 가려진다. 블록 증설 시 이 계약 먼저 확인.

/** 십신 → 성향축·에니어그램 후보 가중표 (값 SSOT — 조정은 이 표에서만) */
const SIPSIN_TO_ENNEA: Record<string, { trait: string; cands: Cand[] }> = {
  비견: { trait: '주체성·자기 기준', cands: [{ t: 8, w: 2, why: '제 힘으로 정면 돌파하려는 주체성' }, { t: 1, w: 1, why: '스스로 세운 기준을 지키는 고집' }] },
  겁재: { trait: '승부욕·추진', cands: [{ t: 8, w: 2, why: '판을 장악하려는 승부 기질' }, { t: 3, w: 1, why: '경쟁에서 이기려는 동력' }] },
  식신: { trait: '베풂·여유', cands: [{ t: 2, w: 2, why: '먹이고 돌보는 따뜻한 손' }, { t: 7, w: 1, why: '삶을 즐기는 낙천' }] },
  상관: { trait: '표현·개성', cands: [{ t: 4, w: 2, why: '남다름을 드러내는 표현욕' }, { t: 7, w: 1, why: '틀을 벗어나는 재기' }] },
  정재: { trait: '성실·관리', cands: [{ t: 6, w: 2, why: '착실히 대비하는 신중함' }, { t: 1, w: 1, why: '꼼꼼한 기준과 정확성' }] },
  편재: { trait: '확장·수완', cands: [{ t: 7, w: 2, why: '기회를 좇는 활동성' }, { t: 3, w: 1, why: '실리를 만들어 내는 수완' }] },
  정관: { trait: '규범·책임', cands: [{ t: 1, w: 2, why: '옳고 바름을 지키려는 책임감' }, { t: 6, w: 1, why: '조직과 약속에 대한 충실' }] },
  편관: { trait: '결단·긴장', cands: [{ t: 8, w: 2, why: '압박을 견디고 결단하는 힘' }, { t: 6, w: 1, why: '위기를 미리 대비하는 경계심' }] },
  정인: { trait: '수용·안정', cands: [{ t: 9, w: 2, why: '품어 주는 수용과 평온' }, { t: 5, w: 1, why: '배움으로 중심을 잡는 힘' }] },
  편인: { trait: '탐구·직관', cands: [{ t: 5, w: 2, why: '홀로 파고드는 탐구와 관찰' }, { t: 4, w: 1, why: '남다른 내면 세계' }] },
}

/** 툴킷(에니어그램 앱 — 같은 오리진 /enneagram/) 저장 인물 직독. 부재·파손 = 빈 배열(fail-soft · 기기 로컬 선례 = profiles.ts). */
interface ToolkitPerson { name: string; type: number; wing?: number }
function readToolkitPeople(): ToolkitPerson[] {
  try {
    const raw = localStorage.getItem('enneagram_people_v1')
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((p) => p && typeof p.name === 'string' && typeof p.type === 'number') : []
  } catch {
    return []
  }
}

/** 십신 분포(엔진 산출) → 성향 렌즈 카드. 분포가 비면 null(카드 자체를 안 만든다 = 근거 없으면 침묵 원칙).
 *  profileName이 있고 툴킷에 같은 이름(정확 일치 — 결정론, 유사 매칭 금지)의 테스트 결과가 있으면
 *  '보조지표' 블록을 덧붙인다. */
export function enneaLensCard(distribution: Record<string, number> | null | undefined, profileName?: string): ReadingCard | null {
  const dist = Object.entries(distribution ?? {}).filter(([g, n]) => n > 0 && SIPSIN_TO_ENNEA[g])
  if (!dist.length) return null

  // 유형 점수 = Σ(십신 개수 × 가중치) — 전 과정 결정론(동률은 유형 번호 오름차순 = 재현 가능)
  const score = new Map<number, number>()
  const contrib = new Map<number, { g: string; why: string; s: number }[]>()
  for (const [g, n] of dist) {
    for (const c of SIPSIN_TO_ENNEA[g].cands) {
      score.set(c.t, (score.get(c.t) ?? 0) + n * c.w)
      const arr = contrib.get(c.t) ?? []
      arr.push({ g, why: c.why, s: n * c.w })
      contrib.set(c.t, arr)
    }
  }
  const top = [...score.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 3)
  if (!top.length) return null

  const strongest = [...dist].sort((a, b) => b[1] - a[1]).slice(0, 2)
  const axisLine = strongest.map(([g]) => `${g}(${SIPSIN_TO_ENNEA[g].trait})`).join('과 ')

  // 대표 문구 = 기여(개수×가중치) 최대 십신의 사유 — 점수 논리와 문구 대표성 일치(평의회 위원1)
  const candLines = top.map(([t]) => {
    const cs = (contrib.get(t) ?? []).slice().sort((a, b) => b.s - a.s)
    const gs = [...new Set(cs.map((c) => c.g))].join('·')
    return `${t}번 ${ENNEA_NAME[t]} — ${gs} 기운이 가리키는 ${cs[0].why}`
  })

  const blocks: CardBlock[] = [
    {
      label: '읽는 법',
      lines: [
        '풀이의 중심은 어디까지나 사주 원국일세. 에니어그램은 뿌리가 다른 체계라, 원국이 읽어낸 성향을 곁에서 견줘 보는 보조지표로만 쓴다 — 재미로 보는 실험적 가설이지.',
        `이 원국은 ${axisLine} 기운이 도드라진다. 힘 있는 십신의 성정을 아홉 유형의 동기와 겹쳐 어울릴 법한 후보를 좁혔고, 여러 기운이 같은 유형을 가리킬수록 후보로 강하게 잡힌다.`,
      ],
    },
    {
      label: '후보 유형',
      lines: candLines,
      source: '에니어그램 툴킷(강의 50편 증류) × 십신 성정 통설',
    },
  ]

  // 보조지표 블록 — 본인이 툴킷 테스트로 확인한 유형이 있을 때만(정확 일치·기기 로컬). 판정이 아니라 곁 신호.
  if (profileName) {
    const me = readToolkitPeople().find((p) => p.name.trim() === profileName.trim())
    if (me && ENNEA_NAME[me.type]) {
      const label = `${me.type}번 ${ENNEA_NAME[me.type]}${me.wing ? ` (날개 ${me.wing})` : ''}`
      const hit = top.some(([t]) => t === me.type)
      blocks.push({
        label: '보조지표 — 내가 테스트로 확인한 유형',
        lines: [
          hit
            ? `${label}. 원국 후보와 겹치는군 — 위 십신 풀이를 곁에서 뒷받침하는 보조 신호로 봐도 되겠네.`
            : `${label}. 원국 후보와는 겹치지 않네 — 보조지표는 어디까지나 참고일세. 풀이의 중심은 언제나 원국이야.`,
        ],
      })
    }
  }

  return {
    id: 'ennea',
    title: '성향 렌즈 — 에니어그램 교차',
    chips: top.map(([t]) => `후보 · ${t}번 ${ENNEA_NAME[t]}`),
    blocks,
    note: '십신 세력으로 세운 가설일 뿐 확정은 아닐세 — 아래 버튼으로 열고 위쪽 「테스트」 탭에서 직접 맞춰 보게. 테스트 결과를 저장해 두면 다음 리포트부터 보조지표로 함께 보여 주지.',
  }
}
