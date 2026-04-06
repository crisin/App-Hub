import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { syncProjects } from '$lib/server/scanner'
import { logger } from '$lib/server/logger'

/** POST /api/sync — re-scan projects directory and sync to SQLite */
export const POST: RequestHandler = async () => {
  const projects = syncProjects()
  logger.info('sync', 'sync.completed', `Synced ${projects.length} projects from disk`, {
    count: projects.length,
  })
  return json({
    ok: true,
    data: {
      synced: projects.length,
      projects: projects.map((p) => ({ slug: p.slug, name: p.name, status: p.status })),
    },
  })
}
