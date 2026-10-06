---
id: item-97d67db6
title: 'Create-project UX: progress, errors, open the project, register existing repo'
project: hub
stage: plan
priority: medium
type: task
labels:
  - ui
  - templates
position: 17
parent: null
phase: null
blocked_by: []
relates_to: []
created: '2026-10-06T20:55:37.123Z'
updated: '2026-10-06T20:55:37.123Z'
---

Creating "Focus Timer" from the dashboard: the scaffold runs ~12 s (postCreate) with no busy state and a still-clickable Create button; a failing request or postCreate warnings are swallowed (only res.ok is checked); the user stays on the dashboard instead of landing on the new project. "Register an existing repo" exists only in the CLI/API. Also: the fresh repo is dirty right away (.apphub/phases.md is written after the scaffold commit), git init uses the machine default branch (master here) instead of main, and the helper comment above context: disappears on the first UI edit (YAML round trip drops comments).

- Busy state + disabled button, error/warnings shown inline, redirect to /project/<slug>.
- "Register existing repo" dialog (path, name, description).
- Optional description + context fields at creation.
- Seed phases before the initial commit; git init -b main.

Found in the full project playthrough on 2026-10-06 (new tauri-app project "Focus Timer", two dependent items through runner → review → merge, one debated idea).
