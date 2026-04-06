import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { autoTriggerIfNeeded, emitBoardChanged } from '$lib/server/claude-runner'
import { logger } from '$lib/server/logger'

/** PATCH /api/board/reorder — bulk reorder items (used by drag-and-drop) */
export const PATCH: RequestHandler = async ({ request }) => {
  const { moves } = await request.json()

  if (!Array.isArray(moves) || moves.length === 0) {
    return json({ ok: false, error: 'moves array is required' }, { status: 400 })
  }

  const db = getDb()
  const now = new Date().toISOString()

  // Accept either 'lane' or 'stage' field in moves
  const update = db.prepare(
    'UPDATE items SET stage = @stage, position = @position, updated = @updated WHERE id = @id',
  )

  const transaction = db.transaction(() => {
    for (const move of moves) {
      if (!move.id || move.position === undefined) continue
      const stage = move.stage || move.lane
      if (!stage) continue
      update.run({ id: move.id, stage, position: move.position, updated: now })
    }
  })

  transaction()

  const stagesInMoves = [...new Set(moves.map((m: any) => m.stage || m.lane))]
  logger.debug('board', 'item.reorder', `Reordered ${moves.length} items`, {
    moveCount: moves.length,
    stages: stagesInMoves,
  })

  // Auto-trigger Claude runner if any item was moved to the claude stage
  const hasClaudeMove = stagesInMoves.includes('claude')
  if (hasClaudeMove) {
    autoTriggerIfNeeded()
  }

  emitBoardChanged()
  return json({ ok: true })
}
