import type { PageServerLoad } from './$types'
import { getDb } from '$lib/server/db'

export const load: PageServerLoad = async () => {
  const db = getDb()

  const pending = db
    .prepare(
      `SELECT br.*, bi.title as issue_title, bi.priority as issue_priority, bi.labels as issue_labels
       FROM branch_reviews br
       JOIN board_issues bi ON br.issue_id = bi.id
       WHERE br.status = 'pending'
       ORDER BY br.created DESC`,
    )
    .all() as any[]

  const recent = db
    .prepare(
      `SELECT br.*, bi.title as issue_title, bi.priority as issue_priority, bi.labels as issue_labels
       FROM branch_reviews br
       JOIN board_issues bi ON br.issue_id = bi.id
       WHERE br.status IN ('merged', 'discarded')
       ORDER BY COALESCE(br.merged_at, br.discarded_at) DESC
       LIMIT 20`,
    )
    .all() as any[]

  const parse = (rows: any[]) =>
    rows.map((r) => ({
      ...r,
      issue_labels: JSON.parse(r.issue_labels || '[]'),
    }))

  return {
    pending: parse(pending),
    recent: parse(recent),
  }
}
