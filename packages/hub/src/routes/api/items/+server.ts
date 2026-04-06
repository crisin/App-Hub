import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import type { ItemStage } from '@apphub/shared'
import { ITEM_STAGES } from '@apphub/shared'

/** GET /api/items — list items across all projects (filterable) */
export const GET: RequestHandler = async ({ url }) => {
  const db = getDb()

  const stage = url.searchParams.get('stage')
  const project = url.searchParams.get('project')
  const assigned = url.searchParams.get('assigned_to')
  const search = url.searchParams.get('q')
  const grouped = url.searchParams.get('grouped') // if 'true', group by stage like board

  const conditions: string[] = []
  const params: unknown[] = []

  if (stage && ITEM_STAGES.includes(stage as ItemStage)) {
    conditions.push('i.stage = ?')
    params.push(stage)
  }
  if (project) {
    conditions.push('i.project_slug = ?')
    params.push(project)
  }
  if (assigned) {
    conditions.push('i.assigned_to = ?')
    params.push(assigned)
  }
  if (search) {
    conditions.push('(i.title LIKE ? OR i.description LIKE ?)')
    const pattern = `%${search}%`
    params.push(pattern, pattern)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const rows = db
    .prepare(
      `SELECT i.*, p.name as project_name, p.color as project_color, p.icon as project_icon
       FROM items i
       LEFT JOIN projects p ON i.project_slug = p.slug
       ${where}
       ORDER BY i.stage, i.position ASC`,
    )
    .all(...params) as any[]

  // Attachment counts
  const attCounts = db
    .prepare('SELECT issue_id, COUNT(*) as count FROM issue_attachments GROUP BY issue_id')
    .all() as { issue_id: string; count: number }[]
  const attMap = new Map(attCounts.map((r) => [r.issue_id, r.count]))

  const items = rows.map((row) => ({
    ...row,
    labels: JSON.parse(row.labels || '[]'),
    attachment_count: attMap.get(row.id) ?? 0,
  }))

  if (grouped === 'true') {
    const stages: Record<ItemStage, any[]> = {
      idea: [],
      plan: [],
      build: [],
      claude: [],
      review: [],
      done: [],
    }
    for (const item of items) {
      if (stages[item.stage as ItemStage]) {
        stages[item.stage as ItemStage].push(item)
      }
    }
    return json({ ok: true, data: stages })
  }

  return json({ ok: true, data: items })
}
