import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'

/** GET /api/board/claude — list unclaimed issues in the Claude lane */
export const GET: RequestHandler = async () => {
  const db = getDb()
  const rows = db
    .prepare(
      `
    SELECT * FROM items
    WHERE stage = 'claude' AND (assigned_to = '' OR assigned_to IS NULL)
    ORDER BY
      CASE priority
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END,
      position ASC
  `,
    )
    .all() as any[]

  const issues = rows.map((r) => ({ ...r, labels: JSON.parse(r.labels || '[]') }))
  return json({ ok: true, data: issues })
}
