import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { randomUUID } from 'node:crypto'
import { logger } from '$lib/server/logger'

const VALID_TYPES = ['progress', 'commit', 'error', 'info']

/** GET /api/board/:id/notes — list all notes for an issue */
export const GET: RequestHandler = async ({ params }) => {
  const db = getDb()
  const notes = db
    .prepare('SELECT * FROM claude_notes WHERE issue_id = ? ORDER BY created ASC')
    .all(params.id)

  return json({ ok: true, data: notes })
}

/** POST /api/board/:id/notes — add a note to an issue */
export const POST: RequestHandler = async ({ params, request }) => {
  const db = getDb()

  // Verify issue exists
  const issue = db.prepare('SELECT id, title FROM board_issues WHERE id = ?').get(params.id) as any
  if (!issue) {
    return json({ ok: false, error: 'Issue not found' }, { status: 404 })
  }

  const body = await request.json()
  const { message, type } = body

  if (!message?.trim()) {
    return json({ ok: false, error: 'message is required' }, { status: 400 })
  }

  const noteType = type && VALID_TYPES.includes(type) ? type : 'progress'
  const trimmed = message.trim().slice(0, 200)

  const id = `note-${randomUUID().slice(0, 8)}`
  const now = new Date().toISOString()

  db.prepare(
    `
    INSERT INTO claude_notes (id, issue_id, type, message, created)
    VALUES (@id, @issue_id, @type, @message, @created)
  `,
  ).run({ id, issue_id: params.id, type: noteType, message: trimmed, created: now })

  logger.info('claude', 'note.added', `Note on "${issue.title}": ${trimmed.slice(0, 80)}`, {
    issueId: params.id,
    noteId: id,
    type: noteType,
  })

  const note = db.prepare('SELECT * FROM claude_notes WHERE id = ?').get(id)
  return json({ ok: true, data: note }, { status: 201 })
}
