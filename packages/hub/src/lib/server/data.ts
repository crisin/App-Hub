/**
 * Data Access Layer — centralized query functions for all tables.
 *
 * Every SQL query in the app should flow through this module.
 * Routes and page loaders call these functions instead of getDb() directly.
 */
import { getDb } from './db.js'
import { randomUUID } from 'node:crypto'
import type { Item, ItemStage, Phase } from '@apphub/shared'
import { ITEM_STAGES, DEFAULT_PHASES } from '@apphub/shared'

// ── Types ───────────────────────────────────────────────────────────

export interface ItemFilters {
  stage?: ItemStage
  project?: string
  assigned_to?: string
  search?: string
  item_type?: string
  parent_id?: string
}

export interface ItemWithMeta extends Item {
  attachment_count: number
  child_count: number
  is_blocked: boolean
  // Optional joined project fields
  project_name?: string
  project_color?: string
  project_icon?: string
}

export interface ItemDetail extends ItemWithMeta {
  attachments: any[]
  notes: any[]
  blocked_by: any[]
  blocks: any[]
  children: any[]
}

export interface ProjectFilter {
  slug: string
  name: string
  color: string
  icon: string
  itemCount: number
}

// ── Shared query fragments ──────────────────────────────────────────

/** Get attachment counts as a Map<itemId, count> */
export function getAttachmentCounts(itemIds?: string[]): Map<string, number> {
  const db = getDb()
  const map = new Map<string, number>()

  if (itemIds && itemIds.length === 0) return map

  if (itemIds) {
    const placeholders = itemIds.map(() => '?').join(',')
    const rows = db
      .prepare(
        `SELECT issue_id, COUNT(*) as count FROM issue_attachments
         WHERE issue_id IN (${placeholders}) GROUP BY issue_id`,
      )
      .all(...itemIds) as { issue_id: string; count: number }[]
    for (const r of rows) map.set(r.issue_id, r.count)
  } else {
    const rows = db
      .prepare('SELECT issue_id, COUNT(*) as count FROM issue_attachments GROUP BY issue_id')
      .all() as { issue_id: string; count: number }[]
    for (const r of rows) map.set(r.issue_id, r.count)
  }

  return map
}

/** Get child item counts as a Map<parentId, count> */
export function getChildCounts(itemIds?: string[]): Map<string, number> {
  const db = getDb()
  const map = new Map<string, number>()

  if (itemIds && itemIds.length === 0) return map

  if (itemIds) {
    const placeholders = itemIds.map(() => '?').join(',')
    const rows = db
      .prepare(
        `SELECT parent_id, COUNT(*) as count FROM items
         WHERE parent_id IN (${placeholders}) GROUP BY parent_id`,
      )
      .all(...itemIds) as { parent_id: string; count: number }[]
    for (const r of rows) map.set(r.parent_id, r.count)
  } else {
    const rows = db
      .prepare(
        'SELECT parent_id, COUNT(*) as count FROM items WHERE parent_id IS NOT NULL GROUP BY parent_id',
      )
      .all() as { parent_id: string; count: number }[]
    for (const r of rows) map.set(r.parent_id, r.count)
  }

  return map
}

