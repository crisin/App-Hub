---
title: Quickstart
section: Start
order: 2
summary: Clone, start the hub, scaffold a first project, hand an item to an agent — with what happens at each step.
---

# Quickstart

From an empty folder to a project with a board and a coding agent working on it. The short
version is in the repo's `README.md`; this page explains what each step does and where to look
when something is off.

## 0 · What you need

| Tool | Required? | Used for |
| --- | --- | --- |
| Node.js ≥ 20, npm | yes | the hub, the CLI, template install steps |
| git ≥ 2.30 | yes | projects are repos; the runner uses `git worktree` |
| Claude Code CLI | for the runner | default coding agent, AI task suggestions |
| Ollama (or LM Studio, llama.cpp, vLLM) | for talking agents and aider | local models |
| aider (`pipx install aider-chat`) | optional | alternative coder backend, label `aider` |
| Rust toolchain | per template | `tauri-app` projects |

Windows works with Git for Windows and a normal Node install. No WSL needed. macOS needs the
Xcode command line tools for git. Everything the hub itself does is cross-platform by design,
see [architecture](../concepts/architecture.md).

## 1 · Clone and install

```bash
git clone https://github.com/crisin/App-Hub.git
cd App-Hub
npm install
npm run build --workspace=@apphub/shared
```

`npm install` installs all three workspaces (`shared`, `hub`, `cli`). The shared package
compiles to `packages/shared/dist/`, which the hub and CLI import. It is not built
automatically by `npm run dev`, so build it once now and after every change to it.

`better-sqlite3` ships prebuilt binaries for current Node versions. If npm starts compiling it,
your Node version has no prebuilt binary; see [troubleshooting](../reference/troubleshooting.md).

## 2 · Start the hub

```bash
npm run dev
```

The dev server listens on <http://localhost:5174>. On start the hub

1. finds its root (the `package.json` named `apphub` above the server code),
2. opens or creates the SQLite index at `packages/hub/data/apphub.db` and runs migrations,
3. scans for projects: the hub repo itself, every folder under `projects/`, and the paths in
   `apphub.local.json`,
4. imports every `.apphub/items/*.md` and `.apphub/phases.md` it finds, and prints the counts
   (`imported / rewritten / removed / exported`),
5. releases claims left by a crashed run.

The dashboard shows **App Hub** (slug `hub`): the hub manages its own development on its own
board, see the hub's `.apphub/`. Press `?` or F1 for the help panel. It opens on the article
for the page you are on and holds the whole wiki.

## 3 · Hello world

The CLI is a thin client of the hub API, so the hub must be running. Build the CLI once:

```bash
npm run build --workspace=@apphub/cli
```

Scaffold a project:

```bash
npm run cli -- new "Hello World" --template sveltekit-web
```

What happens, in order: the template folder is copied to `projects/hello-world/`,
placeholders are filled in, `.apphub.md`, `CLAUDE.md`, `.gitattributes`, `.gitignore` and
`docs/` are written, `git init`, the template's `postCreate` step runs (`npm install` here,
takes a minute), and an initial commit is made. Details and the other templates:
[create a project](../howto/new-project.md).

Add a first board item:

```bash
npm run cli -- board add "Say hello on the start page" -p hello-world -s plan
```

Now look at three places:

- **Dashboard**: a new card, status `idea`.
- **Board**: the item in the **plan** lane. Click it for the detail drawer.
- **The repo**: `projects/hello-world/.apphub/items/<id>.md` is the item as a markdown file.
  Edit it in the UI and the file changes. Edit the file and press **Sync** to see the change
  in the UI. That is the whole data model, see [board files](../concepts/board-files.md).

Run the scaffolded app like any SvelteKit app:

```bash
cd projects/hello-world && npm run dev
```

## 4 · Hand the item to an agent

This needs the Claude Code CLI, logged in. The runner finds it on `PATH`, in
`~/.local/bin`, in npm's global folder, in the VS Code extension (Windows) or the desktop app
bundle (macOS). The Agents page and `npm run cli -- agent list` tell you what is reachable.

Before handing over, write the item so a stranger could do it: title says what, description
says where and what done means. Then drag it into **claude**, or:

```bash
npm run cli -- board move <item-id> claude
```

Within seconds the runner

1. claims the item (stage **build**, assigned to `claude-runner`),
2. creates `projects/hello-world/.worktrees/claude-<id>-say-hello-on-the-start-page/` on a
   branch of the same name, with `node_modules` linked in,
3. starts Claude Code with the project's description and `context`, the item, and the rules
   (work in the worktree, commit in logbook format, post progress notes, never push or merge),
4. streams the output, tool calls included, to the runner panel on the board and to
   `logs/runs/<id>_<timestamp>.log`.

When the agent has committed, the item moves to **review**. Open **Reviews**: commits, diff
stat, full diff. **Merge** merges into the branch the run started from with a `merge(board):`
commit and moves the item to **done**. **Discard** throws the branch away and sends the item
back to **idea**. A run without commits parks the item in **build** with a note, never back
in **claude**, so nothing loops. [Reviews](../howto/reviews.md) has the details.

## 5 · Where to go from here

- Put the hub's own board to work: items with project `hub` run against the hub repo.
  Restart the server after merging hub changes.
- Give agents something to argue about: create an item with the label `debate` and read the
  verdict as a note, see [agents and the debate](../howto/agents.md).
- Register a repo that already exists somewhere on disk:
  [register an existing repo](../howto/register-project.md).
- Set the hub up as a service so it is always there:
  [run it permanently](../howto/deploy.md).
- Work on the hub itself: [development setup](../howto/dev-setup.md).
