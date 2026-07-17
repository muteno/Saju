import { ensureSchema, json, getUser, withErrors } from '../_utils.js'

// 출생 정보(프로필) 저장 — 로그인 필요
export const onRequestPost = withErrors(async ({ request, env }) => {
  const db = env.DB
  if (!db) return json({ error: '서버 DB 미설정' }, 500)
  await ensureSchema(db)
  const user = await getUser(db, request)
  if (!user) return json({ error: '로그인이 필요해요' }, 401)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: '잘못된 요청' }, 400)
  }
  const data = JSON.stringify(body.profile || {})
  await db
    .prepare(
      `INSERT INTO saju_profiles (user_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    )
    .bind(user.id, data, Date.now())
    .run()
  return json({ ok: true })
})
