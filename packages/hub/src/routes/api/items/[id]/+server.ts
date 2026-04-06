import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { ITEM_STAGES } from '@apphub/shared'
import { emitBoardChanged } from '$lib/server/claude-runner'
import { logger } from '$lib/server/logger'

/** GET /api/items/:id — get a single item with notes + attachments */
export const GET: RequestHandler = async ({ params }) => {
  const db = getDb()
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(params.id) as any

  if (!item) {
    return json({ ok: false, error: 'Item not found' }, { status: 404 })
  }

  item.labels = JSON.parse(item.labels || '[]')

  // Load attachments
  item.attachments = db
    .prepare('SELECT * FROM issue_attachments WHERE issue_id = ? ORDER BY created ASC')
    .all(params.id)

  // Load notes
  item.notes = db
    .prepare('SELECT * FROM claude_notes WHERE issue_id = ? ORDER BY created ASC')
    .all(params.id)

  // Load children
  item.children = (
    db.prepare('SELECT * FROM items WHERE parent_id = ? ORDER BY position ASC').all(params.id) as any[]
  ).map((c) => ({ ...c, labels: JSON.parse(c.labels || '[]') }))

  return json({ ok: true, data: item })
}

/** PATCH /api/items/:id — update an item */
export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = getDb()
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(params.id) as any

  if (!item) {
    return json({ ok: false, error: 'Item not found' }, { status: 404 })
  }

  const updates = await request.json()
  const now = new Date().toISOString()

  const allowedFields = [
    'title',
    'description',
    'stage',
    'priority',
    'labels',
    'position',
    'assigned_to',
    'parent_id',
    'item_type',
    'project_slug',
  ]
  const fields = Object.keys(updates).filter((k) => allowedFields.includes(k))

  if (fields.length === 0) {
    return json({ ok: false, error: 'No valid fields to update' }, { status: 400 })
  }

  // Validate stage if changing
  if (updates.stage && !ITEM_STAGES.includes(updates.stage)) {
    return json({ ok: false, error: `Invalid stage: ${updates.stage}` }, { status: 400 })
  }

  const setClause = fields.map((k) => `${k} = @${k}`).join(', ')
  const data: any = { ...updates, id: params.id, updated: now }

  if (data.labels && Array.isArray(data.labels)) {
    data.labels = JSON.stringify(data.labels)
  }

  db.prepare(`UPDATE items SET ${setClause}, updated = @updated WHERE id = @id`).run(data)

  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(params.id) as any
  updated.labels = JSON.parse(updated.labels || '[]')

  logger.info('board', 'item.updated', `Updated "${updated.title}"`, {
    itemId: params.id,
    fields,
    stage: updated.stage,
  })

  emitBoardChanged()
  return json({ ok: true, data: updated })
}

/** DELETE /api/items/:id — delete an item and its children */
export const DELETE: RequestHandler = async ({ params }) => {
  const db = getDb()
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(params.id) as any

  if (!item) {
    return json({ ok: false, error: 'Item not found' }, { status: 404 })
  }

  // Delete children first
  db.prepare('DELETE FROM items WHERE parent_id = ?').run(params.id)
  // Delete the item
  db.prepare('DELETE FROM items WHERE id = ?').run(params.id)

  logger.info('board', 'item.deleted', `Deleted "${item.title}"`, { itemId: params.id })

  emitBoardChanged()
  return json({ ok: true, data: { id: params.id } })
}
