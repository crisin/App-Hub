#!/usr/bin/env node
/**
 * Production entry: `npm run start`, the macOS launchd service and Windows
 * autostart all go through here so the defaults live in one place.
 *
 * adapter-node on its own listens on 0.0.0.0:3000. The hub spawns coding
 * agents with shell access on request, so it must not be reachable from the
 * LAN by default, and the CLI expects port 5174. Override with APPHUB_HOST /
 * APPHUB_PORT (adapter-node reads them through its envPrefix).
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

process.env.APPHUB_HOST ??= '127.0.0.1'
process.env.APPHUB_PORT ??= '5174'
process.env.NODE_ENV ??= 'production'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
await import(pathToFileURL(path.join(root, 'packages', 'hub', 'build', 'index.js')).href)
