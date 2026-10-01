/**
 * Hub configuration — the one place that knows where things live on disk.
 *
 * Every location derives from the hub root: the npm-workspace root that holds
 * packages/hub. It is found by walking up from this module (then from cwd),
 * so the server works whatever the process cwd is — `vite dev` inside
 * packages/hub, `npm run start` from the repo root, or a launchd / Task
 * Scheduler service. Modules must import paths from here instead of
 * computing them from process.cwd().
 *
 * APPHUB_* env vars override locations; relative values resolve against the
 * hub root (see packages/hub/.env.example).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HUB_PORT } from '@apphub/shared'

function isHubRoot(dir: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'))
    return pkg.name === 'apphub' && Array.isArray(pkg.workspaces)
  } catch {
    return false
  }
}

function findHubRoot(): string {
  if (process.env.APPHUB_ROOT) return path.resolve(process.env.APPHUB_ROOT)
  for (const start of [path.dirname(fileURLToPath(import.meta.url)), process.cwd()]) {
    let dir = start
    for (;;) {
      if (isHubRoot(dir)) return dir
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  }
  throw new Error('App Hub root not found (no package.json named "apphub" above) — set APPHUB_ROOT')
}

/** Absolute path of the App Hub monorepo root */
export const HUB_ROOT = findHubRoot()

/** Env override (relative to the hub root) or a default below the hub root */
function envPath(name: string, fallback: string): string {
  const value = process.env[name]
  return value ? path.resolve(HUB_ROOT, value) : path.join(HUB_ROOT, fallback)
}

export const PATHS = {
  root: HUB_ROOT,
  /** Default home of spawned projects (each its own git repo) */
  projects: envPath('APPHUB_PROJECTS_DIR', 'projects'),
  templates: envPath('APPHUB_TEMPLATES_DIR', 'templates'),
  agents: envPath('APPHUB_AGENTS_DIR', 'agents'),
  logs: envPath('APPHUB_LOG_DIR', 'logs'),
  /** Machine-local state: SQLite index + attachments (gitignored) */
  data: envPath('APPHUB_DATA_DIR', path.join('packages', 'hub', 'data')),
  /** Hub sources — read by the architecture graph */
  hubSrc: path.join(HUB_ROOT, 'packages', 'hub', 'src'),
  /** Machine-local settings, e.g. projects registered outside projects/ (gitignored) */
  localConfig: path.join(HUB_ROOT, 'apphub.local.json'),
}

export const DB_PATH = process.env.APPHUB_DB_PATH
  ? path.resolve(HUB_ROOT, process.env.APPHUB_DB_PATH)
  : path.join(PATHS.data, 'apphub.db')

export const ATTACHMENTS_DIR = path.join(PATHS.data, 'attachments')

/** Port the hub listens on (adapter-node reads APPHUB_PORT via envPrefix) */
export const HUB_LISTEN_PORT = Number(process.env.APPHUB_PORT ?? process.env.PORT ?? HUB_PORT)

/** Base URL agents use to call back into the hub API */
export const HUB_URL = `http://localhost:${HUB_LISTEN_PORT}`
