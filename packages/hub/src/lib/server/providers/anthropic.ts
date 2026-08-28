/**
 * Anthropic provider — Claude models via the official SDK.
 * Requires ANTHROPIC_API_KEY. Agents opt in via `provider: anthropic`.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage, ChatOptions, ChatResult, ModelProvider } from './types.js'

const DEFAULT_MAX_TOKENS = 16000

export class AnthropicProvider implements ModelProvider {
  readonly name = 'anthropic'
  private client: Anthropic | null = null

  private getClient(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'ANTHROPIC_API_KEY not set — the anthropic provider is unavailable. ' +
          'Set it in .env or switch the agent to a local provider.',
      )
    }
    if (!this.client) this.client = new Anthropic()
    return this.client
  }

  async chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
    const started = Date.now()
    const client = this.getClient()

    // Anthropic API takes the system prompt as a top-level param
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n')
    const turns = messages
      .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))

    const response = await client.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(system ? { system } : {}),
      messages: turns.length > 0 ? turns : [{ role: 'user' as const, content: '' }],
    })

    if (response.stop_reason === 'refusal') {
      const detail = response.stop_details?.explanation ?? 'no explanation provided'
      throw new Error(`Claude declined this request (refusal): ${detail}`)
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')

    return {
      text,
      model: response.model,
      provider: this.name,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      durationMs: Date.now() - started,
    }
  }

  async available(): Promise<boolean> {
    return Boolean(process.env.ANTHROPIC_API_KEY)
  }
}
