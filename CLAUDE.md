# App Hub — Claude Code Instructions

## What This Project Is

App Hub is a local-first project management and scaffolding system for rapidly iterating on app ideas. It's a personal developer tool — not a SaaS product. The user (crisin) is a software developer and designer running macOS 15.6.1 on an i7 MacBook.

The goal: go from "I have an idea" to "I have a running project with structure, docs, and task tracking" in minutes. All projects spawned by App Hub are primarily coded with AI (Claude Code).

## Project Vision & Principles

- **Local-first**: Everything runs locally. No cloud dependencies, no accounts, no external services.
- **Hybrid state**: Markdown files in each project are the source of truth. SQLite indexes them for fast queries and analytics.
- **Open source / self-developed only**: No proprietary dependencies.
- **CLI + Web UI**: Both interfaces for managing projects. CLI for speed, web for visualization.
- **Dev API for spawned projects**: The hub provides mock auth and test endpoints so new projects don't need their own auth setup during prototyping.
- **Template-based scaffolding**: New projects are created from git repo templates (local directories for now, remote repos later).

## Tech Stack

- **SvelteKit 2 + Svelte 5** — hub web app (dashboard + API server)
- **better-sqlite3** — SQLite database for indexing
- **TypeScript + Commander.js** — CLI tool
- **npm workspaces** — monorepo management
- **gray-matter** — markdown frontmatter parsing
- **degit** — git repo cloning for remote templates (future)

## Monorepo Structure

```
App Hub/                          ← project root (npm workspace root)
├── CLAUDE.md                     ← this file
├── ARCHITECTURE.md               ← detailed architecture documentation
├── apphub.config.ts              ← global configuration
├── package.json                  ← npm workspace root config
├── packages/
│   ├── hub/                      ← @apphub/hub — SvelteKit web dashboard + API
│   │   ├── src/
│   │   │   ├── app.css           ← global styles (dark theme, CSS custom properties)
│   │   │   ├── routes/
│   │   │   │   ├── +layout.svelte         ← sidebar nav layout
│   │   │   │   ├── +layout.server.ts      ← root layout loader (settings/theme)
│   │   │   │   ├── +page.svelte           ← dashboard (project grid)
│   │   │   │   ├── +page.server.ts        ← dashboard data loader (syncs projects)
│   │   │   │   ├── project/[slug]/        ← project detail page (tasks, status)
│   │   │   │   ├── settings/              ← settings pages (interface, extensible)
│   │   │   │   └── api/
│   │   │   │       ├── projects/          ← GET (list), POST (create)
│   │   │   │       ├── projects/[slug]/   ← GET (detail), PATCH (update)
│   │   │   │       ├── projects/[slug]/tasks/ ← GET, POST, PATCH
│   │   │   │       ├── settings/          ← GET, PATCH (persistent settings)
│   │   │   │       ├── sync/             ← POST (re-index from disk)
│   │   │   │       ├── templates/        ← GET (list templates)
│   │   │   │       └── dev/
│   │   │   │           ├── auth/         ← POST (login), GET (verify token)
│   │   │   │           └── users/        ← GET (list), POST (create)
│   │   │   └── lib/server/
│   │   │       ├── db.ts                 ← SQLite connection, migrations, seeding
│   │   │       ├── parser.ts             ← .apphub.md + TASKS.md parsers
│   │   │       ├── scanner.ts            ← filesystem scanner, SQLite sync
│   │   │       ├── settings.ts          ← persistent settings CRUD (SQLite-backed)
│   │   │       └── templates.ts          ← template listing, project creation
│   │   └── data/                         ← SQLite database + attachments (gitignored)
│   ├── cli/                      ← @apphub/cli — command-line interface
│   │   └── src/
│   │       ├── index.ts                  ← CLI entry point (commander)
│   │       ├── lib/api.ts                ← HTTP client for hub API
│   │       └── commands/
│   │           ├── new.ts                ← create project from template
│   │           ├── list.ts               ← list projects (with status filter)
│   │           ├── status.ts             ← get/set project status
│   │           ├── task.ts               ← add/list/done tasks
│   │           └── sync.ts              ← re-index from disk
│   └── shared/                   ← @apphub/shared — types, schemas, constants
│       └── src/
│           ├── types.ts                  ← ProjectMeta, Task, Template, DevUser, etc.
│           ├── schemas.ts                ← validation values, default markdown generators
│           └── constants.ts              ← file names, ports, paths
├── templates/                    ← project templates
│   ├── expo-app/                 ← Expo + React Native (mobile)
│   ├── nextjs-fullstack/         ← Next.js App Router (full-stack web)
│   └── sveltekit-web/            ← SvelteKit (web app)
└── projects/                     ← spawned projects live here
```

