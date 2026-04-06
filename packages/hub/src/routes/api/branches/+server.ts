import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'

/** GET /api/branches — list branch reviews */
export const GET: RequestHandler = async ({ url }) => {
  const db = getDb()
  const status = url.searchParams.get('status') || 'pending'

  const rows = db
    .prepare(
      `SELECT br.*, bi.title as issue_title, bi.priority as issue_priority, bi.labels as issue_labels
       FROM branch_reviews br
       JOIN board_issues bi ON br.issue_id = bi.id
       WHERE br.status = @status
       ORDER BY br.created DESC`,
    )
    .all({ status }) as any[]

  const branches = rows.map((r) => ({
    ...r,
    issue_labels: JSON.parse(r.issue_labels || '[]'),
  }))

  return json({ ok: true, data: { branches } })
}
