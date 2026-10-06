---
id: item-558bcad2
title: Project catalog across machines + "clone missing projects"
project: hub
stage: plan
priority: high
type: task
labels:
  - two-machines
  - projects
position: 16
parent: null
phase: null
blocked_by: []
relates_to: []
created: '2026-10-06T20:55:37.120Z'
updated: '2026-10-06T20:55:37.120Z'
---

projects/ is gitignored and no catalog of projects is versioned, so after a git pull the MacBook never learns that a project exists — every repo must be cloned by hand into the right place. Since projects now carry their repo URL (git remote origin), this is solvable:

- A versioned catalog in the hub repo (e.g. .apphub/projects.md: slug, name, repo URL, location kind) written on create/register/delete.
- Dashboard + CLI: "missing on this machine: N" → clone into projects/ (managed) or ask for a path (external), then sync.
- Docs: howto/two-machines.md.

Found in the full project playthrough on 2026-10-06 (new tauri-app project "Focus Timer", two dependent items through runner → review → merge, one debated idea).
