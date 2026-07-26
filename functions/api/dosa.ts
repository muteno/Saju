// Cloudflare Pages Function — POST /api/dosa
// L4 도사 대화층 프록시(dosa-app/README.md): 키는 서버측 환경변수, 클라이언트 노출 금지.
// LLM은 서술층일 뿐 — 미설정·실패 시 {fallback:true}를 돌려주고 클라이언트는 L3 조립 대사로 완결 동작한다.
// @cloudflare/workers-types 미설치 — 전역 타입 import 없이 로컬 타입만 사용(런타임 전역 Request/Response/fetch).
// 페르소나 단일 출처 = app/src/data/chefs.ts PERSONA(캐릭터 4인 말투 규칙 + 안전 경계) —
// 여기서 복제하지 않고 import(Pages Functions는 esbuild 번들이라 functions/ 밖 상대 import 허용).
import { PERSONA } from '../../app/src/data/chefs'

interface Env {
  /** 레거시 API 키 경로 — OAuth 체인이 하나도 없을 때의 폴백 */
  ANTHROPIC_API_KEY?: string
  DOSA_MODEL?: string
  // OAuth 구독 계정 체인(운영자 260726 "사주 앱 안에 있는 oauth키를 사용") — Actions 시크릿과
  // 동일 명명을 CF Pages env로도 등록해서 쓴다. 체인 순서 = shared/account_failover.py CHAIN 동기.
  CLAUDE_CODE_OAUTH_TOKEN_MUTENO?: string
  CLAUDE_CODE_OAUTH_TOKEN_NOMUTEFB?: string
  CLAUDE_CODE_OAUTH_TOKEN_EMS1130G?: string
  CLAUDE_CODE_OAUTH_TOKEN_MUTENONA?: string
  CLAUDE_CODE_OAUTH_TOKEN_EMS1130M?: string
  CLAUDE_CODE_OAUTH_TOKEN_EMS1130N?: string
}

interface GroundRef {
  doc?: string
  title?: string
}
interface GroundLine {
  text?: string
  grounds?: GroundRef[]
}
interface DosaRequest {
  topic?: string
  /** 자유 질문(입력창) — 화이트리스트 주제 대신 손님이 직접 쓴 말 */
  question?: string
  chartSummary?: string
  grounds?: GroundLine[]
  profileName?: string
  /** 클라이언트 모델 선택(app/src/data/prefs.ts) — 화이트리스트 밖이면 기본값 */
  model?: string
  /** 무대에 선 화자 id(chefs.ts CHEFS) — 미전송·미등록이면 중립 페르소나로 폴백 */
  chefId?: string
}

interface AnthropicContentBlock {
  type?: string
  text?: string
}
interface AnthropicResponse {
  content?: AnthropicContentBlock[]
}

/** 주제 화이트리스트 — app/src/data/dosaTopics.ts TOPICS와 동일 키 */
const TOPIC_WHITELIST = ['성격', '올해', '직업', '관계', '주의']
/** 자유 질문 상한 — 프롬프트 주입 면적을 좁게 유지한다(본문 길이는 MAX_BODY_BYTES가 따로 막는다) */
const MAX_QUESTION = 300

/**
 * 모델 화이트리스트 — app/src/data/prefs.ts DOSA_MODELS와 키 동기(운영자 260726 확정 2종).
 * ⚠ claude-api 정본 실측: `speed:"fast"`는 Opus 5/4.8 전용(베타 fast-mode-2026-02-01) —
 * 소넷5엔 빠름 모드가 없어 표준 호출(그 자체로 빠른 축). effort는 소넷 = low(속도 우선,
 * 운영자 "대답속도가 빨라야"), 오퍼스 빠름 = 기본(high, 깊이 축이라 낮추지 않는다).
 */
const MODELS: Record<string, { model: string; speed?: 'fast'; effort?: string }> = {
  sonnet: { model: 'claude-sonnet-5', effort: 'low' },
  'opus-fast': { model: 'claude-opus-5', speed: 'fast' },
}
const DEFAULT_MODEL_KEY = 'sonnet'

/** OAuth 계정 체인 — shared/account_failover.py CHAIN과 동일 순서(막히면 다음 계정) */
const CHAIN = ['MUTENO', 'NOMUTEFB', 'EMS1130G', 'MUTENONA', 'EMS1130M', 'EMS1130N'] as const

/** 쿼터·한도 판정 — shared/claude_transient.sh is_quota 정규식의 서버판(전환 트리거) */
const QUOTA_RE = /usage limit|weekly limit|hit your .{0,40}limit|rate.?limit|rate_limit|too many requests|quota|limit reached|limit.{0,40}reset|resets? (at|in)|credit balance|insufficient (credit|fund)|out of (credit|token)s?|billing (issue|error|problem)/i

