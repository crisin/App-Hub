---
title: Work on two machines
section: How-to
order: 6
summary: Windows PC and MacBook share code AND board through git — what to commit, what stays local.
---

# Work on two machines

The hub runs on both machines from the same repo. Everything that should travel is a file in
git; everything machine-specific stays out of it.

| Travels with git | Stays on the machine |
| --- | --- |
| `.apphub.md` — project metadata | `packages/hub/data/apphub.db` — SQLite index |
| `.apphub/items/*.md`, `.apphub/phases.md` — the board | `apphub.local.json` — registered repo paths |
| `agents/*.md`, `templates/`, `docs/` | `.env` — URLs, API keys, models |
| code, of course | `logs/` — run output, debate transcripts |
| | attachments, branch reviews, dev users, activity log |

## Routine

1. Before switching machines: commit (incl. `.apphub/`) and push.
2. On the other machine: `git pull`, then **Sync** (dashboard button or
   `npm run cli -- sync`). The sync reports `imported / rewritten / removed / exported`.
3. Registered external repos: register once per machine (their paths differ).

## Conflict rules

- Per item, the newer `updated` timestamp wins between file and index.
- A file deleted on the other machine removes the item here on sync.
- Two machines editing the same item → a normal git merge conflict in that one file. Resolve
  it, then Sync.

## Line endings

`.gitattributes` pins LF for every text file (CRLF only for `.bat/.cmd/.ps1`). Git for
Windows' `core.autocrlf=true` no longer matters — no more whole-file diffs after switching
machines. New projects from templates get the same file.
