import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { triggerRunner } from '$lib/server/claude-runner'
import { logger } from '$lib/server/logger'

/** POST /api/board/claude/run — trigger the Claude runner */
export const POST: RequestHandler = async () => {
  logger.info('claude', 'runner.triggered', 'Claude runner manually triggered from UI')
  const status = triggerRunner()
  return json({ ok: true, data: status })
}
