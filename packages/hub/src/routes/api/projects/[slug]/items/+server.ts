import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { randomUUID } from 'node:crypto'
import { ITEM_STAGES } from '@apphub/shared'
import type { ItemStage } from '@apphub/shared'
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

  // Build query with optional filters
  const stage = url.searchParams.get('stage')
  const type = url.searchParams.get('type')
  const assigned = url.searchParams.get('assigned_to')
  const search = url.searchParams.get('q')

  let where = 'WHERE project_slug = ?'
  const queryParams: unknown[] = [params.slug]

  if (stage && ITEM_STAGES.includes(stage as ItemStage)) {
    where += ' AND stage = ?'
    queryParams.push(stage)
  }
  if (type) {
    where += ' AND item_type = ?'
    queryParams.push(type)
  }
  if (assigned) {
    where += ' AND assigned_to = ?'
    queryParams.push(assigned)
  }
  if (search) {
    where += ' AND (title LIKE ? OR description LIKE ?)'
    const pattern = `%${search}%`
    queryParams.push(pattern, pattern)
  }

  const rows = db
    .prepare(`SELECT * FROM items ${where} ORDER BY stage, position ASC`)
    .all(...queryParams) as any[]

  // Get attachment counts
  const itemIds = rows.map((r) => r.id)
  const attMap = new Map<string, number>()
  if (itemIds.length > 0) {
    const placeholders = itemIds.map(() => '?').join(',')
    const attCounts = db
      .prepare(
        `SELECT issue_id, COUNT(*) as count FROM issue_attachments WHERE issue_id IN (${placeholders}) GROUP BY issue_id`,
      )
      .all(...itemIds) as { issue_id: string; count: number }[]
    for (const r of attCounts) attMap.set(r.issue_id, r.count)
  }

  // Get child counts
  const childMap = new Map<string, number>()
  if (itemIds.length > 0) {
    const placeholders = itemIds.map(() => '?').join(',')
    const childCounts = db
      .prepare(
        `SELECT parent_id, COUNT(*) as count FROM items WHERE parent_id IN (${placeholders}) GROUP BY parent_id`,
      )
      .all(...itemIds) as { parent_id: string; count: number }[]
    for (const r of childCounts) childMap.set(r.parent_id, r.count)
  }

  // Group by stage
  const stages: Record<ItemStage, any[]> = {
    idea: [],
    plan: [],
    build: [],
    review: [],
    done: [],
  }

  for (const row of rows) {
    const item = {
      ...row,
      labels: JSON.parse(row.labels || '[]'),
      attachment_count: attMap.get(row.id) ?? 0,
      child_count: childMap.get(row.id) ?? 0,
    }
    if (stages[item.stage as ItemStage]) {
      stages[item.stage as ItemStage].push(item)
    }
  }

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
  const { title, description, stage, priority, labels, item_type, parent_id } = body

  if (!title?.trim()) {
    return json({ ok: false, error: 'title is required' }, { status: 400 })
  }

  const targetStage = stage && ITEM_STAGES.includes(stage) ? stage : 'idea'

  // Get next position
  const maxPos = db
    .prepare(
      'SELECT COALESCE(MAX(position), -1) as max FROM items WHERE project_slug = ? AND stage = ?',
    )
    .get(params.slug, targetStage) as { max: number }

  const id = `item-${randomUUID().slice(0, 8)}`
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO items (id, project_slug, title, description, stage, priority, labels, position, assigned_to, parent_id, item_type, created, updated)
     VALUES (@id, @project_slug, @title, @description, @stage, @priority, @labels, @position, '', @parent_id, @item_type, @created, @updated)`,
  ).run({
    id,
    project_slug: params.slug,
    title: title.trim(),
    description: description?.trim() ?? '',
    stage: targetStage,
    priority: priority ?? 'medium',
    labels: JSON.stringify(labels ?? []),
    position: maxPos.max + 1,
    parent_id: parent_id || null,
    item_type: item_type ?? 'task',
    created: now,
    updated: now,
  })

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any
  item.labels = JSON.parse(item.labels || '[]')

  logger.info('board', 'item.created', `Created "${title.trim()}" in ${params.slug}/${targetStage}`, {
    itemId: id,
    project: params.slug,
    stage: targetStage,
  })

  emitBoardChanged()
  return json({ ok: true, data: item }, { status: 201 })
}
