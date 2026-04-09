import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getPhase, updatePhase, deletePhase, listPhases } from '$lib/server/data'

/** PATCH /api/projects/:slug/phases/:id — update a phase */
export const PATCH: RequestHandler = async ({ params, request }) => {
  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.status !== undefined) updates.status = body.status
  if (body.target_date !== undefined) updates.target_date = body.target_date
  if (body.position !== undefined) updates.position = body.position

  if (Object.keys(updates).length === 0) {
    return json({ ok: false, error: 'No updates provided' }, { status: 400 })
  }

  const phase = updatePhase(params.id, updates as Partial<{ name: string; status: string; target_date: string | null; position: number }>)
  if (!phase) {
    return json({ ok: false, error: 'Phase not found' }, { status: 404 })
  }

  return json({ ok: true, data: phase })
}

/** DELETE /api/projects/:slug/phases/:id — delete a phase */
export const DELETE: RequestHandler = async ({ params }) => {
  const existing = getPhase(params.id)
  if (!existing) {
    return json({ ok: false, error: 'Phase not found' }, { status: 404 })
  }

  deletePhase(params.id)

  // Return remaining phases
  const phases = listPhases(params.slug)
  return json({ ok: true, data: phases })
}
