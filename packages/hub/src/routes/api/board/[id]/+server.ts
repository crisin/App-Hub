import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { autoTriggerIfNeeded } from '$lib/server/claude-runner'
import { logger } from '$lib/server/logger'
import fs from 'node:fs'
import path from 'node:path'

const ATTACHMENTS_DIR = path.join(process.cwd(), 'data', 'attachments')

/** GET /api/board/:id — get a single issue */
export const GET: RequestHandler = async ({ params }) => {
  const db = getDb()
  const issue = db.prepare('SELECT * FROM board_issues WHERE id = ?').get(params.id) as any

  if (!issue) {
    return json({ ok: false, error: 'Issue not found' }, { status: 404 })
  }

  issue.labels = JSON.parse(issue.labels || '[]')
  issue.attachments = db
    .prepare('SELECT * FROM issue_attachments WHERE issue_id = ? ORDER BY created ASC')
    .all(params.id)
  return json({ ok: true, data: issue })
}

/** PATCH /api/board/:id — update an issue */
export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = getDb()
  const issue = db.prepare('SELECT * FROM board_issues WHERE id = ?').get(params.id) as any

  if (!issue) {
    return json({ ok: false, error: 'Issue not found' }, { status: 404 })
  }

  const updates = await request.json()
  const now = new Date().toISOString()

  const allowedFields = [
    'title',
    'description',
    'lane',
    'priority',
    'labels',
    'position',
    'assigned_to',
    'project_scope',
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

  db.prepare(`UPDATE board_issues SET ${setClause}, updated = @updated WHERE id = @id`).run(data)

  const updated = db.prepare('SELECT * FROM board_issues WHERE id = ?').get(params.id) as any
  updated.labels = JSON.parse(updated.labels || '[]')

  logger.info('board', 'issue.updated', `Updated issue "${updated.title}"`, {
    issueId: params.id,
    fields: fields,
    lane: updated.lane,
  })

  // Auto-trigger Claude runner if issue was moved to the claude lane
  if (updates.lane === 'claude') {
    autoTriggerIfNeeded()
  }

  return json({ ok: true, data: updated })
}

/** DELETE /api/board/:id — delete an issue */
export const DELETE: RequestHandler = async ({ params }) => {
  const db = getDb()
  const issue = db.prepare('SELECT * FROM board_issues WHERE id = ?').get(params.id) as any

  if (!issue) {
    return json({ ok: false, error: 'Issue not found' }, { status: 404 })
  }

  // Clean up attachment files from disk
  const issueDir = path.join(ATTACHMENTS_DIR, params.id)
  if (fs.existsSync(issueDir)) {
    fs.rmSync(issueDir, { recursive: true })
  }

  db.prepare('DELETE FROM board_issues WHERE id = ?').run(params.id)

  logger.info('board', 'issue.deleted', `Deleted issue "${issue.title}"`, { issueId: params.id })

  return json({ ok: true, data: { id: params.id } })
}
