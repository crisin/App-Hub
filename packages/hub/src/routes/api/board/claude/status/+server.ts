import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getRunnerStatusExtended } from '$lib/server/claude-runner'

/** GET /api/board/claude/status — get current Claude runner status */
export const GET: RequestHandler = async () => {
  const status = getRunnerStatusExtended()
  return json({ ok: true, data: status })
}
