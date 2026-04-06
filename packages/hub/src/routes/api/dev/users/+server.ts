import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'

/** GET /api/dev/users — list dev users */
export const GET: RequestHandler = async () => {
  const db = getDb()
  const users = db.prepare('SELECT id, email, name, role, created FROM dev_users').all()
  return json({ ok: true, data: users })
}

/** POST /api/dev/users — create a dev user */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const { email, name, role } = body

  if (!email || !name) {
    return json({ ok: false, error: 'email and name are required' }, { status: 400 })
  }

  const db = getDb()
  const id = `dev-user-${Date.now()}`

  try {
    db.prepare('INSERT INTO dev_users (id, email, name, role) VALUES (?, ?, ?, ?)').run(
      id,
      email,
      name,
      role ?? 'user',
    )
    return json({ ok: true, data: { id, email, name, role: role ?? 'user' } }, { status: 201 })
  } catch (err: any) {
    return json({ ok: false, error: err.message }, { status: 400 })
  }
}
