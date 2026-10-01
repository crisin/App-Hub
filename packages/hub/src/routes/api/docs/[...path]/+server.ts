import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDoc } from '$lib/server/docs'

/** GET /api/docs/<path> — one article from docs/, as markdown and rendered HTML */
export const GET: RequestHandler = async ({ params }) => {
  const doc = getDoc(params.path)
  if (!doc) return json({ ok: false, error: `No doc at "${params.path}"` }, { status: 404 })
  return json({ ok: true, data: doc })
}
