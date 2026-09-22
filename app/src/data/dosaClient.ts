import { chartSummaryOf, type DosaLine } from './dosaTopics'
import type { ReportBundle } from '../engine'

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
        grounds: options.lines.map((line) => ({ text: line.text, grounds: line.grounds ?? [] })),
        ...(options.profileName ? { profileName: options.profileName } : {}),
        ...(options.question ? { question: options.question } : {}),
      }),
      signal: ctrl.signal,
    })
    if (!res.ok || ctrl.signal.aborted) return null
    const data: unknown = await res.json()
    const text = (data as { text?: unknown } | null)?.text
    return !ctrl.signal.aborted && typeof text === 'string' && text.trim() ? text.trim() : null
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