/** Get the set of item IDs that are blocked by unfinished dependencies */
export function getBlockedItemIds(): Set<string> {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT DISTINCT d.item_id FROM item_dependencies d
       JOIN items blocker ON d.depends_on_id = blocker.id
       WHERE d.dependency_type = 'blocks' AND blocker.stage != 'done'`,
    )
    .all() as { item_id: string }[]
  return new Set(rows.map((r) => r.item_id))
}

/** Parse a raw DB row into an Item with labels parsed */
function parseItemRow(row: any): Item {
  return {
    ...row,
    labels: JSON.parse(row.labels || '[]'),
  }
}

// ── Item queries ────────────────────────────────────────────────────

/**
 * List items grouped by stage, with attachment counts and blocked status.
 * This is the primary query for board and project views.
 */
export function listItemsByStage(
  filters?: ItemFilters,
  options?: { includeProjectInfo?: boolean },
): Record<ItemStage, ItemWithMeta[]> {
  const db = getDb()

  const conditions: string[] = []
  const params: unknown[] = []

  if (filters?.project) {
    conditions.push('i.project_slug = ?')
    params.push(filters.project)
  }
  if (filters?.stage && ITEM_STAGES.includes(filters.stage)) {
    conditions.push('i.stage = ?')
    params.push(filters.stage)
  }
  if (filters?.item_type) {
    conditions.push('i.item_type = ?')
    params.push(filters.item_type)
  }
  if (filters?.assigned_to) {
    conditions.push('i.assigned_to = ?')
    params.push(filters.assigned_to)
  }
  if (filters?.search) {
    conditions.push('(i.title LIKE ? OR i.description LIKE ?)')
    const pattern = `%${filters.search}%`
    params.push(pattern, pattern)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const projectJoin = options?.includeProjectInfo
    ? 'LEFT JOIN projects p ON i.project_slug = p.slug'
    : ''
  const projectFields = options?.includeProjectInfo
    ? ', p.name as project_name, p.color as project_color, p.icon as project_icon'
    : ''

  const rows = db
    .prepare(
      `SELECT i.*${projectFields} FROM items i ${projectJoin} ${where}
       ORDER BY i.stage, i.position ASC`,
    )
    .all(...params) as any[]

  const itemIds = rows.map((r: any) => r.id)
  const attMap = getAttachmentCounts(itemIds)
  const childMap = getChildCounts(itemIds)
  const blockedSet = getBlockedItemIds()

  const stages: Record<ItemStage, ItemWithMeta[]> = {
    idea: [],
    plan: [],
    build: [],
    claude: [],
    review: [],
    done: [],
  }

  for (const row of rows) {
    const item: ItemWithMeta = {
      ...parseItemRow(row),
      attachment_count: attMap.get(row.id) ?? 0,
      child_count: childMap.get(row.id) ?? 0,
      is_blocked: blockedSet.has(row.id),
      ...(options?.includeProjectInfo && {
        project_name: row.project_name,
        project_color: row.project_color,
        project_icon: row.project_icon,
      }),
    }
    if (stages[item.stage as ItemStage]) {
      stages[item.stage as ItemStage].push(item)
    }
  }

  return stages
}

/**
 * List items as a flat array (with optional filters and project info).
 */
export function listItems(
  filters?: ItemFilters,
  options?: { includeProjectInfo?: boolean },
): ItemWithMeta[] {
  const stages = listItemsByStage(filters, options)
  return Object.values(stages).flat()
}

/**
 * Get a single item with full context: attachments, notes, dependencies, children.
 */
export function getItemDetail(id: string): ItemDetail | null {
  const db = getDb()

  const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any
  if (!row) return null

  const attachments = db
    .prepare('SELECT * FROM issue_attachments WHERE issue_id = ? ORDER BY created ASC')
    .all(id)

  const notes = db
    .prepare('SELECT * FROM claude_notes WHERE issue_id = ? ORDER BY created ASC')
    .all(id)

  const blocked_by = db
    .prepare(
      `SELECT d.*, i.title as depends_on_title, i.stage as depends_on_stage, i.project_slug as depends_on_project
       FROM item_dependencies d
       JOIN items i ON d.depends_on_id = i.id
       WHERE d.item_id = ?
       ORDER BY d.created ASC`,
    )
    .all(id) as any[]

  const blocks = db
    .prepare(
      `SELECT d.*, i.title as item_title, i.stage as item_stage
       FROM item_dependencies d
       JOIN items i ON d.item_id = i.id
       WHERE d.depends_on_id = ?
       ORDER BY d.created ASC`,
    )
    .all(id) as any[]

  const children = db
    .prepare('SELECT * FROM items WHERE parent_id = ? ORDER BY position ASC')
    .all(id) as any[]

  const blockedSet = getBlockedItemIds()

  return {
    ...parseItemRow(row),
    attachment_count: attachments.length,
    child_count: children.length,
    is_blocked: blockedSet.has(id),
    attachments,
    notes,
    blocked_by,
    blocks,
    children: children.map(parseItemRow),
  }
}

/**
 * Create a new item. Returns the created item.
 */
export function createItem(data: {
  title: string
  description?: string
  stage?: string
  priority?: string
  labels?: string[]
  project_slug?: string
  item_type?: string
  parent_id?: string | null
  phase_id?: string | null
}): Item {
  const db = getDb()
  const targetStage = data.stage && ITEM_STAGES.includes(data.stage as ItemStage) ? data.stage : 'idea'

  const maxPos = db
    .prepare(
      'SELECT COALESCE(MAX(position), -1) as max FROM items WHERE project_slug = ? AND stage = ?',
    )
    .get(data.project_slug || 'hub', targetStage) as { max: number }

  const id = `item-${randomUUID().slice(0, 8)}`
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO items (id, project_slug, title, description, stage, priority, labels, position, assigned_to, parent_id, phase_id, item_type, created, updated)
     VALUES (@id, @project_slug, @title, @description, @stage, @priority, @labels, @position, '', @parent_id, @phase_id, @item_type, @created, @updated)`,
  ).run({
    id,
    project_slug: data.project_slug || 'hub',
    title: data.title.trim(),
    description: data.description?.trim() ?? '',
    stage: targetStage,
    priority: data.priority ?? 'medium',
    labels: JSON.stringify(data.labels ?? []),
    position: maxPos.max + 1,
    parent_id: data.parent_id || null,
    phase_id: data.phase_id || null,
    item_type: data.item_type ?? 'task',
    created: now,
    updated: now,
  })

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any
  return parseItemRow(item)
}

