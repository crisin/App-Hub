import type { RequestHandler } from './$types'
import { buildKosmosGraph, getKosmosLocation } from '$lib/server/kosmos'
import { ok, err } from '$lib/server/response'

/** GET /api/kosmos/graph — projects, pages, topics and building blocks as nodes and edges */
export const GET: RequestHandler = async () => {
  const location = getKosmosLocation()
  if (!location.path) return err('No kosmos path configured — PUT /api/kosmos { path }', 404)
  if (!location.exists) return err(`kosmos path does not exist: ${location.path}`, 404)
  return ok(buildKosmosGraph(location))
}
