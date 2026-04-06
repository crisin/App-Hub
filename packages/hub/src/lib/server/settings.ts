import { getDb } from './db'

export type Settings = Record<string, string>

const DEFAULTS: Settings = {
  theme: 'dark',
}

export function getSetting(key: string): string {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? DEFAULTS[key] ?? ''
}

export function getAllSettings(): Settings {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM settings').all() as {
    key: string
    value: string
  }[]
  const settings = { ...DEFAULTS }
  for (const row of rows) {
    settings[row.key] = row.value
  }
  return settings
}

export function setSetting(key: string, value: string): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO settings (key, value, updated) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = excluded.updated`,
  ).run(key, value)
}

export function setSettings(entries: Settings): void {
  const db = getDb()
  const stmt = db.prepare(
    `INSERT INTO settings (key, value, updated) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated = excluded.updated`,
  )
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(entries)) {
      stmt.run(key, value)
    }
  })
  tx()
}
