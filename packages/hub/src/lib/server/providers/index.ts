/**
 * Provider registry — named LLM backends agents can reference in their
 * frontmatter (`provider: ollama`). Configured via environment:
 *
 *   APPHUB_OLLAMA_URL         default http://localhost:11434
 *   APPHUB_OPENAI_COMPAT_URL  default http://localhost:1234 (LM Studio et al.)
 *   APPHUB_OPENAI_COMPAT_KEY  optional bearer token for the above
 *   ANTHROPIC_API_KEY         enables the anthropic provider
 */
import { OpenAICompatibleProvider } from './openai-compatible.js'
import { AnthropicProvider } from './anthropic.js'
import type { ModelProvider } from './types.js'

export type { ChatMessage, ChatOptions, ChatResult, ChatUsage, ModelProvider } from './types.js'
export { OpenAICompatibleProvider } from './openai-compatible.js'

let registry: Record<string, ModelProvider> | null = null

function buildRegistry(): Record<string, ModelProvider> {
  return {
    // 127.0.0.1 instead of localhost — avoids IPv6/IPv4 resolution flakiness in node fetch
    ollama: new OpenAICompatibleProvider(
      'ollama',
      process.env.APPHUB_OLLAMA_URL ?? 'http://127.0.0.1:11434',
    ),
    'openai-compatible': new OpenAICompatibleProvider(
      'openai-compatible',
      process.env.APPHUB_OPENAI_COMPAT_URL ?? 'http://127.0.0.1:1234',
      process.env.APPHUB_OPENAI_COMPAT_KEY,
    ),
    anthropic: new AnthropicProvider(),
  }
}

export function getProvider(name: string): ModelProvider {
  registry ??= buildRegistry()
  const provider = registry[name]
  if (!provider) {
    throw new Error(
      `Unknown provider "${name}". Available: ${Object.keys(registry).join(', ')}`,
    )
  }
  return provider
}

export interface ProviderStatus {
  name: string
  available: boolean
  models: string[]
}

/** Status of all registered providers (for dashboards/CLI) */
export async function listProviderStatus(): Promise<ProviderStatus[]> {
  registry ??= buildRegistry()
  return Promise.all(
    Object.values(registry).map(async (p) => ({
      name: p.name,
      available: await p.available(),
      models: p instanceof OpenAICompatibleProvider ? await p.listModels() : [],
    })),
  )
}
