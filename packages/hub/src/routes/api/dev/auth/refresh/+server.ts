import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import crypto from 'node:crypto'
import { signJWT, corsHeaders } from '$lib/server/auth'
import { ACCESS_TTL, REFRESH_TTL } from '$lib/server/constants'

/**
 * POST /api/dev/auth/refresh — exchange a refresh token for a new access + refresh token.
 *
 * Body: { refreshToken: string }
 */

export const OPTIONS: RequestHandler = async ({ request }) =>
  new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) })

export const POST: RequestHandler = async ({ request }) => {
  const origin = request.headers.get('origin')
  const body = await request.json().catch(() => ({}))
  const { refreshToken } = body as { refreshToken?: string }

  if (!refreshToken) {
    return json(
      { ok: false, error: 'refreshToken is required' },
      { status: 400, headers: corsHeaders(origin) },
    )
  }

  const db = getDb()
  const row = db
    .prepare(
      'SELECT rt.*, u.email, u.name, u.role FROM dev_refresh_tokens rt JOIN dev_users u ON u.id = rt.user_id WHERE rt.token = ?',
    )
    .get(refreshToken) as Record<string, string> | undefined

  if (!row) {
    return json(
      { ok: false, error: 'Invalid or expired refresh token' },
      { status: 401, headers: corsHeaders(origin) },
    )
  }

  // Check expiry
  if (new Date(row.expires) < new Date()) {
    db.prepare('DELETE FROM dev_refresh_tokens WHERE id = ?').run(row.id)
    return json(
      { ok: false, error: 'Refresh token expired' },
      { status: 401, headers: corsHeaders(origin) },
    )
  }

  // Rotate: delete old refresh token, issue new ones
  db.prepare('DELETE FROM dev_refresh_tokens WHERE id = ?').run(row.id)

  const accessToken = signJWT({ sub: row.user_id, email: row.email, role: row.role }, ACCESS_TTL)

  const newRefreshToken = crypto.randomBytes(40).toString('hex')
  const refreshExpires = new Date(Date.now() + REFRESH_TTL * 1000).toISOString()
  db.prepare(
    'INSERT INTO dev_refresh_tokens (id, user_id, token, expires) VALUES (?, ?, ?, ?)',
  ).run(`rt-${Date.now()}`, row.user_id, newRefreshToken, refreshExpires)

  return json(
    {
      ok: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: ACCESS_TTL,
        tokenType: 'Bearer',
      },
    },
    { headers: corsHeaders(origin) },
  )
}
