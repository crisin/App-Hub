import type { PageServerLoad } from './$types'
import { syncProjects } from '$lib/server/scanner'
import { listTemplates } from '$lib/server/templates'
import { getDb } from '$lib/server/db'

export const load: PageServerLoad = async () => {
  const projects = syncProjects()
  const templates = listTemplates()

  // Get item counts per project from the items table
  const db = getDb()
  const itemCounts = db
    .prepare(
      `SELECT project_slug, COUNT(*) as total,
              SUM(CASE WHEN stage = 'done' THEN 1 ELSE 0 END) as done
       FROM items
       GROUP BY project_slug`,
    )
    .all() as { project_slug: string; total: number; done: number }[]

  const countMap = new Map(itemCounts.map((r) => [r.project_slug, { total: r.total, done: r.done }]))

  const projectsWithCounts = projects.map((p) => ({
    ...p,
    itemSummary: countMap.get(p.slug) ?? { total: 0, done: 0 },
  }))

  return { projects: projectsWithCounts, templates }
}
