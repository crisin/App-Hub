import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import type { DbAttachmentRow } from '$lib/server/db'
import fs from 'node:fs'
import path from 'node:path'
import { ATTACHMENTS_DIR } from '$lib/server/constants'

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
  // Find the stored file by attachment ID prefix
  const files = fs.existsSync(issueDir) ? fs.readdirSync(issueDir) : []
  const storedFile = files.find((f) => f.startsWith(attachment.id))

  if (!storedFile) {
    return json({ ok: false, error: 'File not found on disk' }, { status: 404 })
  }

  const filePath = path.join(issueDir, storedFile)
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
  if (fs.existsSync(issueDir)) {
    const files = fs.readdirSync(issueDir)
    const storedFile = files.find((f) => f.startsWith(attachment.id))
    if (storedFile) {
      fs.unlinkSync(path.join(issueDir, storedFile))
    }
    // Remove directory if empty
    const remaining = fs.readdirSync(issueDir)
    if (remaining.length === 0) {
      fs.rmdirSync(issueDir)
    }
  }

  // Delete from database
  db.prepare('DELETE FROM issue_attachments WHERE id = ?').run(params.attachmentId)

  return json({ ok: true, data: { id: params.attachmentId } })
}
