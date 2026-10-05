# App Hub — Claude Code Instructions

## What This Project Is

App Hub is a local-first project management and scaffolding system for rapidly iterating on app
ideas. It's a personal developer tool — not a SaaS product. The user (crisin) is a software
developer and designer working on two machines: a Windows 11 PC and a MacBook Pro (M5 Max). The
hub must stay cross-platform. Their current app focus is Tauri apps for Windows + macOS.

The goal: go from "I have an idea" to "I have a running project with structure, docs, and task
tracking" in minutes — and then let coding agents work through the project's board while the
user reviews. All projects spawned by App Hub are primarily coded with AI (Claude Code, plus
local models via Ollama). Direction: agents and workflows as data, pluggable model backends, the
board as the execution loop, and **visualization** (2D graphs and navigable 3D networks) as a
first-class way to understand projects. See `docs/roadmap.md`.

Full documentation lives in `docs/` (also rendered in the app's help panel; `README.md` is the
front door with the quickstart). Start with `docs/start/overview.md`, `docs/start/features.md`
and `docs/concepts/architecture.md`.

## Principles

- **Local-first**: everything runs locally. No cloud dependencies, no accounts.
- **Markdown is the source of truth, SQLite only an index**: `.apphub.md` (project metadata),
  `.apphub/items/*.md` + `.apphub/phases.md` (the board), `agents/*.md`, `docs/`. Deleting the
  DB and syncing must rebuild everything that matters. Machine-local runtime state (runner
  claims, branch reviews, activity log, dev users, attachments) is SQLite-only by design.
- **Cross-platform**: Windows is a first-class target. No bash/PowerShell-only scripts — Node
  scripts. No platform paths outside `exec-utils.ts` / `config.ts`.
- **Open source / self-developed only**: no proprietary dependencies.
- **CLI + Web UI**: CLI for speed, web for visualization. The CLI is a thin API client.
- **Nothing an agent writes reaches a branch unreviewed**: worktree per task, review lane, no
  direct writes, no auto-merge.

## Tech Stack

SvelteKit 2 + Svelte 5 (hub UI + API), better-sqlite3 (index), TypeScript + Commander (CLI),
npm workspaces, gray-matter (frontmatter), marked (docs rendering), Cytoscape + 3d-force-graph
(architecture graph), Ollama / OpenAI-compatible servers + @anthropic-ai/sdk (agents), Claude
Code CLI + aider (coder backends).

## Monorepo Structure

```
App-Hub/
├── CLAUDE.md                     ← this file
├── .apphub.md, .apphub/          ← the hub as project "hub" (dogfooding): metadata + its own board
├── .gitattributes, .gitmessage   ← LF policy; logbook commit template
├── README.md                     ← front door: quickstart + map of the wiki
├── docs/                         ← documentation = in-app help (start/ howto/ concepts/ reference/ essays/ roadmap.md history/)
├── agents/                       ← agent definitions (critic, advocate, judge, summarizer, ui-drafter)
├── templates/                    ← tauri-app, sveltekit-web, nextjs-fullstack, expo-app, kmp-app
├── scripts/                      ← start.mjs (production entry), logbook.mjs, docs-check.mjs, autostart-windows.mjs, install/uninstall-service.sh (macOS)
├── projects/                     ← scaffolded projects, each its own repo (gitignored)
├── logs/                         ← runs/ and agents/ output (gitignored)
├── apphub.local.json             ← machine-local: registered external project paths (gitignored)
└── packages/
    ├── shared/                   ← @apphub/shared: types, constants, generators (.apphub.md, CLAUDE.md section)
    ├── cli/                      ← @apphub/cli: new, register, list, status, sync, board, task, agent
    └── hub/                      ← @apphub/hub: SvelteKit app
        └── src/
            ├── hooks.server.ts   ← startup: stale-claim cleanup, project + board sync
            ├── routes/           ← pages (dashboard, board, project, reviews, agents, templates, logs,
            │                       architecture, settings) + api/ (see docs/reference/api.md)
            └── lib/
                ├── components/   ← HelpPanel, PhaseTimeline, SuggestPanel, architecture/ graphs
                └── server/
                    ├── config.ts          ← ALL paths + env overrides; never use process.cwd()
                    ├── scanner.ts         ← project discovery/registry, resolveProjectScope()
                    ├── board-files.ts     ← board ⇄ markdown: write-through, importBoards()
                    ├── data.ts            ← data access: items, notes, deps, phases (every board write)
                    ├── db.ts              ← SQLite connection + migrations
                    ├── claude-runner.ts   ← runner: claim → worktree → backend → review lane
                    ├── coder-backends.ts  ← claude / aider spawn plans
                    ├── git-worktree.ts    ← worktrees, workspace links, cargo env, merge
                    ├── exec-utils.ts      ← cross-platform binary discovery + PATH
                    ├── agents.ts, providers/, debate.ts  ← agent layer
                    ├── templates.ts       ← scaffolding
                    ├── docs.ts            ← docs/ index + rendering for the help panel
                    └── architecture.ts, logger.ts, settings.ts, auth.ts, project-summary.ts, …
```

## Key Data Formats

`.apphub.md` — project marker + metadata. `context` goes into every coding-agent prompt.

