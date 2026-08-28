/**
 * POST /api/agents/:slug/run — run a single agent on a prompt.
 * Body: { prompt: string }
 * Response: { text, model, provider, usage?, durationMs }
 */
import type { RequestHandler } from './$types'
import { ok, err } from '$lib/server/response'
import { getAgent, runAgent } from '$lib/server/agents'
import { logger } from '$lib/server/logger'

export const POST: RequestHandler = async ({ params, request }) => {
  const agent = getAgent(params.slug)
  if (!agent) {
    return err(`Agent "${params.slug}" not found`, 404)
  }

  let body: { prompt?: unknown }
  try {
    body = await request.json()
  } catch {
    return err('Invalid JSON body', 400)
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) {
    return err('prompt is required', 400)
  }

  try {
    const result = await runAgent(agent, prompt)
    return ok(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('agents', 'agent.run_error', `Agent "${agent.slug}" failed: ${msg}`, {
      agent: agent.slug,
    })
    return err(msg, 502)
  }
}
