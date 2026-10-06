---
id: item-1d52f0c9
title: Board as a graph (2D + 3D)
project: hub
stage: plan
priority: high
type: task
labels:
  - visualization
  - board
position: 6
parent: null
phase: null
blocked_by: []
relates_to: []
created: '2026-10-01T22:22:05.134Z'
updated: '2026-10-05T22:46:44.106Z'
---

Render a project's board as a network: items = nodes (color = stage, size = priority), edges = blocked_by (directed), relates_to (dashed), parent (hierarchy). Highlight the critical path and blocked items.

- Reuse what /architecture already has: Cytoscape (2D, dagre layout for the dependency DAG) and 3d-force-graph (3D).
- Data: /api/items + dependencies (already explicit edges since the board-files change).
- Click a node → item detail; filter by project/stage/label.
- Entry: a "Graph" toggle on the board page and on project pages.

Foundation for the node planner and live overlays.
