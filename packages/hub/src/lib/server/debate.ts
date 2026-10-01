/**
 * Debate workflow — an idea must defend itself.
 *
 * Roles are regular agents from the registry (critic / advocate / judge by
 * default, overridable per run). Flow:
 *
 *   round 1..n:  critic attacks → advocate defends
 *   finally:     judge reads the full transcript and delivers a verdict
 *
 * The full transcript is returned to the caller and written to
 * logs/agents/ as a markdown report (markdown as source of truth).
 */
import fs from 'node:fs'
import path from 'node:path'
import { getAgent, runAgent, type AgentDef } from './agents.js'
import { getItemDetail, addClaudeNote } from './data.js'
import { getDb } from './db.js'
import { emitBoardChanged } from './claude-runner.js'
import { logger } from './logger.js'
import { PATHS } from './config.js'

const AGENT_LOG_DIR = path.join(PATHS.logs, 'agents')

export interface DebateTurn {
  role: string
  agent: string
  round: number
  text: string
  model: string
  provider: string
  durationMs: number
}

export interface DebateResult {
  topic: string
  turns: DebateTurn[]
  verdict: string
  reportPath: string
  totalDurationMs: number
}

export interface DebateOptions {
  rounds?: number
  criticSlug?: string
  advocateSlug?: string
  judgeSlug?: string
}

function requireAgent(slug: string): AgentDef {
  const agent = getAgent(slug)
  if (!agent) {
    throw new Error(
      `Agent "${slug}" not found. Create agents/${slug}.md or pass a different agent slug.`,
    )
  }
  return agent
}

