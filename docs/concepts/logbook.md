---
title: The git logbook
section: Concepts
order: 4
summary: Every change is a commit with a detailed message — git log is the project diary.
---

# The git logbook

Since 2026-10-01 the git history is the logbook of the hub and of every project it scaffolds.
Someone who reads only `git log` must be able to follow what happened, why, and how it was
checked.

```
<type>(<scope>): <what changed — imperative, max 72 chars>

Why:       the problem or motivation — what was wrong or missing, how it showed up
What:      the change itself, key decisions, rejected alternatives
Verified:  how it was checked (typecheck, build, API call, e2e board run) —
           or "not verified" plus the reason
Follow-up: open ends, known limitations, next steps (omit if none)
```

- **Types:** `feat` `fix` `refactor` `docs` `chore` `test` `perf` `build` `ci`.
- **Scopes:** `hub` `cli` `shared` `runner` `board` `agents` `templates` `git` `docs`, or a
  module name.
- One logical change per commit. No "wip", no "misc".
- Never rewrite pushed history.

## Reading it

```bash
npm run logbook                         # last 15 entries with full bodies
npm run logbook -- -n 50
npm run logbook -- --since=2026-10-01
npm run logbook -- packages/hub/src/lib/server/board-files.ts
git log --grep '^fix'                   # all fixes
```

## Who follows it

- **You** — `git config commit.template .gitmessage` puts the skeleton into the editor.
- **Coding agents** — the runner prompt prescribes the format; review it in the review lane.
- **The hub** — scaffold commits and review-lane merge commits (`merge(board): <item>`) are
  written in the same spirit.
- **New projects** — the generated `CLAUDE.md` section carries the rule.
