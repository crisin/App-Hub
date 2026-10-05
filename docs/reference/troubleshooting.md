---
title: Troubleshooting
section: Reference
order: 4
summary: Symptoms, causes and fixes — install, startup, runner, agents, board sync, two machines.
routes: ['/logs']
---

# Troubleshooting

Symptom first, then what is going on, then the fix. When nothing here matches: the **Logs**
page, `logs/runs/`, `GET /api/health`, and `npm run logbook` for recent changes that may explain
new behavior.

## Install and start

**`npm install` compiles `better-sqlite3` for minutes, or fails with a build error.**
No prebuilt binary for your Node version. Use a current LTS (20 or 22). If you must compile,
Windows needs the Visual Studio Build Tools and Python, macOS the Xcode command line tools.

**`was compiled against a different Node.js version` on start.**
You switched Node versions after installing. `npm rebuild better-sqlite3`.

**`App Hub root not found (no package.json named "apphub" above) — set APPHUB_ROOT`.**
The server could not find the monorepo root by walking up from the module or the working
directory. Happens with unusual checkouts or bundling. Set `APPHUB_ROOT` to the repo path.

**Port 5174 is in use.**
Another hub (dev and production at once?) or something else. `APPHUB_PORT=5175 npm run dev`,
and point the CLI at it with `APPHUB_URL=http://localhost:5175`. The production port is set in
`scripts/start.mjs` from the same variable.

**Cannot find module `@apphub/shared` or stale types.**
The shared package is not built or outdated: `npm run build --workspace=@apphub/shared`, then
restart.

**The CLI says `ECONNREFUSED` or `fetch failed`.**
The hub is not running, or runs on another port or host. The CLI only talks to `APPHUB_URL`
(default `http://localhost:5174`). The CLI also needs a build: `npm run build --workspace=@apphub/cli`,
or use `npm run dev --workspace=@apphub/cli -- <command>`.

## Runner

**Item dropped into `claude` and nothing happens; the item carries a note "Claude CLI not found".**
The runner probes the backend before claiming. It looks for `claude` on `PATH`, in
`~/.local/bin`, in `%APPDATA%\npm` (resolving the `claude.cmd` shim to `cli.js`), in the VS
Code extension's bundled binary (Windows), and in the desktop app bundle (macOS). Install
Claude Code, log in once, restart the hub so it sees the new `PATH`.

**Note "aider not found (install with: pipx install aider-chat)".**
Same for the `aider` label: `PATH`, `~/.local/bin`, scoop shims. Remove the label to run on
Claude Code instead.

**Changed `claude-runner.ts` or `coder-backends.ts`, but runs behave like before.**
`vite dev` caches the runner's module graph. Restart the dev server; HMR is not enough.

**The item came back to `build` with a note instead of going to `review`.**
Intended: the run ended without commits (agent found nothing to do, failed before committing,
or the backend could not start). The note says which. The transcript is in
`logs/runs/<item>_<timestamp>.log`. Fix the item or the environment and move it to `claude`
again. The runner never moves an item back to `claude` itself, to avoid loops.

**An item is stuck assigned to `claude-runner` after a crash.**
Restart the hub; stale claims are released on startup and logged.

**Merge in the review lane fails.**
Git refuses to merge into a main checkout with uncommitted changes in files the branch touches.
Commit or stash in the project, then merge again. The error text is shown in the UI.

**Windows: a Rust project's build fails with a locked `.exe`, or the first build in a worktree
takes forever.**
The runner gives Rust worktrees `CARGO_TARGET_DIR=<repo>/.worktrees/.cargo-target`, one shared
cache per repo, separate from the main `target/` where a running app may lock its executable.
The first build fills that cache; later runs are fast. If it is still slow, check that the
worktree really has the env (the runner panel prints `Env:` lines).

**Windows: `node_modules` missing in the worktree.**
The runner links `node_modules` of the root and every npm workspace from the main checkout as
junctions. If the main checkout has no `node_modules` yet, there is nothing to link; run
`npm install` in the project once.

## Agents and models

**A local agent run hangs for minutes and then errors.**
Local models can take minutes per turn on CPU. The hub streams responses to avoid undici's
five-minute header timeout; if a provider is reached through a proxy that buffers, that
protection is lost. Use `127.0.0.1` rather than `localhost` in the model URLs (IPv6/IPv4
flakiness in Node's fetch), and smaller or MoE models for the debate roles.

**aider loops on 404 errors.**
It asked for a weak or editor model that is not pulled locally, often from a stale
`~/.aider.conf.yml`. Pin `APPHUB_AIDER_WEAK_MODEL` and `APPHUB_AIDER_EDITOR_MODEL` to models
that exist, see [configuration](config.md).

**The Agents page shows a provider as unreachable.**
Ollama not running, or `APPHUB_OLLAMA_URL` / `APPHUB_OPENAI_COMPAT_URL` wrong; for Anthropic,
`ANTHROPIC_API_KEY` missing in `packages/hub/.env`. Restart after changing `.env`.

**The suggest panel on a project page does nothing.**
Suggestions run Claude Code non-interactively with a project summary. Same requirement as the
runner: the CLI must be found and logged in.

## Board and files

**I edited an item file by hand and the UI does not show the change.**
Press **Sync** (dashboard) or run `npm run cli -- sync`. If the UI still wins, the file's
`updated` timestamp is older than the index entry; bump it and sync again. Rules:
[board files](../concepts/board-files.md).

**After `git pull` the board is missing items the other machine added.**
Same: Sync. The server syncs at start and on request, there is no file watcher yet (roadmap).

**An item disappeared after Sync.**
Its file is gone, probably deleted or not committed on the other machine, and the item had been
persisted before. Restore the file from git and sync.

**A merge conflict in `.apphub/items/<id>.md`.**
Two machines edited the same item. Resolve like any text conflict, keep one frontmatter block,
commit, Sync.

**Whole-file diffs after switching machines (CRLF).**
`.gitattributes` pins LF. For a repo created before that rule: `git add --renormalize .` and
commit once.

**A registered project is missing on the other machine.**
Registered paths live in `apphub.local.json`, which is per machine and gitignored, because the
same repo has different paths on each machine. Register it there too.

## Index and data

**Something looks corrupt; start fresh.**
Stop the hub, delete `packages/hub/data/apphub.db` (and `-wal`, `-shm` if present), start.
Projects and boards are rebuilt from the files. You lose machine-local runtime state: branch
reviews (the branches themselves stay in git), the activity log, dev users and API keys,
attachments.

**Settings → Interface changes are gone after a reset.**
UI settings are stored in the index too. Set them again.

## Help panel

**The panel shows `No doc at "…"`.**
A link points to a file that does not exist or moved. `npm run docs:check` lists broken links
and anchors; links are relative to the current article.

**A new docs page does not appear in the contents.**
The index is read live, so a reload of the panel suffices. If the page is missing frontmatter it
sorts into **Start** with order 99; add `title`, `section`, `order`, `summary`, see
[writing docs](../howto/write-docs.md).
