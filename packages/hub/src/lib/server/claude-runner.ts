/**
 * Claude Runner — spawns Claude Code CLI to work on board issues.
 *
 * Runs entirely server-side. Manages one process at a time.
 * Detects the claude binary automatically (PATH or Claude Desktop App bundle).
 */
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { getDb } from './db.js'
import { logger } from './logger.js'

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

const HUB_URL = `http://localhost:${process.env.PORT ?? 5174}`
const PROJECT_ROOT = path.resolve(process.cwd(), '..', '..')

/** Add a claude note to an issue directly via SQLite */
function addNote(issueId: string, type: 'progress' | 'commit' | 'error' | 'info', message: string) {
  try {
    const db = getDb()
    const id = `note-${Date.now().toString(36)}`
    const now = new Date().toISOString()
    db.prepare(
      `
      INSERT INTO claude_notes (id, issue_id, type, message, created)
      VALUES (@id, @issue_id, @type, @message, @created)
    `,
    ).run({ id, issue_id: issueId, type, message: message.slice(0, 200), created: now })
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
  const project = db.prepare('SELECT path, name FROM projects WHERE slug = ?').get(scope) as any
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

function pushOutput(ch: OutputLine['ch'], text: string) {
  const lines = text.split('\n')
  for (const line of lines) {
    if (line.length === 0 && ch !== 'system') continue
    outputLines.push({ ts: Date.now(), ch, text: line })
    outputSeq++
  }
  // Keep max 2000 lines
  if (outputLines.length > 2000) {
    outputLines = outputLines.slice(-1500)
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

/** Check if there are unclaimed issues in the Claude lane */
export function hasUnclaimedClaudeIssues(): boolean {
  const db = getDb()
  const row = db
    .prepare(
      "SELECT COUNT(*) as c FROM board_issues WHERE lane = 'claude' AND (assigned_to = '' OR assigned_to IS NULL)",
    )
    .get() as { c: number }
  return row.c > 0
}

/** Trigger the runner — picks up the next unclaimed Claude lane issue */
export function triggerRunner(): ClaudeRunnerStatus {
  if (currentProcess && currentStatus.state === 'running') {
    return currentStatus
  }

  const claudeBin = findClaude()
  if (!claudeBin) {
    currentStatus = { state: 'error', error: 'Claude CLI not found' }
    logger.error('claude', 'runner.error', 'Claude CLI binary not found on system')
    return currentStatus
  }

  // Find the top unclaimed issue
  const db = getDb()
  const issue = db
    .prepare(
      `
    SELECT * FROM board_issues
    WHERE lane = 'claude' AND (assigned_to = '' OR assigned_to IS NULL)
    ORDER BY
      CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
      position ASC
    LIMIT 1
  `,
    )
    .get() as any

  if (!issue) {
    currentStatus = { state: 'idle' }
    return currentStatus
  }

  // Claim the issue
  const now = new Date().toISOString()
  const result = db
    .prepare(
      `
    UPDATE board_issues
    SET assigned_to = 'claude-runner', lane = 'in_progress', updated = @now
    WHERE id = @id AND lane = 'claude' AND (assigned_to = '' OR assigned_to IS NULL)
  `,
    )
    .run({ id: issue.id, now })

  if (result.changes === 0) {
    currentStatus = { state: 'idle' }
    return currentStatus
  }

  addNote(issue.id, 'info', `Claimed by claude-runner (priority: ${issue.priority})`)

  // Resolve working directory from project_scope
  const scope = issue.project_scope || 'hub'
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
    currentStatus = {
      state: 'error',
      issueId: issue.id,
      issueTitle: issue.title,
      error: `Scope "${scope}" not found`,
    }
    return currentStatus
  }

  const { cwd: workDir, contextName } = resolved

  // Build prompt
  const labels = JSON.parse(issue.labels || '[]').join(', ')
  let prompt = `You are working on ${contextName}.

TASK: ${issue.title}
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
- Follow the coding guidelines in CLAUDE.md if one exists
- Track your progress by posting notes to the Hub API:
    curl -s -X POST ${HUB_URL}/api/board/${issue.id}/notes -H 'Content-Type: application/json' -d '{"type":"progress","message":"<what you are doing, max 200 chars>"}'
    curl -s -X POST ${HUB_URL}/api/board/${issue.id}/notes -H 'Content-Type: application/json' -d '{"type":"commit","message":"<summary of changes made, max 200 chars>"}'
  Post a "progress" note when starting a major step, and a "commit" note after completing each significant change.
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

  currentStatus = {
    state: 'running',
    issueId: issue.id,
    issueTitle: issue.title,
    startedAt: now,
  }

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
    ['-p', prompt, '--allowedTools', 'Read,Grep,Glob,Bash,Edit,Write'],
    {
      cwd: workDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH}` },
    },
  )

  currentProcess.stdout?.on('data', (data: Buffer) => {
    pushOutput('stdout', data.toString())
  })

  currentProcess.stderr?.on('data', (data: Buffer) => {
    pushOutput('stderr', data.toString())
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
      addNote(issue.id, 'commit', summary)

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
        },
      )
      // Mark as done
      const doneNow = new Date().toISOString()
      const maxPos = db
        .prepare("SELECT COALESCE(MAX(position), -1) as max FROM board_issues WHERE lane = 'done'")
        .get() as { max: number }

      db.prepare(
        `
        UPDATE board_issues
        SET lane = 'done', assigned_to = '', position = @position, updated = @now
        WHERE id = @id
      `,
      ).run({ id: issue.id, position: maxPos.max + 1, now: doneNow })

      currentStatus = { state: 'idle' }

      // Check if there are more issues to process
      if (hasUnclaimedClaudeIssues()) {
        console.log('[claude-runner] More issues in Claude lane, starting next...')
        setTimeout(() => triggerRunner(), 2000)
      }
    } else {
      addNote(issue.id, 'error', `Failed with exit code ${code} after ${durationStr}`)
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
        },
      )
      currentStatus = {
        state: 'error',
        issueId: issue.id,
        issueTitle: issue.title,
        error: `Claude exited with code ${code}`,
      }
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
    currentStatus = {
      state: 'error',
      issueId: issue.id,
      issueTitle: issue.title,
      error: err.message,
    }
    currentProcess = null
  })

  return currentStatus
}

/** Auto-trigger: call this whenever an issue enters the Claude lane */
export function autoTriggerIfNeeded() {
  if (currentStatus.state === 'running') return
  if (hasUnclaimedClaudeIssues()) {
    console.log('[claude-runner] Auto-triggering: unclaimed issue detected in Claude lane')
    triggerRunner()
  }
}
