import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import crypto from 'node:crypto'
import { signJWT, verifyJWT, verifyPassword, hashApiKey, corsHeaders } from '$lib/server/auth'
import { logger } from '$lib/server/logger'

/**
 * Central Auth API — spawned projects authenticate here.
 *
 * POST   /api/dev/auth            — login (email + password) → JWT + refresh token
 * GET    /api/dev/auth            — verify Bearer token (JWT or API key) → user
 * DELETE /api/dev/auth            — logout (revoke refresh token)
 * OPTIONS /api/dev/auth           — CORS preflight
 */

const ACCESS_TTL = 60 * 60 // 1 hour (seconds)
const REFRESH_TTL = 7 * 24 * 60 * 60 // 7 days (seconds)

// ─── OPTIONS (CORS preflight) ─────────────────────────────────────────────────

export const OPTIONS: RequestHandler = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  })
}

// ─── POST — login ─────────────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request }) => {
  const origin = request.headers.get('origin')
  const body = await request.json().catch(() => ({}))
  const { email, password } = body as { email?: string; password?: string }

  if (!email) {
    return json(
      { ok: false, error: 'email is required' },
      { status: 400, headers: corsHeaders(origin) },
    )
  }

  const db = getDb()
  let user = db.prepare('SELECT * FROM dev_users WHERE email = ?').get(email) as
    | Record<string, string>
    | undefined

  if (!user) {
    // Auto-create dev users on first login (dev convenience)
    const id = `dev-user-${Date.now()}`
    db.prepare('INSERT INTO dev_users (id, email, name, role) VALUES (?, ?, ?, ?)').run(
      id,
      email,
      email.split('@')[0],
      'user',
    )
    user = db.prepare('SELECT * FROM dev_users WHERE id = ?').get(id) as Record<string, string>
  }

  // Password check: if the user has a hash stored, verify it.
  // If no hash is set (dev mode / auto-created), any password is accepted.
  if (user.password_hash) {
    const valid = await verifyPassword(password ?? '', user.password_hash)
    if (!valid) {
      return json(
        { ok: false, error: 'Invalid credentials' },
        { status: 401, headers: corsHeaders(origin) },
      )
    }
  }

  const accessToken = signJWT({ sub: user.id, email: user.email, role: user.role }, ACCESS_TTL)

  // Refresh token: opaque random string stored in DB
  const refreshToken = crypto.randomBytes(40).toString('hex')
  const refreshExpires = new Date(Date.now() + REFRESH_TTL * 1000).toISOString()
  db.prepare(
    'INSERT INTO dev_refresh_tokens (id, user_id, token, expires) VALUES (?, ?, ?, ?)',
  ).run(`rt-${Date.now()}`, user.id, refreshToken, refreshExpires)

  logger.info('auth', 'auth.login', `User "${user.email}" logged in`, {
    userId: user.id,
    email: user.email,
  })

  return json(
    {
      ok: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TTL,
        tokenType: 'Bearer',
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      },
    },
    { headers: corsHeaders(origin) },
  )
}

// ─── GET — verify token ───────────────────────────────────────────────────────

export const GET: RequestHandler = async ({ request }) => {
  const origin = request.headers.get('origin')
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return json(
      { ok: false, error: 'Missing or invalid Authorization header' },
      { status: 401, headers: corsHeaders(origin) },
    )
  }

  const token = authHeader.slice(7)
  const db = getDb()

  // Try JWT first
  const payload = verifyJWT(token)
  if (payload) {
    const user = db
      .prepare('SELECT id, email, name, role FROM dev_users WHERE id = ?')
      .get(payload.sub) as Record<string, string> | undefined
    if (!user) {
      return json(
        { ok: false, error: 'User not found' },
        { status: 404, headers: corsHeaders(origin) },
      )
    }
    return json({ ok: true, data: user }, { headers: corsHeaders(origin) })
  }

  // Try API key (prefix apphub_)
  if (token.startsWith('apphub_')) {
    const keyHash = hashApiKey(token)
    const row = db
      .prepare(
        'SELECT k.*, u.email, u.name, u.role FROM dev_api_keys k JOIN dev_users u ON u.id = k.user_id WHERE k.key_hash = ?',
      )
      .get(keyHash) as Record<string, string> | undefined

    if (row) {
      // Update last_used
      db.prepare("UPDATE dev_api_keys SET last_used = datetime('now') WHERE id = ?").run(row.id)
      return json(
        {
          ok: true,
          data: { id: row.user_id, email: row.email, name: row.name, role: row.role },
        },
        { headers: corsHeaders(origin) },
      )
    }
  }

  return json(
    { ok: false, error: 'Token invalid or expired' },
    { status: 401, headers: corsHeaders(origin) },
  )
}

// ─── DELETE — logout ──────────────────────────────────────────────────────────

export const DELETE: RequestHandler = async ({ request }) => {
  const origin = request.headers.get('origin')
  const body = await request.json().catch(() => ({}))
  const { refreshToken } = body as { refreshToken?: string }

  if (refreshToken) {
    getDb().prepare('DELETE FROM dev_refresh_tokens WHERE token = ?').run(refreshToken)
  }

  return json({ ok: true }, { headers: corsHeaders(origin) })
}
