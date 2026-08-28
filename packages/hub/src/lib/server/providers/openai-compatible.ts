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

    // Always stream internally: without streaming, the server sends response
    // headers only after generation completes — Node's undici kills such
    // connections after 5 minutes (headersTimeout), which non-trivial local
    // inference easily exceeds. Streamed chunks keep the connection alive.
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
          stream: true,
          stream_options: { include_usage: true },
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

    const { text, model, usage } = await this.consumeSSE(res, opts.model)
    return {
      text: stripThinkBlocks(text),
      model,
      provider: this.name,
      usage,
      durationMs: Date.now() - started,
    }
  }

  /** Consume an OpenAI-style SSE stream ("data: {...}" lines, "data: [DONE]" sentinel) */
  private async consumeSSE(
    res: Response,
    fallbackModel: string,
  ): Promise<{ text: string; model: string; usage?: { inputTokens: number; outputTokens: number } }> {
    if (!res.body) throw new Error(`Provider "${this.name}" returned an empty response body`)

    let text = ''
    let model = fallbackModel
    let usage: { inputTokens: number; outputTokens: number } | undefined
    let buffer = ''

    const decoder = new TextDecoder()
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') continue
        try {
          const event = JSON.parse(payload) as {
            model?: string
            choices?: { delta?: { content?: string } }[]
            usage?: { prompt_tokens?: number; completion_tokens?: number } | null
          }
          if (event.model) model = event.model
          const delta = event.choices?.[0]?.delta?.content
          if (delta) text += delta
          if (event.usage) {
            usage = {
              inputTokens: event.usage.prompt_tokens ?? 0,
              outputTokens: event.usage.completion_tokens ?? 0,
            }
          }
        } catch {
          /* skip malformed chunk */
        }
      }
    }

    return { text, model, usage }
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
