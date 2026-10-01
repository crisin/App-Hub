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
import { createWriteStream, type WriteStream } from 'node:fs'
import { getDb } from './db.js'
import { logger } from './logger.js'
import { addClaudeNote, getUnclaimedClaudeItems, hasUnclaimedClaudeItems, moveItem } from './data.js'
import { persistItem } from './board-files.js'
import {
  isGitRepo,
  branchNameFromIssue,
  createWorktree,
  removeWorktree,
  countBranchCommits,
  getCurrentBranch,
  worktreeEnv,
} from './git-worktree.js'
import { getCoderBackend, backendForLabels } from './coder-backends.js'
import { PATHS, HUB_URL } from './config.js'
import { resolveProjectScope } from './scanner.js'

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

/** Directory for persistent per-task output logs */
const RUNS_LOG_DIR = path.join(PATHS.logs, 'runs')

/** Active log file stream for the current task */
let currentLogStream: WriteStream | null = null

/**
 * Create a persistent log file for a task run.
 * Returns the absolute path to the log file.
 */
function openTaskLog(issueId: string): string {
  fs.mkdirSync(RUNS_LOG_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const safeName = `${issueId}_${ts}.log`
  const logPath = path.join(RUNS_LOG_DIR, safeName)
  currentLogStream = createWriteStream(logPath, { flags: 'a' })
  return logPath
}

/** Write a line to the persistent log file */
function writeToTaskLog(ch: string, text: string) {
  if (currentLogStream && !currentLogStream.destroyed) {
    const ts = new Date().toISOString()
    currentLogStream.write(`[${ts}] [${ch}] ${text}\n`)
  }
}

/** Close the current task log stream */
function closeTaskLog() {
  if (currentLogStream && !currentLogStream.destroyed) {
    currentLogStream.end()
  }
  currentLogStream = null
}

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
    // Write to persistent log file
    writeToTaskLog(ch, line)
  }
  // Keep max 2000 lines in memory (full output is on disk)
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

    for (const issue of staleIssues) {
      // Move back to claude lane (re-queue) and clear assignment
      moveItem(issue.id, { stage: 'claude', assigned_to: '' })

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

  // Find the top unclaimed issue — skipping blocked items (via data layer)
  const db = getDb()
  const unclaimedItems = getUnclaimedClaudeItems()
  const issue = unclaimedItems[0]

  if (!issue) {
    setStatus({ state: 'idle' })
    return currentStatus
  }

  // Pick the coder backend for this item (label "aider" opts into aider; default claude)
  const backend = getCoderBackend(backendForLabels(issue.labels))
  const probeError = backend.probe()
  if (probeError) {
    setStatus({ state: 'error', error: probeError })
    logger.error('claude', 'runner.error', `Backend "${backend.name}" unavailable: ${probeError}`)
    return currentStatus
  }

  // Claim the issue atomically inside a transaction
  const now = new Date().toISOString()
  const claimItem = db.transaction((itemId: string) => {
    const row = db.prepare('SELECT assigned_to, stage FROM items WHERE id = ?').get(itemId) as
      | { assigned_to: string; stage: string }
      | undefined
    if (!row || row.stage !== 'claude' || (row.assigned_to !== '' && row.assigned_to !== null)) {
      return false
    }
    db.prepare(
      `UPDATE items SET assigned_to = 'claude-runner', stage = 'build', updated = @now WHERE id = @id`,
    ).run({ id: itemId, now })
    return true
  })

  if (!claimItem(issue.id)) {
    setStatus({ state: 'idle' })
    return currentStatus
  }
  persistItem(issue.id)

  emitBoardChanged()

  addNote(issue.id, 'info', `Claimed by claude-runner (priority: ${issue.priority})`)

  // Resolve working directory from project_slug
  const scope = issue.project_slug || 'hub'
  const resolved = resolveProjectScope(scope)

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

  if (!isGitRepo(repoRoot)) {
    const errMsg = `Scope "${scope}" (${repoRoot}) is not a git repository — cannot create isolated worktree`
    logger.error('claude', 'runner.no_git', errMsg, { issueId: issue.id, scope })
    addNote(issue.id, 'error', errMsg)
    // Unclaim the item so it goes back to the claude lane for retry
    moveItem(issue.id, { stage: 'claude', assigned_to: '' })
    emitBoardChanged()
    setStatus({ state: 'error', issueId: issue.id, issueTitle: issue.title, error: errMsg })
    return currentStatus
  }

  try {
    baseBranch = getCurrentBranch(repoRoot)
    branchName = branchNameFromIssue(issue.id, issue.title)
    worktreePath = createWorktree(repoRoot, branchName)
    workDir = worktreePath

    // Record the branch review in the DB. Branch names are deterministic
    // (issue id + title), so a re-run of an item after a discarded/merged
    // review reuses the same name — upsert instead of failing on UNIQUE.
    const reviewId = `br-${Date.now().toString(36)}`
    db.prepare(
      `INSERT INTO branch_reviews (id, issue_id, branch_name, project_scope, worktree_path, base_branch, status, created)
       VALUES (@id, @issue_id, @branch_name, @project_scope, @worktree_path, @base_branch, 'pending', @created)
       ON CONFLICT(branch_name) DO UPDATE SET
         issue_id = excluded.issue_id,
         project_scope = excluded.project_scope,
         worktree_path = excluded.worktree_path,
         base_branch = excluded.base_branch,
         status = 'pending',
         commit_count = 0,
         created = excluded.created`,
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
    // Worktree creation failed — do NOT fall back to direct-write (would contaminate main branch)
    const errMsg = err instanceof Error ? err.message : String(err)
    logger.error(
      'claude',
      'runner.worktree_error',
      `Worktree creation failed for "${issue.title}": ${errMsg}`,
      { issueId: issue.id, error: errMsg },
    )
    addNote(issue.id, 'error', `Worktree creation failed: ${errMsg}. Item returned to Claude lane for retry.`)
    // Unclaim the item so it goes back to the claude lane for retry
    moveItem(issue.id, { stage: 'claude', assigned_to: '' })
    emitBoardChanged()
    setStatus({ state: 'error', issueId: issue.id, issueTitle: issue.title, error: `Worktree failed: ${errMsg}` })
    return currentStatus
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

  if (branchName && backend.name === 'claude') {
    prompt += `
- You are working in a git worktree on branch "${branchName}"
- COMMIT your changes with git. The git history is the project's logbook — every commit gets a detailed message:
    <type>(<scope>): <what changed, imperative, max 72 chars>
    <blank line>
    Why:       the problem or motivation
    What:      the change, key decisions, rejected alternatives
    Verified:  how you checked it (typecheck, build, tests) — or "not verified" and why
    Follow-up: open ends (omit if none)
  Types: feat fix refactor docs chore test perf build ci. Write the message to a temp file and use "git commit -F <file>" to keep the line breaks.
- Make small, focused commits — one per logical change
- Do NOT push, merge, or switch branches — the user will review and merge your branch`
  }

  if (backend.name === 'claude') {
    prompt += `
- Track your progress by posting notes to the Hub API:
    curl -s -X POST ${HUB_URL}/api/board/${issue.id}/notes -H 'Content-Type: application/json' -d '{"type":"progress","message":"<what you are doing, max 200 chars>"}'
  Post a "progress" note when starting a major step.
- When done, summarize what you changed`
  } else {
    // Aider auto-commits and cannot call APIs — keep the task self-contained
    prompt += `
- Implement the task completely; your changes are committed automatically
- Do NOT push, merge, or switch branches — the user will review and merge your branch`
  }

  // Spawn claude — open persistent log file
  outputLines = []
  outputSeq = 0
  const taskLogPath = openTaskLog(issue.id)
  pushOutput('system', `Starting: ${issue.title} (${issue.id})`)
  pushOutput('system', `Backend: ${backend.name}`)
  pushOutput('system', `Log file: ${taskLogPath}`)
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

  const plan = backend.buildSpawn(prompt)

  console.log(`[runner] Starting: ${issue.title} (${issue.id}) [scope: ${scope}, backend: ${backend.name}]`)
  logger.info(
    'claude',
    'runner.started',
    `Runner started (${backend.name}): "${issue.title}" in ${contextName}`,
    {
      issueId: issue.id,
      title: issue.title,
      priority: issue.priority,
      scope,
      workDir,
      backend: backend.name,
      bin: plan.bin,
    },
  )

  /** Best-effort removal of the backend's temp files (e.g. aider message file) */
  function cleanupPlanFiles() {
    for (const f of plan.cleanupFiles) {
      try {
        fs.rmSync(f, { force: true })
      } catch {
        /* ignore */
      }
    }
  }

  // Per-repo extras for the agent (e.g. a cargo target dir shared by all worktrees)
  const extraEnv = worktreePath ? worktreeEnv(repoRoot) : {}
  for (const [k, v] of Object.entries(extraEnv)) pushOutput('system', `Env: ${k}=${v}`)

  currentProcess = spawn(plan.bin, plan.args, {
    cwd: workDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...plan.env, ...extraEnv },
  })
  // Prompt via stdin where the backend wants it — avoids argv limits/quoting on Windows
  if (plan.stdinPrompt !== null) {
    currentProcess.stdin?.write(plan.stdinPrompt)
  }
  currentProcess.stdin?.end()

  // Buffer for incomplete lines from stdout (stream-json emits one JSON object per line)
  let stdoutBuffer = ''
  const MAX_BUFFER_SIZE = 256 * 1024 // 256 KB max buffer before forcing a flush

  const stdoutHandler = (data: Buffer) => {
    stdoutBuffer += data.toString()

    // Prevent unbounded buffer growth — flush everything if too large
    if (stdoutBuffer.length > MAX_BUFFER_SIZE) {
      pushOutput('stdout', stdoutBuffer.slice(0, 500) + '... [truncated]')
      stdoutBuffer = ''
      return
    }

    const lines = stdoutBuffer.split('\n')
    // Keep the last (possibly incomplete) line in the buffer
    stdoutBuffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      if (plan.outputFormat === 'text') {
        pushOutput('stdout', line)
        continue
      }
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
  }

  const stderrHandler = (data: Buffer) => {
    const text = data.toString().trim()
    if (text) pushOutput('stderr', text)
  }

  currentProcess.stdout?.on('data', stdoutHandler)
  currentProcess.stderr?.on('data', stderrHandler)

  /** Remove listeners to prevent leaks if the process errors out */
  function cleanupListeners() {
    currentProcess?.stdout?.off('data', stdoutHandler)
    currentProcess?.stderr?.off('data', stderrHandler)
  }

  currentProcess.on('close', (code) => {
    cleanupListeners()
    closeTaskLog()
    cleanupPlanFiles()
    console.log(`[runner] Finished: ${issue.title} (exit ${code})`)
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

      if (branchName && countBranchCommits(repoRoot, branchName, baseBranch) === 0) {
        // Exit 0 but nothing committed — nothing to review. Clean up and
        // park the item in "build" (not "claude": would auto-retrigger in a loop).
        addNote(
          issue.id,
          'error',
          `Finished without commits after ${durationStr} — check the run log; item moved to build`,
        )
        try {
          removeWorktree(repoRoot, branchName, true)
          db.prepare(`DELETE FROM branch_reviews WHERE branch_name = @branch`).run({
            branch: branchName,
          })
        } catch {
          /* cleanup best-effort */
        }
        moveItem(issue.id, { stage: 'build', assigned_to: '' })
      } else if (branchName) {
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

        moveItem(issue.id, { stage: 'review', assigned_to: '', toEnd: true })
      } else {
        // No branch: move directly to done
        addNote(issue.id, 'commit', summary)

        moveItem(issue.id, { stage: 'done', assigned_to: '', toEnd: true })
      }

      const finalCommits = branchName ? countBranchCommits(repoRoot, branchName, baseBranch) : 0
      addHistoryEntry({
        issueId: issue.id,
        issueTitle: issue.title,
        scope,
        startedAt: now,
        finishedAt: new Date().toISOString(),
        exitCode: code,
        outcome: branchName && finalCommits === 0 ? 'partial' : 'success',
        commitCount: finalCommits,
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

          moveItem(issue.id, { stage: 'review', assigned_to: '', toEnd: true })
        } else {
          // No commits — clean up, release the claim, park in build
          addNote(issue.id, 'error', `Failed with exit code ${code} after ${durationStr}`)
          try {
            removeWorktree(repoRoot, branchName, true)
            db.prepare(`DELETE FROM branch_reviews WHERE branch_name = @branch`).run({
              branch: branchName,
            })
          } catch {
            /* cleanup best-effort */
          }
          moveItem(issue.id, { stage: 'build', assigned_to: '' })
        }
      } else {
        addNote(issue.id, 'error', `Failed with exit code ${code} after ${durationStr}`)
        moveItem(issue.id, { stage: 'build', assigned_to: '' })
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
    cleanupListeners()
    closeTaskLog()
    cleanupPlanFiles()
    // The agent never started: drop the empty worktree and release the claim
    if (branchName) {
      try {
        removeWorktree(repoRoot, branchName, true)
        db.prepare(`DELETE FROM branch_reviews WHERE branch_name = @branch`).run({ branch: branchName })
      } catch {
        /* cleanup best-effort */
      }
    }
    addNote(issue.id, 'error', `Could not start ${backend.name}: ${err.message}`)
    moveItem(issue.id, { stage: 'build', assigned_to: '' })
    console.error(`[runner] Error:`, err.message)
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
