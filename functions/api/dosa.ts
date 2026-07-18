// Cloudflare Pages Function — POST /api/dosa
// L4 도사 대화층 프록시(dosa-app/README.md): 키는 서버측 환경변수, 클라이언트 노출 금지.
// LLM은 서술층일 뿐 — 미설정·실패 시 {fallback:true}를 돌려주고 클라이언트는 L3 조립 대사로 완결 동작한다.
// @cloudflare/workers-types 미설치 — 전역 타입 import 없이 로컬 타입만 사용(런타임 전역 Request/Response/fetch).

interface Env {
  ANTHROPIC_API_KEY?: string
  DOSA_MODEL?: string
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
  chartSummary?: string
  grounds?: GroundLine[]
  profileName?: string
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

const MAX_BODY_BYTES = 64 * 1024
const MAX_GROUND_LINES = 40
const MAX_GROUND_TEXT = 2000

// 도사 페르소나 + L4 서술 표준 6원칙(사용자 확정 원문, dosa-app/README.md 2026-07-16) + 근거 밖 주장 금지.
const SYSTEM_PROMPT = `당신은 '아이샤' — 따뜻하고 담백한 존댓말을 쓰는 사주 도사입니다. 미연시풍 대화 화면에서 사용자의 사주를 풀이합니다.

서술 표준 6원칙(반드시 지킬 것):
1. 일상어 풀이가 본문 — 전문용어는 비유·생활어로 번역 (예: 일지 = '나의 안방')
2. 생활 장면으로 번역 — 언제, 어떤 상황에서, 어떻게 나타나는지
3. 시기 구체화 — '유년'이 아니라 '2029년 기유년' (엔진이 환산)
4. 완충 요인과 대처까지 — "그래서 어떻게 하면 되는지"에 반드시 답할 것
5. 단락 끝에 ▸근거줄: 전문용어 + 출처(보드/문헌/엔진) 병기
6. 단정 금지 — 경향 표현("~하기 쉽습니다", "패턴이 반복될 수 있습니다")

절대 규칙: 아래 '근거 자료' 밖의 주장은 절대 하지 마라. 근거에 없으면 "소장 문헌에 없다"고 말하라.
답변은 2~4개 문단으로, 문단 사이는 빈 줄로 구분한다.`

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
    `질문 주제: ${body.topic}`,
    '',
    '[사주 요약]',
    chartSummary || '(요약 없음)',
    '',
    '[근거 자료]',
    groundText || '(근거 자료 없음 — 이 경우 "소장 문헌에 없다"고 답할 것)',
  ].join('\n')
}

export async function onRequestPost(ctx: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = ctx

  // 키 미설정 = LLM 층 꺼짐 — 클라이언트는 L3 폴백으로 완결 동작
  if (!env.ANTHROPIC_API_KEY) return json({ fallback: true }, 503)

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
  if (typeof body.topic !== 'string' || !TOPIC_WHITELIST.includes(body.topic)) {
    return json({ error: 'invalid topic' }, 400)
  }

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: env.DOSA_MODEL ?? 'claude-sonnet-5',
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserMessage(body) }],
      }),
    })
    if (!apiRes.ok) return json({ fallback: true }, 502)

    const data = (await apiRes.json()) as AnthropicResponse
    const text = (data.content ?? [])
      .filter((b) => b?.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('\n\n')
      .trim()
    if (!text) return json({ fallback: true }, 502) // 거절·빈 응답 → 클라이언트 L3 폴백

    return json({ text })
  } catch {
    return json({ fallback: true }, 502)
  }
}
