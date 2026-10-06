---
id: item-a27c3a4a
title: 'Polish batch: titles, a11y, health uptime, board subtitle, logs filters'
project: hub
stage: plan
priority: low
type: task
labels:
  - ui
  - polish
position: 18
parent: null
phase: null
blocked_by: []
relates_to: []
created: '2026-10-06T20:55:37.126Z'
updated: '2026-10-06T20:55:37.126Z'
---

Small things from the playthrough, each a few lines:
- No <title> on any page — every tab is "localhost" (svelte:head per page, e.g. "Board · App Hub").
- Sidebar project links have no accessible name; description/context/repo on the project page are clickable <p>s, not keyboard-reachable (button or role + tabindex + Enter).
- /api/health uptime counts from the first health request (startTime set at route-module load) → process.uptime().
- Board subtitle still says "Hub tasks and issues" (it shows all projects).
- Logs: category filter misses "agents"; the "Today" header repeats on every row; sse.write_error debug spam drowns real entries (see the SSE cleanup item).
- New-item form on the project page: no phase, parent or dependency at creation.

Found in the full project playthrough on 2026-10-06 (new tauri-app project "Focus Timer", two dependent items through runner → review → merge, one debated idea).
