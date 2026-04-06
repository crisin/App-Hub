import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getRunnerOutput, getRunnerStatus } from '$lib/server/claude-runner'

/** GET /api/board/claude/output?since=0 — incremental output polling */
export const GET: RequestHandler = async ({ url }) => {
  const since = parseInt(url.searchParams.get('since') ?? '0', 10)
  const { seq, lines } = getRunnerOutput(since)
  const status = getRunnerStatus()

  return json({
    ok: true,
    data: {
      seq,
      lines,
      state: status.state,
      issueTitle: status.issueTitle,
      issueId: status.issueId,
      startedAt: status.startedAt,
      error: status.error,
    },
  })
}
