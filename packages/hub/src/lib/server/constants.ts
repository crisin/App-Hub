import path from 'node:path'

/** Directory where item attachments are stored */
export const ATTACHMENTS_DIR = path.join(process.cwd(), 'data', 'attachments')

/** Access token TTL in seconds (1 hour) */
export const ACCESS_TTL = 60 * 60

/** Refresh token TTL in seconds (7 days) */
export const REFRESH_TTL = 7 * 24 * 60 * 60
