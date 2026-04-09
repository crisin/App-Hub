import { queryLogs, type LogLevel, type LogCategory } from '$lib/server/logger'

export interface LogFilterParams {
  level?: LogLevel
  category?: LogCategory
  search?: string
  issueId?: string
  projectSlug?: string
  limit: number
  offset: number
  since?: string
  until?: string
}

/** Parse URL search params into typed log filter params. */
export function parseLogFilterParams(searchParams: URLSearchParams): LogFilterParams {
  const level = searchParams.get('level') as LogLevel | null
  const category = searchParams.get('category') as LogCategory | null
  const search = searchParams.get('search')
  const issueId = searchParams.get('issue_id')
  const projectSlug = searchParams.get('project')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)
  const since = searchParams.get('since')
  const until = searchParams.get('until')

  return {
    level: level ?? undefined,
    category: category ?? undefined,
    search: search ?? undefined,
    issueId: issueId ?? undefined,
    projectSlug: projectSlug ?? undefined,
    limit,
    offset,
    since: since ?? undefined,
    until: until ?? undefined,
  }
}

/** Run a filtered log query from URL search params. */
export function queryLogsFromParams(
  searchParams: URLSearchParams,
): ReturnType<typeof queryLogs> & { limit: number; offset: number } {
  const params = parseLogFilterParams(searchParams)
  const { logs, total } = queryLogs(params)
  return { logs, total, limit: params.limit, offset: params.offset }
}
