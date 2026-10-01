import type { PageServerLoad } from './$types'
import { getDb } from '$lib/server/db'
import type { DbBranchReviewRow } from '$lib/server/db'
import { error } from '@sveltejs/kit'
import { getBranchDiff, getBranchDiffStat, getBranchCommits } from '$lib/server/git-worktree'
import { resolveProjectScope } from '$lib/server/scanner'
import { HUB_ROOT } from '$lib/server/config'

/** Repo a review belongs to — falls back to the hub repo for unknown scopes */
function resolveRepoRoot(scope: string): string {
  return resolveProjectScope(scope)?.cwd ?? HUB_ROOT
}

export const load: PageServerLoad = async ({ params }) => {
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
    error(404, 'Branch review not found')
  }

  const repoRoot = resolveRepoRoot(review.project_scope)
  const diff = getBranchDiff(repoRoot, branchName, review.base_branch)
  const diffStat = getBranchDiffStat(repoRoot, branchName, review.base_branch)
  const commits = getBranchCommits(repoRoot, branchName, review.base_branch)

  return {
    review: {
      ...review,
      issue_labels: JSON.parse(review.issue_labels || '[]'),
    },
    diff,
    diffStat,
    commits,
  }
}
