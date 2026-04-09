/**
 * POST /api/board/suggest
 *
 * AI-powered task suggestion endpoint.
 * Uses the pre-computed project summary (architecture + metadata + existing items)
 * to ask Claude CLI for actionable task proposals — no file scanning needed.
 *
 * Request:  { project_slug: string, focus?: string, count?: number }
 * Response: { ok: true, data: Suggestion[] }
 */
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ITEM_PRIORITIES, ITEM_STAGES } from '@apphub/shared'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { buildProjectSummary, formatSummaryForPrompt } from '$lib/server/project-summary'
import { logger } from '$lib/server/logger'

export interface Suggestion {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  labels: string[]
  stage: string
  rationale: string
}

// ── Find Claude binary (shared with claude-runner) ──────────────

function findClaude(): string | null {
  const pathDirs = (process.env.PATH ?? '').split(':')
  const extraDirs = ['/usr/local/bin', '/opt/homebrew/bin']
  for (const dir of [...pathDirs, ...extraDirs]) {
    const bin = path.join(dir, 'claude')
    if (fs.existsSync(bin)) return bin
  }

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

// ── Build the prompt using project summary ─────────────────────

function buildPrompt(
  summary: ReturnType<typeof buildProjectSummary>,
  focus: string | undefined,
  count: number,
): string {
  const contextBlock = formatSummaryForPrompt(summary)

  const focusLine = focus
    ? `\nFOCUS AREA: The user wants suggestions specifically about: "${focus}"\nPrioritize tasks related to this focus area.\n`
    : ''

  return `You are analyzing a software project to suggest actionable development tasks.

${contextBlock}
${focusLine}
## Instructions

Propose exactly ${count} new tasks that would meaningfully advance this project. Each task should be:
- Specific and actionable (not vague like "improve performance")
- Non-overlapping with existing items listed above
- Appropriately scoped (a few hours to a day of work, not weeks)
- Ordered by impact (most impactful first)

For each task, assign:
- A clear title (imperative, under 80 chars)
- A description with acceptance criteria (what "done" looks like)
- Priority: critical, high, medium, or low
- Labels: 1-3 from [feature, bugfix, refactor, testing, docs, dx, ui, api, infra, security, perf]
- Stage: which board stage it should start in (idea, plan, build, or claude)
  - Use "claude" if the task is well-defined enough for AI to implement autonomously
  - Use "build" for tasks requiring human judgment or external decisions
  - Use "plan" for tasks needing more research/design first
  - Use "idea" for exploratory concepts
- Rationale: one sentence explaining WHY this task matters now

Respond with ONLY a JSON array. No markdown fences, no explanation, just the JSON:
[
  {
    "title": "...",
    "description": "...",
    "priority": "...",
    "labels": ["..."],
    "stage": "...",
    "rationale": "..."
  }
]`
}

// ── Spawn Claude and collect output ─────────────────────────────

function runClaude(claudeBin: string, prompt: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      claudeBin,
      ['--print', '--output-format', 'text', '--max-turns', '1', '--tools', ''],
      {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH}` },
      },
    )

    // Pass prompt via stdin to avoid shell argument length/escaping issues
    proc.stdin.write(prompt)
    proc.stdin.end()

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        const errDetail = stderr.trim() || stdout.trim().slice(0, 500)
        reject(new Error(`Claude exited with code ${code}: ${errDetail}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn Claude: ${err.message}`))
    })

    // Timeout after 3 minutes
    setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error('Claude suggestion timed out after 3 minutes'))
    }, 180_000)
  })
}

// ── Parse suggestions from Claude output ────────────────────────

function parseSuggestions(output: string): Suggestion[] {
  const trimmed = output.trim()

  // Direct parse first
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return validateSuggestions(parsed)
  } catch {
    // not pure JSON
  }

  // Try to extract JSON array from markdown or mixed text
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (Array.isArray(parsed)) return validateSuggestions(parsed)
    } catch {
      // invalid JSON in match
    }
  }

  throw new Error('Could not parse suggestions from Claude output')
}

function validateSuggestions(arr: any[]): Suggestion[] {
  const validPriorities = ITEM_PRIORITIES as readonly string[]
  const validStages = ITEM_STAGES.filter(s => s !== 'done' && s !== 'review') as readonly string[]

  return arr
    .filter((s) => s && typeof s.title === 'string' && s.title.trim())
    .map((s) => ({
      title: String(s.title).trim().slice(0, 120),
      description: String(s.description || '').trim(),
      priority: validPriorities.includes(s.priority) ? s.priority : 'medium',
      labels: Array.isArray(s.labels) ? s.labels.map(String).slice(0, 5) : [],
      stage: validStages.includes(s.stage) ? s.stage : 'idea',
      rationale: String(s.rationale || '').trim(),
    }))
}

// ── Handler ─────────────────────────────────────────────────────

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const { project_slug, focus, count = 5 } = body

  if (!project_slug?.trim()) {
    return json({ ok: false, error: 'project_slug is required' }, { status: 400 })
  }

  const claudeBin = findClaude()
  if (!claudeBin) {
    return json({ ok: false, error: 'Claude CLI not found' }, { status: 500 })
  }

  const clampedCount = Math.min(Math.max(Number(count) || 5, 1), 10)

  logger.info('claude', 'suggest.start', `Generating ${clampedCount} suggestions for ${project_slug}`, {
    project: project_slug,
    focus: focus || null,
    count: clampedCount,
  })

  try {
    // Build pre-computed summary (architecture + metadata + items — no file scanning)
    const summary = buildProjectSummary(project_slug)
    const prompt = buildPrompt(summary, focus, clampedCount)

    // Resolve working directory
    const PROJECT_ROOT = path.resolve(process.cwd())
    let cwd = PROJECT_ROOT
    const projectPath = path.join(PROJECT_ROOT, 'projects', project_slug)
    if (fs.existsSync(projectPath)) cwd = projectPath

    logger.info('claude', 'suggest.context', `Summary: ${summary.stats.pages}p/${summary.stats.apis}a/${summary.stats.modules}m/${summary.stats.tables}t, ${summary.itemCount} items`, {
      project: project_slug,
      stats: summary.stats,
      itemCount: summary.itemCount,
    })

    const output = await runClaude(claudeBin, prompt, cwd)
    const suggestions = parseSuggestions(output)

    logger.info('claude', 'suggest.done', `Generated ${suggestions.length} suggestions for ${project_slug}`, {
      project: project_slug,
      count: suggestions.length,
    })

    return json({ ok: true, data: suggestions })
  } catch (err: any) {
    logger.error('claude', 'suggest.error', `Suggestion failed: ${err.message}`, {
      project: project_slug,
      error: err.message,
    })
    return json({ ok: false, error: err.message }, { status: 500 })
  }
}
