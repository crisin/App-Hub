---
id: item-aba1d367
title: Add docs/AGENTS.md explaining the agent system
project: hub
stage: done
priority: medium
type: task
labels:
  - aider
  - docs
position: 0
parent: null
phase: null
blocked_by: []
relates_to: []
created: '2026-08-28T23:41:05.157Z'
updated: '2026-10-01T22:21:39.888Z'
---

Create a new file docs/AGENTS.md (create the docs folder if needed). It should briefly explain: agents are markdown files in agents/ with frontmatter (provider, model) and a system prompt body; they run via the hub API (/api/agents) or CLI (apphub agent). Keep it under 40 lines. Do not modify any other files.

## Notes

<!-- apphub:notes -->
- 2026-08-28T23:41:05.159Z · info · Claimed by claude-runner (priority: medium)
- 2026-08-28T23:42:53.510Z · commit · Branch claude/item-aba-add-docs-agents-md-explaining-the-agent- ready for review (0 commits). 'qwen3:8b-q5_K_M' not found"} Retrying in 8.0 seconds... litellm.APIConnectionError: Ollama_chatExceptio
- 2026-08-28T23:44:28.209Z · info · Claimed by claude-runner (priority: medium)
- 2026-08-28T23:44:28.441Z · error · Worktree creation failed: UNIQUE constraint failed: branch_reviews.branch_name. Item returned to Claude lane for retry.
- 2026-08-28T23:45:10.392Z · info · Claimed by claude-runner (priority: medium)
- 2026-08-28T23:45:10.622Z · error · Worktree creation failed: UNIQUE constraint failed: branch_reviews.branch_name. Item returned to Claude lane for retry.
- 2026-08-28T23:46:01.864Z · info · Claimed by claude-runner (priority: medium)
- 2026-08-28T23:47:43.349Z · error · Finished without commits after 2m 41s — check the run log; item moved to build
- 2026-08-28T23:48:45.190Z · info · Claimed by claude-runner (priority: medium)
- 2026-08-28T23:50:22.830Z · error · Finished without commits after 2m 38s — check the run log; item moved to build
- 2026-08-28T23:56:40.757Z · info · Claimed by claude-runner (priority: medium)
- 2026-08-29T00:00:57.128Z · commit · Branch claude/item-aba-add-docs-agents-md-explaining-the-agent- ready for review (1 commits). ## Example ```markdown --- provider: claude model: claude-3-5-sonnet-20240620 --- You are a helpful
- 2026-10-01T22:21:39.808Z · info · Superseded: docs/howto/agents.md + docs/concepts/runner.md (dd331f9) document agents, providers, debate and coder backends. aider branch discarded (outdated example, provider claude does not exist).
