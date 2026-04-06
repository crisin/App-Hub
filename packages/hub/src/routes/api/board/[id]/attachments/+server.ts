import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getDb } from '$lib/server/db'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { ATTACHMENT_MIME_TYPES, ATTACHMENT_MAX_SIZE } from '@apphub/shared'

const ATTACHMENTS_DIR = path.join(process.cwd(), 'data', 'attachments')

/** GET /api/board/:id/attachments — list attachments for an issue */
export const GET: RequestHandler = async ({ params }) => {
  const db = getDb()
  const issue = db.prepare('SELECT id FROM board_issues WHERE id = ?').get(params.id)
  if (!issue) {
    return json({ ok: false, error: 'Issue not found' }, { status: 404 })
  }

  const attachments = db
    .prepare('SELECT * FROM issue_attachments WHERE issue_id = ? ORDER BY created ASC')
    .all(params.id)

  return json({ ok: true, data: attachments })
}

/** POST /api/board/:id/attachments — upload a file attachment */
export const POST: RequestHandler = async ({ params, request }) => {
  const db = getDb()
  const issue = db.prepare('SELECT id FROM board_issues WHERE id = ?').get(params.id)
  if (!issue) {
    return json({ ok: false, error: 'Issue not found' }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file || !(file instanceof File)) {
    return json({ ok: false, error: 'No file provided' }, { status: 400 })
  }

  if (!ATTACHMENT_MIME_TYPES.includes(file.type)) {
    return json(
      {
        ok: false,
        error: `Unsupported file type: ${file.type}. Allowed: ${ATTACHMENT_MIME_TYPES.join(', ')}`,
      },
      { status: 400 },
    )
  }

  if (file.size > ATTACHMENT_MAX_SIZE) {
    return json(
      {
        ok: false,
        error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: ${ATTACHMENT_MAX_SIZE / 1024 / 1024} MB`,
      },
      { status: 400 },
    )
  }

  const attachmentId = `att-${randomUUID().slice(0, 8)}`
  const issueDir = path.join(ATTACHMENTS_DIR, params.id)
  fs.mkdirSync(issueDir, { recursive: true })

  // Sanitize filename: keep only safe characters
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storedName = `${attachmentId}_${safeName}`
  const filePath = path.join(issueDir, storedName)

  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(filePath, buffer)

  const now = new Date().toISOString()
  db.prepare(
    `
    INSERT INTO issue_attachments (id, issue_id, filename, mime_type, size_bytes, created)
    VALUES (@id, @issue_id, @filename, @mime_type, @size_bytes, @created)
  `,
  ).run({
    id: attachmentId,
    issue_id: params.id,
    filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    created: now,
  })

  const attachment = db.prepare('SELECT * FROM issue_attachments WHERE id = ?').get(attachmentId)
  return json({ ok: true, data: attachment }, { status: 201 })
}
