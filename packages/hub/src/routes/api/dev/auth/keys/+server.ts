import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { generateApiKey, hashApiKey, verifyJWT, corsHeaders } from '$lib/server/auth'

/**
 * API Key management for service-to-service auth.
 *
 * GET    /api/dev/auth/keys           — list keys for the authenticated user
 * POST   /api/dev/auth/keys           — create a new API key (returns plaintext key once)
 * DELETE /api/dev/auth/keys           — revoke a key by id
 *
 * All routes require Bearer token (JWT) in Authorization header.
 */

function getUser(request: Request): { id: string; role: string } | null {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const payload = verifyJWT(auth.slice(7))
  if (!payload) return null
  return { id: payload.sub as string, role: payload.role as string }
}

export const OPTIONS: RequestHandler = async ({ request }) =>
  new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) })

export const GET: RequestHandler = async ({ request }) => {
  const origin = request.headers.get('origin')
  const user = getUser(request)
  if (!user) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders(origin) })
  }

  const db = getDb()
  // Admin can list all keys; regular users see only their own
  const keys =
    user.role === 'admin'
      ? db
          .prepare(
            'SELECT id, user_id, name, prefix, created, last_used FROM dev_api_keys ORDER BY created DESC',
          )
          .all()
      : db
          .prepare(
            'SELECT id, user_id, name, prefix, created, last_used FROM dev_api_keys WHERE user_id = ? ORDER BY created DESC',
          )
          .all(user.id)

  return json({ ok: true, data: keys }, { headers: corsHeaders(origin) })
}

export const POST: RequestHandler = async ({ request }) => {
  const origin = request.headers.get('origin')
  const user = getUser(request)
  if (!user) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders(origin) })
  }

  const body = await request.json().catch(() => ({}))
  const { name, userId } = body as { name?: string; userId?: string }

  if (!name) {
    return json(
      { ok: false, error: 'name is required' },
      { status: 400, headers: corsHeaders(origin) },
    )
  }

  // Admin can create keys for other users; others create for themselves
  const targetUserId = user.role === 'admin' && userId ? userId : user.id

  const { key, prefix } = generateApiKey()
  const keyHash = hashApiKey(key)
  const id = `key-${Date.now()}`

  const db = getDb()
  db.prepare(
    'INSERT INTO dev_api_keys (id, user_id, name, key_hash, prefix) VALUES (?, ?, ?, ?, ?)',
  ).run(id, targetUserId, name, keyHash, prefix)

  return json(
    {
      ok: true,
      data: {
        id,
        name,
        key, // shown once — caller must store this
        prefix,
        userId: targetUserId,
        created: new Date().toISOString(),
      },
    },
    { status: 201, headers: corsHeaders(origin) },
  )
}

export const DELETE: RequestHandler = async ({ request }) => {
  const origin = request.headers.get('origin')
  const user = getUser(request)
  if (!user) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401, headers: corsHeaders(origin) })
  }

  const body = await request.json().catch(() => ({}))
  const { id } = body as { id?: string }
  if (!id) {
    return json(
      { ok: false, error: 'id is required' },
      { status: 400, headers: corsHeaders(origin) },
    )
  }

  const db = getDb()
  // Only owner or admin can revoke
  const key = db.prepare('SELECT * FROM dev_api_keys WHERE id = ?').get(id) as
    | Record<string, string>
    | undefined
  if (!key) {
    return json(
      { ok: false, error: 'Key not found' },
      { status: 404, headers: corsHeaders(origin) },
    )
  }
  if (key.user_id !== user.id && user.role !== 'admin') {
    return json({ ok: false, error: 'Forbidden' }, { status: 403, headers: corsHeaders(origin) })
  }

  db.prepare('DELETE FROM dev_api_keys WHERE id = ?').run(id)
  return json({ ok: true }, { headers: corsHeaders(origin) })
}
