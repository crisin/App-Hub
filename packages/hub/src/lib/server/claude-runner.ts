/**
 * Claude Runner — spawns Claude Code CLI to work on board issues.
 *
 * Runs entirely server-side. Manages one process at a time.
 * Detects the claude binary automatically (PATH or Claude Desktop App bundle).
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { getDb } from './db.js'
import type { DbItemRow, DbProjectRow } from './db.js'
import { logger } from './logger.js'
import { addClaudeNote, getUnclaimedClaudeItems, hasUnclaimedClaudeItems } from './data.js'
import {
  isGitRepo,
  branchNameFromIssue,
  createWorktree,
  removeWorktree,
  countBranchCommits,
  getCurrentBranch,
} from './git-worktree.js'

export interface ClaudeRunnerStatus {
  state: 'idle' | 'running' | 'error'
  issueId?: string
  issueTitle?: string
  startedAt?: string
  error?: string
  output?: string
}

/** Output line with timestamp and source channel */
export interface OutputLine {
  ts: number
  ch: 'stdout' | 'stderr' | 'system'
  text: string
}

let currentProcess: ChildProcess | null = null
let currentStatus: ClaudeRunnerStatus = { state: 'idle' }
let outputLines: OutputLine[] = []
let outputSeq = 0 // increments on every new line, clients use this to poll efficiently

/** History of recent runner runs (kept in-memory, max 20) */
export interface RunHistoryEntry {
  issueId: string
  issueTitle: string
  scope: string
  startedAt: string
  finishedAt: string
  exitCode: number | null
  outcome: 'success' | 'partial' | 'failed' | 'error'
  commitCount: number
  branch?: string
}
let runHistory: RunHistoryEntry[] = []
let lastActivityAt: string | null = null

import { HUB_PORT } from '@apphub/shared'

const HUB_URL = `http://localhost:${process.env.PORT ?? HUB_PORT}`
const PROJECT_ROOT = path.resolve(process.cwd(), '..', '..')

/**
 * SSE Event Bus — emits typed events for real-time client updates.
 * Events:
 *   'output'  — new OutputLine(s) added
 *   'status'  — runner state changed (idle/running/error)
 *   'board'   — board data changed (issue moved between lanes)
 */
export const runnerEvents = new EventEmitter()
runnerEvents.setMaxListeners(20) // single-user tool, but allow a few tabs

/** Emit a typed SSE event to all connected clients */
function emitSSE(event: string, data: unknown) {
  runnerEvents.emit('sse', { event, data })
}

/** Emit board refresh hint — tells clients to re-fetch board data */
export function emitBoardChanged() {
  emitSSE('board', { changed: true, ts: Date.now() })
}

function addHistoryEntry(entry: RunHistoryEntry) {
  runHistory.unshift(entry)
  if (runHistory.length > 20) runHistory = runHistory.slice(0, 20)
  lastActivityAt = entry.finishedAt
}

/** Add a claude note to an issue — delegates to data layer */
function addNote(issueId: string, type: 'progress' | 'commit' | 'error' | 'info', message: string) {
  try {
    addClaudeNote(issueId, type, message)
  } catch {
    /* never let notes break the runner */
  }
}

/**
 * Resolve the working directory for a given project scope.
 * - 'hub' → the App Hub monorepo root
 * - project slug → projects/<slug>
 * - template slug → templates/<slug>
 */
function resolveScope(scope: string): { cwd: string; contextName: string } | null {
  if (!scope || scope === 'hub') {
    return { cwd: PROJECT_ROOT, contextName: 'App Hub' }
  }

  // Check projects directory
  const projectPath = path.join(PROJECT_ROOT, 'projects', scope)
  if (fs.existsSync(projectPath)) {
    return { cwd: projectPath, contextName: `project "${scope}"` }
  }

  // Check templates directory
  const templatePath = path.join(PROJECT_ROOT, 'templates', scope)
  if (fs.existsSync(templatePath)) {
    return { cwd: templatePath, contextName: `template "${scope}"` }
  }

  // Check projects DB for custom paths
  const db = getDb()
  const project = db.prepare('SELECT path, name FROM projects WHERE slug = ?').get(scope) as Pick<DbProjectRow, 'path' | 'name'> | undefined
  if (project?.path && fs.existsSync(project.path)) {
    return { cwd: project.path, contextName: `project "${project.name}"` }
  }

  return null
}

