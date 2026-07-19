import {
  computeChartUI,
  buildReading,
  todayIljin as engineToday,
  todayKST,
  todayFortune,
  currentUnseYearName,
  type ChartInput,
  type TodayFortune,
  type UiChart,
  type Pillar as PillarT,
  type OhaengStat as OhaengStatT,
} from '../engine'
import { enneaLensCard } from './enneaLens'

/**
 * 화면 데이터층 — 전부 dosa-app L1 엔진 실계산 + L3 근거 리포트에서 생성.
 * 고정 목업 금지: 날짜는 오늘(KST) 실값, 사주는 저장 프로필 또는 URL 파라미터.
 * 샘플은 저장 프로필이 없을 때의 데모 전용 — 화면에 반드시 '샘플' 라벨과 함께만 노출한다.
 */
export type { Pillar, OhaengStat, Verdict, DaeunItem } from '../engine'

export interface Profile {
  name: string
  gender: '여자' | '남자'
  calendar: '양력' | '음력' | '음력(윤달)'
  birth: string
  city: string
  marital: '미혼' | '기혼'
}

// ── 샘플(데모 전용) ──
export const SAMPLE_INPUT: ChartInput = { year: 1990, month: 1, day: 1, hour: 8, minute: 24, gender: 'F' }
export const sampleProfileLabel = '샘플 · 1990년 1월 1일 08:24 여성'

let _sampleChart: UiChart | null = null
export function sampleChart(): UiChart {
  if (!_sampleChart) _sampleChart = computeChartUI(SAMPLE_INPUT)
  return _sampleChart
}

// ── 오늘(KST 실날짜) ──
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
export function todayInfo() {
  const t = todayKST()
  const names = engineToday(t.year, t.month, t.day)
  const dow = WEEKDAYS[new Date(`${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}T12:00:00+09:00`).getUTCDay()]
  return {
    ...t,
    ...names,
    dateLabel: `${t.month}월 ${t.day}일 ${dow}요일`,
    monthShort: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][t.month - 1],
  }
}

/** 오늘의 운세(내 원국 기준) — 엔진 diaryDayInfo 기반. 프로필 없으면 null. */
export function myTodayFortune(input: ChartInput | null): TodayFortune | null {
  if (!input) return null
  try {
    return todayFortune(input)
  } catch {
    return null
  }
}

// ── L3 근거 리딩 (전 섹션) ──
export interface ReadingSection { icon: string; label: string; lines: string[]; source?: string }
export interface CardBlock { label?: string; lines: string[]; source?: string }
export interface ReadingCard { id: string; title: string; chips?: string[]; blocks: CardBlock[]; note?: string }
export interface Reading {
  headline: string
  unseYear: string
  dialogue: ReadingSection[]
  cards: ReadingCard[]
}

const srcOf = (s: { doc?: string; title?: string } | undefined): string | undefined =>
  s?.doc ? `${s.doc}${s.title ? ` · ${s.title}` : ''}` : undefined

const exSrc = (ex: any): string | undefined => srcOf(ex?.source)

/**
 * 발췌 정제기(260718 실측 수선) — 원문 앞머리의 목차 헤딩("1. 병오년의 의미")·블로거 인사말·
 * SEO 키워드 나열·도입 잡담을 걸러 실내용 문단만 남긴다. 원문 변형 없음(필터만 — 인용 축자 원칙 유지).
 */
const cleanParas = (ps: string[]): string[] =>
  (ps ?? []).filter((s) => {
    const t = s.trim()
    if (!t) return false
    if (/^\d+[.)]\s/.test(t) || /^[(（][가-힣][)）]/.test(t)) return false // 번호·(가) 헤딩
    if (/^-\s*글의 차례\s*-/.test(t)) return false
    if (/(안녕하세요|반갑습니다|포스팅을 했었|포스팅에서|다뤄보겠습니다|알아보겠습니다|풀어주는 남자|구독|공감과 댓글)/.test(t.slice(0, 60))) return false // 인사·도입 잡담
    if (t.split(/[,ㅣ|·]/).length >= 4 && t.length < 70) return false // SEO 키워드 나열
    return true
  })

