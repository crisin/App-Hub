import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { autoTriggerIfNeeded, emitBoardChanged } from '$lib/server/claude-runner'
import { logger } from '$lib/server/logger'
import fs from 'node:fs'
import path from 'node:path'

const ATTACHMENTS_DIR = path.join(process.cwd(), 'data', 'attachments')

/** GET /api/board/:id — get a single item */
export const GET: RequestHandler = async ({ params }) => {
  const db = getDb()
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(params.id) as any

  if (!item) {
    return json({ ok: false, error: 'Item not found' }, { status: 404 })
  }

  item.labels = JSON.parse(item.labels || '[]')
  item.attachments = db
    .prepare('SELECT * FROM issue_attachments WHERE issue_id = ? ORDER BY created ASC')
    .all(params.id)
  item.notes = db
    .prepare('SELECT * FROM claude_notes WHERE issue_id = ? ORDER BY created ASC')
    .all(params.id)

  // Load dependencies
  item.blocked_by = db
    .prepare(
      `SELECT d.*, i.title as depends_on_title, i.stage as depends_on_stage, i.project_slug as depends_on_project
       FROM item_dependencies d
       JOIN items i ON d.depends_on_id = i.id
       WHERE d.item_id = ?
       ORDER BY d.created ASC`,
    )
    .all(params.id)

  item.blocks = db
    .prepare(
      `SELECT d.*, i.title as item_title, i.stage as item_stage
       FROM item_dependencies d
       JOIN items i ON d.item_id = i.id
       WHERE d.depends_on_id = ?
       ORDER BY d.created ASC`,
    )
    .all(params.id)

  return json({ ok: true, data: item })
}

/** PATCH /api/board/:id — update an item */
export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = getDb()
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(params.id) as any

  if (!item) {
    return json({ ok: false, error: 'Item not found' }, { status: 404 })
  }

  const updates = await request.json()
  const now = new Date().toISOString()

  // Map legacy field names
  if (updates.lane && !updates.stage) {
    updates.stage = updates.lane
    delete updates.lane
  }
  if (updates.project_scope && !updates.project_slug) {
    updates.project_slug = updates.project_scope
    delete updates.project_scope
  }

  const allowedFields = [
    'title',
    'description',
    'stage',
    'priority',
    'labels',
    'position',
    'assigned_to',
    'project_slug',
    'item_type',
    'parent_id',
  ]
  const fields = Object.keys(updates).filter((k) => allowedFields.includes(k))

  if (fields.length === 0) {
    return json({ ok: false, error: 'No valid fields to update' }, { status: 400 })
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

  if (updates.stage === 'claude') {
    autoTriggerIfNeeded()
  }

  return json({ ok: true, data: updated })
}

/** DELETE /api/board/:id — delete an item */
export const DELETE: RequestHandler = async ({ params }) => {
  const db = getDb()
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(params.id) as any

  if (!item) {
    return json({ ok: false, error: 'Item not found' }, { status: 404 })
  }

  // Clean up attachment files from disk
  const itemDir = path.join(ATTACHMENTS_DIR, params.id)
  if (fs.existsSync(itemDir)) {
    fs.rmSync(itemDir, { recursive: true })
  }

  // Delete dependencies, then the item
  db.prepare('DELETE FROM item_dependencies WHERE item_id = ? OR depends_on_id = ?').run(
    params.id,
    params.id,
  )
  db.prepare('DELETE FROM items WHERE id = ?').run(params.id)

  logger.info('board', 'item.deleted', `Deleted "${item.title}"`, { itemId: params.id })

  emitBoardChanged()
  return json({ ok: true, data: { id: params.id } })
}
