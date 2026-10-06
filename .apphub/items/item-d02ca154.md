---
id: item-d02ca154
title: Agents verify UI work visually (headless preview screenshots)
project: hub
stage: idea
priority: medium
type: task
labels:
  - runner
  - visualization
  - agents
position: 11
parent: null
phase: null
blocked_by: []
relates_to: []
created: '2026-10-06T20:55:37.129Z'
updated: '2026-10-06T20:55:37.129Z'
---

The UI item's agent said it honestly: "I haven't clicked through it in a real Tauri window because this run has no display". Coding agents can typecheck and test, but cannot see what they built. For UI items the runner could start the web preview (npm run dev:web / vite) in the worktree, take headless-browser screenshots (Playwright) and attach them to the branch review — a reviewer sees the UI before merging, and the agent can look at its own result.

Found in the full project playthrough on 2026-10-06 (new tauri-app project "Focus Timer", two dependent items through runner → review → merge, one debated idea).
