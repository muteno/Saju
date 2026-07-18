import type { JeonggokRaw } from '../engine'
import { josa } from './dosaTopics'

/**
 * 정곡(正鵠) 선별기 — 도사가 먼저 맞히는 오프닝의 심장.
 * 원본: 정곡 선별기 프로토(orphan 커밋 f6accc4, 구엔진 대상) → 현 엔진 표면으로 포팅(로직·가중치·문안 계승).
 * 원칙: 참인 것만(전부 엔진 결정론 산출 — 콜드리딩 금지), 임팩트 = 희소성×0.35 + 체감성×0.40 + 안전성×0.25.
 * layer: CALC=계산 사실(단정 화법·안 굽힘) · INFER=통설 라벨(hedge) · EVENT=시기 특정(틀리면 접는 리커버리).
 */
export interface JeonggokPick {
  token: string
  layer: 'CALC' | 'INFER' | 'EVENT'
  impact: number
  /** 근거(엔진 판정 문자열) — 근거 보기 접힘에 노출 */
  evid: string
  /** 도사 발화(반말 도사체 — 프로토 문안 계승) */
  line: string
}

const impact = (c: { rarity: number; felt: number; safety: number }) => c.rarity * 0.35 + c.felt * 0.4 + c.safety * 0.25

const GUNG: Record<string, string> = { 일: '배우자궁', 월: '사회궁', 시: '자식·말년궁', 년: '조상·부모궁' }
const EL5 = ['목', '화', '토', '금', '수']

interface Cand extends JeonggokPick {
  rarity: number
  felt: number
  safety: number
}

