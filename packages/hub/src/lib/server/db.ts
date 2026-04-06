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

  // Add color, icon, archived_at columns to projects
  for (const col of [
    "ALTER TABLE projects ADD COLUMN color TEXT DEFAULT ''",
    "ALTER TABLE projects ADD COLUMN icon TEXT DEFAULT ''",
    'ALTER TABLE projects ADD COLUMN archived_at TEXT DEFAULT NULL',
  ]) {
    try {
      db.exec(col)
    } catch {
      /* column already exists */
    }
  }

  // --- Items table (unified work items) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id            TEXT PRIMARY KEY,
      project_slug  TEXT NOT NULL DEFAULT 'hub',
      title         TEXT NOT NULL,
      description   TEXT DEFAULT '',
      stage         TEXT NOT NULL DEFAULT 'idea',
      priority      TEXT NOT NULL DEFAULT 'medium',
      labels        TEXT DEFAULT '[]',
      position      INTEGER NOT NULL DEFAULT 0,
      assigned_to   TEXT DEFAULT '',
      parent_id     TEXT DEFAULT NULL,
      item_type     TEXT NOT NULL DEFAULT 'task',
      created       TEXT NOT NULL DEFAULT (datetime('now')),
      updated       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_items_project ON items(project_slug);
    CREATE INDEX IF NOT EXISTS idx_items_stage ON items(stage);
    CREATE INDEX IF NOT EXISTS idx_items_parent ON items(parent_id);
    CREATE INDEX IF NOT EXISTS idx_items_assigned ON items(assigned_to);
  `)

  // Migrate board_issues -> items (one-time)
  migrateToItems(db)

  // Ensure "hub" project exists
  const hubExists = db
    .prepare("SELECT COUNT(*) as c FROM projects WHERE slug = 'hub'")
    .get() as { c: number }
  if (hubExists.c === 0) {
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO projects (slug, name, description, status, template, tags, path, created, updated, color, icon)
       VALUES ('hub', 'App Hub', 'Hub development tasks', 'active', '', '["meta"]', @path, @now, @now, '#6366f1', '⬡')`,
    ).run({ path: process.cwd(), now })
  }

  // Seed a default dev user if none exists
  const count = db.prepare('SELECT COUNT(*) as c FROM dev_users').get() as { c: number }
  if (count.c === 0) {
    db.prepare(
      `
      INSERT INTO dev_users (id, email, name, role)
      VALUES ('dev-user-1', 'dev@apphub.local', 'Dev User', 'admin')
    `,
    ).run()
  }
}

/** One-time migration: board_issues -> items */
function migrateToItems(db: Database.Database) {
  // Check if migration already done by looking for data in items
  const itemCount = db.prepare('SELECT COUNT(*) as c FROM items').get() as { c: number }
  if (itemCount.c > 0) return // already migrated

  // Check if there's anything to migrate
  let hasBoardIssues = false
  try {
    const biCount = db.prepare('SELECT COUNT(*) as c FROM board_issues').get() as { c: number }
    hasBoardIssues = biCount.c > 0
  } catch {
    return // board_issues table doesn't exist yet
  }

  if (!hasBoardIssues) return

  // Lane -> Stage mapping
  const laneToStage: Record<string, string> = {
    backlog: 'idea',
    todo: 'plan',
    in_progress: 'build',
    claude: 'build',
    review: 'review',
    done: 'done',
  }

  const issues = db.prepare('SELECT * FROM board_issues').all() as any[]

  const insert = db.prepare(`
    INSERT INTO items (id, project_slug, title, description, stage, priority, labels, position, assigned_to, parent_id, item_type, created, updated)
    VALUES (@id, @project_slug, @title, @description, @stage, @priority, @labels, @position, @assigned_to, NULL, 'task', @created, @updated)
  `)

  const txn = db.transaction(() => {
    for (const issue of issues) {
      insert.run({
        id: issue.id,
        project_slug: issue.project_scope || 'hub',
        title: issue.title,
        description: issue.description || '',
        stage: laneToStage[issue.lane] || 'idea',
        priority: issue.priority || 'medium',
        labels: issue.labels || '[]',
        position: issue.position || 0,
        assigned_to: issue.assigned_to || '',
        created: issue.created,
        updated: issue.updated,
      })
    }
  })

  txn()
  console.log(`[db] Migrated ${issues.length} board issues → items table`)
}
