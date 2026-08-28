/**
 * Model provider abstraction — the seam that lets agents run on any LLM backend.
 *
 * Two families of backends:
 *  - "openai-compatible": every local inference server (Ollama, LM Studio,
 *    llama.cpp server, vLLM) speaks this API — one adapter covers them all.
 *  - "anthropic": the official Anthropic SDK for Claude models.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  model: string
  temperature?: number
  maxTokens?: number
  /** Abort long-running local inference */
  signal?: AbortSignal
}

export interface ChatUsage {
  inputTokens: number
  outputTokens: number
}

export interface ChatResult {
  text: string
  model: string
  provider: string
  usage?: ChatUsage
  durationMs: number
}

export interface ModelProvider {
  readonly name: string
  chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult>
  /** Quick reachability/config probe — used for status displays, never throws */
  available(): Promise<boolean>
}
