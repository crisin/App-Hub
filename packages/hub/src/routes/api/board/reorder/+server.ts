import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { reorderItems } from '$lib/server/data'
import { autoTriggerIfNeeded, emitBoardChanged } from '$lib/server/claude-runner'
import { logger } from '$lib/server/logger'

/** PATCH /api/board/reorder — bulk reorder items (used by drag-and-drop) */
export const PATCH: RequestHandler = async ({ request }) => {
  const { moves } = await request.json()

  if (!Array.isArray(moves) || moves.length === 0) {
    return json({ ok: false, error: 'moves array is required' }, { status: 400 })
  }

  const normalized = moves
    .filter((m: any) => m.id && m.position !== undefined && m.stage)
    .map((m: any) => ({
      id: m.id,
      stage: m.stage,
      position: m.position,
    }))

  reorderItems(normalized)

  const stagesInMoves = [...new Set(normalized.map((m) => m.stage))]
  logger.debug('board', 'item.reorder', `Reordered ${normalized.length} items`, {
    moveCount: normalized.length,
    stages: stagesInMoves,
  })

  if (stagesInMoves.includes('claude')) {
    autoTriggerIfNeeded()
  }

  emitBoardChanged()
  return json({ ok: true })
}
