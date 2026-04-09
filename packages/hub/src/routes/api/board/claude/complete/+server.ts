import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import type { DbItemRow } from '$lib/server/db'
import { logger } from '$lib/server/logger'

/** POST /api/board/claude/complete — mark an issue as done */
export const POST: RequestHandler = async ({ request }) => {
  const { id } = await request.json()

  if (!id) {
    return json({ ok: false, error: 'id is required' }, { status: 400 })
  }

  const db = getDb()
  const now = new Date().toISOString()

  // Get next position in done stage
  const maxPos = db
    .prepare("SELECT COALESCE(MAX(position), -1) as max FROM items WHERE stage = 'done'")
    .get() as { max: number }

  const result = db
    .prepare(
      `
    UPDATE items
    SET stage = 'done', assigned_to = '', position = @position, updated = @now
    WHERE id = @id
  `,
    )
    .run({ id, position: maxPos.max + 1, now })

  if (result.changes === 0) {
    return json({ ok: false, error: 'Issue not found' }, { status: 404 })
  }

  const issue = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as DbItemRow
  issue.labels = JSON.parse(issue.labels || '[]')

  logger.info('claude', 'issue.completed', `Issue "${issue.title}" marked as done`, {
    issueId: id,
    title: issue.title,
  })

  return json({ ok: true, data: issue })
}
