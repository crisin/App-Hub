import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import fs from 'node:fs'
import path from 'node:path'
import { APPHUB_META_FILE } from '@apphub/shared'
import { projectLocation, registerProjectPath, syncProjects } from '$lib/server/scanner'
import { slugify } from '$lib/server/templates'
import { logger } from '$lib/server/logger'

/** Minimal marker for an existing repo — .apphub.md is all the hub needs */
function markerFor(name: string, slug: string, description: string): string {
  const now = new Date().toISOString()
  return `---
name: ${JSON.stringify(name)}
slug: ${JSON.stringify(slug)}
description: ${JSON.stringify(description)}
status: active
template: ''
tags: []
created: '${now}'
updated: '${now}'
context: ''
---

# ${name}

Registered with App Hub. Work items for this repo live on the hub board; the
\`context\` field above flows into every coding-agent prompt.
`
}

/**
 * POST /api/projects/register — make an existing repo a hub project.
 * Body: { path, name?, description? }
 *
 * Writes .apphub.md if the repo has none, records paths outside projects/
 * in the machine-local apphub.local.json, then re-syncs. Never moves or
 * copies the repo.
 */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}))
  const rawPath = typeof body.path === 'string' ? body.path.trim() : ''
  if (!rawPath) return json({ ok: false, error: 'path is required' }, { status: 400 })

  const projectPath = path.resolve(rawPath)
  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    return json({ ok: false, error: `Not a directory: ${projectPath}` }, { status: 400 })
  }

  const location = projectLocation(projectPath)
  if (location === 'hub') {
    return json({ ok: false, error: 'The hub repo is always registered (slug "hub")' }, { status: 400 })
  }

  const metaPath = path.join(projectPath, APPHUB_META_FILE)
  const createdMarker = !fs.existsSync(metaPath)
  if (createdMarker) {
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : path.basename(projectPath)
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    fs.writeFileSync(metaPath, markerFor(name, slugify(name), description), 'utf-8')
  }

  if (location === 'external') registerProjectPath(projectPath)

  const project = syncProjects().find((p) => path.resolve(p.path) === projectPath)
  if (!project) {
    return json({ ok: false, error: `Registered, but no project was indexed from ${projectPath}` }, { status: 500 })
  }

  logger.info('project', 'project.registered', `Registered "${project.name}" (${project.slug}) at ${projectPath}`, {
    slug: project.slug,
    path: projectPath,
    location,
    createdMarker,
  })

  return json({ ok: true, data: { ...project, location, createdMarker } }, { status: 201 })
}