/** 발췌 목록 중 정제 후 실내용이 남는 첫 발췌 채택(전무 = null → 블록 생략) */
const pickExcerpt = (excerpts: any[] | undefined, n: number): { paras: string[]; src?: string; total?: number } | null => {
  for (const ex of excerpts ?? []) {
    if (/사주풀이\s*[ㅣ|]/.test(ex?.source?.title ?? '')) continue // 인물·사건 사주풀이류 = 내 리포트 근거로 부적합
    const paras = cleanParas(ex?.paras)
    if (paras.length) return { paras: paras.slice(0, n), src: exSrc(ex), total: ex.totalParas }
  }
  return null
}

/** 엔진 근거 리포트 → 화면 리딩. 근거 있는 섹션만(없으면 비움 = 소장 문헌 없음). */
export function toReading(input: ChartInput, opts: { hourUnknown?: boolean; profileName?: string } = {}): Reading {
  const hourUnknown = !!opts.hourUnknown
  const rep: any = buildReading(input)
  const byId = (id: string) => rep.sections.find((s: any) => s.id === id)
  const unseYear = currentUnseYearName()

  // ① 대화(도사 한마디) — VN 첫 화면용 압축(260718 실측: 4섹션 = 화면 76% 초과 → 2섹션 요약).
  //    구조판정 전문은 카드로 이동. 배점 내부 수치는 사용자 문장에서 제거.
  const dialogue: ReadingSection[] = []
  let headline = '사주 풀이'
  const judgeLines: string[] = (byId('judge')?.lines ?? []).map((l: string) =>
    l.replace(/\*\*/g, '').replace(/\s*\([^)]*배점[^)]*\)/g, '').replace(/\s*—\s*방법론 보드[^·\n]*/g, ''),
  )

  const d = byId('ilju')?.block?.distilled
  if (d) {
    headline = d.title ?? headline
    const lines = [d.distilled?.핵심, d.distilled?.성격?.[0]].filter(Boolean) as string[]
    if (lines.length) dialogue.push({ icon: '🎴', label: `${d.title} 특성`, lines, source: srcOf(d.sources?.[0]) })
  }
  if (hourUnknown)
    dialogue.push({
      icon: '🕰️',
      label: '시간 모름',
      lines: ['태어난 시간을 몰라 시주(時柱)를 뺀 세 기둥으로 본다. 일주 중심의 풀이는 그대로 정확하니 안심하게.'],
    })

  const unseSec = rep.sections.find((s: any) => s.id === 'unse' && s.block?.excerpts?.length)
  const unsePick = unseSec ? pickExcerpt(unseSec.block.excerpts, 6) : null
  if (unsePick) dialogue.push({ icon: '🍀', label: `올해 · ${unseYear}년`, lines: unsePick.paras.slice(0, 1), source: unsePick.src })

  // ② 카드(전체 리포트) — 순서: 구조 판정 → 일주 → 십신 → 합충 → 신살 → 세운 (대운 레일은 별도 렌더)
  const cards: ReadingCard[] = []

  if (!hourUnknown && judgeLines.length)
    cards.push({ id: 'judge', title: '원국 구조 판정', blocks: [{ lines: judgeLines, source: '엔진 판정(신강신약 보드·조후)' }] })

  if (d) {
    const blocks: CardBlock[] = []
    if (d.distilled?.핵심) blocks.push({ label: '핵심', lines: [d.distilled.핵심] })
    if (d.distilled?.성격?.length) blocks.push({ label: '성격', lines: d.distilled.성격 })
    if (d.distilled?.직업?.length) blocks.push({ label: '일과 재능', lines: d.distilled.직업 })
    if (d.distilled?.관계?.length) blocks.push({ label: '관계', lines: d.distilled.관계 })
    if (d.distilled?.주의?.length) blocks.push({ label: '주의', lines: d.distilled.주의 })
    if (d.distilled?.물상) blocks.push({ label: '물상', lines: [d.distilled.물상] })
    for (const v of d.관점차이 ?? []) {
      const lines = (v.견해 ?? []).map((g: any) => `${g.src}: ${g.내용}`)
      if (lines.length) blocks.push({ label: `관점 차이 — ${v.주제}`, lines })
    }
    if (blocks.length) {
      blocks[blocks.length - 1].source = srcOf(d.sources?.[0])
      cards.push({ id: 'ilju', title: `일주 이야기 — ${d.title ?? ''}`, blocks })
    }
  }

  if (!hourUnknown) {
    const sipsin = byId('sipsin')
    if (sipsin) {
      const chips = Object.entries(sipsin.distribution ?? {})
        .filter(([, n]: any) => n > 0)
        .sort((a: any, b: any) => b[1] - a[1])
        .map(([k, n]) => `${k} ×${n}`)
      const blocks: CardBlock[] = (sipsin.blocks ?? [])
        .map((b: any) => ({ label: b.label, pick: pickExcerpt(b.excerpts, 2) }))
        .filter((b: any) => b.pick)
        .slice(0, 3)
        .map((b: any) => ({ label: b.label, lines: b.pick.paras, source: b.pick.src }))
      if (chips.length || blocks.length) cards.push({ id: 'sipsin', title: '십신 구성', chips, blocks })
    }

    const hap = byId('hapchung')
    if (hap) {
      const blocks: CardBlock[] = []
      if (hap.lines?.length) blocks.push({ label: '내 원국의 합충', lines: hap.lines })
      for (const b of hap.blocks ?? []) {
        const pick = pickExcerpt(b.excerpts, 2)
        if (pick) blocks.push({ label: b.label, lines: pick.paras, source: pick.src })
        if (blocks.length >= 3) break
      }
      if (blocks.length) cards.push({ id: 'hapchung', title: '합충 관계', blocks })
    }

    const sinsal = byId('sinsal')
    if (sinsal?.blocks?.length) {
      const picked: CardBlock[] = []
      for (const b of sinsal.blocks) {
        const pick = pickExcerpt(b.excerpts, 1)
        if (pick) picked.push({ label: b.label, lines: pick.paras, source: pick.src })
        if (picked.length >= 5) break
      }
      const shown = new Set(picked.map((b) => b.label))
      const restChips = sinsal.blocks.map((b: any) => b.label).filter((l: string) => !shown.has(l))
      cards.push({
        id: 'sinsal',
        title: '신살',
        chips: restChips,
        blocks: picked,
        note: restChips.length > 0 ? '이야기의 앞머리만 — 나머지는 도사에게 물어보게.' : undefined,
      })
    }
  } else {
    cards.push({
      id: 'hour-unknown',
      title: '시간을 알면 더 보이는 것',
      blocks: [
        {
          lines: [
            '십신 구성·합충·신살·대운 흐름은 시주(태어난 시간)까지 있어야 정확하게 판정된다.',
            '출생 시간을 알게 되면 정보 수정에서 채워 넣게 — 그때 전체 풀이가 열린다.',
          ],
        },
      ],
    })
  }

  if (unsePick) {
    cards.push({
      id: 'unse',
      title: `올해의 운 — ${unseYear}년`,
      blocks: [{ lines: unsePick.paras, source: unsePick.src }],
      note: (unsePick.total ?? 0) > unsePick.paras.length ? '이야기의 앞머리만 — 나머지는 도사에게 물어보게.' : undefined,
    })
  }

  // 성향 확장 렌즈(에니어그램 교차) — 십신 세력 결정론 조회 가설 + 보조지표(툴킷 테스트 결과, 있을 때만).
  // 위계: 메인 = 원국 해석 · 에니어그램 = 보조지표(운영자 260719). 기존 7섹션 순서는 동결이라 말미에만 붙인다.
  if (!hourUnknown) {
    const lens = enneaLensCard(byId('sipsin')?.distribution, opts.profileName)
    if (lens) cards.push(lens)
  }

  return { headline, unseYear, dialogue, cards }
}

// 샘플 리딩(데모 폴백) — KB는 main.tsx의 loadKb() 게이트 이후에만 존재(모듈 시점 호출 금지).
let _grounded: Reading | null = null
export function groundedReading(): Reading {
  if (!_grounded) _grounded = toReading(SAMPLE_INPUT)
  return _grounded
}

/** 시간 모름일 때 오행 분포 재계산 — 날조된 시주 2자를 빼고 6자로 판정(비율 기준은 동일) */
export function ohaengWithoutHour(pillars: PillarT[]): OhaengStatT[] {
  const rest = pillars.filter((p) => p.title !== '시')
  const count: Record<string, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 }
  for (const p of rest) {
    count[p.ganE]++
    count[p.jiE]++
  }
  const total = rest.length * 2
  return (['목', '화', '토', '금', '수'] as const).map((key) => {
    const pct = (count[key] / total) * 100
    let verdict: OhaengStatT['verdict'] = '적정'
    if (pct === 0) verdict = '부족'
    else if (pct <= 12.5) verdict = '적정'
    else if (pct <= 25) verdict = '발달'
    else verdict = '과다'
    return { key, pct: Math.round(pct * 10) / 10, verdict }
  })
}
