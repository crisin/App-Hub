/**
 * Board files — work items as markdown, the source of truth for the board.
 *
 * Every project keeps its board inside its own repo:
 *
 *   <repo>/.apphub/items/<item-id>.md   one file per item
 *   <repo>/.apphub/phases.md            the project's phases
 *
 * Item file = YAML frontmatter (stage, priority, labels, dependencies, …) +
 * markdown body (the description) + an optional notes list at the end.
 * SQLite stays the fast index the UI and runner query.
 *
 * Write path: every mutation in data.ts writes the item's file right away
 * (write-through). Read path: importBoards() runs at startup and on sync
 * (dashboard button, `apphub sync`, after a git pull) and loads the files
 * back. Conflict rule: per item the newer `updated` wins — a file edited on
 * the other machine beats an older index row, an index row changed by a code
 * path that forgot to write through beats an older file. An item is deleted
 * from the index only when its file existed once (persisted_at) and is gone
 * now — a missed write path can never delete data.
 *
 * Machine-local runtime state stays SQLite-only on purpose: assigned_to
 * (who is working on it right now), branch reviews, activity log, dev users.
 */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { randomUUID } from 'node:crypto'
import { ITEM_STAGES } from '@apphub/shared'
import type { ItemStage } from '@apphub/shared'
import { getDb } from './db.js'
import type { DbItemRow, DbNoteRow, DbDependencyRow, DbPhaseRow } from './db.js'
import { HUB_ROOT } from './config.js'
import { logger } from './logger.js'

const ITEMS_DIR = path.join('.apphub', 'items')
const PHASES_FILE = path.join('.apphub', 'phases.md')
const NOTES_MARKER = '<!-- apphub:notes -->'
const NOTE_LINE = /^- (\S+) · (\w+) · (.*)$/

/**
 * js-yaml options for every frontmatter the hub writes: no line folding, so long titles stay
 * on one line and multi-line strings stay literal `|` blocks — diffs show real changes only.
 */
// (gray-matter hands stringify options through to js-yaml's dump; its typings don't model that)
export const YAML_DUMP = { lineWidth: -1 } as unknown as Parameters<typeof matter.stringify>[2]

// ── Locations ───────────────────────────────────────────────────────

/** Repo whose .apphub/ holds this project's board: the project's own path, or the hub repo for scopes without one (templates, removed projects) */
export function boardRootFor(projectSlug: string): string {
  const row = getDb().prepare('SELECT path FROM projects WHERE slug = ?').get(projectSlug) as { path: string } | undefined
  if (row?.path && fs.existsSync(row.path)) return row.path
  return HUB_ROOT
}

function itemFilePath(root: string, id: string): string {
  return path.join(root, ITEMS_DIR, `${id}.md`)
}

