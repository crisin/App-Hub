import { json } from '@sveltejs/kit'

/** Standard success response: { ok: true, data: T } */
export function ok<T>(data: T, status = 200) {
  return json({ ok: true, data }, { status })
}

/** Standard error response: { ok: false, error: string } */
export function err(error: string, status = 400) {
  return json({ ok: false, error }, { status })
}
