import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { ITEM_STAGES } from '@apphub/shared'
import type { ItemStage } from '@apphub/shared'
import { listItemsByStage, createItem } from '$lib/server/data'
import { emitBoardChanged } from '$lib/server/claude-runner'
import { logger } from '$lib/server/logger'

/** GET /api/projects/:slug/items — list items for a project */
export const GET: RequestHandler = async ({ params, url }) => {
  const db = getDb()

  // Verify project exists
  const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(params.slug)
  if (!project) {
    return json({ ok: false, error: 'Project not found' }, { status: 404 })
  }

  const stage = url.searchParams.get('stage') as ItemStage | null
  const type = url.searchParams.get('type') || undefined
  const assigned = url.searchParams.get('assigned_to') || undefined
  const search = url.searchParams.get('q') || undefined

  const stages = listItemsByStage({
    project: params.slug,
    ...(stage && ITEM_STAGES.includes(stage) ? { stage } : {}),
    ...(type ? { item_type: type } : {}),
    ...(assigned ? { assigned_to: assigned } : {}),
    ...(search ? { search } : {}),
  })

  return json({ ok: true, data: stages })
}

/** POST /api/projects/:slug/items — create a new item */
export const POST: RequestHandler = async ({ params, request }) => {
  const db = getDb()

  // Verify project exists
  const project = db.prepare('SELECT slug FROM projects WHERE slug = ?').get(params.slug)
  if (!project) {
    return json({ ok: false, error: 'Project not found' }, { status: 404 })
  }

  const body = await request.json()
  const { title, description, stage, priority, labels, item_type, parent_id, phase_id } = body

  if (!title?.trim()) {
    return json({ ok: false, error: 'title is required' }, { status: 400 })
  }

  const item = createItem({
    title: title.trim(),
    description: description?.trim(),
    stage,
    priority,
    labels,
    project_slug: params.slug,
    item_type,
    parent_id,
    phase_id,
  })

  logger.info('board', 'item.created', `Created "${title.trim()}" in ${params.slug}/${item.stage}`, {
    itemId: item.id,
    project: params.slug,
    stage: item.stage,
  })

  emitBoardChanged()
  return json({ ok: true, data: item }, { status: 201 })
}