const MAX_BODY_BYTES = 64 * 1024
const MAX_GROUND_LINES = 40
const MAX_GROUND_TEXT = 2000

// 페르소나(화자별 말투 계약, chefs.ts PERSONA) + L4 서술 표준 6원칙(사용자 확정 원문,
// dosa-app/README.md 2026-07-16) + 근거 밖 주장 금지. 화자 미지정·미등록이면 중립 페르소나.
const NEUTRAL_PERSONA = `당신은 연식당의 사주 도사입니다. 따뜻하고 담백한 존댓말로, 미연시풍 대화 화면에서 사용자의 사주를 풀이합니다.`

const CORE_RULES = `서술 표준 6원칙(반드시 지킬 것):
1. 일상어 풀이가 본문 — 전문용어는 비유·생활어로 번역 (예: 일지 = '나의 안방'). "일지 비견이라…"처럼 전문용어 나열로 문장을 시작하지 말 것 — 용어는 근거줄로
2. 생활 장면으로 번역 — 언제, 어떤 상황에서, 어떻게 나타나는지
3. 시기 구체화 — '유년'이 아니라 '2029년 기유년' (엔진이 환산). 시기는 나이("28세 무렵")가 아니라 연도("2021년 무렵")로 말할 것(만나이·세는나이 혼동 방지)
4. 완충 요인과 대처까지 — "그래서 어떻게 하면 되는지"에 반드시 답할 것
5. 단락 끝에 ▸근거줄: 전문용어 + 출처(보드/문헌/엔진) 병기
6. 단정 금지 — 경향 표현("~하기 쉽습니다", "패턴이 반복될 수 있습니다")

6원칙과 캐릭터 말투가 부딪히면 **내용 규칙(근거 병기·경향 표현·대처 제시)이 우선**하고,
어미·말끝만 캐릭터 말투를 따른다(예시 어미의 존댓말은 캐릭터에 맞게 바꿔도 된다).

절대 규칙: 아래 '근거 자료' 밖의 주장은 절대 하지 마라. 근거에 없으면 "소장 문헌에 없다"고 말하라.
답변은 2~4개 문단으로, 문단 사이는 빈 줄로 구분한다.`

/** 화자 페르소나 + 공통 규칙 합성 — PERSONA에 안전 경계가 이미 박혀 있다(chefs.ts) */
function systemPromptFor(chefId?: string): string {
  const persona = (typeof chefId === 'string' && PERSONA[chefId]) || NEUTRAL_PERSONA
  return `${persona}\n\n${CORE_RULES}`
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

function buildUserMessage(body: DosaRequest): string {
  const name = typeof body.profileName === 'string' && body.profileName.trim() ? body.profileName.trim() : '손님'
  const chartSummary = typeof body.chartSummary === 'string' ? body.chartSummary : ''
  const grounds = Array.isArray(body.grounds) ? body.grounds.slice(0, MAX_GROUND_LINES) : []
  const groundText = grounds
    .map((g, i) => {
      const text = typeof g?.text === 'string' ? g.text.slice(0, MAX_GROUND_TEXT) : ''
      if (!text) return null
      const srcs = Array.isArray(g.grounds)
        ? g.grounds
            .filter((s) => s && (s.doc || s.title))
            .map((s) => `${s.doc ?? ''}${s.doc && s.title ? ' · ' : ''}${s.title ?? ''}`)
            .join(' / ')
        : ''
      return `${i + 1}. ${text}${srcs ? `\n   출처: ${srcs}` : ''}`
    })
    .filter(Boolean)
    .join('\n')
  return [
    `호칭: ${name}`,
    typeof body.question === 'string' && body.question.trim()
      ? `손님이 직접 물었다: ${body.question.trim().slice(0, MAX_QUESTION)}`
      : `질문 주제: ${body.topic}`,
    '',
    '[사주 요약]',
    chartSummary || '(요약 없음)',
    '',
    '[근거 자료]',
    groundText || '(근거 자료 없음 — 이 경우 "소장 문헌에 없다"고 답할 것)',
  ].join('\n')
}

/** 자격 1개(OAuth 토큰 또는 API 키)로 1회 호출 — 성공 텍스트 / 'rotate'(다음 자격) / 'fallback'(체인 중단) */
async function callOnce(
  cred: { kind: 'oauth' | 'apikey'; token: string },
  modelCfg: { model: string; speed?: 'fast'; effort?: string },
  body: DosaRequest,
): Promise<{ ok: true; text: string } | { ok: false; next: 'rotate' | 'fallback' }> {
  // OAuth 구독 토큰 = Authorization: Bearer + oauth 베타 헤더(x-api-key 아님 — claude-api 정본).
  // 빠름 모드 = fast-mode 베타 헤더 + 본문 speed:"fast"(Opus 5/4.8 전용).
  const betas = ['oauth-2025-04-20', ...(modelCfg.speed ? ['fast-mode-2026-02-01'] : [])]
  const headers: Record<string, string> = {
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
    ...(cred.kind === 'oauth'
      ? { authorization: `Bearer ${cred.token}`, 'anthropic-beta': betas.join(',') }
      : { 'x-api-key': cred.token, ...(modelCfg.speed ? { 'anthropic-beta': 'fast-mode-2026-02-01' } : {}) }),
  }
  let apiRes: Response
  try {
    apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelCfg.model,
        max_tokens: 700,
        ...(modelCfg.speed ? { speed: modelCfg.speed } : {}),
        ...(modelCfg.effort ? { output_config: { effort: modelCfg.effort } } : {}),
        // 시스템 = 화자 페르소나(chefs.ts PERSONA) + 공통 규칙 — 안정 프리픽스라 캐시 브레이크포인트
        // (같은 세션 프리페치 5건이 화자별 프리픽스 공유)
        system: [{ type: 'text', text: systemPromptFor(body.chefId), cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildUserMessage(body) }],
      }),
    })
  } catch {
    return { ok: false, next: 'rotate' } // 네트워크 오류 = 다음 자격 시도(무해)
  }

  if (!apiRes.ok) {
    // 한도·인증 계열 = 계정 국한일 수 있어 다음 계정으로 로테이션(claude_transient.sh 폴오버 경계 계승:
    // 401/403은 활성 계정 국한 인증죽음 사례가 실측돼 전환이 정확한 처방 · 5xx/529 과부하도 계정 편차가 있어 전환 시도).
    if ([401, 403, 429, 500, 502, 503, 529].includes(apiRes.status)) return { ok: false, next: 'rotate' }
    // 400 등 요청 자체 문제 = 어느 계정으로 가도 같다 — 본문에 한도 문구가 있을 때만 로테이션
    const errText = await apiRes.text().catch(() => '')
    return { ok: false, next: QUOTA_RE.test(errText.slice(0, 500)) ? 'rotate' : 'fallback' }
  }

  const data = (await apiRes.json().catch(() => null)) as AnthropicResponse | null
  if (!data) return { ok: false, next: 'rotate' }
  if ((data as { stop_reason?: string }).stop_reason === 'refusal') return { ok: false, next: 'fallback' }
  const text = (data.content ?? [])
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('\n\n')
    .trim()
  if (!text) return { ok: false, next: 'fallback' } // 거절·빈 응답 → 클라이언트 L3 폴백
  return { ok: true, text }
}