## Key Data Formats

### .apphub.md (per-project metadata)

```yaml
---
name: "My App"
slug: "my-app"
description: "A cool app idea"
status: idea          # idea | active | paused | completed | archived
template: "expo-app"
tags: [mobile, local-first]
created: "2026-04-05T..."
updated: "2026-04-05T..."
---
# My App
> Project description and notes in markdown body
```

### TASKS.md (per-project task list)

```markdown
---
project: 'My App'
---

# Tasks

## Todo

- [ ] **Task title** | priority: high | id: task-001
      Optional description on next line.

## In Progress

## Done

- [x] **Completed task** | priority: low | id: task-002

## Blocked
```

### template.json (per-template config)

```json
{
  "name": "Expo App",
  "description": "Local-first mobile app with Expo",
  "tags": ["mobile", "expo"],
  "postCreate": "npm install"
}
```

## Commands

```bash
# Development
npm install                                  # install all workspace deps
npm run build --workspace=@apphub/shared     # build shared types (do this first)
npm run dev                                  # start hub dev server (localhost:5174)

# Production
npm run build                                # build all packages (shared → hub → cli)
npm run start                                # start production server (node build)

# Service (macOS launchd)
./scripts/install-service.sh                 # install as login item, starts on boot
./scripts/uninstall-service.sh               # remove the service

# Health check
curl -s http://localhost:5174/api/health | jq

# CLI (hub must be running)
npm run cli -- new "My App" --template expo-app
npm run cli -- list
npm run cli -- list --status active
npm run cli -- status my-app
npm run cli -- status my-app --set active
npm run cli -- task add "Build login" -p my-app
npm run cli -- task list -p my-app
npm run cli -- task done task-123 -p my-app
npm run cli -- sync
```

## API Endpoints

All endpoints return `{ ok: boolean, data?: T, error?: string }`.

| Method | Path                                | Description                                      |
| ------ | ----------------------------------- | ------------------------------------------------ |
| GET    | `/api/health`                       | Health check (uptime, db, runner, pid)           |
| GET    | `/api/projects?sync=true`           | List projects (sync=true re-scans disk)          |
| POST   | `/api/projects`                     | Create project `{ name, template }`              |
| GET    | `/api/projects/:slug`               | Get project detail                               |
| PATCH  | `/api/projects/:slug`               | Update project metadata                          |
| GET    | `/api/projects/:slug/tasks`         | List tasks                                       |
| POST   | `/api/projects/:slug/tasks`         | Add task `{ title, priority? }`                  |
| PATCH  | `/api/projects/:slug/tasks`         | Update task `{ id, status?, title?, priority? }` |
| GET    | `/api/settings`                     | Get all settings                                 |
| PATCH  | `/api/settings`                     | Update settings `{ key: value, ... }`            |
| POST   | `/api/sync`                         | Re-index all projects from disk                  |
| GET    | `/api/templates`                    | List available templates                         |
| POST   | `/api/dev/auth`                     | Mock login `{ email, password }` → token         |
| GET    | `/api/dev/auth`                     | Verify token (Authorization: Bearer ...)         |
| GET    | `/api/dev/users`                    | List dev users                                   |
| POST   | `/api/dev/users`                    | Create dev user `{ email, name, role? }`         |
| GET    | `/api/board/:id/attachments`        | List issue attachments                           |
| POST   | `/api/board/:id/attachments`        | Upload attachment (multipart form, `file` field) |
| GET    | `/api/board/:id/attachments/:attId` | Download/serve attachment                        |
| DELETE | `/api/board/:id/attachments/:attId` | Delete attachment                                |

