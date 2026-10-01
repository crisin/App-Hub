---
title: Architecture
section: Concepts
order: 1
summary: Packages, server modules, data flow — and why it is built this way.
routes: ['/architecture']
---

# Architecture

## Packages

```
App-Hub/                      npm workspaces
├── packages/shared           types, constants, generators (.apphub.md, CLAUDE.md) — build first
├── packages/hub              SvelteKit 2 + Svelte 5: dashboard UI + JSON API + runner + agents
├── packages/cli              Commander CLI — a thin client of the hub API, no logic of its own
├── agents/                   agent definitions (markdown)
├── templates/                project templates
├── docs/                     these docs — also the in-app help panel
├── .apphub.md, .apphub/      the hub's own project metadata and board (dogfooding)
└── scripts/                  start.mjs (production entry), logbook.mjs, macOS service
```

## Server modules (`packages/hub/src/lib/server/`)

| Module | Job |
| --- | --- |
| `config.ts` | the only place that knows paths: finds the hub root, applies `APPHUB_*` overrides |
| `scanner.ts` | discovers projects (hub, `projects/`, registered paths), resolves a scope to a repo |
| `board-files.ts` | board items/phases ⇄ markdown files; import on sync, write-through on change |
| `data.ts` | data access for items, notes, dependencies, phases — every board write goes here |
| `db.ts` | SQLite connection + migrations (the index) |
| `claude-runner.ts` | the runner: claim → worktree → coder backend → review lane |
| `coder-backends.ts` | Claude Code / aider spawn plans |
| `git-worktree.ts` | worktrees, workspace links, cargo cache env, merge |
| `exec-utils.ts` | cross-platform binary discovery + PATH |
| `agents.ts`, `providers/` | agent registry and LLM backends |
| `debate.ts` | critic/advocate/judge workflow |
| `templates.ts` | scaffolding |
| `architecture.ts` | builds the graph shown on the Architecture page |
| `logger.ts` | structured activity log (Logs page) |

Routes under `src/routes/api/` are thin: validate, call a module, answer
`{ ok, data?, error? }`.

## Data flow

```
 UI / CLI / agent ──► API route ──► data.ts ──► SQLite (index)
                                       │
                                       └──► board-files.ts ──► <repo>/.apphub/items/<id>.md
 git pull / hand edit ──► Sync ──► importBoards() ──► SQLite
```

Writes go to the index **and** the file in the same call. Reads come from the index.
Sync loads files back (newer wins per item). Runtime-only state — who is running what,
review branches, logs — exists only in SQLite.

## Decisions and why

- **Markdown as source of truth, SQLite as index** — projects stay portable and git-friendly,
  two machines share a board through git, agents can read their work items as files.
- **SvelteKit, not Tauri, for the hub** — fastest to iterate, easiest for AI to modify; server
  routes double as the API.
- **TypeScript CLI** — same language as the hub, shared types.
- **npm workspaces** — pnpm had permission problems on a mounted workspace.
- **Agents as markdown** — new role = new file; versionable, editable anywhere.
- **One OpenAI-compatible adapter for all local backends** — Ollama, LM Studio, llama.cpp
  and vLLM all speak `/v1/chat/completions`. Claude goes through the official SDK.
- **Coder backends spawn CLIs** — Claude Code and aider already have tool loops; the hub owns
  the pipeline (claim → worktree → commits → review), not a tool-execution layer.
- **`127.0.0.1` over `localhost`** for local inference — avoids IPv6/IPv4 flakiness in Node's
  fetch.
- **Paths from `config.ts`, never `process.cwd()`** — the server runs from `vite dev` in
  `packages/hub`, from the repo root, or as a service.
- **Production binds `127.0.0.1`** — the hub spawns agents with shell access; it must not be
  reachable from the LAN by default.

The Architecture page renders this codebase as an interactive graph (2D and 3D). It is the
seed of the visualization pillar on the [roadmap](../roadmap.md).
