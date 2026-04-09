import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getRunnerStatusExtended } from '$lib/server/claude-runner'

/** GET /api/board/claude/status — get current Claude runner status */
export const GET: RequestHandler = async () => {
  try {
    const status = getRunnerStatusExtended()
    return json({ ok: true, data: status })
  } catch (e: any) {
    return json({ ok: false, error: e.message ?? 'Failed to get runner status' }, { status: 500 })
  }
}
