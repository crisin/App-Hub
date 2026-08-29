/**
 * Git Worktree helpers — manages isolated working directories for Claude branches.
 *
 * Each issue gets its own worktree + branch so Claude can commit freely
 * without affecting the main working directory.
 */
import { execSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { execEnv } from './exec-utils.js'

const WORKTREE_DIR = '.worktrees'

/** Run a git command in a repo, returning trimmed stdout */
function git(repoRoot: string, args: string): string {
  return execSync(`git ${args}`, {
    cwd: repoRoot,
    encoding: 'utf-8',
    timeout: 30000,
    env: execEnv(),
  }).trim()
}

/** Check if a directory is a git repo */
export function isGitRepo(dir: string): boolean {
  try {
    git(dir, 'rev-parse --git-dir')
    return true
  } catch {
    return false
  }
}

/** Get the current branch name */
export function getCurrentBranch(repoRoot: string): string {
  return git(repoRoot, 'rev-parse --abbrev-ref HEAD')
}

/** Generate a safe branch name from issue id + title */
export function branchNameFromIssue(issueId: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const shortId = issueId.slice(0, 8)
  return `claude/${shortId}-${slug}`
}

/** node_modules locations to mirror into a worktree (root + workspace packages) */
function nodeModulesPaths(root: string): string[] {
  const rels = ['node_modules']
  const pkgs = path.join(root, 'packages')
  if (fs.existsSync(pkgs)) {
    try {
      for (const entry of fs.readdirSync(pkgs, { withFileTypes: true })) {
        if (entry.isDirectory()) rels.push(path.join('packages', entry.name, 'node_modules'))
      }
    } catch {
      /* ignore */
    }
  }
  return rels
}

/**
 * Link the main checkout's node_modules into a worktree (junction on Windows,
 * symlink elsewhere) so agents can typecheck/build without an install per task.
 * Caveat: workspace self-links inside node_modules point at the MAIN checkout's
 * packages — a task editing @apphub/shared types sees the main build until merged.
 */
function linkNodeModules(repoRoot: string, worktreePath: string): void {
  for (const rel of nodeModulesPaths(repoRoot)) {
    const target = path.join(repoRoot, rel)
    const link = path.join(worktreePath, rel)
    if (!fs.existsSync(target) || fs.existsSync(link)) continue
    try {
      fs.symlinkSync(target, link, 'junction')
    } catch {
      /* non-fatal — agent can still npm install */
    }
  }
}

/** Remove node_modules links from a worktree (link only, never the contents) */
function unlinkNodeModules(worktreePath: string): void {
  for (const rel of nodeModulesPaths(worktreePath)) {
    const link = path.join(worktreePath, rel)
    try {
      if (!fs.lstatSync(link).isSymbolicLink()) continue
    } catch {
      continue
    }
    try {
      fs.rmdirSync(link) // removes the junction/symlink itself, not the target
    } catch {
      try {
        fs.unlinkSync(link)
      } catch {
        /* ignore */
      }
    }
  }
}

/** Create a worktree on a new branch. Returns the worktree path. */
export function createWorktree(repoRoot: string, branchName: string): string {
  const worktreePath = path.join(repoRoot, WORKTREE_DIR, branchName.replace('/', '-'))

  // Ensure parent dir exists
  fs.mkdirSync(path.dirname(worktreePath), { recursive: true })

  // Create worktree with a new branch from HEAD
  git(repoRoot, `worktree add "${worktreePath}" -b "${branchName}"`)

  // Make installed dependencies available inside the worktree
  linkNodeModules(repoRoot, worktreePath)

  return worktreePath
}

/** Remove a worktree and optionally delete the branch */
export function removeWorktree(repoRoot: string, branchName: string, deleteBranch = false): void {
  const worktreePath = path.join(repoRoot, WORKTREE_DIR, branchName.replace('/', '-'))

  // Drop dependency links first so nothing ever deletes through them
  unlinkNodeModules(worktreePath)

  try {
    git(repoRoot, `worktree remove "${worktreePath}" --force`)
  } catch {
    // Worktree may already be removed; clean up manually
    if (fs.existsSync(worktreePath)) {
      fs.rmSync(worktreePath, { recursive: true, force: true })
    }
    try {
      git(repoRoot, 'worktree prune')
    } catch {
      /* ignore */
    }
  }

  if (deleteBranch) {
    try {
      git(repoRoot, `branch -D "${branchName}"`)
    } catch {
      /* branch may not exist */
    }
  }
}

/** Get the unified diff between base branch and the feature branch */
export function getBranchDiff(repoRoot: string, branchName: string, baseBranch: string): string {
  try {
    return git(repoRoot, `diff "${baseBranch}"..."${branchName}"`)
  } catch {
    return ''
  }
}

/** Get the file-level diff stat */
export function getBranchDiffStat(
  repoRoot: string,
  branchName: string,
  baseBranch: string,
): string {
  try {
    return git(repoRoot, `diff --stat "${baseBranch}"..."${branchName}"`)
  } catch {
    return ''
  }
}

/** List commits on the branch since it diverged from base */
export function getBranchCommits(
  repoRoot: string,
  branchName: string,
  baseBranch: string,
): Array<{ hash: string; message: string; date: string }> {
  try {
    const log = git(
      repoRoot,
      `log "${baseBranch}".."${branchName}" --format="%H|||%s|||%aI" --reverse`,
    )
    if (!log) return []
    return log.split('\n').map((line) => {
      const [hash, message, date] = line.split('|||')
      return { hash: hash.slice(0, 8), message, date }
    })
  } catch {
    return []
  }
}

/** Count commits on the branch since base */
export function countBranchCommits(
  repoRoot: string,
  branchName: string,
  baseBranch: string,
): number {
  try {
    const count = git(repoRoot, `rev-list --count "${baseBranch}".."${branchName}"`)
    return parseInt(count, 10) || 0
  } catch {
    return 0
  }
}

/** Merge a branch into the current branch (should be on base branch) */
export function mergeBranch(
  repoRoot: string,
  branchName: string,
): { success: boolean; error?: string } {
  try {
    git(repoRoot, `merge "${branchName}" --no-ff -m "vibe: merge ${branchName}"`)
    return { success: true }
  } catch (err) {
    // Abort the merge if it failed
    try {
      git(repoRoot, 'merge --abort')
    } catch {
      /* ignore */
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Ensure we're on the base branch before merging */
export function checkoutBranch(repoRoot: string, branch: string): void {
  git(repoRoot, `checkout "${branch}"`)
}

/** List all branches matching the claude/* pattern */
export function listClaudeBranches(repoRoot: string): string[] {
  try {
    const output = git(repoRoot, 'branch --list "claude/*" --format="%(refname:short)"')
    if (!output) return []
    return output.split('\n').filter(Boolean)
  } catch {
    return []
  }
}
