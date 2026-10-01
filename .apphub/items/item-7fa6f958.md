---
id: item-7fa6f958
title: Review-lane merge inside a temporary worktree
project: hub
stage: idea
priority: medium
type: task
labels:
  - runner
  - git
position: 10
parent: null
phase: null
blocked_by: []
relates_to: []
created: '2026-10-01T22:22:05.158Z'
updated: '2026-10-01T22:22:05.158Z'
---

Merging currently checks out the base branch in the main checkout — invasive when the user works there, and git refuses with uncommitted changes in touched files. Merge in a throwaway worktree on the base branch and update the ref instead.
