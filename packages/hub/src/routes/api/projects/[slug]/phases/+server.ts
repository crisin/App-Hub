import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { listPhases, createPhase, reorderPhases } from '$lib/server/data'

/** GET /api/projects/:slug/phases — list phases for a project */
export const GET: RequestHandler = async ({ params }) => {
  const db = getDb()
  const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(params.slug)
  if (!project) {
    return json({ ok: false, error: 'Project not found' }, { status: 404 })
  }

  const phases = listPhases(params.slug)
  return json({ ok: true, data: phases })
}

/** POST /api/projects/:slug/phases — create a phase or reorder phases */
export const POST: RequestHandler = async ({ params, request }) => {
  const db = getDb()
  const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(params.slug)
  if (!project) {
    return json({ ok: false, error: 'Project not found' }, { status: 404 })
  }

  const body = await request.json()

  // Reorder mode: { reorder: [{ id, position }] }
  if (body.reorder && Array.isArray(body.reorder)) {
    reorderPhases(body.reorder)
    const phases = listPhases(params.slug)
    return json({ ok: true, data: phases })
  }

  // Create mode
  const { name, status, target_date } = body
  if (!name?.trim()) {
    return json({ ok: false, error: 'name is required' }, { status: 400 })
  }

  const phase = createPhase({
    project_slug: params.slug,
    name: name.trim(),
    status,
    target_date,
  })

  return json({ ok: true, data: phase }, { status: 201 })
}
