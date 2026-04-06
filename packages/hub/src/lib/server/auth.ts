/**
 * Central Auth utilities — JWT, password hashing, API keys.
 * All crypto via Node.js built-ins; no external dependencies.
 */

import crypto from 'node:crypto'
import { getDb } from './db.js'

// ─── JWT ─────────────────────────────────────────────────────────────────────

function b64url(data: string | Buffer): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded, 'base64')
}

export function getOrCreateJwtSecret(): string {
  const db = getDb()
  const row = db.prepare("SELECT value FROM dev_config WHERE key = 'jwt_secret'").get() as
    | { value: string }
    | undefined
  if (row) return row.value

  const secret = crypto.randomBytes(32).toString('hex')
  db.prepare("INSERT INTO dev_config (key, value) VALUES ('jwt_secret', ?)").run(secret)
  return secret
}

export interface JwtPayload {
  sub: string // user id
  email: string
  role: string
  iat: number
  exp: number
  iss: string
  [key: string]: unknown
}

export function signJWT(payload: Record<string, unknown>, expiresInSeconds: number): string {
  const secret = getOrCreateJwtSecret()
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const claims = { ...payload, iat: now, exp: now + expiresInSeconds, iss: 'apphub-dev' }
  const body = b64url(JSON.stringify(claims))
  const sig = b64url(crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest())
  return `${header}.${body}.${sig}`
}

export function verifyJWT(token: string): JwtPayload | null {
  try {
    const secret = getOrCreateJwtSecret()
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, body, sig] = parts
    const expected = b64url(
      crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest(),
    )
    // constant-time compare (pad to same length to avoid length leaks)
    if (sig.length !== expected.length) return null
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const payload = JSON.parse(b64urlDecode(body).toString('utf8')) as JwtPayload
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

// ─── Passwords (scrypt) ───────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex')
  const key = await new Promise<Buffer>((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (err, k) => (err ? reject(err) : resolve(k))),
  )
  return `scrypt:${salt}:${key.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored || !stored.startsWith('scrypt:')) return false
  const parts = stored.split(':')
  if (parts.length !== 3) return false
  const [, salt, hash] = parts
  const key = await new Promise<Buffer>((resolve, reject) =>
    crypto.scrypt(password, salt, 64, (err, k) => (err ? reject(err) : resolve(k))),
  )
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), key)
  } catch {
    return false
  }
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

/** Hash an API key for storage (SHA-256, fast lookup). */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/** Generate a new API key. Returns the plaintext key (shown once) and a display prefix. */
export function generateApiKey(): { key: string; prefix: string } {
  const raw = crypto.randomBytes(32).toString('hex')
  const key = `apphub_${raw}`
  return { key, prefix: `apphub_${raw.slice(0, 8)}...` }
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

/** CORS headers for dev auth endpoints (permissive — local dev only). */
export function corsHeaders(origin?: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}
