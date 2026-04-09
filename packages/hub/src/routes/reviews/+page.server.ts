import type { PageServerLoad } from './$types'
import { getDb } from '$lib/server/db'
import type { DbBranchReviewRow } from '$lib/server/db'

export const load: PageServerLoad = async () => {
  const db = getDb()

  type BranchReviewJoined = DbBranchReviewRow & { issue_title: string; issue_priority: string; issue_labels: string }

  const pending = db
    .prepare(
      `SELECT br.*, bi.title as issue_title, bi.priority as issue_priority, bi.labels as issue_labels
       FROM branch_reviews br
       JOIN items bi ON br.issue_id = bi.id
       WHERE br.status = 'pending'
       ORDER BY br.created DESC`,
    )
    .all() as BranchReviewJoined[]

  const recent = db
    .prepare(
      `SELECT br.*, bi.title as issue_title, bi.priority as issue_priority, bi.labels as issue_labels
       FROM branch_reviews br
       JOIN items bi ON br.issue_id = bi.id
       WHERE br.status IN ('merged', 'discarded')
       ORDER BY COALESCE(br.merged_at, br.discarded_at) DESC
       LIMIT 20`,
    )
    .all() as BranchReviewJoined[]

  const parse = (rows: BranchReviewJoined[]) =>
    rows.map((r) => ({
      ...r,
      issue_labels: JSON.parse(r.issue_labels || '[]'),
    }))

  return {
    pending: parse(pending),
    recent: parse(recent),
  }
}
