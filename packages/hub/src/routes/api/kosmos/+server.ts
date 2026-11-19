import type { RequestHandler } from './$types'
import { buildKosmosGraph, getKosmosLocation, setKosmosPath } from '$lib/server/kosmos'
import { ok, err } from '$lib/server/response'
import { logger } from '$lib/server/logger'

/** GET /api/kosmos — where kosmos lives on this machine and what the map finds there */
export const GET: RequestHandler = async () => {
  const location = getKosmosLocation()
  return ok({ location, stats: location.exists ? buildKosmosGraph(location).stats : null })
}

/**
 * PUT /api/kosmos — set the kosmos path for this machine.
 * Body: { path } — a vault or a bare werkstatt clone; null or '' removes it.
 * Stored in apphub.local.json. The hub only ever reads from that folder.
 */
export const PUT: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}))
  const rawPath = typeof body.path === 'string' ? body.path.trim() : ''
  if (getKosmosLocation().source === 'env') {
    return err('APPHUB_KOSMOS_DIR is set — the environment decides the kosmos path', 409)
  }
  try {
    const location = setKosmosPath(rawPath || null)
    logger.info('system', 'kosmos.path_set', rawPath ? `kosmos path set to ${location.path}` : 'kosmos path removed')
    return ok({ location, stats: location.exists ? buildKosmosGraph(location).stats : null })
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e))
  }
}
