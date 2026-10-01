import type { ProjectStatus, ItemPriority, ItemStage, DependencyType } from './types.js'

/** Valid project statuses */
export const PROJECT_STATUSES: ProjectStatus[] = [
  'idea',
  'active',
  'paused',
  'completed',
  'archived',
]

/** Valid item priorities */
export const ITEM_PRIORITIES: ItemPriority[] = ['low', 'medium', 'high', 'critical']

/** Item stages — the unified flow pipeline (including claude execution stage) */
export const ITEM_STAGES: ItemStage[] = ['idea', 'plan', 'build', 'claude', 'review', 'done']

/** Human-readable stage labels */
export const ITEM_STAGE_LABELS: Record<ItemStage, string> = {
  idea: 'Idea',
  plan: 'Plan',
  build: 'Build',
  claude: 'Claude',
  review: 'Review',
  done: 'Done',
}

/** Dependency types */
export const DEPENDENCY_TYPES: DependencyType[] = ['blocks', 'relates_to']

/** Default phases seeded when creating a new project */
export const DEFAULT_PHASES = ['Planning', 'Build', 'Test', 'Ship']

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
# Short summary for coding agents — added to every board-task prompt
context: ""
---

# ${name}

> Describe your project idea here.

## Goals

- [ ] Define the core concept
- [ ] Build MVP
- [ ] Test and iterate
`
}

/**
 * App Hub section of a spawned project's CLAUDE.md. Appended to a template's
 * own CLAUDE.md, or wrapped by defaultClaudeMd() when the template has none.
 */
export function hubClaudeSection(slug: string): string {
  return `## App Hub

This repo is managed by App Hub (dashboard: http://localhost:5174/project/${slug}).

- \`.apphub.md\` — project metadata. Its \`context\` field is added to every coding-agent
  prompt: keep it a short, current summary of layers, modules and commands.
- Work items live on the hub board. Coding tasks run in git worktrees under \`.worktrees/\`
  (excluded locally) and come back through the hub's review lane — never push or merge
  from a task.
- Dev API for prototyping without an own auth setup: \`POST http://localhost:5174/api/dev/auth\`
  (login as a dev user), \`GET /api/dev/auth\` (verify a Bearer token), \`/api/dev/users\`.

## Git & Logbook

The git history is this project's logbook. Every change is a commit with a detailed message:

\`\`\`
<type>(<scope>): <what changed — imperative, max 72 chars>

Why:       the problem or motivation
What:      the change, key decisions, rejected alternatives
Verified:  how it was checked — or "not verified" plus the reason
Follow-up: open ends (omit if none)
\`\`\`

Types: feat fix refactor docs chore test perf build ci. One logical change per commit.
`
}

/** Default CLAUDE.md for spawned projects whose template ships none */
export function defaultClaudeMd(name: string, slug: string, template: string): string {
  return `# ${name}

${name} was scaffolded by App Hub from the \`${template}\` template.

${hubClaudeSection(slug)}`
}

/** Fallback .gitignore for templates that ship none — keeps installs/builds out of commit 1 */
export const DEFAULT_GITIGNORE = `node_modules/
dist/
build/
.svelte-kit/
target/
.env
.env.*
!.env.example
.DS_Store
Thumbs.db
`

/** Line-ending policy for new repos — LF everywhere from commit 1 (Windows + macOS) */
export const DEFAULT_GITATTRIBUTES = `* text=auto eol=lf
*.bat text eol=crlf
*.cmd text eol=crlf
*.ps1 text eol=crlf
`
