// Cloudflare Pages Functions 공용 유틸 (순수 JS)
// D1 바인딩 이름 = DB (env.DB). 스키마는 첫 호출 시 자동 생성(IF NOT EXISTS).

export async function ensureSchema(db) {
  // 테이블 접두어 saju_ — 이 D1(muteno_saju_db)은 다른 앱(MANSE·GLASS)과 공유되며
  // 그쪽 users/sessions/profiles 와 충돌하지 않도록 네임스페이스를 둔다.
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS saju_users (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       email TEXT UNIQUE NOT NULL,
       password_hash TEXT NOT NULL,
       name TEXT,
       created_at INTEGER NOT NULL
     )`,
  ).run()
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS saju_sessions (
       token TEXT PRIMARY KEY,
       user_id INTEGER NOT NULL,
       expires_at INTEGER NOT NULL
     )`,
  ).run()
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS saju_profiles (
       user_id INTEGER PRIMARY KEY,
       data TEXT NOT NULL,
       updated_at INTEGER NOT NULL
     )`,
  ).run()
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })
}

// 핸들러 예외를 원시 1101 대신 JSON으로 노출. ?debug=1 이면 스택까지.
export function withErrors(handler) {
  return async (ctx) => {
    try {
      return await handler(ctx)
    } catch (err) {
      const debug = new URL(ctx.request.url).searchParams.get('debug')
      const detail = String((err && err.stack) || err)
      return json({ error: '서버 오류가 났어요', ...(debug ? { detail } : {}) }, 500)
    }
  }
}

const enc = new TextEncoder()
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
function fromHex(hex) {
  const a = new Uint8Array(hex.length / 2)
  for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16)
  return a
}

// PBKDF2(SHA-256, 100k) — Web Crypto. 저장형식 "salt:hash"
export async function hashPassword(password, saltHex) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256)
  return `${toHex(salt)}:${toHex(bits)}`
}
export async function verifyPassword(password, stored) {
  const [saltHex] = (stored || '').split(':')
  if (!saltHex) return false
  const again = await hashPassword(password, saltHex)
  return again === stored
}

const SESSION_DAYS = 30
export function randomToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}
export async function createSession(db, userId) {
  const token = randomToken()
  const expires = Date.now() + SESSION_DAYS * 864e5
  await db.prepare('INSERT INTO saju_sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, userId, expires).run()
  return token
}
export function sessionCookie(token) {
  return `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`
}
export function clearCookie() {
  return 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
}
export function getCookie(request, name) {
  const c = request.headers.get('Cookie') || ''
  const m = c.match(new RegExp('(?:^|; )' + name + '=([^;]+)'))
  return m ? m[1] : null
}
export async function getUser(db, request) {
  const token = getCookie(request, 'session')
  if (!token) return null
  const s = await db.prepare('SELECT user_id, expires_at FROM saju_sessions WHERE token = ?').bind(token).first()
  if (!s || s.expires_at < Date.now()) return null
  return await db.prepare('SELECT id, email, name FROM saju_users WHERE id = ?').bind(s.user_id).first()
}
export const normalizeEmail = (e) => (e || '').trim().toLowerCase()
