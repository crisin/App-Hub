---
title: Work with the board
section: How-to
order: 3
summary: From idea to merged code — lanes, the Claude lane, labels, dependencies.
routes: ['/board']
---

# Work with the board

```
idea ──► plan ──► build ──► claude ──► review ──► done
                     ▲         │          │
                     │   runner picks up  │ merge / discard
                     └── no commits ◄─────┘
```

| Lane | Meaning |
| --- | --- |
| **idea** | captured, not yet thought through |
| **plan** | scoped — ready to be built by you or an agent |
| **build** | someone (you, or the runner right now) is working on it |
| **claude** | queue for the runner — dropping an item here starts a coding agent |
| **review** | an agent's branch waits for you on the Reviews page |
| **done** | merged / finished |

## Hand an item to a coding agent

1. Write the item so a stranger could do it: title says *what*, description says *where* and
   *what done means* (files, acceptance, constraints).
2. Drag it into **claude** (or `npm run cli -- board move <id> claude`). The runner claims
   the highest-priority unblocked item, moves it to **build**, creates a worktree on branch
   `claude/<id>-<title>` and starts the agent.
3. Watch the live output in the runner panel on the board. The agent posts progress notes to
   the item.
4. When it finishes with commits, the item lands in **review** → [review it](reviews.md).
   Finishing without commits parks it in **build** with a note — never back in claude, which
   would loop.

Labels steer the run: **`aider`** runs the item on aider with a local Ollama model instead of
Claude Code; **`debate`** (set when creating) starts a critic/advocate/judge debate on the idea
and attaches the verdict as a note — see [agents](agents.md).

## Dependencies and order

An item can be **blocked by** others (`blocks`) or just **relate** to them. The runner skips
items whose blockers are not done yet, so you can queue a whole chain in the claude lane and
it is worked off in order. Within the lane, priority (`critical` → `low`) then position decide.

## Where the board lives

Every item is a markdown file in the project's repo: `.apphub/items/<id>.md`. Edits in the
UI write the file immediately; edits to the file (by hand, by an agent, by `git pull`) reach
the UI on **Sync** (dashboard button or `npm run cli -- sync`). Commit `.apphub/` together
with your work — that is how the other machine gets the same board. Details:
[board files](../concepts/board-files.md).

## CLI

```bash
npm run cli -- board list                       # all lanes
npm run cli -- board add "Title" -p hub         # new item (see --help for stage/priority/labels)
npm run cli -- board move <id> claude           # hand to the runner
npm run cli -- board claude run                 # trigger the runner now
npm run cli -- task list -p my-app              # one project's items
```
