/**
 * Agent registry — agents are markdown files in <repo>/agents/*.md.
 *
 * Frontmatter defines the wiring (provider, model, sampling), the markdown
 * body is the system prompt. Adding a new agent = adding a file. This keeps
 * agents versionable, portable and editable without touching code —
 * markdown as source of truth, like everything else in App Hub.
 *
 * Example:
 *   ---
 *   name: Critic
 *   description: Attacks ideas to expose weaknesses
 *   provider: ollama
 *   model: qwen3:32b-q4_K_M
 *   temperature: 0.7
 *   ---
 *   You are a sharp but fair critic. ...
 */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { getProvider, type ChatMessage, type ChatResult } from './providers/index.js'
import { logger } from './logger.js'

const PROJECT_ROOT = path.resolve(process.cwd(), '..', '..')
const AGENTS_DIR = process.env.APPHUB_AGENTS_DIR
  ? path.resolve(PROJECT_ROOT, process.env.APPHUB_AGENTS_DIR)
  : path.join(PROJECT_ROOT, 'agents')

export interface AgentDef {
  slug: string
  name: string
  description: string
  provider: string
  model: string
  temperature?: number
  maxTokens?: number
  systemPrompt: string
}

function parseAgentFile(filePath: string): AgentDef | null {
  try {
    const slug = path.basename(filePath, '.md')
    const raw = fs.readFileSync(filePath, 'utf-8')
    const { data, content } = matter(raw)

    if (!data.provider || !data.model) {
      logger.warn('agents', 'agents.invalid', `Agent "${slug}" missing provider/model — skipped`)
      return null
    }

    return {
      slug,
      name: typeof data.name === 'string' ? data.name : slug,
      description: typeof data.description === 'string' ? data.description : '',
      provider: String(data.provider),
      model: String(data.model),
      temperature: typeof data.temperature === 'number' ? data.temperature : undefined,
      maxTokens: typeof data.maxTokens === 'number' ? data.maxTokens : undefined,
      systemPrompt: content.trim(),
    }
  } catch (e) {
    logger.error('agents', 'agents.parse_error', `Failed to parse ${filePath}: ${String(e)}`)
    return null
  }
}

/** All registered agents, sorted by slug. Re-scans on every call (few small files). */
export function listAgents(): AgentDef[] {
  if (!fs.existsSync(AGENTS_DIR)) return []
  return fs
    .readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parseAgentFile(path.join(AGENTS_DIR, f)))
    .filter((a): a is AgentDef => a !== null)
    .sort((a, b) => a.slug.localeCompare(b.slug))
}

export function getAgent(slug: string): AgentDef | null {
  const file = path.join(AGENTS_DIR, `${slug}.md`)
  if (!path.resolve(file).startsWith(path.resolve(AGENTS_DIR))) return null // path traversal guard
  if (!fs.existsSync(file)) return null
  return parseAgentFile(file)
}

/**
 * Run an agent on a prompt. `history` allows multi-turn flows (debates);
 * it is inserted between system prompt and the final user prompt.
 */
export async function runAgent(
  agent: AgentDef,
  userPrompt: string,
  history: ChatMessage[] = [],
): Promise<ChatResult> {
  const provider = getProvider(agent.provider)
  const messages: ChatMessage[] = [
    { role: 'system', content: agent.systemPrompt },
    ...history,
    { role: 'user', content: userPrompt },
  ]

  logger.info('agents', 'agent.run', `Running agent "${agent.slug}" (${agent.provider}/${agent.model})`, {
    agent: agent.slug,
    provider: agent.provider,
    model: agent.model,
  })

  const result = await provider.chat(messages, {
    model: agent.model,
    temperature: agent.temperature,
    maxTokens: agent.maxTokens,
  })

  logger.info('agents', 'agent.done', `Agent "${agent.slug}" finished in ${Math.round(result.durationMs / 1000)}s`, {
    agent: agent.slug,
    durationMs: result.durationMs,
    usage: result.usage ?? null,
  })

  return result
}