function writeReport(topic: string, turns: DebateTurn[], verdict: string): string {
  fs.mkdirSync(AGENT_LOG_DIR, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const reportPath = path.join(AGENT_LOG_DIR, `debate_${ts}.md`)

  const lines: string[] = [
    `# Debate Report`,
    ``,
    `**Date:** ${new Date().toISOString()}`,
    ``,
    `## Topic`,
    ``,
    topic,
    ``,
  ]
  for (const turn of turns) {
    lines.push(
      `## Round ${turn.round} — ${turn.role} (${turn.agent}, ${turn.model})`,
      ``,
      turn.text,
      ``,
    )
  }
  lines.push(`## Verdict`, ``, verdict, ``)
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8')
  return reportPath
}

export async function runDebate(topic: string, opts: DebateOptions = {}): Promise<DebateResult> {
  const rounds = Math.min(Math.max(opts.rounds ?? 1, 1), 3)
  const critic = requireAgent(opts.criticSlug ?? 'critic')
  const advocate = requireAgent(opts.advocateSlug ?? 'advocate')
  const judge = requireAgent(opts.judgeSlug ?? 'judge')

  const started = Date.now()
  const turns: DebateTurn[] = []

  logger.info('agents', 'debate.start', `Debate started (${rounds} round(s))`, {
    rounds,
    critic: critic.slug,
    advocate: advocate.slug,
    judge: judge.slug,
  })

  let lastDefense: string | null = null

  for (let round = 1; round <= rounds; round++) {
    // Critic attacks — sees the topic and, in later rounds, the latest defense
    let criticPrompt = `THE IDEA UNDER SCRUTINY:\n\n${topic}`
    if (lastDefense) {
      criticPrompt += `\n\nTHE ADVOCATE'S LATEST DEFENSE:\n\n${lastDefense}\n\nPress further: which weaknesses remain unaddressed? What new problems does the defense itself introduce?`
    }
    const critique = await runAgent(critic, criticPrompt)
    turns.push({
      role: 'critic',
      agent: critic.slug,
      round,
      text: critique.text,
      model: critique.model,
      provider: critique.provider,
      durationMs: critique.durationMs,
    })

    // Advocate defends
    const defensePrompt = `THE IDEA YOU ARE DEFENDING:\n\n${topic}\n\nTHE CRITIC'S ATTACK:\n\n${critique.text}\n\nDefend the idea. Concede what is genuinely wrong, counter what is not, and strengthen the proposal where possible.`
    const defense = await runAgent(advocate, defensePrompt)
    turns.push({
      role: 'advocate',
      agent: advocate.slug,
      round,
      text: defense.text,
      model: defense.model,
      provider: defense.provider,
      durationMs: defense.durationMs,
    })
    lastDefense = defense.text
  }

  // Judge delivers the verdict on the full transcript
  const transcript = turns
    .map((t) => `--- Round ${t.round}, ${t.role.toUpperCase()} ---\n${t.text}`)
    .join('\n\n')
  const judgePrompt = `THE IDEA:\n\n${topic}\n\nTHE DEBATE TRANSCRIPT:\n\n${transcript}\n\nDeliver your verdict.`
  const verdictResult = await runAgent(judge, judgePrompt)
  turns.push({
    role: 'judge',
    agent: judge.slug,
    round: rounds,
    text: verdictResult.text,
    model: verdictResult.model,
    provider: verdictResult.provider,
    durationMs: verdictResult.durationMs,
  })

  const reportPath = writeReport(topic, turns.slice(0, -1), verdictResult.text)
  const totalDurationMs = Date.now() - started

  logger.info('agents', 'debate.done', `Debate finished in ${Math.round(totalDurationMs / 1000)}s`, {
    rounds,
    turns: turns.length,
    reportPath,
  })

  return { topic, turns, verdict: verdictResult.text, reportPath, totalDurationMs }
}

// ── Board integration ───────────────────────────────────────────────

/** Build the debate topic for a board item: title + description + project context */
export function buildItemTopic(itemId: string): string | null {
  const item = getItemDetail(itemId)
  if (!item) return null

  let topic = `# ${item.title}`
  if (item.description?.trim()) {
    topic += `\n\n${item.description.trim()}`
  }
  if (item.project_slug) {
    const db = getDb()
    const project = db
      .prepare('SELECT name, description FROM projects WHERE slug = ?')
      .get(item.project_slug) as { name?: string; description?: string } | undefined
    if (project?.name) {
      topic += `\n\n(Context: this is an idea for the project "${project.name}"`
      if (project.description) topic += ` — ${project.description}`
      topic += `)`
    }
  }
  return topic
}

/**
 * Run the debate on a board item and record the verdict as a note.
 * Used by the critique API route and the "debate" label hook.
 */
export async function critiqueBoardItem(
  itemId: string,
  opts: DebateOptions = {},
): Promise<DebateResult> {
  const topic = buildItemTopic(itemId)
  if (!topic) throw new Error(`Item "${itemId}" not found`)

  const result = await runDebate(topic, opts)

  // Verdict summary as a note on the item (notes are capped at 200 chars)
  const scoreMatch = result.verdict.match(/\*\*Score:\*\*\s*(\d+)/i)
  const recMatch = result.verdict.match(/\b(PROCEED|REVISE|DROP)\b/)
  const summary = [
    'Debate verdict:',
    scoreMatch ? `score ${scoreMatch[1]}/10,` : '',
    recMatch ? recMatch[1] : 'see report',
    `— ${result.reportPath}`,
  ]
    .filter(Boolean)
    .join(' ')
  addClaudeNote(itemId, 'info', summary)
  emitBoardChanged()

  return result
}

/**
 * Fire-and-forget hook: items labeled "debate" get critiqued automatically
 * on creation. Errors land as a note on the item, never in the caller.
 */
export function autoCritiqueIfLabeled(itemId: string, labels: unknown): void {
  if (!Array.isArray(labels) || !labels.map(String).includes('debate')) return

  logger.info('agents', 'debate.auto', `Auto-critique triggered for ${itemId} (label "debate")`, {
    itemId,
  })
  addClaudeNote(itemId, 'progress', 'Debate started (label "debate") — verdict will follow')
  emitBoardChanged()

  void critiqueBoardItem(itemId).catch((e) => {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('agents', 'debate.auto_error', `Auto-critique failed for ${itemId}: ${msg}`, {
      itemId,
    })
    try {
      addClaudeNote(itemId, 'error', `Debate failed: ${msg}`.slice(0, 200))
      emitBoardChanged()
    } catch {
      /* ignore */
    }
  })
}
