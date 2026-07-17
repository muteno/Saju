import { ensureSchema, json, verifyPassword, createSession, sessionCookie, normalizeEmail, withErrors } from '../_utils.js'

export const onRequestPost = withErrors(async ({ request, env }) => {
  const db = env.DB
  if (!db) return json({ error: '서버 DB 미설정' }, 500)
  await ensureSchema(db)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: '잘못된 요청' }, 400)
  }
  const email = normalizeEmail(body.email)
  const password = body.password || ''

  const u = await db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?').bind(email).first()
  if (!u || !(await verifyPassword(password, u.password_hash))) {
    return json({ error: '이메일 또는 비밀번호가 달라요' }, 401)
  }
  const token = await createSession(db, u.id)
  return json({ user: { id: u.id, email: u.email, name: u.name } }, 200, { 'Set-Cookie': sessionCookie(token) })
})
