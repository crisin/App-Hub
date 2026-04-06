import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { logger } from '$lib/server/logger'

/** POST /api/board/claude/claim — claim an issue from the Claude lane */
export const POST: RequestHandler = async ({ request }) => {
  const { id, agent_id } = await request.json()

  if (!id) {
    return json({ ok: false, error: 'id is required' }, { status: 400 })
  }

  const db = getDb()
  const now = new Date().toISOString()
  const assignee = agent_id ?? 'claude-code'

  // Atomic claim: only succeeds if the issue is still unclaimed and in the claude lane
  const result = db
    .prepare(
      `
    UPDATE board_issues
    SET assigned_to = @assignee, lane = 'in_progress', updated = @now
    WHERE id = @id AND lane = 'claude' AND (assigned_to = '' OR assigned_to IS NULL)
  `,
    )
    .run({ id, assignee, now })

  if (result.changes === 0) {
    return json(
      { ok: false, error: 'Issue not found, already claimed, or not in Claude lane' },
      { status: 409 },
    )
  }

  const issue = db.prepare('SELECT * FROM board_issues WHERE id = ?').get(id) as any
  issue.labels = JSON.parse(issue.labels || '[]')

  logger.info('claude', 'issue.claimed', `Issue "${issue.title}" claimed by ${assignee}`, {
    issueId: id,
    assignee,
    title: issue.title,
  })

  return json({ ok: true, data: issue })
}
