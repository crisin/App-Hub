/**
 * apphub.local.json — machine-local settings (gitignored).
 *
 * Everything in here is a path that differs per machine: repos registered
 * from outside projects/, and where the kosmos vault lives. Nothing that
 * should travel through git belongs in this file.
 */
import fs from 'node:fs'
import { PATHS } from './config.js'

export interface LocalConfig {
  /** Repos registered from outside projects/ (see scanner.ts) */
  projects?: string[]
  /** kosmos vault, or a bare clone of its werkstatt repo (see kosmos.ts) */
  kosmos?: string
}

export function readLocalConfig(): LocalConfig {
  try {
    return JSON.parse(fs.readFileSync(PATHS.localConfig, 'utf-8')) as LocalConfig
  } catch {
    return {}
  }
}

export function writeLocalConfig(config: LocalConfig): void {
  fs.writeFileSync(PATHS.localConfig, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}
