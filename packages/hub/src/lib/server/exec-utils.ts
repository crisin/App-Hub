/**
 * Cross-platform helpers for spawning external tools (claude CLI, git).
 * Handles Windows vs. macOS/Linux differences in PATH handling and binary discovery.
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const isWindows = process.platform === 'win32'

/** Extra directories where CLI tools commonly live, per platform */
function extraBinDirs(): string[] {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
  if (isWindows) {
    return [path.join(home, '.local', 'bin'), path.join(process.env.APPDATA ?? '', 'npm')]
  }
  return ['/usr/local/bin', '/opt/homebrew/bin', path.join(home, '.local', 'bin')]
}

/** PATH extended with the platform's common tool directories */
export function extendedPath(): string {
  return [...extraBinDirs(), process.env.PATH ?? ''].join(path.delimiter)
}

/** Environment for spawned child processes, with the extended PATH */
export function execEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PATH: extendedPath() }
}

export interface ClaudeSpawnSpec {
  /** Executable to spawn */
  bin: string
  /** Arguments that must precede the actual CLI args (e.g. path to cli.js when running via node) */
  argsPrefix: string[]
}

/** Locate the newest VS Code Claude Code extension's bundled native binary (Windows) */
function findVSCodeClaude(): string | null {
  const extRoot = path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.vscode', 'extensions')
  if (!fs.existsSync(extRoot)) return null
  try {
    const candidates = fs
      .readdirSync(extRoot)
      .filter((d) => d.startsWith('anthropic.claude-code-'))
      .sort()
    for (let i = candidates.length - 1; i >= 0; i--) {
      const bin = path.join(extRoot, candidates[i], 'resources', 'native-binary', 'claude.exe')
      if (fs.existsSync(bin)) return bin
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Locate the Claude Desktop App bundle binary (macOS) */
function findDesktopAppClaude(): string | null {
  const appSupport = path.join(
    process.env.HOME ?? '',
    'Library/Application Support/Claude/claude-code',
  )
  if (!fs.existsSync(appSupport)) return null
  try {
    const versions = fs.readdirSync(appSupport).sort()
    const latest = versions[versions.length - 1]
    if (latest) {
      const bin = path.join(appSupport, latest, 'claude.app/Contents/MacOS/claude')
      if (fs.existsSync(bin)) return bin
    }
  } catch {
    /* ignore */
  }
  return null
}

/**
 * Find the claude CLI across platforms.
 * Search order: PATH + common bin dirs, then platform-specific app bundles.
 * On Windows, npm's `claude.cmd` shim is resolved to its underlying cli.js
 * (spawned via node) to avoid cmd.exe argument-quoting pitfalls.
 */
export function findClaude(): ClaudeSpawnSpec | null {
  const names = isWindows ? ['claude.exe', 'claude.cmd'] : ['claude']
  const dirs = [...(process.env.PATH ?? '').split(path.delimiter), ...extraBinDirs()]

  for (const dir of dirs) {
    if (!dir) continue
    for (const name of names) {
      const bin = path.join(dir, name)
      if (!fs.existsSync(bin)) continue
      if (name.endsWith('.cmd')) {
        const cliJs = path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'cli.js')
        if (fs.existsSync(cliJs)) return { bin: process.execPath, argsPrefix: [cliJs] }
        continue // .cmd without resolvable cli.js — skip rather than fight shell quoting
      }
      return { bin, argsPrefix: [] }
    }
  }

  const fallback = isWindows ? findVSCodeClaude() : findDesktopAppClaude()
  return fallback ? { bin: fallback, argsPrefix: [] } : null
}
