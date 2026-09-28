/** Only the visible, recent part of one topic/chef/profile conversation. No storage. */
export interface ConversationMessage {
  role: 'assistant' | 'user'
  text: string
}
export interface ConversationContext {
  version: 1
  topic?: string
  messages: ConversationMessage[]
}
export const MAX_CONVERSATION_MESSAGES = 12
export const MAX_CONVERSATION_TEXT = 2000
export const MAX_CONVERSATION_TOTAL = 8000
const TOPICS = ['성격', '올해', '직업', '관계', '주의']

/** The server rejects malformed/oversized history, rather than cutting a negation or a question. */
export function parseConversationContext(value: unknown): ConversationContext | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const v = value as Record<string, unknown>
  if (v.version !== 1 || !Array.isArray(v.messages) || !v.messages.length ||
    v.messages.length > MAX_CONVERSATION_MESSAGES ||
    (v.topic !== undefined && (typeof v.topic !== 'string' || !TOPICS.includes(v.topic)))) return undefined
  const messages: ConversationMessage[] = []
  let total = 0
  for (const message of v.messages) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return undefined
    const m = message as Record<string, unknown>
    if ((m.role !== 'assistant' && m.role !== 'user') || typeof m.text !== 'string' ||
      !m.text.trim() || m.text.length > MAX_CONVERSATION_TEXT) return undefined
    total += m.text.length
    if (total > MAX_CONVERSATION_TOTAL) return undefined
    messages.push({ role: m.role, text: m.text })
  }
  return { version: 1, ...(typeof v.topic === 'string' ? { topic: v.topic } : {}), messages }
}

/** Take a contiguous suffix of complete visible messages; never send queued or partial text. */
export function recentConversation(messages: readonly ConversationMessage[], topic?: string): ConversationContext | undefined {
  const selected: ConversationMessage[] = []
  let total = 0
  for (let i = messages.length - 1; i >= 0 && selected.length < MAX_CONVERSATION_MESSAGES; i--) {
    const m = messages[i]
    if (!m.text.trim()) continue
    if (m.text.length > MAX_CONVERSATION_TEXT || total + m.text.length > MAX_CONVERSATION_TOTAL) break
    selected.unshift({ role: m.role, text: m.text })
    total += m.text.length
  }
  return parseConversationContext({ version: 1, ...(topic ? { topic } : {}), messages: selected })
}
