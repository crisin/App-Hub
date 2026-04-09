import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import type { DbBranchReviewRow, DbProjectRow } from '$lib/server/db'
import {
  mergeBranch,
  checkoutBranch,
  removeWorktree,
  getCurrentBranch,
} from '$lib/server/git-worktree'
import { logger } from '$lib/server/logger'
import path from 'node:path'

const PROJECT_ROOT = path.resolve(process.cwd(), '..', '..')

function resolveRepoRoot(scope: string): string {
  if (!scope || scope === 'hub') return PROJECT_ROOT
  const projectPath = path.join(PROJECT_ROOT, 'projects', scope)
  const templatePath = path.join(PROJECT_ROOT, 'templates', scope)
  const db = getDb()
  const project = db.prepare('SELECT path FROM projects WHERE slug = ?').get(scope) as Pick<DbProjectRow, 'path'> | undefined
  if (project?.path) return project.path
  const fs = require('node:fs')
  if (fs.existsSync(projectPath)) return projectPath
  if (fs.existsSync(templatePath)) return templatePath
  return PROJECT_ROOT
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

  // Merge
  const result = mergeBranch(repoRoot, branchName)

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
  const maxPos = db
    .prepare("SELECT COALESCE(MAX(position), -1) as max FROM items WHERE stage = 'done'")
    .get() as { max: number }

  db.prepare(
    `UPDATE items SET stage = 'done', position = @position, updated = @now WHERE id = @id`,
  ).run({ position: maxPos.max + 1, now, id: review.issue_id })

  logger.info('claude', 'branch.merged', `Merged branch ${branchName} into ${review.base_branch}`, {
    branch: branchName,
    issueId: review.issue_id,
    baseBranch: review.base_branch,
  })

  return json({ ok: true })
}