/**
 * Update an item by ID. Returns updated item or null if not found.
 */
export function updateItem(
  id: string,
  updates: Partial<{
    title: string
    description: string
    stage: string
    priority: string
    labels: string[]
    position: number
    assigned_to: string
    project_slug: string
    item_type: string
    parent_id: string | null
    phase_id: string | null
  }>,
): Item | null {
  const db = getDb()

  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any
  if (!existing) return null

  const allowedFields = [
    'title',
    'description',
    'stage',
    'priority',
    'labels',
    'position',
    'assigned_to',
    'project_slug',
    'item_type',
    'parent_id',
    'phase_id',
  ]

  const setClauses: string[] = []
  const values: Record<string, unknown> = { id }

  for (const [key, value] of Object.entries(updates)) {
    if (!allowedFields.includes(key)) continue
    if (key === 'labels') {
      setClauses.push(`${key} = @${key}`)
      values[key] = JSON.stringify(value)
    } else {
      setClauses.push(`${key} = @${key}`)
      values[key] = value
    }
  }

  if (setClauses.length === 0) return parseItemRow(existing)

  setClauses.push('updated = @updated')
  values.updated = new Date().toISOString()

  db.prepare(`UPDATE items SET ${setClauses.join(', ')} WHERE id = @id`).run(values)

  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as any
  return parseItemRow(updated)
}

/**
 * Delete an item and its dependencies. Returns true if deleted.
 */
export function deleteItem(id: string): boolean {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM items WHERE id = ?').get(id)
  if (!existing) return false

  db.prepare('DELETE FROM item_dependencies WHERE item_id = ? OR depends_on_id = ?').run(id, id)
  db.prepare('DELETE FROM claude_notes WHERE issue_id = ?').run(id)
  db.prepare('DELETE FROM issue_attachments WHERE issue_id = ?').run(id)
  db.prepare('DELETE FROM items WHERE id = ?').run(id)
  return true
}

/**
 * Reorder items: apply a batch of position updates within a stage.
 */
export function reorderItems(moves: { id: string; stage: string; position: number }[]) {
  const db = getDb()
  const stmt = db.prepare(
    'UPDATE items SET stage = @stage, position = @position, updated = @updated WHERE id = @id',
  )
  const now = new Date().toISOString()
  const txn = db.transaction(() => {
    for (const move of moves) {
      stmt.run({ id: move.id, stage: move.stage, position: move.position, updated: now })
    }
  })
  txn()
}

/**
 * Get next position for a stage (used when moving items to a new stage).
 */
export function getNextPosition(stage: string, projectSlug?: string): number {
  const db = getDb()
  let query = 'SELECT COALESCE(MAX(position), -1) as max FROM items WHERE stage = ?'
  const params: unknown[] = [stage]
  if (projectSlug) {
    query += ' AND project_slug = ?'
    params.push(projectSlug)
  }
  const result = db.prepare(query).get(...params) as { max: number }
  return result.max + 1
}

