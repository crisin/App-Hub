import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { randomUUID } from 'node:crypto'
import { BOARD_LANES } from '@apphub/shared'
import type { BoardIssue, BoardLane } from '@apphub/shared'
import { autoTriggerIfNeeded } from '$lib/server/claude-runner'
import { logger } from '$lib/server/logger'

/** GET /api/board — list all issues grouped by lane */
export const GET: RequestHandler = async () => {
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

  // Get attachment counts per issue in a single query
  const attCounts = db
    .prepare('SELECT issue_id, COUNT(*) as count FROM issue_attachments GROUP BY issue_id')
    .all() as { issue_id: string; count: number }[]
  const attMap = new Map(attCounts.map((r) => [r.issue_id, r.count]))

  for (const row of rows) {
    const issue: BoardIssue = { ...row, labels: JSON.parse(row.labels || '[]') }
    ;(issue as any).attachment_count = attMap.get(issue.id) ?? 0
    if (lanes[issue.lane as BoardLane]) {
      lanes[issue.lane as BoardLane].push(issue)
    }
  }

  return json({ ok: true, data: lanes })
}

/** POST /api/board — create a new issue */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json()
  const { title, description, priority, labels, lane, project_scope } = body

  if (!title?.trim()) {
    return json({ ok: false, error: 'title is required' }, { status: 400 })
  }

  const targetLane = lane && BOARD_LANES.includes(lane) ? lane : 'backlog'
  const db = getDb()

  // Get next position in the target lane
  const maxPos = db
    .prepare('SELECT COALESCE(MAX(position), -1) as max FROM board_issues WHERE lane = ?')
    .get(targetLane) as { max: number }

  const id = `issue-${randomUUID().slice(0, 8)}`
  const now = new Date().toISOString()

  const scope = project_scope?.trim() || 'hub'

  db.prepare(
    `
    INSERT INTO board_issues (id, title, description, lane, priority, labels, position, assigned_to, project_scope, created, updated)
    VALUES (@id, @title, @description, @lane, @priority, @labels, @position, '', @project_scope, @created, @updated)
  `,
  ).run({
    id,
    title: title.trim(),
    description: description?.trim() ?? '',
    lane: targetLane,
    priority: priority ?? 'medium',
    labels: JSON.stringify(labels ?? []),
    position: maxPos.max + 1,
    project_scope: scope,
    created: now,
    updated: now,
  })

  const issue = db.prepare('SELECT * FROM board_issues WHERE id = ?').get(id) as any
  issue.labels = JSON.parse(issue.labels || '[]')

  logger.info(
    'board',
    'issue.created',
    `Created issue "${title.trim()}" in ${targetLane} (scope: ${scope})`,
    {
      issueId: id,
      lane: targetLane,
      priority: priority ?? 'medium',
      project_scope: scope,
    },
  )

  // Auto-trigger Claude runner if issue was created in the claude lane
  if (targetLane === 'claude') {
    autoTriggerIfNeeded()
  }

  return json({ ok: true, data: issue }, { status: 201 })
}
