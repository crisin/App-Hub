import type { PageServerLoad } from './$types'
import { queryLogs, type LogLevel, type LogCategory } from '$lib/server/logger'

export const load: PageServerLoad = async ({ url }) => {
  const level = url.searchParams.get('level') as LogLevel | null
  const category = url.searchParams.get('category') as LogCategory | null
  const search = url.searchParams.get('search')
  const limit = parseInt(url.searchParams.get('limit') ?? '100', 10)
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

  const { logs, total } = queryLogs({
    level: level ?? undefined,
    category: category ?? undefined,
    search: search ?? undefined,
    limit: Math.min(limit, 500),
    offset,
  })

  return {
    logs,
    total,
    limit,
    offset,
    filters: {
      level: level ?? '',
      category: category ?? '',
      search: search ?? '',
    },
  }
}
