/**
 * Coder backends — pluggable CLI coding agents the runner can spawn on a
 * board item. Every backend works the same way: it gets a task prompt and
 * a git worktree, works autonomously, and commits its changes. The runner
 * pipeline (claim → worktree → run → commits → review lane) is backend-agnostic.
 *
 * Backends:
 *  - claude: Claude Code CLI (default) — stream-json output, tools built in
 *  - aider:  Aider (https://aider.chat) against a local model via Ollama —
 *            plain text output, auto-commits
 *
 * Selection: a board item labeled "aider" runs on aider; everything else
 * runs on claude. Aider's model comes from APPHUB_AIDER_MODEL.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findClaude, execEnv, type ClaudeSpawnSpec } from './exec-utils.js'

export type CoderBackendName = 'claude' | 'aider'

export interface CoderSpawnPlan {
  bin: string
  args: string[]
  env: NodeJS.ProcessEnv
  /** Prompt text to write to stdin after spawn (null = prompt already in args/file) */
  stdinPrompt: string | null
  /** Temp files to delete after the run */
  cleanupFiles: string[]
  /** How stdout should be interpreted */
  outputFormat: 'stream-json' | 'text'
}

export interface CoderBackend {
  name: CoderBackendName
  /** Human-readable availability problem, or null if ready */
  probe(): string | null
  buildSpawn(prompt: string): CoderSpawnPlan
}

// ── claude ──────────────────────────────────────────────────────────

const claudeBackend: CoderBackend = {
  name: 'claude',

  probe(): string | null {
    return findClaude() ? null : 'Claude CLI not found'
  },

  buildSpawn(prompt: string): CoderSpawnPlan {
    const spec = findClaude() as ClaudeSpawnSpec
    return {
      bin: spec.bin,
      args: [
        ...spec.argsPrefix,
        '-p',
        '--output-format',
        'stream-json',
        '--verbose',
        '--allowedTools',
        'Read,Grep,Glob,Bash,Edit,Write',
      ],
      env: execEnv(),
      stdinPrompt: prompt,
      cleanupFiles: [],
      outputFormat: 'stream-json',
    }
  },
}

// ── aider ───────────────────────────────────────────────────────────

function findAider(): string | null {
  const names = process.platform === 'win32' ? ['aider.exe', 'aider.cmd'] : ['aider']
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
  const dirs = [
    ...(process.env.PATH ?? '').split(path.delimiter),
    path.join(home, '.local', 'bin'),
    path.join(home, 'scoop', 'shims'),
  ]
  for (const dir of dirs) {
    if (!dir) continue
    for (const name of names) {
      const bin = path.join(dir, name)
      if (fs.existsSync(bin)) return bin
    }
  }
  return null
}

const aiderBackend: CoderBackend = {
  name: 'aider',

  probe(): string | null {
    return findAider() ? null : 'aider not found (install with: pipx install aider-chat)'
  },

  buildSpawn(prompt: string): CoderSpawnPlan {
    const bin = findAider() as string
    // Prompt via file — avoids argv length limits and shell quoting
    const msgFile = path.join(os.tmpdir(), `apphub-aider-${Date.now().toString(36)}.md`)
    fs.writeFileSync(msgFile, prompt, 'utf-8')

    const model = process.env.APPHUB_AIDER_MODEL ?? 'ollama_chat/qwen3-coder:30b'
    // Pin weak model (commit messages) AND editor model (architect mode) to
    // existing models: aider's guesses — and stale ~/.aider.conf.yml entries —
    // may reference models that aren't pulled locally, causing 404 retry-loops.
    const weakModel = process.env.APPHUB_AIDER_WEAK_MODEL ?? model
    const editorModel = process.env.APPHUB_AIDER_EDITOR_MODEL ?? model
    const ollamaUrl = process.env.APPHUB_OLLAMA_URL ?? 'http://127.0.0.1:11434'

    return {
      bin,
      args: [
        '--message-file',
        msgFile,
        '--model',
        model,
        '--weak-model',
        weakModel,
        '--editor-model',
        editorModel,
        '--yes-always',
        '--no-check-update',
        '--no-show-model-warnings',
        '--no-pretty',
        '--no-stream',
      ],
      env: { ...execEnv(), OLLAMA_API_BASE: ollamaUrl },
      stdinPrompt: null,
      cleanupFiles: [msgFile],
      outputFormat: 'text',
    }
  },
}

// ── registry ────────────────────────────────────────────────────────

const backends: Record<CoderBackendName, CoderBackend> = {
  claude: claudeBackend,
  aider: aiderBackend,
}

export function getCoderBackend(name: CoderBackendName): CoderBackend {
  return backends[name]
}

/** Pick the backend for a board item: label "aider" opts in, claude is default */
export function backendForLabels(labels: unknown): CoderBackendName {
  if (Array.isArray(labels) && labels.map(String).includes('aider')) return 'aider'
  return 'claude'
}
