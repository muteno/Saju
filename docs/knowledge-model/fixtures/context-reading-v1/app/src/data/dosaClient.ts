import { basicSentenceMatches, safeBasicSentenceParagraphs, BASIC_SENTENCE_NOTICE, UNREVIEWED_ILJU_NOTICE, GAPIN_SENTENCE_NOTICE } from '../engine/vendor/basicSentences.js'
import { chartSummaryOf, topicLines, type DosaLine } from './dosaTopics'
import type { ReportBundle } from '../engine'
import { withoutCitationLines } from './readingPresentation'
import { hasUnknownBirthTime, UNKNOWN_BIRTH_TIME_NOTICE } from '../engine/birthTime'

/** 상담 화면과 통신을 분리한다. 엔진 재구축 시 ReportBundle 경계만 교체한다. */
export async function requestDosaText(options: {
  topic: string
  report: ReportBundle
  lines: DosaLine[]
  chefId: string
  model: string
  profileName?: string
  hourUnknown?: boolean
  question?: string
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<string | null> {
  if (options.signal?.aborted) return null
  // No personal grounding is verified yet: do not send stale caller-supplied lines to the provider.
  if (hasUnknownBirthTime(options.report, options.hourUnknown)) return UNKNOWN_BIRTH_TIME_NOTICE
  // Rebuild ilju grounding from the report before pairing statements: old cached
  // lines may carry a withheld neighbour or a unit bibliography as sentence evidence.
  const hasIlju = options.report.sections.some(section => section.id === 'ilju')
  const candidates = hasIlju ? topicLines(options.report, options.topic, options.hourUnknown) : options.lines
  const safeLines = candidates.flatMap(line => safeBasicSentenceParagraphs(line.text)
    .map(text => ({ ...line, text })))
  let held = candidates.some(line => basicSentenceMatches(line.text).length > 0)
  // A stale caller can divide one sentence between separate ground entries.
  if (basicSentenceMatches(safeLines.map(line => line.text).join('\n\n')).length) {
    safeLines.length = 0
    held = true
  }
  if (held && !safeLines.some(line => line.text === BASIC_SENTENCE_NOTICE)) safeLines.push({ text: BASIC_SENTENCE_NOTICE })
  const notices = [BASIC_SENTENCE_NOTICE, UNREVIEWED_ILJU_NOTICE, GAPIN_SENTENCE_NOTICE]
    .filter(note => safeLines.some(line => line.text === note))
  const ctrl = new AbortController()
  const abort = () => ctrl.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) ctrl.abort()
  const timer = setTimeout(abort, options.timeoutMs ?? 20000)
  try {
    if (ctrl.signal.aborted) return null
    const res = await fetch('/api/dosa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        topic: options.topic,
        model: options.model,
        chefId: options.chefId,
        chartSummary: chartSummaryOf(options.report, options.hourUnknown),
        grounds: safeLines.map((line) => ({ text: line.text, grounds: line.grounds ?? [] })),
        ...(options.profileName ? { profileName: options.profileName } : {}),
        ...(options.question ? { question: options.question } : {}),
      }),
      signal: ctrl.signal,
    })
    if (!res.ok || ctrl.signal.aborted) return null
    const data: unknown = await res.json()
    const text = (data as { text?: unknown } | null)?.text
    if (ctrl.signal.aborted || typeof text !== 'string' || !text.trim() || basicSentenceMatches(text).length) return null
    // App-owned review status remains visible on success, cache hits and free questions.
    const presented = withoutCitationLines(text)
    if (!presented || basicSentenceMatches(presented).length) return null
    return [...notices.filter(note => !presented.includes(note)), presented].join('\n\n')
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', abort)
  }
}

/** 한글 조합 확정 Enter와 Shift+Enter는 전송이 아니다. */
export function shouldSendOnEnter(event: { key: string; shiftKey: boolean; isComposing?: boolean; keyCode?: number }): boolean {
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229
}
