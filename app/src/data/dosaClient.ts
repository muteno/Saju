import { basicSentenceMatches, safeBasicSentenceParagraphs, BASIC_SENTENCE_NOTICE, UNREVIEWED_ILJU_NOTICE, GAPIN_SENTENCE_NOTICE } from '../engine/vendor/basicSentences.js'
import { chartSummaryOf, topicLines, type DosaLine } from './dosaTopics'
import type { ReportBundle } from '../engine'
import { withoutCitationLines } from './readingPresentation'
import { hasUnknownBirthTime, UNKNOWN_BIRTH_TIME_NOTICE } from '../engine/birthTime'
import { resolveWorkFeedback, ownedFeedbackPrompts } from '../engine/vendor/workFeedback.js'
import { CONTEXT_READING_NOTICE, type ContextReading } from '../engine/vendor/contextReading.js'
import { parseConversationContext, type ConversationContext, type ConversationMessage } from './conversationContext'

/** The chat's own menu line after a reading; it may sit between a shown question and its answer. */
export const MENU_PROMPT = '또 궁금한 것이 있는가?'
/** Local feedback replay may look further back than the provider history (never sent). */
export const MAX_FEEDBACK_MESSAGES = 40

/** The comparison the reading shows and asks about: the stem–stem decision first, else the
 * stem–branch rooting decision. Kept here (not in the engine) so an older pinned engine still runs. */
export function activeWorkDecision(context: Pick<ContextReading, 'decision'> & { rootingDecision?: ContextReading['rootingDecision'] } | null | undefined) {
  if (context?.decision?.active) return context.decision
  return context?.rootingDecision?.active ? context.rootingDecision : context?.decision ?? null
}

/** Calculation limits belong to the app and survive a generated/late answer. */
export function readingNotices(report: ReportBundle, lines: DosaLine[]): string[] {
  if (hasUnknownBirthTime(report)) return []
  const notices = [BASIC_SENTENCE_NOTICE, UNREVIEWED_ILJU_NOTICE, GAPIN_SENTENCE_NOTICE]
    .filter(note => lines.some(line => line.text === note))
  if (report.sections.some(s => s.id === 'context-reading' && s.lines?.includes(CONTEXT_READING_NOTICE)))
    notices.push(CONTEXT_READING_NOTICE)
  const roots = report.sections.find(s => s.id === 'context-reading')?.context?.strength?.roots
  if (roots) notices.push(roots.facts)
  const relation = report.sections.find(s => s.id === 'context-reading')?.context?.monthDayChung
  if (relation?.status === 'present' && relation.facts) notices.push(relation.facts)
  const yukhap = report.sections.find(s => s.id === 'context-reading')?.context?.monthDayYukhap
  const compound = report.sections.find(s => s.id === 'context-reading')?.context?.monthDayCompound
  const yukhapReading = compound?.status === 'present' ? compound : yukhap
  if (yukhapReading?.status === 'present' && yukhapReading.facts) notices.push(yukhapReading.facts)
  const hyeong = report.sections.find(s => s.id === 'context-reading')?.context?.monthDayHyeong
  if (hyeong?.status === 'present' && hyeong.facts) notices.push(hyeong.facts)
  const decision = activeWorkDecision(report.sections.find(s => s.id === 'context-reading')?.context)
  if (decision?.active && decision.question && lines.some(line => line.text === decision.question?.prompt))
    notices.push(...decision.lines)
  return notices
}

/** Questions are a follow-up to a reading, never its preface. */
export function readingFollowups(report: ReportBundle, lines: DosaLine[]): string[] {
  if (hasUnknownBirthTime(report)) return []
  const context = report.sections.find(s => s.id === 'context-reading')?.context
  if (!context?.experienceQuestions?.some(q => lines.some(line => line.text === q.prompt))) return []
  return context.blocks.find(block => block.label === '경험으로 확인할 부분')?.lines ?? []
}

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
  conversation?: ConversationContext
  /** Visible messages of the same scope, only for the local feedback replay. */
  feedbackMessages?: ConversationMessage[]
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
  const notices = readingNotices(options.report, safeLines)
  const parsed = options.question ? parseConversationContext(options.conversation) : undefined
  // Prior model words are conversation, not a new route around withheld readings.
  const conversation = parsed && !basicSentenceMatches(parsed.messages.filter(m => m.role === 'assistant').map(m => m.text).join('\n\n')).length ? parsed : undefined
  const decision = activeWorkDecision(options.report.sections.find(s => s.id === 'context-reading')?.context)
  if (decision?.question && conversation?.topic === '직업') {
    // Replays the shown owned question and every local answer after it; any other
    // assistant text (menu, provider reply, partly shown reply) leaves this to chat.
    const footer = options.report.sections.find(s => s.id === 'context-reading')?.context?.blocks
      .find(block => block.label === '경험으로 확인할 부분')?.lines.at(-1) ?? ''
    const local = Array.isArray(options.feedbackMessages) ? options.feedbackMessages.slice(-MAX_FEEDBACK_MESSAGES) : conversation.messages
    const feedback = resolveWorkFeedback({ decision, footer, messages: local, answer: options.question, menuPrompts: [MENU_PROMPT] })
    if (feedback) return feedback.text
  }
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
        ...(conversation ? { conversation } : {}),
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
    const followups = readingFollowups(options.report, safeLines)
    // A provider may copy a question into an early paragraph or combine it with
    // narration. Normalize our exact owned lines before the UI splits sentences.
    // A free answer must not re-ask the app's own feedback question as if it were new.
    const reasked = options.question ? ownedFeedbackPrompts(decision) : []
    const owned = [...notices, ...followups, ...reasked].flatMap(line => [line, ...line.split(/(?<=[.?!…])\s+/)])
    const body = owned.reduce((text, line) => text.replaceAll(line, ''), presented).trim()
    // A complete owned observation can itself answer a free question.
    // Do not turn an exact (possibly paragraph-split) valid answer into failure.
    const completeNotice = notices.some(note => note.split(/(?<=[.?!…])\s+/).every(clause => presented.includes(clause)))
    if (!body && !completeNotice) return null
    return [...notices.filter(note => !body.includes(note)), body, ...followups].join('\n\n')
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