/** Find the claude binary */
function findClaude(): string | null {
  // 1. Check common PATH locations
  const pathDirs = (process.env.PATH ?? '').split(':')
  const extraDirs = ['/usr/local/bin', '/opt/homebrew/bin']
  for (const dir of [...pathDirs, ...extraDirs]) {
    const bin = path.join(dir, 'claude')
    if (fs.existsSync(bin)) return bin
  }

  // 2. Check Claude Desktop App bundle (macOS)
  const appSupport = path.join(
    process.env.HOME ?? '',
    'Library/Application Support/Claude/claude-code',
  )
  if (fs.existsSync(appSupport)) {
    try {
      const versions = fs.readdirSync(appSupport).sort()
      const latest = versions[versions.length - 1]
      if (latest) {
        const bin = path.join(appSupport, latest, 'claude.app/Contents/MacOS/claude')
        if (fs.existsSync(bin)) return bin
      }
    } catch {
      /* ignore */
    }
  }

  return null
}

/**
 * Format a stream-json event from Claude CLI into a human-readable line.
 * Claude's --output-format stream-json emits one JSON object per line with types like:
 *   { type: "assistant", message: { content: [...] } }
 *   { type: "content_block_start", content_block: { type: "tool_use", name: "...", ... } }
 *   { type: "content_block_delta", delta: { type: "text_delta", text: "..." } }
 *   { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: "..." } }
 *   { type: "result", result: "...", ... }
 * Returns null to skip events that don't need display.
 */
function formatStreamEvent(event: any): string | null {
  if (!event || !event.type) return null

  switch (event.type) {
    case 'assistant': {
      // Initial assistant message — extract text blocks
      const content = event.message?.content
      if (Array.isArray(content)) {
        const texts = content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n')
        if (texts.trim()) return texts.trim()
      }
      return null
    }

    case 'content_block_start': {
      const block = event.content_block
      if (!block) return null
      if (block.type === 'tool_use') {
        return `▶ ${block.name}`
      }
      if (block.type === 'text' && block.text) {
        return block.text
      }
      return null
    }

    case 'content_block_delta': {
      const delta = event.delta
      if (!delta) return null
      if (delta.type === 'text_delta' && delta.text) {
        // Stream text chunks — only show substantial ones
        const text = delta.text.trim()
        if (text.length > 0) return text
      }
      return null
    }

    case 'content_block_stop':
      return null // skip

    case 'message_start':
    case 'message_delta':
    case 'message_stop':
      return null // skip meta events

    case 'result': {
      // Final result
      if (event.subtype === 'success') {
        const cost = event.cost_usd ? ` ($${event.cost_usd.toFixed(4)})` : ''
        return `✓ Done${cost}`
      }
      if (event.subtype === 'error') {
        return `✗ Error: ${event.error || 'unknown'}`
      }
      // For other result types, show the result text if available
      if (typeof event.result === 'string' && event.result.trim()) {
        return event.result.trim().slice(0, 500)
      }
      return null
    }

    case 'system': {
      // System-level events
      if (event.subtype === 'init') {
        const tools = event.tools?.join(', ') || 'none'
        return `⚙ Initialized (tools: ${tools})`
      }
      return null
    }

    default:
      return null
  }
}

function pushOutput(ch: OutputLine['ch'], text: string) {
  const newLines: OutputLine[] = []
  const lines = text.split('\n')
  for (const line of lines) {
    if (line.length === 0 && ch !== 'system') continue
    const entry: OutputLine = { ts: Date.now(), ch, text: line }
    outputLines.push(entry)
    newLines.push(entry)
    outputSeq++
  }
  // Keep max 2000 lines
  if (outputLines.length > 2000) {
    outputLines = outputLines.slice(-1500)
  }
  // Push to SSE clients
  if (newLines.length > 0) {
    emitSSE('output', { seq: outputSeq, lines: newLines })
  }
}

