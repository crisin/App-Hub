import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import type { ProjectStatus, ItemStage, ItemPriority, ItemType, PhaseStatus, ClaudeNoteType, DependencyType } from '@apphub/shared'

// ── DB row types (match SQLite column shapes) ──────────────────────────────

export interface DbProjectRow {
  slug: string
  name: string
  description: string
  context: string
  status: ProjectStatus
  template: string
  tags: string // JSON-encoded string[]
  path: string
  created: string
  updated: string
  synced_at: string
  color: string
  icon: string
  archived_at: string | null
}

export interface DbItemRow {
  id: string
  project_slug: string
  title: string
  description: string
  stage: ItemStage
  priority: ItemPriority
  labels: string // JSON-encoded string[]
  position: number
  assigned_to: string
  parent_id: string | null
  phase_id: string | null
  item_type: ItemType
  created: string
  updated: string
}

export interface DbPhaseRow {
  id: string
  project_slug: string
  name: string
  position: number
  status: PhaseStatus
  target_date: string | null
  created: string
  updated: string
}

export interface DbNoteRow {
  id: string
  issue_id: string
  type: ClaudeNoteType
  message: string
  created: string
}

export interface DbAttachmentRow {
  id: string
  issue_id: string
  filename: string
  mime_type: string
  size_bytes: number
  created: string
}

export interface DbBranchReviewRow {
  id: string
  issue_id: string
  branch_name: string
  project_scope: string
  worktree_path: string
  base_branch: string
  status: 'pending' | 'merged' | 'discarded'
  commit_count: number
  created: string
  merged_at: string | null
  discarded_at: string | null
}

export interface DbDependencyRow {
  id: string
  item_id: string
  depends_on_id: string
  dependency_type: DependencyType
  created: string
}

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

    -- board_issues table removed (migrated to items table)

    CREATE TABLE IF NOT EXISTS claude_notes (
      id          TEXT PRIMARY KEY,
      issue_id    TEXT NOT NULL,
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
      issue_id    TEXT NOT NULL,
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
      issue_id      TEXT NOT NULL,
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

  // Add color, icon, archived_at, context columns to projects
  for (const col of [
    "ALTER TABLE projects ADD COLUMN color TEXT DEFAULT ''",
    "ALTER TABLE projects ADD COLUMN icon TEXT DEFAULT ''",
    'ALTER TABLE projects ADD COLUMN archived_at TEXT DEFAULT NULL',
    "ALTER TABLE projects ADD COLUMN context TEXT DEFAULT ''",
  ]) {
    try {
      db.exec(col)
    } catch {
      /* column already exists */
    }
  }

  // --- Items table (unified work items — single source of truth) ---
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

  // --- Phases table (project milestones) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS phases (
      id            TEXT PRIMARY KEY,
      project_slug  TEXT NOT NULL,
      name          TEXT NOT NULL,
      position      INTEGER NOT NULL DEFAULT 0,
      status        TEXT NOT NULL DEFAULT 'upcoming',
      target_date   TEXT DEFAULT NULL,
      created       TEXT NOT NULL DEFAULT (datetime('now')),
      updated       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_phases_project ON phases(project_slug);
  `)

  // Add phase_id column to items if it doesn't exist yet
  try {
    db.exec('ALTER TABLE items ADD COLUMN phase_id TEXT DEFAULT NULL')
  } catch {
    // column already exists
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_items_phase ON items(phase_id)')

  // --- Item dependencies table ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS item_dependencies (
      id              TEXT PRIMARY KEY,
      item_id         TEXT NOT NULL,
      depends_on_id   TEXT NOT NULL,
      dependency_type TEXT NOT NULL DEFAULT 'blocks',
      created         TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(item_id, depends_on_id)
    );

    CREATE INDEX IF NOT EXISTS idx_deps_item ON item_dependencies(item_id);
    CREATE INDEX IF NOT EXISTS idx_deps_depends ON item_dependencies(depends_on_id);
  `)

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

  // Seed the creator account if no creator exists
  const creator = db
    .prepare("SELECT COUNT(*) as c FROM dev_users WHERE role = 'creator'")
    .get() as { c: number }
  if (creator.c === 0) {
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

// board_issues → items migration removed (completed, no longer needed)
