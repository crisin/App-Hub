import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ITEM_STAGES } from '@apphub/shared'
import { listItemsByStage, createItem } from '$lib/server/data'
import { autoTriggerIfNeeded, emitBoardChanged } from '$lib/server/claude-runner'
import { logger } from '$lib/server/logger'

/** GET /api/board — list all items grouped by stage (board view) */
export const GET: RequestHandler = async () => {
  const stages = listItemsByStage()
  return json({ ok: true, data: stages })
}

/** POST /api/board — create a new item */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const { title, description, priority, labels, stage, project_scope, project_slug, phase_id } = body

  if (!title?.trim()) {
    return json({ ok: false, error: 'title is required' }, { status: 400 })
  }

  const targetStage = stage && ITEM_STAGES.includes(stage) ? stage : 'idea'

  const slug = project_slug?.trim() || project_scope?.trim() || 'hub'

  const item = createItem({
    title: title.trim(),
    description: description?.trim(),
    stage: targetStage,
    priority,
    labels,
    project_slug: slug,
    phase_id,
  })

  logger.info('board', 'item.created', `Created "${title.trim()}" in ${targetStage} (project: ${slug})`, {
    itemId: item.id,
    stage: targetStage,
    priority: priority ?? 'medium',
    project: slug,
  })

  emitBoardChanged()

  if (targetStage === 'claude') {
    autoTriggerIfNeeded()
  }

  return json({ ok: true, data: item }, { status: 201 })
}
