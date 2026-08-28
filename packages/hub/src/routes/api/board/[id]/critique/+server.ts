/**
 * POST /api/board/:id/critique — run the debate workflow on a board item.
 * The item (title + description + project context) becomes the topic;
 * critic/advocate/judge agents debate it, the verdict lands as a note
 * on the item and the full report as markdown in logs/agents/.
 *
 * Body: { rounds?: 1-3, critic?: slug, advocate?: slug, judge?: slug }
 */
import type { RequestHandler } from './$types'
import { ok, err } from '$lib/server/response'
import { getItemDetail, addClaudeNote } from '$lib/server/data'
import { getDb } from '$lib/server/db'
import { runDebate } from '$lib/server/debate'
import { emitBoardChanged } from '$lib/server/claude-runner'
import { logger } from '$lib/server/logger'

export const POST: RequestHandler = async ({ params, request }) => {
  const item = getItemDetail(params.id)
  if (!item) {
    return err(`Item "${params.id}" not found`, 404)
  }

  let body: { rounds?: unknown; critic?: unknown; advocate?: unknown; judge?: unknown } = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    return err('Invalid JSON body', 400)
  }

  // Build the debate topic from item + project context
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

  try {
    const result = await runDebate(topic, {
      rounds: typeof body.rounds === 'number' ? body.rounds : undefined,
      criticSlug: typeof body.critic === 'string' ? body.critic : undefined,
      advocateSlug: typeof body.advocate === 'string' ? body.advocate : undefined,
      judgeSlug: typeof body.judge === 'string' ? body.judge : undefined,
    })

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
    addClaudeNote(item.id, 'info', summary)
    emitBoardChanged()

    return ok(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('agents', 'debate.error', `Critique failed for item ${item.id}: ${msg}`, {
      itemId: item.id,
    })
    return err(msg, 502)
  }
}
