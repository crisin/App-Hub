import type { PageServerLoad } from './$types'
import { getDb } from '$lib/server/db'
import { error } from '@sveltejs/kit'
import { getBranchDiff, getBranchDiffStat, getBranchCommits } from '$lib/server/git-worktree'
import path from 'node:path'
import fs from 'node:fs'

const PROJECT_ROOT = path.resolve(process.cwd(), '..', '..')

function resolveRepoRoot(scope: string): string {
  if (!scope || scope === 'hub') return PROJECT_ROOT
  const projectPath = path.join(PROJECT_ROOT, 'projects', scope)
  const templatePath = path.join(PROJECT_ROOT, 'templates', scope)
  const db = getDb()
  const project = db.prepare('SELECT path FROM projects WHERE slug = ?').get(scope) as any
  if (project?.path) return project.path
  if (fs.existsSync(projectPath)) return projectPath
  if (fs.existsSync(templatePath)) return templatePath
  return PROJECT_ROOT
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
    .get({ branch: branchName }) as any

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
