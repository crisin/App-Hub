/** Project status lifecycle */
export type ProjectStatus = 'idea' | 'active' | 'paused' | 'completed' | 'archived'

/** Task priority levels */
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical'

/** Task status */
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'

/** Project metadata stored in .apphub.md frontmatter */
export interface ProjectMeta {
  name: string
  slug: string
  description: string
  status: ProjectStatus
  template: string
  tags: string[]
  created: string // ISO date
  updated: string // ISO date
  repo?: string // git remote URL if any
}

/** A single task from TASKS.md */
export interface Task {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  description?: string
  created: string
  updated: string
}

/** Full project representation (meta + tasks + computed) */
export interface Project extends ProjectMeta {
  path: string
  tasks: Task[]
  taskSummary: {
    total: number
    todo: number
    in_progress: number
    done: number
    blocked: number
  }
}

/** Template definition */
export interface Template {
  name: string
  slug: string
  description: string
  source: string // git repo URL or local path
  tags: string[]
  postCreate?: string // shell command to run after cloning
}

/**
 * Item stage — the unified flow pipeline.
 * 'claude' is a special execution stage where Claude Code works on the item.
 */
export type ItemStage = 'idea' | 'plan' | 'build' | 'claude' | 'review' | 'done'

/** Item type — semantic distinction */
export type ItemType = 'task' | 'idea' | 'bug' | 'plan' | 'note'

/** A work item — the single source of truth for all tracked work */
export interface Item {
  id: string
  project_slug: string
  title: string
  description: string
  stage: ItemStage
  priority: TaskPriority
  labels: string[]
  position: number
  assigned_to: string
  parent_id: string | null
  item_type: ItemType
  created: string
  updated: string
  // Joined/computed fields
  attachment_count?: number
  child_count?: number
  blocked_by_count?: number
  blocks_count?: number
  is_blocked?: boolean
  attachments?: IssueAttachment[]
  notes?: ClaudeNote[]
  blocked_by?: ItemDependency[]
  blocks?: ItemDependency[]
}

/** Project with computed item stats */
export interface ProjectWithStats extends ProjectMeta {
  path: string
  color: string
  icon: string
  archived_at: string | null
  itemCounts: Record<ItemStage, number>
  totalItems: number
  claudeActive: boolean
}

/** Dependency relationship types */
export type DependencyType = 'blocks' | 'relates_to'

/** A dependency link between two items */
export interface ItemDependency {
  id: string
  item_id: string
  depends_on_id: string
  dependency_type: DependencyType
  created: string
  // Joined fields for display
  item_title?: string
  item_stage?: ItemStage
  depends_on_title?: string
  depends_on_stage?: ItemStage
  depends_on_project?: string
}

// --- Legacy aliases (kept for migration period) ---

/** @deprecated Use ItemStage instead */
export type BoardLane = 'backlog' | 'todo' | 'in_progress' | 'claude' | 'review' | 'done'

/** @deprecated Use Item instead */
export interface BoardIssue {
  id: string
  title: string
  description: string
  lane: BoardLane
  priority: TaskPriority
  labels: string[]
  position: number
  assigned_to: string
  project_scope: string
  created: string
  updated: string
  attachments?: IssueAttachment[]
}

/** Claude note — progress/commit-style entry on an item */
export type ClaudeNoteType = 'progress' | 'commit' | 'error' | 'info'

export interface ClaudeNote {
  id: string
  issue_id: string
  type: ClaudeNoteType
  message: string
  created: string
}

/** File attachment on an item */
export interface IssueAttachment {
  id: string
  issue_id: string
  filename: string
  mime_type: string
  size_bytes: number
  created: string
}

/** Branch review — tracks a Claude branch awaiting merge */
export interface BranchReview {
  id: string
  issue_id: string
  branch_name: string
  project_scope: string
  worktree_path: string
  base_branch: string
  status: 'pending' | 'merged' | 'discarded'
  commit_count: number
  created: string
  merged_at?: string
  discarded_at?: string
  // Joined from items for display
  issue_title?: string
  issue_priority?: string
  issue_labels?: string[]
}

/** User role hierarchy: creator > admin > user */
export type DevUserRole = 'creator' | 'admin' | 'user'

/** Dev API mock user for spawned projects */
export interface DevUser {
  id: string
  email: string
  name: string
  avatar?: string
  role: DevUserRole
}

/** Dev API key (service-to-service auth for spawned projects) */
export interface DevApiKey {
  id: string
  userId: string
  name: string
  prefix: string
  created: string
  lastUsed?: string
}

/** Auth token response from POST /api/dev/auth */
export interface DevAuthToken {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
  user: DevUser
}

/** API response wrapper */
export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}