// ── Claude-specific queries ─────────────────────────────────────────

/**
 * Get unclaimed, unblocked items in the Claude stage, ordered by priority.
 */
export function getUnclaimedClaudeItems(): Item[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT i.* FROM items i
       WHERE i.stage = 'claude'
         AND (i.assigned_to = '' OR i.assigned_to IS NULL)
         AND NOT EXISTS (
           SELECT 1 FROM item_dependencies d
           JOIN items blocker ON d.depends_on_id = blocker.id
           WHERE d.item_id = i.id AND d.dependency_type = 'blocks' AND blocker.stage != 'done'
         )
       ORDER BY
         CASE i.priority
           WHEN 'critical' THEN 0 WHEN 'high' THEN 1
           WHEN 'medium' THEN 2 WHEN 'low' THEN 3
         END,
         i.position ASC`,
    )
    .all() as any[]
  return rows.map(parseItemRow)
}

/**
 * Check if there are any unclaimed, unblocked Claude items.
 */
export function hasUnclaimedClaudeItems(): boolean {
  return getUnclaimedClaudeItems().length > 0
}

/**
 * Add a claude note to an item.
 */
export function addClaudeNote(
  issueId: string,
  type: 'progress' | 'commit' | 'error' | 'info',
  message: string,
) {
  const db = getDb()
  const id = `note-${Date.now().toString(36)}`
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO claude_notes (id, issue_id, type, message, created)
     VALUES (@id, @issue_id, @type, @message, @created)`,
  ).run({ id, issue_id: issueId, type, message: message.slice(0, 200), created: now })
}

// ── Project queries ─────────────────────────────────────────────────

/**
 * Get projects that have items, with item counts (for filter UIs).
 */
export function getProjectFilters(): ProjectFilter[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT i.project_slug as slug, COUNT(*) as count,
              COALESCE(p.name, i.project_slug) as name,
              COALESCE(p.color, '') as color,
              COALESCE(p.icon, '') as icon
       FROM items i
       LEFT JOIN projects p ON i.project_slug = p.slug
       GROUP BY i.project_slug
       ORDER BY count DESC`,
    )
    .all() as any[]

  return rows.map((p: any) => ({
    slug: p.slug,
    name: p.name,
    color: p.color || (p.slug === 'hub' ? '#6366f1' : ''),
    icon: p.icon || (p.slug === 'hub' ? '\u2B21' : ''),
    itemCount: p.count,
  }))
}

// ── Dependencies ────────────────────────────────────────────────────

/**
 * Get dependencies for an item (both directions).
 */
export function getItemDependencies(itemId: string) {
  const db = getDb()

  const blockedBy = db
    .prepare(
      `SELECT d.*, i.title as depends_on_title, i.stage as depends_on_stage, i.project_slug as depends_on_project
       FROM item_dependencies d
       JOIN items i ON d.depends_on_id = i.id
       WHERE d.item_id = ?
       ORDER BY d.created ASC`,
    )
    .all(itemId)

  const blocks = db
    .prepare(
      `SELECT d.*, i.title as item_title, i.stage as item_stage
       FROM item_dependencies d
       JOIN items i ON d.item_id = i.id
       WHERE d.depends_on_id = ?
       ORDER BY d.created ASC`,
    )
    .all(itemId)

  return { blockedBy, blocks }
}

// ── Notes ───────────────────────────────────────────────────────────

/**
 * List notes for an item.
 */
export function listNotes(issueId: string) {
  const db = getDb()
  return db
    .prepare('SELECT * FROM claude_notes WHERE issue_id = ? ORDER BY created ASC')
    .all(issueId)
}

// ── Phases ─────────────────────────────────────────────────────────

/**
 * List phases for a project, with item counts and completion percentages.
 */
export function listPhases(projectSlug: string): Phase[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT ph.*,
              COUNT(i.id) as item_count,
              SUM(CASE WHEN i.stage = 'done' THEN 1 ELSE 0 END) as done_count
       FROM phases ph
       LEFT JOIN items i ON i.phase_id = ph.id
       WHERE ph.project_slug = ?
       GROUP BY ph.id
       ORDER BY ph.position ASC`,
    )
    .all(projectSlug) as any[]

  return rows.map((r: any) => ({
    ...r,
    item_count: r.item_count ?? 0,
    done_count: r.done_count ?? 0,
    completion_pct: r.item_count > 0 ? Math.round((r.done_count / r.item_count) * 100) : 0,
  }))
}

