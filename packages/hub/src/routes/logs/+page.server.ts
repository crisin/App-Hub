import type { PageServerLoad } from './$types'
import { queryLogsFromParams } from '$lib/server/log-queries'

export const load: PageServerLoad = async ({ url }) => {
  const { logs, total, limit, offset } = queryLogsFromParams(url.searchParams)

  return {
    logs,
    total,
    limit,
    offset,
    filters: {
      level: url.searchParams.get('level') ?? '',
      category: url.searchParams.get('category') ?? '',
      search: url.searchParams.get('search') ?? '',
    },
  }
}
