---
id: item-7c1f4c6d
title: 'Node planner: plans as DAGs, run sequentially and in parallel worktrees'
project: hub
stage: idea
priority: high
type: task
labels:
  - planner
  - runner
  - visualization
position: 9
parent: null
phase: null
blocked_by:
  - item-1d52f0c9
  - item-4c556a48
relates_to: []
created: '2026-10-01T22:22:05.154Z'
updated: '2026-10-01T22:22:05.154Z'
---

A node-based planning canvas to work off tickets and plans: draw items as nodes and dependencies as edges (stored as the same board files — blocked_by is the edge list). Execution follows topological order: independent branches run in parallel worktrees, chains run in sequence; every node shows its live state (queued → running → review → done).

- Reusable plan templates as subgraphs (e.g. spike → ADR → implementation → review).
- Needs runner concurrency (Phase 2A) and the board graph view.

Requested by the user on 2026-10-02 (see docs/roadmap.md, pillar 3).
