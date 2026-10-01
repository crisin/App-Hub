#!/usr/bin/env node
/**
 * Windows autostart for App Hub — the counterpart of install-service.sh (macOS).
 * Registers a per-user Task Scheduler task that starts the production build at
 * logon, headless (no console window), bound to 127.0.0.1:5174 via start.mjs.
 *
 *   node scripts/autostart-windows.mjs install     build first: npm run build
 *   node scripts/autostart-windows.mjs uninstall
 *   node scripts/autostart-windows.mjs status
 *   add --dry-run to print the schtasks call instead of running it
 *
 * No admin rights needed: the task runs as the current user, limited privileges.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TASK_NAME = 'App Hub'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const startScript = path.join(root, 'scripts', 'start.mjs')
const buildEntry = path.join(root, 'packages', 'hub', 'build', 'index.js')

const [command = 'status', ...flags] = process.argv.slice(2)
const dryRun = flags.includes('--dry-run')

if (process.platform !== 'win32' && !dryRun) {
  console.error('Windows only. On macOS use ./scripts/install-service.sh')
  process.exit(1)
}

function schtasks(args) {
  if (dryRun) {
    console.log(['schtasks', ...args.map((a) => (a.includes(' ') ? `"${a}"` : a))].join(' '))
    return ''
  }
  return execFileSync('schtasks', args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
}

switch (command) {
  case 'install': {
    if (!fs.existsSync(buildEntry) && !dryRun) {
      console.error(`No production build at ${buildEntry} — run: npm run build`)
      process.exit(1)
    }
    // conhost --headless runs node without a visible console window (Windows 10 1903+ / 11)
    const action = `conhost.exe --headless "${process.execPath}" "${startScript}"`
    schtasks(['/Create', '/TN', TASK_NAME, '/TR', action, '/SC', 'ONLOGON', '/RL', 'LIMITED', '/F'])
    if (!dryRun) {
      console.log(`✓ Task "${TASK_NAME}" registered — App Hub starts at logon on http://127.0.0.1:5174`)
      console.log(`  Start it now: schtasks /Run /TN "${TASK_NAME}"`)
    }
    break
  }
  case 'uninstall':
    schtasks(['/Delete', '/TN', TASK_NAME, '/F'])
    if (!dryRun) console.log(`✓ Task "${TASK_NAME}" removed (a running hub keeps running until logoff)`)
    break
  case 'status':
    try {
      console.log(schtasks(['/Query', '/TN', TASK_NAME, '/FO', 'LIST']))
    } catch {
      console.log(`Task "${TASK_NAME}" is not registered.`)
    }
    break
  default:
    console.error('Usage: node scripts/autostart-windows.mjs install|uninstall|status [--dry-run]')
    process.exit(1)
}
