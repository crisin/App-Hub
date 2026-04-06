/**
 * Activity Logger — comprehensive structured logging for all hub actions.
 *
 * All events are stored in SQLite for review via the /logs UI.
 * Each log entry has a category, action, human-readable message,
 * optional metadata (JSON), and a severity level.
 */
import { getDb } from './db.js'
import { randomUUID } from 'node:crypto'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogCategory = 'board' | 'claude' | 'project' | 'sync' | 'auth' | 'system'

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  category: LogCategory
  action: string
  message: string
  metadata: string // JSON string
  issue_id?: string
  project_slug?: string
}

/**
 * Write a log entry to the database.
 */
export function log(
  level: LogLevel,
  category: LogCategory,
  action: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  try {
    const db = getDb()
    db.prepare(
      `
      INSERT INTO activity_log (id, timestamp, level, category, action, message, metadata, issue_id, project_slug)
      VALUES (@id, @timestamp, @level, @category, @action, @message, @metadata, @issue_id, @project_slug)
    `,
    ).run({
      id: `log-${randomUUID().slice(0, 12)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      action,
      message,
      metadata: JSON.stringify(meta ?? {}),
      issue_id: meta?.issueId ?? meta?.issue_id ?? null,
      project_slug: meta?.projectSlug ?? meta?.project_slug ?? meta?.slug ?? null,
    })
  } catch (err) {
    // Never let logging break the app
    console.error('[logger] Failed to write log:', err)
  }
}

// Convenience methods
export const logger = {
  debug: (cat: LogCategory, action: string, msg: string, meta?: Record<string, unknown>) =>
    log('debug', cat, action, msg, meta),

  info: (cat: LogCategory, action: string, msg: string, meta?: Record<string, unknown>) =>
    log('info', cat, action, msg, meta),

  warn: (cat: LogCategory, action: string, msg: string, meta?: Record<string, unknown>) =>
    log('warn', cat, action, msg, meta),

  error: (cat: LogCategory, action: string, msg: string, meta?: Record<string, unknown>) =>
    log('error', cat, action, msg, meta),
}

/**
 * Query logs with filtering and pagination.
 */
export function queryLogs(
  opts: {
    level?: LogLevel
    category?: LogCategory
    search?: string
    issueId?: string
    projectSlug?: string
    limit?: number
    offset?: number
    since?: string // ISO timestamp
    until?: string // ISO timestamp
  } = {},
): { logs: LogEntry[]; total: number } {
  const db = getDb()
  const conditions: string[] = []
  const params: Record<string, unknown> = {}

  if (opts.level) {
    conditions.push('level = @level')
    params.level = opts.level
  }
  if (opts.category) {
    conditions.push('category = @category')
    params.category = opts.category
  }
  if (opts.search) {
    conditions.push('(message LIKE @search OR action LIKE @search OR metadata LIKE @search)')
    params.search = `%${opts.search}%`
  }
  if (opts.issueId) {
    conditions.push('issue_id = @issueId')
    params.issueId = opts.issueId
  }
  if (opts.projectSlug) {
    conditions.push('project_slug = @projectSlug')
    params.projectSlug = opts.projectSlug
  }
  if (opts.since) {
    conditions.push('timestamp >= @since')
    params.since = opts.since
  }
  if (opts.until) {
    conditions.push('timestamp <= @until')
    params.until = opts.until
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = opts.limit ?? 100
  const offset = opts.offset ?? 0

  const total = (
    db.prepare(`SELECT COUNT(*) as c FROM activity_log ${where}`).get(params) as { c: number }
  ).c
  const logs = db
    .prepare(
      `SELECT * FROM activity_log ${where} ORDER BY timestamp DESC LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit, offset }) as LogEntry[]

  return { logs, total }
}
