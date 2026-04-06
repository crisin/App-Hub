import type { PageServerLoad } from './$types'
import { getDb } from '$lib/server/db'
import { error } from '@sveltejs/kit'

export const load: PageServerLoad = async ({ params }) => {
  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(params.slug) as any

  if (!project) {
    throw error(404, 'Project not found')
  }

  project.tags = JSON.parse(project.tags || '[]')
  project.tasks = db
    .prepare('SELECT * FROM tasks WHERE project = ? ORDER BY created')
    .all(params.slug)
  project.taskSummary = {
    total: project.tasks.length,
    todo: project.tasks.filter((t: any) => t.status === 'todo').length,
    in_progress: project.tasks.filter((t: any) => t.status === 'in_progress').length,
    done: project.tasks.filter((t: any) => t.status === 'done').length,
    blocked: project.tasks.filter((t: any) => t.status === 'blocked').length,
  }

  return { project }
}
