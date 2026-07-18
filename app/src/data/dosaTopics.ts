// 주제 고정 분류표 — L4 도사 대화의 근거 선택층.
// 절대 원칙(dosa-app/README.md L4): 자유 검색 금지 — 고정 주제 분류표 안에서 키 선택 → 결정론 조회.
// 이 모듈은 ReportBundle(엔진 L3 산출)에서 주제별 대사 시퀀스를 "그대로 인용"으로 뽑는 순수 함수만 담는다.
// 문장 창작 금지 — 허용 범위는 도사 화법 커넥터(TOPIC_INTROS)와 관점차이 병기 틀뿐.
import type { ReportBundle } from '../engine'

export interface DosaLine {
  text: string
  /** 근거 출처(문서·글 제목) — 근거줄 접힘 UI에 표시 */
  grounds?: { doc: string; title: string }[]
  /** calc=엔진 산출(결정론) · hedge=문헌 경향(단정 금지 톤) */
  tone?: 'calc' | 'hedge'
}

export interface Topic {
  key: string
  label: string
  /** 선택지 우측 9px 라벨 — 근거 위치 표기 */
  mini: string
}

/** 5개 고정 — API 화이트리스트(functions/api/dosa.ts)와 동일 키 */
export const TOPICS: Topic[] = [
  { key: '성격', label: '내 성격이 궁금해', mini: '일주론' },
  { key: '올해', label: '올해 운은 어때?', mini: '세운' },
  { key: '직업', label: '일·직업 방향은?', mini: '십신·일주' },
  { key: '관계', label: '연애·관계 이야기', mini: '일지·일주' },
  { key: '주의', label: '조심할 건 없어?', mini: '일주·관점차이' },
]

/** 도사 화법 커넥터(주제 진입 첫 마디) — 코퍼스 인용이 아닌 접속 문구만 허용되는 유일한 자리 */
export const TOPIC_INTROS: Record<string, string> = {
  성격: '먼저 타고난 그릇부터 볼까.',
  올해: '올해의 흐름을 짚어 보지.',
  직업: '일복이 어디에 있는지 보자꾸나.',
  관계: '인연의 자리를 들여다보자.',
  주의: '미리 알아 두면 좋은 것들이야.',
}

/** 시간 모름 안내(시주 의존 근거를 뺐을 때 1줄) */
export const HOUR_UNKNOWN_NOTICE = '태어난 시간을 알면 더 정확해진다.'

/** 근거 전무 폴백 — 엔진 정본 문구('소장 문헌에 상세 없음') 계승 */
const EMPTY_NOTICE = '소장 문헌에 상세 없음 — 자료가 더 정리되면 말해 주마.'

// ── ReportBundle 섹션 실구조(엔진 vendor/report.js 실측) 로컬 타입 ──
interface GroundRef {
  doc: string
  title: string
}
interface Excerpt {
  source: GroundRef
  paras: string[]
  truncated?: boolean
  totalParas?: number
}
interface DistilledUnit {
  title?: string
  sources?: { doc: string; title: string; unit?: string }[]
  distilled?: {
    핵심?: string
    성격?: string[]
    직업?: string[]
    관계?: string[]
    주의?: string[]
    물상?: string
  }
  인용?: { text: string; src: string }[]
  관점차이?: { 주제: string; 견해: { src: string; 내용: string }[] }[]
}
interface TopicBlock {
  key?: string
  distilled?: DistilledUnit
  excerpts?: Excerpt[]
  totalUnits?: number
  empty?: boolean
  note?: string
}
interface SectionLike {
  id: string
  title: string
  lines?: string[]
  block?: TopicBlock
  blocks?: (TopicBlock & { label?: string })[]
  distribution?: Record<string, number>
  table?: { pos?: string; ganji?: string }[]
  meta?: { dayMaster?: string }
}

function findSection(report: ReportBundle, id: string): SectionLike | undefined {
  return report.sections.find((s) => s.id === id) as unknown as SectionLike | undefined
}

function distilledSources(d?: DistilledUnit): GroundRef[] | undefined {
  const s = d?.sources
  if (!s?.length) return undefined
  return s.map(({ doc, title }) => ({ doc, title }))
}

/** 발췌 앞 n문단 → 대사 1개(원문 그대로, 문단은 빈 줄 구분) */
function excerptLine(ex: Excerpt | undefined, nParas: number, tone?: DosaLine['tone']): DosaLine | null {
  if (!ex?.paras?.length) return null
  return {
    text: ex.paras.slice(0, nParas).join('\n\n'),
    grounds: [ex.source],
    ...(tone ? { tone } : {}),
  }
}

/** topicBlock(증류본 우선/발췌 폴백) → 대표 대사. 증류본이면 핵심 1줄, 아니면 첫 발췌 n문단. */
function blockLead(b: TopicBlock | undefined, nParas: number, tone?: DosaLine['tone']): DosaLine[] {
  if (!b || b.empty) return []
  if (b.distilled) {
    const core = b.distilled.distilled?.핵심
    if (!core) return []
    const g = distilledSources(b.distilled)
    return [{ text: core, ...(g ? { grounds: g } : {}), ...(tone ? { tone } : {}) }]
  }
  const line = excerptLine(b.excerpts?.[0], nParas, tone)
  return line ? [line] : []
}

