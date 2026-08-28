/**
 * GET /api/agents — list registered agents and provider status.
 */
import type { RequestHandler } from './$types'
import { ok, err } from '$lib/server/response'
import { listAgents } from '$lib/server/agents'
import { listProviderStatus } from '$lib/server/providers'

export const GET: RequestHandler = async () => {
  try {
    const [agents, providers] = await Promise.all([
      Promise.resolve(listAgents()),
      listProviderStatus(),
    ])
    return ok({ agents, providers })
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e), 500)
  }
}
