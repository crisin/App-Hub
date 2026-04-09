import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { queryLogsFromParams } from '$lib/server/log-queries'

/** GET /api/logs — query activity logs with filtering */
export const GET: RequestHandler = async ({ url }) => {
  const { logs, total, limit, offset } = queryLogsFromParams(url.searchParams)
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
