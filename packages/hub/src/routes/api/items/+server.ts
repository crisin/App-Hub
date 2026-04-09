import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { listItemsByStage, listItems, buildItemFilters } from '$lib/server/data'

/** GET /api/items — list items across all projects (filterable) */
export const GET: RequestHandler = async ({ url }) => {
  const grouped = url.searchParams.get('grouped')
  const filters = buildItemFilters(url)

  if (grouped === 'true') {
    const stages = listItemsByStage(filters, { includeProjectInfo: true })
    return json({ ok: true, data: stages })
  }

  const items = listItems(filters, { includeProjectInfo: true })
  return json({ ok: true, data: items })
}