```yaml
---
name: "My App"
slug: "my-app"
description: "One line"
status: idea          # idea | active | paused | completed | archived
template: "tauri-app"
tags: [desktop]
context: |
  Short summary for coding agents: layers, modules, commands.
---
```

`.apphub/items/<id>.md` — one board item: frontmatter `id, title, project, stage, priority,
type, labels, position, parent, phase, blocked_by, relates_to, created, updated`; body =
description; notes after `<!-- apphub:notes -->`. Full spec: `docs/concepts/board-files.md`.

`templates/<name>/template.json` — `{ name, description, tags, postCreate: string | string[] }`;
`__APP_NAME__` / `__APP_SLUG__` placeholders are filled on scaffold.

## Commands

```bash
npm install                                   # all workspaces
npm run build --workspace=@apphub/shared      # shared types — first, and after every change to them
npm run dev                                   # hub dev server (localhost:5174)
npm run build && npm run start                # production (scripts/start.mjs → 127.0.0.1:5174)
npm run logbook                               # recent commits with bodies (the logbook)
npm run docs:check                            # wiki frontmatter + links (run after touching docs/)
npx tsc --noEmit --noUnusedLocals -p packages/hub/tsconfig.json   # must stay clean
npm run check                                 # eslint + svelte-check (known pre-existing errors in architecture/)

npm run cli -- new "My App" --template tauri-app
npm run cli -- register <path>                # existing repo anywhere on disk
npm run cli -- sync                           # re-index projects + board files (after git pull)
npm run cli -- board list | add "Title" -p <slug> | move <id> claude | claude run
npm run cli -- agent list | run <slug> "…" | critique <item-id> -r 2
```

The full API is in `docs/reference/api.md`; every endpoint answers `{ ok, data?, error? }`.

## Current State (v0.2 foundations, 2026-10-02)

Working: dashboard, project pages, 6-lane board with dependencies and phases, board as markdown
files with write-through + sync, runner with worktree isolation (Claude Code default, aider via
label), review lane with logbook merge commits, SSE live output, agent layer (Ollama /
OpenAI-compatible / Anthropic) with debate workflow (label `debate`), project registry for repos
outside `projects/`, five templates incl. `tauri-app`, help panel (`?` / F1) rendering `docs/`,
architecture graph (2D + 3D), dogfooding (the hub's roadmap is on its own board), autostart
(macOS launchd service, Windows Task Scheduler script).

Next: visualization pillar, then the node planner (DAG of items executed sequentially and in
parallel worktrees), runner concurrency, agent Baukasten (workflows as data, stage hooks, cron,
MCP server). Details and order: `docs/roadmap.md`.

Gotchas: `npm run dev` caches the runner module graph — restart after changing
`claude-runner.ts` / `coder-backends.ts`. Local inference must be streamed (undici's 5-min
headers timeout). After merging hub changes, restart the server.

## Coding Guidelines

- Svelte 5 runes (`$state`, `$props`, `$derived`) — no Svelte 4 stores. Check whether a
  component's `<script>` is `lang="ts"` before writing type annotations (the root layout is JS).
- Server code in `$lib/server/`. Paths only from `config.ts`. Board writes only through
  `data.ts` (it writes the files); raw SQL on `items` elsewhere must call `persistItem()`.
- All API responses `{ ok, data, error }`. Routes stay thin.
- CSS uses the custom properties in `app.css` — keep the dark theme working.
- Keep the CLI thin; update UI and CLI together where it applies.
- New user-facing behavior → update the matching page in `docs/` (it is the in-app help);
  `docs/howto/write-docs.md` has the frontmatter and link rules, `npm run docs:check` verifies them.
- Rebuild shared after type changes: `npm run build --workspace=@apphub/shared`.

## Git & Logbook

The git history is this project's logbook. Rule since 2026-10-01: **every change lands as a
commit with a detailed message** — someone who reads only `git log` must be able to follow what
happened, why, and how it was checked.

```
<type>(<scope>): <what changed — imperative, max 72 chars>

Why:       the problem or motivation — what was wrong or missing, how it showed up
What:      the change itself, key decisions, rejected alternatives
Verified:  how it was checked (typecheck, build, API call, e2e board run) —
           or "not verified" plus the reason
Follow-up: open ends, known limitations, next steps (omit if none)
```

- Types: `feat` `fix` `refactor` `docs` `chore` `test` `perf` `build` `ci`. Scopes: `hub` `cli`
  `shared` `runner` `board` `agents` `templates` `git` `docs`, or a module name.
  This replaces the old catch-all `vibe:` prefix.
- One logical change per commit — no "wip" or "misc" commits.
- Read the logbook: `npm run logbook` (last 15 entries with bodies; `npm run logbook -- -n 50`,
  `-- --since=2026-10-01` or `-- <path>` to narrow it down).
- `git config commit.template .gitmessage` puts the skeleton into the editor.
- Board-runner commits follow the same format — the runner prompt tells the coding agent so.
  Aider writes its own commit messages; review them in the review lane.
- Commit `.apphub/` (board files) together with the work it belongs to.
- Never rewrite pushed history (no force-push, no amending pushed commits).
