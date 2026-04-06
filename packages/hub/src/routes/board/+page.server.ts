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
  color?: string
  icon?: string
}

/** Project info for the filter UI */
export interface ProjectFilter {
  slug: string
  name: string
  color: string
  icon: string
  itemCount: number
}

export const load: PageServerLoad = async () => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM board_issues ORDER BY position ASC').all() as any[]

  const lanes: Record<BoardLane, BoardIssue[]> = {
    backlog: [],
    todo: [],
    in_progress: [],
    claude: [],
    review: [],
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

  // Get attachment counts
  const attCounts = db
    .prepare('SELECT issue_id, COUNT(*) as count FROM issue_attachments GROUP BY issue_id')
    .all() as { issue_id: string; count: number }[]
  const attMap = new Map(attCounts.map((r) => [r.issue_id, r.count]))

  // Attach attachment counts to issues
  for (const lane of Object.values(lanes)) {
    for (const issue of lane) {
      ;(issue as any).attachment_count = attMap.get(issue.id) ?? 0
    }
  }

  // Build available project scopes
  const projectRoot = path.resolve(process.cwd(), '..', '..')
  const scopes: ProjectScope[] = [
    { slug: 'hub', label: 'App Hub', type: 'hub', path: projectRoot, color: '#6366f1', icon: '⬡' },
  ]

  // Add projects from DB
  const projects = db
    .prepare("SELECT slug, name, path, color, icon FROM projects WHERE slug != 'hub' ORDER BY name")
    .all() as any[]
  for (const p of projects) {
    scopes.push({
      slug: p.slug,
      label: p.name,
      type: 'project',
      path: p.path,
      color: p.color || '',
      icon: p.icon || '',
    })
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

  // Build project filters — projects that have items on the board
  const projectsWithItems = db
    .prepare(
      `SELECT bi.project_scope as slug, COUNT(*) as count,
              COALESCE(p.name, bi.project_scope) as name,
              COALESCE(p.color, '') as color,
              COALESCE(p.icon, '') as icon
       FROM board_issues bi
       LEFT JOIN projects p ON bi.project_scope = p.slug
       GROUP BY bi.project_scope
       ORDER BY count DESC`,
    )
    .all() as any[]

  const projectFilters: ProjectFilter[] = projectsWithItems.map((p: any) => ({
    slug: p.slug,
    name: p.name,
    color: p.color || (p.slug === 'hub' ? '#6366f1' : ''),
    icon: p.icon || (p.slug === 'hub' ? '⬡' : ''),
    itemCount: p.count,
  }))

  return { lanes, scopes, projectFilters }
}