export function selectJeonggok(raw: JeonggokRaw): JeonggokPick | null {
  const out: Cand[] = []
  const push = (c: Omit<Cand, 'impact'>) => out.push({ ...c, impact: +impact(c).toFixed(3) })

  // A. 오행 부재/과다 — CALC (여덟 자 세기 = 순수 사실)
  for (const el of EL5) {
    const n = raw.elements[el] ?? 0
    if (n === 0)
      push({
        token: `오행 부재·${el}`, layer: 'CALC', rarity: 0.3, felt: 0.78, safety: 0.9,
        evid: `오행 ${el} = 0/8`,
        line: `여덟 글자에 ${el}${josa(el, '이', '가')} 하나도 없어. 세는 거라 그냥 사실이야.`,
      })
    else if (n >= 4)
      push({
        token: `오행 과다·${el}`, layer: 'CALC', rarity: 0.5, felt: 0.72, safety: 0.78,
        evid: `오행 ${el} = ${n}/8`,
        line: `${el} 기운이 ${n}개 — 판이 한쪽으로 몰려 있어.`,
      })
  }

  // B. 관성 부재 — CALC
  if (raw.missingGroups.includes('관성'))
    push({
      token: '관성 부재', layer: 'CALC', rarity: 0.5, felt: 0.8, safety: 0.7,
      evid: '십신 그룹 관성 = 0',
      line: '관성이 하나도 없어. 남이 씌우는 굴레를 못 견디는 배열이지.',
    })

  // C. 원국 지지관계: 충·원진·형 — CALC (자리 = 궁으로 짚는다)
  const gungPos = (positions: string[]) => (['일', '월', '시', '년'] as const).find((p) => positions.includes(p)) ?? '년'
  for (const r of raw.relations.chung) {
    const pos = gungPos(r.positions)
    push({
      token: `${pos}지 충`, layer: 'CALC', rarity: 0.5, felt: pos === '일' ? 0.95 : 0.8, safety: 0.5,
      evid: `${r.positions.join('↔')} ${r.name}`,
      line: `${pos}지가 충이야 — ${GUNG[pos]} 자리가 부딪히는 판이지.`,
    })
  }
  for (const r of raw.relations.wonjin)
    push({
      token: '원진', layer: 'CALC', rarity: 0.5, felt: 0.9, safety: 0.5,
      evid: `${r.positions.join('↔')} ${r.name}`,
      line: '원진이 걸렸어. 이유 없이 밉고 그리운, 그 묘한 기운 말이야.',
    })
  for (const r of raw.relations.hyeong)
    push({
      token: '형(刑)', layer: 'CALC', rarity: 0.72, felt: 0.88, safety: 0.42,
      evid: `${r.positions.join('↔')} ${r.name}`,
      line: `${r.name}${josa(r.name, '이', '가')} 있어 — 다듬어지느라 아픈 자리지.`,
    })

  // D. 신살: 도화(년살)·역마·화개 — CALC(이름)
  for (const k of ['시', '일', '월', '년'] as const) {
    const ss = raw.pillars[k].sinsal
    if (ss === '년살')
      push({ token: '도화', layer: 'CALC', rarity: 0.3, felt: 0.6, safety: 0.7, evid: `${k}주 년살(도화)`, line: '신살에 도화가 떴어. 어딜 가도 눈에 띄는 팔자야.' })
    if (ss === '역마살')
      push({ token: '역마', layer: 'CALC', rarity: 0.3, felt: 0.6, safety: 0.72, evid: `${k}주 역마살`, line: '역마살이 떴네. 한자리에 오래 묶여 있으면 병나는 사람이지.' })
    if (ss === '화개살')
      push({ token: '화개', layer: 'CALC', rarity: 0.42, felt: 0.55, safety: 0.75, evid: `${k}주 화개살`, line: '화개살이 있어 — 혼자 파고드는 정신의 창고지.' })
  }

  // E. 일지 공망 — CALC
  if (raw.gongmang.includes(raw.pillars.일.branch))
    push({
      token: '일지 공망', layer: 'CALC', rarity: 0.55, felt: 0.75, safety: 0.6,
      evid: `공망 ${raw.gongmang.join('·')} — 일지 ${raw.pillars.일.branch}`,
      line: '일지가 공망이야. 채워도 채워도 어딘가 빈 듯한 자리지.',
    })

  // F. 신강/신약 극단 — INFER (라벨은 통설·보드 판정)
  if (raw.strength.label === '극신강')
    push({
      token: '신강(뚜렷)', layer: 'INFER', rarity: 0.5, felt: 0.75, safety: 0.6,
      evid: `강약 보드 ${raw.strength.score}/${raw.strength.max} = 극신강`,
      line: '기운이 아주 세게 계산돼. 남 말 듣고 움직이는 건 딱 질색인 판이야.',
    })
  else if (raw.strength.label === '극신약')
    push({
      token: '신약(뚜렷)', layer: 'INFER', rarity: 0.5, felt: 0.75, safety: 0.6,
      evid: `강약 보드 ${raw.strength.score}/${raw.strength.max} = 극신약`,
      line: '기운이 많이 여리게 계산돼. 혼자보다 곁이 있어야 사는 판이지.',
    })

  // G. 간여지동 — CALC (일주 천간·지지 같은 오행 = 사실)
  if (raw.pillars.일.stemEl === raw.pillars.일.branchEl)
    push({
      token: '간여지동', layer: 'CALC', rarity: 0.62, felt: 0.78, safety: 0.58,
      evid: `일주 천간·지지 동일 오행(${raw.pillars.일.stemEl})`,
      line: '일주가 간여지동이야 — 천간과 지지가 통째로 한 기운. 뜻이 서면 꺾기 어려운 배열이지.',
    })

  // H. 일지 운성 극단(제왕·절) — INFER
  const un = raw.pillars.일.stage
  if (un === '제왕' || un === '절')
    push({
      token: `일지 운성·${un}`, layer: 'INFER', rarity: 0.5, felt: 0.6, safety: 0.65,
      evid: `일지 십이운성 = ${un}`,
      line: un === '제왕' ? '일지 운성이 제왕이야. 스스로 왕 노릇 해야 직성이 풀리지.' : '일지 운성이 절이야. 끊고 다시 시작하는 힘이 유난한 자리지.',
    })

  // T. 시기 특정 — EVENT (원국 × 대운 크로스, 최강 정곡: 충>원진>자형 × 현재 나이 근접도)
  const curAge = raw.nowYear - raw.birthYear
  let best: { w: number; age: number; name: string; type: string; withPos: string } | null = null
  for (const d of raw.daeunHits)
    for (const r of d.relations) {
      const s = r.type === '충' ? 3 : r.type === '원진' ? 2 : r.type === '자형' ? 1 : 0
      if (!s) continue
      const w = s * (1 / (1 + Math.abs(d.age - curAge) / 10))
      if (!best || w > best.w) best = { w, age: d.age, name: d.name, type: r.type, withPos: r.with }
    }
  if (best) {
    const past = best.age <= curAge
    push({
      token: `시기 특정·${best.age}세`, layer: 'EVENT', rarity: 0.6, felt: 0.95, safety: 0.6,
      evid: `${best.withPos}지 × ${best.age}세 대운(${best.name}) ${best.type}`,
      line: past
        ? `${best.age}세 무렵부터 큰 흐름이 원국과 ${best.type}으로 걸려 있어. 그맘때 삶이 한번 크게 출렁였을 텐데.`
        : `${best.age}세부터 큰 흐름이 원국과 ${best.type}으로 걸려. 미리 알고 맞는 파도는 무섭지 않지.`,
    })
  }

  // 중복 토큰 정리(최고 임팩트만) → 랭킹 → 1위 반환
  const bestByToken = new Map<string, Cand>()
  for (const c of out) {
    const prev = bestByToken.get(c.token)
    if (!prev || c.impact > prev.impact) bestByToken.set(c.token, c)
  }
  const ranked = [...bestByToken.values()].sort((a, b) => b.impact - a.impact)
  if (!ranked.length) return null
  const top = ranked[0]
  return { token: top.token, layer: top.layer, impact: top.impact, evid: top.evid, line: top.line }
}