/** Write only when the content changed — keeps mtimes and git status quiet */
function writeIfChanged(file: string, content: string): void {
  try {
    if (fs.readFileSync(file, 'utf-8') === content) return
  } catch {
    /* new file */
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf-8')
}

/** YAML may turn unquoted timestamps into Dates — normalize back to ISO strings */
function str(value: unknown, fallback = ''): string {
  if (value instanceof Date) return value.toISOString()
  if (value === null || value === undefined) return fallback
  return String(value)
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

// ── Serialization ───────────────────────────────────────────────────

interface ItemFileData {
  item: Omit<DbItemRow, 'assigned_to' | 'labels'> & { labels: string[] }
  notes: { created: string; type: string; message: string }[]
  blockedBy: string[]
  relatesTo: string[]
}

function serializeItem({ item, notes, blockedBy, relatesTo }: ItemFileData): string {
  const data = {
    id: item.id,
    title: item.title,
    project: item.project_slug,
    stage: item.stage,
    priority: item.priority,
    type: item.item_type,
    labels: item.labels,
    position: item.position,
    parent: item.parent_id ?? null,
    phase: item.phase_id ?? null,
    blocked_by: blockedBy,
    relates_to: relatesTo,
    created: item.created,
    updated: item.updated,
  }
  let body = (item.description ?? '').trim()
  if (notes.length > 0) {
    const lines = notes.map((n) => `- ${n.created} · ${n.type} · ${oneLine(n.message)}`)
    body += `${body ? '\n\n' : ''}## Notes\n\n${NOTES_MARKER}\n${lines.join('\n')}`
  }
  return matter.stringify(body ? `\n${body}\n` : '\n', data, YAML_DUMP)
}

function parseItem(content: string): ItemFileData | null {
  // options object disables gray-matter's content cache (it returns shared, mutable objects)
  const { data, content: body } = matter(content, {})
  if (typeof data.id !== 'string' || typeof data.title !== 'string') return null

  let description = body
  const notes: ItemFileData['notes'] = []
  const markerAt = body.lastIndexOf(NOTES_MARKER)
  if (markerAt >= 0) {
    description = body.slice(0, markerAt).replace(/\s*## Notes\s*$/, '')
    for (const line of body.slice(markerAt + NOTES_MARKER.length).split(/\r?\n/)) {
      const m = line.match(NOTE_LINE)
      if (m) notes.push({ created: m[1], type: m[2], message: m[3] })
    }
  }

  const stage = ITEM_STAGES.includes(data.stage as ItemStage) ? (data.stage as ItemStage) : 'idea'
  const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)) : [])
  const now = new Date().toISOString()

  return {
    item: {
      id: data.id,
      title: data.title,
      description: description.trim(),
      project_slug: str(data.project, 'hub'),
      stage,
      priority: (str(data.priority, 'medium') as DbItemRow['priority']),
      item_type: (str(data.type, 'task') as DbItemRow['item_type']),
      labels: list(data.labels),
      position: Number.isFinite(Number(data.position)) ? Number(data.position) : 0,
      parent_id: data.parent ? str(data.parent) : null,
      phase_id: data.phase ? str(data.phase) : null,
      created: str(data.created, now),
      updated: str(data.updated, now),
    },
    notes,
    blockedBy: list(data.blocked_by),
    relatesTo: list(data.relates_to),
  }
}

// ── Write-through ───────────────────────────────────────────────────

/** Write an item's current index state to its board file. Never throws. */
export function persistItem(id: string): void {
  try {
    const db = getDb()
    const row = db.prepare('SELECT * FROM items WHERE id = ?').get(id) as DbItemRow | undefined
    if (!row) return
    const notes = db
      .prepare('SELECT created, type, message FROM claude_notes WHERE issue_id = ? ORDER BY created ASC, id ASC')
      .all(id) as Pick<DbNoteRow, 'created' | 'type' | 'message'>[]
    const deps = db
      .prepare('SELECT depends_on_id, dependency_type FROM item_dependencies WHERE item_id = ? ORDER BY created ASC')
      .all(id) as Pick<DbDependencyRow, 'depends_on_id' | 'dependency_type'>[]

    const { assigned_to: _runtimeOnly, labels, ...rest } = row
    const content = serializeItem({
      item: { ...rest, labels: JSON.parse(labels || '[]') },
      notes,
      blockedBy: deps.filter((d) => d.dependency_type === 'blocks').map((d) => d.depends_on_id),
      relatesTo: deps.filter((d) => d.dependency_type === 'relates_to').map((d) => d.depends_on_id),
    })
    writeIfChanged(itemFilePath(boardRootFor(row.project_slug), id), content)
    db.prepare('UPDATE items SET persisted_at = ? WHERE id = ?').run(new Date().toISOString(), id)
  } catch (err) {
    logger.warn('board', 'board.persist_failed', `Could not write board file for ${id}: ${err}`, { itemId: id })
  }
}

/** Remove an item's board file (after delete, or before moving it to another project's repo) */
export function removeItemFile(id: string, projectSlug: string): void {
  try {
    fs.rmSync(itemFilePath(boardRootFor(projectSlug), id), { force: true })
  } catch (err) {
    logger.warn('board', 'board.remove_failed', `Could not remove board file for ${id}: ${err}`, { itemId: id })
  }
}

