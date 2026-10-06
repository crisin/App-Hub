---
id: item-3ee10c24
title: Cargo cache housekeeping and Windows linker noise in tauri-app
project: hub
stage: plan
priority: low
type: task
labels:
  - runner
  - templates
position: 19
parent: null
phase: null
blocked_by: []
relates_to: []
created: '2026-10-06T20:55:37.133Z'
updated: '2026-10-06T20:55:37.133Z'
---

- The shared <repo>/.worktrees/.cargo-target was 3.2 GB after one Tauri build and is never cleaned. Show its size per project, offer a cleanup (apphub clean <slug> / settings), maybe prune when no worktree exists.
- tauri-app on Windows: the MSVC linker's "Bibliothek ... werden erstellt" message surfaces as a cargo warning on every build (linker_messages); silence it in the template so real warnings stand out.

Found in the full project playthrough on 2026-10-06 (new tauri-app project "Focus Timer", two dependent items through runner → review → merge, one debated idea).
