import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import type { DbAttachmentRow } from '$lib/server/db'
import fs from 'node:fs'
import path from 'node:path'
import { ATTACHMENTS_DIR } from '$lib/server/constants'
import { findAttachmentFile } from '$lib/server/file-utils'

/** GET /api/board/:id/attachments/:attachmentId — download/serve a file */
export const GET: RequestHandler = async ({ params }) => {
  const db = getDb()
  const attachment = db
    .prepare('SELECT * FROM issue_attachments WHERE id = ? AND issue_id = ?')
    .get(params.attachmentId, params.id) as DbAttachmentRow | undefined

  if (!attachment) {
    return json({ ok: false, error: 'Attachment not found' }, { status: 404 })
  }

  const issueDir = path.join(ATTACHMENTS_DIR, params.id)
  const filePath = findAttachmentFile(issueDir, attachment.id)

  if (!filePath) {
    return json({ ok: false, error: 'File not found on disk' }, { status: 404 })
  }
  const buffer = fs.readFileSync(filePath)

  return new Response(buffer, {
    headers: {
      'Content-Type': attachment.mime_type,
      'Content-Disposition': `inline; filename="${attachment.filename}"`,
      'Content-Length': String(attachment.size_bytes),
    },
  })
}

/** DELETE /api/board/:id/attachments/:attachmentId — remove an attachment */
export const DELETE: RequestHandler = async ({ params }) => {
  const db = getDb()
  const attachment = db
    .prepare('SELECT * FROM issue_attachments WHERE id = ? AND issue_id = ?')
    .get(params.attachmentId, params.id) as DbAttachmentRow | undefined

  if (!attachment) {
    return json({ ok: false, error: 'Attachment not found' }, { status: 404 })
  }

  // Delete file from disk
  const issueDir = path.join(ATTACHMENTS_DIR, params.id)
  const storedFilePath = findAttachmentFile(issueDir, attachment.id)
  if (storedFilePath) {
    fs.unlinkSync(storedFilePath)
    // Remove directory if empty
    if (fs.readdirSync(issueDir).length === 0) {
      fs.rmdirSync(issueDir)
    }
  }

  // Delete from database
  db.prepare('DELETE FROM issue_attachments WHERE id = ?').run(params.attachmentId)

  return json({ ok: true, data: { id: params.attachmentId } })
}
