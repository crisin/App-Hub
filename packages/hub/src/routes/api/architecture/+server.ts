import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { buildArchitectureGraph } from '$lib/server/architecture'

/** GET /api/architecture — return architecture graph JSON */
export const GET: RequestHandler = async () => {
  const graph = buildArchitectureGraph()
  return json({ ok: true, data: graph })
}
