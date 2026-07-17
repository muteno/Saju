import { ensureSchema, json, hashPassword, createSession, sessionCookie, normalizeEmail, withErrors } from '../_utils.js'

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
  const name = (body.name || '').trim() || null

  if (!email || !email.includes('@')) return json({ error: '이메일을 확인해주세요' }, 400)
  if (password.length < 8) return json({ error: '비밀번호는 8자 이상이어야 해요' }, 400)

  const exists = await db.prepare('SELECT id FROM saju_users WHERE email = ?').bind(email).first()
  if (exists) return json({ error: '이미 가입된 이메일이에요' }, 409)

  const password_hash = await hashPassword(password)
  const res = await db
    .prepare('INSERT INTO saju_users (email, password_hash, name, created_at) VALUES (?, ?, ?, ?)')
    .bind(email, password_hash, name, Date.now())
    .run()
  const userId = res.meta.last_row_id
  const token = await createSession(db, userId)
  return json({ user: { id: userId, email, name } }, 200, { 'Set-Cookie': sessionCookie(token) })
})
