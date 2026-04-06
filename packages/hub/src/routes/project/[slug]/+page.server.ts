import type { PageServerLoad } from './$types'
import { getDb } from '$lib/server/db'
import { error } from '@sveltejs/kit'
import type { ItemStage } from '@apphub/shared'
import { ITEM_STAGES } from '@apphub/shared'

export interface StageColumn {
  stage: ItemStage
  items: ProjectItem[]
}

export interface ProjectItem {
  id: string
  title: string
  description: string
  stage: ItemStage
  priority: string
  labels: string[]
  position: number
  assigned_to: string
  parent_id: string | null
  item_type: string
  created: string
  updated: string
  attachment_count: number
  child_count: number
}

export const load: PageServerLoad = async ({ params }) => {
  const db = getDb()
  const project = db.prepare('SELECT * FROM projects WHERE slug = ?').get(params.slug) as any

  if (!project) {
    throw error(404, 'Project not found')
  }

  project.tags = JSON.parse(project.tags || '[]')

  // Load items grouped by stage
  const rawItems = db
    .prepare(
      `SELECT i.*,
              (SELECT COUNT(*) FROM issue_attachments a WHERE a.issue_id = i.id) as attachment_count,
              (SELECT COUNT(*) FROM items c WHERE c.parent_id = i.id) as child_count
       FROM items i
       WHERE i.project_slug = ?
       ORDER BY i.position ASC, i.created ASC`,
    )
    .all(params.slug) as any[]

  const stages: Record<ItemStage, ProjectItem[]> = {
    idea: [],
    plan: [],
    build: [],
    claude: [],
    review: [],
    done: [],
  }

  for (const row of rawItems) {
    const item: ProjectItem = {
      ...row,
      labels: JSON.parse(row.labels || '[]'),
      attachment_count: row.attachment_count ?? 0,
      child_count: row.child_count ?? 0,
    }
    const stage = item.stage as ItemStage
    if (stages[stage]) {
      stages[stage].push(item)
    }
  }

  // Stage summary counts
  const stageCounts: Record<ItemStage, number> = {
    idea: stages.idea.length,
    plan: stages.plan.length,
    build: stages.build.length,
    claude: stages.claude.length,
    review: stages.review.length,
    done: stages.done.length,
  }

  const totalItems = rawItems.length

  // All projects (for moving items between projects)
  const allProjects = db
    .prepare('SELECT slug, name, color, icon FROM projects ORDER BY name')
    .all() as any[]

  return {
    project,
    stages,
    stageCounts,
    totalItems,
    allProjects,
  }
}
