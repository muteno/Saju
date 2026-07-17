import { ensureSchema, json, getUser, withErrors } from '../_utils.js'

export const onRequestGet = withErrors(async ({ request, env }) => {
  const db = env.DB
  if (!db) return json({ user: null })
  await ensureSchema(db)
  const user = await getUser(db, request)
  if (!user) return json({ user: null })
  const p = await db.prepare('SELECT data FROM profiles WHERE user_id = ?').bind(user.id).first()
  let profile = null
  if (p) {
    try {
      profile = JSON.parse(p.data)
    } catch {
      profile = null
    }
  }
  return json({ user, profile })
})
