import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { autoTriggerIfNeeded, emitBoardChanged } from '$lib/server/claude-runner'
import { logger } from '$lib/server/logger'

/** PATCH /api/board/reorder — bulk reorder issues (used by drag-and-drop) */
export const PATCH: RequestHandler = async ({ request }) => {
  const { moves } = await request.json()

  if (!Array.isArray(moves) || moves.length === 0) {
    return json({ ok: false, error: 'moves array is required' }, { status: 400 })
  }

  const db = getDb()
  const now = new Date().toISOString()

  const update = db.prepare(
    'UPDATE board_issues SET lane = @lane, position = @position, updated = @updated WHERE id = @id',
  )

  const transaction = db.transaction(() => {
    for (const move of moves) {
      if (!move.id || move.lane === undefined || move.position === undefined) continue
      update.run({ id: move.id, lane: move.lane, position: move.position, updated: now })
    }
  })

  transaction()

  logger.debug('board', 'issue.reorder', `Reordered ${moves.length} issues`, {
    moveCount: moves.length,
    lanes: [...new Set(moves.map((m: any) => m.lane))],
  })

  // Auto-trigger Claude runner if any issue was moved to the claude lane
  const hasClaudeMove = moves.some((m: any) => m.lane === 'claude')
  if (hasClaudeMove) {
    autoTriggerIfNeeded()
  }

  emitBoardChanged()
  return json({ ok: true })
}
