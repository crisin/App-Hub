import fs from 'node:fs'
import path from 'node:path'
import { APPHUB_META_FILE, TASKS_FILE } from '@apphub/shared'
import type { Project } from '@apphub/shared'
import { parseProjectMeta, parseTasks } from './parser.js'
import { getDb } from './db.js'

/** Resolve the projects directory from the hub root */
function getProjectsDir(): string {
  return path.resolve(process.cwd(), '..', '..', 'projects')
}

/**
 * Scan the projects/ directory, parse markdown files, and sync to SQLite.
 * Returns all discovered projects.
 */
export function syncProjects(): Project[] {
  const projectsDir = getProjectsDir()
  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true })
    return []
  }

  const db = getDb()
  const entries = fs.readdirSync(projectsDir, { withFileTypes: true })
  const projects: Project[] = []

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue

    const projectPath = path.join(projectsDir, entry.name)
    const metaPath = path.join(projectPath, APPHUB_META_FILE)

    if (!fs.existsSync(metaPath)) continue

    const metaContent = fs.readFileSync(metaPath, 'utf-8')
    const meta = parseProjectMeta(metaContent)
    meta.slug = meta.slug || entry.name

    // Parse tasks
    const tasksPath = path.join(projectPath, TASKS_FILE)
    const tasks = fs.existsSync(tasksPath) ? parseTasks(fs.readFileSync(tasksPath, 'utf-8')) : []

    const taskSummary = {
      total: tasks.length,
      todo: tasks.filter((t) => t.status === 'todo').length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      done: tasks.filter((t) => t.status === 'done').length,
      blocked: tasks.filter((t) => t.status === 'blocked').length,
    }

    const project: Project = {
      name: meta.name ?? entry.name,
      slug: meta.slug,
      description: meta.description ?? '',
      status: meta.status ?? 'idea',
      template: meta.template ?? '',
      tags: meta.tags ?? [],
      created: meta.created ?? new Date().toISOString(),
      updated: meta.updated ?? new Date().toISOString(),
      path: projectPath,
      tasks,
      taskSummary,
    }

    projects.push(project)

    // Upsert into SQLite
    db.prepare(
      `
      INSERT INTO projects (slug, name, description, status, template, tags, path, created, updated, synced_at)
      VALUES (@slug, @name, @description, @status, @template, @tags, @path, @created, @updated, datetime('now'))
      ON CONFLICT(slug) DO UPDATE SET
        name = @name,
        description = @description,
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
      status: project.status,
      template: project.template,
      tags: JSON.stringify(project.tags),
      path: project.path,
      created: project.created,
      updated: project.updated,
    })

    // Sync tasks
    db.prepare('DELETE FROM tasks WHERE project = ?').run(project.slug)
    const insertTask = db.prepare(`
      INSERT INTO tasks (id, project, title, status, priority, description, created, updated, synced_at)
      VALUES (@id, @project, @title, @status, @priority, @description, @created, @updated, datetime('now'))
    `)
    for (const task of tasks) {
      insertTask.run({ ...task, project: project.slug, description: task.description ?? '' })
    }
  }

  return projects
}

/**
 * Get all projects from SQLite (without re-scanning disk)
 */
export function getProjectsFromDb(): Project[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM projects ORDER BY updated DESC').all() as any[]

  return rows.map((row) => {
    const tasks = db
      .prepare('SELECT * FROM tasks WHERE project = ? ORDER BY created')
      .all(row.slug) as any[]
    return {
      ...row,
      tags: JSON.parse(row.tags || '[]'),
      tasks,
      taskSummary: {
        total: tasks.length,
        todo: tasks.filter((t: any) => t.status === 'todo').length,
        in_progress: tasks.filter((t: any) => t.status === 'in_progress').length,
        done: tasks.filter((t: any) => t.status === 'done').length,
        blocked: tasks.filter((t: any) => t.status === 'blocked').length,
      },
    }
  })
}
