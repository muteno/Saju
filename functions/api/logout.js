import { json, getCookie, clearCookie } from '../_utils.js'

export async function onRequestPost({ request, env }) {
  const token = getCookie(request, 'session')
  if (token && env.DB) {
    try {
      await env.DB.prepare('DELETE FROM saju_sessions WHERE token = ?').bind(token).run()
    } catch {
      /* noop */
    }
  }
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() })
}