/**
 * Get a single phase by ID.
 */
export function getPhase(id: string): Phase | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM phases WHERE id = ?').get(id) as any
  return row ?? null
}

/**
 * Create a new phase. Returns the created phase.
 */
export function createPhase(data: {
  project_slug: string
  name: string
  status?: string
  target_date?: string | null
}): Phase {
  const db = getDb()

  const maxPos = db
    .prepare('SELECT COALESCE(MAX(position), -1) as max FROM phases WHERE project_slug = ?')
    .get(data.project_slug) as { max: number }

  const id = `phase-${randomUUID().slice(0, 8)}`
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO phases (id, project_slug, name, position, status, target_date, created, updated)
     VALUES (@id, @project_slug, @name, @position, @status, @target_date, @created, @updated)`,
  ).run({
    id,
    project_slug: data.project_slug,
    name: data.name.trim(),
    position: maxPos.max + 1,
    status: data.status ?? 'upcoming',
    target_date: data.target_date ?? null,
    created: now,
    updated: now,
  })

  return db.prepare('SELECT * FROM phases WHERE id = ?').get(id) as Phase
}

/**
 * Update a phase. Returns updated phase or null.
 */
export function updatePhase(
  id: string,
  updates: Partial<{ name: string; status: string; target_date: string | null; position: number }>,
): Phase | null {
  const db = getDb()
  const existing = db.prepare('SELECT * FROM phases WHERE id = ?').get(id)
  if (!existing) return null

  const allowedFields = ['name', 'status', 'target_date', 'position']
  const setClauses: string[] = []
  const values: Record<string, unknown> = { id }

  for (const [key, value] of Object.entries(updates)) {
    if (!allowedFields.includes(key)) continue
    setClauses.push(`${key} = @${key}`)
    values[key] = value
  }

  if (setClauses.length === 0) return existing as Phase

  setClauses.push('updated = @updated')
  values.updated = new Date().toISOString()

  db.prepare(`UPDATE phases SET ${setClauses.join(', ')} WHERE id = @id`).run(values)
  return db.prepare('SELECT * FROM phases WHERE id = ?').get(id) as Phase
}

/**
 * Delete a phase. Unsets phase_id on items that referenced it.
 */
export function deletePhase(id: string): boolean {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM phases WHERE id = ?').get(id)
  if (!existing) return false

  db.prepare('UPDATE items SET phase_id = NULL, updated = ? WHERE phase_id = ?').run(
    new Date().toISOString(),
    id,
  )
  db.prepare('DELETE FROM phases WHERE id = ?').run(id)
  return true
}

/**
 * Reorder phases within a project.
 */
export function reorderPhases(moves: { id: string; position: number }[]) {
  const db = getDb()
  const stmt = db.prepare('UPDATE phases SET position = @position, updated = @updated WHERE id = @id')
  const now = new Date().toISOString()
  const txn = db.transaction(() => {
    for (const move of moves) {
      stmt.run({ id: move.id, position: move.position, updated: now })
    }
  })
  txn()
}

/**
 * Seed default phases for a project (Planning, Build, Test, Ship).
 */
export function seedDefaultPhases(projectSlug: string) {
  const db = getDb()
  const existing = db
    .prepare('SELECT COUNT(*) as c FROM phases WHERE project_slug = ?')
    .get(projectSlug) as { c: number }
  if (existing.c > 0) return

  const now = new Date().toISOString()
  const stmt = db.prepare(
    `INSERT INTO phases (id, project_slug, name, position, status, created, updated)
     VALUES (@id, @project_slug, @name, @position, @status, @created, @updated)`,
  )
  const txn = db.transaction(() => {
    for (let i = 0; i < DEFAULT_PHASES.length; i++) {
      stmt.run({
        id: `phase-${randomUUID().slice(0, 8)}`,
        project_slug: projectSlug,
        name: DEFAULT_PHASES[i],
        position: i,
        status: i === 0 ? 'active' : 'upcoming',
        created: now,
        updated: now,
      })
    }
  })
  txn()
}
