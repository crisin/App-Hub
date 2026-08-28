import type { PageServerLoad } from './$types'
import { listAgents } from '$lib/server/agents'
import { listProviderStatus } from '$lib/server/providers'

export const load: PageServerLoad = async () => {
  const [agents, providers] = await Promise.all([
    Promise.resolve(listAgents()),
    listProviderStatus(),
  ])
  return {
    // Strip system prompts down for the card view; full prompt shown on demand
    agents: agents.map((a) => ({
      slug: a.slug,
      name: a.name,
      description: a.description,
      provider: a.provider,
      model: a.model,
      systemPrompt: a.systemPrompt,
    })),
    providers,
  }
}
