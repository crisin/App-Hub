import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { listDocs, docForRoute, DOC_SECTIONS } from '$lib/server/docs'

/**
 * GET /api/docs — index of docs/ for the help panel.
 * ?route=/board additionally returns the article that explains that page.
 */
export const GET: RequestHandler = async ({ url }) => {
  const docs = listDocs()
  const route = url.searchParams.get('route')
  return json({
    ok: true,
    data: {
      sections: DOC_SECTIONS,
      docs,
      forRoute: route ? (docForRoute(route, docs)?.path ?? null) : null,
    },
  })
}
