import fs from 'node:fs'
import path from 'node:path'
import { APPHUB_META_FILE } from '@apphub/shared'
import type { ProjectMeta } from '@apphub/shared'
import { parseProjectMeta } from './parser.js'
import { getDb } from './db.js'
import type { DbProjectRow } from './db.js'
import { seedDefaultPhases } from './data.js'
import { HUB_ROOT, PATHS } from './config.js'
import { logger } from './logger.js'

/** A project as stored in SQLite + its disk path */
export interface ProjectRow extends ProjectMeta {
  path: string
}

// ── Project registry: where projects live ──────────────────────────
//
// Projects are discovered from three places:
//   1. the hub repo itself (dogfooding — slug "hub")
//   2. every child of projects/ that has an .apphub.md
//   3. registered external paths — repos that live elsewhere on disk
//      (e.g. an existing app that gets its work items from the hub).
//      Paths differ per machine, so they live in the gitignored
//      apphub.local.json plus the APPHUB_PROJECT_PATHS env var.

interface LocalConfig {
  projects?: string[]
}

function readLocalConfig(): LocalConfig {
  try {
    return JSON.parse(fs.readFileSync(PATHS.localConfig, 'utf-8')) as LocalConfig
  } catch {
    return {}
  }
}

function writeLocalConfig(config: LocalConfig): void {
  fs.writeFileSync(PATHS.localConfig, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

/** External project paths: apphub.local.json + APPHUB_PROJECT_PATHS (path-delimiter separated) */
export function getRegisteredProjectPaths(): string[] {
  const fromFile = readLocalConfig().projects ?? []
  const fromEnv = (process.env.APPHUB_PROJECT_PATHS ?? '').split(path.delimiter).filter(Boolean)
  return [...new Set([...fromFile, ...fromEnv].map((p) => path.resolve(HUB_ROOT, p)))]
}

/** Add an external project path to apphub.local.json (idempotent) */
export function registerProjectPath(projectPath: string): void {
  const abs = path.resolve(projectPath)
  const config = readLocalConfig()
  const list = (config.projects ?? []).map((p) => path.resolve(HUB_ROOT, p))
  if (!list.includes(abs)) {
    config.projects = [...(config.projects ?? []), abs]
    writeLocalConfig(config)
  }
}

/** Remove an external project path from apphub.local.json. True if it was registered. */
export function unregisterProjectPath(projectPath: string): boolean {
  const abs = path.resolve(projectPath)
  const config = readLocalConfig()
  const before = config.projects ?? []
  const after = before.filter((p) => path.resolve(HUB_ROOT, p) !== abs)
  if (after.length === before.length) return false
  config.projects = after
  writeLocalConfig(config)
  return true
}

/** Where a project directory sits relative to the hub — decides what the hub may do with it */
export type ProjectLocation = 'hub' | 'managed' | 'external'

export function projectLocation(projectPath: string): ProjectLocation {
  const abs = path.resolve(projectPath)
  if (abs === path.resolve(HUB_ROOT)) return 'hub'
  const rel = path.relative(PATHS.projects, abs)
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return 'managed'
  return 'external'
}

// ── Repo URL ────────────────────────────────────────────────────────

/**
 * Browsable https URL for a git remote, credentials stripped:
 *   git@github.com:crisin/yappa.git        → https://github.com/crisin/yappa
 *   https://user:token@github.com/x/y.git  → https://github.com/x/y
 * Returns '' for anything that is not a plain http(s)/ssh remote.
 */
export function normalizeRepoUrl(raw: string): string {
  const url = raw.trim()
  if (!url) return ''
  const scp = url.match(/^[\w.-]+@([\w.-]+):(.+?)(?:\.git)?\/?$/) // git@host:owner/repo.git
  if (scp) return `https://${scp[1]}/${scp[2]}`
  try {
    const parsed = new URL(url.replace(/^ssh:\/\//, 'https://').replace(/^git\+/, ''))
    if (!['http:', 'https:'].includes(parsed.protocol)) return ''
    const pathname = parsed.pathname.replace(/\.git$/, '').replace(/\/$/, '')
    return `https://${parsed.hostname}${pathname}` // drops user:token@ and ports
  } catch {
    return ''
  }
}

/** remote "origin" of a repo, read straight from its git config (no git spawn per sync) */
function readOriginUrl(projectPath: string): string {
  try {
    let gitDir = path.join(projectPath, '.git')
    if (fs.statSync(gitDir).isFile()) {
      // worktree / submodule: ".git" is a file pointing at the real git dir
      const target = fs.readFileSync(gitDir, 'utf-8').match(/^gitdir:\s*(.+)$/m)?.[1]
      if (!target) return ''
      gitDir = path.resolve(projectPath, target.trim())
    }
    const config = fs.readFileSync(path.join(gitDir, 'config'), 'utf-8')
    const section = config.split(/^\[/m).find((s) => /^remote\s+"origin"\]/.test(s))
    return section?.match(/^\s*url\s*=\s*(.+)$/m)?.[1]?.trim() ?? ''
  } catch {
    return ''
  }
}

// ── Sync ────────────────────────────────────────────────────────────

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
    // explicit `repo:` in .apphub.md wins; else the git remote (same on every machine)
    repo: normalizeRepoUrl(typeof meta.repo === 'string' ? meta.repo : '') || normalizeRepoUrl(readOriginUrl(projectPath)),
    path: projectPath,
  }

  const db = getDb()
  db.prepare(
    `
    INSERT INTO projects (slug, name, description, context, status, template, tags, repo, path, created, updated, synced_at)
    VALUES (@slug, @name, @description, @context, @status, @template, @tags, @repo, @path, @created, @updated, datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      name = @name,
      description = @description,
      context = @context,
      status = @status,
      template = @template,
      tags = @tags,
      repo = @repo,
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
    repo: project.repo ?? '',
    path: project.path,
    created: project.created,
    updated: project.updated,
  })

  // Seed default phases if none exist yet
  seedDefaultPhases(project.slug)

  return project
}

/**
 * Scan the hub repo, projects/ and registered external paths, parse their
 * .apphub.md and sync to SQLite. Returns all discovered projects.
 */
export function syncProjects(): ProjectRow[] {
  const projects: ProjectRow[] = []
  const seen = new Map<string, string>()

  const add = (projectPath: string, fallbackSlug: string) => {
    const project = syncProjectDir(projectPath, fallbackSlug)
    if (!project) return
    const clash = seen.get(project.slug)
    if (clash && clash !== projectPath) {
      logger.warn('sync', 'sync.slug_clash', `Slug "${project.slug}" used by ${clash} and ${projectPath} — last one wins`)
    }
    seen.set(project.slug, projectPath)
    projects.push(project)
  }

  // Dogfooding: the hub registers itself via .apphub.md in the repo root
  add(HUB_ROOT, 'hub')

  fs.mkdirSync(PATHS.projects, { recursive: true })
  for (const entry of fs.readdirSync(PATHS.projects, { withFileTypes: true })) {
    // isSymbolicLink: a junction/symlink in projects/ pointing at a repo elsewhere counts too
    if ((!entry.isDirectory() && !entry.isSymbolicLink()) || entry.name.startsWith('.')) continue
    add(path.join(PATHS.projects, entry.name), entry.name)
  }

  for (const external of getRegisteredProjectPaths()) {
    if (!fs.existsSync(path.join(external, APPHUB_META_FILE))) {
      logger.warn('sync', 'sync.external_missing', `Registered project path has no ${APPHUB_META_FILE}: ${external}`)
      continue
    }
    add(external, path.basename(external))
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

// ── Scope resolution ────────────────────────────────────────────────

export interface ResolvedScope {
  /** Repo root to work in */
  cwd: string
  /** Human-readable name for prompts and logs */
  contextName: string
  kind: 'hub' | 'project' | 'template'
}

/**
 * Resolve a board item's scope (project slug) to the repo it belongs to.
 * Single source for the runner, the review lane and AI suggestions:
 *   'hub'        → the App Hub repo
 *   project slug → its indexed path (projects/, or a registered external path)
 *   template     → templates/<slug>
 */
export function resolveProjectScope(scope: string): ResolvedScope | null {
  if (!scope || scope === 'hub') {
    return { cwd: HUB_ROOT, contextName: 'App Hub', kind: 'hub' }
  }

  const project = getDb()
    .prepare('SELECT path, name FROM projects WHERE slug = ?')
    .get(scope) as Pick<DbProjectRow, 'path' | 'name'> | undefined
  if (project?.path && fs.existsSync(project.path)) {
    return { cwd: project.path, contextName: `project "${project.name}"`, kind: 'project' }
  }

  const projectPath = path.join(PATHS.projects, scope)
  if (fs.existsSync(projectPath)) {
    return { cwd: projectPath, contextName: `project "${scope}"`, kind: 'project' }
  }

  const templatePath = path.join(PATHS.templates, scope)
  if (fs.existsSync(templatePath)) {
    return { cwd: templatePath, contextName: `template "${scope}"`, kind: 'template' }
  }

  return null
}
