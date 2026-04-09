import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import type { DbItemRow } from '$lib/server/db'
import { logger } from '$lib/server/logger'

/** POST /api/board/claude/claim — claim an item from the Claude stage */
export const POST: RequestHandler = async ({ request }) => {
  const { id, agent_id } = await request.json()

  if (!id) {
    return json({ ok: false, error: 'id is required' }, { status: 400 })
  }

  const db = getDb()
  const now = new Date().toISOString()
  const assignee = agent_id ?? 'claude-code'

  // Atomic claim: only succeeds if the item is still unclaimed and in the claude stage
  const result = db
    .prepare(
      `
    UPDATE items
    SET assigned_to = @assignee, stage = 'build', updated = @now
    WHERE id = @id AND stage = 'claude' AND (assigned_to = '' OR assigned_to IS NULL)
  `,
    )
    .run({ id, assignee, now })

  if (result.changes === 0) {
    return json(
      { ok: false, error: 'Item not found, already claimed, or not in Claude stage' },
      { status: 409 },
    )
  }

  const issue = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as DbItemRow
  issue.labels = JSON.parse(issue.labels || '[]')

  logger.info('claude', 'issue.claimed', `Issue "${issue.title}" claimed by ${assignee}`, {
    issueId: id,
    assignee,
    title: issue.title,
  })

  return json({ ok: true, data: issue })
}
