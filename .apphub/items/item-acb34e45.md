---
id: item-acb34e45
title: Debate verdict travels with the item (not a local log path)
project: hub
stage: plan
priority: high
type: task
labels:
  - agents
  - board
position: 15
parent: null
phase: null
blocked_by: []
relates_to: []
created: '2026-10-06T20:55:37.118Z'
updated: '2026-10-06T20:55:37.118Z'
---

After a debate the item only gets "Debate verdict: score 7/10, see report — D:\...\logs\agents\debate_<ts>.md". logs/ is gitignored and machine-local: the verdict is not readable in the UI, not on the other machine, not in the repo. yAPPA's intake rule ("the verdict lands as a note on the item") is therefore only half true.

- Note text: score + recommendation + the decisive points (short).
- Full transcript: <repo>/.apphub/debates/<item-id>.md (committed with the board), linked from the item.
- Item drawer renders the report (markdown).

Found in the full project playthrough on 2026-10-06 (new tauri-app project "Focus Timer", two dependent items through runner → review → merge, one debated idea).
