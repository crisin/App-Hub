---
id: item-67c14cef
title: Attachments travel with the repo (.apphub/attachments)
project: hub
stage: idea
priority: low
type: task
labels:
  - board
position: 11
parent: null
phase: null
blocked_by: []
relates_to: []
created: '2026-10-01T22:22:05.162Z'
updated: '2026-10-01T22:22:05.162Z'
---

Item attachments still live in the machine-local data dir, so item files on the other machine reference attachments that are missing. Store them under <repo>/.apphub/attachments/<item-id>/ and index them on sync like items.
