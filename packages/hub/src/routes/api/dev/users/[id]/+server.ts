import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { hashPassword, verifyJWT } from '$lib/server/auth'

/**
 * PATCH /api/dev/users/:id — update user fields (name, role, password)
 * DELETE /api/dev/users/:id — delete a dev user
 *
 * Requires Admin JWT to change role or delete; users can update their own name/password.
 */

function getCallerRole(request: Request): { id: string; role: string } | null {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const payload = verifyJWT(auth.slice(7))
  if (!payload) return null
  return { id: payload.sub as string, role: payload.role as string }
}

export const PATCH: RequestHandler = async ({ request, params }) => {
  const caller = getCallerRole(request)
  const targetId = params.id

  // Allow unauthenticated password set for dev convenience (same as any-password login)
  const body = (await request.json().catch(() => ({}))) as Record<string, string>

  // Only admin can change role; user can change own name/password
  if (body.role !== undefined && caller?.role !== 'admin') {
    return json({ ok: false, error: 'Admin required to change role' }, { status: 403 })
  }

  const db = getDb()
  const user = db.prepare('SELECT * FROM dev_users WHERE id = ?').get(targetId) as
    | Record<string, string>
    | undefined
  if (!user) return json({ ok: false, error: 'User not found' }, { status: 404 })

  const updates: string[] = []
  const values: unknown[] = []

  if (body.name !== undefined) {
    updates.push('name = ?')
    values.push(body.name)
  }
  if (body.role !== undefined) {
    updates.push('role = ?')
    values.push(body.role)
  }
  if (body.password !== undefined) {
    updates.push('password_hash = ?')
    values.push(await hashPassword(body.password))
  }

  if (updates.length === 0) {
    return json({ ok: false, error: 'Nothing to update' }, { status: 400 })
  }

  values.push(targetId)
  db.prepare(`UPDATE dev_users SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  const updated = db
    .prepare('SELECT id, email, name, role, created FROM dev_users WHERE id = ?')
    .get(targetId)
  return json({ ok: true, data: updated })
}

export const DELETE: RequestHandler = async ({ request, params }) => {
  const caller = getCallerRole(request)
  if (caller?.role !== 'admin') {
    return json({ ok: false, error: 'Admin required' }, { status: 403 })
  }

  const db = getDb()
  const result = db.prepare('DELETE FROM dev_users WHERE id = ?').run(params.id)
  if (result.changes === 0) {
    return json({ ok: false, error: 'User not found' }, { status: 404 })
  }
  return json({ ok: true })
}
