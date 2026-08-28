/**
 * OpenAI-compatible chat provider — covers Ollama, LM Studio, llama.cpp
 * server, vLLM and any other local inference server exposing /v1/chat/completions.
 */
import type { ChatMessage, ChatOptions, ChatResult, ModelProvider } from './types.js'

/** Default timeout for local inference — big models on CPU/GPU can be slow */
const CHAT_TIMEOUT_MS = 10 * 60 * 1000
const PROBE_TIMEOUT_MS = 2000

/**
 * Strip <think>…</think> reasoning blocks that models like Qwen3 or
 * DeepSeek-R1 emit before their actual answer.
 */
function stripThinkBlocks(text: string): string {
  let out = text.replace(/<think>[\s\S]*?<\/think>/g, '')
  // Unclosed think block (truncated output): drop everything before the answer
  const openIdx = out.indexOf('<think>')
  if (openIdx !== -1) out = out.slice(0, openIdx)
  return out.trim()
}

export class OpenAICompatibleProvider implements ModelProvider {
  readonly name: string
  private baseUrl: string
  private apiKey?: string

  constructor(name: string, baseUrl: string, apiKey?: string) {
    this.name = name
    // Normalize: no trailing slash, no trailing /v1 (we append it ourselves)
    this.baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '')
    this.apiKey = apiKey
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) h['Authorization'] = `Bearer ${this.apiKey}`
    return h
  }

  async chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
    const started = Date.now()

    const doFetch = () =>
      fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        signal: opts.signal ?? AbortSignal.timeout(CHAT_TIMEOUT_MS),
        body: JSON.stringify({
          model: opts.model,
          messages,
          temperature: opts.temperature,
          max_tokens: opts.maxTokens,
          stream: false,
        }),
      })

    let res: Response
    try {
      try {
        res = await doFetch()
      } catch (first) {
        // One retry on transient network failure — multi-call workflows
        // (debates) must not die on a single connection hiccup
        if (first instanceof Error && first.name === 'TimeoutError') throw first
        await new Promise((r) => setTimeout(r, 2000))
        res = await doFetch()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(
        `Provider "${this.name}" not reachable at ${this.baseUrl} (${msg}). ` +
          `Is the inference server running?`,
      )
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(
        `Provider "${this.name}" returned ${res.status} for model "${opts.model}": ${body.slice(0, 300)}`,
      )
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number }
      model?: string
    }

    const raw = data.choices?.[0]?.message?.content ?? ''
    return {
      text: stripThinkBlocks(raw),
      model: data.model ?? opts.model,
      provider: this.name,
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens ?? 0,
            outputTokens: data.usage.completion_tokens ?? 0,
          }
        : undefined,
      durationMs: Date.now() - started,
    }
  }

  async available(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
      return res.ok
    } catch {
      return false
    }
  }

  /** List model ids the server currently offers (empty on failure) */
  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })
      if (!res.ok) return []
      const data = (await res.json()) as { data?: { id?: string }[] }
      return (data.data ?? []).map((m) => m.id ?? '').filter(Boolean)
    } catch {
      return []
    }
  }
}
