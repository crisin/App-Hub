---
title: The runner
section: Concepts
order: 3
summary: How a board item becomes a reviewed branch — claim, worktree, coder backend, review lane.
---

# The runner

```
claude lane ──► claim ──► worktree + branch ──► coder backend ──► commits?
                                                                 ├─ yes ──► review lane
                                                                 └─ no  ──► build (+ note)
```

1. **Pick** — the highest-priority unclaimed item in the `claude` lane whose `blocked_by`
   items are all done. One run at a time (concurrency is on the roadmap).
2. **Claim** — atomically: `assigned_to = claude-runner`, stage `build`.
3. **Worktree** — `git worktree add <repo>/.worktrees/claude-<id>-<slug> -b claude/<id>-<slug>`
   from the repo's current branch. `.worktrees/` is added to the repo's `.git/info/exclude`
   automatically.
   - **Node:** `node_modules` of the root and every npm workspace (`workspaces` in
     `package.json`, e.g. `apps/*`, `packages/*`) are linked in from the main checkout
     (junctions on Windows) — no install per task.
   - **Rust:** if the repo has a root `Cargo.toml`, the agent gets
     `CARGO_TARGET_DIR=<repo>/.worktrees/.cargo-target`, one build cache shared by all task
     worktrees. Not the main `target/`: on Windows a running app's `.exe` is locked.
4. **Prompt** — project description + `context` from `.apphub.md`, item title, description,
   labels, and instructions: work only in the worktree, commit in
   [logbook format](logbook.md), post progress notes to the hub API, never push or merge.
5. **Backend** — `claude` (Claude Code CLI, stream-json output, default) or `aider` (label
   `aider`; local model via Ollama, `APPHUB_AIDER_MODEL`). Output streams to the board via SSE
   and to `logs/runs/<item>_<timestamp>.log`.
6. **Result** — commits (even from a failed run) → item to **review** with a note; no
   commits, a failed run, or a backend that could not start → worktree removed, claim
   released, item parked in **build** with a note (not claude: that would loop).
7. While the lane still has unblocked items, the next run starts automatically.

## Finding the agent CLIs

`exec-utils.ts` searches `PATH` plus common install dirs per OS. On Windows it also finds the
Claude Code binary bundled with the VS Code extension, and resolves npm's `claude.cmd` shim to
`node cli.js` (avoids cmd.exe quoting). On macOS it falls back to the Claude desktop app
bundle.

## Gotchas

- `npm run dev` caches the runner's module graph — after changing `claude-runner.ts` or
  `coder-backends.ts`, restart the server; HMR is not enough.
- The hub's own items run against the hub repo (`scope: hub`). After merging hub changes,
  restart the server.
