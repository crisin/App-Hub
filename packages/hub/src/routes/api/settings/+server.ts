import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getAllSettings, setSettings } from '$lib/server/settings'

export const GET: RequestHandler = async () => {
  const settings = getAllSettings()
  return json({ ok: true, data: settings })
}

export const PATCH: RequestHandler = async ({ request }) => {
  const body = await request.json()
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(
      { ok: false, error: 'Body must be a JSON object of key-value pairs' },
      { status: 400 },
    )
  }

  const entries: Record<string, string> = {}
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'string') {
      return json({ ok: false, error: `Value for "${key}" must be a string` }, { status: 400 })
    }
    entries[key] = value
  }

  setSettings(entries)
  const settings = getAllSettings()
  return json({ ok: true, data: settings })
}