export async function onRequestPost(ctx: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = ctx

  // 자격 사다리 = OAuth 체인(등록된 것만, CHAIN 순서) → 레거시 API 키. 전부 없으면 LLM 층 꺼짐.
  const creds: { kind: 'oauth' | 'apikey'; token: string }[] = CHAIN.map((name) => ({
    kind: 'oauth' as const,
    token: ((env as Record<string, string | undefined>)[`CLAUDE_CODE_OAUTH_TOKEN_${name}`] ?? '').trim(),
  })).filter((c) => c.token)
  if (env.ANTHROPIC_API_KEY) creds.push({ kind: 'apikey', token: env.ANTHROPIC_API_KEY })
  if (!creds.length) return json({ fallback: true }, 503)

  let raw: string
  try {
    raw = await request.text()
  } catch {
    return json({ error: 'unreadable body' }, 400)
  }
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json({ error: 'payload too large' }, 400)

  let body: DosaRequest
  try {
    body = JSON.parse(raw) as DosaRequest
  } catch {
    return json({ error: 'invalid JSON' }, 400)
  }
  // 주제 선택(화이트리스트) **또는** 자유 질문 — 둘 중 하나는 있어야 한다.
  // 자유 질문은 임의 문자열이라 길이만 자르고 그대로 넘긴다(시스템 프롬프트가 범위를 잡는다).
  const freeQ = typeof body.question === 'string' ? body.question.trim() : ''
  const okTopic = typeof body.topic === 'string' && TOPIC_WHITELIST.includes(body.topic)
  if (!okTopic && !(freeQ && freeQ.length <= MAX_QUESTION)) {
    return json({ error: 'invalid topic' }, 400)
  }
  const modelCfg = MODELS[typeof body.model === 'string' && body.model in MODELS ? body.model : DEFAULT_MODEL_KEY]

  try {
    for (const cred of creds) {
      const r = await callOnce(cred, modelCfg, body)
      if (r.ok) return json({ text: r.text })
      if (r.next === 'fallback') return json({ fallback: true }, 502)
      // rotate = 다음 자격으로 계속
    }
    return json({ fallback: true }, 502) // 체인 소진 → 클라이언트 L3 폴백
  } catch {
    return json({ fallback: true }, 502)
  }
}
