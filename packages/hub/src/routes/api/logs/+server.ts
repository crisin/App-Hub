import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { queryLogs, type LogLevel, type LogCategory } from '$lib/server/logger'

/** GET /api/logs — query activity logs with filtering */
export const GET: RequestHandler = async ({ url }) => {
  const level = url.searchParams.get('level') as LogLevel | null
  const category = url.searchParams.get('category') as LogCategory | null
  const search = url.searchParams.get('search')
  const issueId = url.searchParams.get('issue_id')
  const projectSlug = url.searchParams.get('project')
  const limit = parseInt(url.searchParams.get('limit') ?? '100', 10)
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)
  const since = url.searchParams.get('since')
  const until = url.searchParams.get('until')

  const { logs, total } = queryLogs({
    level: level ?? undefined,
    category: category ?? undefined,
    search: search ?? undefined,
    issueId: issueId ?? undefined,
    projectSlug: projectSlug ?? undefined,
    limit: Math.min(limit, 500),
    offset,
    since: since ?? undefined,
    until: until ?? undefined,
  })

  return json({ ok: true, data: { logs, total, limit, offset } })
}

/** DELETE /api/logs — clear all logs */
export const DELETE: RequestHandler = async ({ url }) => {
  const { getDb } = await import('$lib/server/db')
  const db = getDb()

  const olderThan = url.searchParams.get('older_than')
  if (olderThan) {
    const result = db.prepare('DELETE FROM activity_log WHERE timestamp < ?').run(olderThan)
    return json({ ok: true, data: { deleted: result.changes } })
  }

  const result = db.prepare('DELETE FROM activity_log').run()
  return json({ ok: true, data: { deleted: result.changes } })
}
