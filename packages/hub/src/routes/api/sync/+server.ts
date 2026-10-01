import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { syncProjects } from '$lib/server/scanner'
import { importBoards } from '$lib/server/board-files'
import { emitBoardChanged } from '$lib/server/claude-runner'
import { logger } from '$lib/server/logger'

/**
 * POST /api/sync — re-index everything from disk: project metadata
 * (.apphub.md), then board files (.apphub/items, .apphub/phases.md).
 * Run it after a git pull or after editing board files by hand.
 */
export const POST: RequestHandler = async () => {
  const projects = syncProjects()
  const board = importBoards()
  emitBoardChanged()
  logger.info('sync', 'sync.completed', `Synced ${projects.length} projects from disk`, {
    count: projects.length,
    board,
  })
  return json({
    ok: true,
    data: {
      synced: projects.length,
      projects: projects.map((p) => ({ slug: p.slug, name: p.name, status: p.status })),
      board,
    },
  })
}
