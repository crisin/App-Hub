import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import type { DbBranchReviewRow } from '$lib/server/db'
import {
  mergeBranch,
  checkoutBranch,
  removeWorktree,
  getCurrentBranch,
} from '$lib/server/git-worktree'
import { logger } from '$lib/server/logger'
import { moveItem } from '$lib/server/data'
import { afterItemsChanged } from '$lib/server/item-hooks'
import { resolveProjectScope } from '$lib/server/scanner'
import { HUB_ROOT } from '$lib/server/config'

/** Repo a review belongs to — falls back to the hub repo for unknown scopes */
function resolveRepoRoot(scope: string): string {
  return resolveProjectScope(scope)?.cwd ?? HUB_ROOT
}

/** POST /api/branches/[branch]/merge — merge branch into base */
export const POST: RequestHandler = async ({ params }) => {
  const db = getDb()
  const branchName = decodeURIComponent(params.branch)

  const review = db
    .prepare('SELECT * FROM branch_reviews WHERE branch_name = @branch AND status = @status')
    .get({ branch: branchName, status: 'pending' }) as DbBranchReviewRow | undefined

  if (!review) {
    return error(404, 'Pending branch review not found')
  }

  const repoRoot = resolveRepoRoot(review.project_scope)

  // Ensure we're on the base branch
  const currentBranch = getCurrentBranch(repoRoot)
  if (currentBranch !== review.base_branch) {
    try {
      checkoutBranch(repoRoot, review.base_branch)
    } catch (err) {
      return json(
        {
          ok: false,
          error: `Failed to checkout ${review.base_branch}: ${err instanceof Error ? err.message : err}`,
        },
        { status: 500 },
      )
    }
  }

  // Merge — the merge commit is a logbook entry tying the branch to its board item
  const item = db
    .prepare('SELECT title FROM items WHERE id = ?')
    .get(review.issue_id) as { title: string } | undefined
  const result = mergeBranch(repoRoot, branchName, {
    subject: `merge(board): ${item?.title ?? branchName}`.slice(0, 100),
    body: [
      `Board item ${review.issue_id}, branch ${branchName}, ${review.commit_count} commit(s).`,
      'Reviewed and merged through the App Hub review lane.',
    ],
  })

  if (!result.success) {
    // Restore original branch if we switched
    if (currentBranch !== review.base_branch) {
      try {
        checkoutBranch(repoRoot, currentBranch)
      } catch {
        /* best effort */
      }
    }
    return json({ ok: false, error: `Merge failed: ${result.error}` }, { status: 409 })
  }

  // Clean up worktree
  try {
    removeWorktree(repoRoot, branchName, true)
  } catch {
    /* best effort cleanup */
  }

  // Update DB
  const now = new Date().toISOString()
  db.prepare(
    `UPDATE branch_reviews SET status = 'merged', merged_at = @now WHERE branch_name = @branch`,
  ).run({ now, branch: branchName })

  // Move issue to done
  moveItem(review.issue_id, { stage: 'done', toEnd: true })
  // done releases items it blocked — let the runner pick up the next one
  afterItemsChanged()

  logger.info('claude', 'branch.merged', `Merged branch ${branchName} into ${review.base_branch}`, {
    branch: branchName,
    issueId: review.issue_id,
    baseBranch: review.base_branch,
  })

  return json({ ok: true })
}
