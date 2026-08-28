/**
 * POST /api/board/:id/critique — run the debate workflow on a board item.
 * The item (title + description + project context) becomes the topic;
 * critic/advocate/judge agents debate it, the verdict lands as a note
 * on the item and the full report as markdown in logs/agents/.
 *
 * Body: { rounds?: 1-3, critic?: slug, advocate?: slug, judge?: slug }
 */
import type { RequestHandler } from './$types'
import { ok, err } from '$lib/server/response'
import { getItemDetail } from '$lib/server/data'
import { critiqueBoardItem } from '$lib/server/debate'
import { logger } from '$lib/server/logger'

export const POST: RequestHandler = async ({ params, request }) => {
  const item = getItemDetail(params.id)
  if (!item) {
    return err(`Item "${params.id}" not found`, 404)
  }

  let body: { rounds?: unknown; critic?: unknown; advocate?: unknown; judge?: unknown } = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    return err('Invalid JSON body', 400)
  }

  try {
    const result = await critiqueBoardItem(item.id, {
      rounds: typeof body.rounds === 'number' ? body.rounds : undefined,
      criticSlug: typeof body.critic === 'string' ? body.critic : undefined,
      advocateSlug: typeof body.advocate === 'string' ? body.advocate : undefined,
      judgeSlug: typeof body.judge === 'string' ? body.judge : undefined,
    })
    return ok(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error('agents', 'debate.error', `Critique failed for item ${item.id}: ${msg}`, {
      itemId: item.id,
    })
    return err(msg, 502)
  }
}
