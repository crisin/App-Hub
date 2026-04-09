import type { PageServerLoad } from './$types'
import { getDb } from '$lib/server/db'
import { error } from '@sveltejs/kit'
import type { ItemStage } from '@apphub/shared'
import { listItemsByStage, listPhases } from '$lib/server/data'

export const load: PageServerLoad = async ({ params }) => {
  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(params.slug) as any

  if (!project) {
    throw error(404, 'Project not found')
  }

  project.tags = JSON.parse(project.tags || '[]')

  // Items grouped by stage — via data layer (includes attachment_count, child_count, is_blocked)
  const stages = listItemsByStage({ project: params.slug })

  // Stage summary counts
  const stageCounts: Record<ItemStage, number> = {
    idea: stages.idea.length,
    plan: stages.plan.length,
    build: stages.build.length,
    claude: stages.claude.length,
    review: stages.review.length,
    done: stages.done.length,
  }

  const totalItems = Object.values(stages).reduce((sum, arr) => sum + arr.length, 0)

  // All projects (for moving items between projects)
  const allProjects = db
    .prepare('SELECT slug, name, color, icon FROM projects ORDER BY name')
    .all() as any[]

  // Phases for this project
  const phases = listPhases(params.slug)

  return {
    project,
    stages,
    stageCounts,
    totalItems,
    allProjects,
    phases,
  }
}
