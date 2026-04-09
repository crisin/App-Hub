import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ITEM_STAGES } from '@apphub/shared'
import { getItemDetail, updateItem, deleteItem } from '$lib/server/data'
import { emitBoardChanged } from '$lib/server/claude-runner'
import { logger } from '$lib/server/logger'

/** GET /api/items/:id — get a single item with full context */
export const GET: RequestHandler = async ({ params }) => {
  const item = getItemDetail(params.id)
  if (!item) {
    return json({ ok: false, error: 'Item not found' }, { status: 404 })
  }
  return json({ ok: true, data: item })
}

/** PATCH /api/items/:id — update an item */
export const PATCH: RequestHandler = async ({ params, request }) => {
  const updates = await request.json()

  // Validate stage if changing
  if (updates.stage && !ITEM_STAGES.includes(updates.stage)) {
    return json({ ok: false, error: `Invalid stage: ${updates.stage}` }, { status: 400 })
  }

  const updated = updateItem(params.id, updates)
  if (!updated) {
    return json({ ok: false, error: 'Item not found' }, { status: 404 })
  }

  logger.info('board', 'item.updated', `Updated "${updated.title}"`, {
    itemId: params.id,
    fields: Object.keys(updates),
    stage: updated.stage,
  })

  emitBoardChanged()
  return json({ ok: true, data: updated })
}

/** DELETE /api/items/:id — delete an item and its dependencies */
export const DELETE: RequestHandler = async ({ params }) => {
  const deleted = deleteItem(params.id)
  if (!deleted) {
    return json({ ok: false, error: 'Item not found' }, { status: 404 })
  }

  logger.info('board', 'item.deleted', `Deleted item ${params.id}`, { itemId: params.id })

  emitBoardChanged()
  return json({ ok: true, data: { id: params.id } })
}
