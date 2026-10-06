---
id: item-de7ac5a6
title: Workflow definitions as data
project: hub
stage: review
priority: medium
type: task
labels:
  - agents
  - architecture
position: 2
parent: null
phase: null
blocked_by: []
relates_to: []
created: '2026-08-29T00:20:48.502Z'
updated: '2026-10-05T22:56:58.773Z'
---

Like agents: workflows (sequence of agent steps with roles, e.g. debate) defined as markdown/YAML files instead of code. debate.ts becomes the first built-in consumer.

## Notes

<!-- apphub:notes -->
- 2026-10-05T22:49:13.513Z · info · Claimed by claude-runner (priority: medium)
- 2026-10-05T22:49:18.074Z · progress · Reading agents.ts / debate.ts to design workflow definition files
- 2026-10-05T22:49:49.817Z · progress · Writing workflows.ts (workflows/*.md registry + runner) and workflows/debate.md
- 2026-10-05T22:55:41.072Z · progress · Engine, API, CLI, Agents page and docs done; typecheck clean. Waiting on a live 2-round debate (Ollama) through the new engine
- 2026-10-05T22:56:46.968Z · progress · Done: 3 commits (engine + workflows/debate.md, API/CLI/UI, docs). Verified typecheck, docs:check, API error paths, live 2-round debate.
- 2026-10-05T22:56:58.771Z · commit · Branch claude/item-de7-workflow-definitions-as-data ready for review (3 commits). - **Agents page:** a new Workflows section shows each role sequence and has a box to run it. 3. **`docs(agents)` 0b9d4