## Current State (v0.1.0 → v0.2.0 in progress)

What's built and working:

- Full monorepo structure with npm workspaces
- Shared types package (@apphub/shared) — builds successfully
- SvelteKit hub with dark-themed dashboard UI (project grid, project detail page with task management)
- Kanban board with 6-stage pipeline (idea → plan → build → claude → review → done)
- Claude runner — spawns Claude CLI to autonomously work on board items
- Git worktree isolation per task (no direct-write fallback — errors on failure)
- SSE real-time updates (output streaming, status changes, board mutations)
- Persistent per-task output logging to `logs/runs/`
- All API routes (projects CRUD, tasks CRUD, sync, templates, dev auth, board, health)
- SQLite database layer with auto-migration
- Markdown parsers for .apphub.md and TASKS.md
- Filesystem scanner with SQLite sync
- Template engine (local copy + git init + post-create hooks)
- CLI with all core commands (new, list, status, task, sync)
- 3 starter templates (Expo, Next.js, SvelteKit)
- Dev auth API with in-memory token store and auto-user creation
- **Production build** via `@sveltejs/adapter-node` (`npm run build` → `npm run start`)
- **macOS Launch Agent** scripts for running as a persistent service
- **Health endpoint** (`GET /api/health`)
- **Environment-based configuration** via `apphub.config.ts` with `APPHUB_*` env var overrides

## What Needs Work Next

See `ARCHITECTURE-V2.md` for the full roadmap. Current priorities:

### v2 Phase 2A: Runner Concurrency
- Task queue with configurable concurrency (`APPHUB_MAX_CONCURRENT`)
- Task lifecycle states (claimed → running → completed/failed/cancelled)
- SSE multiplexing for parallel task output
- Dashboard updates for multi-task display

### v2 Phase 2B: Direct Anthropic API (optional)
- Tool execution layer (read, write, edit, bash, grep, glob)
- Multi-turn conversation loop with streaming
- Token/cost tracking per task
- Runner mode toggle (`APPHUB_RUNNER_MODE=cli|api`)

### v2 Phase 3: Self-Modification
- Hub self-registration as project `apphub`
- Safety gates (feature flag, cooldown, max-in-flight, depth limit)
- Validation pipeline (typecheck → build → smoke test)
- Human review gate (no auto-merge)
- Graceful restart after merge

### Other improvements
- Templates page in hub UI
- CLAUDE.md generation for spawned projects
- File watcher for auto-sync

## Architecture Decisions & Rationale

- **SvelteKit over Tauri**: Faster iteration speed, easier for AI to modify, can wrap in Tauri later if native feel is wanted. SvelteKit's server routes double as the API.
- **TypeScript CLI over Go**: Same language as the hub means shared types and parsers. No need for cross-compilation when it's a personal tool on one machine.
- **Markdown as source of truth**: Each project stays portable and git-friendly. SQLite is just an index — delete the DB and re-sync from markdown.
- **npm workspaces over pnpm**: pnpm had filesystem permission issues on the mounted workspace. npm workspaces work identically for this use case.
- **In-memory dev auth tokens**: Tokens reset when hub restarts. This is intentional — it's for local dev testing, not production auth.

## Coding Guidelines

- Use Svelte 5 runes syntax (`$state`, `$props`, `$derived`) — not Svelte 4 stores
- Server-side code in `$lib/server/` (SvelteKit convention)
- All API responses wrapped in `{ ok, data, error }` format
- CSS uses custom properties defined in `app.css` — maintain the dark theme
- Keep the CLI client thin — all logic lives in the hub API, CLI just calls it
- When adding new features, update both the web UI and CLI where applicable
- Always rebuild shared package after changing types: `npm run build --workspace=@apphub/shared`
