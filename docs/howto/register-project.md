---
title: Register an existing repo
section: How-to
order: 2
summary: Give a repo that lives anywhere on disk a board in the hub — without moving it.
---

# Register an existing repo

```bash
npm run cli -- register D:/Projekte/dev/my-app --name "My App" --description "One line"
```

(or `POST /api/projects/register` with `{ "path": "...", "name": "...", "description": "..." }`)

- If the repo has no `.apphub.md`, a minimal one is written — commit it in that repo and fill
  in its `context` field.
- Paths outside `projects/` are stored in **`apphub.local.json`** in the hub root. That file
  is gitignored on purpose: the same repo has a different path on the Windows PC and the
  MacBook, so register it once per machine. `APPHUB_PROJECT_PATHS` (path-separator list) works
  too, e.g. in `.env`.
- A junction/symlink inside `projects/` pointing at the repo also counts as a project.

The registered repo then behaves like any other project: its board items are written to
**its own** `.apphub/items/`, the runner creates worktrees in **its own** `.worktrees/`, and the
review lane merges into **its** base branch.

## Removing

The `×` on a dashboard card (or `DELETE /api/projects/<slug>`) depends on where the project
lives:

| Location | What removal does |
| --- | --- |
| inside `projects/` | deletes the folder (it was scaffolded by the hub) |
| registered elsewhere | unregisters it — the repo stays untouched |
| the hub itself (`hub`) | refused |
