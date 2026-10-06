---
id: item-8a8e9a7e
title: Dependencies in the UI and CLI (+ blocked badge)
project: hub
stage: plan
priority: high
type: task
labels:
  - board
  - ui
  - cli
position: 14
parent: null
phase: null
blocked_by: []
relates_to: []
created: '2026-10-06T20:55:37.114Z'
updated: '2026-10-06T20:55:37.114Z'
---

Dependencies drive the runner's order and are the edge list of the planned node planner, but they can only be created through POST /api/board/:id/dependencies. No UI, no CLI, not even a "blocked" indicator — a blocked item in the claude lane just doesn't start, without explanation.

- Item drawer (board + project page): "Blocked by" / "Blocks" lists with add (search by title) and remove; relates_to too.
- Cards: blocked badge with the blockers' titles on hover.
- CLI: apphub board block <id> --on <id>, apphub board unblock <id> --from <id>; board list marks blocked items.
- Docs: howto/board-workflow.md "Dependencies and order".

Found in the full project playthrough on 2026-10-06 (new tauri-app project "Focus Timer", two dependent items through runner → review → merge, one debated idea).
