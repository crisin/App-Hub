import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import type { DbBranchReviewRow } from '$lib/server/db'
import {
  getBranchDiff,
  getBranchDiffStat,
  getBranchCommits,
  removeWorktree,
} from '$lib/server/git-worktree'
import { logger } from '$lib/server/logger'
import { resolveProjectScope } from '$lib/server/scanner'
import { HUB_ROOT } from '$lib/server/config'

/** Repo a review belongs to — falls back to the hub repo for unknown scopes */
function resolveRepoRoot(scope: string): string {
  return resolveProjectScope(scope)?.cwd ?? HUB_ROOT
}

/** GET /api/branches/[branch] — get diff + commits for a branch */
export const GET: RequestHandler = async ({ params }) => {
  const db = getDb()
  const branchName = decodeURIComponent(params.branch)

  const review = db
    .prepare(
      `SELECT br.*, bi.title as issue_title, bi.priority as issue_priority, bi.labels as issue_labels
       FROM branch_reviews br
       JOIN items bi ON br.issue_id = bi.id
       WHERE br.branch_name = @branch`,
    )
    .get({ branch: branchName }) as (DbBranchReviewRow & { issue_title: string; issue_priority: string; issue_labels: string }) | undefined

  if (!review) {
    return error(404, 'Branch review not found')
  }

  const repoRoot = resolveRepoRoot(review.project_scope)
  const diff = getBranchDiff(repoRoot, branchName, review.base_branch)
  const diffStat = getBranchDiffStat(repoRoot, branchName, review.base_branch)
  const commits = getBranchCommits(repoRoot, branchName, review.base_branch)

  return json({
    ok: true,
    data: {
      review: {
        ...review,
        issue_labels: JSON.parse(review.issue_labels || '[]'),
      },
      diff,
      diffStat,
      commits,
    },
  })
}

/** DELETE /api/branches/[branch] — discard a branch */
export const DELETE: RequestHandler = async ({ params }) => {
  const db = getDb()
  const branchName = decodeURIComponent(params.branch)

  const review = db
    .prepare('SELECT * FROM branch_reviews WHERE branch_name = @branch AND status = @status')
    .get({ branch: branchName, status: 'pending' }) as DbBranchReviewRow | undefined

  if (!review) {
    return error(404, 'Pending branch review not found')
  }

  const repoRoot = resolveRepoRoot(review.project_scope)

  try {
    removeWorktree(repoRoot, branchName, true)
  } catch (err) {
    logger.warn('claude', 'branch.discard_cleanup', `Worktree cleanup warning: ${err}`, {
      branch: branchName,
    })
  }

  const now = new Date().toISOString()
  db.prepare(
    `UPDATE branch_reviews SET status = 'discarded', discarded_at = @now WHERE branch_name = @branch`,
  ).run({ now, branch: branchName })

  // Move issue back to backlog
  db.prepare(`UPDATE items SET stage = 'idea', updated = @now WHERE id = @id`).run({
    now,
    id: review.issue_id,
  })

  logger.info('claude', 'branch.discarded', `Discarded branch ${branchName}`, {
    branch: branchName,
    issueId: review.issue_id,
  })

  return json({ ok: true })
}
