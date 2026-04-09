/**
 * GET /api/projects/:slug/summary
 *
 * Returns a pre-computed project summary combining architecture analysis,
 * DB metadata, and existing board items. Useful for debugging the AI
 * suggestion context and for external tool consumption.
 */
import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { buildProjectSummary, formatSummaryForPrompt } from '$lib/server/project-summary'

export const GET: RequestHandler = async ({ params, url }) => {
  const { slug } = params
  const format = url.searchParams.get('format') // 'json' (default) or 'text'

  try {
    const summary = buildProjectSummary(slug)

    if (format === 'text') {
      return new Response(formatSummaryForPrompt(summary), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    return json({ ok: true, data: summary })
  } catch (err: any) {
    return json({ ok: false, error: err.message }, { status: 500 })
  }
}
