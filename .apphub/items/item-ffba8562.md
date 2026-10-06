---
id: item-ffba8562
title: SSE listener cleanup + a11y warning sweep
project: hub
stage: plan
priority: low
type: task
labels:
  - bugfix
  - dx
  - ui
position: 2
parent: null
phase: null
blocked_by: []
relates_to: []
created: '2026-08-29T01:01:11.603Z'
updated: '2026-10-05T22:46:44.106Z'
---

Two-parter: (1) /api/board/events writes into closed SSE controllers on client disconnect (board/sse.write_error debug logs) - remove the runnerEvents listener when the stream cancels/errors instead of writing into a closed controller. (2) Sweep the a11y warnings flooding dev output (a11y_label_has_associated_control, a11y_no_noninteractive_element_interactions) in src/routes/board/+page.svelte and src/routes/project/[slug]/+page.svelte - associate labels via for/id or wrap controls, use button elements for clickable non-interactive elements. Verify: dev server output is warning-quiet for these files, SSE updates still arrive on the board.

## Notes

<!-- apphub:notes -->
- 2026-10-01T22:25:25.679Z · info · Parked in plan during the yAPPA S0 pipeline test so the runner does not chain into it. Move back to claude to run it.
