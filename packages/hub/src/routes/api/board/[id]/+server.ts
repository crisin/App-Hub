import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getItemDetail, updateItem, deleteItem } from '$lib/server/data'
import { afterItemsChanged } from '$lib/server/item-hooks'
import { ITEM_STAGES } from '@apphub/shared'
import { logger } from '$lib/server/logger'
import fs from 'node:fs'
import path from 'node:path'
import { ATTACHMENTS_DIR } from '$lib/server/constants'

/** GET /api/board/:id — get a single item with full context */
export const GET: RequestHandler = async ({ params }) => {
  const item = getItemDetail(params.id)
  if (!item) {
    return json({ ok: false, error: 'Item not found' }, { status: 404 })
  }
  return json({ ok: true, data: item })
}

/** PATCH /api/board/:id — update an item */
export const PATCH: RequestHandler = async ({ params, request }) => {
  const updates = await request.json()

  // Validate stage if changing (same rule as /api/items/:id)
  if (updates.stage && !ITEM_STAGES.includes(updates.stage)) {
    return json({ ok: false, error: `Invalid stage: ${updates.stage}` }, { status: 400 })
  }

  // Map legacy field name
  if (updates.project_scope && !updates.project_slug) {
    updates.project_slug = updates.project_scope
    delete updates.project_scope
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

  afterItemsChanged()
  return json({ ok: true, data: updated })
}

/** DELETE /api/board/:id — delete an item */
export const DELETE: RequestHandler = async ({ params }) => {
  // Clean up attachment files from disk before deleting
  const itemDir = path.join(ATTACHMENTS_DIR, params.id)
  if (fs.existsSync(itemDir)) {
    fs.rmSync(itemDir, { recursive: true })
  }

  const deleted = deleteItem(params.id)
  if (!deleted) {
    return json({ ok: false, error: 'Item not found' }, { status: 404 })
  }

  logger.info('board', 'item.deleted', `Deleted item ${params.id}`, { itemId: params.id })

  afterItemsChanged()
  return json({ ok: true, data: { id: params.id } })
}
