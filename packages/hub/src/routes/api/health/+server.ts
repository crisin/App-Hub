import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db.js'
import { getRunnerStatus } from '$lib/server/claude-runner.js'

const startTime = Date.now()

export const GET: RequestHandler = async () => {
  let dbStatus = 'disconnected'
  try {
    const db = getDb()
    const row = db.prepare('SELECT 1 as ok').get() as { ok: number } | undefined
    dbStatus = row?.ok === 1 ? 'connected' : 'error'
  } catch {
    dbStatus = 'error'
  }

  const runner = getRunnerStatus()

  return json({
    ok: true,
    data: {
      status: dbStatus === 'connected' ? 'healthy' : 'degraded',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      db: dbStatus,
      runner: runner.state,
      pid: process.pid,
      nodeVersion: process.version,
    },
  })
}