/** Update status and emit SSE event */
function setStatus(status: ClaudeRunnerStatus) {
  currentStatus = status
  emitSSE('status', {
    state: status.state,
    issueId: status.issueId,
    issueTitle: status.issueTitle,
    startedAt: status.startedAt,
    error: status.error,
    elapsedMs: status.state === 'running' && status.startedAt
      ? Date.now() - new Date(status.startedAt).getTime()
      : null,
    lastActivityAt,
    history: runHistory,
  })
}

/**
 * Clean up stale runner assignments on server startup.
 * If the server crashed or restarted while Claude was working,
 * issues may be stuck with assigned_to='claude-runner' and no process running.
 */
export function cleanupStaleAssignments(): number {
  try {
    const db = getDb()
    // Find issues still assigned to claude-runner
    const staleIssues = db
      .prepare(
        "SELECT id, title, stage FROM items WHERE assigned_to = 'claude-runner'",
      )
      .all() as { id: string; title: string; stage: string }[]

    if (staleIssues.length === 0) return 0

    const now = new Date().toISOString()
    for (const issue of staleIssues) {
      // Move back to claude lane (re-queue) and clear assignment
      db.prepare(
        `UPDATE items
         SET assigned_to = '', stage = 'claude', updated = @now
         WHERE id = @id`,
      ).run({ id: issue.id, now })

      addNote(
        issue.id,
        'error',
        `Stale assignment cleared on server restart (was in ${issue.stage})`,
      )
      logger.warn(
        'claude',
        'runner.stale_cleanup',
        `Reset stale assignment for "${issue.title}" (${issue.id})`,
      )
    }

    return staleIssues.length
  } catch (e) {
    logger.error('claude', 'runner.stale_cleanup_error', String(e))
    return 0
  }
}

/** Get current runner status */
export function getRunnerStatus(): ClaudeRunnerStatus {
  return {
    ...currentStatus,
    output: outputLines
      .map((l) => l.text)
      .join('\n')
      .slice(-4000),
  }
}

/** Get extended runner status with history and timing info */
export function getRunnerStatusExtended() {
  const base = getRunnerStatus()
  const elapsed =
    base.state === 'running' && base.startedAt
      ? Date.now() - new Date(base.startedAt).getTime()
      : null

  return {
    ...base,
    elapsedMs: elapsed,
    lastActivityAt,
    history: runHistory,
    outputLineCount: outputLines.length,
  }
}

/** Get output lines since a given sequence number (for incremental polling) */
export function getRunnerOutput(sinceSeq = 0): { seq: number; lines: OutputLine[] } {
  if (sinceSeq >= outputSeq) {
    return { seq: outputSeq, lines: [] }
  }
  // Calculate how many lines ago `sinceSeq` was
  const linesAgo = outputSeq - sinceSeq
  const startIdx = Math.max(0, outputLines.length - linesAgo)
  return { seq: outputSeq, lines: outputLines.slice(startIdx) }
}

/** Check if there are unclaimed, unblocked issues in the Claude stage */
export { hasUnclaimedClaudeItems } from './data.js'

