---
title: Development setup
section: How-to
order: 0
summary: Tooling, the dev loop, the checks that must stay green, and how to add a page, route, module, CLI command, template or agent.
---

# Development setup

For working **on** the hub. For using it, start with the [quickstart](../start/quickstart.md).

## Tooling

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 20, developed on 22 | `engines` in the root `package.json`; `npm run dev` and `start.mjs` both run on it |
| npm | ≥ 10 | workspaces; pnpm is not used (permission problems on a mounted workspace) |
| git | ≥ 2.30 | worktrees, `git log` as logbook |
| Claude Code CLI | current | the runner's default backend and the suggest panel; also the main way the hub gets written |
| Ollama | current | agents on local models; the aider backend; see `agents/*.md` for the model defaults |
| aider | current | `pipx install aider-chat`; found on `PATH`, `~/.local/bin`, scoop shims |
| Rust + Tauri prerequisites | stable | only to build projects from `tauri-app`; the hub itself has no Rust |

Windows: Git for Windows, Node from the installer or a version manager, no WSL required. The
repo pins LF line endings in `.gitattributes`, so `core.autocrlf` does not matter. macOS: Xcode
command line tools. Both machines can share one checkout through git, see
[two machines](two-machines.md).

Native module: `better-sqlite3` is the only compiled dependency. npm downloads a prebuilt
binary for Node LTS versions. After switching Node major versions run
`npm rebuild better-sqlite3`.

## First time

```bash
git clone https://github.com/crisin/App-Hub.git
cd App-Hub
npm install
npm run build --workspace=@apphub/shared
cp packages/hub/.env.example packages/hub/.env     # optional, every value has a default
git config commit.template .gitmessage             # logbook skeleton in the editor
```

## The dev loop

```bash
npm run dev                      # vite dev, localhost:5174, HMR for UI and most server code
```

Things HMR does **not** cover, restart the server after changing them:

- `claude-runner.ts` and `coder-backends.ts` (vite caches the runner module graph; a run would
  use stale code),
- `hooks.server.ts` startup logic,
- anything in `packages/shared` (rebuild it first: `npm run build --workspace=@apphub/shared`),
- the hub's own code after merging a review-lane branch for project `hub`.

The CLI in development runs through tsx without a build:

```bash
npm run dev --workspace=@apphub/cli -- board list
```

The production path is what the services run:

```bash
npm run build          # shared, then hub (adapter-node into packages/hub/build), then cli
npm run start          # scripts/start.mjs: 127.0.0.1:5174, NODE_ENV=production
```

Claude Code's browser preview uses `.claude/launch.json`: configuration `hub` runs
`npm run dev` on port 5174.

## Checks that must stay green

```bash
npx tsc --noEmit --noUnusedLocals -p packages/hub/tsconfig.json   # strict typecheck of the hub
npm run lint                                                      # eslint (ts + svelte)
npm run check                                                     # lint + svelte-check (known old errors in components/architecture/)
npm run format:check                                              # prettier
npm run docs:check                                                # wiki frontmatter + links
```

There is no automated test suite yet. Verification is the `Verified:` line of each commit:
typecheck, build, an API call, or an end-to-end run over the board. Say so honestly if a change
was not verified.

## Map for developers

Read [architecture](../concepts/architecture.md) for the modules and the data flow. The rules
that matter most, from `CLAUDE.md`:

- **Paths only from `config.ts`.** Never `process.cwd()`. The server runs from `vite dev` in
  `packages/hub`, from the repo root, and as a service.
- **Board writes only through `data.ts`.** It writes the markdown file in the same call. Raw
  SQL on `items` anywhere else must call `persistItem()`.
- **Every API response is `{ ok, data?, error? }`.** Routes validate, call a module, answer.
  `response.ts` has the helpers.
- **Svelte 5 runes** (`$state`, `$props`, `$derived`), no stores. Check whether a component's
  `<script>` is `lang="ts"` before adding type annotations; the root layout is JS.
- **CSS through the custom properties in `app.css`**; both themes must keep working.
- **Cross-platform.** No platform paths or shell assumptions outside `exec-utils.ts` and
  `config.ts`. Scripts are Node, not bash or PowerShell.
- **Docs are part of the change.** New user-facing behavior updates the matching page in
  `docs/`, it is the in-app help.
- **Commits in logbook format**, one logical change each. [The git logbook](../concepts/logbook.md).

## Recipes

### Add an API endpoint

1. `packages/hub/src/routes/api/<path>/+server.ts`, export `GET`, `POST`, … handlers.
2. Validate input, call a server module, return `json({ ok: true, data })` or an error with a
   status. Keep logic out of the route.
3. Document it in [reference/api.md](../reference/api.md). If the CLI should have it, add a
   command (below).

### Add a UI page

1. `packages/hub/src/routes/<page>/+page.svelte` (and `+page.server.ts` for data loading).
2. Add the nav link in `routes/+layout.svelte`.
3. Write or extend a docs page and list the route in its frontmatter `routes: ['/<page>']`, so
   the help panel opens it there.

### Add a server module

A file in `packages/hub/src/lib/server/`, paths from `config.ts`, DB access via `getDb()` from
`db.ts`. New tables go into the migrations in `db.ts`. Ask first whether the data belongs in a
markdown file instead: anything that should survive deleting the DB and travel through git does.

### Add a CLI command

`packages/cli/src/commands/`, registered in `packages/cli/src/index.ts`. The CLI only calls the
hub API at `APPHUB_URL`; it has no file access of its own. Update
[reference/cli.md](../reference/cli.md).

### Add a template

A folder in `templates/` with `template.json` (`name`, `description`, `tags`, `postCreate`),
placeholders `__APP_NAME__` / `__APP_SLUG__` in text files, cross-platform `postCreate` (Node
scripts). [Create a project](new-project.md) has the format; test it with `apphub new` on
both platforms.

### Add an agent

A markdown file in `agents/` with `provider`, `model`, optional `temperature` and
`maxTokens`; the body is the system prompt. It appears on the Agents page immediately.
[Agents and the debate](agents.md).

### Add a wiki page

A markdown file under `docs/` with frontmatter. [Writing docs](write-docs.md).

## Debugging

- **Logs page** for structured events; `logs/runs/<item>_<ts>.log` for a coding run's full
  transcript; `logs/agents/debate_<ts>.md` for debates.
- `GET /api/health` answers status, uptime, DB state, runner state, PID and Node version.
- `GET /api/board/events` is the SSE bus (`output`, `status`, `board` events); `curl -N` it.
- The index is disposable: stop the hub, delete `packages/hub/data/apphub.db`, start. Projects
  and boards come back from the files. Runtime-only state (branch reviews, activity log, dev
  users, attachments) is gone, see [board files](../concepts/board-files.md).
- `npm run cli -- sync` or the dashboard's **Sync** after editing board files by hand.
- The runner's claim can be reset by restarting the server; it releases stale claims on start.

## Developing the hub with the hub

The hub is project `hub` on its own board. Put an item in **claude** and the runner creates a
worktree under the hub repo's `.worktrees/`, with `node_modules` linked in, and runs Claude Code
on it with `.apphub.md`'s `context` (which points at `CLAUDE.md` and the typecheck command).
Review and merge in the Reviews page, then restart the server to run the merged code. Do not
leave uncommitted changes in files a branch touches, or the merge refuses.
