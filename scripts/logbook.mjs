#!/usr/bin/env node
/**
 * Logbook — the git history is App Hub's logbook (CLAUDE.md, "Git & Logbook").
 * Prints recent commits with their full message bodies.
 *
 *   npm run logbook                     last 15 entries
 *   npm run logbook -- -n 50            last 50
 *   npm run logbook -- --since=2026-10-01
 *   npm run logbook -- packages/hub     only entries touching a path
 *
 * Node instead of an npm-script one-liner: cmd.exe mangles git's %-format codes.
 */
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const hasLimit = args.some((a) => a === '-n' || /^-\d+$/.test(a) || a.startsWith('--max-count'))

const result = spawnSync(
  'git',
  [
    'log',
    ...(hasLimit ? [] : ['-n', '15']),
    '--date=format:%Y-%m-%d %H:%M',
    '--format=%C(yellow)%h%C(reset)  %C(cyan)%ad%C(reset)  %C(bold)%s%C(reset)%n%w(0,4,4)%b',
    ...args,
  ],
  { stdio: 'inherit' },
)
process.exit(result.status ?? 1)
