import fs from 'node:fs'
import path from 'node:path'

/**
 * Finds an attachment file on disk by scanning the issue directory for a file
 * whose name starts with the given attachment ID prefix.
 *
 * Returns the full file path if found, or null if the directory or file does not exist.
 */
export function findAttachmentFile(issueDir: string, attachmentId: string): string | null {
  if (!fs.existsSync(issueDir)) return null
  const match = fs.readdirSync(issueDir).find((f) => f.startsWith(attachmentId))
  return match ? path.join(issueDir, match) : null
}
