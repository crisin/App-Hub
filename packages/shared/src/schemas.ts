import type { ProjectStatus, TaskPriority, TaskStatus, BoardLane, ItemStage, ItemType, DependencyType } from './types.js'

/** Valid project statuses */
export const PROJECT_STATUSES: ProjectStatus[] = [
  'idea',
  'active',
  'paused',
  'completed',
  'archived',
]

/** Valid task statuses */
export const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'blocked']

/** Valid task priorities */
export const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical']

/** Item stages — the unified flow pipeline (including claude execution stage) */
export const ITEM_STAGES: ItemStage[] = ['idea', 'plan', 'build', 'claude', 'review', 'done']

/** Display stages — stages shown in the project flow view (excludes claude) */
export const FLOW_STAGES: ItemStage[] = ['idea', 'plan', 'build', 'review', 'done']

/** Human-readable stage labels */
export const ITEM_STAGE_LABELS: Record<ItemStage, string> = {
  idea: 'Idea',
  plan: 'Plan',
  build: 'Build',
  claude: 'Claude',
  review: 'Review',
  done: 'Done',
}

/** Item types */
export const ITEM_TYPES: ItemType[] = ['task', 'idea', 'bug', 'plan', 'note']

/** Dependency types */
export const DEPENDENCY_TYPES: DependencyType[] = ['blocks', 'relates_to']

/** Map old board lanes to item stages */
export const LANE_TO_STAGE: Record<BoardLane, ItemStage> = {
  backlog: 'idea',
  todo: 'plan',
  in_progress: 'build',
  claude: 'claude',
  review: 'review',
  done: 'done',
}

/** @deprecated Use ITEM_STAGES instead */
export const BOARD_LANES: BoardLane[] = [
  'backlog',
  'todo',
  'in_progress',
  'claude',
  'review',
  'done',
]

/** @deprecated Use ITEM_STAGE_LABELS instead */
export const BOARD_LANE_LABELS: Record<BoardLane, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  claude: 'Claude',
  review: 'Review',
  done: 'Done',
}

/** Allowed attachment MIME types */
export const ATTACHMENT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'application/json',
]

/** Max attachment size in bytes (10 MB) */
export const ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024

/** Default .apphub.md frontmatter template */
export function defaultProjectMeta(name: string, slug: string, template: string): string {
  const now = new Date().toISOString()
  return `---
name: "${name}"
slug: "${slug}"
description: ""
status: idea
template: "${template}"
tags: []
created: "${now}"
updated: "${now}"
---

# ${name}

> Describe your project idea here.

## Goals

- [ ] Define the core concept
- [ ] Build MVP
- [ ] Test and iterate
`
}

/** Default CLAUDE.md for spawned projects */
export function defaultClaudeMd(name: string, slug: string, template: string): string {
  return `# ${name}

## What This Project Is

${name} is a project scaffolded by App Hub using the \`${template}\` template.

## Hub Integration

This project is managed by App Hub. Key files:
- \`.apphub.md\` — Project metadata (name, status, tags). Edited by the hub; avoid manual changes to frontmatter.
- \`TASKS.md\` — Task tracking. Add tasks here or via the hub dashboard/CLI.
- \`docs/\` — Project documentation.

The hub dashboard is at \`http://localhost:5174/project/${slug}\` (while running).

## Dev API

App Hub provides mock API endpoints for prototyping:

\`\`\`
POST http://localhost:5174/api/dev/auth     — Mock login (any email/password)
GET  http://localhost:5174/api/dev/auth     — Verify token (Authorization: Bearer <token>)
GET  http://localhost:5174/api/dev/users    — List dev users
POST http://localhost:5174/api/dev/users    — Create dev user
\`\`\`

## Commands

\`\`\`bash
# Check project status
npx apphub status ${slug}

# Add a task
npx apphub task add "Task description" -p ${slug}

# List tasks
npx apphub task list -p ${slug}

# Mark a task done
npx apphub task done <task-id> -p ${slug}
\`\`\`
`
}

/** Default TASKS.md template */
export function defaultTasksMd(projectName: string): string {
  return `---
project: "${projectName}"
---

# Tasks

## Todo

- [ ] **Set up project** | priority: high | id: task-001
  Define the initial project structure and dependencies.

## In Progress

## Done

## Blocked
`
}
