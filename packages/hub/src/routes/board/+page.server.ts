import type { PageServerLoad } from './$types'
import { getDb } from '$lib/server/db'
import type { BoardIssue, BoardLane } from '@apphub/shared'
import fs from 'node:fs'
import path from 'node:path'

export interface ProjectScope {
  slug: string
  label: string
  type: 'hub' | 'project' | 'template'
  path: string
}

export const load: PageServerLoad = async () => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM board_issues ORDER BY position ASC').all() as any[]

  const lanes: Record<BoardLane, BoardIssue[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    claude: [],
    done: [],
  }

  for (const row of rows) {
    const issue: BoardIssue = {
      ...row,
      labels: JSON.parse(row.labels || '[]'),
      project_scope: row.project_scope ?? 'hub',
    }
    if (lanes[issue.lane as BoardLane]) {
      lanes[issue.lane as BoardLane].push(issue)
    }
  }

  // Build available project scopes
  const projectRoot = path.resolve(process.cwd(), '..', '..')
  const scopes: ProjectScope[] = [{ slug: 'hub', label: 'App Hub', type: 'hub', path: projectRoot }]

  // Add projects from DB
  const projects = db.prepare('SELECT slug, name, path FROM projects ORDER BY name').all() as any[]
  for (const p of projects) {
    scopes.push({ slug: p.slug, label: p.name, type: 'project', path: p.path })
  }

  // Add templates
  const templatesDir = path.resolve(projectRoot, 'templates')
  if (fs.existsSync(templatesDir)) {
    const templateDirs = fs
      .readdirSync(templatesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const dir of templateDirs) {
      const tmplPath = path.join(templatesDir, dir.name)
      // Try to read template.json for a nicer label
      let label = dir.name
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(tmplPath, 'template.json'), 'utf-8'))
        label = meta.name || dir.name
      } catch {
        /* use dir name */
      }
      scopes.push({ slug: dir.name, label, type: 'template', path: tmplPath })
    }
  }

  return { lanes, scopes }
}
