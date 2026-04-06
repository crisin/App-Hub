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

/** Board lane identifiers */
export type BoardLane = 'backlog' | 'todo' | 'in_progress' | 'claude' | 'review' | 'done'

/** A hub-level kanban board issue */
export interface BoardIssue {
  id: string
  title: string
  description: string
  lane: BoardLane
  priority: TaskPriority
  labels: string[]
  position: number
  assigned_to: string
  project_scope: string // 'hub' (default), project slug, or template slug
  created: string
  updated: string
  attachments?: IssueAttachment[]
}

/** Claude note — progress/commit-style entry on an issue */
export type ClaudeNoteType = 'progress' | 'commit' | 'error' | 'info'

export interface ClaudeNote {
  id: string
  issue_id: string
  type: ClaudeNoteType
  message: string // max ~200 chars, commit-style summary
  created: string
}

/** File attachment on a board issue */
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
  // Joined from board_issues for display
  issue_title?: string
  issue_priority?: string
  issue_labels?: string[]
}

/** Dev API mock user for spawned projects */
export interface DevUser {
  id: string
  email: string
  name: string
  avatar?: string
  role: string
}

/** Dev API key (service-to-service auth for spawned projects) */
export interface DevApiKey {
  id: string
  userId: string
  name: string
  prefix: string // display-only truncated key (e.g. "apphub_a1b2c3d4...")
  created: string
  lastUsed?: string
}

/** Auth token response from POST /api/dev/auth */
export interface DevAuthToken {
  accessToken: string
  refreshToken: string
  expiresIn: number // seconds
  tokenType: 'Bearer'
  user: DevUser
}

/** API response wrapper */
export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}
