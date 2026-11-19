import type { RequestHandler } from './$types'
import { getKosmosPage } from '$lib/server/kosmos'
import { ok, err } from '$lib/server/response'

/** GET /api/kosmos/page?id=<path> — one kosmos page the map may read, rendered as HTML */
export const GET: RequestHandler = async ({ url }) => {
  const id = url.searchParams.get('id') ?? ''
  if (!id) return err('id is required')
  const page = getKosmosPage(id)
  if (!page) return err(`No kosmos page "${id}"`, 404)
  return ok(page)
}
