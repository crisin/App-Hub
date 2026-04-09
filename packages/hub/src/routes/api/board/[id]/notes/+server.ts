import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { listNotes, addClaudeNote } from '$lib/server/data'
import { logger } from '$lib/server/logger'

const VALID_TYPES = ['progress', 'commit', 'error', 'info'] as const

/** GET /api/board/:id/notes — list all notes for an issue */
export const GET: RequestHandler = async ({ params }) => {
  const notes = listNotes(params.id)
  return json({ ok: true, data: notes })
}

/** POST /api/board/:id/notes — add a note to an issue */
export const POST: RequestHandler = async ({ params, request }) => {
  const db = getDb()

  // Verify issue exists
  const issue = db.prepare('SELECT id, title FROM items WHERE id = ?').get(params.id) as any
  if (!issue) {
    return json({ ok: false, error: 'Issue not found' }, { status: 404 })
  }

  const body = await request.json()
  const { message, type } = body

  if (!message?.trim()) {
    return json({ ok: false, error: 'message is required' }, { status: 400 })
  }

  const noteType = type && VALID_TYPES.includes(type) ? type : 'progress'
  const trimmed = message.trim()

  addClaudeNote(params.id, noteType as any, trimmed)

  logger.info('claude', 'note.added', `Note on "${issue.title}": ${trimmed.slice(0, 80)}`, {
    issueId: params.id,
    type: noteType,
  })

  // Return the latest notes
  const notes = listNotes(params.id)
  const latest = notes[notes.length - 1]
  return json({ ok: true, data: latest }, { status: 201 })
}
