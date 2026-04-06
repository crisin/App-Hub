import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { randomUUID } from 'node:crypto'
import { ITEM_STAGES } from '@apphub/shared'
import type { Item, ItemStage } from '@apphub/shared'
import { autoTriggerIfNeeded, emitBoardChanged } from '$lib/server/claude-runner'
import { logger } from '$lib/server/logger'

/** GET /api/board — list all items grouped by stage (board view) */
export const GET: RequestHandler = async () => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM items ORDER BY position ASC').all() as any[]

  const stages: Record<ItemStage, Item[]> = {
    idea: [],
    plan: [],
    build: [],
    claude: [],
    review: [],
    done: [],
  }

  // Get attachment counts per item in a single query
  const attCounts = db
    .prepare('SELECT issue_id, COUNT(*) as count FROM issue_attachments GROUP BY issue_id')
    .all() as { issue_id: string; count: number }[]
  const attMap = new Map(attCounts.map((r) => [r.issue_id, r.count]))

  // Get blocked status for items
  const blockedItems = db
    .prepare(
      `SELECT DISTINCT d.item_id FROM item_dependencies d
       JOIN items blocker ON d.depends_on_id = blocker.id
       WHERE d.dependency_type = 'blocks' AND blocker.stage != 'done'`,
    )
    .all() as { item_id: string }[]
  const blockedSet = new Set(blockedItems.map((r) => r.item_id))

  for (const row of rows) {
    const item: Item = {
      ...row,
      labels: JSON.parse(row.labels || '[]'),
      attachment_count: attMap.get(row.id) ?? 0,
      is_blocked: blockedSet.has(row.id),
    }
    if (stages[item.stage as ItemStage]) {
      stages[item.stage as ItemStage].push(item)
    }
  }

  return json({ ok: true, data: stages })
}

/** POST /api/board — create a new item */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const { title, description, priority, labels, lane, stage, project_scope, project_slug } = body

  if (!title?.trim()) {
    return json({ ok: false, error: 'title is required' }, { status: 400 })
  }

  // Accept either 'stage' or legacy 'lane' field
  const targetStage = stage && ITEM_STAGES.includes(stage)
    ? stage
    : lane && ITEM_STAGES.includes(lane)
      ? lane
      : 'idea'

  const db = getDb()

  const maxPos = db
    .prepare('SELECT COALESCE(MAX(position), -1) as max FROM items WHERE stage = ?')
    .get(targetStage) as { max: number }

  const id = `issue-${randomUUID().slice(0, 8)}`
  const now = new Date().toISOString()
  const slug = project_slug?.trim() || project_scope?.trim() || 'hub'

  db.prepare(
    `INSERT INTO items (id, project_slug, title, description, stage, priority, labels, position, assigned_to, parent_id, item_type, created, updated)
     VALUES (@id, @project_slug, @title, @description, @stage, @priority, @labels, @position, '', NULL, 'task', @created, @updated)`,
  ).run({
    id,
    project_slug: slug,
    title: title.trim(),
    description: description?.trim() ?? '',
    stage: targetStage,
    priority: priority ?? 'medium',
    labels: JSON.stringify(labels ?? []),
    position: maxPos.max + 1,
    created: now,
    updated: now,
  })

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any
  item.labels = JSON.parse(item.labels || '[]')

  logger.info('board', 'item.created', `Created "${title.trim()}" in ${targetStage} (project: ${slug})`, {
    itemId: id,
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