/** True if the project's repo already carries a phases file — then import, never seed defaults */
export function hasPhasesFile(projectSlug: string): boolean {
  const project = getDb().prepare('SELECT path FROM projects WHERE slug = ?').get(projectSlug) as { path: string } | undefined
  return !!project?.path && fs.existsSync(path.join(project.path, PHASES_FILE))
}

/** Write a project's phases to <repo>/.apphub/phases.md. Never throws. */
export function persistPhases(projectSlug: string): void {
  try {
    const db = getDb()
    const project = db.prepare('SELECT path FROM projects WHERE slug = ?').get(projectSlug) as { path: string } | undefined
    // phases belong to real projects only — never write a template's phases into the hub repo
    if (!project?.path || !fs.existsSync(project.path)) return
    const phases = db
      .prepare('SELECT id, name, status, target_date, position, created, updated FROM phases WHERE project_slug = ? ORDER BY position ASC')
      .all(projectSlug) as Omit<DbPhaseRow, 'project_slug'>[]
    const content = matter.stringify(
      '\nPhases (milestones) of this project — maintained by App Hub, editable by hand.\n',
      { project: projectSlug, phases },
      YAML_DUMP,
    )
    writeIfChanged(path.join(project.path, PHASES_FILE), content)
  } catch (err) {
    logger.warn('board', 'board.persist_failed', `Could not write phases for ${projectSlug}: ${err}`)
  }
}

// ── Import (files → index) ──────────────────────────────────────────

export interface BoardSyncResult {
  /** items loaded from files into the index */
  imported: number
  /** index rows newer than their file — file rewritten */
  persisted: number
  /** items whose file disappeared (deleted elsewhere / git pull) — removed from the index */
  removed: number
  /** first sync of a repo: index rows exported to files */
  exported: number
}

function upsertFromFile(parsed: ItemFileData): void {
  const db = getDb()
  const { item, notes, blockedBy, relatesTo } = parsed
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO items (id, project_slug, title, description, stage, priority, labels, position, assigned_to, parent_id, phase_id, item_type, created, updated, persisted_at)
     VALUES (@id, @project_slug, @title, @description, @stage, @priority, @labels, @position, '', @parent_id, @phase_id, @item_type, @created, @updated, @now)
     ON CONFLICT(id) DO UPDATE SET
       project_slug = excluded.project_slug, title = excluded.title, description = excluded.description,
       stage = excluded.stage, priority = excluded.priority, labels = excluded.labels,
       position = excluded.position, parent_id = excluded.parent_id, phase_id = excluded.phase_id,
       item_type = excluded.item_type, created = excluded.created, updated = excluded.updated,
       persisted_at = excluded.persisted_at`,
  ).run({ ...item, labels: JSON.stringify(item.labels), now })

  db.prepare('DELETE FROM claude_notes WHERE issue_id = ?').run(item.id)
  const insertNote = db.prepare(
    'INSERT INTO claude_notes (id, issue_id, type, message, created) VALUES (?, ?, ?, ?, ?)',
  )
  notes.forEach((n, i) => insertNote.run(`note-${item.id}-${i}`, item.id, n.type, n.message, n.created))

  db.prepare('DELETE FROM item_dependencies WHERE item_id = ?').run(item.id)
  const insertDep = db.prepare(
    'INSERT OR IGNORE INTO item_dependencies (id, item_id, depends_on_id, dependency_type, created) VALUES (?, ?, ?, ?, ?)',
  )
  for (const dep of blockedBy) insertDep.run(`dep-${randomUUID().slice(0, 8)}`, item.id, dep, 'blocks', now)
  for (const dep of relatesTo) insertDep.run(`dep-${randomUUID().slice(0, 8)}`, item.id, dep, 'relates_to', now)
}

function importPhases(root: string, projectSlugs: string[]): void {
  const db = getDb()
  const file = path.join(root, PHASES_FILE)
  for (const slug of projectSlugs) {
    if (!fs.existsSync(file)) {
      persistPhases(slug) // first sync: export
      continue
    }
    const { data } = matter(fs.readFileSync(file, 'utf-8'), {})
    if (data.project && data.project !== slug) continue
    const phases = Array.isArray(data.phases) ? data.phases : []
    const now = new Date().toISOString()
    db.transaction(() => {
      db.prepare('DELETE FROM phases WHERE project_slug = ?').run(slug)
      const insert = db.prepare(
        `INSERT INTO phases (id, project_slug, name, position, status, target_date, created, updated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      phases.forEach((p: Record<string, unknown>, i: number) => {
        if (!p?.id || !p?.name) return
        insert.run(
          str(p.id), slug, str(p.name), Number(p.position ?? i), str(p.status, 'upcoming'),
          p.target_date ? str(p.target_date) : null, str(p.created, now), str(p.updated, now),
        )
      })
    })()
  }
}

