import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import type { DbItemRow } from '$lib/server/db'
import { logger } from '$lib/server/logger'
import { afterItemsChanged } from '$lib/server/item-hooks'
import { moveItem } from '$lib/server/data'

/** POST /api/board/claude/complete — mark an issue as done */
export const POST: RequestHandler = async ({ request }) => {
  const { id } = await request.json()

  if (!id) {
    return json({ ok: false, error: 'id is required' }, { status: 400 })
  }

  const db = getDb()

  if (!moveItem(id, { stage: 'done', assigned_to: '', toEnd: true })) {
    return json({ ok: false, error: 'Issue not found' }, { status: 404 })
  }

  const issue = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as DbItemRow
  issue.labels = JSON.parse(issue.labels || '[]')

  logger.info('claude', 'issue.completed', `Issue "${issue.title}" marked as done`, {
    issueId: id,
    title: issue.title,
  })

  afterItemsChanged()
  return json({ ok: true, data: issue })
}
