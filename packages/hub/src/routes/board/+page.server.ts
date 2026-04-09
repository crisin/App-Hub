import type { PageServerLoad } from './$types'
import { getDb } from '$lib/server/db'
import { listItemsByStage, getProjectFilters, listPhases } from '$lib/server/data'
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

export const load: PageServerLoad = async () => {
  // Items grouped by stage — single source of truth via data layer
  const stages = listItemsByStage()

  // Build available project scopes
  const db = getDb()
  const projectRoot = path.resolve(process.cwd(), '..', '..')
  const scopes: ProjectScope[] = [
    { slug: 'hub', label: 'App Hub', type: 'hub', path: projectRoot, color: '#6366f1', icon: '\u2B21' },
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

  // Project filters for the UI
  const projectFilters = getProjectFilters()

  // Phase data keyed by project slug (for phase grouping in board view)
  const phasesByProject: Record<string, any[]> = {}
  for (const pf of projectFilters) {
    phasesByProject[pf.slug] = listPhases(pf.slug)
  }

  return { lanes: stages, scopes, projectFilters, phasesByProject }
}
