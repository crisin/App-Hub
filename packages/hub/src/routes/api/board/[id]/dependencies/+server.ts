import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import type { DbItemRow } from '$lib/server/db'
import { randomUUID } from 'node:crypto'
import { DEPENDENCY_TYPES } from '@apphub/shared'
import type { DependencyType } from '@apphub/shared'
import { emitBoardChanged } from '$lib/server/claude-runner'
import { logger } from '$lib/server/logger'

/** GET /api/board/:id/dependencies — list dependencies for an item */
export const GET: RequestHandler = async ({ params }) => {
  const db = getDb()

  // Items this one is blocked by
  const blockedBy = db
    .prepare(
      `SELECT d.*, i.title as depends_on_title, i.stage as depends_on_stage, i.project_slug as depends_on_project
       FROM item_dependencies d
       JOIN items i ON d.depends_on_id = i.id
       WHERE d.item_id = ?
       ORDER BY d.created ASC`,
    )
    .all(params.id)

  // Items this one blocks
  const blocks = db
    .prepare(
      `SELECT d.*, i.title as item_title, i.stage as item_stage
       FROM item_dependencies d
       JOIN items i ON d.item_id = i.id
       WHERE d.depends_on_id = ?
       ORDER BY d.created ASC`,
    )
    .all(params.id)

  return json({ ok: true, data: { blockedBy, blocks } })
}

/** POST /api/board/:id/dependencies — create a dependency */
export const POST: RequestHandler = async ({ params, request }) => {
  const body = await request.json()
  const { depends_on_id, dependency_type } = body

  if (!depends_on_id) {
    return json({ ok: false, error: 'depends_on_id is required' }, { status: 400 })
  }

  if (depends_on_id === params.id) {
    return json({ ok: false, error: 'An item cannot depend on itself' }, { status: 400 })
  }

  if (dependency_type && !DEPENDENCY_TYPES.includes(dependency_type)) {
    return json(
      { ok: false, error: `Invalid dependency_type: "${dependency_type}". Must be one of: ${DEPENDENCY_TYPES.join(', ')}` },
      { status: 400 },
    )
  }
  const type: DependencyType = dependency_type || 'blocks'

  const db = getDb()

  // Verify both items exist
  const item = db.prepare('SELECT id FROM items WHERE id = ?').get(params.id)
  const target = db.prepare('SELECT id, title FROM items WHERE id = ?').get(depends_on_id) as Pick<DbItemRow, 'id' | 'title'> | undefined

  if (!item) return json({ ok: false, error: 'Item not found' }, { status: 404 })
  if (!target) return json({ ok: false, error: 'Target item not found' }, { status: 404 })

  // Check for existing dependency
  const existing = db
    .prepare('SELECT id FROM item_dependencies WHERE item_id = ? AND depends_on_id = ?')
    .get(params.id, depends_on_id)

  if (existing) {
    return json({ ok: false, error: 'Dependency already exists' }, { status: 409 })
  }

  // Check for circular dependency (target depends on this item)
  const circular = db
    .prepare('SELECT id FROM item_dependencies WHERE item_id = ? AND depends_on_id = ?')
    .get(depends_on_id, params.id)

  if (circular) {
    return json({ ok: false, error: 'Circular dependency detected' }, { status: 409 })
  }

  const id = `dep-${randomUUID().slice(0, 8)}`
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO item_dependencies (id, item_id, depends_on_id, dependency_type, created)
     VALUES (@id, @item_id, @depends_on_id, @dependency_type, @created)`,
  ).run({
    id,
    item_id: params.id,
    depends_on_id,
    dependency_type: type,
    created: now,
  })

  logger.info('board', 'dependency.created', `"${params.id}" now depends on "${target.title}"`, {
    itemId: params.id,
    dependsOn: depends_on_id,
    type,
  })

  emitBoardChanged()

  const dep = db.prepare('SELECT * FROM item_dependencies WHERE id = ?').get(id)
  return json({ ok: true, data: dep }, { status: 201 })
}

/** DELETE /api/board/:id/dependencies — remove a dependency */
export const DELETE: RequestHandler = async ({ params, request }) => {
  const body = await request.json()
  const { dependency_id, depends_on_id } = body

  const db = getDb()
  let result

  if (dependency_id) {
    result = db.prepare('DELETE FROM item_dependencies WHERE id = ? AND item_id = ?').run(
      dependency_id,
      params.id,
    )
  } else if (depends_on_id) {
    result = db
      .prepare('DELETE FROM item_dependencies WHERE item_id = ? AND depends_on_id = ?')
      .run(params.id, depends_on_id)
  } else {
    return json({ ok: false, error: 'dependency_id or depends_on_id required' }, { status: 400 })
  }

  if (result.changes === 0) {
    return json({ ok: false, error: 'Dependency not found' }, { status: 404 })
  }

  logger.info('board', 'dependency.deleted', `Removed dependency from "${params.id}"`, {
    itemId: params.id,
    dependencyId: dependency_id,
    dependsOn: depends_on_id,
  })

  emitBoardChanged()
  return json({ ok: true, data: null })
}