/** Trigger the runner — picks the next unclaimed, unblocked Claude stage item */
export function triggerRunner(): ClaudeRunnerStatus {
  if (currentProcess && currentStatus.state === 'running') {
    return currentStatus
  }

  const claudeBin = findClaude()
  if (!claudeBin) {
    setStatus({ state: 'error', error: 'Claude CLI not found' })
    logger.error('claude', 'runner.error', 'Claude CLI binary not found on system')
    return currentStatus
  }

  // Find the top unclaimed issue — skipping blocked items (via data layer)
  const db = getDb()
  const unclaimedItems = getUnclaimedClaudeItems()
  const issue = unclaimedItems[0]

  if (!issue) {
    setStatus({ state: 'idle' })
    return currentStatus
  }

  // Claim the issue
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `
    UPDATE items
    SET assigned_to = 'claude-runner', stage = 'build', updated = @now
    WHERE id = @id AND stage = 'claude' AND (assigned_to = '' OR assigned_to IS NULL)
  `,
    )
    .run({ id: issue.id, now })

  if (result.changes === 0) {
    setStatus({ state: 'idle' })
    return currentStatus
  }

  emitBoardChanged()

  addNote(issue.id, 'info', `Claimed by claude-runner (priority: ${issue.priority})`)

  // Resolve working directory from project_slug
  const scope = issue.project_slug || 'hub'
  const resolved = resolveScope(scope)

  if (!resolved) {
    logger.error(
      'claude',
      'runner.scope_error',
      `Cannot resolve scope "${scope}" for issue "${issue.title}"`,
      {
        issueId: issue.id,
        scope,
      },
    )
    setStatus({
      state: 'error',
      issueId: issue.id,
      issueTitle: issue.title,
      error: `Scope "${scope}" not found`,
    })
    return currentStatus
  }

  const { cwd: repoRoot, contextName } = resolved

  // Set up git worktree for isolated branch workflow
  let workDir = repoRoot
  let branchName: string | null = null
  let worktreePath: string | null = null
  let baseBranch = 'main'

  if (isGitRepo(repoRoot)) {
    try {
      baseBranch = getCurrentBranch(repoRoot)
      branchName = branchNameFromIssue(issue.id, issue.title)
      worktreePath = createWorktree(repoRoot, branchName)
      workDir = worktreePath

      // Record the branch review in the DB
      const reviewId = `br-${Date.now().toString(36)}`
      db.prepare(
        `INSERT INTO branch_reviews (id, issue_id, branch_name, project_scope, worktree_path, base_branch, status, created)
         VALUES (@id, @issue_id, @branch_name, @project_scope, @worktree_path, @base_branch, 'pending', @created)`,
      ).run({
        id: reviewId,
        issue_id: issue.id,
        branch_name: branchName,
        project_scope: scope,
        worktree_path: worktreePath,
        base_branch: baseBranch,
        created: now,
      })

      pushOutput('system', `Branch: ${branchName}`)
      pushOutput('system', `Worktree: ${worktreePath}`)
    } catch (err) {
      // Fall back to direct-write if worktree creation fails
      const errMsg = err instanceof Error ? err.message : String(err)
      logger.warn(
        'claude',
        'runner.worktree_fallback',
        `Worktree creation failed, working directly in repo: ${errMsg}`,
        { issueId: issue.id, error: errMsg },
      )
      pushOutput('system', `⚠ Worktree failed (${errMsg}), working directly`)
      workDir = repoRoot
      branchName = null
      worktreePath = null
    }
  }

  // Build prompt — include project-level description and context if available
  const projectRow = db.prepare('SELECT description, context FROM projects WHERE slug = ?').get(scope) as { description?: string; context?: string } | undefined
  const labels = (Array.isArray(issue.labels) ? issue.labels : []).join(', ')
  let prompt = `You are working on ${contextName}.`

  if (projectRow?.description) {
    prompt += `\n\nPROJECT DESCRIPTION:\n${projectRow.description}`
  }
  if (projectRow?.context) {
    prompt += `\n\nPROJECT CONTEXT:\n${projectRow.context}`
  }

  prompt += `\n\nTASK: ${issue.title}
PRIORITY: ${issue.priority}`

  if (issue.description) {
    prompt += `\n\nDESCRIPTION:\n${issue.description}`
  }
  if (labels) {
    prompt += `\n\nLABELS: ${labels}`
  }

  prompt += `\n\nINSTRUCTIONS:
- Work in: ${workDir}
- This task was picked up from the Hub kanban board (issue ${issue.id})
- Follow the coding guidelines in CLAUDE.md if one exists`

  if (branchName) {
    prompt += `
- You are working in a git worktree on branch "${branchName}"
- COMMIT your changes with git. Always prefix commit messages with "vibe:" (e.g., "vibe: add login form validation")
- Make small, focused commits — one per logical change
- Do NOT push, merge, or switch branches — the user will review and merge your branch`
  }

  prompt += `
- Track your progress by posting notes to the Hub API:
    curl -s -X POST ${HUB_URL}/api/board/${issue.id}/notes -H 'Content-Type: application/json' -d '{"type":"progress","message":"<what you are doing, max 200 chars>"}'
  Post a "progress" note when starting a major step.
- When done, summarize what you changed`

  // Spawn claude
  outputLines = []
  outputSeq = 0
  pushOutput('system', `Starting: ${issue.title} (${issue.id})`)
  pushOutput('system', `Scope: ${contextName} (${scope})`)
  pushOutput('system', `Working directory: ${workDir}`)
  pushOutput('system', `Priority: ${issue.priority}`)
  if (issue.description) pushOutput('system', `Description: ${issue.description.slice(0, 200)}`)
  pushOutput('system', '─'.repeat(60))

  setStatus({
    state: 'running',
    issueId: issue.id,
    issueTitle: issue.title,
    startedAt: now,
  })

  console.log(`[claude-runner] Starting: ${issue.title} (${issue.id}) [scope: ${scope}]`)
  logger.info(
    'claude',
    'runner.started',
    `Claude runner started: "${issue.title}" in ${contextName}`,
    {
      issueId: issue.id,
      title: issue.title,
      priority: issue.priority,
      scope,
      workDir,
      claudeBin,
    },
  )

  currentProcess = spawn(
    claudeBin,
    ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--allowedTools', 'Read,Grep,Glob,Bash,Edit,Write'],
    {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH}` },
    },
  )

  // Buffer for incomplete JSON lines from stdout (stream-json outputs one JSON object per line)
  let stdoutBuffer = ''

  currentProcess.stdout?.on('data', (data: Buffer) => {
    stdoutBuffer += data.toString()
    const lines = stdoutBuffer.split('\n')
    // Keep the last (possibly incomplete) line in the buffer
    stdoutBuffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line)
        const formatted = formatStreamEvent(event)
        if (formatted) {
          pushOutput('stdout', formatted)
        }
      } catch {
        // Not valid JSON — output raw
        pushOutput('stdout', line)
      }
    }
  })

  currentProcess.stderr?.on('data', (data: Buffer) => {
    const text = data.toString().trim()
    if (text) pushOutput('stderr', text)
  })

  currentProcess.on('close', (code) => {
    console.log(`[claude-runner] Finished: ${issue.title} (exit ${code})`)
    pushOutput('system', '─'.repeat(60))
    pushOutput('system', `Finished with exit code ${code}`)

    const durationMs = Date.now() - new Date(now).getTime()
    const durationStr =
      durationMs > 60000
        ? `${Math.round(durationMs / 60000)}m ${Math.round((durationMs % 60000) / 1000)}s`
        : `${Math.round(durationMs / 1000)}s`

    if (code === 0) {
      // Extract summary from the last chunk of output
      const lastOutput = outputLines
        .filter((l) => l.ch === 'stdout')
        .slice(-10)
        .map((l) => l.text)
        .join(' ')
        .trim()
      const summary = lastOutput.slice(0, 200) || `Completed in ${durationStr}`

      logger.info(
        'claude',
        'runner.completed',
        `Claude completed "${issue.title}" in ${durationStr}`,
        {
          issueId: issue.id,
          title: issue.title,
          exitCode: code,
          durationMs,
          duration: durationStr,
          branch: branchName,
        },
      )

      const doneNow = new Date().toISOString()

      if (branchName) {
        // Branch workflow: move to review lane
        const commitCount = countBranchCommits(repoRoot, branchName, baseBranch)
        addNote(
          issue.id,
          'commit',
          `Branch ${branchName} ready for review (${commitCount} commits). ${summary}`,
        )

        // Update commit count in branch_reviews
        db.prepare(
          `UPDATE branch_reviews SET commit_count = @count WHERE branch_name = @branch`,
        ).run({ count: commitCount, branch: branchName })

        const maxPos = db
          .prepare(
            "SELECT COALESCE(MAX(position), -1) as max FROM items WHERE stage = 'review'",
          )
          .get() as { max: number }

        db.prepare(
          `UPDATE items
           SET stage = 'review', assigned_to = '', position = @position, updated = @now
           WHERE id = @id`,
        ).run({ id: issue.id, position: maxPos.max + 1, now: doneNow })
      } else {
        // No branch: move directly to done
        addNote(issue.id, 'commit', summary)

        const maxPos = db
          .prepare(
            "SELECT COALESCE(MAX(position), -1) as max FROM items WHERE stage = 'done'",
          )
          .get() as { max: number }

        db.prepare(
          `UPDATE items
           SET stage = 'done', assigned_to = '', position = @position, updated = @now
           WHERE id = @id`,
        ).run({ id: issue.id, position: maxPos.max + 1, now: doneNow })
      }

      addHistoryEntry({
        issueId: issue.id,
        issueTitle: issue.title,
        scope,
        startedAt: now,
        finishedAt: new Date().toISOString(),
        exitCode: code,
        outcome: 'success',
        commitCount: branchName ? countBranchCommits(repoRoot, branchName, baseBranch) : 0,
        branch: branchName || undefined,
      })

      setStatus({ state: 'idle' })
      emitBoardChanged()

      // Check if there are more issues to process
      if (hasUnclaimedClaudeItems()) {
        console.log('[claude-runner] More issues in Claude lane, starting next...')
        setTimeout(() => triggerRunner(), 2000)
      }
    } else {
      logger.error(
        'claude',
        'runner.failed',
        `Claude failed on "${issue.title}" (exit ${code}) after ${durationStr}`,
        {
          issueId: issue.id,
          title: issue.title,
          exitCode: code,
          durationMs,
          duration: durationStr,
          branch: branchName,
        },
      )

      if (branchName) {
        // Check if there are any commits on the failed branch
        const commitCount = countBranchCommits(repoRoot, branchName, baseBranch)
        if (commitCount > 0) {
          // Partial work — still send to review
          addNote(
            issue.id,
            'error',
            `Failed (exit ${code}) after ${durationStr}, but ${commitCount} commits were made — branch sent to review`,
          )
          db.prepare(
            `UPDATE branch_reviews SET commit_count = @count WHERE branch_name = @branch`,
          ).run({ count: commitCount, branch: branchName })

          const maxPos = db
            .prepare(
              "SELECT COALESCE(MAX(position), -1) as max FROM items WHERE stage = 'review'",
            )
            .get() as { max: number }
          db.prepare(
            `UPDATE items SET stage = 'review', assigned_to = '', position = @position, updated = @now WHERE id = @id`,
          ).run({ id: issue.id, position: maxPos.max + 1, now: new Date().toISOString() })
        } else {
          // No commits — clean up and leave as error
          addNote(issue.id, 'error', `Failed with exit code ${code} after ${durationStr}`)
          try {
            removeWorktree(repoRoot, branchName, true)
            db.prepare(`DELETE FROM branch_reviews WHERE branch_name = @branch`).run({
              branch: branchName,
            })
          } catch {
            /* cleanup best-effort */
          }
        }
      } else {
        addNote(issue.id, 'error', `Failed with exit code ${code} after ${durationStr}`)
      }

      const failCommits = branchName ? countBranchCommits(repoRoot, branchName, baseBranch) : 0
      addHistoryEntry({
        issueId: issue.id,
        issueTitle: issue.title,
        scope,
        startedAt: now,
        finishedAt: new Date().toISOString(),
        exitCode: code,
        outcome: failCommits > 0 ? 'partial' : 'failed',
        commitCount: failCommits,
        branch: branchName || undefined,
      })

      setStatus({
        state: 'error',
        issueId: issue.id,
        issueTitle: issue.title,
        error: `Claude exited with code ${code}`,
      })
      emitBoardChanged()
    }

    currentProcess = null
  })

  currentProcess.on('error', (err) => {
    console.error(`[claude-runner] Error:`, err.message)
    logger.error('claude', 'runner.spawn_error', `Failed to spawn Claude process: ${err.message}`, {
      issueId: issue.id,
      title: issue.title,
      error: err.message,
    })
    addHistoryEntry({
      issueId: issue.id,
      issueTitle: issue.title,
      scope,
      startedAt: now,
      finishedAt: new Date().toISOString(),
      exitCode: null,
      outcome: 'error',
      commitCount: 0,
      branch: branchName || undefined,
    })
    setStatus({
      state: 'error',
      issueId: issue.id,
      issueTitle: issue.title,
      error: err.message,
    })
    currentProcess = null
  })

  return currentStatus
}

/** Auto-trigger: call this whenever an issue enters the Claude lane */
export function autoTriggerIfNeeded() {
  if (currentStatus.state === 'running') return
  if (hasUnclaimedClaudeItems()) {
    console.log('[claude-runner] Auto-triggering: unclaimed issue detected in Claude lane')
    triggerRunner()
  }
}
