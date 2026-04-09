import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import type { ItemStage } from '@apphub/shared'
import { listItemsByStage, listItems } from '$lib/server/data'

/** GET /api/items — list items across all projects (filterable) */
export const GET: RequestHandler = async ({ url }) => {
  const stage = url.searchParams.get('stage') as ItemStage | null
  const project = url.searchParams.get('project') || undefined
  const assigned_to = url.searchParams.get('assigned_to') || undefined
  const search = url.searchParams.get('q') || undefined
  const grouped = url.searchParams.get('grouped')

  const filters = {
    ...(stage ? { stage } : {}),
    ...(project ? { project } : {}),
    ...(assigned_to ? { assigned_to } : {}),
    ...(search ? { search } : {}),
  }

  if (grouped === 'true') {
    const stages = listItemsByStage(filters, { includeProjectInfo: true })
    return json({ ok: true, data: stages })
  }

  const items = listItems(filters, { includeProjectInfo: true })
  return json({ ok: true, data: items })
}