/** 증류 리스트(성격[]/직업[]/…) → 2항목씩 한 대사로 묶음(원문 무변형 — 탭 파편화 완화, '올해' 3문단 묶음과 동형) */
function listLines(items: string[] | undefined, grounds?: GroundRef[]): DosaLine[] {
  const src = items ?? []
  const out: DosaLine[] = []
  for (let i = 0; i < src.length; i += 2) {
    out.push({ text: src.slice(i, i + 2).join('\n\n'), ...(grounds ? { grounds } : {}) })
  }
  return out
}

/** 받침 유무 조사 선택("기질을/기질를" 오류 방지) */
export const josa = (word: string, withBatchim: string, without: string): string => {
  const code = word.charCodeAt(word.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return without
  return (code - 0xac00) % 28 > 0 ? withBatchim : without
}

/**
 * 주제 → 대사 시퀀스 (결정론 매핑 — 아래 표 밖의 조합 없음)
 * 성격: ilju.핵심(calc) + 성격[] + daymaster 발췌 2문단(hedge)
 * 올해: unse 발췌 첫 6~8문단을 2~3문단씩 묶음
 * 직업: ilju.직업[] + sipsin 최다 십신 발췌 2문단 (시간 모름 시 십신 제외 + 안내 1줄)
 * 관계: ilju.관계[] + daybranch 발췌 2문단
 * 주의: ilju.주의[] + 관점차이 병기(견해 src 포함)
 */
export function topicLines(report: ReportBundle, topicKey: string, hourUnknown = false): DosaLine[] {
  const ilju = findSection(report, 'ilju')
  const d = ilju?.block?.distilled
  const dd = d?.distilled
  const dSrc = distilledSources(d)
  const out: DosaLine[] = []

  switch (topicKey) {
    case '성격': {
      if (dd?.핵심) out.push({ text: dd.핵심, tone: 'calc', ...(dSrc ? { grounds: dSrc } : {}) })
      else out.push(...blockLead(ilju?.block, 3)) // 증류본 없는 일주 폴백 — 발췌 원문
      out.push(...listLines(dd?.성격, dSrc))
      const dm = excerptLine(findSection(report, 'daymaster')?.block?.excerpts?.[0], 2, 'hedge')
      if (dm) out.push(dm)
      break
    }
    case '올해': {
      const ex = findSection(report, 'unse')?.block?.excerpts?.[0]
      if (ex?.paras?.length) {
        const paras = ex.paras.slice(0, 8) // 첫 6~8문단
        for (let i = 0; i < paras.length; i += 3) {
          out.push({ text: paras.slice(i, i + 3).join('\n\n'), grounds: [ex.source] })
        }
      }
      break
    }
    case '직업': {
      out.push(...listLines(dd?.직업, dSrc))
      if (hourUnknown) {
        // 십신 분포는 시주(시간 천간·지지)를 포함해 집계 — 시간 모름이면 근거에서 제외
        out.push({ text: HOUR_UNKNOWN_NOTICE, tone: 'calc' })
      } else {
        // sipsin.blocks는 최다 십신 순 정렬(엔진) — 상위 1개만
        out.push(...blockLead(findSection(report, 'sipsin')?.blocks?.[0], 2))
      }
      break
    }
    case '관계': {
      out.push(...listLines(dd?.관계, dSrc))
      const db = excerptLine(findSection(report, 'daybranch')?.block?.excerpts?.[0], 2, 'hedge')
      if (db) out.push(db)
      break
    }
    case '주의': {
      out.push(...listLines(dd?.주의, dSrc))
      for (const pd of d?.관점차이 ?? []) {
        const views = pd.견해 ?? []
        if (!views.length) continue
        const stated = views.map((v) => {
          const doc = v.src.split('#')[0]
          return `${doc}${josa(doc, '은', '는')} "${v.내용}"`
        }).join(', ')
        out.push({
          text: `문헌마다 보는 눈이 다르구나 — ${pd.주제}${josa(pd.주제, '을', '를')} 두고 ${stated}라 본다.`,
          tone: 'hedge',
          grounds: views.map((v) => ({ doc: v.src.split('#')[0], title: `관점차이 — ${pd.주제}` })),
        })
      }
      break
    }
    default:
      break
  }

  if (!out.length) out.push({ text: EMPTY_NOTICE })
  return out
}

/** LLM 프롬프트용 압축 요약 — 원국표 4주 간지 + 일간 + 구조 판정 lines(엔진 산출 그대로) */
export function chartSummaryOf(report: ReportBundle): string {
  const parts: string[] = []
  const w = findSection(report, 'wonguk')
  const rows = w?.table ?? []
  if (rows.length) parts.push(`원국: ${rows.map((r) => `${r.pos ?? ''} ${r.ganji ?? ''}`.trim()).join(' · ')}`)
  if (w?.meta?.dayMaster) parts.push(`일간: ${w.meta.dayMaster}`)
  const judge = findSection(report, 'judge')
  if (judge?.lines?.length) parts.push(`구조 판정: ${judge.lines.map((l) => l.replace(/\*\*/g, '')).join(' / ')}`)
  return parts.join('\n')
}
