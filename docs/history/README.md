---
title: History
section: History
order: 1
summary: Superseded architecture and refactoring plans — archived, not maintained.
---

# History

Archived documents. They describe earlier states and plans of the hub; they are **not**
updated anymore. Current state: [overview](../start/overview.md),
[architecture](../concepts/architecture.md), [roadmap](../roadmap.md).

| Document | What it was | Status (2026-10-02) |
| --- | --- | --- |
| [ARCHITECTURE-v1.md](ARCHITECTURE-v1.md) | first architecture write-up | obsolete: describes `TASKS.md` parsing and `/api/tasks` routes that no longer exist |
| [ARCHITECTURE-V2.md](ARCHITECTURE-V2.md) | v2 plan: production readiness, runner concurrency, direct API mode, self-modification | Phase 1 done (adapter-node, health, service scripts, run logs); 2A.1 done (no direct-write fallback); 2A.2–2A.6, 2B and 3 open → carried into the [roadmap](../roadmap.md). Self-registration landed as slug `hub`, not `apphub`. |
| [REFACTOR.md](REFACTOR.md) | 12-step cleanup plan | all 12 steps done (commits b1dca29 … a94bc2e) |
| [REFACTOR-COMPLETE.md](REFACTOR-COMPLETE.md) | completion note of that refactor | done; its commit table does not match the real commit messages |

Since 2026-10-01 the authoritative record of changes is the git history itself — see
[the logbook](../concepts/logbook.md).
