import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

// process.cwd() is the hub package root in dev, reliable across Vite SSR and built modes
const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'apphub.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!_db) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')
    migrate(_db)
  }
  return _db
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      slug        TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'idea',
      template    TEXT DEFAULT '',
      tags        TEXT DEFAULT '[]',
      path        TEXT NOT NULL,
      created     TEXT NOT NULL,
      updated     TEXT NOT NULL,
      synced_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id          TEXT NOT NULL,
      project     TEXT NOT NULL REFERENCES projects(slug) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'todo',
      priority    TEXT NOT NULL DEFAULT 'medium',
      description TEXT DEFAULT '',
      created     TEXT NOT NULL,
      updated     TEXT NOT NULL,
      synced_at   TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (id, project)
    );

    CREATE TABLE IF NOT EXISTS dev_users (
      id          TEXT PRIMARY KEY,
      email       TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      avatar      TEXT DEFAULT '',
      role        TEXT NOT NULL DEFAULT 'user',
      created     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS board_issues (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT DEFAULT '',
      lane        TEXT NOT NULL DEFAULT 'backlog',
      priority    TEXT NOT NULL DEFAULT 'medium',
      labels      TEXT DEFAULT '[]',
      position    INTEGER NOT NULL DEFAULT 0,
      assigned_to TEXT DEFAULT '',
      created     TEXT NOT NULL DEFAULT (datetime('now')),
      updated     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS claude_notes (
      id          TEXT PRIMARY KEY,
      issue_id    TEXT NOT NULL REFERENCES board_issues(id) ON DELETE CASCADE,
      type        TEXT NOT NULL DEFAULT 'progress',
      message     TEXT NOT NULL,
      created     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_claude_notes_issue ON claude_notes(issue_id);

    CREATE TABLE IF NOT EXISTS dev_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dev_refresh_tokens (
      id        TEXT PRIMARY KEY,
      user_id   TEXT NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
      token     TEXT UNIQUE NOT NULL,
      expires   TEXT NOT NULL,
      created   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dev_api_keys (
      id        TEXT PRIMARY KEY,
      user_id   TEXT NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
      name      TEXT NOT NULL,
      key_hash  TEXT UNIQUE NOT NULL,
      prefix    TEXT NOT NULL,
      created   TEXT NOT NULL DEFAULT (datetime('now')),
      last_used TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS issue_attachments (
      id          TEXT PRIMARY KEY,
      issue_id    TEXT NOT NULL REFERENCES board_issues(id) ON DELETE CASCADE,
      filename    TEXT NOT NULL,
      mime_type   TEXT NOT NULL,
      size_bytes  INTEGER NOT NULL DEFAULT 0,
      created     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id            TEXT PRIMARY KEY,
      timestamp     TEXT NOT NULL,
      level         TEXT NOT NULL DEFAULT 'info',
      category      TEXT NOT NULL,
      action        TEXT NOT NULL,
      message       TEXT NOT NULL,
      metadata      TEXT DEFAULT '{}',
      issue_id      TEXT,
      project_slug  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_activity_log_ts ON activity_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_activity_log_cat ON activity_log(category);
    CREATE INDEX IF NOT EXISTS idx_activity_log_level ON activity_log(level);
    CREATE INDEX IF NOT EXISTS idx_activity_log_issue ON activity_log(issue_id);
    CREATE INDEX IF NOT EXISTS idx_activity_log_project ON activity_log(project_slug);

    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_board_issues_lane ON board_issues(lane);
    CREATE INDEX IF NOT EXISTS idx_issue_attachments_issue ON issue_attachments(issue_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON dev_refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON dev_api_keys(user_id);

    CREATE TABLE IF NOT EXISTS settings (
      key         TEXT PRIMARY KEY,
      value       TEXT NOT NULL,
      updated     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS branch_reviews (
      id            TEXT PRIMARY KEY,
      issue_id      TEXT NOT NULL REFERENCES board_issues(id) ON DELETE CASCADE,
      branch_name   TEXT NOT NULL UNIQUE,
      project_scope TEXT NOT NULL DEFAULT 'hub',
      worktree_path TEXT NOT NULL,
      base_branch   TEXT NOT NULL DEFAULT 'main',
      status        TEXT NOT NULL DEFAULT 'pending',
      commit_count  INTEGER NOT NULL DEFAULT 0,
      created       TEXT NOT NULL DEFAULT (datetime('now')),
      merged_at     TEXT,
      discarded_at  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_branch_reviews_issue ON branch_reviews(issue_id);
    CREATE INDEX IF NOT EXISTS idx_branch_reviews_status ON branch_reviews(status);
  `)

  // Add password_hash column to dev_users if it doesn't exist yet
  try {
    db.exec("ALTER TABLE dev_users ADD COLUMN password_hash TEXT DEFAULT ''")
  } catch {
    // column already exists — ignore
  }

  // Add project_scope column to board_issues
  try {
    db.exec("ALTER TABLE board_issues ADD COLUMN project_scope TEXT NOT NULL DEFAULT 'hub'")
  } catch {
    // column already exists — ignore
  }

  // Seed the creator account if no creator exists
  const creator = db
    .prepare("SELECT COUNT(*) as c FROM dev_users WHERE role = 'creator'")
    .get() as { c: number }
  if (creator.c === 0) {
    // Check if the old default admin exists and upgrade it, otherwise create fresh
    const oldDefault = db
      .prepare("SELECT id FROM dev_users WHERE id = 'dev-user-1'")
      .get() as { id: string } | undefined
    if (oldDefault) {
      db.prepare("UPDATE dev_users SET role = 'creator' WHERE id = 'dev-user-1'").run()
    } else {
      db.prepare(
        `INSERT INTO dev_users (id, email, name, role)
         VALUES ('dev-user-1', 'creator@apphub.local', 'Creator', 'creator')`,
      ).run()
    }
  }
}