/**
 * Load every project's board files into the index (see header for rules).
 * Call after syncProjects() so project paths are known.
 */
export function importBoards(): BoardSyncResult {
  const db = getDb()
  const result: BoardSyncResult = { imported: 0, persisted: 0, removed: 0, exported: 0 }

  const projects = db.prepare('SELECT slug, path FROM projects').all() as { slug: string; path: string }[]
  const roots = new Map<string, string[]>() // board root → project slugs living there
  roots.set(path.resolve(HUB_ROOT), [])
  for (const p of projects) {
    if (!p.path || !fs.existsSync(p.path)) continue
    const root = path.resolve(p.path)
    roots.set(root, [...(roots.get(root) ?? []), p.slug])
  }

  const allItems = db.prepare('SELECT id, project_slug, persisted_at FROM items').all() as {
    id: string
    project_slug: string
    persisted_at: string | null
  }[]
  const rootOf = new Map<string, string>()
  const rootForSlug = (slug: string) => {
    if (!rootOf.has(slug)) rootOf.set(slug, path.resolve(boardRootFor(slug)))
    return rootOf.get(slug)!
  }

  for (const [root, slugs] of roots) {
    const dir = path.join(root, ITEMS_DIR)
    const belongsHere = allItems.filter((i) => rootForSlug(i.project_slug) === root)

    if (!fs.existsSync(dir)) {
      // First sync of this repo: the index is all we have — export it
      for (const item of belongsHere) {
        persistItem(item.id)
        result.exported++
      }
      importPhases(root, slugs)
      continue
    }

    const seen = new Set<string>()
    db.transaction(() => {
      for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.md')) continue
        const file = path.join(dir, name)
        let parsed: ItemFileData | null = null
        try {
          parsed = parseItem(fs.readFileSync(file, 'utf-8'))
        } catch (err) {
          logger.warn('board', 'board.parse_failed', `Unreadable board file ${file}: ${err}`)
        }
        if (!parsed) continue
        seen.add(parsed.item.id)
        const indexed = db.prepare('SELECT updated FROM items WHERE id = ?').get(parsed.item.id) as
          | { updated: string }
          | undefined
        if (indexed && indexed.updated > parsed.item.updated) {
          persistItem(parsed.item.id) // index is newer — the file catches up
          result.persisted++
        } else {
          upsertFromFile(parsed)
          result.imported++
        }
      }
    })()

    for (const item of belongsHere) {
      if (seen.has(item.id)) continue
      if (item.persisted_at) {
        // had a file once, file is gone → deleted elsewhere
        db.prepare('DELETE FROM item_dependencies WHERE item_id = ? OR depends_on_id = ?').run(item.id, item.id)
        db.prepare('DELETE FROM claude_notes WHERE issue_id = ?').run(item.id)
        db.prepare('DELETE FROM items WHERE id = ?').run(item.id)
        result.removed++
      } else {
        persistItem(item.id) // never written (missed write path) → write now, never delete
        result.exported++
      }
    }

    importPhases(root, slugs)
  }

  if (result.imported || result.removed || result.exported) {
    logger.info(
      'board',
      'board.synced',
      `Board files synced: ${result.imported} imported, ${result.persisted} rewritten, ${result.removed} removed, ${result.exported} exported`,
      { ...result },
    )
  }
  return result
}
