# App Hub

Local-first project management, scaffolding and an AI-agent workbench for one developer's app
ideas. An idea becomes a running repo with structure, docs and a task board in minutes. Then
coding agents work through that board in isolated git worktrees while you review and merge.

It is a personal hobby project, not a product. It runs on a Windows 11 PC and a MacBook from the
same repo, needs no cloud and no accounts, and manages its own development on its own board.

```
          you ──► dashboard / board / CLI
                          │
                          ▼
   ┌──────────── App Hub (SvelteKit server) ────────────┐
   │  scanner ── reads .apphub.md + .apphub/ of repos   │
   │  board   ── items, stages, dependencies, phases    │
   │  runner  ── coding agent per item, in a worktree   │
   │  agents  ── local/remote LLM roles (debate, …)     │
   │  SQLite  ── fast index, rebuilt from the files     │
   └──────────────────────┬─────────────────────────────┘
                          │ reads / writes
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
   App-Hub repo      projects/<app>     any registered repo
   (the hub itself)  (scaffolded here)  (lives elsewhere)
```

## What it does

- **Scaffold** a project from a template (Tauri 2, SvelteKit, Next.js, Expo, Kotlin
  Multiplatform) with `.apphub.md`, `CLAUDE.md`, docs folder, LF policy and an initial commit.
- **Register** any existing repo on disk and give it a board without moving it.
- **Board** with six lanes (`idea → plan → build → claude → review → done`), dependencies,
  phases, labels, notes and attachments. Every item is a markdown file in the project's repo.
- **Runner**: drop an item into the `claude` lane and a coding agent (Claude Code by default,
  aider with a local model on request) works on it in its own worktree and branch.
- **Review lane**: read commits and diff, merge with a logbook commit, or discard. Nothing an
  agent writes reaches a branch unreviewed.
- **Agents** as markdown files on Ollama, OpenAI-compatible servers or Claude, with a built-in
  critic / advocate / judge debate.
- **Visualization**: the codebase as a navigable 2D and 3D graph. More of this is the next
  roadmap pillar.
- **Wiki in the app**: the `docs/` folder is rendered as a context-aware help panel (`?` or F1).
- **Two machines, one board**: the board travels through git, the SQLite index is disposable.

## Quickstart

Clone, run, create a first project. About ten minutes including installs.

### Prerequisites

| Needed | Why |
| --- | --- |
| Node.js 20 or newer (22 is what the hub is developed with) and npm | runs the hub, the CLI and the templates' install steps |
| git 2.30 or newer | projects are repos, the runner uses worktrees |
| optional: [Claude Code](https://docs.claude.com/en/docs/claude-code) CLI | the default coding agent for board items, and the AI task suggestions |
| optional: [Ollama](https://ollama.com) | local models for the talking agents and the aider backend |
| optional: Rust toolchain | only for projects from the `tauri-app` template |

### 1 · Clone and install

```bash
git clone https://github.com/crisin/App-Hub.git
```

```bash
cd App-Hub && npm install && npm run build --workspace=@apphub/shared
```

The shared package holds the types every other package imports. Build it first, and again after
every change to it.

### 2 · Start the hub

```bash
npm run dev
```

Open <http://localhost:5174>. The dashboard shows one project: **App Hub** itself (slug `hub`)
with its own board. Press `?` to open the wiki in the app. The first start creates the SQLite
index under `packages/hub/data/` and imports every board file it finds.

### 3 · Hello world

Build the CLI once, then scaffold a project and put a first item on its board.

```bash
npm run build --workspace=@apphub/cli
```

```bash
npm run cli -- new "Hello World" --template sveltekit-web
```

```bash
npm run cli -- board add "Say hello on the start page" -p hello-world -s plan
```

The new repo lives in `projects/hello-world/`, has its own `.apphub.md`, `CLAUDE.md`, an
initial commit, and the item you just added as `.apphub/items/<id>.md`. Refresh the dashboard:
the project card is there, the board shows the item in **plan**. Run the project like any
SvelteKit app:

```bash
cd projects/hello-world && npm run dev
```

### 4 · Hand the item to an agent (optional, needs Claude Code)

Drag the item into the **claude** lane in the UI, or:

```bash
npm run cli -- board list
```

```bash
npm run cli -- board move <item-id> claude
```

The runner claims it, creates a worktree on branch `claude/<id>-say-hello-on-the-start-page`,
streams the agent's output to the board, and parks the result in **review** when the agent has
committed. Open **Reviews**, read the diff, merge or discard.

Full walkthrough with explanations: [docs/start/quickstart.md](docs/start/quickstart.md).

## Documentation

The wiki is the `docs/` folder. The same files render inside the app as the help panel, so the
wiki grows with the project and is never further away than `?`.

| Section | Start here |
| --- | --- |
| **Start** | [documentation map](docs/README.md) · [what App Hub is](docs/start/overview.md) · [quickstart](docs/start/quickstart.md) · [feature tour](docs/start/features.md) |
| **How-to** | [development setup](docs/howto/dev-setup.md) · [new project](docs/howto/new-project.md) · [register a repo](docs/howto/register-project.md) · [board workflow](docs/howto/board-workflow.md) · [reviews](docs/howto/reviews.md) · [agents and debate](docs/howto/agents.md) · [two machines](docs/howto/two-machines.md) · [run it permanently, local or remote](docs/howto/deploy.md) · [writing docs](docs/howto/write-docs.md) |
| **Concepts** | [architecture](docs/concepts/architecture.md) · [board files](docs/concepts/board-files.md) · [the runner](docs/concepts/runner.md) · [the git logbook](docs/concepts/logbook.md) · [trust model](docs/concepts/trust-model.md) |
| **Reference** | [HTTP API](docs/reference/api.md) · [CLI](docs/reference/cli.md) · [configuration](docs/reference/config.md) · [troubleshooting](docs/reference/troubleshooting.md) |
| **Essays** | [From the inside](docs/essays/from-the-inside.md), an AI's view of this project |
| **Roadmap** | [where this is going](docs/roadmap.md) |

## Commands at a glance

```bash
npm run dev                                   # hub dev server on localhost:5174
npm run build && npm run start                # production build, serves 127.0.0.1:5174
npm run cli -- <command>                      # the apphub CLI (hub must be running)
npm run logbook                               # recent commits with full messages
npm run docs:check                            # validate wiki frontmatter and links
npx tsc --noEmit --noUnusedLocals -p packages/hub/tsconfig.json
```

## Status

Foundations are done as of October 2026: board as files, runner with worktree isolation, review
lane, agents and debate, templates, help panel, dogfooding, autostart on both platforms. Next
comes the visualization pillar, then a node-based planner that executes item graphs in parallel
worktrees. The live plan is the hub's own board; the map above it is [the roadmap](docs/roadmap.md).

Development conventions for humans and agents are in [CLAUDE.md](CLAUDE.md). The git history is
the project's logbook: every commit explains why, what and how it was verified.

## License

Personal project, no license file yet. Everything it depends on is open source.
