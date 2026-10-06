---
title: HTTP API
section: Reference
order: 1
summary: Every endpoint of the hub server. All answer { ok, data?, error? }.
---

# HTTP API

Base URL `http://localhost:5174`. Every endpoint answers `{ "ok": boolean, "data"?: T,
"error"?: string }`. The CLI and coding agents use the same API.

## Projects

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/projects?sync=true` | list projects (`sync=true` re-scans disk first) |
| POST | `/api/projects` | create from template `{ name, template }` → `{ slug, path, warnings }` |
| POST | `/api/projects/register` | register an existing repo `{ path, name?, description? }` |
| GET / PATCH / DELETE | `/api/projects/:slug` | detail / update `.apphub.md` fields — `name`, `description`, `context`, `status`, `tags`, `repo` ([project info](../howto/project-info.md)); other keys → 400 / remove (see [register](../howto/register-project.md)) |
| GET / POST | `/api/projects/:slug/items` | the project's items by stage / create one |
| GET / POST | `/api/projects/:slug/phases` | list (with completion) / create; POST `{ reorder: [...] }` reorders |
| PATCH / DELETE | `/api/projects/:slug/phases/:id` | update / delete a phase |
| GET | `/api/projects/:slug/summary` | pre-computed summary (used for AI suggestions) |
| POST | `/api/sync` | re-index projects and board files from disk → counts |
| GET | `/api/templates` | available templates |

## Board

| Method | Path | Purpose |
| --- | --- | --- |
| GET / POST | `/api/board` | all items by stage / create (`project_slug`, `labels`, …; label `debate` starts a debate) |
| GET / PATCH / DELETE | `/api/board/:id` | item with notes, dependencies, children, attachments / update / delete |
| PATCH | `/api/board/reorder` | drag-and-drop moves `[{ id, stage, position }]` |
| GET / POST | `/api/board/:id/notes` | list / add `{ type: progress\|commit\|error\|info, message }` |
| GET / POST / DELETE | `/api/board/:id/dependencies` | list / add `{ depends_on_id, dependency_type? }` / remove `{ dependency_id \| depends_on_id }` |
| GET / POST | `/api/board/:id/attachments` | list / upload (multipart field `file`) |
| GET / DELETE | `/api/board/:id/attachments/:attachmentId` | download / delete |
| POST | `/api/board/:id/critique` | debate workflow `{ rounds? }` |
| POST | `/api/board/suggest` | AI task suggestions `{ project_slug, focus?, count? }` |
| GET | `/api/board/events` | SSE stream: `output`, `status`, `board` events |
| GET / PATCH / DELETE | `/api/items[/:id]` | flat item queries (filters: `stage`, `project`, `type`, `q`, …) |

## Runner

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/board/claude/run` | trigger: pick the next item in the claude lane |
| GET | `/api/board/claude/status` | state, current item, elapsed, recent run history |
| GET | `/api/board/claude/output?since=<seq>` | incremental output lines |
| GET | `/api/board/claude` | unclaimed items in the claude lane |
| POST | `/api/board/claude/claim` | claim `{ id, agent_id? }` (for external agents) |
| POST | `/api/board/claude/complete` | mark done `{ id }` |
| GET | `/api/branches` | branch reviews |
| GET / DELETE | `/api/branches/:branch` | commits + diff / discard |
| POST | `/api/branches/:branch/merge` | merge into the base branch, item → done |

## Agents

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/agents` | registered agents + provider reachability |
| POST | `/api/agents/:slug/run` | run one agent `{ prompt }` |

## System

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | status, uptime, db, runner state, pid, node version |
| GET / DELETE | `/api/logs` | activity log (filters: level, category, issue, project, search) / clear |
| GET / PATCH | `/api/settings` | persistent UI settings (theme, …) |
| GET | `/api/architecture` | graph data for the Architecture page |
| GET | `/api/docs`, `/api/docs/<path>` | these docs: index / one article as markdown + HTML |

## Dev API (for spawned projects)

Mock auth so prototypes need no auth setup. CORS reflects the request origin, so apps on any port can call it.

| Method | Path | Purpose |
| --- | --- | --- |
| POST / GET / DELETE | `/api/dev/auth` | login `{ email, password }` → JWT + refresh token / verify Bearer token / logout |
| POST | `/api/dev/auth/refresh` | new access token from a refresh token |
| GET | `/api/dev/auth/config` | auth configuration for clients |
| GET / POST / DELETE | `/api/dev/auth/keys` | API keys of a dev user |
| GET / POST | `/api/dev/users` | list / create dev users |
| PATCH / DELETE | `/api/dev/users/:id` | update / delete |

Login needs an existing dev user (a `creator@apphub.local` account is seeded). Users without
a password hash accept any password. Tokens are JWTs signed with a secret stored in the local
database — dev only, never production auth.
