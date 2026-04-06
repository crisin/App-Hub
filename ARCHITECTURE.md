# App Hub — Architecture

## Overview

App Hub is a local-first project management and scaffolding system for rapidly iterating on app ideas. It combines a web dashboard, CLI, and dev API into one monorepo.

## Directory Structure

```
App Hub/
├── packages/
│   ├── hub/                  ← SvelteKit web app (dashboard + API)
│   │   ├── src/
│   │   │   ├── routes/       ← Pages and API endpoints
│   │   │   │   ├── api/
│   │   │   │   │   ├── projects/       CRUD for projects
│   │   │   │   │   ├── tasks/          Task management
│   │   │   │   │   ├── sync/           Re-index from markdown
│   │   │   │   │   ├── templates/      List available templates
│   │   │   │   │   └── dev/            Dev API for spawned projects
│   │   │   │   │       ├── auth/       Mock auth (login, token verify)
│   │   │   │   │       └── users/      Dev user management
│   │   │   │   ├── project/[slug]/     Project detail page
│   │   │   │   └── +page.svelte        Dashboard
│   │   │   └── lib/
│   │   │       └── server/             Server-only modules
│   │   │           ├── db.ts           SQLite connection + migrations
│   │   │           ├── parser.ts       .apphub.md and TASKS.md parsers
│   │   │           ├── scanner.ts      Project directory scanner + sync
│   │   │           └── templates.ts    Template engine (clone, scaffold)
│   │   └── data/                       SQLite database lives here
│   ├── cli/                  ← TypeScript CLI
│   │   └── src/
│   │       ├── index.ts                Entry point (commander)
│   │       ├── lib/api.ts              HTTP client for hub API
│   │       └── commands/               CLI commands
│   │           ├── new.ts              Create project from template
│   │           ├── list.ts             List all projects
│   │           ├── status.ts           Get/set project status
│   │           ├── task.ts             Add/list/complete tasks
│   │           └── sync.ts             Sync projects to database
│   └── shared/               ← Shared types and utilities
│       └── src/
│           ├── types.ts                Core type definitions
│           ├── schemas.ts              Validation + default templates
│           └── constants.ts            File names, ports, paths
├── templates/                ← Project templates
│   ├── expo-app/             Local-first mobile (Expo + React Native)
│   ├── nextjs-fullstack/     Full-stack web (Next.js App Router)
│   └── sveltekit-web/        Web app (SvelteKit)
├── projects/                 ← Spawned projects live here
├── apphub.config.ts          Global configuration
└── package.json              npm workspace root
```

## Data Flow

### Hybrid State Model

1. **Source of truth**: Markdown files inside each project
   - `.apphub.md` — project metadata (name, status, tags, dates)
   - `TASKS.md` — task list with priorities and statuses
2. **Index**: SQLite database (`packages/hub/data/apphub.db`)
   - Populated by scanning the `projects/` directory
   - Enables fast queries, filtering, analytics
   - Sync triggered manually or on dashboard load

### Sync Process

```
projects/ directory
    ↓ scanner reads .apphub.md + TASKS.md
    ↓ parser extracts frontmatter + task lines
    ↓ upsert into SQLite
Dashboard / CLI reads from SQLite
    ↓ writes go back to markdown files AND SQLite
```

## API Endpoints

### Project Management

- `GET  /api/projects` — list projects (add `?sync=true` to re-scan)
- `POST /api/projects` — create project `{ name, template }`
- `GET  /api/projects/:slug` — get single project
- `PATCH /api/projects/:slug` — update metadata

### Tasks

- `GET  /api/projects/:slug/tasks` — list tasks
- `POST /api/projects/:slug/tasks` — add task
- `PATCH /api/projects/:slug/tasks` — update task (needs `id` in body)

### System

- `POST /api/sync` — re-scan all projects
- `GET  /api/templates` — list available templates

### Dev API (for spawned projects)

- `POST /api/dev/auth` — mock login (auto-creates users)
- `GET  /api/dev/auth` — verify Bearer token
- `GET  /api/dev/users` — list dev users
- `POST /api/dev/users` — create dev user

## CLI Commands

```bash
apphub new "My App" --template expo-app     # Create project
apphub list                                  # List all projects
apphub list --status active                  # Filter by status
apphub status my-app                         # View project details
apphub status my-app --set active            # Change status
apphub task add "Build login" -p my-app      # Add task
apphub task list -p my-app                   # List tasks
apphub task done task-123 -p my-app          # Complete task
apphub sync                                  # Re-index from disk
```

## Tech Stack

- **Frontend**: SvelteKit 2 + Svelte 5
- **Database**: SQLite via better-sqlite3
- **CLI**: TypeScript + Commander.js
- **Monorepo**: npm workspaces
- **Templates**: Local directories with `template.json` config

## Getting Started

```bash
# Install dependencies
npm install

# Build shared types
npm run build --workspace=@apphub/shared

# Start the hub dev server
npm run dev

# Use the CLI (while hub is running)
npm run cli -- list
npm run cli -- new "My App" --template expo-app
```

## Template Format

Each template is a directory in `templates/` containing:

- `template.json` — metadata (name, description, tags, postCreate hook)
- The actual project files to be copied

When a project is created, App Hub:

1. Copies the template to `projects/<slug>/`
2. Creates `.apphub.md` with project metadata
3. Creates `TASKS.md` with initial task structure
4. Creates `docs/` directory
5. Initializes a git repo
6. Runs the `postCreate` hook if defined
