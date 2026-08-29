import fs from 'node:fs'
import path from 'node:path'
import { APPHUB_META_FILE } from '@apphub/shared'
import type { ProjectMeta } from '@apphub/shared'
import { parseProjectMeta } from './parser.js'
import { getDb } from './db.js'
import type { DbProjectRow } from './db.js'
import { seedDefaultPhases } from './data.js'

/** Resolve the projects directory from the hub root */
function getProjectsDir(): string {
  return path.resolve(process.cwd(), '..', '..', 'projects')
}

/** The App Hub monorepo root — the hub registers itself as a project (dogfooding) */
function getHubRoot(): string {
  return path.resolve(process.cwd(), '..', '..')
}

/** A project as stored in SQLite + its disk path */
export interface ProjectRow extends ProjectMeta {
  path: string
}

/** Parse a project directory's .apphub.md and upsert it into SQLite. Null if no meta file. */
function syncProjectDir(projectPath: string, fallbackSlug: string): ProjectRow | null {
  const metaPath = path.join(projectPath, APPHUB_META_FILE)
  if (!fs.existsSync(metaPath)) return null

  const metaContent = fs.readFileSync(metaPath, 'utf-8')
  const meta = parseProjectMeta(metaContent)
  meta.slug = meta.slug || fallbackSlug

  const project: ProjectRow = {
    name: meta.name ?? fallbackSlug,
    slug: meta.slug!,
    description: meta.description ?? '',
    context: meta.context ?? '',
    status: meta.status ?? 'idea',
    template: meta.template ?? '',
    tags: meta.tags ?? [],
    created: meta.created ?? new Date().toISOString(),
    updated: meta.updated ?? new Date().toISOString(),
    path: projectPath,
  }

  const db = getDb()
  db.prepare(
    `
    INSERT INTO projects (slug, name, description, context, status, template, tags, path, created, updated, synced_at)
    VALUES (@slug, @name, @description, @context, @status, @template, @tags, @path, @created, @updated, datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      name = @name,
      description = @description,
      context = @context,
      status = @status,
      template = @template,
      tags = @tags,
      path = @path,
      updated = @updated,
      synced_at = datetime('now')
  `,
  ).run({
    slug: project.slug,
    name: project.name,
    description: project.description,
    context: project.context ?? '',
    status: project.status,
    template: project.template,
    tags: JSON.stringify(project.tags),
    path: project.path,
    created: project.created,
    updated: project.updated,
  })

  // Seed default phases if none exist yet
  seedDefaultPhases(project.slug)

  return project
}

/**
 * Scan the projects/ directory (plus the hub repo itself), parse markdown
 * files, and sync to SQLite. Returns all discovered projects.
 */
export function syncProjects(): ProjectRow[] {
  const projects: ProjectRow[] = []

  // Dogfooding: the hub registers itself via .apphub.md in the repo root
  const hubProject = syncProjectDir(getHubRoot(), 'hub')
  if (hubProject) projects.push(hubProject)

  const projectsDir = getProjectsDir()
  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true })
    return projects
  }

  const entries = fs.readdirSync(projectsDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const project = syncProjectDir(path.join(projectsDir, entry.name), entry.name)
    if (project) projects.push(project)
  }

  return projects
}

/**
 * Get all projects from SQLite (without re-scanning disk)
 */
export function getProjectsFromDb(): ProjectRow[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM projects ORDER BY updated DESC').all() as DbProjectRow[]

  return rows.map((row) => ({
    ...row,
    tags: JSON.parse(row.tags || '[]'),
  }))
}
